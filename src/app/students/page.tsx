"use client";

import { useEffect, useState } from "react";
import { AddStudentDialog } from "@/components/AddStudentDialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Student {
    _id: string;
    name: string;
    rfid_uid: string;
    created_at: string;
}

export default function StudentsPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);

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

    return (
        <div className="p-8 space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Students</h2>
                <AddStudentDialog />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Registered Students</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>RFID UID</TableHead>
                                <TableHead>Date Added</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center">
                                        Loading...
                                    </TableCell>
                                </TableRow>
                            ) : students.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center">
                                        No students found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                students.map((student) => (
                                    <TableRow key={student._id}>
                                        <TableCell className="font-medium">{student.name}</TableCell>
                                        <TableCell>{student.rfid_uid}</TableCell>
                                        <TableCell>
                                            {new Date(student.created_at).toLocaleDateString()}
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
