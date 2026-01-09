import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';

export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const className = searchParams.get('className');

        const filter = className ? { className: className } : {};
        const students = await Student.find(filter).sort({ created_at: -1 });

        return NextResponse.json(students);
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
