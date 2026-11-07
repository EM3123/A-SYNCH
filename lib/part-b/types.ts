import type { Evidence, TrustDecision } from "@/lib/contracts";

export type PerspectiveCaptureMethod =
  | "confirmed-work-reasoning"
  | "voice-debrief"
  | "owner-written"
  | "recorded-walkthrough"
  | "pre-leave-handoff"
  | "calibration";

export interface PerspectiveRecord {
  id: string;
  ownerId: string;
  title: string;
  sourceLabel: string;
  scope: string;
  statement: string;
  rationale: string;
  appliesWhen: string[];
  doesNotApplyWhen: string[];
  reviewQuestions: string[];
  evidenceIds: string[];
  capturedBy: PerspectiveCaptureMethod;
  ownerConfirmedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  permittedUsers: string[];
  ownerApproved: boolean;
  securityFlags?: Evidence["securityFlags"];
  sensitiveTerms?: string[];
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export type PerspectiveIntent =
  | "initial-beta-guidance"
  | "exposure-rationale"
  | "scale-conditions"
  | "remaining-blockers"
  | "beta-vs-ga"
  | "known-uncertainty"
  | "authority-request"
  | "generalized-inference"
  | "factual-context"
  | "perspective"
  | "missing-context";

export interface PerspectiveSelection {
  intent: PerspectiveIntent;
  records: PerspectiveRecord[];
  sources: Evidence[];
  ignoredSources: Evidence[];
  resolvedTopic: string | null;
}

export interface PerspectiveTurnLabel {
  decision: TrustDecision;
  label: "Stated perspective" | "Supported guidance" | "Needs the person";
}
