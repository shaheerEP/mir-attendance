import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import AttendanceLog from "@/models/AttendanceLog";

// UPDATE (PATCH) Log Status
export async function PATCH(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        await dbConnect();
        const { status } = await req.json();

        if (!status) {
            return NextResponse.json({ message: "Status is required" }, { status: 400 });
        }

        const log = await AttendanceLog.findByIdAndUpdate(
            params.id,
            { status },
            { new: true }
        );

        if (!log) {
            return NextResponse.json({ message: "Log not found" }, { status: 404 });
        }

        return NextResponse.json(log);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE Log
export async function DELETE(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        await dbConnect();
        const deletedLog = await AttendanceLog.findByIdAndDelete(params.id);

        if (!deletedLog) {
            return NextResponse.json({ message: "Log not found" }, { status: 404 });
        }

        return NextResponse.json({ message: "Log deleted" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
