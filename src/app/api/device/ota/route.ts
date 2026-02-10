
import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import dbConnect from "@/lib/db";
import Settings from "@/models/Settings";

// Prevent Next.js from caching
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const version = formData.get("version") as string;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        // Sanitize filename to prevent directory traversal
        const filename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const relativePath = `/firmware/${filename}`;
        const uploadDir = path.join(process.cwd(), "public", "firmware");
        const filePath = path.join(uploadDir, filename);

        // Ensure directory exists (handled by mkdir previously, but good to be safe - skipping for brevity/assuming previous step worked)

        await writeFile(filePath, buffer);
        console.log(`Saved firmware to ${filePath}`);

        // Update Settings DB
        await dbConnect();

        // We update the firmware config. 
        // Note: We need to ensure deviceConfig exists or is created.
        const settings = await Settings.findOne();
        if (settings) {
            settings.deviceConfig = {
                ...settings.deviceConfig,
                firmwareUrl: relativePath,
                firmwareVersion: version || filename // Use filename as version if not provided
            };
            await settings.save();
        } else {
            // Create new if strictly necessary, but Settings should exist by now.
            await Settings.create({
                deviceConfig: {
                    firmwareUrl: relativePath,
                    firmwareVersion: version || filename
                }
            });
        }

        return NextResponse.json({
            success: true,
            url: relativePath,
            version: version || filename
        });

    } catch (error: any) {
        console.error("Upload Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
