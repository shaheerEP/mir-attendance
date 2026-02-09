"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Clock, Calendar, Users, Activity } from "lucide-react";
import { getCurrentActivePeriod, PERIODS } from "@/lib/periods";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Log {
  _id: string;
  student_id: {
    name: string;
    rollNumber?: string;
  };
  timestamp: string;
  status: string;
}

interface PeriodConfig {
  id: number;
  startTime: string;
  durationMinutes: number;
}

interface PeriodStatus {
  isHoliday: boolean;
  periodName: string;
  periodNumber: number;
  timeRange: string;
}

export default function Dashboard() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodStatus | null>(null);
  const [periodsConfig, setPeriodsConfig] = useState<PeriodConfig[]>(PERIODS);
  const [holidays, setHolidays] = useState<number[]>([5]); // Default Fri

  // Dynamic Chart Data
  const [weeklyStats, setWeeklyStats] = useState([
    { name: "Sun", present: 0 },
    { name: "Mon", present: 0 },
    { name: "Tue", present: 0 },
    { name: "Wed", present: 0 },
    { name: "Thu", present: 0 },
    { name: "Fri", present: 0 },
    { name: "Sat", present: 0 },
  ]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        // If API returns valid periods, use them. Otherwise fallback to default PERIODS via useState init.
        if (data.periods && Array.isArray(data.periods) && data.periods.length > 0) {
          setPeriodsConfig(data.periods);
        }
        if (data.weeklyHolidays) setHolidays(data.weeklyHolidays);
      }
    } catch (error) {
      console.error("Failed to fetch settings", error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Logs
      const logsRes = await fetch("/api/attendance/logs");
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data);
      }

      // Fetch Weekly Stats
      const statsRes = await fetch("/api/attendance/stats/weekly");
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setWeeklyStats(statsData);
      }

    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePeriodStatus = () => {
    const now = new Date();
    const day = now.getDay();

    // Dynamic Holiday Check
    if (holidays.includes(day)) {
      setPeriod({
        isHoliday: true,
        periodName: "Holiday",
        periodNumber: 0,
        timeRange: "All Day",
      });
      return;
    }

    const active = getCurrentActivePeriod(now, periodsConfig);

    if (active) {
      const [h, m] = active.startTime.split(':').map(Number);
      const start = new Date(now);
      start.setHours(h, m, 0, 0);
      const end = new Date(start.getTime() + active.durationMinutes * 60000);

      const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

      setPeriod({
        isHoliday: false,
        periodName: `Period ${active.id}`,
        periodNumber: active.id,
        timeRange: `${formatTime(start)} - ${formatTime(end)}`
      });
    } else {
      setPeriod({
        isHoliday: false,
        periodName: "No Active Class",
        periodNumber: 0,
        timeRange: "Break / After School"
      });
    }
  };

  useEffect(() => {
    fetchSettings().then(() => {
      // After settings fetch, do initial update
      fetchData();
    });
  }, []); // Run once on mount

  // Update status when config changes or time passes
  useEffect(() => {
    updatePeriodStatus(); // usage of new config
    const interval = setInterval(() => {
      fetchData();
      updatePeriodStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [periodsConfig]);

  // Trigger Absentee Check periodically
  useEffect(() => {
    const runAbsenteeCheck = async () => {
      try {
        await fetch("/api/attendance/process-absents");
      } catch (err) {
        console.error("Absentee check failed", err);
      }
    };

    // Run once on load, then every 60s
    runAbsenteeCheck();
    const interval = setInterval(runAbsenteeCheck, 60000);
    return () => clearInterval(interval);
  }, []);

  const totalPresent = logs.filter((l) => l.status === "PRESENT").length;

  return (
    <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h2>
          <p className="text-muted-foreground">Overview of today's attendance and class schedule.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={period?.isHoliday ? "destructive" : "outline"} className="px-4 py-2 text-sm bg-white">
            {period?.isHoliday ? "Holiday Mode" : period?.timeRange}
          </Badge>
          <Button onClick={fetchData} variant="default" size="sm" className="bg-emerald-600 hover:bg-emerald-700">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Data
          </Button>

        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Present</CardTitle>
            <Users className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPresent}</div>
            <p className="text-xs text-muted-foreground">Students marked today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Period</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {period?.isHoliday ? "Holiday" : (period?.periodNumber ?? 0) > 0 && (period?.periodNumber ?? 0) <= 8 ? `Period ${period?.periodNumber}` : period?.periodName}
            </div>
            <p className="text-xs text-muted-foreground">
              {(period?.periodNumber ?? 0) > 0 && (period?.periodNumber ?? 0) <= 8 ? "Class is in session" : period?.periodName}
            </p>
          </CardContent>
        </Card>



        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Date</CardTitle>
            <Calendar className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Date().toLocaleDateString('en-US', { weekday: 'short' })}</div>
            <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Chart Section */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Weekly Attendance Overview</CardTitle>
            <CardDescription>Daily student presence count (Admin Demo)</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyStats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ background: '#1e293b', border: 'none', color: '#fff' }} />
                  <Bar dataKey="present" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Logs Section */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Live Feed</CardTitle>
            <CardDescription>
              Real-time entrance logs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] overflow-auto">
              {loading && logs.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading logs...</div>
              ) : logs.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No logs today.</div>
              ) : (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div key={log._id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">{log.student_id?.name || "Unknown Visitor"}</p>
                        <p className="text-xs text-muted-foreground">{log.student_id?.rollNumber || "No Roll No"}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-emerald-600">{log.status}</div>
                        <div className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
