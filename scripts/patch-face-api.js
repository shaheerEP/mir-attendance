
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../node_modules/face-api.js/dist/face-api.js');

if (!fs.existsSync(filePath)) {
    console.error('face-api.js not found at:', filePath);
    process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// The string to find. Note: specific minification spacing is key.
// Based on file view: Ut.registerFlag("IS_NODE",(function(){return "undefined"!=typeof process&&void 0!==process.versions&&void 0!==process.versions.node}))
const searchString = 'return "undefined"!=typeof process&&void 0!==process.versions&&void 0!==process.versions.node';
const replaceString = 'return true; // Patched for Vercel';

if (content.includes(searchString)) {
    content = content.replace(searchString, replaceString);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully patched face-api.js for Node.js environment.');
} else {
    console.warn('Search string not found in face-api.js. It might be already patched or different version.');
    // Fallback search in case of slightly different minification?
    // Try regex if exact match fails?
    const regex = /Ut\.registerFlag\("IS_NODE",\(function\(\)\{return.*?\)\}\)/;
    if (regex.test(content)) {
        console.log('Found IS_NODE flag using regex, patching...');
        content = content.replace(regex, 'Ut.registerFlag("IS_NODE",(function(){return true}))');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Successfully patched face-api.js using regex.');
    } else {
        console.error('Could not find IS_NODE flag to patch.');
        // Print a snippet to debug
        const snippetIndex = content.indexOf('IS_NODE');
        if (snippetIndex !== -1) {
            console.log('Snippet around IS_NODE:', content.substring(snippetIndex - 50, snippetIndex + 100));
        }
        process.exit(1);
    }
}
