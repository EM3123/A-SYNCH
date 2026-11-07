import { detectAuthorityRequest } from "@/lib/trust/checks";
import type { ConversationTurn, PerspectiveIntent } from "@/lib/part-b/types";
import { resolveConversationTopic } from "@/lib/part-b/history";

export function classifyPerspectiveTurn(question: string, history: ConversationTurn[]): PerspectiveIntent {
  const lower = question.toLowerCase();
  if (detectAuthorityRequest(question).length) return "authority-request";
  if (/risk[- ]averse|risk appetite|risk tolerance|personality|how (does|would) .* feel/.test(lower)) return "generalized-inference";
  if (/why\s+(10|ten)\s*%?.*(50|fifty)|why.*not\s+(50|fifty)|blast radius/.test(lower)) return "exposure-rationale";
  if (/what.*(increase|expand|scale)|make.*(increase|expand|scale)|comfortable increasing|raise (it|the rollout)/.test(lower)) {
    return resolveConversationTopic(question, history) ? "scale-conditions" : "missing-context";
  }
  if (/what remains|still blocked|remaining blockers|what.*blocked/.test(lower)) return "remaining-blockers";
  if (/beta.*(ga|general availability)|(ga|general availability).*beta|different proof|evidence threshold/.test(lower)) return "beta-vs-ga";
  if (/uncertain|uncertainty|don.t know|unknown/.test(lower)) return "known-uncertainty";
  if (/(10|ten)\s*%.*beta|support.*beta|beta.*today/.test(lower)) return "initial-beta-guidance";
  if (/status|ready|merged|test|what happened|who owns/.test(lower)) return "factual-context";
  if (/should|tradeoff|priority|principle|approach|evaluate|recommend/.test(lower)) return "perspective";
  return "missing-context";
}
