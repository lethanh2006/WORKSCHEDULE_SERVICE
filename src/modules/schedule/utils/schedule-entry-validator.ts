import { scheduleMonthRange } from '../../../utils/schedule-month';

export type ScheduleEntryInput = {
  date?: unknown;
  type?: unknown;
  period?: unknown;
  note?: unknown;
};

export type NormalizedScheduleEntry = {
  date: Date;
  type: 'office' | 'remote' | 'day_off' | 'leave';
  period: 'full_day' | 'morning' | 'afternoon';
  note?: string;
};

const ENTRY_TYPES = new Set(['office', 'remote', 'day_off', 'leave']);
const ENTRY_PERIODS = new Set(['full_day', 'morning', 'afternoon']);

const toUtcDateKey = (date: Date) => date.toISOString().slice(0, 10);

export const normalizeScheduleEntries = (
  entries: unknown,
  month: string,
): { entries?: NormalizedScheduleEntry[]; message?: string } => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { message: 'Lịch làm việc phải có ít nhất một ngày.' };
  }

  if (entries.length > 31) {
    return { message: 'Một lịch tháng không được có quá 31 ngày.' };
  }

  const range = scheduleMonthRange(month);
  if (!range) return { message: 'Tháng đăng ký phải có định dạng YYYY-MM.' };
  const { start, end } = range;
  const seenDates = new Set<string>();
  const normalized: NormalizedScheduleEntry[] = [];

  for (const rawEntry of entries as ScheduleEntryInput[]) {
    const inputDate = String(rawEntry?.date || '');
    const dateKeyInput = inputDate.slice(0, 10);
    const date = new Date(dateKeyInput);
    if (
      !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(inputDate) ||
      Number.isNaN(new Date(inputDate).getTime()) ||
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== dateKeyInput
    ) {
      return { message: 'Ngày làm việc không hợp lệ.' };
    }
    date.setUTCHours(0, 0, 0, 0);

    if (date < start || date >= end) {
      return { message: 'Mọi ngày đăng ký phải nằm trong tháng đã chọn.' };
    }

    const dateKey = toUtcDateKey(date);
    if (seenDates.has(dateKey)) {
      return { message: `Ngày ${dateKey} đang bị đăng ký trùng.` };
    }
    seenDates.add(dateKey);

    const type = String(rawEntry?.type || '');
    if (!ENTRY_TYPES.has(type)) {
      return {
        message: `Hình thức làm việc của ngày ${dateKey} không hợp lệ.`,
      };
    }

    const period = String(rawEntry?.period || 'full_day');
    if (!ENTRY_PERIODS.has(period)) {
      return { message: `Ca làm của ngày ${dateKey} không hợp lệ.` };
    }

    const note =
      typeof rawEntry?.note === 'string' ? rawEntry.note.trim() : undefined;
    if (note && note.length > 200) {
      return {
        message: `Ghi chú của ngày ${dateKey} không được quá 200 ký tự.`,
      };
    }

    normalized.push({
      date,
      type: type as NormalizedScheduleEntry['type'],
      period: period as NormalizedScheduleEntry['period'],
      ...(note ? { note } : {}),
    });
  }

  return { entries: normalized };
};
