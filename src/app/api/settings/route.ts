import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Settings from "@/models/Settings";
import { PERIODS } from "@/lib/periods"; // Fallback defaults

export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        let settings = await Settings.findOne();

        if (!settings) {
            // Return defaults if not set in DB yet
            return NextResponse.json({
                periods: PERIODS,
                gracePeriod: { fullPresentMins: 5, halfPresentMins: 20 }
            });
        }

        return NextResponse.json(settings);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const { periods, gracePeriod, weeklyHolidays } = body;

        // Upsert the single settings document
        const settings = await Settings.findOneAndUpdate(
            {}, // filter - match any (we only want one doc)
            { periods, gracePeriod, weeklyHolidays },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        return NextResponse.json(settings);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
