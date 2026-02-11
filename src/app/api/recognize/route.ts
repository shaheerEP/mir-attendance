import { NextRequest, NextResponse } from "next/server";
import { recognizeFace } from "@/lib/face-recognition";
import dbConnect from "@/lib/db";
import AttendanceLog from "@/models/AttendanceLog";
import Student from "@/models/Student";
import Settings from "@/models/Settings";
import { getCurrentActivePeriod, getAttendanceStatusForPeriod, PERIODS, DEFAULT_GRACE } from "@/lib/periods";

// Prevent Next.js from caching this route behavior excessively
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // Allow 60 seconds for processing

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

        // Perform Recognition - Returns Array
        const results = await recognizeFace(buffer);

        if (!results || results.length === 0) {
            console.log("[Recognize] No faces found or matched.");

            // DEBUG: Save failed image
            const fs = require('fs');
            const path = require('path');
            const debugPath = path.join(process.cwd(), 'failed_capture.jpg');
            fs.writeFileSync(debugPath, buffer);
            console.log(`[Recognize] Saved failed capture to: ${debugPath}`);

            return NextResponse.json({ message: "Not Recognized", status: "error" }, { status: 401 });
        }

        console.log(`[Recognize] Matches Found: ${results.length}`);

        // ---------------------------------------------------------
        // Attendance Marking Logic
        // ---------------------------------------------------------

        await dbConnect();

        // Fetch Settings
        const settings = await Settings.findOne();
        const periods = settings?.periods || PERIODS;
        const gracePeriod = settings?.gracePeriod || DEFAULT_GRACE;

        const now = new Date();
        const IST_OFFSET = 5.5 * 60 * 60 * 1000;
        const schoolTime = new Date(now.getTime() + IST_OFFSET);

        // Identify Current Period (Same for all students)
        const activePeriod = getCurrentActivePeriod(schoolTime, periods);

        // Calculate common constraints
        let startOfPeriod: Date = new Date();
        let endOfPeriod: Date = new Date();
        let queryStart: Date = new Date();
        let queryEnd: Date = new Date();

        if (activePeriod) {
            startOfPeriod = new Date(schoolTime);
            const [h, m] = activePeriod.startTime.split(":").map(Number);
            startOfPeriod.setHours(h, m, 0, 0);
            endOfPeriod = new Date(startOfPeriod.getTime() + activePeriod.durationMinutes * 60000);
            queryStart = new Date(startOfPeriod.getTime() - IST_OFFSET);
            queryEnd = new Date(endOfPeriod.getTime() - IST_OFFSET);
        }

        let presentCount = 0;
        let names = [];

        for (const result of results) {
            console.log(`Processing: ${result.name} (${result.studentId})`);

            if (!activePeriod) {
                // No Class, just list name? Or skip?
                // For now, let's just list them but not mark attendance
                names.push(result.name.split(' ')[0]);
                continue;
            }

            // Check for Duplicates
            const existingLog = await AttendanceLog.findOne({
                student_id: result.studentId,
                timestamp: { $gte: queryStart, $lt: queryEnd }
            });

            if (existingLog) {
                console.log(`- Already marked: ${existingLog.status}`);
                names.push(result.name.split(' ')[0]); // Still list them
                presentCount++;
                continue;
            }

            // Status
            const status = getAttendanceStatusForPeriod(activePeriod, schoolTime, gracePeriod);

            if (status === "NONE" || status === "LATE") {
                console.log(`- Late/Closed`);
                // Optionally list them as Late?
                continue;
            }

            // Save
            await AttendanceLog.create({
                student_id: result.studentId,
                timestamp: now,
                status: status,
                periodId: activePeriod.id,
                deviceId: "ESP32_Headless"
            });

            console.log(`- Marked ${status}`);
            names.push(result.name.split(' ')[0]);
            presentCount++;
        }

        // Construct OLED Message
        // Format: "3 Present\nAli, Bob, Cat"

        if (!activePeriod) {
            return NextResponse.json(
                { message: `Hi! No Class\n${names.join(', ')}`, status: "error" },
                { status: 423 }
            );
        }

        if (presentCount === 0) {
            return NextResponse.json(
                { message: "Late / None", status: "error" },
                { status: 403 }
            );
        }

        const nameList = names.join(', ').substring(0, 50); // Truncate for OLED
        const msg = `${presentCount} Present\n${nameList}`;
        const totalStudents = await Student.countDocuments();
        const periodNameRaw = activePeriod ? `P${activePeriod.id}` : "Free";

        let totalPresent = presentCount; // Just for this call if not tracking total yet?
        // Actually, we should fetch the total unique count for the period to be accurate
        if (activePeriod) {
            const presentLogs = await AttendanceLog.distinct('student_id', {
                timestamp: { $gte: queryStart, $lt: queryEnd },
                status: { $ne: 'NONE' }
            });
            totalPresent = presentLogs.length;
        }

        return NextResponse.json({
            message: msg,
            status: "success",
            period: periodNameRaw,
            present: totalPresent,
            total: totalStudents,
            details: "Multi-Attendance Marked"
        }, { status: 200 });

    } catch (error: any) {
        console.error("[Recognize] Error:", error);
        return NextResponse.json({ message: "Server Error", status: "error", error: error.message }, { status: 500 });
    }
}
