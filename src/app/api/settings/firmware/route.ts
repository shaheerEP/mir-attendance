import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import dbConnect from "@/lib/db";
import Settings from "@/models/Settings";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const version = formData.get("version") as string;

        if (!file || !version) {
            return NextResponse.json(
                { error: "File and version are required" },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `firmware-${version}.bin`;

        // Ensure directory exists
        const uploadDir = path.join(process.cwd(), "public", "firmware");
        await mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, filename);
        await writeFile(filePath, buffer);

        const fileUrl = `/firmware/${filename}`;

        // Update Settings in DB
        await dbConnect();
        const settings = await Settings.findOneAndUpdate(
            {},
            {
                $set: {
                    firmware: {
                        version: version,
                        url: fileUrl,
                    },
                },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        return NextResponse.json({
            success: true,
            settings
        });

    } catch (error: any) {
        console.error("Upload error:", error);
        return NextResponse.json(
            { error: error.message || "Upload failed" },
            { status: 500 }
        );
    }
}
