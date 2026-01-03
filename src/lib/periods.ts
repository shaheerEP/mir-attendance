export interface PeriodConfig {
    id: number;
    startTime: string; // "HH:MM" 24h format
    durationMinutes: number;
}

// Manual Configuration of 8 Periods
// You can edit these start times and durations
export const PERIODS: PeriodConfig[] = [
    { id: 1, startTime: "08:00", durationMinutes: 45 },
    { id: 2, startTime: "08:45", durationMinutes: 45 },
    { id: 3, startTime: "09:30", durationMinutes: 45 },
    { id: 4, startTime: "10:15", durationMinutes: 45 },
    // Break? User said "8 periods", assuming continuous or simple Schedule
    { id: 5, startTime: "11:15", durationMinutes: 45 },
    { id: 6, startTime: "12:00", durationMinutes: 45 },
    { id: 7, startTime: "12:45", durationMinutes: 45 },
    { id: 8, startTime: "13:30", durationMinutes: 45 },
];

export type AttendanceStatus = "PRESENT" | "HALF_PRESENT" | "LATE" | "NONE";

export function getAttendanceStatusForPeriod(
    period: PeriodConfig,
    now: Date
): AttendanceStatus {
    const [startHour, startMinute] = period.startTime.split(":").map(Number);

    // Create Date objects for this specific period today
    const periodStart = new Date(now);
    periodStart.setHours(startHour, startMinute, 0, 0);

    const periodEnd = new Date(periodStart.getTime() + period.durationMinutes * 60000);

    // Logic Thresholds
    const fiveMinMark = new Date(periodStart.getTime() + 5 * 60000); // Start + 5m
    const halfMark = new Date(periodStart.getTime() + (period.durationMinutes / 2) * 60000); // Start + D/2

    // 1. Before Start? (Allow 5 min early check-in? strictly "after start" requested? "scan before 5 minutes after start")
    // User said: "if someone scan before 5 minutes after the start time" -> implied "from start to start+5"
    // Assuming if they scan slightly early (e.g. 1 min before) it counts, or strict?
    // Let's allow strict ">= Start" to avoid confusion, or maybe 5 min buffer before?
    // Let's stick to standard strict start for now unless user complains.

    if (now < periodStart) return "NONE"; // Too early (or previous period)

    // 2. Full Period: Start <= T <= Start + 5m
    if (now <= fiveMinMark) {
        return "PRESENT";
    }

    // 3. Half Period: Start + 5m < T <= Start + D/2
    if (now <= halfMark) {
        return "HALF_PRESENT";
    }

    // 4. Late: T > Start + D/2
    // "after that, dont consider the attendance"
    return "NONE"; // Or "LATE" if we wanted to log it but count as 0. User said "dont consider", so maybe just ignore or handle as error.
}

export function getCurrentActivePeriod(now: Date): PeriodConfig | null {
    // Find which period we are technically "inside" or "eligible" for
    // Note: This logic only finds if we are strictly within Start to End.
    // But our "scan window" effectively closes at half-time.
    // So we really only care if we are in the First Half of the period.

    for (const p of PERIODS) {
        const [h, m] = p.startTime.split(":").map(Number);
        const start = new Date(now);
        start.setHours(h, m, 0, 0);

        // Window ends at Full Duration? Or Half?
        // User said "after that [half], dont consider". 
        // But physically the period lasts DurationMinutes.
        const end = new Date(start.getTime() + p.durationMinutes * 60000);

        if (now >= start && now < end) {
            return p;
        }
    }
    return null;
}
