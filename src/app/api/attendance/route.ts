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
        console.log(`[Attendance] Scanning at ${now.toLocaleString()}, UID: ${uid}`);

        // 2. Identify Current Period
        const activePeriod = getCurrentActivePeriod(now, periods);
        console.log(`[Attendance] Active Period:`, activePeriod);

        if (!activePeriod) {
            console.log(`[Attendance] Error: No active period found.`);
            return NextResponse.json(
                { message: "No active class period", status: "error" },
                { status: 404 } // Changed from 400 to 404 (Not Found)
            );
        }

        // 3. Check Rules (Grace Period / Half / Late)
        const status = getAttendanceStatusForPeriod(activePeriod, now, gracePeriod);
        console.log(`[Attendance] Status calculated: ${status}`);

        if (status === "NONE" || status === "LATE") {
            console.log(`[Attendance] Error: Status is ${status} (Late/Closed)`);
            return NextResponse.json(
                { message: "Late: Attendance closed", status: "error" },
                { status: 403 } // Changed from 400 to 403 (Forbidden)
            );
        }

        // 4. Check Duplicates
        const startOfPeriod = new Date(now);
        const [h, m] = activePeriod.startTime.split(":").map(Number);
        startOfPeriod.setHours(h, m, 0, 0);
        const endOfPeriod = new Date(startOfPeriod.getTime() + activePeriod.durationMinutes * 60000);

        const existingLog = await AttendanceLog.findOne({
            student_id: student._id,
            timestamp: { $gte: startOfPeriod, $lt: endOfPeriod }
        });

        if (existingLog) {
            return NextResponse.json(
                { message: `Already marked (${existingLog.status})`, status: "success" },
                { status: 200 }
            );
        }

        // 5. Save Valid Attendance
        await AttendanceLog.create({
            student_id: student._id,
            timestamp: now,
            status: status,
        });

        const displayMsg = status === "HALF_PRESENT" ? `Welcome (Half Day)` : `Welcome ${student.name}`;

        return NextResponse.json(
            { message: displayMsg, status: "success" },
            { status: 200 }
        );
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
