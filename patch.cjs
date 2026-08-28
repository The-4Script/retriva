const fs = require('fs');

const code = `import "dotenv/config";
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
          if (url.startsWith('http')) {
              // Downscale Cloudinary images aggressively to save AI tokens
              if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
                  url = url.replace('/upload/', '/upload/w_512,c_limit,q_60/');
              }
          }
          // Pass the URL directly to Groq. Do not fetch and convert to base64.
          contentPayload.push({ type: "image_url", image_url: { url } });
      }
   }

   const messages = [];
   if (systemInstruction) {
       messages.push({ role: "system", content: systemInstruction });
   }
   messages.push({ role: "user", content: contentPayload });

   let groqParams: any = {};
   if (modelName === "qwen/qwen3.8-27b" || modelName === "qwen/qwen3.6-27b") {
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
             "Authorization": \`Bearer \${groqKey}\`,
             "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
       });

       if (res.status === 429) {
           const errText = await res.text();
           const waitMatch = errText.match(/try again in ([\\d.]+)s/);
           let waitMs = 12000; // default 12s backoff
           
           if (waitMatch && waitMatch[1]) {
               waitMs = Math.max(parseFloat(waitMatch[1]) * 1000, 11000) + Math.random() * 2000;
           } else {
               waitMs = Math.max(Math.pow(2, attempts) * 2500, 11000) + Math.random() * 2000;
           }
           
           console.warn(\`[Groq Rate Limit] 429 hit for \${modelName}. Retrying in \${Math.round(waitMs)}ms... (Attempt \${attempts}/\${maxAttempts})\`);
           await new Promise(r => setTimeout(r, waitMs));
           continue;
       }

       if (!res.ok) {
          const err = await res.text();
          throw new Error(\`Groq Error (\${modelName}): \${res.status} \${err}\`);
       }
       
       const data = await res.json();
       return data.choices[0].message.content;
   }
   
   throw new Error(\`Groq Error (\${modelName}): Max retries exceeded for 429\`);
};

const runGroq = async (modelName: string, prompt: string, images?: string[], systemInstruction?: string) => {
   const imageSig = images?.map(i => i.length + '_' + i.substring(i.length - 100)) || [];
   const cacheKey = JSON.stringify({ modelName, prompt, images: imageSig, systemInstruction });
   const cached = requestCache.get(cacheKey);
   
   if (cached && (Date.now() - cached.timestamp < 1000 * 60 * 60 * 24)) {
       console.log(\`[Cache Hit] Serving from memory for \${modelName}\`);
       return cached.result;
   }

   const result = await groqQueue.add(() => runGroqTask(modelName, prompt, images, systemInstruction));
   
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
         'openai/gpt-oss-20b'
      ];
   }

   let lastError = null;

   for (const model of modelsToTry) {
       try {
           console.log(\`[Cascade] Attempting model: \${model} in \${mode} mode\`);
           return await runGroq(model, prompt, images, systemInstruction);
       } catch (err: any) {
           console.warn(\`[Cascade] \${model} failed:\`, err.message);
           lastError = err;
           console.warn(\`[Cascade] Failing over to next model...\`);
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
`;

const src = fs.readFileSync('server.ts', 'utf-8');
const tail = src.substring(src.indexOf('export const app = express();'));
fs.writeFileSync('server.ts', code + '\n' + tail);
