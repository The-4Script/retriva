const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
    'if (modelName === "llama-3.2-11b-vision-preview") {\n                } else {\n                }',
    'if (modelName === "llama-3.2-11b-vision-preview") {\n                    groqParams = { temperature: 0.6, max_completion_tokens: 2048, top_p: 0.95 };\n                } else {\n                    groqParams = { temperature: 1, max_completion_tokens: 2048, top_p: 1 };\n                }'
);

fs.writeFileSync('server.ts', code);
