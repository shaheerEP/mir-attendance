
import { loadModels } from '../src/lib/face-recognition';

async function main() {
    console.log('Starting test...');
    try {
        await loadModels();
        console.log('Models loaded successfully.');
    } catch (error) {
        console.error('Error loading models:', error);
    }
}

main();
