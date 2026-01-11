import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import AttendanceLog from '@/models/AttendanceLog';

export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const className = searchParams.get('className');

        const filter = className ? { className: className } : {};

        // Fetch students and all attendance logs for the class
        const students = await Student.find(filter).sort({ created_at: -1 }).lean();

        // Fetch all attendance logs for these students
        const studentIds = students.map(s => s._id);
        const logs = await AttendanceLog.find({
            student_id: { $in: studentIds },
            status: 'PRESENT'
        }).lean();

        // Calculate stats per student
        const enrichedStudents = students.map((student: any) => {
            const studentLogs = logs.filter((log: any) => log.student_id.toString() === student._id.toString());
            const totalPresent = studentLogs.length;

            // Calculate total unique class days based on logs from this class
            // This is a simplified estimation. For exact rate, we'd need a separate SchoolDays model or similar.
            // Using unique dates from all logs for this class/student group as a proxy for "Total Class Days so far"
            // Using unique dates from all logs for this class/student group as a proxy for "Total Class Days so far"
            const uniqueDates = new Set(logs.map((log: any) => new Date(log.timestamp).toDateString()));
            const totalClassDays = uniqueDates.size || 1; // Avoid division by zero

            const attendanceRate = totalClassDays > 0
                ? Math.round((totalPresent / totalClassDays) * 100)
                : 0;

            return {
                ...student,
                totalPresent,
                attendanceRate,
                // Add created_at if it's missing (though it should be in ...student)
            };
        });

        return NextResponse.json(enrichedStudents);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const { name, rfid_uid, rollNumber, className } = body;

        if (!name || !rfid_uid) {
            return NextResponse.json(
                { message: 'Name and RFID UID are required' },
                { status: 400 }
            );
        }

        const newStudent = await Student.create({
            name,
            rfid_uid,
            rollNumber,
            className
        });

        return NextResponse.json(newStudent, { status: 201 });
    } catch (error: any) {
        if (error.code === 11000) {
            return NextResponse.json(
                { message: 'RFID UID already exists' },
                { status: 409 }
            );
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
