export function getNextMonday(date: Date = new Date()): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() + (day === 0 ? 1 : 8 - day);
    return new Date(d.setDate(diff));
}


export function isMonday(dateString: string): boolean {
    const d = new Date(dateString);
    return d.getDay() === 1;
}


export function getDateOfISOWeek(w: number, y: number): Date {
    var simple = new Date(y, 0, 1 + (w - 1) * 7);
    var dow = simple.getDay();
    var ISOweekStart = simple;
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return ISOweekStart;
}

export function parseIsoWeek(isoWeekStr: string): Date | null {
    const match = isoWeekStr.match(/^(\d{4})-W(\d{1,2})$/);
    if (!match) return null;
    const year = parseInt(match[1]);
    const week = parseInt(match[2]);
    return getDateOfISOWeek(week, year);
}

export function isPastDeadline(weekStart: Date, deadlineDay: number, deadlineHour: number): boolean {
    const deadlineDate = new Date(weekStart);
    deadlineDate.setDate(deadlineDate.getDate() - (7 - deadlineDay + 1));
    deadlineDate.setHours(deadlineHour, 0, 0, 0);

    const now = new Date();
    return now > deadlineDate;
}

export function isLockedByPolicy(weekStart: Date, lockScheduleDays: number): boolean {
    const lockDate = new Date(weekStart);
    lockDate.setDate(lockDate.getDate() - lockScheduleDays);
    lockDate.setHours(0, 0, 0, 0);

    const now = new Date();
    return now >= lockDate;
}
