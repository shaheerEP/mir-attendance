import * as faceapi from 'face-api.js';
import { Canvas, Image, ImageData } from 'canvas';
import path from 'path';
import Student from '@/models/Student';
import dbConnect from '@/lib/db';

// Patch face-api.js for Node.js environment
faceapi.env.monkeyPatch({ Canvas: Canvas as any, Image: Image as any, ImageData: ImageData as any });

let modelsLoaded = false;

const MODELS_PATH = path.join(process.cwd(), 'public', 'models');

export async function loadModels() {
    if (modelsLoaded) return;

    console.log('[FaceRec] Loading models from:', MODELS_PATH);

    try {
        await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_PATH);
        await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH);
        await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_PATH);
        modelsLoaded = true;
        console.log('[FaceRec] Models loaded successfully');
    } catch (error) {
        console.error('[FaceRec] Error loading models:', error);
        throw error;
    }
}

export async function recognizeFace(imageBuffer: Buffer) {
    await loadModels();

    // 1. Detect ALL Faces in Image
    const img = await canvas.loadImage(imageBuffer);

    // Detect all faces
    const detections = await faceapi.detectAllFaces(img as any)
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
        return new faceapi.LabeledFaceDescriptors(
            student._id.toString(),
            [new Float32Array(student.faceDescriptor)]
        );
    });

    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);

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
import * as canvas from 'canvas';
