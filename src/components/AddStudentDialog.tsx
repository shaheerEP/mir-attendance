"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export function AddStudentDialog() {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [uid, setUid] = useState("");
    const [rollNumber, setRollNumber] = useState("");
    const [className, setClassName] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/students", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, rfid_uid: uid, rollNumber, className }),
            });

            if (res.ok) {
                setOpen(false);
                setName("");
                setUid("");
                setRollNumber("");
                setClassName("");
                router.refresh(); // Refresh (Server Components) or call callback
                window.location.reload(); // Hard reload to fetch new list for client components if needed
            } else {
                const err = await res.json();
                alert(err.message || "Failed to add student");
            }
        } catch (error) {
            console.error(error);
            alert("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Student
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add Student</DialogTitle>
                    <DialogDescription>
                        Enter the student's details and their RFID Card UID.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Name
                            </Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="uid" className="text-right">
                                RFID UID
                            </Label>
                            <Input
                                id="uid"
                                value={uid}
                                onChange={(e) => setUid(e.target.value)}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="roll" className="text-right">
                                Roll No
                            </Label>
                            <Input
                                id="roll"
                                value={rollNumber}
                                onChange={(e) => setRollNumber(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="class" className="text-right">
                                Class
                            </Label>
                            <Input
                                id="class"
                                value={className}
                                onChange={(e) => setClassName(e.target.value)}
                                className="col-span-3"
                                placeholder="e.g. 10A"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Saving..." : "Save Student"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
