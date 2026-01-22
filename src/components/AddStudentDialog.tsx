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
import * as faceapi from 'face-api.js';

export function AddStudentDialog() {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [uid, setUid] = useState("");
    const [rollNumber, setRollNumber] = useState("");
    const [className, setClassName] = useState("");
    const [loading, setLoading] = useState(false);
    const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const router = useRouter();

    // Use specific resolution for face recognition
    const [streamUrl, setStreamUrl] = useState("http://192.168.31.160/stream");

    useEffect(() => {
        const loadModels = async () => {
            const MODEL_URL = "/models";
            try {
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                ]);
                setIsModelLoaded(true);
                console.log("Face models loaded");
            } catch (err) {
                console.error("Failed to load models", err);
            }
        };
        if (open) {
            loadModels();
        }
    }, [open]);

    const handleCaptureFace = async () => {
        if (!isModelLoaded) return;
        setCapturing(true);
        const img = document.getElementById('camera-stream') as HTMLImageElement;

        if (img) {
            try {
                // crossOrigin must be anonymous for canvas manipulation
                if (!img.crossOrigin) img.crossOrigin = "anonymous";

                const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

                if (detection) {
                    setFaceDescriptor(Array.from(detection.descriptor));
                    alert("Face captured successfully!");
                } else {
                    alert("No face detected. Please try again.");
                }
            } catch (error) {
                console.error("Detection error:", error);
                alert("Failed to detect face. Ensure CORS is allowed on ESP32 or use a proxy.");
            }
        }
        setCapturing(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const body = {
                name,
                rfid_uid: uid,
                rollNumber,
                className,
                faceDescriptor // Add descriptor
            };

            const res = await fetch("/api/students", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                setOpen(false);
                setName("");
                setUid("");
                setRollNumber("");
                setClassName("");
                setFaceDescriptor(null);
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
                        Enter details, RFID UID, and capture face for recognition.
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
                            disabled={!isModelLoaded || capturing}
                        >
                            {capturing ? "Detecting..." : !isModelLoaded ? "Loading Models..." : "Capture Face"}
                        </Button>
                        {faceDescriptor && <p className="text-green-500 text-sm mt-1">Face data registered ✓</p>}
                    </div>

                    <form id="add-student-form" onSubmit={handleSubmit} className="grid gap-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="uid" className="text-right">RFID UID</Label>
                            <Input id="uid" value={uid} onChange={(e) => setUid(e.target.value)} className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="roll" className="text-right">Roll No</Label>
                            <Input id="roll" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="class" className="text-right">Class</Label>
                            <Input id="class" value={className} onChange={(e) => setClassName(e.target.value)} className="col-span-3" placeholder="e.g. 10A" />
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
