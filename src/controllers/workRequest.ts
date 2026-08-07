import type { Response } from 'express';
import type { FilterQuery } from 'mongoose';
import type { AuthenticatedRequest } from '../middleware/isAuth.js';
import { WorkRequest, type IWorkRequest } from '../models/WorkRequest.js';
import { normalizeWorkRequest } from '../services/workRequestValidator.js';
import { enrichRowsWithEmployeeProfiles } from '../utils/userProfileEnricher.js';

const getEmployeeId = (req: AuthenticatedRequest) => req.user._id || req.user.id;

const parseMonth = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  return {
    $gte: new Date(Date.UTC(year, month, 1)),
    $lt: new Date(Date.UTC(year, month + 1, 1))
  };
};

export const createWorkRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const normalized = normalizeWorkRequest(req.body || {});
    if (!normalized.data) {
      res.status(400).json({ success: false, message: normalized.message });
      return;
    }

    const employeeId = getEmployeeId(req);
    const duplicate = await WorkRequest.findOne({
      employee_id: employeeId,
      type: normalized.data.type,
      start_at: normalized.data.start_at,
      status: { $in: ['pending', 'approved'] }
    });
    if (duplicate) {
      res.status(409).json({ success: false, message: 'Bạn đã có một đơn cùng loại vào thời gian này.' });
      return;
    }

    const request = await WorkRequest.create({ employee_id: employeeId, ...normalized.data });
    res.status(201).json({ success: true, data: request });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Không thể tạo đơn.' });
  }
};

export const getMyWorkRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const filter: FilterQuery<IWorkRequest> = { employee_id: getEmployeeId(req) };
    const monthRange = parseMonth(req.query.month);
    if (req.query.month && !monthRange) {
      res.status(400).json({ success: false, message: 'Tháng cần xem phải có định dạng YYYY-MM.' });
      return;
    }
    if (monthRange) filter.start_at = monthRange;
    if (typeof req.query.type === 'string' && req.query.type !== 'all') filter.type = req.query.type as never;
    if (typeof req.query.status === 'string' && req.query.status !== 'all') {
      filter.status = req.query.status as never;
    }

    const requests = await WorkRequest.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể tải lịch sử đơn.' });
  }
};

export const getMyWorkRequestStats = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const filter: FilterQuery<IWorkRequest> = { employee_id: getEmployeeId(req) };
    const monthRange = parseMonth(req.query.month);
    if (req.query.month && !monthRange) {
      res.status(400).json({ success: false, message: 'Tháng cần xem phải có định dạng YYYY-MM.' });
      return;
    }
    if (monthRange) filter.start_at = monthRange;

    const requests = await WorkRequest.find(filter).select('type status start_at end_at period').lean();
    const byType: Record<string, number> = {};
    const approvedByType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let approvedOvertimeHours = 0;
    requests.forEach(request => {
      byType[request.type] = (byType[request.type] || 0) + 1;
      byStatus[request.status] = (byStatus[request.status] || 0) + 1;
      if (request.status === 'approved') {
        approvedByType[request.type] = (approvedByType[request.type] || 0) + 1;
      }
      if (request.type === 'overtime' && request.status === 'approved' && request.end_at) {
        approvedOvertimeHours +=
          (new Date(request.end_at).getTime() - new Date(request.start_at).getTime()) / 3_600_000;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        total: requests.length,
        pending: byStatus.pending || 0,
        approved: byStatus.approved || 0,
        rejected: byStatus.rejected || 0,
        cancelled: byStatus.cancelled || 0,
        approved_overtime_hours: Math.round(approvedOvertimeHours * 10) / 10,
        by_type: byType,
        approved_by_type: approvedByType
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể tải thống kê đơn.' });
  }
};

export const cancelMyWorkRequest = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const request = await WorkRequest.findOne({
      _id: req.params.id,
      employee_id: getEmployeeId(req)
    });
    if (!request) {
      res.status(404).json({ success: false, message: 'Không tìm thấy đơn.' });
      return;
    }
    if (request.status !== 'pending') {
      res.status(400).json({ success: false, message: 'Chỉ có thể hủy đơn đang chờ duyệt.' });
      return;
    }
    request.status = 'cancelled';
    await request.save();
    res.status(200).json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể hủy đơn.' });
  }
};

export const getAdminWorkRequests = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (req.user.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Bạn không có quyền xem danh sách này.' });
      return;
    }
    const filter: FilterQuery<IWorkRequest> = {};
    if (typeof req.query.type === 'string' && req.query.type !== 'all') filter.type = req.query.type as never;
    if (typeof req.query.status === 'string' && req.query.status !== 'all') {
      filter.status = req.query.status as never;
    }
    const monthRange = parseMonth(req.query.month);
    if (monthRange) filter.start_at = monthRange;
    const requests = await WorkRequest.find(filter).sort({ createdAt: -1 });
    const enriched = await enrichRowsWithEmployeeProfiles(req.headers.authorization, requests);
    res.status(200).json({ success: true, count: enriched.length, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể tải danh sách đơn.' });
  }
};

const reviewWorkRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  status: 'approved' | 'rejected'
) => {
  if (req.user.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Bạn không có quyền duyệt đơn.' });
    return;
  }
  const request = await WorkRequest.findById(req.params.id);
  if (!request || request.status !== 'pending') {
    res.status(400).json({ success: false, message: 'Đơn không tồn tại hoặc đã được xử lý.' });
    return;
  }
  const rejectReason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (status === 'rejected' && !rejectReason) {
    res.status(400).json({ success: false, message: 'Vui lòng nhập lý do từ chối.' });
    return;
  }
  request.status = status;
  request.reviewed_by = getEmployeeId(req);
  request.reviewed_at = new Date();
  request.reject_reason = status === 'rejected' ? rejectReason : undefined;
  await request.save();
  res.status(200).json({ success: true, data: request });
};

export const approveWorkRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await reviewWorkRequest(req, res, 'approved');
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể duyệt đơn.' });
  }
};

export const rejectWorkRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await reviewWorkRequest(req, res, 'rejected');
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể từ chối đơn.' });
  }
};
