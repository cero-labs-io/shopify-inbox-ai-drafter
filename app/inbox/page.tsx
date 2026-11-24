import { getProduct, getQuestions } from "@/lib/data";
import { DraftButton } from "./draft-button";

export const dynamic = "force-dynamic";

export default function InboxPage() {
  const questions = getQuestions();
  return (
    <main>
      <h1>Shopper questions</h1>
      <p>{questions.length} questions</p>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {questions.map((q) => (
          <li key={q.question_id} style={{ borderTop: "1px solid #ddd", padding: "12px 0" }}>
            <strong>{q.shopper_first_name}</strong> on {getProduct(q.product_id)?.title ?? q.product_id}{" "}
            <small>({q.question_id})</small>
            <p>{q.question_text}</p>
            <DraftButton questionId={q.question_id} />
          </li>
        ))}
      </ul>
    </main>
  );
}
