
require('dotenv').config({ path: '.env.local' });
const path = require('path');
const fs = require('fs');

// Patch environment BEFORE importing face-recognition
const canvas = require('canvas');
const { Canvas, Image, ImageData } = canvas;
global.Canvas = Canvas;
global.Image = Image;
global.ImageData = ImageData;

import { recognizeFace, loadModels } from '../src/lib/face-recognition';

async function test() {
    try {
        console.log("Starting Test...");
        await loadModels();
        console.log("Models Loaded.");

        const c = new Canvas(640, 480);
        const ctx = c.getContext('2d');
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, 640, 480);

        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.arc(320, 240, 50, 0, 2 * Math.PI);
        ctx.stroke();

        const buffer = c.toBuffer('image/jpeg');
        console.log("Created test image buffer.");

        const results = await recognizeFace(buffer);
        console.log("Recognition Results:", results);

    } catch (error) {
        console.error("Test Failed:", error);
    }
}

test();
