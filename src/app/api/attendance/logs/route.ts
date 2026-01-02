import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AttendanceLog from '@/models/AttendanceLog';
import Student from '@/models/Student'; // Ensure Student model is registered

export async function GET(req: NextRequest) {
    await dbConnect();

    try {
        // Get logs for today (00:00 to 23:59)
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const logs = await AttendanceLog.find({
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        })
            .populate('student_id', 'name rfid_uid')
            .sort({ timestamp: -1 })
            .lean();

        return NextResponse.json(logs, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
