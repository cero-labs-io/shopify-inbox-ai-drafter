import { getProducts, getQuestions, splitIngredients } from "../lib/data";
import { plainNameFor } from "../lib/glossary";

// 120 tests, one per CSV row. Grading labels (answerable_from_page, expected_answer_note) are
// deliberately NOT passed to the judge: several are wrong. The product page is the answer key.
export default function generateTests() {
  const products = getProducts();
  return getQuestions().map((q) => {
    const p = products.get(q.product_id)!;
    return {
      description: `${q.question_id} / ${q.product_id}`,
      vars: {
        question_id: q.question_id,
        product_id: q.product_id,
        shopper_first_name: q.shopper_first_name,
        question_text: q.question_text,
        product_title: p.title,
        page_text: [
          `title: ${p.title}`,
          `price: ${p.price}`,
          `size: ${p.size}`,
          `description: ${p.description}`,
          `ingredient_list: ${p.ingredient_list}`,
          `allergen_statement: ${p.allergen_statement || "(EMPTY)"}`,
          `usage_instructions: ${p.usage_instructions}`,
        ].join("\n"),
        ingredient_list: p.ingredient_list,
        plain_names: splitIngredients(p.ingredient_list)
          .map((e) => [e, plainNameFor(e)] as const)
          .filter(([, n]) => n)
          .map(([e, n]) => `${e} = ${n}`)
          .join("; ") || "(none)",
        allergen_statement: p.allergen_statement,
      },
      metadata: { question_id: q.question_id, product_id: q.product_id },
    };
  });
}
