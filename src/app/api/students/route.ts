import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import AttendanceLog from '@/models/AttendanceLog';
import cloudinary from '@/lib/cloudinary';

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

            // Calculate unique days the student was present
            const studentUniqueDates = new Set(studentLogs.map((log: any) => new Date(log.timestamp).toDateString()));
            const totalPresent = studentUniqueDates.size;

            // Calculate total unique class days based on logs from this class
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
        const { name, rollNumber, className, faceDescriptor, image } = body;

        let imageUrl = "";
        let imageId = "";

        if (image) {
            try {
                const uploadRes = await cloudinary.uploader.upload(image, {
                    folder: "students",
                });
                imageUrl = uploadRes.secure_url;
                imageId = uploadRes.public_id;
            } catch (err) {
                console.error("Cloudinary upload failed", err);
                // Continue without image or return error? Let's continue but log it.
            }
        }

        if (!name) {
            return NextResponse.json(
                { message: 'Name is required' },
                { status: 400 }
            );
        }

        // Fix for "2nd student" registration: Drop legacy RFID index if it exists
        try {
            await Student.collection.dropIndex('rfid_uid_1');
            console.log("Dropped legacy rfid_uid_1 index");
        } catch (e: any) {
            // Index likely doesn't exist or already dropped, ignore
        }

        const newStudent = await Student.create({
            name,
            rollNumber,
            className,
            faceDescriptor,
            imageUrl,
            imageId
        });

        return NextResponse.json(newStudent, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
