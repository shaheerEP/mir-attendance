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

    // 1. Import canvas
    const canvas = await import('canvas');

    // 2. Force Global Patching (Just in case polyfill didn't stick or isolated context)
    const { Canvas, Image, ImageData } = canvas;
    (global as any).Canvas = Canvas;
    (global as any).Image = Image;
    (global as any).ImageData = ImageData;
    (global as any).HTMLCanvasElement = Canvas;
    (global as any).HTMLImageElement = Image;

    console.log('[FaceRec] Globals set manually in getFaceApi');

    // 3. Import face-api.js
    const faceApiModule = await import('face-api.js');
    faceapi = faceApiModule;

    // 4. Force MonkeyPatch
    try {
        if (faceapi.env) {
            console.log('[FaceRec] faceapi.env exists. isNode:', faceapi.env.isNodejs());
            if (faceapi.env.monkeyPatch) {
                faceapi.env.monkeyPatch({
                    Canvas: Canvas,
                    Image: Image,
                    ImageData: ImageData
                });
                console.log('[FaceRec] monkeyPatch called successfully');
            }
        }
    } catch (err: any) {
        console.error('[FaceRec] Error during patching:', err);
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

    let faceMatcher: any;
    try {
        faceMatcher = new api.FaceMatcher(labeledDescriptors, 0.6);
    } catch (error: any) {
        console.error("[FaceRec] Failed to create FaceMatcher:", error);
        // If we can't create matcher, we can't recognize.
        return [];
    }

    const results = [];

    // 4. Match Each Face
    for (const detection of detections) {
        try {
            const desc = detection.descriptor;
            const len = desc.length;

            // Validate Matcher Dims (assuming 128)
            // If the mismatch error occurs, it's likely here.
            // We can't easily check FaceMatcher's internal dims, but we can catch the error.

            const match = faceMatcher.findBestMatch(desc);

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
        } catch (err: any) {
            console.error(`[FaceRec] Match Error for face: ${err.message}`);
            console.error(`[FaceRec] Descriptor Length: ${detection.descriptor.length}`);
            // Skip this face or return error?
            // If we skip, we might miss attendance, but better than crashing 500.
        }
    }

    return results;
}

export async function getDescriptor(imageBuffer: Buffer) {
    const api = await getFaceApi();
    await loadModels();

    const img = await canvas.loadImage(imageBuffer);
    const detection = await api.detectSingleFace(img as any)
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (!detection) {
        return null;
    }

    return Array.from(detection.descriptor);
}

// Helper to load image since we need 'canvas' package specific loadImage
