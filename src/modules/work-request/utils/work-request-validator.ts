import mongoose from 'mongoose';
import type { WorkRequestType } from '../../../schemas/work-request.schema';

const REQUEST_TYPES = new Set([
  'leave',
  'late',
  'early',
  'overtime',
  'business_trip',
  'remote',
]);
const PERIODS = new Set(['full_day', 'morning', 'afternoon']);

const optionalText = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export type NormalizedWorkRequest = {
  type: WorkRequestType;
  start_at: Date;
  end_at?: Date;
  period: 'full_day' | 'morning' | 'afternoon';
  reason: string;
  location?: string;
  project?: string;
  estimated_cost?: number;
  manager_id?: mongoose.Types.ObjectId;
  attachment_urls: string[];
  is_school_leave: boolean;
};

export const normalizeWorkRequest = (
  body: Record<string, unknown>,
): { data?: NormalizedWorkRequest; message?: string } => {
  const type = String(body.type || '');
  if (!REQUEST_TYPES.has(type)) return { message: 'Loại đơn không hợp lệ.' };

  const startAt = new Date(String(body.start_at || ''));
  if (Number.isNaN(startAt.getTime()))
    return { message: 'Thời gian bắt đầu không hợp lệ.' };

  const endAt = body.end_at ? new Date(String(body.end_at)) : undefined;
  if (endAt && Number.isNaN(endAt.getTime()))
    return { message: 'Thời gian kết thúc không hợp lệ.' };
  if (endAt && endAt <= startAt)
    return { message: 'Thời gian kết thúc phải sau thời gian bắt đầu.' };

  if ((type === 'overtime' || type === 'business_trip') && !endAt) {
    return { message: 'Loại đơn này cần có thời gian kết thúc.' };
  }

  const period = String(body.period || 'full_day');
  if (!PERIODS.has(period)) return { message: 'Buổi đăng ký không hợp lệ.' };

  const reason = optionalText(body.reason);
  if (!reason) return { message: 'Vui lòng nhập lý do.' };
  if (reason.length > 1000)
    return { message: 'Lý do không được quá 1000 ký tự.' };

  const location = optionalText(body.location);
  if (type === 'business_trip' && !location) {
    return { message: 'Vui lòng nhập nơi đi công tác.' };
  }

  const project = optionalText(body.project);
  if (type === 'overtime' && !project) {
    return { message: 'Vui lòng nhập dự án làm ngoài giờ.' };
  }

  let estimatedCost: number | undefined;
  if (body.estimated_cost !== undefined && body.estimated_cost !== '') {
    estimatedCost = Number(body.estimated_cost);
    if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
      return { message: 'Chi phí dự kiến phải là số không âm.' };
    }
  }

  const managerIdValue = optionalText(body.manager_id);
  if (managerIdValue && !mongoose.isValidObjectId(managerIdValue)) {
    return { message: 'Người quản lý không hợp lệ.' };
  }

  const attachmentUrls = Array.isArray(body.attachment_urls)
    ? body.attachment_urls.filter(
        (url): url is string => typeof url === 'string' && Boolean(url.trim()),
      )
    : [];
  if (attachmentUrls.length > 5)
    return { message: 'Mỗi đơn chỉ được đính kèm tối đa 5 tệp.' };

  return {
    data: {
      type: type as WorkRequestType,
      start_at: startAt,
      ...(endAt ? { end_at: endAt } : {}),
      period: period as NormalizedWorkRequest['period'],
      reason,
      ...(location ? { location } : {}),
      ...(project ? { project } : {}),
      ...(estimatedCost !== undefined ? { estimated_cost: estimatedCost } : {}),
      ...(managerIdValue
        ? { manager_id: new mongoose.Types.ObjectId(managerIdValue) }
        : {}),
      attachment_urls: attachmentUrls.map((url) => url.trim()),
      is_school_leave: body.is_school_leave === true,
    },
  };
};
