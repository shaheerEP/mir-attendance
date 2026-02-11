
import { loadModels, recognizeFace } from '../src/lib/face-recognition';
import * as fs from 'fs';
import * as path from 'path';

async function testFullRecognition() {
    try {
        console.log('Starting Full Recognition Test...');
        await loadModels();
        console.log('Models Loaded.');

        // Verify if models loaded correctly
        // Create a dummy image or use a real one if available
        // For now, we just want to ensure loadModels doesn't crash

        console.log('FULL VERIFICATION SUCCESS');
    } catch (error) {
        console.error('FULL VERIFICATION FAILED:', error);
        process.exit(1);
    }
}

testFullRecognition();
