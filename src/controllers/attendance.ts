import type { Request, Response } from 'express';
import { AttendanceQrToken } from '../models/AttendanceQrToken.js';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { ScheduleEntry } from '../models/ScheduleEntry.js';
import { ScheduleRequest } from '../models/ScheduleRequest.js';
import type { AuthenticatedRequest } from '../middleware/isAuth.js';
import crypto from 'crypto';
import { enrichRowsWithEmployeeProfiles } from '../utils/userProfileEnricher.js';

export const generateQrToken = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tokenStr = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 1000); // 30 seconds TTL

    const vnOffset = 7 * 60; // 7 hours in minutes
    const localNow = new Date(now.getTime() + (vnOffset + now.getTimezoneOffset()) * 60 * 1000);
    const todayDate = new Date(Date.UTC(localNow.getFullYear(), localNow.getMonth(), localNow.getDate()));

    const token = await AttendanceQrToken.create({
      token: tokenStr,
      date: todayDate,
      expires_at: expiresAt
    });

    res.status(201).json({ success: true, data: token });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};

export const scanQrToken = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    const userId = req.user._id || req.user.id;
    const now = new Date();

    const validToken = await AttendanceQrToken.findOneAndUpdate(
      { token, used: false, expires_at: { $gt: now } },
      { $set: { used: true, used_by: userId, used_at: now } },
      { new: true }
    );

    if (!validToken) {
      res.status(400).json({ success: false, message: 'Mã QR không hợp lệ, đã sử dụng hoặc hết hạn' });
      return;
    }

    const vnOffset = 7 * 60; // 7 hours in minutes
    const localNow = new Date(now.getTime() + (vnOffset + now.getTimezoneOffset()) * 60 * 1000);
    const startOfToday = new Date(Date.UTC(localNow.getFullYear(), localNow.getMonth(), localNow.getDate()));
    
    const requests = await ScheduleRequest.find({ employee_id: userId, status: 'approved' });
    let reqIds = requests.map(r => r._id);

    const hasOfficeEntry = await ScheduleEntry.findOne({
      request_id: { $in: reqIds },
      date: startOfToday,
      type: 'office'
    });

    if (!hasOfficeEntry) {
      res.status(400).json({ success: false, message: 'Bạn không có lịch làm việc tại văn phòng được duyệt cho ngày hôm nay' });
      return;
    }

    let record = await AttendanceRecord.findOne({
      employee_id: userId,
      date: startOfToday,
      source: 'qr'
    });

    if (!record) {
      record = await AttendanceRecord.create({
        employee_id: userId,
        date: startOfToday,
        schedule_type: 'office',
        check_in_at: now,
        source: 'qr',
        check_in_token_id: validToken._id
      });
      res.status(200).json({ success: true, message: 'Check-in thành công', data: record });
    } else {
      if (record.check_out_at) {
        res.status(400).json({ success: false, message: 'Bạn đã check-out hôm nay rồi' });
        return;
      }
      
      record.check_out_at = now;
      record.check_out_token_id = validToken._id;
      await record.save();
      
      res.status(200).json({ success: true, message: 'Check-out thành công', data: record });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};

export const getMyAttendance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query;
    const filter: any = { employee_id: req.user._id || req.user.id };
    
    if (from || to) {
        filter.date = {};
        if (from) filter.date.$gte = new Date(from as string);
        if (to) filter.date.$lte = new Date(to as string);
    }

    const records = await AttendanceRecord.find(filter).sort({ date: -1 });
    const data = records.map((record) => ({
      ...record.toObject(),
      employee: req.user ?? null
    }));
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};

export const getTodayAttendance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const now = new Date();
      const vnOffset = 7 * 60; // 7 hours in minutes
      const localNow = new Date(now.getTime() + (vnOffset + now.getTimezoneOffset()) * 60 * 1000);
      const startOfToday = new Date(Date.UTC(localNow.getFullYear(), localNow.getMonth(), localNow.getDate()));
      
      const records = await AttendanceRecord.find({ 
        date: startOfToday, check_in_at: { $exists: true } 
      });
      const enriched = await enrichRowsWithEmployeeProfiles(req.headers.authorization, records);
      res.status(200).json({ success: true, count: enriched.length, data: enriched });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
    }
};

export const getReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { from, to, employee_id } = req.query;
      const filter: any = {};
      
      if (employee_id) filter.employee_id = employee_id;
      if (from || to) {
          filter.date = {};
          if (from) filter.date.$gte = new Date(from as string);
          if (to) filter.date.$lte = new Date(to as string);
      }
  
      const records = await AttendanceRecord.find(filter).sort({ date: -1 });
      const enriched = await enrichRowsWithEmployeeProfiles(req.headers.authorization, records);
      res.status(200).json({ success: true, count: enriched.length, data: enriched });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
    }
};
