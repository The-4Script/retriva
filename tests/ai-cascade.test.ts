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

// @ts-ignore
global.fetch = async (_url: string, _opts: any) => {
  fetchCallCount++;
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
