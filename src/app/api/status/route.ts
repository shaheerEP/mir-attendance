import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import AttendanceLog from "@/models/AttendanceLog";
import Student from "@/models/Student";
import Settings from "@/models/Settings";
import { getCurrentActivePeriod, PERIODS } from "@/lib/periods";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
    try {
        await dbConnect();

        const now = new Date();
        const IST_OFFSET = 5.5 * 60 * 60 * 1000;
        const schoolTime = new Date(now.getTime() + IST_OFFSET);

        // 1. Get Settings for Periods
        const settings = await Settings.findOne();
        const periods = settings?.periods || PERIODS;

        // 2. Identify Current Period
        const activePeriod = getCurrentActivePeriod(schoolTime, periods);

        let periodName = "Free";
        let presentCount = 0;
        let totalStudents = 0;

        // 3. Get Total Student Count
        totalStudents = await Student.countDocuments();

        if (activePeriod) {
            periodName = `P${activePeriod.id}`;

            // 4. Calculate Attendance for current period
            // Calculate Start/End in School Time (IST)
            const [h, m] = activePeriod.startTime.split(":").map(Number);
            const periodStartIST = new Date(schoolTime);
            periodStartIST.setHours(h, m, 0, 0);

            const periodEndIST = new Date(periodStartIST.getTime() + activePeriod.durationMinutes * 60000);

            // Convert back to UTC for DB Query
            const queryStart = new Date(periodStartIST.getTime() - IST_OFFSET);
            const queryEnd = new Date(periodEndIST.getTime() - IST_OFFSET);

            // Count unique students marked present in this period
            const presentLogs = await AttendanceLog.distinct('student_id', {
                timestamp: { $gte: queryStart, $lt: queryEnd },
                status: { $ne: 'NONE' } // Count all valid statuses (PRESENT, HALF_PRESENT, LATE)
            });
            presentCount = presentLogs.length;
        }

        return NextResponse.json({
            period: periodName,
            present: presentCount,
            total: totalStudents
        });

    } catch (error: any) {
        console.error("[Status API] Error:", error);
        return NextResponse.json({
            period: "Err",
            present: 0,
            total: 0,
            error: error.message
        }, { status: 500 });
    }
}
