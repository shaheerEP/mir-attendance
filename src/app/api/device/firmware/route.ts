import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Firmware from "@/models/Firmware";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const version = req.nextUrl.searchParams.get("version");

        if (!version) {
            return NextResponse.json({ error: "Version required" }, { status: 400 });
        }

        await dbConnect();
        const fw = await Firmware.findOne({ version });

        if (!fw || !fw.data) {
            return NextResponse.json({ error: "Firmware not found" }, { status: 404 });
        }

        // Return the binary data
        return new NextResponse(fw.data, {
            headers: {
                "Content-Type": "application/octet-stream",
                "Content-Disposition": `attachment; filename="${fw.filename}"`,
                "Content-Length": fw.data.length.toString(),
            },
        });

    } catch (error: any) {
        console.error("Firmware Download Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
