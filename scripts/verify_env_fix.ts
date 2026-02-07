
// Simulate environment where process.versions.node is missing
delete (process.versions as any).node;
console.log('Environment simulated: process.versions.node deleted');

import { loadModels } from '../src/lib/face-recognition';

async function main() {
    try {
        await loadModels();
        console.log('SUCCESS: Models loaded successfully even without initial process.versions.node');
    } catch (error) {
        console.error('FAILURE: Error loading models:', error);
        process.exit(1);
    }
}

main();
