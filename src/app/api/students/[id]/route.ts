import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Student from "@/models/Student";

export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await dbConnect();
        const body = await req.json();
        const { name, rfid_uid } = body;

        const updatedStudent = await Student.findByIdAndUpdate(
            params.id,
            { name, rfid_uid },
            { new: true }
        );

        if (!updatedStudent) {
            return NextResponse.json(
                { message: "Student not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(updatedStudent, { status: 200 });
    } catch (error: any) {
        if (error.code === 11000) {
            return NextResponse.json(
                { message: "RFID UID already exists" },
                { status: 409 }
            );
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await dbConnect();
        const deletedStudent = await Student.findByIdAndDelete(params.id);

        if (!deletedStudent) {
            return NextResponse.json(
                { message: "Student not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ message: "Student deleted" }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
