
// scripts/verify_env_fix_v2.ts
const canvas = require('canvas');

// 1. Force POlyfill FIRST
// @ts-ignore
const { Canvas, Image, ImageData } = canvas;
(global as any).Canvas = Canvas;
(global as any).Image = Image;
(global as any).ImageData = ImageData;
(global as any).HTMLCanvasElement = Canvas;
(global as any).HTMLImageElement = Image;

if (typeof process === 'undefined') {
    (global as any).process = { versions: { node: '18.17.0' }, env: {} };
} else {
    if (!process.versions) (process as any).versions = {};
    if (!process.versions.node) (process.versions as any).node = '18.17.0';
}

console.log('[Verify V2] Globals patched.');

async function test() {
    try {
        console.log('[Verify V2] Importing face-api.js...');
        // Emulate the dynamic import used in Next.js
        const faceapi = await import('face-api.js');

        console.log('[Verify V2] faceapi loaded.');

        if (!faceapi.env) {
            console.error('[Verify V2] faceapi.env is undefined!');
        } else {
            console.log('[Verify V2] Check isNodejs:', faceapi.env.isNodejs());
            console.log('[Verify V2] Check isBrowser:', faceapi.env.isBrowser());

            // Try enabling monkeyPatch
            try {
                if (faceapi.env.monkeyPatch) {
                    faceapi.env.monkeyPatch({
                        Canvas: canvas.Canvas,
                        Image: canvas.Image,
                        ImageData: canvas.ImageData
                    });
                    console.log('[Verify V2] MonkeyPatch success.');
                }
            } catch (e) {
                console.error('[Verify V2] MonkeyPatch ERROR:', e);
            }
        }

        // Try to create a tensor or load a net to see if env is accepted
        console.log('[Verify V2] Attempting to create a tensor...');
        const t = faceapi.tf.tensor([1, 2, 3]);
        console.log('[Verify V2] Tensor created:', t.shape);

    } catch (e) {
        console.error('[Verify V2] CRITICAL ERROR:', e);
    }
}

test();
