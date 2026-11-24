# Prompt for Claude Code: build the shopper reply drafter

Paste everything below the line into Claude Code, run from the `shopify-inbox-ai-drafter` folder.

---

You are helping me build stage 1 of the Shopify Inbox AI reply drafter. Read this whole brief before writing any code. When you finish, stop and give me a review list. Do not commit, and do not deploy.

## What we're building

A Next.js (App Router, TypeScript) app with a server-side function, `draftReply(questionId)`. It writes a short, friendly reply to one shopper question and uses **only** the product page that the question's `product_id` points to. A merchant inbox page lists the questions and shows each draft.

A wrong answer is the main risk. If a reply says almond oil is in a product when it isn't, or misses almond oil when it is there, a nut-allergic shopper can get hurt and the merchant stops trusting Shopify. When the code has to choose, it should choose "the merchant will check" over a guess.

## Stack and config

- Next.js + the Vercel AI SDK (`ai`) + the OpenRouter provider (`@openrouter/ai-sdk-provider`).
- Read `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` from environment variables only. `.env.local` already holds the key. Add `OPENROUTER_MODEL` to a committed `.env.example` with a placeholder, never a real value. Fail with a clear error if either variable is missing.
- No API key, model name or secret anywhere in committed code. `.gitignore` already excludes `.env*.local`.
- If this folder is not a git repo yet, run `git init`. Do not add a remote or push.

## Data

Copy these two files into `data/` as `products.csv` and `questions.csv`, and load them with a real CSV parser (fields contain quoted commas):

- `/Users/cero/Downloads/Shopify Dev Store Product Pages (catalog snapshot, 16 Nov 2026).csv`: 40 products, DSP-001 to DSP-040. Columns: product_id, title, product_type, vendor, price, size, description, ingredient_list, allergen_statement, usage_instructions, page_url, last_updated.
- `/Users/cero/Downloads/Shopify Inbox Shopper Questions (19 Oct - 16 Nov 2026).csv`: 120 questions, Q-001 to Q-120.

**The drafter's input is limited to these fields: `question_text`, `shopper_first_name` and the matched product row.** `answerable_from_page`, `question_category`, `ingredient_mentioned` and `expected_answer_note` are grading labels. The drafter, its prompt and its fallback logic must never read them. Keep them in a separate module that only the eval stage will import.

Do not trust `expected_answer_note` as a source of facts. I checked it against the product pages and many notes are wrong. Examples:
- Q-001 (DSP-003 Baby Bottom Balm): the note says it contains almond, but the ingredient list has no almond.
- Q-002 (DSP-007 Rose Lip Balm): the note says coconut is present, but it isn't.
- Q-035 and Q-114: the notes quote prices (14.50, 42.00) that don't match the page.

Shoppers also often name a different product than the page they're on, for example "body butter" on a lip balm page. Always answer about the page found by `product_id`, and name that product by its page title so the mismatch is visible to the merchant.

## Guardrails (implement every one; these are the spec)

1. **Page facts only.** The reply uses only the matching product page. No outside knowledge, no general skincare advice, no guessed ingredients. Don't mention shipping, stock, restock dates, returns, discounts, bundles, certifications or pregnancy or infant safety unless the page states them, and none of these pages do.
2. **Exact names.** When a shopper asks about an ingredient that **is** in the list, quote the exact name from `ingredient_list`, for example `Prunus Amygdalus Dulcis Oil`, then give the plain name, as in "which is sweet almond oil". Never decide whether it's safe for them. Leave that call to the shopper.
3. **Warnings word for word.** If `allergen_statement` has text, quote it exactly, in quotation marks. Never call a product nut-free, allergen-free, safe or free-of anything unless those exact words are on the page.
4. **Blank means no claim.** If `allergen_statement` is empty (DSP-001, 011, 016, 024, 032 and 037), say the page doesn't state allergen information, point to the ingredient list, and offer a merchant check. Never say "no allergens" or anything similar.
5. **Silent page.** If the page can't answer, use the fixed honest-unknown message (see below). This includes when an asked-about ingredient is **not** in the list: say it isn't in the listed ingredients, that the page makes no free-of claim, and that the merchant will check. Never say "it doesn't contain X".
6. **Tone.** Friendly and short (2 to 4 sentences), written to the shopper by first name and in your own words. Never copy the spreadsheet notes.

Other page-fact rules:
- Quote price and size exactly as the page shows them. The page gives no currency, so don't add `$` or "USD".
- For gift sets (DSP-039, DSP-040), the ingredient list is the combined list for the set. Say that, and point to each item's own page for directions, as the page does.

### Honest-unknown message (fixed text, a constant in code)

> Hi {first_name}, thanks for asking! The {product title} page doesn't include that information, so I don't want to guess. The merchant will check and reply to you here.

If a question has a part the page answers and a part it doesn't, answer the page-backed part, then add the merchant-check sentence for the rest.

## Plain names: page-derived glossary only

To get from a Latin (INCI) name to a plain name like "almond", build `lib/glossary.ts` from the catalog itself. Many ingredient entries carry a plain name in parentheses, such as `Prunus Amygdalus Dulcis (Sweet Almond) Oil`, `Cera Alba (Beeswax)`, `Mel (Honey)` and `Tocopherol (Vitamin E)`. Strip the parentheses to get the key, so the same INCI name maps correctly on pages that list it bare (DSP-001 lists `Prunus Amygdalus Dulcis Oil` without the plain name).

Do not add entries from your own knowledge. If you think an extra mapping is needed (for example `Ascorbic Acid` → vitamin C), put it in a separate `MANUAL_PROPOSED` list, give the reason, and leave it out of the live glossary until I approve it.

## How the drafter must work

1. Look up the product by `product_id`. If it's missing, return the honest-unknown message.
2. Call the model with `generateObject` and a Zod schema, not free text. The output is: `reply` (string), `mode` (`"answered"`, `"partial"` or `"merchant_check"`), `ingredients_quoted` (string[]) and `fields_used` (subset of: ingredient_list, allergen_statement, usage_instructions, size, price, description, title).
3. The system prompt holds the guardrails above and gets the product row as labeled fields. Put that prompt in `lib/prompts/drafter.ts` so I can review it in one place.
4. **Server-side check after the model replies:**
   - Every entry in `ingredients_quoted` must appear verbatim in that product's `ingredient_list`.
   - The `reply` must not contain "nut-free", "allergen-free", "free from" or "safe for" unless that exact phrase is in the page text.
   - If `allergen_statement` is non-empty and the reply mentions allergens or nuts, the reply must contain the statement verbatim.
   - If any check fails, discard the draft and return the honest-unknown message. Log which check failed.
5. Use temperature 0.
6. Return `{ question_id, product_id, reply, mode, ingredients_quoted, fields_used, fallback_reason | null, model }`. Every result carries `question_id` and `product_id` so later grading rows and PostHog events can trace back to the spreadsheet.

Keep `draftReply` a plain server function that later stages can wrap. Stage 2 adds a PostHog flag check before drafting, stage 3 adds promptfoo grading, and stage 4 deploys to Vercel. Don't build those now. Don't draft in the browser, and don't expose the key to the client.

## Minimal UI

`/inbox` is a server-rendered list of questions (shopper name, product title, question). Each has a "Draft reply" button that calls a server action and shows the reply, its mode and any fallback reason. Plain styling is fine.

## Prove it before handing back

Add `scripts/draft-sample.ts`, runnable with `npx tsx`. It drafts these rows and prints question, product title, reply, mode and fallback reason:

| Row | What it tests | Expected behavior |
|---|---|---|
| Q-001 | Almond on DSP-003 (absent; note is wrong) | Not in listed ingredients, no free-of claim, merchant will check |
| Q-026 | Same, different wording | Same as Q-001 |
| Q-061 | Almond on DSP-012 | Not listed, so merchant check; the facility tree nut warning is quoted exactly |
| Q-117 | Almond on DSP-033 (absent) | Merchant check, no "doesn't contain" |
| Q-083 | Coconut on DSP-001 (absent; blank allergen cell) | Not listed, page states no allergen info, merchant check |
| Q-087 | Shea on DSP-004 (present) | Quotes `Butyrospermum Parkii (Shea) Butter`, doesn't judge safety |
| Q-029 | Lanolin on DSP-005 (present) | Quotes `Lanolin` plus the allergen statement word for word |
| Q-042 | Nut-free? on DSP-008 | Quotes the facility warning verbatim, never "nut-free" |
| Q-112 | Tree nuts on DSP-014 | Quotes "Free from fragrance and essential oils." and makes no nut claim, merchant check |
| Q-012 | Essential oils on DSP-011 (blank allergen cell) | Page states no allergen info, merchant check |
| Q-003 | Usage on DSP-012 | Uses the page line "Press 2 to 3 drops into skin morning or night", not the note's "twice daily" |
| Q-035 | Price on DSP-002 | 22.00 and 60 g as on the page, no currency symbol |
| Q-024 | Nut + stock on DSP-006 | Partial: allergen part from the page, stock goes to merchant check |
| Q-013 | Shipping to Canada | Honest-unknown message |
| Q-008 | Pregnancy | Honest-unknown message |

Then run all 120 rows once and write `out/drafts.jsonl`, one line per row with all returned fields. Report counts by `mode` and by `fallback_reason`. Don't grade them; grading is a later stage.

## When you're done

Stop and give me:
1. The file tree you created.
2. The full text of `lib/prompts/drafter.ts`.
3. The `MANUAL_PROPOSED` glossary entries, if any.
4. The sample-table output, with each row marked as matching or not matching the expected behavior.
5. Anything you weren't sure about, or any place you bent a rule.

Don't commit. I'll review and correct, then commit with the key prompt excerpt and what I changed.
