const body = {
  "messages": [{"role": "user","content": "Hi"}],
  "model": "openai/gpt-oss-120b",
  "temperature": 1,
  "max_completion_tokens": 2048,
  "top_p": 1,
  "stream": false,
  "reasoning_effort": "medium"
};
fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(body)
}).then(r => r.json()).then(console.log).catch(console.error);
