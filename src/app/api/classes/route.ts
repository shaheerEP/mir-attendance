import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Student from "@/models/Student";
import Class from "@/models/Class";

export async function GET(req: NextRequest) {
    try {
        await dbConnect();

        // 1. Get classes from Students (existing behavior)
        const studentClasses = await Student.distinct("className", {
            className: { $nin: [null, ""] }
        });

        // 2. Get classes from Class model (new behavior)
        const definedClasses = await Class.find({}, "name");
        const classNames = definedClasses.map(c => c.name);

        // 3. Merge and deduplicate
        const allClasses = Array.from(new Set([...studentClasses, ...classNames]));

        // 4. Sort
        const uniqueClasses = allClasses.sort();

        return NextResponse.json(uniqueClasses);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const { name } = body;

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return NextResponse.json({ error: "Class name is required" }, { status: 400 });
        }

        const trimmedName = name.trim();

        // Check if exists
        const existingClass = await Class.findOne({ name: trimmedName });
        if (existingClass) {
            return NextResponse.json({ error: "Class already exists" }, { status: 409 });
        }

        const newClass = await Class.create({ name: trimmedName });

        return NextResponse.json(newClass, { status: 201 });
    } catch (error: any) {
        // Handle duplicate key error if race condition occurs
        if (error.code === 11000) {
            return NextResponse.json({ error: "Class already exists" }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
