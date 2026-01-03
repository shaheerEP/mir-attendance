export interface PeriodConfig {
    id: number;
    startTime: string; // "HH:MM" 24h format
    durationMinutes: number;
}

// Manual Configuration of 8 Periods
// You can edit these start times and durations
// Keep constants as fallback
export const PERIODS: PeriodConfig[] = [
    { id: 1, startTime: "08:00", durationMinutes: 45 },
    { id: 2, startTime: "08:45", durationMinutes: 45 },
    { id: 3, startTime: "09:30", durationMinutes: 45 },
    { id: 4, startTime: "10:15", durationMinutes: 45 },
    { id: 5, startTime: "11:15", durationMinutes: 45 },
    { id: 6, startTime: "12:00", durationMinutes: 45 },
    { id: 7, startTime: "12:45", durationMinutes: 45 },
    { id: 8, startTime: "13:30", durationMinutes: 45 },
];

export const DEFAULT_GRACE = {
    fullPresentMins: 5,
    halfPresentMins: 20
};

export type AttendanceStatus = "PRESENT" | "HALF_PRESENT" | "LATE" | "NONE";

export function getAttendanceStatusForPeriod(
    period: PeriodConfig,
    now: Date,
    graceConfig = DEFAULT_GRACE
): AttendanceStatus {
    const [startHour, startMinute] = period.startTime.split(":").map(Number);

    const periodStart = new Date(now);
    periodStart.setHours(startHour, startMinute, 0, 0);

    const fiveMinMark = new Date(periodStart.getTime() + graceConfig.fullPresentMins * 60000);
    const halfMark = new Date(periodStart.getTime() + graceConfig.halfPresentMins * 60000);

    if (now < periodStart) return "NONE";

    if (now <= fiveMinMark) {
        return "PRESENT";
    }

    if (now <= halfMark) {
        return "HALF_PRESENT";
    }

    return "LATE";
}

export function getCurrentActivePeriod(
    now: Date,
    periods = PERIODS
): PeriodConfig | null {
    for (const p of periods) {
        const [h, m] = p.startTime.split(":").map(Number);
        const start = new Date(now);
        start.setHours(h, m, 0, 0);

        const end = new Date(start.getTime() + p.durationMinutes * 60000);

        // Strict window: Start <= Now < End
        if (now >= start && now < end) {
            return p;
        }
    }
    return null;
}
