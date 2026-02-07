"use client";

import { useState, useEffect, useRef } from "react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export function AddStudentDialog({ defaultClassName }: { defaultClassName?: string }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [rollNumber, setRollNumber] = useState("");
    const [className, setClassName] = useState(defaultClassName || "");
    const [loading, setLoading] = useState(false);
    const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
    const [image, setImage] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [capturing, setCapturing] = useState(false);
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    const router = useRouter();

    // Use specific resolution for face recognition
    const [streamUrl, setStreamUrl] = useState("http://192.168.31.160/stream");

    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const res = await fetch("/api/classes");
                if (res.ok) {
                    const data = await res.json();
                    setAvailableClasses(data);
                }
            } catch (error) {
                console.error("Failed to fetch classes", error);
            }
        };

        if (open) {
            fetchClasses();
            if (defaultClassName) {
                setClassName(defaultClassName);
            } else {
                setClassName("");
            }
        }
    }, [open, defaultClassName]);

    const generateDescriptor = async (imageBlob: Blob) => {
        setCapturing(true);
        const formData = new FormData();
        formData.append("image", imageBlob);

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
            setCapturing(false);
        }
    };

    const handleCaptureFace = async () => {
        setCapturing(true);
        const img = document.getElementById('camera-stream') as HTMLImageElement;

        if (img) {
            try {
                // crossOrigin must be anonymous for canvas manipulation
                if (!img.crossOrigin) img.crossOrigin = "anonymous";

                // Capture image from stream
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0);

                const capturedImage = canvas.toDataURL('image/jpeg');
                setImage(capturedImage);
                setPreviewUrl(capturedImage);

                // Convert to Blob for API
                canvas.toBlob((blob) => {
                    if (blob) {
                        generateDescriptor(blob);
                    }
                }, 'image/jpeg');

            } catch (error) {
                console.error("Capture error:", error);
                alert("Failed to capture image. Ensure CORS is allowed on ESP32 or use a proxy.");
                setCapturing(false);
            }
        } else {
            setCapturing(false);
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
                // Reset descriptor when new image is uploaded
                setFaceDescriptor(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const imgRef = useRef<HTMLImageElement>(null);

    const handleDetectFromImage = async () => {
        if (!image) return;

        // Convert base64 state to blob
        const res = await fetch(image);
        const blob = await res.blob();
        generateDescriptor(blob);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const body = {
                name,
                rollNumber,
                className,
                faceDescriptor,
                image // Add image
            };

            const res = await fetch("/api/students", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                setOpen(false);
                setName("");
                setRollNumber("");
                // keep class name if default was provided, else clear
                if (!defaultClassName) setClassName("");
                setFaceDescriptor(null);
                setImage(null);
                setPreviewUrl(null);
                router.refresh();
                window.location.reload();
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
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Add Student</DialogTitle>
                    <DialogDescription>
                        Enter details and capture face for recognition.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Stream Section */}
                    <div className="flex flex-col items-center justify-center border rounded-md p-2 bg-black min-h-[240px]">
                        {open && (
                            <img
                                id="camera-stream"
                                src={streamUrl}
                                alt="Camera Stream"
                                className="max-w-full max-h-[300px] object-contain"
                                crossOrigin="anonymous"
                            />
                        )}
                        <Button
                            type="button"
                            variant="secondary"
                            className="mt-2"
                            onClick={handleCaptureFace}
                            disabled={capturing}
                        >
                            {capturing ? "Processing..." : "Capture & Detect Face"}
                        </Button>
                        {faceDescriptor && <p className="text-green-500 text-sm mt-1">Face data registered ✓</p>}
                    </div>

                    <form id="add-student-form" onSubmit={handleSubmit} className="grid gap-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" required />
                        </div>

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="roll" className="text-right">Roll No</Label>
                            <Input id="roll" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="class" className="text-right">Class</Label>
                            <Select value={className} onValueChange={setClassName}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select Class" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableClasses.map((cls) => (
                                        <SelectItem key={cls} value={cls}>
                                            {cls}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="image" className="text-right">Photo</Label>
                            <div className="col-span-3">
                                <Input id="image" type="file" accept="image/*" onChange={handleImageChange} />
                                {previewUrl && (
                                    <div className="mt-2 relative">
                                        <img
                                            ref={imgRef}
                                            src={previewUrl}
                                            alt="Preview"
                                            className="h-40 w-full object-contain rounded-md border text-center"
                                            crossOrigin="anonymous"
                                        />
                                        <div className="mt-1 flex gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => handleDetectFromImage()}
                                                disabled={capturing}
                                            >
                                                Generate Descriptor from Photo
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </form>
                </div>
                <DialogFooter>
                    <Button type="submit" form="add-student-form" disabled={loading}>
                        {loading ? "Saving..." : "Save Student"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
