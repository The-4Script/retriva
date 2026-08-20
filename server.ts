import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import * as admin from "firebase-admin";

// Initialize Firebase Admin for token verification (relies on public keys, no service account needed)
admin.initializeApp({
  projectId: "gen-lang-client-0746267232"
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      // Basic auth check using the authorization header passed from the client
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
         return res.status(401).json({ error: "Unauthorized" });
      }
      
      const idToken = authHeader.split("Bearer ")[1];
      try {
         await admin.auth().verifyIdToken(idToken);
      } catch (authError) {
         console.warn("[Auth Warning] Invalid ID token provided", authError);
         return res.status(401).json({ error: "Unauthorized / Invalid Token" });
      }
      
      const { message, history, systemInstruction, model, prompt, images } = req.body;
      
      if (prompt) {
          // It's a direct generation call (from geminiService.ts)
          const contents = [];
          if (images) {
            const imageArray = Array.isArray(images) ? images : [images];
            for (const img of imageArray) {
              const base64Data = img.split(',')[1] || img;
              contents.push({ inlineData: { data: base64Data, mimeType: "image/jpeg" } });
            }
          }
          contents.push({ text: prompt });
    
          const response = await ai.models.generateContent({
            model: model || "gemini-3.7-flash",
            contents,
            config: systemInstruction ? { systemInstruction: systemInstruction } : undefined
          });
          
          return res.json({ result: response.text });
      } else {
          // It's a chat call (from AIAssistant.tsx)
          const chat = ai.chats.create({
            model: model || "gemini-3.7-flash",
            config: systemInstruction ? { systemInstruction } : undefined,
            history: history || []
          });
          
          const response = await chat.sendMessage({ message: message });
          
          return res.json({ result: response.text, history: await chat.getHistory() });
      }
    } catch (error: any) {
      console.error("[Gemini API Error]", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // For Express 4
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
