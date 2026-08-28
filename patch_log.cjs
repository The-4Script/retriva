const fs = require('fs');
const src = fs.readFileSync('server.ts', 'utf-8');
const replaced = src.replace(
    'const body = {',
    `console.log("GROQ REQUEST BODY:", JSON.stringify({model: modelName, messages}, null, 2));\n   const body = {`
);
fs.writeFileSync('server.ts', replaced);
