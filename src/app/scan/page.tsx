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

    useEffect(() => {
        // Initial OLED Message
        const initOLED = async () => {
            // Try sending message, might fail if delay is needed but worth a shot
            // Use a small delay to ensure component mount
            setTimeout(() => sendFeedbackToOLED("SYSTEM INIT", "info"), 1000);
        };
        initOLED();
    }, []);

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
                    sendFeedbackToOLED("READY", "info");
                } else {
                    setDisplayText("No students with face data found.");
                    sendFeedbackToOLED("NO DATA", "error");
                }

                setIsModelLoaded(true);

            } catch (err) {
                console.error("Initialization failed", err);
                setDisplayText("Failed to load resources");
            }
        };
        init();
    }, []);

    // State for throttling OLED updates
    const lastOledUpdate = useRef<number>(0);

    const sendFeedbackThrottled = (msg: string, type: string = 'info', delayMs: number = 2000) => {
        const now = Date.now();
        if (now - lastOledUpdate.current > delayMs) {
            sendFeedbackToOLED(msg, type);
            lastOledUpdate.current = now;
        }
    };

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
                            // Valid Face Found
                            setDisplayText(`Verifying: ${bestMatch.label}`);

                            // Find student ID
                            const student = students.find(s => s.name === bestMatch.label);
                            if (student) {
                                // Only mark if enough time passed since last update to avoid rapid fire
                                markAttendance(student._id, student.name);
                            }

                        } else {
                            setDisplayText("Unknown Face");
                            sendFeedbackThrottled("UNKNOWN", "error", 1500);
                        }
                    } else {
                        setDisplayText("Scanning...");
                        // Optionally send "READY" periodically or leave it be
                    }
                } catch (err) {
                    console.error("Detection error", err);
                }
            }
        }, 500); // Check every 500ms

        return () => clearInterval(interval);
    }, [isModelLoaded, faceMatcher, students]);

    const sendFeedbackToOLED = async (msg: string, type: string = 'info') => {
        try {
            // ESP32 IP is usually the same as the stream URL base
            const baseUrl = streamUrl.replace('/stream', '');
            await fetch(`${baseUrl}/feedback?msg=${encodeURIComponent(msg)}&type=${type}`, { mode: 'no-cors' });
        } catch (err) {
            console.error("Failed to send OLED feedback", err);
        }
    };

    const markAttendance = async (studentId: string, name: string) => {
        try {
            const res = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId, deviceId: 'FaceScan' })
            });

            const data = await res.json();

            if (res.ok) {
                setDisplayText(`${data.message} ✓`);
                sendFeedbackToOLED(name, 'success');
                // Timeout to clear message
                setTimeout(() => {
                    setDisplayText("Scanning...");
                    sendFeedbackToOLED("READY", "info");
                }, 3000);
            } else {
                if (res.status === 409) { // Duplicate
                    setDisplayText(`Already Marked: ${name}`);
                    sendFeedbackToOLED(`${name} IN`, "info");
                    setTimeout(() => setDisplayText("Scanning..."), 2000);
                } else {
                    setDisplayText(`Error: ${data.message}`);
                    sendFeedbackToOLED("API ERROR", "error");
                }
            }
        } catch (err) {
            console.error(err);
            sendFeedbackToOLED("NETWORK ERR", "error");
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
            <h1 className="text-3xl font-bold mb-4">Face Recognition Attendance</h1>

            <div className="relative border-4 border-green-500 rounded-lg overflow-hidden shadow-2xl shadow-green-900/50">
                <img
                    ref={videoRef}
                    src={streamUrl}
                    alt="ESP32 Stream"
                    className="max-w-full max-h-[80vh] object-contain"
                    crossOrigin="anonymous"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-4 text-center text-xl font-mono backdrop-blur-sm">
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
