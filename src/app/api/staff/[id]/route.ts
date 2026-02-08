import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Staff from "@/models/Staff";

// Helper to extract ID from URL
const getId = (req: NextRequest) => {
    const url = new URL(req.url);
    return url.pathname.split('/').pop();
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    await dbConnect();
    const { id } = await params; // Await params in Next.js 15+ 
    // Wait, check Next version. Package.json said "next": "16.1.1".
    // In Next 15+, params is a Promise.

    try {
        const staff = await Staff.findById(id);
        if (!staff) {
            return NextResponse.json({ error: "Staff not found" }, { status: 404 });
        }
        return NextResponse.json({ staff }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    await dbConnect();
    const { id } = await params;

    try {
        const body = await req.json();
        const updatedStaff = await Staff.findByIdAndUpdate(id, body, { new: true });

        if (!updatedStaff) {
            return NextResponse.json({ error: "Staff not found" }, { status: 404 });
        }

        return NextResponse.json({ message: "Staff updated", staff: updatedStaff }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    await dbConnect();
    const { id } = await params;

    try {
        const deletedStaff = await Staff.findByIdAndDelete(id);
        if (!deletedStaff) {
            return NextResponse.json({ error: "Staff not found" }, { status: 404 });
        }
        return NextResponse.json({ message: "Staff deleted" }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
