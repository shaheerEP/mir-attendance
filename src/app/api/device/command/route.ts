import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import DeviceCommand from "@/models/DeviceCommand";

// POST: Queue a Command (from Browser)
export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const { command, payload, deviceId } = body;

        const newCmd = await DeviceCommand.create({
            command,
            payload,
            deviceId: deviceId || "default",
            status: "PENDING"
        });

        return NextResponse.json(newCmd);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// GET: Poll for Pending Commands (from ESP32)
export async function GET(req: NextRequest) {
    try {
        await dbConnect();

        // Find oldest PENDING command
        const cmd = await DeviceCommand.findOne({ status: "PENDING" }).sort({ createdAt: 1 });

        if (!cmd) {
            return NextResponse.json({ command: "NONE" });
        }

        // Mark as SENT so we don't send it again immediately (or keep it pending until ack?)
        // For simple flow, mark as COMPLETED once picked up, or SENT.
        // Let's mark SENT.
        cmd.status = "SENT";
        await cmd.save();

        return NextResponse.json({
            command: cmd.command,
            payload: cmd.payload,
            id: cmd._id
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
