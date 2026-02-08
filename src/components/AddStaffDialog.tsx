"use client";

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Camera, Upload } from "lucide-react";

interface AddStaffDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function AddStaffDialog({ open, onOpenChange, onSuccess }: AddStaffDialogProps) {
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState("");
    const [staffId, setStaffId] = useState("");
    const [department, setDepartment] = useState("");
    const [designation, setDesignation] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
    const [generating, setGenerating] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setFaceDescriptor(null); // Reset descriptor when new image is selected
        }
    };

    const generateDescriptor = async () => {
        if (!imageFile) return;
        setGenerating(true);
        const formData = new FormData();
        formData.append("image", imageFile);

        try {
            const res = await fetch("/api/generate-descriptor", {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                setFaceDescriptor(data.descriptor);
                alert("Face descriptor generated successfully!");
            } else {
                const err = await res.json();
                alert(err.message || "Failed to generate descriptor");
                setFaceDescriptor(null);
            }
        } catch (error) {
            console.error("Generation error:", error);
            alert("Failed to connect to server for descriptor generation.");
        } finally {
            setGenerating(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append("name", name);
            formData.append("staffId", staffId);
            formData.append("department", department);
            formData.append("designation", designation);

            if (imageFile) {
                formData.append("image", imageFile);
            }

            if (faceDescriptor) {
                formData.append("faceDescriptor", JSON.stringify(faceDescriptor));
            }

            const res = await fetch("/api/staff", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to create staff");
            }

            onSuccess();
            onOpenChange(false);
            // Reset form
            setName("");
            setStaffId("");
            setDepartment("");
            setDesignation("");
            setDesignation("");
            setImageFile(null);
            setPreviewUrl(null);
            setFaceDescriptor(null);

        } catch (error: any) {
            console.error(error);
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add New Staff Member</DialogTitle>
                    <DialogDescription>
                        Enter staff details and upload a clear photo for face recognition.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="John Doe" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="staffId">Staff ID</Label>
                            <Input id="staffId" value={staffId} onChange={(e) => setStaffId(e.target.value)} required placeholder="EMP-001" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="department">Department</Label>
                            <Input id="department" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="IT / HR" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="designation">Designation</Label>
                            <Input id="designation" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Manager" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Face Photo (Required for Attendance)</Label>
                        <div className="flex items-center gap-4">
                            <div
                                className="h-24 w-24 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500 bg-slate-50 cursor-pointer hover:bg-slate-100 overflow-hidden relative"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                                ) : (
                                    <>
                                        <Camera className="h-6 w-6 mb-1" />
                                        <span className="text-[10px]">Upload</span>
                                    </>
                                )}
                            </div>
                            <div className="flex-1 space-y-2">
                                <p className="text-sm text-muted-foreground">
                                    Upload a clear photo of the face. Good lighting is important.
                                </p>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                        <Upload className="mr-2 h-4 w-4" /> Select Image
                                    </Button>
                                    {imageFile && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={generateDescriptor}
                                            disabled={generating || !!faceDescriptor}
                                            className={faceDescriptor ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                                        >
                                            {generating ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                                                </>
                                            ) : faceDescriptor ? (
                                                "Descriptor Generated ✓"
                                            ) : (
                                                "Generate Descriptor"
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                                </>
                            ) : (
                                "Create Staff"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
