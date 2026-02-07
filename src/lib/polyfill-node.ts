// Polyfill for face-api.js environment detection in Vercel/Next.js
// This must be imported BEFORE face-api.js

import * as canvas from 'canvas';

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
