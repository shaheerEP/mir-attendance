import './polyfill-node'; // Ensure environment is patched first
import { Canvas, Image, ImageData } from 'canvas';
import path from 'path';
import Student from '@/models/Student';
import Staff from '@/models/Staff';
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

    // 2. Load all students AND staff with descriptors
    await dbConnect();
    const students = await Student.find({ faceDescriptor: { $exists: true, $ne: [] } });
    const staffMembers = await Staff.find({ faceDescriptor: { $exists: true, $ne: [] } });

    if (students.length === 0 && staffMembers.length === 0) {
        console.log("[FaceRec] No subjects with descriptors found in DB.");
        return [];
    }

    // 3. Create Face Matcher with Labeled Descriptors
    const labeledDescriptors: any[] = [];

    // Add Students
    students.forEach(student => {
        labeledDescriptors.push(new api.LabeledFaceDescriptors(
            `student:${student._id.toString()}`, // Prefix to distinguish
            [new Float32Array((student.faceDescriptor || []) as any)]
        ));
    });

    // Add Staff
    staffMembers.forEach((staff: any) => {
        labeledDescriptors.push(new api.LabeledFaceDescriptors(
            `staff:${staff._id.toString()}`,
            [new Float32Array((staff.faceDescriptor || []) as any)]
        ));
    });

    const faceMatcher = new api.FaceMatcher(labeledDescriptors, 0.6);

    const results = [];

    // 4. Match Each Face
    for (const detection of detections) {
        const match = faceMatcher.findBestMatch(detection.descriptor);

        if (match.label !== 'unknown') {
            const [type, id] = match.label.split(':');

            if (type === 'student') {
                const matchedStudent = students.find(s => s._id.toString() === id);
                if (matchedStudent) {
                    results.push({
                        type: 'student',
                        studentId: id,
                        name: matchedStudent.name,
                        distance: match.distance
                    });
                }
            } else if (type === 'staff') {
                const matchedStaff = staffMembers.find((s: any) => s._id.toString() === id);
                if (matchedStaff) {
                    results.push({
                        type: 'staff',
                        staffId: id,
                        name: matchedStaff.name,
                        distance: match.distance
                    });
                }
            }
        } else {
            results.push({
                type: 'unknown',
                distance: match.distance
            });
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
