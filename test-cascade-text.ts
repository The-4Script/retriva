import "dotenv/config";
import { runWithCascade } from "./server.js";

async function test() {
  try {
    const res = await runWithCascade("Reply only with YES", [], undefined, 'TEXT');
    console.log("TEXT OK:", res);
    process.exit(0);
  } catch (e) {
    console.error("TEXT ERROR:", e);
    process.exit(1);
  }
}
test();
