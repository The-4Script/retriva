import { ItemCategory, GeminiAnalysisResult, ItemReport } from "../types";
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
  // Remove Markdown code blocks (case insensitive)
  let cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  
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

  return cleaned;
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
// Updated to accept string array for images
const callPuterAI = async (
  prompt: string, 
  images?: string | string[], 
  systemInstruction?: string,
  cascadeMode?: 'VISION' | 'TEXT'
): Promise<string | null> => {
  try {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : '';
    
    const response = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        prompt,
        images,
        systemInstruction,
        cascadeMode
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Backend AI Error]", errText);
      return null;
    }

    const data = await response.json();
    return data.result;

  } catch (error: any) {
    console.error(`[Backend API] Error:`, error);
    return null;
  }
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

export const findSmartMatches = async (sourceItem: ItemReport, allReports: ItemReport[]): Promise<{ report: ItemReport, confidence: number, isOffline: boolean }[]> => {
    
    const targetType = sourceItem.type === 'LOST' ? 'FOUND' : 'LOST';
    
    let candidates = allReports.filter(r => 
        r.status === 'OPEN' && 
        r.type === targetType &&
        r.id !== sourceItem.id &&
        r.category === sourceItem.category // STRICT CATEGORY FILTERING (Offline Optimization)
    );

    if (candidates.length === 0) return [];

    // We limit candidates to top 10 by recency to save tokens
    if (candidates.length > 10) candidates = candidates.slice(0, 10);

    let matchResults: MatchCandidate[] = [];
    let usedAI = false;
    
    // Use FULL keys so AI understands context, including SPECS if available
    const aiCandidates = candidates.map(c => ({ 
        id: c.id, 
        title: c.title, 
        description: c.description,
        specs: c.specs || {}, // Pass structured data to AI
        location: c.location,
        category: c.category,
        visual_tags: c.tags.join(', ')
    }));

    const sourceData = `TITLE: ${sourceItem.title}. DESC: ${sourceItem.description}. CAT: ${sourceItem.category}. SPECS: ${JSON.stringify(sourceItem.specs || {})}. LOC: ${sourceItem.location}.`;

    try {
        const fullPrompt = `
          ACT AS A LOST & FOUND MATCHER.
          
          TARGET ITEM: ${sourceData}
          CANDIDATES DATABASE: ${JSON.stringify(aiCandidates)}
          
          INSTRUCTIONS:
          1. Analyze the semantic meaning AND specific specs (e.g. Serial numbers are definitive).
          2. Ignore minor category mismatches (e.g. Electronics vs Other).
          3. Return a JSON object with a list of matches that have a probability > 40%.
          
          JSON FORMAT: 
          { "matches": [ { "id": "candidate_id", "confidence": number } ] }
        `;
        
        const text = await callPuterAI(fullPrompt, undefined, undefined, 'TEXT');

        if (text) {
            const cleanText = cleanJSON(text);
            try {
                const data = JSON.parse(cleanText);
                matchResults = data.matches || [];
                usedAI = true;
            } catch (jsonErr) {
                 // Try aggressive cleanup for control characters
                 const sanitized = cleanText.replace(/[\x00-\x1F]/g, " ");
                 const data = JSON.parse(sanitized);
                 matchResults = data.matches || [];
                 usedAI = true;
            }
        }
    } catch (e) {
        console.error("[Gemini] Smart Match Logic Error:", e);
    }

    // Fallback
    if (!usedAI || matchResults.length === 0) {
        matchResults = candidates.map(c => {
            const titleSim = calculateTextSimilarity(sourceItem.title, c.title);
            const descSim = calculateTextSimilarity(sourceItem.description, c.description);
            let score = (titleSim * 50) + (descSim * 50);
            if (c.category === sourceItem.category) score += 10;
            return { id: c.id, confidence: Math.min(score, 100) };
        }).filter(m => m.confidence > 20);
    }

    const results = matchResults.map(m => {
        const report = candidates.find(c => c.id === m.id);
        return report ? { report, confidence: Math.round(m.confidence), isOffline: !usedAI } : null;
    }).filter(Boolean) as { report: ItemReport, confidence: number, isOffline: boolean }[];

    return results.sort((a, b) => b.confidence - a.confidence);
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
  base64Image: string | undefined,
  userTitle: string,
  userDescription: string
): Promise<SmartReportResult> => {
  try {
    const prompt = `
      ACT AS A ONE-SHOT LOST & FOUND VISION AI.
      You are analyzing an uploaded image for a lost and found report.
      User provided Title: "${userTitle}"
      User provided Description: "${userDescription}"

      TASKS:
      1. SECURITY CHECK: Check for violence/gore, live animals/pets (plants are ok), human portraits/selfies, or pranks/nonsense.
      2. REDACTION: If there are faces or ID cards, provide bounding boxes [ymin, xmin, ymax, xmax] (scale 0-1000).
      3. VISUAL ANALYSIS: Extract strict technical details (color, category, specs like brand/model, visual tags).
      4. CONTENT GENERATION: Write a highly detailed, factual description combining the user's input and your visual analysis. Suggest a clean, concise title.
      5. CROSS-CHECK: Compare user's input with the image. If the user said "Blue Laptop" but the image is a "Red Backpack", note this discrepancy in crossCheckFeedback.

      CATEGORIES MUST BE EXACTLY ONE OF: 
      Electronics, Stationery, Clothing, Accessories, ID Cards, Books, Bags & Wallets, Keys & Tools, Bottles & Containers, Sports Equipment, Other.

      OUTPUT JSON FORMAT EXACTLY AS:
      {
        "security": {
          "isViolation": boolean,
          "violationType": "GORE" | "ANIMAL" | "HUMAN_PORTRAIT" | "IRRELEVANT" | "NONE",
          "reason": "String",
          "isPrank": boolean
        },
        "redactionRegions": [[ymin, xmin, ymax, xmax]],
        "visualInsights": {
          "category": "String (must match one of the categories)",
          "color": "String",
          "tags": ["tag1", "tag2"],
          "specs": { "key": "value" }
        },
        "suggestedTitle": "String",
        "suggestedDescription": "String",
        "crossCheckFeedback": "String (e.g. 'You mentioned it's a laptop, but it looks like a tablet. I've updated the category.') or empty string if perfect."
      }
    `;

    const text = await callPuterAI(prompt, base64Image, undefined, 'VISION');
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
        const text = await callPuterAI(
          `Analyze query: "${query}". Return JSON { "userStatus": "LOST"|"FOUND"|"UNKNOWN", "refinedQuery": "keywords" }`,
          undefined,
          undefined,
          'TEXT'
        );
        
        if (!text) throw new Error("No text");
        const result = JSON.parse(cleanJSON(text));
        return { userStatus: result.userStatus || 'UNKNOWN', refinedQuery: result.refinedQuery || query };
    } catch (e) {
        return { userStatus: 'UNKNOWN', refinedQuery: query };
    }
};

const getBase64FromUrl = async (url: string) => {
    try {
        const data = await fetch(url);
        const blob = await data.blob();
        return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob); 
            reader.onloadend = () => {
                resolve(reader.result as string);
            }
        });
    } catch (e) {
        console.warn("Failed to fetch image for comparison", e);
        return null;
    }
}

export const compareItems = async (item1: ItemReport, item2: ItemReport): Promise<ComparisonResult> => {
    try {
        // Collect images from both items for visual comparison
        const imagesToAnalyze: string[] = [];
        if (item1.imageUrls?.[0]) {
            const b64 = await getBase64FromUrl(item1.imageUrls[0]);
            if (b64) imagesToAnalyze.push(b64);
        }
        if (item2.imageUrls?.[0]) {
            const b64 = await getBase64FromUrl(item2.imageUrls[0]);
            if (b64) imagesToAnalyze.push(b64);
        }

        const prompt = `
           You are an expert Lost & Found Verification Specialist.
           
           CONTEXT:
           We are trying to match a specific "Lost Item" (Item A) with a potential "Found Item" (Item B).
           Your sole job is to determine if these two reports refer to the **SAME PHYSICAL OBJECT**.
           
           INPUT DATA:
           [ITEM A - ${item1.type}]
           - Title: "${item1.title}"
           - Description: "${item1.description}"
           - Category: "${item1.category}"
           - Specs: ${JSON.stringify(item1.specs || {})}
           - Visual Tags: "${item1.tags.join(', ')}"
           
           [ITEM B - ${item2.type}]
           - Title: "${item2.title}"
           - Description: "${item2.description}"
           - Category: "${item2.category}"
           - Specs: ${JSON.stringify(item2.specs || {})}
           - Visual Tags: "${item2.tags.join(', ')}"

           VISUAL EVIDENCE:
           ${imagesToAnalyze.length} images provided.

           ANALYSIS INSTRUCTIONS:
           1. **ACCOUNT FOR CIRCUMSTANCE**: Lighting conditions, camera angles, and user description accuracy may vary. Do NOT treat minor lighting/angle differences as physical differences.
           2. **LOOK FOR IDENTIFIERS**: Focus on Brands, Logos, Models, Unique Scratches, Stickers, or distinctive wear patterns.
           3. **IDENTIFY DEAL-BREAKERS**: A mismatch is only valid if it proves they are different objects (e.g. Different Brand, Different number of buttons, clearly different shape).
           4. **VERDICT**: If they look like the same model and color with no visible contradictions, the score should be HIGH.

           SCORING GUIDE:
           - 95-100%: DEFINITIVE (Matching Serial # or unique wear/damage).
           - 80-94%: HIGH PROBABILITY (Identical make/model/color, no contradictions).
           - 50-79%: PLAUSIBLE (Same generic item type & color, but vague details).
           - 0-49%: MISMATCH (Different brand, feature, or form factor).

           OUTPUT FORMAT (JSON ONLY):
           { 
              "confidence": number (Integer 0-100), 
              "explanation": "Write a verdict for the user. Example: 'These appear to be the same Logitech mouse. Both have the same matte black finish and shape. The lighting is different, but the form factor matches.'", 
              "similarities": ["List key matching features"], 
              "differences": ["Only list REAL physical contradictions (e.g. 'Different Logo'), ignore lighting/angle"] 
           }
        `;

        // Pass array of images (1 or 2 images) to the AI
        const text = await callPuterAI(prompt, imagesToAnalyze.length > 0 ? imagesToAnalyze : undefined, undefined, 'VISION');

        if (!text) throw new Error("No response");
        
        const cleanedText = cleanJSON(text);
        let result;
        
        try {
            result = JSON.parse(cleanedText);
        } catch (parseError: any) {
            // FIX for "Bad control character in string literal" error
            // Often occurs when AI puts literal newlines in the explanation string
            if (parseError.message.includes("Bad control character") || parseError.message.includes("JSON")) {
                // Aggressive fix: remove all control characters (newlines, tabs) to make it valid single-line JSON
                // We assume the AI output newlines were mostly for formatting, not content critical structure.
                const sanitized = cleanedText.replace(/[\x00-\x1F]/g, " ");
                result = JSON.parse(sanitized);
            } else {
                throw parseError;
            }
        }
        
        // --- SCORE NORMALIZATION LOGIC ---
        let conf = result.confidence;
        
        // Fix: Some models output "1" to mean "100% / True". 
        // If score is exactly 1, and the explanation is positive, treat as 100%.
        if (conf === 1) {
             conf = 100;
        } else if (conf < 1 && conf > 0) {
             // Handle decimal (0.95 -> 95)
             conf = conf * 100;
        }
        
        // Ensure integer
        conf = Math.round(conf);
        
        // --- LOGIC SAFETY NET ---
        // If texts are highly similar (Jaccard > 0.8), don't let AI hallucinate a very low score.
        const textSim = calculateTextSimilarity(item1.title, item2.title);
        if (textSim > 0.8 && conf < 60) {
            conf = 75; // Boost to "Plausible" if title is identical but AI was unsure visually
            result.explanation += " (Score boosted due to exact title match).";
        }
        
        // Safety cap
        if (conf > 100) conf = 100;

        return {
            ...result,
            confidence: conf
        };

    } catch (e) {
        console.error("AI Compare Failed, using fallback:", e);
        return fallbackComparison(item1, item2);
    }
};
