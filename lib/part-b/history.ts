import type { ConversationTurn } from "@/lib/part-b/types";

const MAX_TURNS = 16;
const MAX_TURN_CHARS = 1_200;
const MAX_TOTAL_CHARS = 8_000;

export class PerspectiveValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PerspectiveValidationError";
  }
}

export function validateConversationHistory(value: unknown): ConversationTurn[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new PerspectiveValidationError("history must be an array");
  if (value.length > MAX_TURNS) throw new PerspectiveValidationError(`history may contain at most ${MAX_TURNS} turns`);

  const history: ConversationTurn[] = [];
  let total = 0;
  for (const [index, raw] of value.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new PerspectiveValidationError(`history[${index}] must be an object`);
    }
    const turn = raw as Record<string, unknown>;
    if (turn.role !== "user" && turn.role !== "assistant") {
      throw new PerspectiveValidationError(`history[${index}].role is invalid`);
    }
    if (typeof turn.content !== "string" || !turn.content.trim()) {
      throw new PerspectiveValidationError(`history[${index}].content must be a non-empty string`);
    }
    const content = turn.content.trim();
    if (content.length > MAX_TURN_CHARS) {
      throw new PerspectiveValidationError(`history[${index}].content is too long`);
    }
    total += content.length;
    if (total > MAX_TOTAL_CHARS) throw new PerspectiveValidationError("history is too large");
    history.push({ role: turn.role, content });
  }
  return history;
}

export function historyText(history: ConversationTurn[]): string {
  return history.map((turn) => `${turn.role}: ${turn.content}`).join("\n");
}

export function resolveConversationTopic(question: string, history: ConversationTurn[]): string | null {
  const combined = `${historyText(history)}\nuser: ${question}`.toLowerCase();
  if (/atlas/.test(combined) && /beta|rollout|exposure|10%|50%/.test(combined)) return "Project Atlas beta rollout";
  if (/atlas/.test(combined) && /ga|general availability/.test(combined)) return "Project Atlas general availability";
  return null;
}
