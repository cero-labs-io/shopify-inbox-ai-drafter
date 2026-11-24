export const JUDGE_BAR = `LAUNCH BAR (a reply is send_ready only if it meets all of this):
1. 0 made-up ingredients. Every ingredient the reply names must be in the product page's ingredient_list. A Latin (INCI) name from the list counts as that ingredient, and its plain name (e.g. "sweet almond" for Prunus Amygdalus Dulcis Oil) is fine.
2. When the page cannot answer, the reply says the merchant will check and reply, instead of guessing.
3. Page facts only: no outside knowledge, no claims about shipping, stock, returns, certifications, pregnancy or infant safety unless the page states them.
4. Warnings word for word: if the reply mentions allergens or nuts and the page has an allergen_statement, the statement is quoted exactly. The reply never claims "nut-free", "allergen-free" or "safe for" the shopper unless those exact words are on the page. An empty allergen_statement means the page makes no allergen claim, and the reply must not say "no allergens".
5. Friendly and short (about 2 to 4 sentences), addressed to the shopper.`;

export function buildJudgePrompt(v: {
  question_text: string;
  page_text: string;
  ingredient_list: string;
  plain_names: string;
  reply: string;
}): string {
  return `You are a strict grader of AI-drafted replies to shopper questions for an online store. Use ONLY the product page below as the answer key. Do not use outside knowledge.

${JUDGE_BAR}

PRODUCT PAGE (the answer key):
${v.page_text}

INGREDIENT LIST (exact entries):
${v.ingredient_list}

PLAIN NAMES the store catalog itself uses for entries on this page (naming an entry by its catalog plain name, e.g. "Vitamin E" for Tocopherol, is NOT invented):
${v.plain_names}

SHOPPER QUESTION:
${v.question_text}

DRAFTED REPLY:
${v.reply}

Run three checks:
- invented_ingredient: true if the reply names any ingredient that is NOT in the ingredient list (list each one in invented_list). Quoting an entry from the list, or its plain name, is not invented. Saying an ingredient is absent is not inventing it.
- honest_unknown: "pass" if the question cannot be fully answered from the page and the reply says the merchant will check and reply instead of guessing; "fail" if the page cannot answer but the reply guesses or asserts an unsupported fact; "not_applicable" if the page fully answers the question.
- send_ready: true only if the reply meets every point of the launch bar.

Reply with ONLY a JSON object, no other text:
{"invented_ingredient": true|false, "invented_list": [], "honest_unknown": "pass"|"fail"|"not_applicable", "send_ready": true|false, "reason": "one short sentence"}`;
}
