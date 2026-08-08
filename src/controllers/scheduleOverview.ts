import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/isAuth.js';
import { ScheduleEntry } from '../models/ScheduleEntry.js';
import { ScheduleRequest } from '../models/ScheduleRequest.js';

const parseMonthRange = (value: unknown) => {
  const month = typeof value === 'string' ? value : '';
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  return { month, start, end };
};

const getSessionCount = (period?: string) => (period === 'full_day' || !period ? 2 : 1);

export const getMyMonthlyOverview = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const range = parseMonthRange(req.query.month);
    if (!range) {
      res.status(400).json({
        success: false,
        message: 'Tháng cần xem phải có định dạng YYYY-MM.'
      });
      return;
    }

    const employeeId = req.user._id || req.user.id;
    const requests = await ScheduleRequest.find({ employee_id: employeeId })
      .select('_id week_start status submitted_at reviewed_at reject_reason')
      .lean();
    const requestById = new Map(requests.map(request => [String(request._id), request]));
    const requestIds = requests.map(request => request._id);
    const entries = await ScheduleEntry.find({
      request_id: { $in: requestIds },
      date: { $gte: range.start, $lt: range.end }
    })
      .sort({ date: 1 })
      .lean();

    const calendarEntries = entries.map(entry => {
      const scheduleRequest = requestById.get(String(entry.request_id));
      return {
        _id: entry._id,
        schedule_request_id: entry.request_id,
        week_start: scheduleRequest?.week_start,
        request_status: scheduleRequest?.status || 'pending',
        reject_reason: scheduleRequest?.reject_reason,
        date: entry.date,
        type: entry.type,
        period: entry.period || 'full_day',
        note: entry.note
      };
    });

    const activeEntries = calendarEntries.filter(entry => entry.request_status !== 'rejected');
    const approvedEntries = calendarEntries.filter(entry => entry.request_status === 'approved');
    const sumSessions = (rows: typeof calendarEntries) =>
      rows.reduce((total, entry) => total + getSessionCount(entry.period), 0);
    const sumSessionsByType = (rows: typeof calendarEntries, type: string) =>
      sumSessions(rows.filter(entry => entry.type === type));
    const relevantRequestIds = new Set(calendarEntries.map(entry => String(entry.schedule_request_id)));
    const requestCounts = requests
      .filter(request => relevantRequestIds.has(String(request._id)))
      .reduce<Record<string, number>>((result, request) => {
      result[request.status] = (result[request.status] || 0) + 1;
      return result;
      }, {});

    res.status(200).json({
      success: true,
      data: {
        month: range.month,
        entries: calendarEntries,
        stats: {
          registered_sessions: sumSessions(
            activeEntries.filter(entry => entry.type === 'office' || entry.type === 'remote')
          ),
          approved_sessions: sumSessions(
            approvedEntries.filter(entry => entry.type === 'office' || entry.type === 'remote')
          ),
          office_sessions: sumSessionsByType(approvedEntries, 'office'),
          remote_sessions: sumSessionsByType(approvedEntries, 'remote'),
          leave_sessions: sumSessionsByType(approvedEntries, 'leave'),
          day_off_sessions: sumSessionsByType(approvedEntries, 'day_off'),
          approved_work_days: new Set(
            approvedEntries
              .filter(entry => entry.type === 'office' || entry.type === 'remote')
              .map(entry => new Date(entry.date).toISOString().slice(0, 10))
          ).size,
          pending_requests: requestCounts.pending || 0,
          approved_requests: requestCounts.approved || 0,
          rejected_requests: requestCounts.rejected || 0
        }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Không thể tải lịch làm việc trong tháng.' });
  }
};
