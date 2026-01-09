import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import AttendanceLog from "@/models/AttendanceLog";
import Student from "@/models/Student";
import Settings from "@/models/Settings";
import { PERIODS } from "@/lib/periods";

export const dynamic = 'force-dynamic'; // Ensure it's not cached

export async function GET(req: NextRequest) {
    try {
        await dbConnect();

        // 1. Get Settings & Time
        const settings = await Settings.findOne();
        const periodsConfig = settings?.periods || PERIODS;
        const holidays = settings?.weeklyHolidays || [5]; // Friday default

        const now = new Date();
        const IST_OFFSET = 5.5 * 60 * 60 * 1000;
        const nowIST = new Date(now.getTime() + IST_OFFSET);

        // 2. Check Holiday
        const todayDay = nowIST.getUTCDay(); // 0=Sun, 1=Mon...
        if (holidays.includes(todayDay)) {
            return NextResponse.json({ message: "Today is a holiday", processed: 0 });
        }

        // 3. Define Today's Range (IST)
        const startOfDayIST = new Date(nowIST);
        startOfDayIST.setUTCHours(0, 0, 0, 0);

        const endOfDayIST = new Date(nowIST);
        endOfDayIST.setUTCHours(23, 59, 59, 999);

        // Convert Query Range back to UTC for DB Query
        // (Since we stored logs in UTC, but calculated them based on IST logic? 
        //  Wait, earlier we realized logs are stored as `now` (UTC). 
        //  But the `periodId` field is reliable now because we cleared logs.)
        //  Let's rely on `periodId` + `timestamp` range.

        const startOfDayUTC = new Date(startOfDayIST.getTime() - IST_OFFSET);
        const endOfDayUTC = new Date(endOfDayIST.getTime() - IST_OFFSET);

        let totalMarkedAbsent = 0;

        // 4. Iterate Periods
        for (const period of periodsConfig) {
            const [h, m] = period.startTime.split(":").map(Number);

            // Construct Period End Time (in IST context)
            const periodStartIST = new Date(startOfDayIST);
            periodStartIST.setUTCHours(h, m, 0, 0);

            const periodEndIST = new Date(periodStartIST.getTime() + period.durationMinutes * 60000);

            // Check if period is COMPLETELY finished
            // Buffer: wait 1 min after end to be safe
            if (nowIST > new Date(periodEndIST.getTime() + 60000)) {

                // 5. Find Missing Logs
                // Get all logs for this specific period ID today
                const existingLogs = await AttendanceLog.find({
                    periodId: period.id,
                    timestamp: { $gte: startOfDayUTC, $lte: endOfDayUTC } // Ensure it's today's log
                }).select('student_id');

                const presentStudentIds = new Set(existingLogs.map(l => l.student_id.toString()));

                // Get All Students
                const allStudents = await Student.find({}, '_id');

                // Filter Absent
                const absentStudents = allStudents.filter(s => !presentStudentIds.has(s._id.toString()));

                if (absentStudents.length > 0) {
                    const absenteeLogs = absentStudents.map(s => ({
                        student_id: s._id,
                        timestamp: new Date(periodEndIST.getTime() - IST_OFFSET), // Store end-of-period UTC time
                        status: "ABSENT",
                        periodId: period.id
                    }));

                    await AttendanceLog.insertMany(absenteeLogs);
                    totalMarkedAbsent += absenteeLogs.length;
                    console.log(`[AbsenteeWorker] Marked ${absenteeLogs.length} students absent for Period ${period.id}`);
                }
            }
        }

        return NextResponse.json({
            message: "Processed absentees",
            marked: totalMarkedAbsent,
            serverTime: now.toISOString(),
            istTime: nowIST.toISOString()
        });

    } catch (error: any) {
        console.error("Absentee Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
