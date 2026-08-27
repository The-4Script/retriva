import "dotenv/config";
import { runWithCascade } from "./server.js";

async function test() {
  try {
    const res = await runWithCascade("Compare these items", ["https://res.cloudinary.com/demo/image/upload/sample.jpg"], undefined, 'VISION');
    console.log("VISION OK:", res);
  } catch (e) {
    console.error("VISION ERROR:", e);
  }
}
test();
