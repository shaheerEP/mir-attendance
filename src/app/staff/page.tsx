"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Search, User, Trash2, Edit } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AddStaffDialog } from "@/components/AddStaffDialog";

interface IStaff {
    _id: string;
    name: string;
    staffId: string;
    department?: string;
    designation?: string;
    imageUrl?: string;
    faceDescriptor?: number[];
}

export default function StaffPage() {
    const [staff, setStaff] = useState<IStaff[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [isAddOpen, setIsAddOpen] = useState(false);

    const fetchStaff = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/staff");
            if (res.ok) {
                const data = await res.json();
                setStaff(data.staff);
            }
        } catch (error) {
            console.error("Failed to fetch staff", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this staff member?")) return;
        try {
            const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
            if (res.ok) {
                fetchStaff();
            } else {
                alert("Failed to delete staff");
            }
        } catch (error) {
            console.error("Error deleting staff", error);
        }
    };

    const filteredStaff = staff.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.staffId.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Staff Management</h2>
                    <p className="text-muted-foreground">Manage staff members and their biometric data.</p>
                </div>
                <Button onClick={() => setIsAddOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Plus className="mr-2 h-4 w-4" /> Add Staff
                </Button>
            </div>

            {/* Search and Filter Bar */}
            <div className="flex items-center space-x-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name or ID..."
                        className="pl-8 bg-white"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Staff Grid */}
            {loading ? (
                <div className="text-center py-10">Loading staff...</div>
            ) : filteredStaff.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-lg border border-dashed">
                    <User className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium">No Staff Found</h3>
                    <p className="text-muted-foreground">Get started by adding a new staff member.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredStaff.map((member) => (
                        <Card key={member._id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg overflow-hidden">
                                    {member.imageUrl ? (
                                        <img src={member.imageUrl} alt={member.name} className="h-full w-full object-cover" />
                                    ) : (
                                        member.name.charAt(0)
                                    )}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <CardTitle className="text-base truncate" title={member.name}>{member.name}</CardTitle>
                                    <CardDescription>{member.staffId}</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm space-y-1 text-muted-foreground mb-4">
                                    <div className="flex justify-between">
                                        <span>Dept:</span>
                                        <span className="font-medium text-slate-700">{member.department || "-"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Role:</span>
                                        <span className="font-medium text-slate-700">{member.designation || "-"}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <span>Biometric:</span>
                                        <span className={`px-2 py-0.5 rounded textxs font-medium ${member.faceDescriptor && member.faceDescriptor.length > 0 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                                            {member.faceDescriptor && member.faceDescriptor.length > 0 ? "Registered" : "Pending"}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-4 pt-4 border-t">
                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => alert("Edit not implemented yet")}>
                                        <Edit className="h-3 w-3 mr-1" /> Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(member._id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <AddStaffDialog open={isAddOpen} onOpenChange={setIsAddOpen} onSuccess={fetchStaff} />
        </div>
    );
}
