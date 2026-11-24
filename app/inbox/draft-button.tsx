"use client";

import { useState, useTransition } from "react";
import { draftAction } from "./actions";
import type { DraftResult } from "@/lib/draft-reply";

export function DraftButton({ questionId }: { questionId: string }) {
  const [result, setResult] = useState<DraftResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              setResult(await draftAction(questionId));
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to draft");
            }
          })
        }
      >
        {pending ? "Drafting..." : "Draft reply"}
      </button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {result && (
        <div style={{ marginTop: 8, padding: 8, background: "#f4f4f4" }}>
          <p style={{ margin: 0 }}>{result.reply}</p>
          <small>
            mode: {result.mode}
            {result.fallback_reason ? ` | fallback: ${result.fallback_reason}` : ""}
          </small>
        </div>
      )}
    </div>
  );
}
