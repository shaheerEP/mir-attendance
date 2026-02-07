
const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const faceApiRoot = path.join(projectRoot, 'node_modules', 'face-api.js');

const filesToPatch = [
    path.join(faceApiRoot, 'build', 'commonjs', 'env', 'isNodejs.js'),
    path.join(faceApiRoot, 'build', 'es6', 'env', 'isNodejs.js'),
    path.join(faceApiRoot, 'dist', 'face-api.js'), // Keep patching dist just in case
];

function patchFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let patched = false;

    // Patch for build/commonjs and build/es6
    if (filePath.endsWith('isNodejs.js')) {
        // Replacements for isNodejs function body
        const commonJsPattern = /function isNodejs\(\) \{[\s\S]*?\}/;
        const commonJsReplacement = 'function isNodejs() { return true; }';

        const es6Pattern = /export function isNodejs\(\) \{[\s\S]*?\}/;
        const es6Replacement = 'export function isNodejs() { return true; }';

        if (content.match(commonJsPattern)) {
            content = content.replace(commonJsPattern, commonJsReplacement);
            patched = true;
        } else if (content.match(es6Pattern)) {
            content = content.replace(es6Pattern, es6Replacement);
            patched = true;
        }
    }
    // Patch for dist/face-api.js (Global Bundle)
    else if (filePath.endsWith('face-api.js')) {
        const searchString = 'return "undefined"!=typeof process&&void 0!==process.versions&&void 0!==process.versions.node';
        const replaceString = 'return true;';

        if (content.includes(searchString)) {
            content = content.replace(searchString, replaceString);
            patched = true;
        }
    }

    if (patched) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Successfully patched: ${filePath}`);
    } else {
        console.log(`Already patched or pattern not found: ${filePath}`);
    }
}

console.log('Starting face-api.js patch...');
filesToPatch.forEach(patchFile);
console.log('Patch complete.');
