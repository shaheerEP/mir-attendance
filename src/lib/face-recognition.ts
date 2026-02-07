import './polyfill-node'; // Ensure environment is patched first
import { Canvas, Image, ImageData } from 'canvas';
import path from 'path';
import Student from '@/models/Student';
import dbConnect from '@/lib/db';

// Helper to load image
import * as canvasLib from 'canvas';
let canvas: any = canvasLib;

// Handle CommonJS/ESM interop for canvas in Next.js/TS
if (canvas.default) {
    canvas = canvas.default;
}

let faceapi: any = null;
let modelsLoaded = false;
const MODELS_PATH = path.join(process.cwd(), 'public', 'models');

async function getFaceApi() {
    if (faceapi) return faceapi;

    // Dynamically load face-api.js so polyfills apply first
    const faceApiModule = await import('face-api.js');
    faceapi = faceApiModule;

    // Patch environment
    if (!faceapi.env.monkeyPatch) {
        console.warn('[FaceRec] faceapi.env.monkeyPatch is undefined');
    } else {
        try {
            faceapi.env.monkeyPatch({
                Canvas: canvas.Canvas,
                Image: canvas.Image,
                ImageData: canvas.ImageData
            });
            console.log('[FaceRec] FaceAPI monkeyPatched successfully');
        } catch (err: any) {
            console.error('[FaceRec] monkeyPatch failed:', err);
        }
    }

    return faceapi;
}

export async function loadModels() {
    if (modelsLoaded) return;

    const api = await getFaceApi();

    console.log('[FaceRec] Loading models from:', MODELS_PATH);

    try {
        await api.nets.ssdMobilenetv1.loadFromDisk(MODELS_PATH);
        await api.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH);
        await api.nets.faceRecognitionNet.loadFromDisk(MODELS_PATH);
        modelsLoaded = true;
        console.log('[FaceRec] Models loaded successfully');
    } catch (error) {
        console.error('[FaceRec] Error loading models:', error);
        throw error;
    }
}

export async function recognizeFace(imageBuffer: Buffer) {
    const api = await getFaceApi(); // Ensure loaded and patched
    await loadModels(); // Ensure models loaded

    // 1. Detect ALL Faces in Image
    const img = await canvas.loadImage(imageBuffer);

    // Detect all faces
    const detections = await api.detectAllFaces(img as any)
        .withFaceLandmarks()
        .withFaceDescriptors();

    if (!detections || detections.length === 0) {
        return [];
    }

    // 2. Load all students with descriptors
    await dbConnect();
    const students = await Student.find({ faceDescriptor: { $exists: true, $ne: [] } });

    if (students.length === 0) {
        console.log("[FaceRec] No students with descriptors found in DB.");
        return [];
    }

    // 3. Create Face Matcher
    const labeledDescriptors = students.map(student => {
        return new api.LabeledFaceDescriptors(
            student._id.toString(),
            [new Float32Array((student.faceDescriptor || []) as any)]
        );
    });

    const faceMatcher = new api.FaceMatcher(labeledDescriptors, 0.6);

    const results = [];

    // 4. Match Each Face
    for (const detection of detections) {
        const match = faceMatcher.findBestMatch(detection.descriptor);

        if (match.label !== 'unknown') {
            const matchedStudent = students.find(s => s._id.toString() === match.label);
            if (matchedStudent) {
                results.push({
                    studentId: match.label,
                    name: matchedStudent.name,
                    distance: match.distance
                });
            }
        }
    }

    return results;
}

// Helper to load image since we need 'canvas' package specific loadImage
