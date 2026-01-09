import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import AttendanceLog from "@/models/AttendanceLog";

export async function GET(req: NextRequest) {
    try {
        await dbConnect();

        const now = new Date();
        // Start of current week (Sunday)
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        // Aggregate logs by day
        const stats = await AttendanceLog.aggregate([
            {
                $match: {
                    timestamp: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: { $dayOfWeek: "$timestamp" }, // 1 (Sun) to 7 (Sat)
                    present: {
                        $sum: {
                            $cond: [{ $in: ["$status", ["PRESENT", "HALF_PRESENT"]] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        // Map Mongo day numbers to our chart format
        // Mongo: 1=Sun, 2=Mon ... 7=Sat
        // Chart wants: name: "Sun", present: X
        const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const result = dayLabels.map((label, index) => {
            // Mongo returns 1 for Sunday, which is index 0 for us + 1.
            const dayStat = stats.find(s => s._id === (index + 1));
            return {
                name: label,
                present: dayStat ? dayStat.present : 0
            };
        });

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
