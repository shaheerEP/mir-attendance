"use client";

import { useEffect, useState, useRef } from "react";
import * as faceapi from 'face-api.js';
import { Button } from "@/components/ui/button";

interface Student {
    _id: string;
    name: string;
    faceDescriptor?: number[];
}

export default function FaceScanPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [displayText, setDisplayText] = useState("Initializing...");
    const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
    const videoRef = useRef<HTMLImageElement>(null);
    const streamUrl = "http://192.168.31.160/stream";

    // 1. Load Models & Students
    useEffect(() => {
        const init = async () => {
            try {
                // Load Models
                const MODEL_URL = "/models";
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                ]);
                console.log("Models loaded");

                // Load Students
                const res = await fetch("/api/students");
                const data: Student[] = await res.json();
                setStudents(data);

                // Create FaceMatcher
                const labeledDescriptors = data
                    .filter(s => s.faceDescriptor && s.faceDescriptor.length > 0)
                    .map(s => new faceapi.LabeledFaceDescriptors(s.name, [new Float32Array(s.faceDescriptor!)]));

                if (labeledDescriptors.length > 0) {
                    setFaceMatcher(new faceapi.FaceMatcher(labeledDescriptors, 0.6));
                    setDisplayText("Ready to Scan");
                } else {
                    setDisplayText("No students with face data found.");
                }

                setIsModelLoaded(true);

            } catch (err) {
                console.error("Initialization failed", err);
                setDisplayText("Failed to load resources");
            }
        };
        init();
    }, []);

    // 2. Detection Loop
    useEffect(() => {
        if (!isModelLoaded || !faceMatcher || !videoRef.current) return;

        const interval = setInterval(async () => {
            if (videoRef.current) {
                try {
                    // Ensure crossOrigin is set for canvas access
                    if (!videoRef.current.crossOrigin) videoRef.current.crossOrigin = "anonymous";

                    const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor();

                    if (detection) {
                        const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
                        if (bestMatch.label !== "unknown") {
                            // DO ATTENDANCE LOGIC HERE
                            // Ideally throttle this so we don't spam the API

                            setDisplayText(`Welcome, ${bestMatch.label}! (${Math.round(bestMatch.distance * 100) / 100})`);

                            // Find student ID
                            const student = students.find(s => s.name === bestMatch.label);
                            if (student) {
                                markAttendance(student._id);
                            }

                        } else {
                            setDisplayText("Unknown Face");
                        }
                    } else {
                        setDisplayText("Scanning...");
                    }
                } catch (err) {
                    console.error("Detection error", err);
                }
            }
        }, 500); // Check every 500ms

        return () => clearInterval(interval);
    }, [isModelLoaded, faceMatcher, students]);

    const markAttendance = async (studentId: string) => {
        // Implement throttling/debouncing here to prevent duplicate calls
        // For now just log
        console.log("Marking attendance for:", studentId);
        // await fetch('/api/attendance', ...);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
            <h1 className="text-3xl font-bold mb-4">Face Recognition Attendance</h1>

            <div className="relative border-4 border-green-500 rounded-lg overflow-hidden">
                <img
                    ref={videoRef}
                    src={streamUrl}
                    alt="ESP32 Stream"
                    className="max-w-full max-h-[60vh]"
                    crossOrigin="anonymous"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-4 text-center text-xl font-mono">
                    {displayText}
                </div>
            </div>

            <div className="mt-8 text-gray-400">
                <p>Ensure face is clearly visible and well-lit.</p>
            </div>

            <Button className="mt-4" onClick={() => window.location.href = '/'}>
                Back to Dashboard
            </Button>
        </div>
    );
}
