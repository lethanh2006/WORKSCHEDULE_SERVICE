const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Calendar keys use Vietnam time; stored schedule dates remain UTC midnight. */
export function vietnamDateKey(value: Date = new Date()): string {
  return new Date(value.getTime() + VIETNAM_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

export function scheduleMonthRange(value: unknown) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(
    typeof value === 'string' ? value : '',
  );
  if (!match || Number(match[1]) < 1000) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  return {
    month: value as string,
    start: new Date(Date.UTC(year, month, 1)),
    end: new Date(Date.UTC(year, month + 1, 1)),
  };
}

export function policyScheduleMonth(policy: {
  registration_start: Date;
  registration_end: Date;
}): string | null {
  const start = new Date(policy.registration_start);
  const end = new Date(policy.registration_end);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return null;
  }
  const month = vietnamDateKey(start).slice(0, 7);
  return start < end && month === vietnamDateKey(end).slice(0, 7)
    ? month
    : null;
}

export function endOfVietnamMonth(now = new Date()): Date {
  const range = scheduleMonthRange(vietnamDateKey(now).slice(0, 7))!;
  return new Date(range.end.getTime() - VIETNAM_OFFSET_MS - 1);
}
