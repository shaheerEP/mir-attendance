import { NextRequest, NextResponse } from "next/server";
import { recognizeFace } from "@/lib/face-recognition";
import dbConnect from "@/lib/db";
import AttendanceLog from "@/models/AttendanceLog";
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

        // Staff Settings
        const staffTimeStr = settings?.staffAttendanceTime || "09:00";
        const staffDuration = settings?.staffAttendanceDuration || 60;

        const now = new Date();
        const IST_OFFSET = 5.5 * 60 * 60 * 1000;
        const schoolTime = new Date(now.getTime() + IST_OFFSET);

        // Identify Current Period (Same for all students)
        const activePeriod = getCurrentActivePeriod(schoolTime, periods);

        // Calculate common constraints for Students
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

        // Calculate constraints for Staff
        // Allow check-in from [StaffTime] to [StaffTime + Duration]
        const [sh, sm] = staffTimeStr.split(":").map(Number);
        const staffStartTime = new Date(schoolTime);
        staffStartTime.setHours(sh, sm, 0, 0);
        const staffEndTime = new Date(staffStartTime.getTime() + staffDuration * 60000);

        const staffQueryStart = new Date(staffStartTime.getTime() - IST_OFFSET);
        const staffQueryEnd = new Date(staffEndTime.getTime() - IST_OFFSET);

        let presentCount = 0;
        let names: string[] = [];

        let unknownCount = 0;

        for (const result of results) {
            console.log(`Processing: ${result.name || 'Unknown'} [Type: ${result.type}]`);

            if (result.type === 'unknown') {
                unknownCount++;
                continue;
            }

            // Handle STAFF
            if (result.type === 'staff') {
                const staffAttendanceLog = (await import("@/models/StaffAttendanceLog")).default;

                // Check if already marked today
                const startOfDay = new Date(schoolTime);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(schoolTime);
                endOfDay.setHours(23, 59, 59, 999);

                const existingLog = await staffAttendanceLog.findOne({
                    staff_id: result.staffId,
                    timestamp: { $gte: new Date(startOfDay.getTime() - IST_OFFSET), $lt: new Date(endOfDay.getTime() - IST_OFFSET) }
                });

                if (existingLog) {
                    console.log(`- Staff Already marked: ${existingLog.status}`);
                    names.push(result.name.split(' ')[0]);
                    presentCount++;
                    continue;
                }

                // Check Time Constraint
                // If now < staffStartTime -> Too Early? Or allow? Assuming allow if it's same day?
                // If now > staffEndTime -> Late?
                let status = "PRESENT";
                if (schoolTime > staffEndTime) {
                    status = "LATE";
                }

                await staffAttendanceLog.create({
                    staff_id: result.staffId,
                    timestamp: now,
                    status: status,
                    deviceId: "ESP32_Headless"
                });

                console.log(`- Staff Marked ${status}`);
                names.push(result.name.split(' ')[0]);
                presentCount++;
                continue;
            }

            // Handle STUDENT (Default fallback if type missing for backward compat)
            if (!activePeriod) {
                // No Class, just list name? Or skip?
                // For now, let's just list them but not mark attendance
                names.push(result.name.split(' ')[0]);
                presentCount++; // Count them as seen
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
                // names.push(result.name.split(' ')[0] + " (Late)");
                // presentCount++;
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

        // If there were any matches (Staff or Student), return success
        if (presentCount > 0) {
            let nameList = names.join(', ').substring(0, 50); // Truncate for OLED
            let msg = `${presentCount} Present\n${nameList}`;

            if (unknownCount > 0) {
                msg += ` +${unknownCount}?`;
            }

            return NextResponse.json({
                message: msg,
                status: "success",
                details: {
                    recognized: presentCount,
                    unknown: unknownCount,
                    names: names
                }
            }, { status: 200 });
        }

        // If only unknowns found
        if (unknownCount > 0) {
            return NextResponse.json({
                message: `${unknownCount} Unknown\nFace Detected`,
                status: "success", // Return success so OLED shows message instead of error
                details: {
                    recognized: 0,
                    unknown: unknownCount
                }
            }, { status: 200 });
        }

        // Fallback for no attendance marked but nothing detected (should shouldn't happen due to check at top)
        if (!activePeriod && results.every((r: any) => r.type !== 'staff')) {
            return NextResponse.json(
                { message: `Hi! No Class\n${names.join(', ')}`, status: "error" },
                { status: 423 }
            );
        }

        return NextResponse.json(
            { message: "Late / None", status: "error" },
            { status: 403 }
        );

    } catch (error: any) {
        console.error("[Recognize] Error:", error);
        return NextResponse.json({ message: "Server Error", status: "error", error: error.message }, { status: 500 });
    }
}
