import { randomUUID } from "node:crypto";
import type {
  AskRequest,
  AskResponse,
  AskMode,
  RoutingEvent,
  SecurityEvent,
} from "@/lib/contracts";
import { DEMO_REQUESTER_ID, PEOPLE } from "@/lib/agents/demo-context";
import { gatherContributions, routeToPeople } from "@/lib/agents/router";
import { synthesizeBrief } from "@/lib/agents/synthesizer";

export class AskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AskValidationError";
  }
}

export function listPeople() {
  return PEOPLE;
}

export interface AskBackendOptions {
  onEvent?: (event: RoutingEvent) => void;
}

export async function askAsynch(
  input: AskRequest,
  options: AskBackendOptions = {},
): Promise<AskResponse> {
  const startedAt = Date.now();
  const question = input.question?.trim();
  if (!question) throw new AskValidationError("question is required");
  if (question.length > 1_500) {
    throw new AskValidationError("question must be 1,500 characters or fewer");
  }

  const mode: AskMode = input.mode === "person" ? "person" : "team";
  if (mode === "person" && !input.personId) {
    throw new AskValidationError("personId is required for person mode");
  }

  const primaryPeople = routeToPeople({
    question,
    mode,
    personId: input.personId,
    limit: 5,
  });
  if (!primaryPeople.length) {
    throw new AskValidationError("No matching person was found");
  }

  // Part B is a direct entry point, but the selected person's agent still
  // assembles a current Situation Brief from relevant teammates in the
  // background. The selected person remains first for UI presentation.
  const backgroundPeople =
    mode === "person"
      ? routeToPeople({ question, mode: "team", limit: 4 })
      : [];
  const selectedPeople = [...primaryPeople, ...backgroundPeople].filter(
    (person, index, people) =>
      people.findIndex((candidate) => candidate.id === person.id) === index,
  );

  const routeEvents: RoutingEvent[] = selectedPeople.map((person) => ({
    type: "route",
    label: `Routing to ${person.name}'s context agent`,
    personId: person.id,
  }));
  routeEvents.forEach((event) => options.onEvent?.(event));

  const requesterId = input.requesterId || DEMO_REQUESTER_ID;
  const contributions = await gatherContributions({
    people: selectedPeople,
    question,
    requesterId,
  });

  const evidenceEvents: RoutingEvent[] = contributions.map((contribution) => ({
      type: "evidence" as const,
      label: `${contribution.person.name} returned ${contribution.evidence.length} evidence packet${contribution.evidence.length === 1 ? "" : "s"}`,
      personId: contribution.person.id,
      evidenceCount: contribution.evidence.length,
    }));
  evidenceEvents.forEach((event) => options.onEvent?.(event));

  const synthesisEvent: RoutingEvent = {
    type: "synthesis",
    label: "Assembling one evidence-backed Situation Brief",
  };
  options.onEvent?.(synthesisEvent);

  const securityEvents: SecurityEvent[] = contributions.flatMap((contribution) =>
    contribution.ignoredEvidence.map((evidence) => ({
      type: "untrusted-source-ignored" as const,
      label: `Ignored instruction-like content in ${evidence.sourceLabel}`,
      evidenceId: evidence.id,
    })),
  );

  if (contributions.some((contribution) => contribution.evidence.some((item) => item.stale))) {
    securityEvents.push({
      type: "stale-conflict",
      label: "Surfaced a stale status conflict instead of silently resolving it",
      evidenceId: "stale-launch-status",
    });
  }

  const synthesis = await synthesizeBrief({
    question,
    mode,
    personId: input.personId,
    contributions,
  });

  const trustEvent: RoutingEvent = {
    type: "trust",
    label: "Checking evidence, conflicts, permissions, and authority",
  };
  options.onEvent?.(trustEvent);

  const routingEvents: RoutingEvent[] = [
    ...routeEvents,
    ...evidenceEvents,
    synthesisEvent,
    trustEvent,
  ];

  if (synthesis.brief.trust.decision === "needs-human") {
    securityEvents.push({
      type: "authority-boundary",
      label: "The context agent refused to claim human approval",
    });
  }

  return {
    requestId: randomUUID(),
    mode,
    question,
    selectedPeople,
    sources: contributions.flatMap((contribution) => contribution.evidence),
    brief: synthesis.brief,
    routingEvents,
    securityEvents,
    meta: {
      usedFallback: synthesis.usedFallback,
      model: synthesis.model,
      durationMs: Date.now() - startedAt,
    },
  };
}
