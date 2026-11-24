import { getProducts, splitIngredients } from "./data";

/**
 * Latin (INCI) name -> plain name, built ONLY from the catalog itself.
 * Many entries carry a plain name in parentheses, e.g. "Prunus Amygdalus Dulcis (Sweet Almond) Oil".
 * Stripping the parentheses gives the key, so the same INCI name also resolves on pages that list it bare.
 */
const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

function stripParens(entry: string): { key: string; plain: string | null } {
  const m = entry.match(/\(([^)]*)\)/);
  const key = normalize(entry.replace(/\([^)]*\)/g, " "));
  return { key, plain: m ? m[1].trim() : null };
}

let glossary: Map<string, string> | null = null;

export function getGlossary(): Map<string, string> {
  if (!glossary) {
    glossary = new Map();
    for (const p of getProducts().values()) {
      for (const entry of splitIngredients(p.ingredient_list)) {
        const { key, plain } = stripParens(entry);
        if (plain && !glossary.has(key)) glossary.set(key, plain);
      }
    }
  }
  return glossary;
}

/** Plain name for one ingredient entry, or null if the catalog never states one. */
export function plainNameFor(entry: string): string | null {
  return getGlossary().get(stripParens(entry).key) ?? null;
}

/**
 * Proposed additions from outside the catalog. NOT used at runtime until the user approves each one.
 */
export const MANUAL_PROPOSED: { inci: string; plain: string; reason: string }[] = [
  { inci: "Ascorbic Acid", plain: "vitamin C", reason: "Shoppers ask about vitamin C; page never states the plain name (DSP-011, DSP-040)." },
  { inci: "Parfum (Fragrance)", plain: "fragrance", reason: "Already stated on the page; listed here only to flag that components are never given." },
];
