
import * as faceapi from 'face-api.js';

console.log('Testing monkeyPatch...');
try {
    // Test with undefined properties
    faceapi.env.monkeyPatch({ Canvas: undefined, Image: undefined, ImageData: undefined });
    console.log('monkeyPatch with undefined props succeeded');
} catch (e: any) {
    console.error('monkeyPatch with undefined props failed:', e.message);
}

try {
    // Test with valid props (mocked)
    const mockCanvas = class { };
    const mockImage = class { };
    const mockImageData = class { };
    faceapi.env.monkeyPatch({ Canvas: mockCanvas as any, Image: mockImage as any, ImageData: mockImageData as any });
    console.log('monkeyPatch with mock props succeeded');
} catch (e: any) {
    console.error('monkeyPatch with mock props failed:', e.message);
}
