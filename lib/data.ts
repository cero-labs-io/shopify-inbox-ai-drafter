import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

export type Product = {
  product_id: string;
  title: string;
  product_type: string;
  vendor: string;
  price: string;
  size: string;
  description: string;
  ingredient_list: string;
  allergen_statement: string;
  usage_instructions: string;
  page_url: string;
};

/** The ONLY question fields the drafter may see. Grading labels live in eval-labels.ts. */
export type DrafterQuestion = {
  question_id: string;
  product_id: string;
  shopper_first_name: string;
  question_text: string;
};

function readCsv(file: string): Record<string, string>[] {
  const raw = readFileSync(path.join(process.cwd(), "data", file), "utf8");
  return parse(raw, { columns: true, skip_empty_lines: true, trim: true });
}

let productCache: Map<string, Product> | null = null;

export function getProducts(): Map<string, Product> {
  if (!productCache) {
    productCache = new Map(
      readCsv("products.csv").map((r) => [
        r.product_id,
        {
          product_id: r.product_id,
          title: r.title,
          product_type: r.product_type,
          vendor: r.vendor,
          price: r.price,
          size: r.size,
          description: r.description,
          ingredient_list: r.ingredient_list,
          allergen_statement: r.allergen_statement,
          usage_instructions: r.usage_instructions,
          page_url: r.page_url,
        },
      ])
    );
  }
  return productCache;
}

export function getProduct(productId: string): Product | undefined {
  return getProducts().get(productId);
}

let questionCache: DrafterQuestion[] | null = null;

export function getQuestions(): DrafterQuestion[] {
  if (!questionCache) {
    questionCache = readCsv("questions.csv").map((r) => ({
      question_id: r.question_id,
      product_id: r.product_id,
      shopper_first_name: r.shopper_first_name,
      question_text: r.question_text,
    }));
  }
  return questionCache;
}

export function getQuestion(questionId: string): DrafterQuestion | undefined {
  return getQuestions().find((q) => q.question_id === questionId);
}

/** Split an ingredient_list into its entries, trimmed, exactly as written on the page. */
export function splitIngredients(list: string): string[] {
  return list
    .split(/,(?![^()]*\))/)
    .map((s) => s.trim())
    .filter(Boolean);
}
