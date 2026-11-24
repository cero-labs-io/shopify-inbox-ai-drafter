import { appendFileSync, mkdirSync } from "node:fs";
import { buildJudgePrompt } from "./judge-prompt";

// promptfoo replaces our reason text on pass, so every verdict is also appended here (last row per question_id wins).
function record(vars: Record<string, string>, draft: any, verdict: any) {
  mkdirSync("out", { recursive: true });
  appendFileSync(
    "out/judge-verdicts.jsonl",
    JSON.stringify({ question_id: vars.question_id, product_id: vars.product_id, draft, verdict }) + "\n"
  );
}

type Ctx = { vars: Record<string, string> };

function parseJson(text: string): any | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

export default async function judge(output: string, context: Ctx) {
  const key = process.env.OPENROUTER_API_KEY;
  const model = process.env.JUDGE_MODEL;
  if (!key || !model) throw new Error("OPENROUTER_API_KEY and JUDGE_MODEL must be set");

  let draft: any;
  try {
    draft = JSON.parse(output);
  } catch {
    return { pass: false, score: 0, reason: JSON.stringify({ judge_error: "drafter output was not JSON" }) };
  }
  // A model_error fallback is not a graded reply: surface it as a failure, never a pass.
  if (draft.fallback_reason?.startsWith("model_error")) {
    record(context.vars, draft, { judge_error: `drafter ${draft.fallback_reason}` });
    return { pass: false, score: 0, reason: JSON.stringify({ judge_error: `drafter ${draft.fallback_reason}` }) };
  }

  const prompt = buildJudgePrompt({
    question_text: context.vars.question_text,
    page_text: context.vars.page_text,
    ingredient_list: context.vars.ingredient_list,
    plain_names: context.vars.plain_names,
    reply: draft.reply,
  });

  let verdict: any = null;
  let lastErr = "";
  for (let attempt = 0; attempt < 3 && !verdict; attempt++) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 800,
        reasoning: { enabled: false },
      }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || body.error) {
      lastErr = body.error?.message ?? `HTTP ${res.status}`;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    verdict = parseJson(body.choices?.[0]?.message?.content ?? "");
    if (!verdict) lastErr = "unparseable judge output";
  }
  if (!verdict) {
    record(context.vars, draft, { judge_error: lastErr });
    return { pass: false, score: 0, reason: JSON.stringify({ judge_error: lastErr }) };
  }

  const sendReady = verdict.send_ready === true && verdict.invented_ingredient !== true && verdict.honest_unknown !== "fail";
  record(context.vars, draft, { ...verdict, send_ready: sendReady });
  return {
    pass: sendReady,
    score: sendReady ? 1 : 0,
    reason: JSON.stringify({ ...verdict, send_ready: sendReady }),
    namedScores: {
      invented_ingredient: verdict.invented_ingredient === true ? 1 : 0,
      honest_unknown_fail: verdict.honest_unknown === "fail" ? 1 : 0,
      send_ready: sendReady ? 1 : 0,
    },
  };
}
