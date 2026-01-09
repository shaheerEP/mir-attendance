import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import AttendanceLog from "@/models/AttendanceLog";
import Student from "@/models/Student";
import { PERIODS, getCurrentActivePeriod } from "@/lib/periods";

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const { studentId, date, time, status, periodId } = body;

        if (!studentId || !date || !status) {
            return NextResponse.json(
                { message: "Student ID, Date, and Status are required" },
                { status: 400 }
            );
        }

        // Construct Timestamp
        // Combine Date (YYYY-MM-DD) and Time (HH:MM)
        const timestampStr = time ? `${date}T${time}:00` : `${date}T00:00:00`;
        const timestamp = new Date(timestampStr);

        // Calculate Period ID if not provided (optional auto-detect)
        // For manual entry, we often want to force a period or just record it.
        // If periodId is provided manually, use it.
        // Otherwise, try to guess or leave undefined?
        // Let's assume frontend sends periodId if relevant.

        await AttendanceLog.create({
            student_id: studentId,
            timestamp: timestamp,
            status: status,
            periodId: periodId ? parseInt(periodId) : undefined,
            deviceId: "MANUAL_ENTRY"
        });

        return NextResponse.json({ message: "Entry created" }, { status: 201 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
