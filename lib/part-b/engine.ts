import { randomUUID } from "node:crypto";
import { DEMO_REQUESTER_ID, EVIDENCE, getPerson } from "@/lib/agents/demo-context";
import type { AskResponse, Evidence, SecurityEvent, SituationBrief } from "@/lib/contracts";
import { classifyPerspectiveTurn } from "@/lib/part-b/classify";
import {
  ALL_PART_B_EVIDENCE,
  findPerspectiveLeaks,
  retrievePerspective,
} from "@/lib/part-b/data";
import {
  PerspectiveValidationError,
  resolveConversationTopic,
  validateConversationHistory,
} from "@/lib/part-b/history";
import type {
  ConversationTurn,
  PerspectiveIntent,
  PerspectiveRecord,
} from "@/lib/part-b/types";
import { canAccess, isQuarantined } from "@/lib/trust/checks";
import { trustNow } from "@/lib/trust/policy";
import { safeHandoffBrief, verifyBrief } from "@/lib/trust/verify";

export interface AskPerspectiveOptions {
  personId: string;
  question: string;
  history?: unknown;
  requesterId?: string;
  now?: Date;
}

const idsForIntent: Partial<Record<PerspectiveIntent, string[]>> = {
  "initial-beta-guidance": ["priya-beta-reversible", "priya-initial-exposure", "priya-accessibility-boundary"],
  "exposure-rationale": ["priya-initial-exposure", "priya-learning-signal", "priya-scale-conditions"],
  "scale-conditions": ["priya-scale-conditions", "priya-stop-conditions", "priya-known-uncertainty"],
  "remaining-blockers": ["priya-accessibility-boundary", "priya-beta-vs-ga", "priya-human-confirmation"],
  "beta-vs-ga": ["priya-beta-vs-ga", "priya-beta-reversible"],
  "known-uncertainty": ["priya-known-uncertainty", "priya-no-silent-assumptions"],
  "authority-request": ["priya-human-confirmation", "priya-review-sequence"],
};

const sourceById = (id: string) => ALL_PART_B_EVIDENCE.find((source) => source.id === id);

function uniqueSources(sources: Array<Evidence | undefined>): Evidence[] {
  return [...new Map(sources.filter((source): source is Evidence => Boolean(source)).map((source) => [source.id, source])).values()];
}

function relatedSources(records: PerspectiveRecord[], requesterId: string): Evidence[] {
  return uniqueSources(records.flatMap((record) => record.evidenceIds.map(sourceById)))
    .filter((source) => canAccess(source, requesterId) && !isQuarantined(source));
}

function baseBrief(options: {
  title: string;
  answer: string;
  status: string;
  ownerId: string;
  records: PerspectiveRecord[];
  claims: SituationBrief["claims"];
  nextStep: string;
  trust: SituationBrief["trust"];
  decisionTree?: SituationBrief["decisionTree"];
  blockers?: string[];
}): SituationBrief {
  return {
    title: options.title,
    answer: options.answer,
    status: options.status,
    claims: options.claims,
    relevantPeople: [{
      personId: options.ownerId,
      reason: "Owns the stated reasoning and decision boundary used in this conversation",
      evidenceIds: options.records.map((record) => record.id),
    }],
    decisionTree: options.decisionTree ?? [],
    nextStep: options.nextStep,
    ownerId: options.ownerId,
    downstreamBlockers: options.blockers ?? [],
    conflicts: [],
    trust: options.trust,
  };
}

function priyaBrief(intent: PerspectiveIntent, records: PerspectiveRecord[], topic: string | null): SituationBrief {
  const ids = new Set(records.map((record) => record.id));
  const has = (id: string) => ids.has(id);
  const claim = (id: string, text: string, trust: "confirmed" | "supported" = "confirmed") =>
    has(id) ? [{ text, evidenceIds: [id], trust }] : [];

  if (intent === "authority-request") {
    return baseBrief({
      title: "Priya's confirmation is required",
      answer: `I am Priya's context agent. I can explain the conditions and prepare the decision brief, but I cannot approve, authorize, or commit on Priya's behalf.${topic ? ` The current topic is ${topic}.` : ""}`,
      status: "Human confirmation required",
      ownerId: "priya",
      records,
      claims: claim("priya-human-confirmation", "Only Priya can confirm an Atlas launch stage; the context agent may explain conditions but may not approve, authorize, or commit on her behalf."),
      nextStep: "Send Priya a confirmation request with the 10% beta plan, rollback owner, success signals, and kill-switch status.",
      trust: { decision: "needs-human", reasons: ["Approval and external action remain with Priya"], requiresHuman: true },
      decisionTree: [
        { label: "Explain approved decision criteria", state: "done", reason: "The context agent can cite Priya's confirmed principles." },
        { label: "Prepare confirmation request", state: "next", reason: "The decision brief can be handed to Priya without restating context." },
        { label: "Confirm launch stage", state: "blocked", reason: "Only Priya can approve this decision." },
      ],
      blockers: ["The rollout remains unapproved until Priya responds"],
    });
  }

  if (intent === "exposure-rationale") {
    return baseBrief({
      title: "Why start at 10%, not 50%",
      answer: "Priya's stated rollout reasoning favors the smallest exposure that produces a useful customer signal. Ten percent limits the initial blast radius while the team proves rollback ownership, observable success and failure signals, and the kill switch. Fifty percent is too large before those controls have worked with real traffic. This is supported guidance from her confirmed reasoning, not approval.",
      status: "Supported application of stated rollout reasoning",
      ownerId: "priya",
      records,
      claims: [
        ...claim("priya-initial-exposure", "Start Atlas at 10% of the approved design-partner cohort when that exposure is enough to produce a useful customer signal."),
        ...claim("priya-scale-conditions", "Increase Atlas exposure only after the rollback owner is named, the kill switch is tested, and success and failure signals are observable.", "supported"),
      ],
      nextStep: "Define the 10% cohort's learning signal and name the rollback owner before requesting confirmation.",
      trust: { decision: "supported", reasons: ["The recommendation applies confirmed rollout reasoning to this exact percentage"], requiresHuman: true },
      decisionTree: [
        { label: "Choose a useful learning signal", state: "done", reason: "The three design partners provide representative workflows." },
        { label: "Prove rollback and observability", state: "next", reason: "These controls must work before exposure increases." },
        { label: "Increase beyond 10%", state: "blocked", reason: "Requires stable signals and Priya's confirmation." },
      ],
    });
  }

  if (intent === "scale-conditions") {
    return baseBrief({
      title: "Conditions for increasing the rollout",
      answer: "Priya's confirmed criteria are: name the rollback owner, test the kill switch end to end, make success and failure signals observable, and show that the first cohort is stable without disproportionate support work. If a stop condition fires, do not increase exposure. Priya still needs to confirm the next launch stage.",
      status: "Conditions are stated; scale-up is not approved",
      ownerId: "priya",
      records,
      claims: [
        ...claim("priya-scale-conditions", "Increase Atlas exposure only after the rollback owner is named, the kill switch is tested, and success and failure signals are observable."),
        ...claim("priya-known-uncertainty", "The largest current uncertainty is whether support burden grows faster than customer value as exposure increases.", "supported"),
      ],
      nextStep: "Attach the rollback owner, kill-switch test, beta metrics, and support burden to Priya's confirmation request.",
      trust: { decision: "supported", reasons: ["The conditions are stated perspective, but applying them to a scale-up remains guidance"], requiresHuman: true },
      decisionTree: [
        { label: "Name rollback owner", state: "next", reason: "Someone must be accountable for stopping exposure." },
        { label: "Test kill switch and observe signals", state: "next", reason: "The team must detect and contain harm." },
        { label: "Increase exposure", state: "blocked", reason: "Requires stable evidence and Priya's confirmation." },
      ],
    });
  }

  if (intent === "remaining-blockers") {
    return baseBrief({
      title: "What remains blocked",
      answer: "For a reversible design-partner beta, Sam must fix the keyboard-focus check and merge the rollout control, then Priya must confirm the launch stage. General availability additionally waits on ATLAS-38 and enterprise SSO verification.",
      status: "Beta has one engineering dependency and one human decision",
      ownerId: "priya",
      records,
      claims: [
        { text: "The percentage rollout control is open and not merged because one accessibility check is still failing.", evidenceIds: ["gh-pr-219"], trust: "confirmed" },
        { text: "Security review remains open and enterprise SSO verification is required before general availability.", evidenceIds: ["jira-atlas-38"], trust: "confirmed" },
      ],
      nextStep: "Merge PR #219, then send Priya the beta confirmation brief.",
      trust: { decision: "confirmed", reasons: ["The remaining dependencies are current project facts"], requiresHuman: true },
      blockers: ["Design partners cannot receive beta access until rollout control is ready", "GA waits on security and SSO"],
    });
  }

  if (intent === "beta-vs-ga") {
    return baseBrief({
      title: "Beta and GA use different evidence thresholds",
      answer: "Priya's stated principle separates a contained, reversible beta from general availability. The beta needs informed participants, rollout controls, and a rollback path. GA additionally needs the security review and enterprise SSO verification because it creates a broader customer promise.",
      status: "Stated launch-stage perspective",
      ownerId: "priya",
      records,
      claims: claim("priya-beta-vs-ga", "A design-partner beta needs reversible controls and informed participants; general availability additionally requires the security review and enterprise SSO verification."),
      nextStep: "Decide which launch stage is under review before applying its evidence threshold.",
      trust: { decision: "confirmed", reasons: ["This is an owner-confirmed launch principle within its stated scope"], requiresHuman: false },
    });
  }

  if (intent === "known-uncertainty") {
    return baseBrief({
      title: "Known uncertainty before scale-up",
      answer: "Priya explicitly identified support burden as the largest current uncertainty: a small cohort can look successful while manual help hides a workflow that will not scale. The beta should measure interventions per successful workflow before exposure increases.",
      status: "Owner-stated uncertainty",
      ownerId: "priya",
      records,
      claims: claim("priya-known-uncertainty", "The largest current uncertainty is whether support burden grows faster than customer value as exposure increases."),
      nextStep: "Measure manual support interventions per completed workflow in the first cohort.",
      trust: { decision: "confirmed", reasons: ["The uncertainty was explicitly stated by Priya"], requiresHuman: false },
    });
  }

  if (intent === "initial-beta-guidance") {
    return baseBrief({
      title: "Priya's stated rollout perspective",
      answer: "Priya's context agent can share that her confirmed principles support a reversible design-partner beta before enterprise SSO is complete. A 10% initial exposure appears consistent with her blast-radius and learning-signal criteria once the rollout control merges. This is supported guidance, not Priya's approval.",
      status: "Supported guidance; confirmation still required",
      ownerId: "priya",
      records,
      claims: [
        ...claim("priya-beta-reversible", "A reversible design-partner beta may start before enterprise SSO, but general availability may not."),
        ...claim("priya-initial-exposure", "A 10% initial exposure appears consistent with the confirmed goal of limiting blast radius while producing a useful customer signal.", "supported"),
      ],
      nextStep: "Merge the rollout control, attach the 10% cohort and rollback plan, then ask Priya to confirm.",
      trust: { decision: "supported", reasons: ["The 10% recommendation applies stated reasoning to a new decision"], requiresHuman: true },
      decisionTree: [
        { label: "Reversible beta principle", state: "done", reason: "Priya confirmed this launch-stage boundary." },
        { label: "Merge rollout control", state: "next", reason: "PR #219 still has a failing accessibility check." },
        { label: "Confirm 10% beta", state: "blocked", reason: "Only Priya can confirm the launch stage." },
      ],
    });
  }

  return baseBrief({
    title: "Needs a more specific perspective question",
    answer: "I am a context agent and I do not have enough owner-confirmed perspective in the requested scope to answer without guessing. Ask about a documented principle, tradeoff, review condition, or current Atlas decision.",
    status: "Perspective not available",
    ownerId: "priya",
    records,
    claims: [],
    nextStep: "Ask Priya directly or restate the decision and scope.",
    trust: { decision: "needs-human", reasons: ["No scoped owner-confirmed perspective answers this question"], requiresHuman: true },
  });
}

function generalBrief(personId: string, records: PerspectiveRecord[]): SituationBrief {
  const record = records[0];
  if (!record) return safeHandoffBrief(personId, "No current owner-confirmed perspective matched this question.");
  return baseBrief({
    title: record.title,
    answer: `This context agent can share the following owner-confirmed perspective within the scope “${record.scope}”: ${record.statement} ${record.rationale}`,
    status: "Stated perspective",
    ownerId: personId,
    records: [record],
    claims: [{ text: record.statement, evidenceIds: [record.id], trust: "confirmed" }],
    nextStep: record.reviewQuestions[0] ?? "Check whether the stated scope matches the current decision.",
    trust: { decision: "confirmed", reasons: ["The response quotes an owner-confirmed perspective within its scope"], requiresHuman: false },
  });
}

function shownBriefText(brief: SituationBrief): string {
  return [brief.title, brief.answer, brief.status, brief.nextStep, ...brief.claims.map((item) => item.text), ...brief.conflicts].join("\n");
}

function uniqueSecurityEvents(events: SecurityEvent[]): SecurityEvent[] {
  return [...new Map(events.map((event) => [
    `${event.type}:${event.evidenceId ?? event.label}`,
    event,
  ])).values()];
}

export async function askPerspective(options: AskPerspectiveOptions): Promise<AskResponse> {
  const startedAt = Date.now();
  const question = options.question?.trim();
  if (!question) throw new PerspectiveValidationError("question is required");
  if (question.length > 1_500) throw new PerspectiveValidationError("question must be 1,500 characters or fewer");
  const history = validateConversationHistory(options.history);
  const person = getPerson(options.personId);
  if (!person) throw new PerspectiveValidationError("No matching person was found");

  // Demo identity is resolved server-side. A caller cannot claim to be an owner.
  const requesterId = options.requesterId ?? DEMO_REQUESTER_ID;
  const intent = classifyPerspectiveTurn(question, history);
  const resolvedTopic = resolveConversationTopic(question, history);
  const requestedIds = person.id === "priya" ? idsForIntent[intent] : undefined;
  const retrieved = retrievePerspective({
    personId: person.id,
    requesterId,
    query: `${history.map((turn) => turn.content).join(" ")} ${question}`,
    ids: requestedIds,
    limit: 4,
    now: options.now,
  });
  let candidate = person.id === "priya"
    ? priyaBrief(intent, retrieved.records, resolvedTopic)
    : generalBrief(person.id, retrieved.records);

  if (intent === "generalized-inference") {
    candidate = baseBrief({
      title: "Needs the person's stated perspective",
      answer: "I cannot infer a person's personality, feelings, or generalized risk posture. I can only share scoped reasoning they explicitly stated and confirmed.",
      status: "Unsupported inference refused",
      ownerId: person.id,
      records: retrieved.records,
      claims: [],
      nextStep: `Ask ${person.name} for a scoped principle about this decision.`,
      trust: { decision: "needs-human", reasons: ["The question asks for an unstated generalized inference"], requiresHuman: true },
    });
  }

  if (findPerspectiveLeaks(shownBriefText(candidate), requesterId).length) {
    candidate = safeHandoffBrief(person.id, "The proposed response referenced restricted perspective.");
  }

  const contextualSources = relatedSources(retrieved.records, requesterId);
  const directlyCited = uniqueSources(candidate.claims.flatMap((item) => item.evidenceIds.map(sourceById)));
  const sources = uniqueSources([...retrieved.evidence, ...contextualSources, ...directlyCited])
    .filter((source) => canAccess(source, requesterId) && !isQuarantined(source));
  const verified = verifyBrief({
    candidate,
    question,
    requesterId,
    mode: "person",
    personId: person.id,
    sources,
    allEvidence: ALL_PART_B_EVIDENCE,
    now: options.now ?? trustNow(),
  });
  const ignoredEvents: SecurityEvent[] = retrieved.ignored.map((source) => ({
    type: "untrusted-source-ignored",
    label: "Ignored instruction-like content in an imported perspective record",
    evidenceId: source.id,
  }));

  return {
    requestId: randomUUID(),
    mode: "person",
    question,
    selectedPeople: [person],
    sources,
    brief: verified.brief,
    routingEvents: [
      { type: "route", label: `Opening ${person.name}'s approved perspective`, personId: person.id },
      { type: "evidence", label: `Retrieved ${retrieved.records.length} scoped perspective record${retrieved.records.length === 1 ? "" : "s"}`, personId: person.id, evidenceCount: retrieved.records.length },
      { type: "synthesis", label: history.length ? "Resolving this turn against the active conversation" : "Starting a new perspective conversation" },
      { type: "trust", label: "Checking scope, citations, permissions, persona, and authority" },
    ],
    securityEvents: uniqueSecurityEvents([...ignoredEvents, ...verified.securityEvents]),
    meta: { usedFallback: true, durationMs: Date.now() - startedAt },
  };
}

export type { ConversationTurn };
