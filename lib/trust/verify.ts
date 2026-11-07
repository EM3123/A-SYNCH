/**
 * verifyBrief: the model proposes, the Trust Layer verifies.
 *
 * Takes any candidate Situation Brief (from the live model or the fixed
 * fallback) and returns a brief that is safe to show, with every claim's
 * trust label recomputed by deterministic checks. Labels can only go down,
 * never up. If the proof is incomplete, the result hands off to a human.
 */
import { createHash, randomUUID } from "node:crypto";
import type {
  AskMode,
  BriefClaim,
  Evidence,
  SecurityEvent,
  SituationBrief,
  TrustDecision,
} from "@/lib/contracts";
import { ATLAS_EVIDENCE, ATLAS_PEOPLE, findEvidence, getMetadata } from "@/lib/trust/context";
import {
  canAccess,
  detectAuthorityRequest,
  evidenceBlob,
  findApprovalClaims,
  findLeaks,
  findPersonaViolations,
  hasApprovalRecord,
  isQuarantined,
  isStale,
  scanInjection,
  shortDate,
  soundsPredictive,
  supportRatio,
} from "@/lib/trust/checks";
import { MIN_SUPPORT, trustNow } from "@/lib/trust/policy";

export interface VerifyInput {
  /** The model's (or fallback's) brief. May be malformed; that's handled. */
  candidate: unknown;
  question: string;
  requesterId: string;
  mode: AskMode;
  personId?: string;
  /** Evidence the context agents actually returned for this request. */
  sources: Evidence[];
  /** Every record in the system, for existence and leak checks. Defaults to Project Atlas. */
  allEvidence?: Evidence[];
  now?: Date;
}

export interface AuditCheck {
  check:
    | "schema"
    | "question-injection"
    | "authority-request"
    | "citations"
    | "permissions"
    | "untrusted-source"
    | "freshness"
    | "support"
    | "prediction-labeling"
    | "approval-claims"
    | "persona"
    | "leaks"
    | "conflicts";
  result: "pass" | "warn" | "fail";
  evidenceIds?: string[];
  detail?: string;
}

/** Audit trace: ids, rule names and decisions only. Never evidence text or the question text. */
export interface TrustAudit {
  traceId: string;
  checkedAt: string;
  requesterId: string;
  mode: AskMode;
  personId?: string;
  questionSha256: string;
  citedEvidenceIds: string[];
  /** Whose work this answer drew on, so owners can see what's asked about their work. */
  ownerIds: string[];
  removedClaims: number;
  decision: TrustDecision;
  requiresHuman: boolean;
  checks: AuditCheck[];
}

export interface VerifyResult {
  brief: SituationBrief;
  securityEvents: SecurityEvent[];
  audit: TrustAudit;
}

const RANK: Record<TrustDecision, number> = { "needs-human": 0, supported: 1, confirmed: 2 };
const lowest = (...values: TrustDecision[]) =>
  values.reduce((a, b) => (RANK[a] <= RANK[b] ? a : b));

// ---------------------------------------------------------------------------
// Schema validation: invalid structured output fails safely
// ---------------------------------------------------------------------------
const DECISIONS = new Set(["confirmed", "supported", "needs-human"]);
const NODE_STATES = new Set(["done", "next", "blocked"]);
const isString = (value: unknown): value is string => typeof value === "string";
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);

export function validateBrief(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["brief is not an object"];
  const brief = value as Record<string, unknown>;
  for (const field of ["title", "answer", "status", "nextStep", "ownerId"]) {
    if (!isString(brief[field]) || !(brief[field] as string).trim()) errors.push(`${field} must be a non-empty string`);
  }
  if (!Array.isArray(brief.claims)) errors.push("claims must be an array");
  else
    brief.claims.forEach((claim, index) => {
      const c = claim as Record<string, unknown>;
      if (!c || !isString(c.text)) errors.push(`claims[${index}].text must be a string`);
      if (!c || !isStringArray(c.evidenceIds)) errors.push(`claims[${index}].evidenceIds must be a string array`);
      if (!c || !DECISIONS.has(c.trust as string)) errors.push(`claims[${index}].trust is invalid`);
    });
  if (!Array.isArray(brief.relevantPeople)) errors.push("relevantPeople must be an array");
  if (!Array.isArray(brief.decisionTree)) errors.push("decisionTree must be an array");
  else
    brief.decisionTree.forEach((node, index) => {
      const n = node as Record<string, unknown>;
      if (!n || !isString(n.label) || !isString(n.reason) || !NODE_STATES.has(n.state as string)) {
        errors.push(`decisionTree[${index}] is invalid`);
      }
    });
  if (!isStringArray(brief.downstreamBlockers)) errors.push("downstreamBlockers must be a string array");
  if (!isStringArray(brief.conflicts)) errors.push("conflicts must be a string array");
  const trust = brief.trust as Record<string, unknown> | undefined;
  if (!trust || !DECISIONS.has(trust.decision as string) || !isStringArray(trust.reasons) || typeof trust.requiresHuman !== "boolean") {
    errors.push("trust must have decision, reasons[] and requiresHuman");
  }
  return errors;
}

/** Parse raw model text (e.g. from OpenRouter) and validate it. Returns null when unusable. */
export function parseModelBrief(raw: string): SituationBrief | null {
  try {
    const value = JSON.parse(raw);
    return validateBrief(value).length ? null : (value as SituationBrief);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Safe handoff brief: shown whenever an answer can't be shown safely
// ---------------------------------------------------------------------------
export function safeHandoffBrief(ownerId: string, reason: string): SituationBrief {
  const owner = ATLAS_PEOPLE.find((person) => person.id === ownerId) ?? ATLAS_PEOPLE[0];
  return {
    title: "Needs human review",
    answer: `A-SYNCH couldn't verify an answer it can safely show you, so this goes to ${owner.name} instead of guessing.`,
    status: "Needs human review",
    claims: [],
    relevantPeople: [],
    decisionTree: [{ label: "Verify answer", state: "blocked", reason }],
    nextStep: `Send the question to ${owner.name}.`,
    ownerId: owner.id,
    downstreamBlockers: [],
    conflicts: [],
    trust: { decision: "needs-human", reasons: [reason], requiresHuman: true },
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
export function verifyBrief(input: VerifyInput): VerifyResult {
  const now = input.now ?? trustNow();
  const allEvidence = input.allEvidence ?? ATLAS_EVIDENCE;
  const checks: AuditCheck[] = [];
  const reasons: string[] = [];
  const securityEvents: SecurityEvent[] = [];
  let blocked = false; // forces needs-human
  let removedClaims = 0;

  const fallbackOwner = input.personId && ATLAS_PEOPLE.some((p) => p.id === input.personId) ? input.personId : "priya";
  const finish = (brief: SituationBrief): VerifyResult => ({
    brief,
    securityEvents,
    audit: {
      traceId: randomUUID(),
      checkedAt: now.toISOString(),
      requesterId: input.requesterId,
      mode: input.mode,
      personId: input.personId,
      questionSha256: createHash("sha256").update(input.question).digest("hex").slice(0, 16),
      citedEvidenceIds: [...new Set(brief.claims.flatMap((claim) => claim.evidenceIds))],
      ownerIds: [
        ...new Set(
          brief.claims
            .flatMap((claim) => claim.evidenceIds)
            .map((id) => findEvidence(id, allEvidence)?.ownerId)
            .filter((id): id is string => Boolean(id)),
        ),
      ],
      removedClaims,
      decision: brief.trust.decision,
      requiresHuman: brief.trust.requiresHuman,
      checks,
    },
  });

  // 1. Schema ---------------------------------------------------------------
  const schemaErrors = validateBrief(input.candidate);
  if (schemaErrors.length) {
    checks.push({ check: "schema", result: "fail", detail: schemaErrors.slice(0, 5).join("; ") });
    return finish(safeHandoffBrief(fallbackOwner, "The model's answer didn't match the Situation Brief format."));
  }
  checks.push({ check: "schema", result: "pass" });
  const candidate = input.candidate as SituationBrief;

  // 2. Question-level checks ------------------------------------------------
  const questionInjection = scanInjection(input.question);
  if (questionInjection.length) {
    blocked = true;
    reasons.push("The question contained instructions aimed at the AI; they were not followed.");
    checks.push({ check: "question-injection", result: "fail", detail: questionInjection.join(",") });
  } else checks.push({ check: "question-injection", result: "pass" });

  const authorityRules = detectAuthorityRequest(input.question);
  if (authorityRules.length) {
    blocked = true;
    reasons.push("A context agent cannot approve, act, change access or speak for a person.");
    checks.push({ check: "authority-request", result: "fail", detail: authorityRules.join(",") });
    securityEvents.push({ type: "authority-boundary", label: "The context agent refused to claim human approval" });
  } else checks.push({ check: "authority-request", result: "pass" });

  // 3. Claims ---------------------------------------------------------------
  const sourceIds = new Set(input.sources.map((item) => item.id));
  const keptClaims: BriefClaim[] = [];
  const unknownIds: string[] = [];
  const forbiddenIds: string[] = [];
  const untrustedIds: string[] = [];
  const staleOnly: string[] = [];
  let weakSupport = 0;
  let relabeled = 0; // claims the model called "confirmed" that are really guidance

  for (const claim of candidate.claims) {
    if (!claim.evidenceIds.length) {
      removedClaims += 1;
      continue;
    }
    const cited: Evidence[] = [];
    let drop = false;
    for (const id of claim.evidenceIds) {
      const item = findEvidence(id, allEvidence);
      if (!item) {
        unknownIds.push(id);
        drop = true;
      } else if (!canAccess(item, input.requesterId)) {
        forbiddenIds.push(id);
        drop = true;
      } else if (isQuarantined(item)) {
        untrustedIds.push(id);
        drop = true;
      } else {
        cited.push(item);
      }
    }
    if (drop) {
      removedClaims += 1;
      continue;
    }

    let trust: TrustDecision = "confirmed";
    // Facts and owner-approved principles can be confirmed; everything else is guidance.
    if (cited.some((item) => item.kind === "prediction" || !item.ownerApproved || item.securityFlags?.includes("unverified"))) {
      trust = "supported";
    }
    if (soundsPredictive(claim.text)) trust = "supported";
    if (cited.every((item) => isStale(item, now))) {
      trust = "needs-human";
      staleOnly.push(...cited.map((item) => item.id));
    }
    const ratio = supportRatio(claim.text, cited.map(evidenceBlob).join(" "));
    const needed = lowest(trust, claim.trust) === "confirmed" ? MIN_SUPPORT.confirmed : MIN_SUPPORT.supported;
    if (ratio < needed) {
      trust = "needs-human";
      weakSupport += 1;
    }
    if (claim.trust === "confirmed" && trust === "supported") relabeled += 1;
    keptClaims.push({ text: claim.text, evidenceIds: claim.evidenceIds, trust: lowest(trust, claim.trust) });
  }

  const citationProblem = removedClaims > 0;
  checks.push({
    check: "citations",
    result: unknownIds.length || candidate.claims.some((c) => !c.evidenceIds.length) ? "fail" : "pass",
    evidenceIds: unknownIds.length ? unknownIds : undefined,
  });
  checks.push({ check: "permissions", result: forbiddenIds.length ? "fail" : "pass", evidenceIds: forbiddenIds.length ? forbiddenIds : undefined });
  checks.push({ check: "untrusted-source", result: untrustedIds.length ? "fail" : "pass", evidenceIds: untrustedIds.length ? untrustedIds : undefined });
  checks.push({ check: "freshness", result: staleOnly.length ? "warn" : "pass", evidenceIds: staleOnly.length ? staleOnly : undefined });
  checks.push({ check: "support", result: weakSupport ? "fail" : "pass", detail: weakSupport ? `${weakSupport} claim(s) not backed by their sources` : undefined });
  checks.push({
    check: "prediction-labeling",
    result: relabeled ? "warn" : "pass",
    detail: relabeled ? `${relabeled} claim(s) relabeled from confirmed to supported` : undefined,
  });

  if (citationProblem) {
    blocked = true;
    reasons.push(`${removedClaims} claim(s) were removed because their evidence was missing, inaccessible or untrusted.`);
  }
  if (untrustedIds.length) {
    for (const id of new Set(untrustedIds)) {
      securityEvents.push({ type: "untrusted-source-ignored", label: "A claim citing instruction-like content was removed", evidenceId: id });
    }
  }
  if (staleOnly.length) reasons.push("Some claims rely only on out-of-date sources.");
  if (weakSupport) reasons.push("Some claims aren't backed by the sources they cite.");

  // 4. Text shown to the user: approval claims and leaks -------------------------
  const shownText = [
    candidate.title,
    candidate.answer,
    candidate.status,
    candidate.nextStep,
    ...keptClaims.map((claim) => claim.text),
    ...candidate.decisionTree.flatMap((node) => [node.label, node.reason]),
    ...candidate.downstreamBlockers,
    ...candidate.conflicts,
  ].join("\n");

  const citedEvidence = keptClaims.flatMap((claim) => claim.evidenceIds.map((id) => findEvidence(id, allEvidence)!));
  const approvalClaims = findApprovalClaims(shownText);
  if (approvalClaims.length && !hasApprovalRecord(citedEvidence)) {
    checks.push({ check: "approval-claims", result: "fail", detail: approvalClaims.join(",") });
    securityEvents.push({ type: "authority-boundary", label: "Blocked an answer that claimed an approval no one gave" });
    return finish(safeHandoffBrief(fallbackOwner, "The answer claimed an approval with no approval record."));
  }
  checks.push({ check: "approval-claims", result: "pass" });

  // An agent never speaks as the person and never guesses feelings or risk appetite.
  const persona = findPersonaViolations(shownText);
  if (persona.length) {
    checks.push({ check: "persona", result: "fail", detail: persona.join(",") });
    securityEvents.push({ type: "authority-boundary", label: "Blocked an answer that spoke for a person or guessed their feelings" });
    return finish(safeHandoffBrief(fallbackOwner, "The answer spoke for a person or guessed how they feel."));
  }
  checks.push({ check: "persona", result: "pass" });

  const leaks = findLeaks(shownText, input.requesterId, allEvidence);
  if (leaks.length) {
    // Record that a leak was stopped, but not which restricted record it was.
    checks.push({ check: "leaks", result: "fail", detail: `${leaks.length} restricted record(s)` });
    return finish(safeHandoffBrief(fallbackOwner, "The answer referenced information you don't have access to."));
  }
  checks.push({ check: "leaks", result: "pass" });

  // 5. Conflicts among the evidence relevant to the cited facts -----------------
  const pool = [...new Map([...input.sources, ...citedEvidence].map((item) => [item.id, item])).values()]
    .filter((item) => canAccess(item, input.requesterId) && !isQuarantined(item));
  const citedKeys = new Set(citedEvidence.flatMap((item) => getMetadata(item.id).assertions.map((a) => a.key)));
  const conflictLines: string[] = [];
  let criticalConflict = false;
  for (const key of citedKeys) {
    const byValue = new Map<string, Evidence[]>();
    for (const item of pool) {
      for (const assertion of getMetadata(item.id).assertions) {
        if (assertion.key === key) byValue.set(assertion.value, [...(byValue.get(assertion.value) ?? []), item]);
      }
    }
    if (byValue.size < 2) continue;
    const freshValues = [...byValue.entries()].filter(([, items]) => items.some((item) => !isStale(item, now)));
    const staleValues = [...byValue.entries()].filter(([, items]) => items.every((item) => isStale(item, now)));
    if (freshValues.length > 1) {
      criticalConflict = true;
      conflictLines.push(
        "Current sources disagree: " +
          freshValues.map(([, items]) => `${items[0].sourceLabel} (${shortDate(items[0].timestamp)})`).join(" vs ") +
          ". A person needs to decide.",
      );
    }
    for (const [, items] of staleValues) {
      const current = freshValues[0]?.[1][0];
      const old = items[0];
      if (!current) continue;
      conflictLines.push(
        `${old.sourceLabel} (${shortDate(old.timestamp)}, out of date) conflicts with ${current.sourceLabel} (${shortDate(current.timestamp)}); the current source is used.`,
      );
      securityEvents.push({
        type: "stale-conflict",
        label: "Surfaced a stale status conflict instead of silently resolving it",
        evidenceId: old.id,
      });
    }
  }
  if (criticalConflict) {
    blocked = true;
    reasons.push("Current sources disagree and a person needs to decide.");
  } else if (conflictLines.length) {
    reasons.push("An out-of-date source conflicts with current evidence; the conflict is shown.");
  }
  checks.push({ check: "conflicts", result: criticalConflict ? "fail" : conflictLines.length ? "warn" : "pass" });

  // 6. Decision --------------------------------------------------------------
  let decision: TrustDecision = "confirmed";
  if (!keptClaims.length || blocked || keptClaims.some((claim) => claim.trust === "needs-human")) {
    decision = "needs-human";
    if (!keptClaims.length && !reasons.length) reasons.push("No verified claims answer this question.");
  } else if (keptClaims.some((claim) => claim.trust === "supported") || conflictLines.length) {
    decision = "supported";
  }
  decision = lowest(decision, candidate.trust.decision);

  const answer = citationProblem
    ? "Part of this answer couldn't be verified, so only the verified parts are shown."
    : candidate.answer;

  const brief: SituationBrief = {
    ...candidate,
    answer,
    claims: keptClaims,
    conflicts: [...new Set([...conflictLines, ...candidate.conflicts])],
    trust: {
      decision,
      reasons: [...new Set([...candidate.trust.reasons, ...reasons])],
      // Guidance about what someone would do is labeled and still goes to them to confirm.
      requiresHuman:
        decision !== "confirmed" || keptClaims.some((claim) => claim.trust !== "confirmed") || candidate.trust.requiresHuman,
    },
  };
  return finish(brief);
}
