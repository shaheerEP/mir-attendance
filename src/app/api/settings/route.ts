import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Settings from "@/models/Settings";
import { PERIODS } from "@/lib/periods"; // Fallback defaults

export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        let settings = await Settings.findOne();

        // Default structure if nothing exists
        const defaultResponse = {
            periods: PERIODS,
            gracePeriod: { fullPresentMins: 5, halfPresentMins: 20 },
            wifi: { ssid: "", password: "", networks: [] }
        };

        if (!settings) {
            return NextResponse.json(defaultResponse);
        }

        // Transform for ESP32 (It expects nested objects 'wifi' and 'firmware')
        const responseData = {
            ...settings.toObject(),
            wifi: {
                ssid: settings.deviceConfig?.wifiSSID || "",
                password: settings.deviceConfig?.wifiPassword || "",
                networks: settings.deviceConfig?.wifiNetworks || []
            }
        };

        return NextResponse.json(responseData);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}



export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const { periods, gracePeriod, weeklyHolidays, wifi } = body;

        // Construct deviceConfig if wifi is present (from frontend)
        let deviceConfig = body.deviceConfig;
        if (!deviceConfig && wifi) {
            deviceConfig = {
                wifiSSID: wifi?.ssid,
                wifiPassword: wifi?.password,
                wifiNetworks: wifi?.networks || [],
            };
        }

        console.log("Saving Settings - deviceConfig:", JSON.stringify(deviceConfig, null, 2));

        // Upsert the single settings document
        const settings = await Settings.findOneAndUpdate(
            {}, // filter - match any (we only want one doc)
            { periods, gracePeriod, weeklyHolidays, deviceConfig },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        console.log("Saved Settings Result - wifiNetworks:", JSON.stringify(settings?.deviceConfig?.wifiNetworks, null, 2));

        return NextResponse.json(settings);
    } catch (error: any) {
        console.error("Settings POST Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
