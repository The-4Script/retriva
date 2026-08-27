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
// Updated to accept string array for images and use exponential backoff
const callPuterAI = async (
  prompt: string, 
  images?: string | string[], 
  systemInstruction?: string,
  cascadeMode?: 'VISION' | 'TEXT'
): Promise<string | null> => {
  const MAX_RETRIES = 3;
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
          cascadeMode
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[Backend AI Error - Attempt ${attempt + 1}]`, errText);
        
        if ((response.status === 503 || response.status === 429) && attempt < MAX_RETRIES) {
          const delayMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          console.warn(`AI Provider Overloaded. Retrying in ${Math.round(delayMs)}ms...`);
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
          const delayMs = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delayMs));
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
        const text = `${item.title} ${item.description} ${item.tags.join(' ')} ${Object.values(item.specs || {}).join(' ')}`;
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
    const prompt = `
      ACT AS A ONE-SHOT LOST & FOUND VISION AI.
      You are analyzing an uploaded image for a lost and found report.
      User provided Title: "${userTitle}"
      User provided Description: "${userDescription}"

      TASKS:
      1. SECURITY CHECK: Check for violence/gore, live animals/pets (plants are ok), human portraits/selfies, or pranks/nonsense.
      2. VISUAL ANALYSIS: Extract strict technical details (color, category, specs like brand/model, visual tags).
      3. CONTENT GENERATION: Write a highly detailed, exhaustive, and factual description combining the user's input and your visual analysis. Include material, exact colors, distinguishing marks, brand, condition, and any unique identifiers. This description will be used later for strict AI matching, so do not miss any detail. Suggest a clean, concise title.
      4. CROSS-CHECK: Compare user's input with the image. If the user said "Blue Laptop" but the image is a "Red Backpack", note this discrepancy in crossCheckFeedback.

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
        "visualInsights": {
          "category": "String (must match one of the categories)",
          "color": "String",
          "tags": ["tag1", "tag2"],
          "specs": { "key": "value" }
        },
        "suggestedTitle": "String",
        "suggestedDescription": "String (Provide a highly detailed and exhaustive description covering all physical attributes, brand, colors, and unique marks)",
        "crossCheckFeedback": "String (e.g. 'You mentioned it's a laptop, but it looks like a tablet. I've updated the category.') or empty string if perfect."
      }
    `;

    const text = await callPuterAI(prompt, base64Images, undefined, 'VISION');
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

export const compareItems = async (item1: ItemReport, item2: ItemReport): Promise<ComparisonResult> => {
    try {
        // Collect images from both items for visual comparison
        const imagesToAnalyze: string[] = [];
        if (item1.imageUrls?.[0]) imagesToAnalyze.push(item1.imageUrls[0]);
        if (item2.imageUrls?.[0]) imagesToAnalyze.push(item2.imageUrls[0]);

        const prompt = `
           You are an expert Lost & Found Verification Specialist.
           
           CONTEXT:
           We are trying to match a specific "Lost Item" (Item A) with a potential "Found Item" (Item B).
           Your sole job is to determine if these two reports refer to the **SAME PHYSICAL OBJECT**.
           
           INPUT DATA (Includes User fields & AI generated descriptions):
           [ITEM A - ${item1.type}]
           - Title: "${item1.title}"
           - Description: "${item1.description}"
           - Category: "${item1.category}"
           - Attributes & Specs: ${JSON.stringify(item1.specs || {})}
           - Visual Tags: "${item1.tags.join(', ')}"
           
           [ITEM B - ${item2.type}]
           - Title: "${item2.title}"
           - Description: "${item2.description}"
           - Category: "${item2.category}"
           - Attributes & Specs: ${JSON.stringify(item2.specs || {})}
           - Visual Tags: "${item2.tags.join(', ')}"

           VISUAL EVIDENCE:
           ${imagesToAnalyze.length} images provided.

           ANALYSIS INSTRUCTIONS:
           1. **ACCOUNT FOR CIRCUMSTANCE**: Lighting conditions, camera angles, and user description accuracy may vary. Do NOT treat minor lighting/angle differences as physical differences.
           2. **LOOK FOR IDENTIFIERS**: Focus on Brands, Logos, Models, Unique Scratches, Stickers, or distinctive wear patterns.
           3. **IDENTIFY DEAL-BREAKERS**: A mismatch is only valid if it proves they are different objects (e.g. Different Brand, Different number of buttons, clearly different shape).
           4. **LOGICAL REASONING**: Deduce logically why it is a potential match (pros) and why it is not (cons), using all provided fields, attributes, and tags.

           SCORING GUIDE:
           - 95-100%: DEFINITIVE (Matching Serial # or unique wear/damage).
           - 80-94%: HIGH PROBABILITY (Identical make/model/color, no contradictions).
           - 50-79%: PLAUSIBLE (Same generic item type & color, but vague details).
           - 0-49%: MISMATCH (Different brand, feature, or form factor).

           OUTPUT FORMAT (JSON ONLY):
           { 
              "confidence": number (Integer 0-100, representing match score), 
              "explanation": "Write a verdict explaining the logical reasoning.", 
              "similarities": ["List pros: why it is a potential match"], 
              "differences": ["List cons: why it is not a match (e.g. contradictions)"] 
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
