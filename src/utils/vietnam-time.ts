const VIETNAM_UTC_OFFSET_HOURS = 7;

/** Tạo thời điểm UTC tương ứng với giờ làm việc tại Việt Nam (UTC+7). */
export function atVietnamTime(date: Date, hour: number, minute: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hour - VIETNAM_UTC_OFFSET_HOURS,
      minute,
    ),
  );
}
