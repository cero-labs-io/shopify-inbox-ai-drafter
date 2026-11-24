import { mkdirSync, writeFileSync } from "node:fs";
import { getProduct, getQuestions, getQuestion } from "../lib/data";
import { draftReply, type DraftResult } from "../lib/draft-reply";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* env may already be set */
}

const SAMPLE = [
  "Q-001", "Q-026", "Q-061", "Q-117", "Q-083", "Q-087", "Q-029", "Q-042",
  "Q-112", "Q-012", "Q-003", "Q-035", "Q-024", "Q-013", "Q-008",
];

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}

async function main() {
  console.log("=== SAMPLE ===");
  for (const id of SAMPLE) {
    const q = getQuestion(id)!;
    const r = await draftReply(id);
    if (r.fallback_reason?.startsWith("model_error")) {
      console.error(`Model call failed on ${id}: ${r.fallback_reason}. Stopping before the 120-row run.`);
      process.exit(1);
    }
    console.log(`\n${id} | ${getProduct(q.product_id)?.title} | ${q.question_text}`);
    console.log(`  -> ${r.reply}`);
    console.log(`  mode=${r.mode} fallback=${r.fallback_reason ?? "none"} quoted=${JSON.stringify(r.ingredients_quoted)}`);
  }

  console.log("\n=== ALL 120 ===");
  const results: DraftResult[] = await pool(getQuestions(), 4, (q) => draftReply(q.question_id));
  mkdirSync("out", { recursive: true });
  writeFileSync("out/drafts.jsonl", results.map((r) => JSON.stringify(r)).join("\n") + "\n");

  const count = (key: (r: DraftResult) => string) =>
    results.reduce<Record<string, number>>((a, r) => ((a[key(r)] = (a[key(r)] ?? 0) + 1), a), {});
  console.log("by mode:", count((r) => r.mode));
  console.log("by fallback_reason:", count((r) => r.fallback_reason?.split(":")[0] ?? "none"));
}

main();
