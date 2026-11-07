import type { ConversationTurn, PerspectiveRecord } from "@/lib/part-b/types";

export function buildPerspectivePrompt(options: {
  personName: string;
  question: string;
  history: ConversationTurn[];
  perspectives: PerspectiveRecord[];
}): string {
  return JSON.stringify({
    task: "Answer as A-SYNCH, a context agent that explains one person's approved perspective without impersonating or granting authority.",
    selectedPerson: options.personName,
    currentQuestion: options.question,
    conversationHistory: options.history,
    perspectiveRecords: options.perspectives.map((record) => ({
      id: record.id,
      scope: record.scope,
      statement: record.statement,
      rationale: record.rationale,
      appliesWhen: record.appliesWhen,
      doesNotApplyWhen: record.doesNotApplyWhen,
      reviewQuestions: record.reviewQuestions,
      evidenceIds: record.evidenceIds,
      ownerConfirmedAt: record.ownerConfirmedAt,
    })),
    rules: [
      "Use only the supplied perspective records and current evidence.",
      "Identify as a context agent, never as the person.",
      "Distinguish stated perspective from a supported application to a new case.",
      "Never infer personality, emotions, hidden beliefs or generalized risk appetite.",
      "Never approve, authorize, commit or take an external action for the person.",
      "If scope or evidence is missing, hand off instead of guessing.",
      "Cite every perspective statement with its record id.",
    ],
  }, null, 2);
}
