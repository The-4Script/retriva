import { ItemCategory, AIAnalysisResult, ItemReport } from "../types";
import { auth } from "./firebase";

// --- TYPES ---
export interface ComparisonResult {
  confidence: number;
  explanation: string;
  similarities: string[];
  differences: string[];
}

export interface MatchCandidate {
  id: string;
  confidence: number; // 0-100
  reason?: string;
}

// --- HELPER: MATCH TIER LOGIC ---
export const getMatchTier = (confidence: number) => {
  if (confidence >= 90) return { label: "Definitive Match", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800", iconName: 'ShieldCheck' };
  if (confidence >= 70) return { label: "Strong Candidate", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", iconName: 'Check' };
  if (confidence >= 40) return { label: "Potential Match", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800", iconName: 'HelpCircle' };
  return { label: "Unlikely Match", color: "text-slate-500 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-800", border: "border-slate-200 dark:border-slate-700", iconName: 'X' };
};

// --- HELPER: ROBUST JSON PARSER ---
const cleanJSON = (text: string): string => {
  if (!text) return "{}";
  
  // Remove <think>...</think> blocks (including their contents)
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  
  if (cleaned.includes("<think>") && !cleaned.includes("</think>")) {
      cleaned = cleaned.replace(/<think>/gi, "");
  }

  // Remove Markdown code blocks (case insensitive)
  cleaned = cleaned.replace(/```json/gi, "").replace(/```/g, "").trim();
  
  // Attempt to find the first valid JSON object or array
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  
  let start = -1;
  let end = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace;
      end = cleaned.lastIndexOf('}');
  } else if (firstBracket !== -1) {
      start = firstBracket;
      end = cleaned.lastIndexOf(']');
  }

  if (start !== -1 && end !== -1) {
      cleaned = cleaned.substring(start, end + 1);
  }
  
  return cleaned || "{}";
};

// --- HELPER: TEXT SIMILARITY (Jaccard Index) - Used for Fallback only ---
const calculateTextSimilarity = (str1: string, str2: string): number => {
    const set1 = new Set(str1.toLowerCase().split(/\W+/).filter(x => x.length > 2));
    const set2 = new Set(str2.toLowerCase().split(/\W+/).filter(x => x.length > 2));
    
    if (set1.size === 0 || set2.size === 0) return 0;
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
};

// --- HELPER: BACKEND AI WRAPPER ---
// The backend now does its own bounded, fast retry + a shared circuit breaker
// (see server.ts), so the client only needs ONE short retry for genuine transient
// issues (503, or a dropped connection). A 429 from the backend means the model
// cascade is already confirmed rate-limited server-side — retrying it here would
// just burn more time before the same fallback kicks in, so we skip straight
// to the caller's fallback path instead.
const callPuterAI = async (
  prompt: string,
  images?: string | string[],
  systemInstruction?: string,
  cascadeMode?: 'VISION' | 'TEXT' | 'TEXT_LIGHT',
  maxTokens?: number
): Promise<string | null> => {
  const MAX_RETRIES = 1;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : '';

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt,
          images,
          systemInstruction,
          cascadeMode,
          maxTokens
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[Backend AI Error - Attempt ${attempt + 1}]`, errText);

        // Only retry on 503 (transient) — a 429 means the backend already
        // exhausted its own retries and cascade, so retrying here is wasted time.
        if (response.status === 503 && attempt < MAX_RETRIES) {
          const delayMs = 1500 + Math.random() * 500;
          console.warn(`AI Provider Overloaded. Retrying once in ${Math.round(delayMs)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          attempt++;
          continue;
        }

        return null;
      }

      const data = await response.json();
      return data.result;

    } catch (error: any) {
      console.error(`[Backend API] Error on attempt ${attempt + 1}:`, error);
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        attempt++;
        continue;
      }
      return null;
    }
  }
  return null;
};

// --- FALLBACK LOGIC ---
const fallbackComparison = (item1: ItemReport, item2: ItemReport): ComparisonResult => {
     let score = 0;
     const sim = [];
     const diff = [];
     
     // 1. Category Check
     if (item1.category === item2.category) {
         score += 25;
         sim.push("Same Category");
     } else {
         diff.push(`Different Categories`);
     }
     
     // 2. Title Similarity
     const titleSim = calculateTextSimilarity(item1.title, item2.title);
     if (titleSim > 0.8) {
         score += 35;
         sim.push("Identical Titles");
     } else if (titleSim > 0.4) {
         score += 20;
         sim.push("Similar Titles");
     }

     // 3. Description Similarity
     const descSim = calculateTextSimilarity(item1.description, item2.description);
     if (descSim > 0.8) {
         score += 40;
         sim.push("Matching Description");
     } else if (descSim > 0.3) {
         score += 15 + (descSim * 20);
         sim.push("Shared Keywords");
     }

     return {
         confidence: Math.min(Math.round(score), 90),
         explanation: "AI Unavailable. Comparison based on text keywords.",
         similarities: sim,
         differences: diff
     };
};

// --- EXPORTED FEATURES (API) ---

export const findSmartMatches = async (sourceItem: ItemReport, allReports: ItemReport[], options?: { disableAI?: boolean }): Promise<{ report: ItemReport, confidence: number, isOffline: boolean }[]> => {
    
    // 1 & 2: Search only opposite type (halves the search space)
    const targetType = sourceItem.type === 'LOST' ? 'FOUND' : 'LOST';
    
    // 3 & 4: Reduce DB view using category filtering and active status
    let candidates = allReports.filter(r => 
        r.status === 'OPEN' && 
        r.type === targetType &&
        r.id !== sourceItem.id &&
        r.category === sourceItem.category // STRICT CATEGORY FILTERING
    );

    if (candidates.length === 0) return [];

    // Helper to extract keywords from title, description, tags, and specs
    const getKeywords = (item: ItemReport) => {
        const text = `${item.title} ${item.description} ${(item.tags || []).join(' ')} ${Object.values(item.specs || {}).join(' ')}`;
        return new Set(text.toLowerCase().split(/\W+/).filter(x => x.length > 2));
    };
    
    const sourceKeywords = getKeywords(sourceItem);

    // 5 & 12: No AI used. Only database queries and heuristic keyword matching.
    const scoredCandidates = candidates.map(c => {
        let score = 0;
        
        // Base score for being in the same category and opposite type
        score += 30;

        // Keyword Overlap / Jaccard similarity (Up to 40 points)
        const cKeywords = getKeywords(c);
        if (sourceKeywords.size > 0 && cKeywords.size > 0) {
            const intersection = new Set([...sourceKeywords].filter(x => cKeywords.has(x)));
            const jaccard = intersection.size / new Set([...sourceKeywords, ...cKeywords]).size;
            // Boost exact keyword intersections
            score += (jaccard * 40);
        }

        // Location match (Up to 20 points)
        if (c.location && sourceItem.location && c.location.toLowerCase().trim() === sourceItem.location.toLowerCase().trim()) {
            score += 20;
        }

        // Recency / Time relevance (Up to 10 points - simplified as flat 10 for now)
        score += 10;

        return { 
            report: c, 
            confidence: Math.min(Math.round(score), 100), 
            isOffline: true 
        };
    });

    // 6: Limit the Potential Candidates to Top 5 candidates, ordered descending by score
    const topCandidates = scoredCandidates
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);

    // Only return candidates with a minimal baseline threshold
    return topCandidates.filter(c => c.confidence > 35);
};

export interface SmartReportResult {
  security: {
    isViolation: boolean;
    violationType: 'GORE' | 'ANIMAL' | 'HUMAN_PORTRAIT' | 'IRRELEVANT' | 'NONE';
    reason: string;
    isPrank: boolean;
  };
  redactionRegions: number[][]; // [ymin, xmin, ymax, xmax]
  visualInsights: {
    category: ItemCategory;
    color: string;
    tags: string[];
    specs: Record<string, string>;
  };
  suggestedTitle: string;
  suggestedDescription: string;
  crossCheckFeedback: string;
}

export const generateSmartReport = async (
  base64Images: string[] | undefined,
  userTitle: string,
  userDescription: string
): Promise<SmartReportResult> => {
  try {
    // Trimmed to keep instruction-token cost down (same schema/behavior as before,
    // just less prose) — vision calls are the most rate-limit-constrained path.
    const prompt = `
      Lost & Found vision AI. Analyze the image(s).
      User title: "${userTitle}" | User description: "${userDescription}"

      1. SECURITY: flag violence/gore, live animals (plants ok), human portraits/selfies, or prank/nonsense images.
      2. VISUAL ANALYSIS: color, category, brand/model specs, visual tags.
      3. DESCRIPTION: write one detailed, factual description merging user input + visual analysis (material, exact colors, marks, brand, condition, unique identifiers) — this is used for later AI matching, so be specific. Suggest a short clean title.
      4. CROSS-CHECK: if the image contradicts the user's text (e.g. "Blue Laptop" but it's a red backpack), note it in crossCheckFeedback.

      Category MUST be exactly one of: Electronics, Stationery, Clothing, Accessories, ID Cards, Books, Bags & Wallets, Keys & Tools, Bottles & Containers, Sports Equipment, Other.

      Return ONLY this JSON:
      {
        "security": { "isViolation": boolean, "violationType": "GORE"|"ANIMAL"|"HUMAN_PORTRAIT"|"IRRELEVANT"|"NONE", "reason": "String", "isPrank": boolean },
        "visualInsights": { "category": "String", "color": "String", "tags": ["tag1","tag2"], "specs": { "key": "value" } },
        "suggestedTitle": "String",
        "suggestedDescription": "String (detailed, factual, covers physical attributes/brand/colors/marks)",
        "crossCheckFeedback": "String or empty if consistent"
      }
    `;

    const text = await callPuterAI(prompt, base64Images, undefined, 'VISION', 900);
    if (!text) throw new Error("No response from AI");

    const parsed = JSON.parse(cleanJSON(text));
    
    // Ensure category maps to our enum correctly
    const validCategories = Object.values(ItemCategory) as string[];
    let cat = parsed.visualInsights?.category;
    if (!validCategories.includes(cat)) {
        cat = ItemCategory.OTHER;
    }

    return {
      security: {
        isViolation: parsed.security?.isViolation || false,
        violationType: parsed.security?.violationType || 'NONE',
        reason: parsed.security?.reason || '',
        isPrank: parsed.security?.isPrank || false
      },
      redactionRegions: parsed.redactionRegions || [],
      visualInsights: {
        category: cat as ItemCategory,
        color: parsed.visualInsights?.color || '',
        tags: parsed.visualInsights?.tags || [],
        specs: parsed.visualInsights?.specs || {}
      },
      suggestedTitle: parsed.suggestedTitle || userTitle,
      suggestedDescription: parsed.suggestedDescription || userDescription,
      crossCheckFeedback: parsed.crossCheckFeedback || ''
    };
  } catch (e) {
    console.error("[God Prompt Error]", e);
    // Safe fallback
    return {
      security: { isViolation: false, violationType: 'NONE', reason: '', isPrank: false },
      redactionRegions: [],
      visualInsights: { category: ItemCategory.OTHER, color: '', tags: [], specs: {} },
      suggestedTitle: userTitle,
      suggestedDescription: userDescription,
      crossCheckFeedback: "AI Analysis unavailable. Proceeding with user input."
    };
  }
};

export const parseSearchQuery = async (query: string): Promise<{ userStatus: 'LOST' | 'FOUND' | 'UNKNOWN', refinedQuery: string }> => {
    try {
        // Trivial classification task — route straight to the smaller, higher-quota
        // text model instead of competing for the same budget as the heavier tasks.
        const text = await callPuterAI(
          `Analyze query: "${query}". Return JSON { "userStatus": "LOST"|"FOUND"|"UNKNOWN", "refinedQuery": "keywords" }`,
          undefined,
          undefined,
          'TEXT_LIGHT',
          120
        );
        
        if (!text) throw new Error("No text");
        const result = JSON.parse(cleanJSON(text));
        return { userStatus: result.userStatus || 'UNKNOWN', refinedQuery: result.refinedQuery || query };
    } catch (e) {
        return { userStatus: 'UNKNOWN', refinedQuery: query };
    }
};

export const compareItems = async (item1: ItemReport, item2: ItemReport): Promise<ComparisonResult> => {
    try {
        // Collect images from both items for visual comparison
        const imagesToAnalyze: string[] = [];
        if (item1.imageUrls?.[0]) imagesToAnalyze.push(item1.imageUrls[0]);
        if (item2.imageUrls?.[0]) imagesToAnalyze.push(item2.imageUrls[0]);

        // Tightened: same schema/scoring rules as before, less padding.
        const prompt = `
           Lost & Found Verification Specialist. Determine if Item A (${item1.type}) and Item B (${item2.type}) are the SAME PHYSICAL OBJECT.

           [A] Title: "${item1.title}" | Desc: "${item1.description}" | Category: "${item1.category}" | Specs: ${JSON.stringify(item1.specs || {})} | Tags: "${(item1.tags || []).join(', ')}"
           [B] Title: "${item2.title}" | Desc: "${item2.description}" | Category: "${item2.category}" | Specs: ${JSON.stringify(item2.specs || {})} | Tags: "${(item2.tags || []).join(', ')}"
           ${imagesToAnalyze.length} image(s) attached.

           RULES:
           - Don't treat lighting/angle/description-accuracy differences as physical mismatches.
           - Focus on brands, logos, models, unique scratches/stickers/wear.
           - A mismatch is only valid if it proves a DIFFERENT object (different brand/shape/feature count).
           - Reason using all fields, not just images.

           SCORING: 95-100 definitive (matching serial/unique wear) · 80-94 high probability (identical make/model/color, no contradictions) · 50-79 plausible (same generic type+color, vague details) · 0-49 mismatch.

           Return ONLY this JSON:
           { "confidence": number(0-100), "explanation": "verdict + reasoning", "similarities": ["pros"], "differences": ["cons"] }
        `;

        // Pass array of images (1 or 2 images) to the AI. Output is short (a verdict
        // + a few list items), so a smaller token budget than generateSmartReport is enough.
        const text = await callPuterAI(prompt, imagesToAnalyze.length > 0 ? imagesToAnalyze : undefined, undefined, 'VISION', 600);

        if (!text) throw new Error("No response");
        
        const cleanedText = cleanJSON(text);
        let result;
        
        try {
            result = JSON.parse(cleanedText);
        } catch (parseError: any) {
            try {
                const sanitized = cleanedText.replace(/[\x00-\x1F]/g, " ");
                result = JSON.parse(sanitized);
            } catch (fallbackParseError) {
                console.warn("AI returned invalid JSON:", text);
                throw new Error("Invalid JSON from AI");
            }
        }

        if (!result || typeof result.confidence !== "number") {
             throw new Error("Missing confidence in AI result");
        }
        
        // --- SCORE NORMALIZATION LOGIC ---
        let conf = result.confidence;
        
        // Handle decimal (0.95 -> 95) just in case
        if (conf > 0 && conf < 1) {
             conf = conf * 100;
        }
        
        // Ensure integer
        conf = Math.round(conf);
        
        // Safety cap
        if (conf > 100) conf = 100;
        if (conf < 0) conf = 0;

        return {
            ...result,
            confidence: conf
        };

    } catch (e) {
        console.error("AI Compare Failed, using fallback:", e);
        return fallbackComparison(item1, item2);
    }
};
