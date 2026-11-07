import type {
  AgentContribution,
  AskMode,
  Evidence,
  PersonProfile,
} from "@/lib/contracts";
import { EVIDENCE, PEOPLE, getPerson } from "@/lib/agents/demo-context";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "can",
  "do",
  "for",
  "i",
  "is",
  "it",
  "of",
  "on",
  "the",
  "to",
  "today",
  "we",
  "what",
  "who",
  "why",
  "would",
]);

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9#-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS.has(token));
}

function intersectionScore(queryTokens: string[], candidate: string): number {
  const candidateTokens = new Set(tokenize(candidate));
  return queryTokens.reduce(
    (score, token) => score + (candidateTokens.has(token) ? 1 : 0),
    0,
  );
}

function personScore(person: PersonProfile, question: string): number {
  const queryTokens = tokenize(question);
  const haystack = [person.name, person.role, ...person.expertise, ...person.topics].join(
    " ",
  );
  let score = intersectionScore(queryTokens, haystack) * 4;

  const lower = question.toLowerCase();
  if (/ship|launch|atlas|release|beta/.test(lower)) score += 2;
  if (/security|sso|risk|general availability|\bga\b/.test(lower) && person.id === "jordan") {
    score += 8;
  }
  if (/backend|api|test/.test(lower) && person.id === "alex") score += 8;
  if (/frontend|rollout|ui|accessibility/.test(lower) && person.id === "sam") score += 8;
  if (/customer|partner|impact/.test(lower) && person.id === "maya") score += 8;
  if (/approve|approval|priya|principle|strategy|support/.test(lower) && person.id === "priya") {
    score += 10;
  }
  return score;
}

export function routeToPeople(options: {
  question: string;
  mode: AskMode;
  personId?: string;
  limit?: number;
}): PersonProfile[] {
  if (options.mode === "person") {
    const person = options.personId ? getPerson(options.personId) : undefined;
    return person ? [person] : [];
  }

  const ranked = PEOPLE.map((person) => ({
    person,
    score: personScore(person, options.question),
  })).sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name));

  const positive = ranked.filter((entry) => entry.score > 0);
  const chosen = positive.length >= 3 ? positive : ranked;
  return chosen.slice(0, options.limit ?? 4).map((entry) => entry.person);
}

function canAccess(evidence: Evidence, requesterId: string): boolean {
  return (
    evidence.permittedUsers.includes("*") ||
    evidence.permittedUsers.includes(requesterId)
  );
}

function evidenceScore(evidence: Evidence, question: string): number {
  const queryTokens = tokenize(question);
  const haystack = `${evidence.title} ${evidence.sourceLabel} ${evidence.text}`;
  let score = intersectionScore(queryTokens, haystack) * 3;
  if (evidence.ownerApproved) score += 2;
  if (evidence.stale) score -= 1;
  return score;
}

function explainSelection(person: PersonProfile, question: string): string {
  const lower = question.toLowerCase();
  if (person.id === "priya") return "Owns Atlas launch principles and final approval";
  if (person.id === "alex") return "Owns the Atlas backend and current test status";
  if (person.id === "sam") return "Owns the rollout controls required for a safe beta";
  if (person.id === "jordan") return "Owns the open security and SSO review";
  if (person.id === "maya") return "Knows current customer demand and launch impact";
  return `Relevant to: ${lower.slice(0, 80)}`;
}

export async function queryContextAgent(options: {
  person: PersonProfile;
  question: string;
  requesterId: string;
}): Promise<AgentContribution> {
  const owned = EVIDENCE.filter((item) => item.ownerId === options.person.id);
  const accessible = owned.filter((item) => canAccess(item, options.requesterId));
  const ignoredEvidence = accessible.filter((item) =>
    item.securityFlags?.includes("prompt-injection"),
  );

  const evidence = accessible
    .filter((item) => !item.securityFlags?.includes("prompt-injection"))
    .map((item) => ({ item, score: evidenceScore(item, options.question) }))
    .sort((a, b) => b.score - a.score || b.item.timestamp.localeCompare(a.item.timestamp))
    .slice(0, 4)
    .map((entry) => entry.item);

  return {
    person: options.person,
    reason: explainSelection(options.person, options.question),
    evidence,
    ignoredEvidence,
  };
}

export async function gatherContributions(options: {
  people: PersonProfile[];
  question: string;
  requesterId: string;
}): Promise<AgentContribution[]> {
  return Promise.all(
    options.people.map((person) =>
      queryContextAgent({
        person,
        question: options.question,
        requesterId: options.requesterId,
      }),
    ),
  );
}
