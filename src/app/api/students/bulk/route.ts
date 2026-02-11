import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Student from "@/models/Student";
import AttendanceLog from "@/models/AttendanceLog";

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const { ids } = await req.json();

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "Invalid IDs provided" }, { status: 400 });
        }

        // Delete Students
        const result = await Student.deleteMany({ _id: { $in: ids } });

        // Optional: Delete associated logs? 
        // Usually good practice to keep logs or delete them. Let's delete for clean cleanup.
        await AttendanceLog.deleteMany({ student_id: { $in: ids } });

        return NextResponse.json({
            message: "Students deleted successfully",
            count: result.deletedCount
        });

    } catch (error: any) {
        console.error("Bulk Delete Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
