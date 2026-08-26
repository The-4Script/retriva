import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
ai.models.list().then(res => {
  for await (const m of res) {
     console.log(m.name);
  }
}).catch(console.error);
