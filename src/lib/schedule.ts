import { format } from "date-fns";

export type PeriodStatus = {
    isHoliday: boolean;
    periodName: string;
    periodNumber: number;
    timeRange: string;
};

// 8 Periods starting from 8:00 AM
// Example: 8:00-8:45, 8:45-9:30, etc.
const PERIOD_DURATION_MINS = 45;
const START_HOUR = 8;
const START_MINUTE = 0;

export function getCurrentPeriod(): PeriodStatus {
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 5=Fri, 6=Sat

    // Friday is Holiday (5)
    // Determine if it's Friday. Adjust logic if week starts differently or specific calendar needed.
    // Assumes standard JS getDay(): 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat.
    // User said "Friday is holiday".
    if (day === 5) {
        return {
            isHoliday: true,
            periodName: "Holiday (Friday)",
            periodNumber: 0,
            timeRange: "All Day",
        };
    }

    // Calculate Period
    // Minutes since start of day 00:00
    const currentTotalMins = now.getHours() * 60 + now.getMinutes();
    const schoolStartMins = START_HOUR * 60 + START_MINUTE;

    // If before school
    if (currentTotalMins < schoolStartMins) {
        return {
            isHoliday: false,
            periodName: "Before School",
            periodNumber: 0,
            timeRange: `Starts at ${START_HOUR}:00`,
        };
    }

    // Calculate elapsed school time
    const elapsedMins = currentTotalMins - schoolStartMins;
    const currentPeriodIndex = Math.floor(elapsedMins / PERIOD_DURATION_MINS) + 1;

    if (currentPeriodIndex > 8) {
        return {
            isHoliday: false,
            periodName: "After School",
            periodNumber: 9,
            timeRange: "Classes Over",
        };
    }

    // Calculate current period range strings
    const pStartMins = schoolStartMins + (currentPeriodIndex - 1) * PERIOD_DURATION_MINS;
    const pEndMins = pStartMins + PERIOD_DURATION_MINS;

    const formatTime = (totalMins: number) => {
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
    };

    return {
        isHoliday: false,
        periodName: `Period ${currentPeriodIndex}`,
        periodNumber: currentPeriodIndex,
        timeRange: `${formatTime(pStartMins)} - ${formatTime(pEndMins)}`,
    };
}
