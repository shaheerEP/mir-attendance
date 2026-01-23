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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";

interface EditStudentProps {
    student: {
        _id: string;
        name: string;
        rollNumber?: string;
        className?: string;
        imageUrl?: string;
    };
}

export function EditStudentDialog({ student }: EditStudentProps) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(student.name);
    const [rollNumber, setRollNumber] = useState(student.rollNumber || "");
    const [className, setClassName] = useState(student.className || "");
    const [image, setImage] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(student.imageUrl || null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(`/api/students/${student._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, rollNumber, className, image }),
            });

            if (res.ok) {
                setOpen(false);
                router.refresh();
                window.location.reload();
            } else {
                const err = await res.json();
                alert(err.message || "Failed to update student");
            }
        } catch (error) {
            console.error(error);
            alert("Something went wrong");
        } finally {
            setLoading(false);
        }
        setLoading(false);
    }
};

const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setImage(base64String);
            setPreviewUrl(base64String);
        };
        reader.readAsDataURL(file);
    }
};

return (
    <>
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
            <Pencil className="h-4 w-4" />
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Student</DialogTitle>
                    <DialogDescription>
                        Update student details.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-name" className="text-right">
                                Name
                            </Label>
                            <Input
                                id="edit-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-roll" className="text-right">
                                Roll No
                            </Label>
                            <Input
                                id="edit-roll"
                                value={rollNumber}
                                onChange={(e) => setRollNumber(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-class" className="text-right">
                                Class
                            </Label>
                            <Input
                                id="edit-class"
                                value={className}
                                onChange={(e) => setClassName(e.target.value)}
                                className="col-span-3"
                                placeholder="e.g. 10A"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-image" className="text-right">
                                Photo
                            </Label>
                            <div className="col-span-3">
                                <Input
                                    id="edit-image"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                />
                                {previewUrl && (
                                    <img
                                        src={previewUrl}
                                        alt="Preview"
                                        className="mt-2 h-20 w-20 object-cover rounded-md"
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    </>
);
}
