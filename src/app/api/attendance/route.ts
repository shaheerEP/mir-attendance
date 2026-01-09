import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Student from "@/models/Student";
import AttendanceLog from "@/models/AttendanceLog";
import Settings from "@/models/Settings";
import { getCurrentActivePeriod, getAttendanceStatusForPeriod, PERIODS, DEFAULT_GRACE } from "@/lib/periods";

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const { uid } = body;

        // Fetch Settings
        const settings = await Settings.findOne();
        const periods = settings?.periods || PERIODS;
        const gracePeriod = settings?.gracePeriod || DEFAULT_GRACE;

        // 1. Validate UID
        const student = await Student.findOne({ rfid_uid: uid });
        if (!student) {
            return NextResponse.json(
                { message: "Card not registered", status: "error" },
                { status: 404 }
            );
        }

        const now = new Date();
        const IST_OFFSET = 5.5 * 60 * 60 * 1000;
        const schoolTime = new Date(now.getTime() + IST_OFFSET); // Shift to IST Conceptually

        console.log(`[Attendance] Server Time: ${now.toUTCString()}`);
        console.log(`[Attendance] School Time (IST Adjusted): ${schoolTime.toUTCString()}`);
        console.log(`[Attendance] Processing for UID: ${uid}`);

        // 2. Identify Current Period
        const activePeriod = getCurrentActivePeriod(schoolTime, periods);
        console.log(`[Attendance] Active Period:`, activePeriod);

        if (!activePeriod) {
            console.log(`[Attendance] Error: No active period found.`);
            return NextResponse.json(
                { message: "No active class period", status: "error" },
                { status: 404 }
            );
        }

        // 3. Check Duplicates (MOVED UP)
        // We check if they already have a log for THIS period, regardless of current time status
        const startOfPeriod = new Date(schoolTime);
        const [h, m] = activePeriod.startTime.split(":").map(Number);

        startOfPeriod.setHours(h, m, 0, 0);
        const endOfPeriod = new Date(startOfPeriod.getTime() + activePeriod.durationMinutes * 60000);

        // Convert Query Range back to UTC (Server Time) because logs are saved in UTC
        const queryStart = new Date(startOfPeriod.getTime() - IST_OFFSET);
        const queryEnd = new Date(endOfPeriod.getTime() - IST_OFFSET);

        const existingLog = await AttendanceLog.findOne({
            student_id: student._id,
            timestamp: { $gte: queryStart, $lt: queryEnd }
        });

        if (existingLog) {
            console.log(`[Attendance] Duplicate scan prevented. Already marked as ${existingLog.status}`);
            return NextResponse.json(
                { message: `Already marked (${existingLog.status})`, status: "error" },
                { status: 409 }
            );
        }

        // 4. Check Rules (Grace Period / Half / Late)
        const status = getAttendanceStatusForPeriod(activePeriod, schoolTime, gracePeriod);
        console.log(`[Attendance] Status calculated: ${status}`);

        if (status === "NONE" || status === "LATE") {
            console.log(`[Attendance] Error: Status is ${status} (Late/Closed)`);
            return NextResponse.json(
                { message: "Late: Attendance closed", status: "error" },
                { status: 403 }
            );
        }

        // 5. Save Valid Attendance
        await AttendanceLog.create({
            student_id: student._id,
            timestamp: now,
            status: status,
            periodId: activePeriod.id
        });

        const displayMsg = status === "HALF_PRESENT" ? `Welcome (Half Day)` : `Welcome ${student.name}`;

        // Return 206 for Half Day (Partial Content) to trigger Yellow LED
        const successCode = status === "HALF_PRESENT" ? 206 : 200;

        return NextResponse.json(
            { message: displayMsg, status: "success" },
            { status: successCode }
        );
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
