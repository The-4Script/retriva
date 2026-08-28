const fs = require('fs');
let src = fs.readFileSync('server.ts', 'utf-8');

// replace the image building logic
src = src.replace(
    /for \(const img of images\) \{[\s\S]*?contentPayload\.push\(\{ type: "image_url", image_url: \{ url \} \}\);\s*\}/,
    `for (const img of images) {
          let url = img;
          if (url.startsWith('data:')) {
              console.warn("Dropping base64 image because Groq Qwen requires URLs");
              continue; // Skip base64
          }
          if (url.startsWith('http')) {
              // Downscale Cloudinary images aggressively to save AI tokens
              if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
                  url = url.replace('/upload/', '/upload/w_512,c_limit,q_60/');
              }
          }
          contentPayload.push({ type: "image_url", image_url: { url } });
      }`
);

fs.writeFileSync('server.ts', src);
