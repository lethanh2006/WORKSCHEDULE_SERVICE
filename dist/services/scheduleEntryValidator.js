const ENTRY_TYPES = new Set(['office', 'remote', 'day_off', 'leave']);
const ENTRY_PERIODS = new Set(['full_day', 'morning', 'afternoon']);
const toUtcDateKey = (date) => date.toISOString().slice(0, 10);
export const normalizeScheduleEntries = (entries, weekStart) => {
    if (!Array.isArray(entries) || entries.length === 0) {
        return { message: 'Lịch làm việc phải có ít nhất một ngày.' };
    }
    if (entries.length > 7) {
        return { message: 'Một lịch tuần không được có quá 7 ngày.' };
    }
    const start = new Date(weekStart);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    const seenDates = new Set();
    const normalized = [];
    for (const rawEntry of entries) {
        const date = new Date(String(rawEntry?.date || ''));
        if (Number.isNaN(date.getTime())) {
            return { message: 'Ngày làm việc không hợp lệ.' };
        }
        date.setUTCHours(0, 0, 0, 0);
        if (date < start || date >= end) {
            return { message: 'Mọi ngày đăng ký phải nằm trong tuần đã chọn.' };
        }
        const dateKey = toUtcDateKey(date);
        if (seenDates.has(dateKey)) {
            return { message: `Ngày ${dateKey} đang bị đăng ký trùng.` };
        }
        seenDates.add(dateKey);
        const type = String(rawEntry?.type || '');
        if (!ENTRY_TYPES.has(type)) {
            return { message: `Hình thức làm việc của ngày ${dateKey} không hợp lệ.` };
        }
        const period = String(rawEntry?.period || 'full_day');
        if (!ENTRY_PERIODS.has(period)) {
            return { message: `Ca làm của ngày ${dateKey} không hợp lệ.` };
        }
        const note = typeof rawEntry?.note === 'string' ? rawEntry.note.trim() : undefined;
        if (note && note.length > 200) {
            return { message: `Ghi chú của ngày ${dateKey} không được quá 200 ký tự.` };
        }
        normalized.push({
            date,
            type: type,
            period: period,
            ...(note ? { note } : {})
        });
    }
    return { entries: normalized };
};
