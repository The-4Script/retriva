const https = require('https');
require('dotenv').config();

const req = https.request('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log("Response:", data));
});

req.write(JSON.stringify({
  model: 'qwen/qwen3.8-27b',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'What is this?' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAGBAQABPxA=' } }
    ]
  }]
}));
req.end();
