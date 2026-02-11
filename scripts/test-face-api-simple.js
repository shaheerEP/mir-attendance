
const canvas = require('canvas');
const { Canvas, Image, ImageData } = canvas;
global.Canvas = Canvas;
global.Image = Image;
global.ImageData = ImageData;

const faceapi = require('face-api.js');
const path = require('path');

async function test() {
    try {
        console.log("Loading face-api.js...");
        // Check if monkeyPatch is needed/available
        if (faceapi.env && faceapi.env.monkeyPatch) {
            faceapi.env.monkeyPatch({ Canvas, Image, ImageData });
            console.log("MonkeyPatched.");
        }

        const MODELS_PATH = path.join(process.cwd(), 'public', 'models');
        console.log("Loading models from " + MODELS_PATH);

        await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_PATH);
        console.log("SSD MobileNet Loaded");

        await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH);
        console.log("Landmark Net Loaded");

        await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_PATH);
        console.log("Recognition Net Loaded");

        const c = new Canvas(640, 480);
        const ctx = c.getContext('2d');
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, 640, 480);

        const buffer = c.toBuffer('image/jpeg');
        const img = await canvas.loadImage(buffer);

        // Detection
        const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();
        console.log("Detections:", detections.length);

    } catch (e) {
        console.error("Error:", e);
    }
}

test();
