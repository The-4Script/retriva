import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
ai.models.generateContent({ model: "gemini-3.5-flash-lite", contents: "Hello" }).then(r => console.log("SUCCESS:", r.text.trim())).catch(e => console.error("ERROR:", e.message));
