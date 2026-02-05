import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import AttendanceLog from '@/models/AttendanceLog';
import Class from '@/models/Class';

// Use English/US locale for consistent day matching
const getDayName = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'long' });

export async function POST(req: NextRequest) {
    try {
        await dbConnect();

        // 1. Parse Request
        // Expecting { studentId: "..." }
        const body = await req.json();
        const { studentId, uid } = body; // Support both just in case

        const idToSearch = studentId || uid;

        if (!idToSearch) {
            return NextResponse.json({ message: "Missing Student ID" }, { status: 400 });
        }

        // 2. Find Student
        // First try by Mongo ID
        let student = null;
        if (idToSearch.match(/^[0-9a-fA-F]{24}$/)) {
            student = await Student.findById(idToSearch);
        }

        // If not found, try by internal ID or Roll Number if you use that
        if (!student) {
            student = await Student.findOne({ rollNumber: idToSearch });
        }

        if (!student) {
            return NextResponse.json({ message: "Student Not Found" }, { status: 404 });
        }

        // 3. Check Schedule (Time & Day)
        const now = new Date();
        const currentDay = getDayName(now);
        const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

        // Find Class Schedule
        // Assuming student.className exists e.g., "10A"
        let currentSubject = "Free Period";
        let status = "Present";

        if (student.className) {
            const classDoc = await Class.findOne({ name: student.className });
            if (classDoc) {
                // Find period match
                const todaySchedule = classDoc.schedule.find((s: any) => s.day === currentDay);
                if (todaySchedule) {
                    const period = todaySchedule.periods.find((p: any) =>
                        currentTime >= p.startTime && currentTime <= p.endTime
                    );
                    if (period) {
                        currentSubject = period.subject;
                    }
                }
            }
        }

        // 4. Log Attendance (Prevent Duplicates for this period?)
        // For simple logic: Just log "Present" for today if not already
        const todayStr = now.toISOString().split('T')[0];

        const existingLog = await AttendanceLog.findOne({
            student_id: student._id,
            date: { $gte: new Date(todayStr) } // Simple implementation: 1 log per day? Or per period?
            // If per period, we need to check period match. Let's stick to simple "Present" for now.
        });

        if (!existingLog) {
            await AttendanceLog.create({
                student_id: student._id,
                status: 'PRESENT',
                timestamp: now,
                remarks: ` via ESP32 (${currentSubject})`
            });
        }

        // 5. Response
        return NextResponse.json({
            message: `Hello ${student.name.split(' ')[0]}`, // Short name for OLED
            subtext: currentSubject,
            status: "ok"
        });

    } catch (error: any) {
        console.error("Attendance Error:", error);
        return NextResponse.json({ message: "Server Error" }, { status: 500 });
    }
}
