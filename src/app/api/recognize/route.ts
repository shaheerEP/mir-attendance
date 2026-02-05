import { NextRequest, NextResponse } from "next/server";
import { recognizeFace } from "@/lib/face-recognition";
import dbConnect from "@/lib/db";
import AttendanceLog from "@/models/AttendanceLog";
import Settings from "@/models/Settings";
import { getCurrentActivePeriod, getAttendanceStatusForPeriod, PERIODS, DEFAULT_GRACE } from "@/lib/periods";

// Prevent Next.js from caching this route behavior excessively
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        console.log("[Recognize] Request Received");

        const formData = await req.formData();
        const file = formData.get("image") as File;

        if (!file) {
            return NextResponse.json({ message: "No image uploaded", status: "error" }, { status: 400 });
        }

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log(`[Recognize] Processing Image size: ${buffer.length} bytes`);

        // Perform Recognition
        const result = await recognizeFace(buffer);

        if (!result) {
            console.log("[Recognize] Face mismatched or not found.");
            return NextResponse.json({ message: "Not Recognized", status: "error" }, { status: 401 });
        }

        console.log(`[Recognize] Match Found: ${result.name} (${result.studentId}) Distance: ${result.distance}`);

        // ---------------------------------------------------------
        // Attendance Marking Logic (Duplicated for Independence)
        // ---------------------------------------------------------

        await dbConnect();

        // Fetch Settings
        const settings = await Settings.findOne();
        const periods = settings?.periods || PERIODS;
        const gracePeriod = settings?.gracePeriod || DEFAULT_GRACE;

        const now = new Date();
        const IST_OFFSET = 5.5 * 60 * 60 * 1000;
        const schoolTime = new Date(now.getTime() + IST_OFFSET);

        // Identify Current Period
        const activePeriod = getCurrentActivePeriod(schoolTime, periods);

        if (!activePeriod) {
            return NextResponse.json(
                { message: `Hi ${result.name}\nNo Class Now`, status: "error" }, // Short msg for OLED
                { status: 423 }
            );
        }

        // Check for Duplicates for this period
        const startOfPeriod = new Date(schoolTime);
        const [h, m] = activePeriod.startTime.split(":").map(Number);
        startOfPeriod.setHours(h, m, 0, 0);
        const endOfPeriod = new Date(startOfPeriod.getTime() + activePeriod.durationMinutes * 60000);

        const queryStart = new Date(startOfPeriod.getTime() - IST_OFFSET);
        const queryEnd = new Date(endOfPeriod.getTime() - IST_OFFSET);

        const existingLog = await AttendanceLog.findOne({
            student_id: result.studentId,
            timestamp: { $gte: queryStart, $lt: queryEnd }
        });

        if (existingLog) {
            return NextResponse.json(
                { message: `Already Marked\n${existingLog.status}`, status: "error" },
                { status: 409 }
            );
        }

        // Calculate Status
        const status = getAttendanceStatusForPeriod(activePeriod, schoolTime, gracePeriod);

        if (status === "NONE" || status === "LATE") {
            return NextResponse.json(
                { message: "Late!\nClass Closed", status: "error" },
                { status: 403 }
            );
        }

        // Save
        await AttendanceLog.create({
            student_id: result.studentId,
            timestamp: now,
            status: status,
            periodId: activePeriod.id,
            deviceId: "ESP32_Headless"
        });

        const displayMsg = status === "HALF_PRESENT" ? "Half Day" : "Present";

        return NextResponse.json({
            message: `Welcome\n${result.name.split(' ')[0]}`, // Short name for OLED
            status: "success",
            details: displayMsg
        }, { status: 200 });

    } catch (error: any) {
        console.error("[Recognize] Error:", error);
        return NextResponse.json({ message: "Server Error", status: "error", error: error.message }, { status: 500 });
    }
}
