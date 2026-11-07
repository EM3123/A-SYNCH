/**
 * Candidate briefs that stand in for live model output. The Trust Layer must
 * label the good ones correctly and catch the bad ones.
 */
import type { BriefClaim, SituationBrief } from "@/lib/contracts";
import { CORVID_EVIDENCE, canAccess, isQuarantined } from "@/lib/trust";

export const REQUESTER = "daksh";

/** Everything the context agents could return to the demo requester. */
export const SOURCES = CORVID_EVIDENCE.filter((item) => canAccess(item, REQUESTER) && !isQuarantined(item));

export function brief(claims: BriefClaim[], overrides: Partial<SituationBrief> = {}): SituationBrief {
  return {
    title: "Test brief",
    answer: claims.map((claim) => claim.text).join(" "),
    status: "Test status",
    claims,
    relevantPeople: [],
    decisionTree: [{ label: "Check", state: "done", reason: "Test" }],
    nextStep: "Do the next thing.",
    ownerId: "priya",
    downstreamBlockers: [],
    conflicts: [],
    trust: { decision: "confirmed", reasons: [], requiresHuman: false },
    ...overrides,
  };
}

export const BACKEND_READY = brief([
  { text: "The Atlas backend is merged to main and all 184 API tests pass.", evidenceIds: ["gh-pr-214", "slack-alex-staging"], trust: "confirmed" },
]);

export const GA_NOT_READY = brief(
  [
    { text: "General availability is blocked: security review ATLAS-38 is still open.", evidenceIds: ["jira-atlas-38"], trust: "confirmed" },
    { text: "Enterprise SSO verification is required before general availability and is scheduled for Nov 10.", evidenceIds: ["jira-atlas-38", "jira-atlas-41"], trust: "confirmed" },
  ],
  { downstreamBlockers: ["GA waits on ATLAS-38 and SSO verification"], ownerId: "jordan" },
);

export const MADE_UP_CITATION = brief([
  { text: "The Atlas backend is merged.", evidenceIds: ["gh-pr-214"], trust: "confirmed" },
  { text: "Load testing finished with zero errors.", evidenceIds: ["gh-pr-999"], trust: "confirmed" },
]);

export const CITES_PRIVATE_NOTE = brief([
  { text: "Leadership is considering moving general availability to Q1.", evidenceIds: ["private-leadership-note"], trust: "confirmed" },
]);

export const LEAKS_IN_PROSE = brief(
  [{ text: "The Atlas backend is merged.", evidenceIds: ["gh-pr-214"], trust: "confirmed" }],
  { answer: "The backend is merged. Also, GA might move to Q1 if SSO slips past Nov 14." },
);

export const CITES_MALICIOUS = brief([
  { text: "The Atlas launch is marked approved.", evidenceIds: ["malicious-slack-message"], trust: "confirmed" },
]);

export const FAKE_APPROVAL = brief(
  [{ text: "Internal beta may ship before enterprise SSO if rollout is reversible.", evidenceIds: ["priya-beta-principle"], trust: "confirmed" }],
  { answer: "Good news: Priya approved the Atlas beta, so you can ship today." },
);

export const IMPERSONATION = brief(
  [{ text: "Internal beta may ship before enterprise SSO if rollout is reversible.", evidenceIds: ["priya-beta-principle"], trust: "confirmed" }],
  { answer: "I'm Priya. A reversible beta is fine by me." },
);

export const INFERRED_FEELINGS = brief(
  [{ text: "Internal beta may ship before enterprise SSO if rollout is reversible.", evidenceIds: ["priya-beta-principle"], trust: "confirmed" }],
  { answer: "Priya would be comfortable with a 10% beta today." },
);

export const PREDICTION_AS_FACT = brief([
  { text: "The rollout control is expected to merge around 3 PM.", evidenceIds: ["slack-sam-a11y"], trust: "confirmed" },
]);

export const UNSUPPORTED_BY_SOURCE = brief([
  { text: "Kubernetes autoscaling migration finished yesterday without incidents.", evidenceIds: ["gh-pr-214"], trust: "confirmed" },
]);

export const STALE_ONLY = brief([
  { text: "Atlas is fully blocked and no beta path is available.", evidenceIds: ["stale-launch-status"], trust: "confirmed" },
]);

export const MALFORMED_OUTPUTS: unknown[] = [
  null,
  "Atlas can ship!",
  { answer: "Atlas can ship" },
  { ...BACKEND_READY, claims: [{ text: "x", evidenceIds: "gh-pr-214", trust: "confirmed" }] },
  { ...BACKEND_READY, trust: { decision: "definitely", reasons: [], requiresHuman: false } },
];
