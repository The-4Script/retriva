import "dotenv/config";
import express from "express";
import path from "path";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin for token verification
initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0746267232"
});

// Simple Request Queue to prevent burst TPM spikes
class RequestQueue {
    private queue: (() => Promise<void>)[] = [];
    private isProcessing = false;

    async add<T>(task: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const res = await task();
                    resolve(res);
                } catch (e) {
                    reject(e);
                }
            });
            if (!this.isProcessing) this.process();
        });
    }

    private async process() {
        this.isProcessing = true;
        while (this.queue.length > 0) {
            const task = this.queue.shift();
            if (task) await task();
            await new Promise(r => setTimeout(r, 1500)); // Minimum 1.5s delay between ANY Groq calls
        }
        this.isProcessing = false;
    }
}
const groqQueue = new RequestQueue();
const requestCache = new Map<string, { result: string, timestamp: number }>();

const runGroqTask = async (modelName: string, prompt: string, images?: string[], systemInstruction?: string) => {
   const groqKey = process.env.GROQ_API_KEY;
   if (!groqKey) throw new Error("GROQ_API_KEY missing");

   let contentPayload: any = prompt;
   if (images && images.length > 0) {
      contentPayload = [ { type: "text", text: prompt } ];
      for (const img of images) {
          let url = img;
          if (img.startsWith('http')) {
              try {
                  // Downscale Cloudinary images aggressively to save AI tokens (512x512, 60% quality)
                  let fetchUrl = img;
                  if (fetchUrl.includes('res.cloudinary.com') && fetchUrl.includes('/upload/')) {
                      fetchUrl = fetchUrl.replace('/upload/', '/upload/w_512,c_limit,q_60/');
                  }
                  
                  const fetchRes = await fetch(fetchUrl);
                  if (fetchRes.ok) {
                      const arrayBuffer = await fetchRes.arrayBuffer();
                      const buffer = Buffer.from(arrayBuffer);
                      const mimeType = fetchRes.headers.get('content-type') || 'image/jpeg';
                      url = `data:${mimeType};base64,${buffer.toString('base64')}`;
                  }
              } catch (e) {
                  console.warn("Failed to fetch image on server", e);
              }
          } else if (!img.startsWith('data:')) {
              url = `data:image/jpeg;base64,${img.split(',')[1] || img}`;
          }
          contentPayload.push({ type: "image_url", image_url: { url } });
      }
   }

   const messages = [];
   if (systemInstruction) {
       messages.push({ role: "system", content: systemInstruction });
   }
   messages.push({ role: "user", content: contentPayload });

   let groqParams: any = {};
   if (modelName === "qwen/qwen3.8-27b") {
       groqParams = {
          temperature: 0.6,
          max_completion_tokens: 2048,
          top_p: 0.95,
          reasoning_effort: "default",
       };
   } else if (modelName === "openai/gpt-oss-120b" || modelName === "openai/gpt-oss-20b") {
       groqParams = {
          temperature: 1,
          max_completion_tokens: 2048,
          top_p: 1,
          reasoning_effort: "medium",
       };
   }

   const body = {
      model: modelName,
      messages: messages,
      stream: false, 
      ...groqParams
   };

   let attempts = 0;
   const maxAttempts = 4;
   
   while (attempts < maxAttempts) {
       attempts++;
       const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
             "Authorization": `Bearer ${groqKey}`,
             "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
       });

       if (res.status === 429) {
           const errText = await res.text();
           const waitMatch = errText.match(/try again in ([\d.]+)s/);
           let waitMs = 12000; // default 12s backoff
           
           if (waitMatch && waitMatch[1]) {
               waitMs = Math.max(parseFloat(waitMatch[1]) * 1000, 11000) + Math.random() * 2000;
           } else {
               waitMs = Math.max(Math.pow(2, attempts) * 2500, 11000) + Math.random() * 2000;
           }
           
           console.warn(`[Groq Rate Limit] 429 hit for ${modelName}. Retrying in ${Math.round(waitMs)}ms... (Attempt ${attempts}/${maxAttempts})`);
           await new Promise(r => setTimeout(r, waitMs));
           continue;
       }

       if (!res.ok) {
          const err = await res.text();
          throw new Error(`Groq Error (${modelName}): ${res.status} ${err}`);
       }
       
       const data = await res.json();
       return data.choices[0].message.content;
   }
   
   throw new Error(`Groq Error (${modelName}): Max retries exceeded for 429`);
};

const runGroq = async (modelName: string, prompt: string, images?: string[], systemInstruction?: string) => {
   // Caching layer to save tokens for identical requests
   // Hash image content instead of just length to avoid false cache hits
   const imageSig = images?.map(i => i.length + '_' + i.substring(i.length - 100)) || [];
   const cacheKey = JSON.stringify({ modelName, prompt, images: imageSig, systemInstruction });
   const cached = requestCache.get(cacheKey);
   
   if (cached && (Date.now() - cached.timestamp < 1000 * 60 * 60 * 24)) { // 24 hour cache for identical prompts
       console.log(`[Cache Hit] Serving from memory for ${modelName}`);
       return cached.result;
   }

   const result = await groqQueue.add(() => runGroqTask(modelName, prompt, images, systemInstruction));
   
   // Keep cache size bounded
   if (requestCache.size > 200) {
       const oldest = requestCache.keys().next().value;
       if (oldest) requestCache.delete(oldest);
   }
   requestCache.set(cacheKey, { result, timestamp: Date.now() });
   
   return result;
};

export const runWithCascade = async (prompt: string, images?: string[], systemInstruction?: string, cascadeMode?: 'VISION' | 'TEXT') => {
   const mode = cascadeMode || (images && images.length > 0 ? 'VISION' : 'TEXT');
   
   let modelsToTry: string[] = [];
   
   if (mode === 'VISION') {
      modelsToTry = [
         'qwen/qwen3.8-27b',
         'qwen/qwen3.6-27b'
      ];
   } else {
      modelsToTry = [
         'openai/gpt-oss-120b',
         'openai/gpt-oss-20b',
         'qwen/qwen3.8-27b'
      ];
   }

   let lastError = null;

   for (const model of modelsToTry) {
       try {
           console.log(`[Cascade] Attempting model: ${model} in ${mode} mode`);
           return await runGroq(model, prompt, images, systemInstruction);
       } catch (err: any) {
           console.warn(`[Cascade] ${model} failed:`, err.message);
           lastError = err;
           console.warn(`[Cascade] Failing over to next model...`);
           continue;
       }
   }
   
   const errMessage = lastError?.message || 'Unknown';
   
   try {
       await getFirestore().collection('aiIncidents').add({
           timestamp: Date.now(),
           mode: mode,
           message: "All Groq models failed. Last error: " + errMessage
       });
   } catch (e) {
       console.error("Failed to log aiIncident", e);
   }

   throw new Error("All Groq models failed. Last error: " + errMessage);
}

export const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ type: 'text/plain' }));

// API Routes
app.post("/api/offline", async (req, res) => {
   try {
      let uid = req.body?.uid;
      
      // Fallback for navigator.sendBeacon sending text/plain
      if (!uid && typeof req.body === 'string') {
          try {
              uid = JSON.parse(req.body).uid;
          } catch(e) {}
      }

      if (!uid) return res.status(400).json({ error: "Missing uid" });
      
      const adminDb = getFirestore();
      await adminDb.collection('users').doc(uid).set({
         isOnline: false,
         lastSeen: Date.now()
      }, { merge: true });
      
      res.json({ success: true });
   } catch (e) {
      console.error("/api/offline error:", e);
      res.status(500).json({ error: "Internal error" });
   }
});

app.post("/api/ai/chat", async (req, res) => {
  try {
    // Basic auth check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
       return res.status(401).json({ error: "Unauthorized" });
    }
    
    const idToken = authHeader.split("Bearer ")[1];
    try {
       await getAuth().verifyIdToken(idToken);
    } catch (authError: any) {
       console.warn("[Auth Warning] Token validation issue on serverless", authError.message);
       return res.status(401).json({ error: "Unauthorized / Invalid Token" });
    }
    
    const { systemInstruction, prompt, images, cascadeMode } = req.body;
    
    if (prompt) {
        // Direct generation call
        const imageArray = images ? (Array.isArray(images) ? images : [images]) : undefined;
        const resultText = await runWithCascade(prompt, imageArray, systemInstruction, cascadeMode);
        return res.json({ result: resultText });
    } else {
        return res.status(400).json({ error: "Missing prompt" });
    }
  } catch (error: any) {
    console.error("[Groq API Error]", error);
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  const PORT = Number(process.env.PORT || 3000);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // For Express 5
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}