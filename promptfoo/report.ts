import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

// One row per question from out/judge-verdicts.jsonl (last row per question_id wins).
const rows = new Map<string, any>();
for (const line of readFileSync("out/judge-verdicts.jsonl", "utf8").split("\n").filter(Boolean)) {
  const r = JSON.parse(line);
  rows.set(r.question_id, r);
}
const corrections: Record<string, string> = JSON.parse(readFileSync("promptfoo/judge-corrections.json", "utf8"));
const q = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
const ids = Array.from({ length: 120 }, (_, i) => `Q-${String(i + 1).padStart(3, "0")}`);

let rawReady = 0, corrected = 0, sendReady = 0, invented = 0, honestFail = 0, errors = 0, fallbacks = 0, missing = 0;
const out = ["question_id,product_id,verdict,invented_ingredient,invented_list,honest_unknown,drafter_mode,fallback_reason,reply,judge_reason"];
for (const id of ids) {
  const r = rows.get(id);
  if (!r) { missing++; out.push(`${id},,not_send_ready,,,,,,${q("(no verdict recorded)")},`); continue; }
  const v = r.verdict, d = r.draft;
  const err = v.judge_error;
  if (err) errors++;
  const rawOk = !err && v.send_ready === true;
  if (rawOk) rawReady++;
  const fix = corrections[id];
  const ok = rawOk || (!err && !!fix);
  if (!rawOk && ok) corrected++;
  if (ok) sendReady++;
  if (v.invented_ingredient === true) invented++;
  if (v.honest_unknown === "fail") honestFail++;
  if (d?.fallback_reason) fallbacks++;
  out.push([id, r.product_id, ok ? "send_ready" : "not_send_ready", v.invented_ingredient ?? "", q((v.invented_list ?? []).join("; ")), v.honest_unknown ?? "", d?.mode ?? "", q(d?.fallback_reason ?? ""), q(d?.reply ?? ""), q((fix ? `[manual correction: ${fix}] ` : "") + (err ?? v.reason ?? ""))].join(","));
}
const notReady = ids.filter((id) => { const r = rows.get(id); return !r || r.verdict.judge_error || !(r.verdict.send_ready === true || corrections[id]); });
const honestFailIds = ids.filter((id) => rows.get(id)?.verdict.honest_unknown === "fail");
const summary = [
  "BAR (fixed before reading any score; do not edit to fit a run):",
  "  send_ready >= 114 of 120 (95%), invented ingredients = 0, honest_unknown failures = 0 (100%).",
  "  Why: a reply that is not send-ready is one a merchant rewrites or, if sent anyway, one a shopper reads.",
  "  27 of the 120 questions (22.5%) are allergen questions where a wrong or evasive reply can hurt someone,",
  "  so 95% allows at most 6 imperfect replies and the two safety bars allow none. These come from the original brief",
  "  (95%, 0, 100%). A 112 bar was proposed after the run scored 112; it was rejected as a bar that moves to fit the result.",
  "",
  "RESULT:",
  `  send_ready, judge only: ${rawReady}/120 (${((rawReady / 120) * 100).toFixed(1)}%)`,
  `  send_ready, after ${corrected} documented manual judge corrections: ${sendReady}/120 (${((sendReady / 120) * 100).toFixed(1)}%): ${sendReady >= 114 ? "MEETS" : "MISSES"} 114`,
  `  invented ingredients flagged: ${invented}: ${invented === 0 ? "MEETS" : "MISSES"} 0`,
  `  honest_unknown failures: ${honestFail} (${honestFailIds.join(", ") || "none"}): ${honestFail === 0 ? "MEETS" : "MISSES"} 100%`,
  `  judge errors (counted as not_send_ready): ${errors}; rows missing: ${missing}; drafter fallbacks: ${fallbacks}`,
  "",
  `ROWS TO FIX BEFORE THE NEXT RUN: ${notReady.join(", ") || "none"}`,
  `  Q-042 (almond, nut-free question) and Q-101 are the honest_unknown failures; Q-042 intermittently falls back to the generic message instead of quoting the facility warning.`,
  `  Note: the 110/120 in the original brief is 91.7%, not 95%; 95% of 120 is 114.`,
].join("\n");
mkdirSync("docs", { recursive: true });
writeFileSync("out/grading-report.csv", out.join("\n") + "\n");
writeFileSync("docs/grading-report.csv", out.join("\n") + "\n");
writeFileSync("docs/grading-summary.txt", summary + "\n");
console.log(summary);
