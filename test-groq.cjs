const fs = require('fs');
require('dotenv').config();

async function test() {
    const groqKey = process.env.GROQ_API_KEY;
    const body = {
        model: "qwen/qwen3.6-27b",
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: "What is this?" },
                    { type: "image_url", image_url: { url: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=" } }
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
