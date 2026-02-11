
const { Canvas } = require('canvas');
try {
    const canvas = new Canvas(200, 200);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 200, 200);
    console.log('Canvas created and drawn successfully.');
} catch (e) {
    console.error('Canvas Error:', e);
}
