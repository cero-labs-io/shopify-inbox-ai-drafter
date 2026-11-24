// Grading labels only. The drafter, its prompt and its fallback logic must NEVER import this file.
// NOTE: expected_answer_note is known to be unreliable (e.g. Q-001, Q-002, Q-035, Q-114).
// Rebuild the answer key from the product pages before using it for grading.
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

export type EvalLabel = {
  question_id: string;
  question_category: string;
  ingredient_mentioned: string;
  answerable_from_page: boolean;
  expected_answer_note: string;
};

export function getEvalLabels(): EvalLabel[] {
  const raw = readFileSync(path.join(process.cwd(), "data", "questions.csv"), "utf8");
  const rows: Record<string, string>[] = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
  return rows.map((r) => ({
    question_id: r.question_id,
    question_category: r.question_category,
    ingredient_mentioned: r.ingredient_mentioned,
    answerable_from_page: r.answerable_from_page === "true",
    expected_answer_note: r.expected_answer_note,
  }));
}
