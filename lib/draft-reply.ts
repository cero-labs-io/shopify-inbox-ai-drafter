import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { getProduct, getQuestion, splitIngredients, type Product } from "./data";
import { SYSTEM_PROMPT, buildUserPrompt, honestUnknown } from "./prompts/drafter";

const FIELDS = [
  "ingredient_list",
  "allergen_statement",
  "usage_instructions",
  "size",
  "price",
  "description",
  "title",
] as const;

const DraftSchema = z.object({
  reply: z.string(),
  mode: z.enum(["answered", "partial", "merchant_check"]),
  ingredients_quoted: z.array(z.string()),
  fields_used: z.array(z.enum(FIELDS)),
});

export type DraftResult = {
  question_id: string;
  product_id: string;
  reply: string;
  mode: "answered" | "partial" | "merchant_check";
  ingredients_quoted: string[];
  fields_used: string[];
  fallback_reason: string | null;
  model: string;
};

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

const BANNED_PHRASES = ["nut-free", "nut free", "allergen-free", "allergen free", "free from", "free of", "safe for"];
const ALLERGEN_TOPIC = /\b(nuts?|allerg\w*|facility)\b/i;

// A banned phrase is allowed only when the reply is DISAVOWING it ("the page doesn't call it nut-free",
// "I can't say it's safe for you"): a negator within 5 words before the phrase, with no punctuation between.
// Any other use counts as a claim and is blocked. The allergen-statement check still applies on top.
const NEGATOR = /(?:doesn't|does not|don't|do not|isn't|is not|can't|cannot|can not|won't|never)(?:\s+[^\s.!?;,]+){0,5}\s*$/;

export function hasAffirmativeUse(replyNorm: string, phrase: string): boolean {
  const normalized = replyNorm.replace(/[’‘]/g, "'");
  let from = 0;
  for (;;) {
    const i = normalized.indexOf(phrase, from);
    if (i === -1) return false;
    if (!NEGATOR.test(normalized.slice(0, i))) return true;
    from = i + phrase.length;
  }
}

function pageText(p: Product): string {
  return norm(
    [p.title, p.description, p.ingredient_list, p.allergen_statement, p.usage_instructions, p.size, p.price].join(" ")
  );
}

/** Returns the name of the first failed check, or null if the draft passes. */
export function checkDraft(reply: string, ingredientsQuoted: string[], p: Product): string | null {
  const entries = new Set(splitIngredients(p.ingredient_list));
  for (const q of ingredientsQuoted) {
    if (!entries.has(q.trim())) return `ingredient_not_on_page: ${q}`;
  }
  const r = norm(reply);
  const page = pageText(p);
  for (const phrase of BANNED_PHRASES) {
    if (!page.includes(phrase) && hasAffirmativeUse(r, phrase)) return `banned_phrase: ${phrase}`;
  }
  if (p.allergen_statement && ALLERGEN_TOPIC.test(reply) && !r.includes(norm(p.allergen_statement))) {
    return "allergen_statement_not_verbatim";
  }
  if (/[$€£]|\busd\b/i.test(reply)) return "currency_added";
  if (!reply.trim()) return "empty_reply";
  return null;
}

export async function draftReply(questionId: string): Promise<DraftResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const modelName = process.env.OPENROUTER_MODEL;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  if (!modelName) throw new Error("OPENROUTER_MODEL is not set");

  const q = getQuestion(questionId);
  if (!q) throw new Error(`Unknown question_id ${questionId}`);

  const base = { question_id: q.question_id, product_id: q.product_id, model: modelName };
  const p = getProduct(q.product_id);
  if (!p) {
    return {
      ...base,
      reply: honestUnknown(q.shopper_first_name, "product"),
      mode: "merchant_check",
      ingredients_quoted: [],
      fields_used: [],
      fallback_reason: "product_not_found",
    };
  }

  const fallback = (reason: string): DraftResult => {
    console.warn(`[draftReply] ${q.question_id} fallback: ${reason}`);
    return {
      ...base,
      reply: honestUnknown(q.shopper_first_name, p.title),
      mode: "merchant_check",
      ingredients_quoted: [],
      fields_used: [],
      fallback_reason: reason,
    };
  };

  try {
    // Reasoning models burn the whole token budget thinking and return no JSON; turn reasoning off.
    const openrouter = createOpenRouter({ apiKey, extraBody: { reasoning: { enabled: false } } });
    const { object } = await generateObject({
      model: openrouter(modelName),
      schema: DraftSchema,
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(q, p),
      temperature: 0,
      maxOutputTokens: 800,
    });
    const failed = checkDraft(object.reply, object.ingredients_quoted, p);
    if (failed) return fallback(failed);
    return { ...base, ...object, fallback_reason: null };
  } catch (err) {
    return fallback(`model_error: ${err instanceof Error ? err.message.slice(0, 120) : "unknown"}`);
  }
}
