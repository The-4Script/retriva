// Lightweight regression test for the Groq cascade + cache + circuit-breaker logic
// in server.ts. Mocks fetch so it costs nothing and needs no real API keys — run it
// after touching server.ts's AI plumbing to make sure caching, failover, and the
// rate-limit circuit breaker still behave correctly.
//
// Run with: npm run test:ai

process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "test-project-id";
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || "test-key";

let fetchCallCount = 0;
let mode: "always200" | "always429" | "firstFails" = "always200";
let lastBody: any = null;

// @ts-ignore
global.fetch = async (_url: string, opts: any) => {
  fetchCallCount++;
  lastBody = opts?.body ? JSON.parse(opts.body) : null;
  if (mode === "always429") {
    return { status: 429, ok: false, text: async () => "rate limited, try again in 0.1s" } as any;
  }
  if (mode === "firstFails" && fetchCallCount === 1) {
    return { status: 500, ok: false, text: async () => "server error" } as any;
  }
  return {
    status: 200,
    ok: true,
    json: async () => ({ choices: [{ message: { content: '{"result":"ok"}' } }] }),
  } as any;
};

const { runWithCascade } = await import("../server.ts");

let failures = 0;
const check = (name: string, pass: boolean, detail: string) => {
  console.log(`${pass ? "PASS" : "FAIL"} - ${name} ${detail}`);
  if (!pass) failures++;
};

async function main() {
  fetchCallCount = 0;
  mode = "always200";
  const r1 = await runWithCascade("hello world", undefined, undefined, "TEXT");
  const callsAfterFirst = fetchCallCount;
  const r2 = await runWithCascade("hello world", undefined, undefined, "TEXT");
  check("cache hit avoids a second Groq call", callsAfterFirst === 1 && fetchCallCount === callsAfterFirst && r1 === r2,
    `(calls=${callsAfterFirst}->${fetchCallCount})`);

  fetchCallCount = 0;
  await runWithCascade("a totally different prompt", undefined, undefined, "TEXT");
  check("cache miss on new input triggers exactly one call", fetchCallCount === 1, `(calls=${fetchCallCount})`);

  // Body-shape checks run here — on the two mode families, while mode is still
  // "always200" — deliberately BEFORE the 429/cooldown tests below. Those tests
  // trip the circuit breaker for VISION and TEXT_LIGHT, so a VISION or TEXT_LIGHT
  // request made after them short-circuits with zero fetch calls and no body to
  // inspect. TEXT (gpt-oss family) is checked via the call above; VISION (Qwen
  // family) gets its own fresh call below, still ahead of the cooldown tests.
  check("gpt-oss request uses max_completion_tokens, not max_tokens",
    lastBody?.max_completion_tokens === 400 && lastBody?.max_tokens === undefined, `(got=${JSON.stringify(lastBody?.max_completion_tokens)})`);
  check("gpt-oss request forces JSON mode",
    lastBody?.response_format?.type === "json_object", `(got=${JSON.stringify(lastBody?.response_format)})`);
  check("gpt-oss request uses low reasoning effort + suppressed reasoning field",
    lastBody?.reasoning_effort === "low" && lastBody?.include_reasoning === false && lastBody?.reasoning_format === undefined,
    `(effort=${lastBody?.reasoning_effort}, include_reasoning=${lastBody?.include_reasoning})`);

  fetchCallCount = 0;
  lastBody = null;
  await runWithCascade(
    "vision body-shape test " + Date.now(),
    ["https://res.cloudinary.com/demo/image/upload/v1700000000/sample.heic"],
    undefined,
    "VISION"
  );
  check("VISION request Cloudinary-transforms the image to a decodable format",
    typeof lastBody?.messages?.[0]?.content?.[1]?.image_url?.url === "string" &&
      lastBody.messages[0].content[1].image_url.url.includes("w_384,c_limit,q_50,f_jpg"),
    `(url=${lastBody?.messages?.[0]?.content?.[1]?.image_url?.url})`);
  check("qwen request uses none reasoning effort + hidden reasoning format",
    lastBody?.reasoning_effort === "none" && lastBody?.reasoning_format === "hidden" && lastBody?.include_reasoning === undefined,
    `(effort=${lastBody?.reasoning_effort}, format=${lastBody?.reasoning_format})`);
  check("qwen request also forces JSON mode",
    lastBody?.response_format?.type === "json_object", `(got=${JSON.stringify(lastBody?.response_format)})`);

  fetchCallCount = 0;
  mode = "always429";
  let threw = false, isRateLimit = false;
  try {
    await runWithCascade("unique prompt for 429 test " + Date.now(), undefined, undefined, "VISION");
  } catch (e: any) {
    threw = true; isRateLimit = !!e.isRateLimit;
  }
  check("exhausted cascade throws a tagged rate-limit error", threw && isRateLimit, `(fetchCalls=${fetchCallCount})`);

  fetchCallCount = 0;
  let secondThrew = false, secondIsRateLimit = false;
  try {
    await runWithCascade("a DIFFERENT unique prompt " + Date.now(), undefined, undefined, "VISION");
  } catch (e: any) {
    secondThrew = true; secondIsRateLimit = !!e.isRateLimit;
  }
  check("circuit breaker short-circuits the next call with zero Groq calls",
    secondThrew && secondIsRateLimit && fetchCallCount === 0, `(fetchCalls=${fetchCallCount})`);

  fetchCallCount = 0;
  mode = "always429";
  try { await runWithCascade("light mode test " + Date.now(), undefined, undefined, "TEXT_LIGHT"); } catch {}
  check("TEXT_LIGHT only ever tries the single cheap model", fetchCallCount === 2, `(fetchCalls=${fetchCallCount})`);

  fetchCallCount = 0;
  mode = "firstFails";
  const r6 = await runWithCascade("failover test " + Date.now(), undefined, undefined, "TEXT");
  check("non-429 error on model 1 fails over to model 2", r6 === '{"result":"ok"}', `(fetchCalls=${fetchCallCount})`);

  console.log(failures === 0 ? "\nAll AI cascade tests passed." : `\n${failures} test(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
