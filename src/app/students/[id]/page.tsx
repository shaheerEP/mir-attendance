"use client";

import { useEffect, useState, use } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, Clock, ArrowLeft, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { AddManualLogDialog } from "@/components/AddManualLogDialog";
import { EditLogDialog } from "@/components/EditLogDialog";
import { useRouter } from "next/navigation";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface AttendanceLog {
    _id: string;
    timestamp: string;
    status: string;
    periodId?: number;
}

interface StudentStats {
    totalPresent: number;
    totalHalf: number;
    totalLate: number;
    total: number;
}

interface StudentData {
    _id: string;
    name: string;
    imageUrl?: string;
    imageId?: string;
}

export default function StudentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const studentId = resolvedParams.id;
    const router = useRouter();

    const [student, setStudent] = useState<StudentData | null>(null);
    const [logs, setLogs] = useState<AttendanceLog[]>([]);
    const [stats, setStats] = useState<StudentStats | null>(null);
    const [loading, setLoading] = useState(true);

    // Fetch Student Info & Logs
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Get Student Basic Info
                // We reuse the list API or fetch specifically? 
                // Existing /api/students/[id] supports GET/PATCH/DELETE
                const studentRes = await fetch(`/api/students/${studentId}`);
                // Wait, did we implement GET single student? 
                // Checking /api/students/[id]/route.ts...
                // Yes, we need to ensure GET returns the student details.

                if (studentRes.ok) {
                    const sData = await studentRes.json();
                    setStudent(sData);
                }

                // 2. Get Logs & Stats
                const logsRes = await fetch(`/api/students/${studentId}/logs`);
                if (logsRes.ok) {
                    const lData = await logsRes.json();
                    setLogs(lData.logs);
                    setStats(lData.stats);
                }

            } catch (error) {
                console.error("Error fetching student details", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [studentId]);

    if (loading) {
        return <div className="p-8 flex justify-center">Loading...</div>;
    }

    if (!student) {
        return <div className="p-8">Student not found</div>;
    }

    return (
        <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen">
            <div className="flex justify-between items-center mb-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Students
                </Button>
                {student && <AddManualLogDialog studentId={student._id} />}
            </div>

            {/* Header Profile */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center overflow-hidden">
                        {student.imageUrl ? (
                            <img
                                src={student.imageUrl}
                                alt={student.name}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <User className="h-8 w-8 text-emerald-600" />
                        )}
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900">{student.name}</h2>
                        <div className="flex items-center gap-2 text-muted-foreground">

                            <span className="text-sm">Student ID: {student._id.slice(-6)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats?.total ? Math.round(((stats.totalPresent + (stats.totalHalf * 0.5)) / stats.total) * 100) : 0}%
                        </div>
                        <p className="text-xs text-muted-foreground">Based on {stats?.total} records</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Present</CardTitle>
                        <User className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.totalPresent}</div>
                        <p className="text-xs text-muted-foreground">Full Days</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Half Days / Late</CardTitle>
                        <Clock className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.totalHalf} <span className="text-sm font-normal text-muted-foreground">/ {stats?.totalLate}</span></div>
                        <p className="text-xs text-muted-foreground">Half Days / Lates</p>
                    </CardContent>
                </Card>
            </div>

            {/* History Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Attendance History</CardTitle>
                    <CardDescription>Detailed logs of student entry.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead>Period</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log) => (
                                <TableRow key={log._id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                            {new Date(log.timestamp).toLocaleDateString()}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {log.periodId ? `P${log.periodId}` : "-"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={log.status === "PRESENT" ? "default" : log.status === "HALF_PRESENT" ? "secondary" : "destructive"}>
                                                {log.status === "HALF_PRESENT" ? "Half Day" : log.status}
                                            </Badge>
                                            <EditLogDialog log={log} />
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <button
                                            onClick={async () => {
                                                if (!confirm("Delete this log?")) return;
                                                const res = await fetch(`/api/attendance/logs/${log._id}`, { method: "DELETE" });
                                                if (res.ok) window.location.reload();
                                            }}
                                            className="text-red-400 hover:text-red-600 p-1"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {logs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                        No attendance records found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
