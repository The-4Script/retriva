const fs = require('fs');
require('dotenv').config();

async function test() {
    const groqKey = process.env.GROQ_API_KEY;
    // create a simple 10x10 red jpeg base64
    const base64 = "/9j/4AAQSkZJRgABAQEASABIAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAEAAAAAAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAKAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAbEAADAAIDAAAAAAAAAAAAAAAAAQIDBAURIT/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8An6Ojo6AAAAA//9k=";
    const body = {
        model: "qwen/qwen3.8-27b",
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: "What color is this?" },
                    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }
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
