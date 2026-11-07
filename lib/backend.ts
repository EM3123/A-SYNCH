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
import { verifyBrief } from "@/lib/trust";

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

  // Demo mode: identity is always the server-side demo requester. A caller-supplied
  // requesterId is ignored, so a request cannot claim to be Priya to see her private notes.
  // Real identity (Slack OAuth) replaces this before the pilot. See docs/security/DEMO_SAFETY.md.
  const requesterId = DEMO_REQUESTER_ID;
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

  const synthesis = await synthesizeBrief({
    question,
    mode,
    personId: input.personId,
    contributions,
  });

  // Trust Layer: the model proposes, deterministic checks verify. Recomputes
  // every claim's trust label, removes unverifiable claims, surfaces stale
  // conflicts and blocks approval claims. Labels can only go down.
  const sources = contributions.flatMap((contribution) => contribution.evidence);
  const verified = verifyBrief({
    candidate: synthesis.brief,
    question,
    requesterId,
    mode,
    personId: input.personId,
    sources,
  });
  for (const event of verified.securityEvents) {
    const duplicate = securityEvents.some((seen) => seen.type === event.type && seen.evidenceId === event.evidenceId);
    if (!duplicate) securityEvents.push(event);
  }
  // Show every record the answer cites, even when the router did not return it.
  const shownIds = new Set(sources.map((item) => item.id));
  sources.push(...verified.citedSources.filter((item) => !shownIds.has(item.id)));
  if (process.env.ASYNCH_AUDIT === "1") {
    console.info(`[A-SYNCH trust] ${JSON.stringify(verified.audit)}`);
  }

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

  return {
    requestId: randomUUID(),
    mode,
    question,
    selectedPeople,
    sources,
    brief: verified.brief,
    routingEvents,
    securityEvents,
    meta: {
      usedFallback: synthesis.usedFallback,
      model: synthesis.model,
      durationMs: Date.now() - startedAt,
    },
  };
}
