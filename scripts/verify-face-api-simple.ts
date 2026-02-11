
// Standalone script to verify face-api.js
// Run with: npx tsx scripts/verify-face-api-simple.ts

const path = require('path');
const fs = require('fs');

// 1. Mock Globals (Polyfill)
async function setupEnvironment() {
    console.log('Setting up environment...');
    const canvas = await import('canvas');
    const { Canvas, Image, ImageData } = canvas;
    global.Canvas = Canvas as any;
    global.Image = Image as any;
    global.ImageData = ImageData as any;
    global.HTMLCanvasElement = Canvas as any;
    global.HTMLImageElement = Image as any;
    console.log('Environment setup complete.');
    return { Canvas, Image, ImageData };
}

async function run() {
    try {
        const { Canvas, Image, ImageData } = await setupEnvironment();

        console.log('Importing face-api.js...');
        const faceapi = await import('face-api.js');

        // MonkeyPatch
        if (faceapi.env.monkeyPatch) {
            faceapi.env.monkeyPatch({
                Canvas: Canvas,
                Image: Image,
                ImageData: ImageData
            });
            console.log('MonkeyPatch successful.');
        }

        // Load Models
        const modelsPath = path.join(process.cwd(), 'public', 'models');
        console.log('Loading models from:', modelsPath);

        await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath);
        await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);
        await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);
        console.log('Models loaded successfully.');

        // Creates a black 100x100 image
        const canvasEl = new Canvas(100, 100);
        const ctx = canvasEl.getContext('2d');
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, 100, 100);

        console.log('Running detection on dummy image...');
        const detections = await faceapi.detectAllFaces(canvasEl as any)
            .withFaceLandmarks()
            .withFaceDescriptors();

        console.log('Detection complete. Faces found:', detections.length);
        console.log('SUCCESS: face-api.js is working correctly.');

    } catch (error) {
        console.error('FAILURE:', error);
        process.exit(1);
    }
}

run();
