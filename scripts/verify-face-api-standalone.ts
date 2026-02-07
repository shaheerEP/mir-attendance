
// Scripts to verify if face-api.js loads correctly with our polyfill logic
const canvas = require('canvas');

// --- Polyfill Logic Start ---
// @ts-ignore
const { Canvas, Image, ImageData } = canvas;

// 1. Patch Global Scope with Canvas classes
(global as any).Canvas = Canvas;
(global as any).Image = Image;
(global as any).ImageData = ImageData;
(global as any).HTMLCanvasElement = Canvas;
(global as any).HTMLImageElement = Image;

// 2. Patch Process for Environment Detection
if (typeof process === 'undefined') {
    (global as any).process = { versions: { node: '18.17.0' }, env: {} };
} else {
    // Ensure process.versions exists
    if (!process.versions) {
        (process as any).versions = {};
    }
    // Ensure process.versions.node exists
    if (!process.versions.node) {
        (process.versions as any).node = '18.17.0';
    }
}

// 3. Patch Buffer
if (typeof Buffer === 'undefined') {
    (global as any).Buffer = require('buffer').Buffer;
}

console.log('[Polyfill] Node.js environment patched for face-api.js (Canvas, Image, ImageData, Process)');
// --- Polyfill Logic End ---

async function testFaceApiLoad() {
    try {
        console.log('Loading face-api.js...');
        const faceapi = require('face-api.js');

        console.log('Checking environment...');
        const env = faceapi.env;
        console.log('Environment defined:', !!env);

        if (env) {
            console.log('MonkeyPatch available:', !!env.monkeyPatch);
            if (env.monkeyPatch) {
                // Try patching
                env.monkeyPatch({
                    Canvas: canvas.Canvas,
                    Image: canvas.Image,
                    ImageData: canvas.ImageData
                });
                console.log('MonkeyPatch executed successfully.');
            }
        }

        console.log('SUCCESS: face-api.js loaded without environment error.');

    } catch (error) {
        console.error('FAILURE: ', error);
        process.exit(1); // Exit with error code
    }
}

testFaceApiLoad();
