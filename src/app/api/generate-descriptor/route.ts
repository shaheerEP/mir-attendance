import { NextRequest, NextResponse } from "next/server";
import { getDescriptor } from "@/lib/face-recognition";

// Prevent Next.js from caching this route behavior excessively
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // Allow 60 seconds for processing

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("image") as File;

        if (!file) {
            return NextResponse.json({ message: "No image uploaded", status: "error" }, { status: 400 });
        }

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const descriptor = await getDescriptor(buffer);

        if (!descriptor) {
            return NextResponse.json({ message: "No face detected", status: "error" }, { status: 400 });
        }

        return NextResponse.json({
            message: "Descriptor generated successfully",
            descriptor: descriptor,
            status: "success"
        }, { status: 200 });

    } catch (error: any) {
        console.error("[GenerateDescriptor] Error:", error);
        return NextResponse.json({ message: "Server Error", status: "error", error: error.message }, { status: 500 });
    }
}
