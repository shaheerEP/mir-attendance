
// Polyfill for face-api.js environment detection in Vercel/Next.js
// This must be imported BEFORE face-api.js

if (typeof process === 'undefined') {
    (global as any).process = { versions: { node: '18.17.0' } };
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

// Also ensure global.Buffer is available if missing (sometimes needed)
if (typeof Buffer === 'undefined') {
    (global as any).Buffer = require('buffer').Buffer;
}

console.log('[Polyfill] Node.js environment patched for face-api.js');
