const fs = require('fs');
require('dotenv').config();

async function test() {
    const groqKey = process.env.GROQ_API_KEY;
    const body = {
        model: "qwen/qwen3.8-27b",
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: "What is this?" },
                    { type: "image_url", image_url: { url: `https://example.com/broken_image.jpg` } }
                ]
            }
        ]
    };
    
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${groqKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    console.log(res.status, await res.text());
}
test();
