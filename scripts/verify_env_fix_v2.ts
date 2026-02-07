
// Simulate environment where process.versions.node is missing
if (process.versions) {
    try {
        // We can't actually delete it easily in strict mode or some envs, but let's try
        // Or we can redefine it
        Object.defineProperty(process.versions, 'node', { value: undefined, writable: true });
        console.log('Environment simulated: process.versions.node set to undefined');
    } catch (e) {
        console.warn('Could not modify process.versions.node:', e);
    }
}

async function main() {
    console.log('Importing face-recognition...');
    try {
        // Now face-recognition handles internal dynamic import
        const { loadModels, recognizeFace } = await import('../src/lib/face-recognition');

        console.log('Loading models...');
        await loadModels();
        console.log('SUCCESS: Models loaded successfully');
    } catch (error) {
        console.error('FAILURE:', error);
        process.exit(1);
    }
}

main();
