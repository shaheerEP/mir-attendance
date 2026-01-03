import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Student from "@/models/Student";
import AttendanceLog from "@/models/AttendanceLog";
import { getCurrentActivePeriod, getAttendanceStatusForPeriod } from "@/lib/periods";

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const { uid } = body;

        // 1. Validate UID
        const student = await Student.findOne({ rfid_uid: uid });
        if (!student) {
            return NextResponse.json(
                { message: "Card not registered", status: "error" },
                { status: 404 }
            );
        }

        const now = new Date();
        // 2. Identify Current Period
        const activePeriod = getCurrentActivePeriod(now);

        if (!activePeriod) {
            // Outside of any active period (e.g. break or after school)
            return NextResponse.json(
                { message: "No active class period", status: "error" },
                { status: 400 }
            );
        }

        // 3. Check Rules (Grace Period / Half / Late)
        const status = getAttendanceStatusForPeriod(activePeriod, now);

        if (status === "NONE" || status === "LATE") {
            // "After that... dont consider the attendance"
            return NextResponse.json(
                { message: "Late: Attendance closed", status: "error" },
                { status: 400 }
            );
        }

        // 4. Check Duplicates (Multiple scans in SAME period)
        const startOfPeriod = new Date(now);
        const [h, m] = activePeriod.startTime.split(":").map(Number);
        startOfPeriod.setHours(h, m, 0, 0);
        const endOfPeriod = new Date(startOfPeriod.getTime() + activePeriod.durationMinutes * 60000);

        const existingLog = await AttendanceLog.findOne({
            student_id: student._id,
            timestamp: { $gte: startOfPeriod, $lt: endOfPeriod }
        });

        if (existingLog) {
            // User said "save only the first time"
            return NextResponse.json(
                { message: `Already marked (${existingLog.status})`, status: "success" },
                { status: 200 }
            );
        }

        // 5. Save Valid Attendance
        await AttendanceLog.create({
            student_id: student._id,
            timestamp: now,
            status: status, // "PRESENT" or "HALF_PRESENT"
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
