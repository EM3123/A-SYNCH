/**
 * Deterministic building blocks. No model calls, no randomness:
 * the same input always produces the same result.
 */
import type { Evidence } from "@/lib/contracts";
import { getMetadata, CORVID_PEOPLE } from "@/lib/trust/context";
import { FRESHNESS_HOURS, LEAK_OVERLAP, trustNow } from "@/lib/trust/policy";

// ---------------------------------------------------------------------------
// 1. Permissions
// ---------------------------------------------------------------------------
export function canAccess(evidence: Evidence, requesterId: string): boolean {
  return evidence.permittedUsers.includes("*") || evidence.permittedUsers.includes(requesterId);
}

// ---------------------------------------------------------------------------
// 0. Normalize text before scanning, so lookalike letters, zero-width
//    characters and spaced-out words can't hide an instruction
// ---------------------------------------------------------------------------
const HOMOGLYPHS: Record<string, string> = {
  "\u0430": "a", "\u0435": "e", "\u043e": "o", "\u0440": "p", "\u0441": "c", "\u0443": "y", "\u0445": "x",
  "\u0456": "i", "\u0455": "s", "\u03bf": "o", "\u03b1": "a", "\u03c1": "p", "\u03bd": "v",
};

export function normalizeForScan(text: string): string {
  let out = text.normalize("NFKC").replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "");
  out = out.replace(/[\u0430\u0435\u043e\u0440\u0441\u0443\u0445\u0456\u0455\u03bf\u03b1\u03c1\u03bd]/g, (ch) => HOMOGLYPHS[ch] ?? ch);
  // "I g n o r e" -> "Ignore": join runs of three or more single letters
  out = out.replace(/\b(?:[a-zA-Z] ){2,}[a-zA-Z]\b/g, (run) => run.replace(/ /g, ""));
  return out.replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// 2. Prompt injection: retrieved text is data, never instructions
// ---------------------------------------------------------------------------
const INJECTION_RULES: Array<[string, RegExp]> = [
  ["ignore-instructions", /\b(ignore|forget|skip)\b[^.\n]{0,40}\b(instructions|rules|directions|guidelines|policy)\b/i],
  ["disregard-instructions", /\bdisregard\b[^.\n]{0,40}\b(instructions|rules|guidelines|policy)\b/i],
  ["message-to-ai", /\b(note|message|instructions?)\s+(to|for)\s+(the\s+)?(ai|assistant|bot|llm|agent|model)\b/i],
  ["addresses-ai", /\b(ai|ai assistant|assistant|llm)\s*:/i],
  ["system-prefix", /(^|\s)system\s*:/i],
  ["assistant-must", /\b(the\s+)?(assistant|ai|bot|agent|model)\s+(must|should|will|needs to)\b/i],
  ["role-override", /\b(you are now|pretend (to be|you are)|act as (if|an?|the))\b/i],
  ["reveal-prompt", /\b(reveal|print|show|repeat)\b[^.\n]{0,20}\b(system prompt|hidden instructions|your instructions|your rules)\b/i],
  ["override-rules", /\b(override|bypass|disable)\b[^.\n]{0,20}\b(rules|instructions|safety|permissions|restrictions|filters)\b/i],
  ["relay-instruction", /\btell (anyone|everyone|whoever|the asker|the user|all users|users)\b/i],
  ["mark-approved", /\b(mark|set|flip)\b[^.\n]{0,40}\b(approved|authorized|signed off)\b/i],
  ["hidden-html-comment", /<!--[\s\S]*?-->/],
  ["jailbreak", /\b(jailbreak|dan mode|developer mode)\b/i],
];

export function scanInjection(text: string | undefined): string[] {
  if (!text) return [];
  const clean = normalizeForScan(text);
  return INJECTION_RULES.filter(([, rule]) => rule.test(clean)).map(([name]) => name);
}

export function isQuarantined(evidence: Evidence): boolean {
  return (
    Boolean(evidence.securityFlags?.includes("prompt-injection")) ||
    scanInjection(`${evidence.title}\n${evidence.text}`).length > 0
  );
}

/** Split retrieved records into usable evidence and ignored (instruction-like) records. */
export function screenEvidence(items: Evidence[]) {
  const usable: Evidence[] = [];
  const ignored: Evidence[] = [];
  for (const item of items) (isQuarantined(item) ? ignored : usable).push(item);
  return { usable, ignored };
}

// ---------------------------------------------------------------------------
// 3. Freshness
// ---------------------------------------------------------------------------
export function ageHours(evidence: Evidence, now: Date = trustNow()): number {
  return (now.getTime() - new Date(evidence.timestamp).getTime()) / 3_600_000;
}

export function isStale(evidence: Evidence, now: Date = trustNow()): boolean {
  return Boolean(evidence.stale) || ageHours(evidence, now) > FRESHNESS_HOURS[evidence.sourceType];
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// 4. Authority: no approving, committing, changing access or impersonating
// ---------------------------------------------------------------------------
const NAMES = CORVID_PEOPLE.map((person) => person.id).join("|");

const APPROVAL_REQUEST_RULES: Array<[string, RegExp]> = [
  ["asks-to-approve", /\b(can|could|will|would|please|go ahead and)\s+(you\s+)?(approve|authori[sz]e|greenlight|green-light|sign off)\b/i],
  ["approve-imperative", /(^|[.!?]\s*)(approve|authori[sz]e|green-?light|greenlight|sign off on)\b/i],
  ["ship-it", /(^|[.!?]\s*)ship it\b/i],
  ["go-ahead-request", /(^|[.!?]\s*)(please\s+)?go[ -]ahead\b/i],
  ["sign-off-on", /\bsign(-|\s)?off on\b/i],
  ["give-go-ahead", /\bgive\b[^.\n]{0,20}\b(go-ahead|go ahead|green light|approval|permission|sign-off)\b/i],
  ["on-behalf", /\bon\s+\w+'s\s+behalf\b|\bon (her|his|their) behalf\b|\bon behalf of\b/i],
  ["speak-as", new RegExp(`\\b(pretend to be|speak as|answer as|act as|reply as)\\s+(${NAMES}|her|him)\\b`, "i")],
  ["announce-approved", /\b(tell|say|announce|let)\b[^.\n]{0,40}\b(approved|authorized|signed off|green-?lit)\b/i],
  ["mark-approved", /\b(mark|set|change|flip)\b[^.\n]{0,30}\b(approved|authorized|done|complete)\b/i],
  ["change-access", /\b(grant|give me|revoke|change)\b[^.\n]{0,20}\b(access|permissions?|admin)\b/i],
  ["external-action", /\b(merge|deploy|release|launch|ship|send|post|email)\b[^.\n]{0,30}\bfor me\b/i],
];

/** Does the question ask the agent to approve, act, change access or impersonate? */
export function detectAuthorityRequest(question: string): string[] {
  const clean = normalizeForScan(question);
  // A question that asks about status ("Has Priya approved…?", "Did Priya sign off on GA?")
  // is not a request to act. Only the rules that are never status questions still apply.
  const isStatusQuestion = /^\s*(has|have|had|did|does|do|is|are|was|were|who|what|when|why|how|which)\b/i.test(clean);
  const statusSafe = new Set(["speak-as", "on-behalf", "change-access", "external-action"]);
  return APPROVAL_REQUEST_RULES.filter(([name, rule]) => (!isStatusQuestion || statusSafe.has(name)) && rule.test(clean)).map(([name]) => name);
}

const APPROVAL_CLAIM_RULES: Array<[string, RegExp]> = [
  ["agent-approves", /\b(i|we)\s+(hereby\s+|have\s+)?(approve|approved|authori[sz]e|authori[sz]ed|sign(ed)? off)\b/i],
  ["person-approved", new RegExp(`\\b(${NAMES}|she|he)\\s+(has\\s+|have\\s+)?(already\\s+)?(approved|authori[sz]ed|signed off|green-?lit)\\b`, "i")],
  ["person-said-yes", new RegExp(`\\b(${NAMES}|she|he)\\s+(has\\s+|have\\s+)?(already\\s+)?(said yes|agreed( to)?|gave (the )?go|given the go|okayed)\\b`, "i")],
  ["approved-by", new RegExp(`\\b(approved|authori[sz]ed|signed off)\\s+by\\s+(${NAMES})\\b`, "i")],
  ["launch-approved", /\b(launch|release|beta|rollout|ga|general availability|atlas)\s+(is|was|has been|is now)\s+(officially\s+)?(approved|authori[sz]ed|green-?lit)\b/i],
  ["grants-go-ahead", /\b(you can|you may|go ahead and|you're clear to|you are clear to|feel free to)\s+(ship|launch|release|deploy|roll out)\b/i],
];

/** Phrases that claim an approval exists. Allowed only with an explicit approval record. */
export function findApprovalClaims(text: string): string[] {
  return APPROVAL_CLAIM_RULES.filter(([, rule]) => rule.test(normalizeForScan(text))).map(([name]) => name);
}

export function hasApprovalRecord(evidence: Evidence[]): boolean {
  return evidence.some((item) => getMetadata(item.id).approvalRecord === true);
}

// ---------------------------------------------------------------------------
// 5. Claim support and leak detection
// ---------------------------------------------------------------------------
const STOP_WORDS = new Set(
  `a an the and or but if of to in on at by for with from as is are was were be been being it its this that
  these those has have had do does did not no yes can could will would should may might must so than then
  there their they them he she his her we our you your i me my about into over under up down out new now
  still one two also just only very which who whom what when where why how all any some each other once`.split(/\s+/),
);

function stem(word: string): string {
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

export function contentWords(text: string): Set<string> {
  const words = (text.toLowerCase().match(/[a-z0-9#][a-z0-9#-]*/g) ?? [])
    .map((word) => word.replace(/-+$/, ""))
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
    .map(stem);
  return new Set(words);
}

export function supportRatio(claim: string, evidenceText: string): number {
  const claimWords = contentWords(claim);
  if (!claimWords.size) return 0;
  const evidenceWords = contentWords(evidenceText);
  let hits = 0;
  for (const word of claimWords) if (evidenceWords.has(word)) hits += 1;
  return hits / claimWords.size;
}

export function evidenceBlob(evidence: Evidence): string {
  const owner = CORVID_PEOPLE.find((person) => person.id === evidence.ownerId);
  return `${evidence.title} ${evidence.sourceLabel} ${evidence.text} ${owner?.name ?? ""}`;
}

/** Ids of restricted records whose content shows up in text shown to this requester. */
export function findLeaks(text: string, requesterId: string, allEvidence: Evidence[]): string[] {
  const lower = text.toLowerCase();
  return allEvidence
    .filter((item) => !canAccess(item, requesterId))
    .filter((item) => {
      const terms = getMetadata(item.id).sensitiveTerms ?? [];
      const termHit = terms.some((term) =>
        new RegExp(`(^|[^a-z0-9])${term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(lower),
      );
      return termHit || supportRatio(item.text, text) >= LEAK_OVERLAP;
    })
    .map((item) => item.id);
}

// ---------------------------------------------------------------------------
// 6. Never impersonate a person, never infer feelings or risk appetite
// ---------------------------------------------------------------------------
const FULL_NAMES = CORVID_PEOPLE.flatMap((person) => [person.id, person.name.toLowerCase()]).join("|");

const IMPERSONATION_RULES: Array<[string, RegExp]> = [
  ["claims-identity", new RegExp(`\\b(i am|i'm|this is)\\s+(${FULL_NAMES})\\b(?!'s)`, "i")],
  ["speaks-as-person", new RegExp(`\\b(as|speaking as)\\s+(${FULL_NAMES}),\\s*i\\b`, "i")],
];

const INFERENCE_RULES: Array<[string, RegExp]> = [
  ["infers-feelings", new RegExp(`\\b(${NAMES}|she|he|they)\\s+(feels?|is|are|would be|seems?|sounds?)\\s+(worried|anxious|frustrated|upset|happy|comfortable|uncomfortable|nervous|confident|stressed|annoyed|excited|fine with)\\b`, "i")],
  ["infers-risk-appetite", new RegExp(`\\b(${NAMES})('s)?\\s+(risk (appetite|tolerance)|is (risk[- ]averse|risk[- ]tolerant|cautious|aggressive))\\b`, "i")],
];

/** Text that pretends to be a person, or guesses their feelings or risk appetite. */
export function findPersonaViolations(text: string): string[] {
  return [...IMPERSONATION_RULES, ...INFERENCE_RULES]
    .filter(([, rule]) => rule.test(text))
    .map(([name]) => name);
}

// ---------------------------------------------------------------------------
// 7. Predictions must not be presented as facts
// ---------------------------------------------------------------------------
const PREDICTIVE = /\b(appears?|likely|probably|should be able|consistent with|expected to|expects?|predict\w*|estimat\w*|might|seems?)\b/i;

export function soundsPredictive(text: string): boolean {
  return PREDICTIVE.test(text);
}
