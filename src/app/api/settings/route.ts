import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Settings from "@/models/Settings";
import { PERIODS } from "@/lib/periods"; // Fallback defaults

export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        let settings = await Settings.findOne();

        // ---------------------------------------------------------
        // STATUS LOGIC (Period + Counts)
        // ---------------------------------------------------------
        const allPeriods = settings?.periods || PERIODS;
        const now = new Date();
        const IST_OFFSET = 5.5 * 60 * 60 * 1000;
        const schoolTime = new Date(now.getTime() + IST_OFFSET);

        // 1. Identify Period
        const activePeriod = getCurrentActivePeriod(schoolTime, allPeriods);
        const periodName = activePeriod ? activePeriod.name : "Free";

        // 2. Identify Counts
        const totalStudents = await (mongoose.models.Student || Student).countDocuments();
        let presentCount = 0;

        if (activePeriod) {
            const [h, m] = activePeriod.startTime.split(":").map(Number);
            const startOfPeriod = new Date(schoolTime);
            startOfPeriod.setHours(h, m, 0, 0);
            const endOfPeriod = new Date(startOfPeriod.getTime() + activePeriod.durationMinutes * 60000);

            // Convert local school times back to UTC for DB query
            const queryStart = new Date(startOfPeriod.getTime() - IST_OFFSET);
            const queryEnd = new Date(endOfPeriod.getTime() - IST_OFFSET);

            presentCount = await (mongoose.models.AttendanceLog || AttendanceLog).countDocuments({
                timestamp: { $gte: queryStart, $lt: queryEnd },
                status: 'PRESENT'
            });
        }

        const statusData = {
            period: periodName,
            counts: `${presentCount}/${totalStudents}`
        };

        if (!settings) {
            // Return defaults if not set in DB yet
            return NextResponse.json({
                periods: PERIODS,
                gracePeriod: { fullPresentMins: 5, halfPresentMins: 20 },
                status: statusData
            });
        }

        // Return existing settings + dynamic status
        return NextResponse.json({
            ...settings.toObject(),
            status: statusData
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const { periods, gracePeriod, weeklyHolidays, wifi, firmware } = body;

        // Upsert the single settings document
        const settings = await Settings.findOneAndUpdate(
            {}, // filter - match any (we only want one doc)
            { periods, gracePeriod, weeklyHolidays, wifi, firmware },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        return NextResponse.json(settings);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
