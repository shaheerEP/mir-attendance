import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Student from "@/models/Student";

export async function GET(req: NextRequest) {
    try {
        await dbConnect();

        // Find all distinct class names
        // Filter out null/undefined/empty
        const classes = await Student.distinct("className", {
            className: { $nin: [null, ""] }
        });

        // Sort them
        const uniqueClasses = classes.sort();

        return NextResponse.json(uniqueClasses);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
