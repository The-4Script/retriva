const fs = require('fs');
require('dotenv').config();

async function test() {
    const groqKey = process.env.GROQ_API_KEY;
    const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    // Create a 1x1 image blob
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", 'base64');
    const formData = new FormData();
    formData.append('file', new Blob([png], { type: 'image/png' }));
    formData.append('upload_preset', preset);

    const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData
    });
    
    if (!cloudinaryRes.ok) {
        console.error("Cloudinary failed", await cloudinaryRes.text());
        return;
    }
    const cloudinaryData = await cloudinaryRes.json();
    const url = cloudinaryData.secure_url;
    console.log("Cloudinary URL:", url);

    const body = {
        model: "qwen/qwen3.8-27b",
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: "What color is this?" },
                    { type: "image_url", image_url: { url } }
                ]
            }
        ]
    };
    
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${groqKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    console.log("Groq Status:", groqRes.status, await groqRes.text());
}
test();
