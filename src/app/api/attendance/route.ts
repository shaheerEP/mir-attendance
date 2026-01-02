import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import AttendanceLog from '@/models/AttendanceLog';

export async function POST(req: NextRequest) {
    try {
        await dbConnect();

        // Parse JSON body
        // Expecting { "uid": "..." }
        const body = await req.json();
        const { uid } = body;

        if (!uid) {
            return NextResponse.json(
                { message: 'Invalid payload: uid required', status: 'error' },
                { status: 400 }
            );
        }

        // Find student
        const student = await Student.findOne({ rfid_uid: uid });

        if (!student) {
            return NextResponse.json(
                { message: 'Card not registered', status: 'error' },
                { status: 404 }
            );
        }

        // Log attendance
        // Check if already logged inside a short window? 
        // For now, just log every time.
        const log = await AttendanceLog.create({
            student_id: student._id,
            timestamp: new Date(),
            status: 'PRESENT',
        });

        return NextResponse.json(
            {
                message: `Welcome ${student.name}`,
                status: 'success',
                student_name: student.name
            },
            { status: 200 }
        );

    } catch (error: any) {
        console.error('Attendance API Error:', error);
        return NextResponse.json(
            { message: 'Internal Server Error', status: 'error', error: error.message },
            { status: 500 }
        );
    }
}
