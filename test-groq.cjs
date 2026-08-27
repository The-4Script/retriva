const https = require('https');
require('dotenv').config();

const req = https.request('https://api.groq.com/openai/v1/models', {
  headers: {
    'Authorization': 'Bearer ' + process.env.GROQ_API_KEY
  }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log(JSON.parse(data).data.map(m => m.id)));
});
req.end();
