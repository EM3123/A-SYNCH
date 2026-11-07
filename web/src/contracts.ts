// Copied from the teammate backend (lib/contracts.ts on origin/main). Keep in sync; the backend owns it.
export type Availability = "available" | "busy" | "away";
export type EvidenceKind = "fact" | "stated-principle" | "prediction";
export type TrustDecision = "confirmed" | "supported" | "needs-human";
export type AskMode = "team" | "person";

export type SourceType =
  | "github"
  | "jira"
  | "slack"
  | "meeting"
  | "note";

export interface PersonProfile {
  id: string;
  name: string;
  role: string;
  availability: Availability;
  availabilityLabel: string;
  expertise: string[];
  topics: string[];
  accent: string;
}

export interface Evidence {
  id: string;
  ownerId: string;
  sourceType: SourceType;
  title: string;
  sourceLabel: string;
  timestamp: string;
  text: string;
  permittedUsers: string[];
  kind: EvidenceKind;
  ownerApproved: boolean;
  stale?: boolean;
  securityFlags?: Array<"prompt-injection" | "sensitive" | "unverified">;
  contentHash?: string;
}

export interface AgentContribution {
  person: PersonProfile;
  reason: string;
  evidence: Evidence[];
  ignoredEvidence: Evidence[];
}

export interface BriefClaim {
  text: string;
  evidenceIds: string[];
  trust: TrustDecision;
}

export interface DecisionNode {
  label: string;
  state: "done" | "next" | "blocked";
  reason: string;
}

export interface SituationBrief {
  title: string;
  answer: string;
  status: string;
  claims: BriefClaim[];
  relevantPeople: Array<{
    personId: string;
    reason: string;
    evidenceIds: string[];
  }>;
  decisionTree: DecisionNode[];
  nextStep: string;
  ownerId: string;
  downstreamBlockers: string[];
  conflicts: string[];
  trust: {
    decision: TrustDecision;
    reasons: string[];
    requiresHuman: boolean;
  };
}

export interface AskRequest {
  question: string;
  mode?: AskMode;
  personId?: string;
  requesterId?: string;
}

export interface RoutingEvent {
  type: "route" | "evidence" | "synthesis" | "trust";
  label: string;
  personId?: string;
  evidenceCount?: number;
}

export interface SecurityEvent {
  type: "untrusted-source-ignored" | "authority-boundary" | "stale-conflict";
  label: string;
  evidenceId?: string;
}

export interface AskResponse {
  requestId: string;
  mode: AskMode;
  question: string;
  selectedPeople: PersonProfile[];
  sources: Evidence[];
  brief: SituationBrief;
  routingEvents: RoutingEvent[];
  securityEvents: SecurityEvent[];
  meta: {
    usedFallback: boolean;
    model?: string;
    durationMs: number;
  };
}
