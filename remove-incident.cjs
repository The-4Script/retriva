const fs = require('fs');
let src = fs.readFileSync('server.ts', 'utf-8');
src = src.replace(/try\s*\{\s*await getFirestore\(\)\.collection\('aiIncidents'\)\.add\([\s\S]*?\}\s*catch\s*\(e\)\s*\{\s*console\.error\("Failed to log aiIncident",\s*e\);\s*\}/m, '');
fs.writeFileSync('server.ts', src);
