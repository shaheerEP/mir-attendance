"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AddStudentDialog } from "@/components/AddStudentDialog";
import { EditStudentDialog } from "@/components/EditStudentDialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Trash2, UserX } from "lucide-react";
import { useRouter } from "next/navigation";

interface Student {
    _id: string;
    name: string;
    rfid_uid: string;
    created_at: string;
}

export default function StudentsPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const router = useRouter();

    const fetchStudents = async () => {
        try {
            const res = await fetch("/api/students");
            if (res.ok) {
                const data = await res.json();
                setStudents(data);
            }
        } catch (error) {
            console.error("Failed to fetch students", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStudents();
    }, []);

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete ${name}?`)) return;

        try {
            const res = await fetch(`/api/students/${id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                setStudents(students.filter((s) => s._id !== id));
                router.refresh();
            } else {
                alert("Failed to delete student");
            }
        } catch (error) {
            console.error(error);
            alert("Error deleting student");
        }
    };

    const filteredStudents = students.filter(
        (s) =>
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.rfid_uid.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-8 space-y-8 min-h-screen bg-slate-50/50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Students Directory</h2>
                    <p className="text-muted-foreground">Manage registered students and RFID cards.</p>
                </div>
                <AddStudentDialog />
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>All Students</CardTitle>
                            <CardDescription>Total Registered: {students.length}</CardDescription>
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name or UID..."
                                className="pl-8"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>RFID UID</TableHead>
                                <TableHead>Date Added</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                        Loading directory...
                                    </TableCell>
                                </TableRow>
                            ) : filteredStudents.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <UserX className="h-8 w-8 text-slate-300" />
                                            <p>No students found matching your search.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredStudents.map((student) => (
                                    <TableRow key={student._id}>
                                        <TableCell className="font-medium">
                                            <Link href={`/students/${student._id}`} className="hover:underline">
                                                {student.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{student.rfid_uid}</TableCell>
                                        <TableCell>
                                            {new Date(student.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <EditStudentDialog student={student} />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDelete(student._id, student.name)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
