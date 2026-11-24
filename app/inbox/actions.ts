"use server";

import { draftReply, type DraftResult } from "@/lib/draft-reply";

export async function draftAction(questionId: string): Promise<DraftResult> {
  return draftReply(questionId);
}
