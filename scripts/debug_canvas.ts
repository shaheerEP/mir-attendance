
import * as canvasLib from 'canvas';
console.log('Canvas import:', canvasLib);
try {
    const { Canvas, Image, ImageData } = canvasLib;
    console.log('Canvas props:', { Canvas, Image, ImageData });
} catch (e) {
    console.error('Error destructuring canvas:', e);
}
