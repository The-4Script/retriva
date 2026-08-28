import "dotenv/config";
import express from "express";
import path from "path";
import { createHash } from "crypto";
import { initializeApp, cert, type Credential } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// FIREBASE ADMIN INIT
// ---------------------------------------------------------------------------
// FIREBASE_PROJECT_ID must be set to the SAME project as VITE_FIREBASE_PROJECT_ID.
// If it's missing/wrong, verifyIdToken() will reject every valid client token
// (audience mismatch) and every /api/ai/chat call will 401 regardless of Groq.
// We fail fast at boot instead of silently falling back to a placeholder ID.
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
if (!FIREBASE_PROJECT_ID) {
  throw new Error(
    "FATAL: FIREBASE_PROJECT_ID env var is not set. This must match VITE_FIREBASE_PROJECT_ID " +
    "or every AI/auth request will fail with 401. Set it in your Vercel project's Environment Variables."
  );
}

// Optional: a real service-account key unlocks Firestore ADMIN writes (persistent AI
// cache, rate-limit circuit breaker, and the /api/offline presence route). Without it,
// verifyIdToken() still works fine (it only needs the project ID), but any Firestore
// admin write will fail — which we handle gracefully everywhere below (fail-open).
// Accepts either raw JSON or base64-encoded JSON in FIREBASE_SERVICE_ACCOUNT_KEY.
let credential: Credential | undefined;
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    const jsonStr = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8");
    credential = cert(JSON.parse(jsonStr));
    console.log("[Firebase Admin] Loaded service account credential — Firestore admin writes enabled.");
  } catch (e: any) {
    console.error("[Firebase Admin] FIREBASE_SERVICE_ACCOUNT_KEY is set but invalid JSON:", e.message);
  }
} else {
  console.warn(
    "[Firebase Admin] No FIREBASE_SERVICE_ACCOUNT_KEY set. Auth token verification still works, " +
    "but persistent AI caching, the rate-limit circuit breaker, and /api/offline presence writes " +
    "will be silently skipped (not fatal, just less efficient)."
  );
}

initializeApp({ projectId: FIREBASE_PROJECT_ID, ...(credential ? { credential } : {}) });

// Lazily resolve Firestore only when needed, and never let it crash a request path.
let _db: Firestore | null = null;
const tryGetDb = (): Firestore | null => {
  if (!credential) return null; // no point trying without real credentials
  if (!_db) {
    try {
      _db = getFirestore();
    } catch {
      return null;
    }
  }
  return _db;
};

// ---------------------------------------------------------------------------
// CACHE + CIRCUIT BREAKER (two layers: fast in-memory L1, persistent Firestore L2)
// ---------------------------------------------------------------------------
// L1 covers repeat calls within the same warm serverless instance (free, instant).
// L2 covers repeat calls across DIFFERENT instances/cold starts, which is the
// common case on Vercel — this is what actually saves Groq quota in production.
// Both layers fail OPEN: any Firestore error just means "treat as cache miss",
// never a broken request.

type AiMode = "VISION" | "TEXT" | "TEXT_LIGHT";

const memoryCache = new Map<string, { result: string; timestamp: number }>();
const MEMORY_CACHE_MAX = 200;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days — matches are effectively static

const buildCacheKey = (mode: AiMode, prompt: string, images: string[] | undefined, systemInstruction?: string) => {
  // Keyed by MEANING of the request, not by which model answered it — a cache hit
  // is valid no matter which model in the cascade would have served it.
  const imageSig = (images || []).map(i => `${i.length}:${i.slice(-64)}`).join("|");
  const raw = `${mode}::${systemInstruction || ""}::${prompt}::${imageSig}`;
  return createHash("sha256").update(raw).digest("hex");
};

const readCache = async (key: string): Promise<string | null> => {
  const mem = memoryCache.get(key);
  if (mem && Date.now() - mem.timestamp < CACHE_TTL_MS) return mem.result;

  const db = tryGetDb();
  if (!db) return null;
  try {
    const snap = await db.collection("ai_cache").doc(key).get();
    if (snap.exists) {
      const data = snap.data()!;
      if (Date.now() - data.timestamp < CACHE_TTL_MS) {
        memoryCache.set(key, { result: data.result, timestamp: data.timestamp });
        return data.result as string;
      }
    }
  } catch (e: any) {
    console.warn("[AI Cache] Firestore read failed, treating as miss:", e.message);
  }
  return null;
};

const writeCache = async (key: string, result: string) => {
  if (memoryCache.size > MEMORY_CACHE_MAX) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  memoryCache.set(key, { result, timestamp: Date.now() });

  const db = tryGetDb();
  if (!db) return;
  try {
    await db.collection("ai_cache").doc(key).set({ result, timestamp: Date.now() });
  } catch (e: any) {
    console.warn("[AI Cache] Firestore write failed (non-fatal):", e.message);
  }
};

// Circuit breaker: once a mode's models are genuinely exhausted (429s all around),
// stop hammering Groq for a short cooldown window and fail fast instead — this is
// both faster for the user (instant fallback vs. a long doomed retry chain) and
// directly reduces wasted AI workload during a rate-limit window.
const COOLDOWN_MS = 15000;
const cooldownMemory = new Map<AiMode, number>();

const isInCooldown = async (mode: AiMode): Promise<boolean> => {
  const mem = cooldownMemory.get(mode);
  if (mem && mem > Date.now()) return true;

  const db = tryGetDb();
  if (!db) return false;
  try {
    const snap = await db.collection("ai_meta").doc(`cooldown_${mode}`).get();
    const until = snap.exists ? (snap.data()!.until as number) : 0;
    if (until > Date.now()) {
      cooldownMemory.set(mode, until);
      return true;
    }
  } catch (e: any) {
    console.warn("[Circuit Breaker] Firestore read failed, assuming no cooldown:", e.message);
  }
  return false;
};

const triggerCooldown = async (mode: AiMode) => {
  const until = Date.now() + COOLDOWN_MS;
  cooldownMemory.set(mode, until);
  const db = tryGetDb();
  if (!db) return;
  try {
    await db.collection("ai_meta").doc(`cooldown_${mode}`).set({ until });
  } catch (e: any) {
    console.warn("[Circuit Breaker] Firestore write failed (non-fatal):", e.message);
  }
};

// ---------------------------------------------------------------------------
// GROQ CALL
// ---------------------------------------------------------------------------
class RateLimitedError extends Error {
  isRateLimit = true;
  constructor(msg: string) {
    super(msg);
  }
}

const runGroqTask = async (
  modelName: string,
  prompt: string,
  images: string[] | undefined,
  systemInstruction: string | undefined,
  maxTokens: number,
  deadline: number
) => {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error("GROQ_API_KEY missing");

  let contentPayload: any = prompt;
  if (images && images.length > 0) {
    contentPayload = [{ type: "text", text: prompt }];
    for (const img of images) {
      let url = img;
      if (url.startsWith("data:")) {
        // Groq's vision models require public URLs, not inline base64. The frontend
        // always uploads to Cloudinary before calling here, so this should never
        // trigger in practice — but if it ever does, skip loudly rather than silently.
        console.warn("[Groq] Dropping a base64 image — Groq vision requires a URL, not inline data.");
        continue;
      }
      if (url.startsWith("http")) {
        // Aggressively downscale for the AI payload specifically (display quality
        // elsewhere in the app is untouched — this transform only applies here).
        if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
          url = url.replace("/upload/", "/upload/w_384,c_limit,q_50/");
        }
      }
      contentPayload.push({ type: "image_url", image_url: { url } });
    }
  }

  const messages: any[] = [];
  if (systemInstruction) messages.push({ role: "system", content: systemInstruction });
  messages.push({ role: "user", content: contentPayload });

  const body = {
    model: modelName,
    messages,
    stream: false,
    temperature: 0.6,
    max_tokens: maxTokens,
    top_p: 0.95,
  };

  console.log(`[Groq] -> ${modelName} | prompt=${prompt.length}ch images=${images?.length || 0} maxTokens=${maxTokens}`);

  const maxAttempts = 2; // kept small on purpose — see deadline note below
  let attempts = 0;

  while (attempts < maxAttempts) {
    if (Date.now() >= deadline) {
      throw new RateLimitedError(`Deadline exceeded before ${modelName} could complete`);
    }
    attempts++;
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      const errText = await res.text();
      const waitMatch = errText.match(/try again in ([\d.]+)s/);
      // Short, bounded backoff — long waits are what caused Vercel's own function
      // timeout to kill requests before Groq's real answer ever came back.
      let waitMs = waitMatch?.[1] ? parseFloat(waitMatch[1]) * 1000 : 2000 * attempts;
      waitMs = Math.min(Math.max(waitMs, 1500), 6000) + Math.random() * 500;

      if (Date.now() + waitMs >= deadline || attempts >= maxAttempts) {
        throw new RateLimitedError(`Groq 429 for ${modelName}, retries exhausted`);
      }
      console.warn(`[Groq] 429 on ${modelName}, retrying in ${Math.round(waitMs)}ms (attempt ${attempts}/${maxAttempts})`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq Error (${modelName}): ${res.status} ${err.slice(0, 300)}`);
    }

    const data = await res.json();
    return data.choices[0].message.content as string;
  }

  throw new RateLimitedError(`Groq Error (${modelName}): max retries exceeded`);
};

const MODE_MODELS: Record<AiMode, string[]> = {
  VISION: ["qwen/qwen3.8-27b", "qwen/qwen3.6-27b"],
  TEXT: ["openai/gpt-oss-120b", "openai/gpt-oss-20b"],
  // Cheap classification-style tasks (e.g. search-query parsing) go straight to the
  // smaller, higher-quota model instead of competing for the same budget as the
  // heavier reasoning tasks.
  TEXT_LIGHT: ["openai/gpt-oss-20b"],
};

const MODE_DEFAULT_MAX_TOKENS: Record<AiMode, number> = {
  VISION: 900,
  TEXT: 400,
  TEXT_LIGHT: 150,
};

export const runWithCascade = async (
  prompt: string,
  images?: string[],
  systemInstruction?: string,
  cascadeMode?: AiMode,
  maxTokensOverride?: number
) => {
  const mode: AiMode = cascadeMode || (images && images.length > 0 ? "VISION" : "TEXT");
  const maxTokens = Math.min(maxTokensOverride || MODE_DEFAULT_MAX_TOKENS[mode], 1200);

  const cacheKey = buildCacheKey(mode, prompt, images, systemInstruction);
  const cached = await readCache(cacheKey);
  if (cached) {
    console.log(`[AI Cache] Hit for ${mode} request — Groq call skipped entirely.`);
    return cached;
  }

  if (await isInCooldown(mode)) {
    throw new RateLimitedError(`${mode} models are in a short cooldown after recent rate limiting — try again shortly.`);
  }

  // Hard wall-clock budget so we always return well inside Vercel's function
  // timeout, even in pathological cases (slow Groq + multiple 429s).
  const deadline = Date.now() + 45000;

  const modelsToTry = MODE_MODELS[mode];
  let lastError: any = null;
  let anyRateLimit = false;

  for (const model of modelsToTry) {
    if (Date.now() >= deadline) break;
    try {
      const result = await runGroqTask(model, prompt, images, systemInstruction, maxTokens, deadline);
      await writeCache(cacheKey, result);
      return result;
    } catch (err: any) {
      lastError = err;
      if (err?.isRateLimit) anyRateLimit = true;
      console.warn(`[Cascade] ${model} failed (${mode}):`, err.message);
      continue;
    }
  }

  if (anyRateLimit) {
    await triggerCooldown(mode);
    throw new RateLimitedError(`All ${mode} models rate-limited. Last error: ${lastError?.message || "unknown"}`);
  }

  throw new Error(`All ${mode} models failed. Last error: ${lastError?.message || "unknown"}`);
};

// ---------------------------------------------------------------------------
// EXPRESS APP
// ---------------------------------------------------------------------------
export const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.text({ type: "text/plain" }));

app.post("/api/offline", async (req, res) => {
  try {
    let uid = req.body?.uid;
    if (!uid && typeof req.body === "string") {
      try {
        uid = JSON.parse(req.body).uid;
      } catch {}
    }
    if (!uid) return res.status(400).json({ error: "Missing uid" });

    const db = tryGetDb();
    if (!db) {
      // No service-account credential configured — degrade silently rather than
      // 500ing on every tab-close. Presence is a nice-to-have, not core to the app.
      return res.json({ success: false, skipped: true });
    }
    await db.collection("users").doc(uid).set({ isOnline: false, lastSeen: Date.now() }, { merge: true });
    res.json({ success: true });
  } catch (e: any) {
    console.error("/api/offline error:", e);
    res.status(500).json({ error: "Internal error" });
  }
});

app.post("/api/ai/chat", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      await getAuth().verifyIdToken(idToken);
    } catch (authError: any) {
      console.warn("[Auth] Token validation failed:", authError.message);
      return res.status(401).json({ error: "Unauthorized / Invalid Token" });
    }

    const { systemInstruction, prompt, images, cascadeMode, maxTokens } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const imageArray = images ? (Array.isArray(images) ? images : [images]) : undefined;
    const resultText = await runWithCascade(prompt, imageArray, systemInstruction, cascadeMode, maxTokens);
    return res.json({ result: resultText });
  } catch (error: any) {
    console.error("[AI Chat Error]", error.message);
    if (error?.isRateLimit) {
      return res.status(429).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  const PORT = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === "production" || !!(process.argv[1] && process.argv[1].endsWith("server.cjs"));

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true, allowedHosts: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}
