import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
ai.models.generateContent({ model: "gemini-3.7-flash", contents: "Hello" }).then(r => console.log("SUCCESS 3.7:", r.text)).catch(e => console.error("ERROR 3.7:", e.message));
