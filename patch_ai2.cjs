const fs = require('fs');
const path = './services/aiService.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /const cleanJSON = \(text: string\): string => \{[\s\S]*?return cleaned;\n?\};/g;

const replacement = `const cleanJSON = (text: string): string => {
  if (!text) return "{}";
  
  // Remove <think>...</think> blocks (including their contents)
  let cleaned = text.replace(/<think>[\\s\\S]*?<\\/think>/gi, "");
  
  if (cleaned.includes("<think>") && !cleaned.includes("</think>")) {
      cleaned = cleaned.replace(/<think>/gi, "");
  }

  // Remove Markdown code blocks (case insensitive)
  cleaned = cleaned.replace(/\`\`\`json/gi, "").replace(/\`\`\`/g, "").trim();
  
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
};`;

if (content.match(regex)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Success with Regex");
} else {
    console.log("Regex not found");
}
