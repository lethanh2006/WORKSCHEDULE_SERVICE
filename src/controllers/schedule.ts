import type { Request, Response } from 'express';
import { ScheduleRequest } from '../models/ScheduleRequest.js';
import { ScheduleEntry } from '../models/ScheduleEntry.js';
import { WorkPolicy } from '../models/WorkPolicy.js';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import type { AuthenticatedRequest } from '../middleware/isAuth.js';
import { isMonday, parseIsoWeek, getWeekStartRange } from '../utils/date.js';
import { enrichSingleWithEmployeeProfile } from '../utils/userProfileEnricher.js';
import { normalizeScheduleEntries } from '../services/scheduleEntryValidator.js';

const canManageSchedules = (role?: string) =>
  ['admin', 'manager', 'chef'].includes(String(role || '').toLowerCase());

export const getMySchedules = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { week } = req.query;
    const filter: any = { employee_id: req.user._id || req.user.id };

    if (week && typeof week === 'string') {
      const matchWeek = parseIsoWeek(week);
      if (matchWeek) {
        filter.week_start = getWeekStartRange(matchWeek);
      }
    }

    const requests = await ScheduleRequest.find(filter).sort({ week_start: -1 });

    const result = [];
    for (const scheduleRequest of requests) {
      const entries = await ScheduleEntry.find({ request_id: scheduleRequest._id });
      const scheduleWithEmployee = await enrichSingleWithEmployeeProfile(
        req.headers.authorization,
        scheduleRequest
      );
      result.push({ ...scheduleWithEmployee, entries });
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const createRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { week_start, entries } = req.body;

    if (!isMonday(week_start)) {
      res.status(400).json({ success: false, message: 'Tuần đăng ký phải bắt đầu từ thứ Hai.' });
      return;
    }

    const normalized = normalizeScheduleEntries(entries, new Date(week_start));
    if (!normalized.entries) {
      res.status(400).json({ success: false, message: normalized.message });
      return;
    }

    const existing = await ScheduleRequest.findOne({
      employee_id: req.user._id || req.user.id,
      week_start: getWeekStartRange(new Date(week_start))
    });

    if (existing) {
      res.status(400).json({ success: false, message: 'Schedule request for this week already exists' });
      return;
    }

    if (req.user.role !== 'admin') {
      const policy = await WorkPolicy.findOne();
      if (policy) {
        const now = new Date();
        if (policy.locked || now < policy.registration_start || now > policy.registration_end) {
          res.status(400).json({ success: false, message: 'Ngoài khoảng thời gian đăng ký lịch làm việc' });
          return;
        }
      }


      const now = new Date();
      const weekStartDate = new Date(week_start);
      weekStartDate.setHours(0, 0, 0, 0);

      const currentWeekMon = new Date(now);
      const currentDay = currentWeekMon.getDay();
      const currentDiff = currentWeekMon.getDate() - (currentDay === 0 ? 6 : currentDay - 1);
      currentWeekMon.setDate(currentDiff);
      currentWeekMon.setHours(0, 0, 0, 0);

      const maxAllowedWeekStart = new Date(currentWeekMon);
      maxAllowedWeekStart.setDate(maxAllowedWeekStart.getDate() + 28);
      maxAllowedWeekStart.setHours(0, 0, 0, 0);

      if (weekStartDate > maxAllowedWeekStart) {
        res.status(400).json({
          success: false,
          message: 'Không được phép đăng ký lịch làm việc quá xa trong tương lai (tối đa 4 tuần tới).'
        });
        return;
      }
    }

    const submittedAt = new Date();
    const newRequest = new ScheduleRequest({
      employee_id: req.user._id || req.user.id,
      week_start
    });

    newRequest.status = 'pending';
    newRequest.submitted_at = submittedAt;

    try {
      if (normalized.entries.length > 0) {
        const insertData = normalized.entries.map(e => ({
          request_id: newRequest._id,
          date: e.date,
          type: e.type,
          period: e.period,
          note: e.note
        }));
        await ScheduleEntry.insertMany(insertData);
      }

      await newRequest.save();
    } catch (error) {
      await ScheduleEntry.deleteMany({ request_id: newRequest._id });
      throw error;
    }

    res.status(201).json({ success: true, data: newRequest });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const getRequestInfo = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const _id = req.params.id;
    const employee_id = req.user._id || req.user.id;
    let request = null;
    if (canManageSchedules(req.user.role)) {
      request = await ScheduleRequest.findById(_id);
    } else {
      request = await ScheduleRequest.findOne({ _id, employee_id });
    }

    if (!request) {
      res.status(404).json({ success: false, message: 'Request not found' });
      return;
    }

    const entries = await ScheduleEntry.find({ request_id: _id });
    const requestWithEmployee = await enrichSingleWithEmployeeProfile(
      req.headers.authorization,
      request
    );
    res.status(200).json({ success: true, data: { ...requestWithEmployee, entries } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
}

export const updateEntries = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { entries } = req.body;

    let request = null;
    const canManageRequest = canManageSchedules(req.user.role);

    if (canManageRequest) {
      request = await ScheduleRequest.findById(id);
    } else {
      request = await ScheduleRequest.findOne({ _id: id, employee_id: req.user._id || req.user.id });
    }

    if (!request) {
      res.status(404).json({ success: false, message: 'Not found' });
      return;
    }

    const normalized = normalizeScheduleEntries(entries, new Date(request.week_start));
    if (!normalized.entries) {
      res.status(400).json({ success: false, message: normalized.message });
      return;
    }

    if (!canManageRequest) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa lịch đã gửi.' });
      return;
    }

    await ScheduleEntry.deleteMany({ request_id: id });
    const insertData = normalized.entries.map(e => ({
      request_id: id,
      date: e.date,
      type: e.type,
      period: e.period,
      note: e.note
    }));
    await ScheduleEntry.insertMany(insertData);

    // If already approved, sync attendance records
    if (request.status === 'approved') {
      const weekStart = new Date(request.week_start);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      await AttendanceRecord.deleteMany({
        employee_id: request.employee_id,
        source: 'schedule',
        date: { $gte: weekStart, $lt: weekEnd }
      });

      const remoteEntries = insertData.filter(e => e.type === 'remote');
      if (remoteEntries.length > 0) {
        const attRecords = remoteEntries.map(entry => {
          const checkIn = new Date(entry.date);
          const checkOut = new Date(entry.date);
          if (entry.period === 'morning') {
            checkIn.setHours(8, 30, 0, 0);
            checkOut.setHours(12, 0, 0, 0);
          } else if (entry.period === 'afternoon') {
            checkIn.setHours(13, 30, 0, 0);
            checkOut.setHours(17, 30, 0, 0);
          } else {
            checkIn.setHours(8, 30, 0, 0);
            checkOut.setHours(17, 30, 0, 0);
          }
          return {
            employee_id: request.employee_id,
            date: entry.date,
            schedule_type: 'remote' as const,
            source: 'schedule' as const,
            check_in_at: checkIn,
            check_out_at: checkOut
          };
        });
        await AttendanceRecord.insertMany(attRecords);
      }
    }

    res.status(200).json({ success: true, message: 'Updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const deleteRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const isAdminUser = canManageSchedules(req.user.role);
    if (!isAdminUser) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền xóa lịch đã gửi.' });
      return;
    }

    const request = await ScheduleRequest.findById(id);

    if (!request) {
      res.status(404).json({ success: false, message: 'Not found' });
      return;
    }

    await ScheduleEntry.deleteMany({ request_id: id });

    // Delete attendance records if approved schedule is deleted
    if (request.status === 'approved') {
      const weekStart = new Date(request.week_start);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      await AttendanceRecord.deleteMany({
        employee_id: request.employee_id,
        source: 'schedule',
        date: { $gte: weekStart, $lt: weekEnd }
      });
    }

    await request.deleteOne();

    res.status(200).json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
