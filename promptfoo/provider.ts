import { draftReply } from "../lib/draft-reply";

// promptfoo custom provider: runs the real drafter for one question_id and returns the full result JSON.
export default class DrafterProvider {
  id() {
    return "shopify-inbox-drafter";
  }
  async callApi(_prompt: string, context: { vars: Record<string, string> }) {
    try {
      const r = await draftReply(context.vars.question_id);
      return { output: JSON.stringify(r) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }
}
