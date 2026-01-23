import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Student from "@/models/Student";
import cloudinary from "@/lib/cloudinary";

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        await dbConnect();
        const student = await Student.findById(params.id);

        if (!student) {
            return NextResponse.json(
                { message: "Student not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(student, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        await dbConnect();
        const body = await req.json();
        const { name, rollNumber, className, image } = body;

        let updateData: any = { name, rollNumber, className };

        if (image) {
            // Find existing student to get old image ID
            const existingStudent = await Student.findById(params.id);
            if (existingStudent && existingStudent.imageId) {
                await cloudinary.uploader.destroy(existingStudent.imageId);
            }

            // Upload new image
            const uploadRes = await cloudinary.uploader.upload(image, {
                folder: "students",
            });
            updateData.imageUrl = uploadRes.secure_url;
            updateData.imageId = uploadRes.public_id;
        }

        const updatedStudent = await Student.findByIdAndUpdate(
            params.id,
            updateData,
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
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}


export async function DELETE(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        await dbConnect();
        const student = await Student.findById(params.id);
        if (student && student.imageId) {
            await cloudinary.uploader.destroy(student.imageId);
        }
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
