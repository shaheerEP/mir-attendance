import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import AttendanceLog from "@/models/AttendanceLog";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        await dbConnect();
        const studentId = params.id;

        // Fetch logs for this student
        const logs = await AttendanceLog.find({ student_id: studentId })
            .sort({ timestamp: -1 })
            .lean();

        // Calculate basic stats
        const totalPresent = logs.filter(l => l.status === "PRESENT").length;
        const totalHalf = logs.filter(l => l.status === "HALF_PRESENT").length;
        const totalLate = logs.filter(l => l.status === "LATE").length;
        // Note: status 'LATE' might not be saved depending on logic, but IF we change that later.
        // Currently logic returns error for Late, so effectively not saved.

        return NextResponse.json({
            logs,
            stats: {
                totalPresent,
                totalHalf,
                totalLate,
                total: logs.length
            }
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
