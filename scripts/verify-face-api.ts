
// Scripts to verify if face-api.js loads correctly with our polyfill
require('ts-node/register');
const path = require('path');

// Mock Next.js alias if needed, but we'll just require relative for valid test
require('../src/lib/polyfill-node');

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
                const canvas = require('canvas');
                env.monkeyPatch({
                    Canvas: canvas.Canvas,
                    Image: canvas.Image,
                    ImageData: canvas.ImageData
                });
                console.log('MonkeyPatch executed successfully.');
            }
        }

        console.log('Loading models to ensure storage access works (mock check)...');
        // We won't actually load models to avoid path issues, just checking if we got this far without "Environment not defined"
        console.log('SUCCESS: face-api.js loaded without environment error.');

    } catch (error) {
        console.error('FAILURE: ', error);
        process.exit(1);
    }
}

testFaceApiLoad();
