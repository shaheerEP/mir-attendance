
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Settings from "@/models/Settings";
import Firmware from "@/models/Firmware";

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
        // Sanitize filename
        const filename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");

        await dbConnect();

        // Save to MongoDB (Vercel has read-only filesystem)
        // Check if version exists
        let fw = await Firmware.findOne({ version: version || filename });
        if (fw) {
            fw.data = buffer;
            fw.filename = filename;
            await fw.save();
        } else {
            fw = await Firmware.create({
                version: version || filename,
                filename: filename,
                data: buffer
            });
        }

        console.log(`Saved firmware version ${fw.version} to DB`);

        // Dynamic URL for downloading from DB
        const relativePath = `/api/device/firmware?version=${fw.version}`;

        // Update Settings DB
        const settings = await Settings.findOne();
        if (settings) {
            settings.deviceConfig = {
                ...settings.deviceConfig,
                firmwareUrl: relativePath,
                firmwareVersion: version || filename
            };
            await settings.save();
        } else {
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
