export function getNextMonday(date = new Date()) {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = d.getUTCDate() + (day === 0 ? 1 : 8 - day);
    const nextMon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
    nextMon.setUTCHours(0, 0, 0, 0);
    return nextMon;
}
export function isMonday(dateString) {
    const d = new Date(dateString);
    return d.getUTCDay() === 1;
}
export function getDateOfISOWeek(w, y) {
    const simple = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7));
    const dow = simple.getUTCDay();
    const ISOweekStart = simple;
    if (dow <= 4)
        ISOweekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
    else
        ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
    ISOweekStart.setUTCHours(0, 0, 0, 0);
    return ISOweekStart;
}
export function parseIsoWeek(isoWeekStr) {
    const match = isoWeekStr.match(/^(\d{4})-W(\d{1,2})$/);
    if (!match)
        return null;
    const year = parseInt(match[1]);
    const week = parseInt(match[2]);
    return getDateOfISOWeek(week, year);
}
export function isPastDeadline(weekStart, deadlineDay, deadlineHour) {
    const deadlineDate = new Date(weekStart);
    deadlineDate.setUTCDate(deadlineDate.getUTCDate() - (7 - deadlineDay + 1));
    deadlineDate.setUTCHours(deadlineHour, 0, 0, 0);
    const now = new Date();
    return now > deadlineDate;
}
export function isLockedByPolicy(weekStart, lockScheduleDays) {
    const lockDate = new Date(weekStart);
    lockDate.setUTCDate(lockDate.getUTCDate() - lockScheduleDays);
    lockDate.setUTCHours(0, 0, 0, 0);
    const now = new Date();
    return now >= lockDate;
}
export function getWeekStartRange(monday) {
    const start = new Date(monday);
    start.setUTCDate(start.getUTCDate() - 1);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(monday);
    end.setUTCDate(end.getUTCDate() + 1);
    end.setUTCHours(0, 0, 0, 0);
    return { $gte: start, $lt: end };
}
