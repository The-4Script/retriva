const https = require('http');

const req = https.request('http://localhost:3000/api/ai/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log("Response:", res.statusCode, data));
});

req.write(JSON.stringify({
  prompt: 'Return a simple matching json',
  cascadeMode: 'TEXT'
}));
req.end();
