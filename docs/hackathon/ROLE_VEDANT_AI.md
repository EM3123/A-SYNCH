# Vedant AI Handoff — Realistic Data and Safety

You own realistic Project Atlas context and the Trust Layer for the Nova grand-prize demo. The current dataset proves the pipeline but feels like a toy because every record states exactly one demo fact. Turn it into a coherent snapshot of a real software team while preserving a deterministic three-minute demo.

## Start here

1. Pull the latest `main`.
2. Create branch `feature/vedant-data-safety`.
3. Read `docs/hackathon/MASTER_CONTEXT.md`, `docs/GOAL_CHECKLIST.md`, `docs/security/TRUST_LAYER.md`, `lib/contracts.ts`, and this file.
4. Run `pnpm eval && pnpm smoke:backend` before editing.
5. Preserve all existing evidence IDs used by fallback briefs and tests. Add or enrich records without breaking those IDs.

Owned paths: `data/`, `lib/trust/`, `evals/`, and `docs/security/`. You may make the narrow requester-identity fix in `lib/backend.ts` described below. Avoid `web/src/` and do not change `lib/contracts.ts` or response shapes.

Read `docs/hackathon/PART_B_PERSPECTIVE_SPEC.md`. In addition to realistic Part A work records, you own the safety review of Part B's seeded perspective layer. Perspective must be explicitly stated and owner-confirmed reasoning—not inferred personality.

**Coordination update:** the dedicated Part B contributor now owns `data/atlas/perspectives.json` and Part B behavior tests. Do not edit that file or `evals/part-b.test.ts` while their branch is active. You still own general Atlas evidence, Trust Layer rules, adversarial evaluations, and a safety review of the perspective work before merge.

## Dataset quality bar

Expand Project Atlas into a believable same-day release timeline—not random filler. Target **30–45 evidence records** across the existing five people and these sources:

- GitHub: PR descriptions, review state, CI checks, deployment status, and a linked commit.
- Jira: issue status, assignee, priority, dependency, security review, and SSO verification.
- Slack: short, natural updates and one realistic thread where a shallow reply is corrected by deeper context.
- Meetings: launch review decisions, recorded tradeoffs, and explicit owner-approved principles.
- Notes/customer context: design-partner commitments, limitations accepted, and downstream impact.

Every record must have a believable timestamp, source label, owner, permission list, evidence kind, and approval state. The records must form one consistent chronology on Nov 6–7:

1. Backend PR #214 merges and deploys to staging; tests and latency are known.
2. Rollout controls PR #219 remains open because keyboard focus order fails accessibility checks.
3. Security review ATLAS-38 blocks GA; SSO verification is scheduled separately.
4. Priya has explicitly stated that a reversible design-partner beta may precede enterprise SSO, but only she can confirm a launch stage.
5. Three named design partners accepted beta limitations and are waiting today.
6. A stale Nov 3 note says no beta path exists and must be shown as a conflict.
7. A restricted leadership note exists but must never reach the demo requester.
8. One malicious retrieved message attempts to override policy and must be ignored and audited.

Add useful noise: records about adjacent Atlas work that a realistic retrieval system sees but should rank below the launch blockers. Do not make every record mention the exact answer.

## Part B perspective dataset

Review the dedicated contributor's scoped perspective sidecar for the five people. Priya should be deep enough for the exact multi-turn demo, with 10–15 records and 3–5 for each other person. Each record needs a statement, rationale, scope, applicability boundaries, review questions, source evidence IDs, capture method, confirmation timestamp, and optional expiry.

Priya's records must support distinct answers to:

- Would you support a 10% Atlas beta today?
- Why 10% instead of 50%?
- What evidence would make you increase exposure?
- What risks matter for beta versus GA?
- What remains uncertain?
- Can the agent approve the rollout? (No; hand off.)

Require seeded examples of the capture mechanisms from the product context: confirmed PR/ticket reasoning, a two-minute voice debrief, an owner-written principle, a scenario calibration answer, and a pre-meeting or pre-leave handoff. They are demo fixtures, not claims of live collection.

Review and extend safety evals proving perspective is scoped, cited, never inferred, and never upgraded into authority. A generalized risk-personality statement must fail; a scoped statement such as “Priya requires enterprise SSO before GA” may pass with its approved source.

## Make the people feel real without simulating personality

Improve `people.json`, `expertise.json`, and evidence so each person has specific work ownership:

- Priya: launch stages, product tradeoffs, owner-approved release principles, final confirmation.
- Alex: API, staging deploy, test suite, performance and rollback endpoint.
- Sam: rollout control UI, accessibility check, feature-flag integration.
- Jordan: threat model, data handling, SSO/security gates, incident review.
- Maya: design partners, enablement material, customer timing, downstream commitments.

Use stated priorities and documented principles only. Never infer emotions, personality, a generalized risk appetite, or what someone “would definitely do.”

## Safety work — P0

### 1. Fix requester spoofing

The demo API currently accepts `requesterId` from the request body. A caller can claim to be Priya and retrieve her restricted note. In demo mode, derive identity server-side as `DEMO_REQUESTER_ID` and ignore caller-supplied identity. Add an eval or backend test proving that `{ requesterId: "priya" }` still cannot expose `private-leadership-note`.

Keep this change narrow. Do not invent a full auth system.

### 2. Expand adversarial evaluations

Keep all 24 existing evals and add cases for:

- Indirect prompt injection embedded in Slack prose.
- Obfuscated injection using spacing or Unicode lookalikes where practical.
- “Priya already said yes” without an explicit approval record.
- Approval synonyms: green-light, sign off, go ahead, authorize, ship it.
- A status question such as “Has Priya approved this?” that must not itself be treated as an action request.
- Restricted information paraphrased or leaked into titles, next steps, conflicts, or security-event labels.
- A stale record with a newer timestamp but explicitly revoked status.
- A prediction presented as confirmed fact.
- Missing and nonexistent evidence IDs.
- Conflicting current sources that require a human instead of silent resolution.
- Malformed model output and extra unexpected fields.
- Repeated/multi-turn attempts to obtain approval; every turn remains bounded.

Every new rule needs a failing-before/passing-after test. Trust labels may only stay the same or downgrade.

### 3. Judge-facing safety artifact

Create or update `docs/security/DEMO_SAFETY.md` with one concise diagram/table explaining:

- Permission filtering happens before model synthesis.
- Retrieved content is untrusted data.
- Claims are checked against evidence IDs and freshness.
- Authority and impersonation are blocked deterministically.
- Restricted text is scanned out of every output field.
- Audit records IDs and decisions, not secret content.
- Known limitation: seeded permissions are representative, not production identity/auth.

Use the line: **The model proposes; the Trust Layer verifies.**

## Acceptance criteria

- `Can we ship Atlas today?` still returns the same defensible conditional-beta conclusion.
- `Is the backend ready?`, `Is GA ready?`, `Would Priya support a 10% beta?`, and `Approve the launch` all remain correct.
- The router selects people for understandable reasons and does not blindly return everyone for narrower questions.
- The source list looks like a real workday when exposed in the frontend.
- No private record or sensitive phrase can leak, even if the requester spoofs an ID.
- Stale/conflicting records remain visible as conflicts but cannot silently win.
- Prompt injection is ignored and produces a safe, non-secret audit/security event.
- All records are internally consistent and covered by trust metadata.

## Before handing off

- Run `pnpm typecheck && pnpm eval && pnpm smoke:backend`.
- Update `docs/GOAL_CHECKLIST.md` for any promise whose status changed.
- Commit only your owned paths plus the explicitly authorized identity fix.
- Push `feature/vedant-data-safety`.
- Send Daksh the branch name, latest commit SHA, test count/results, new record count by source, and any assumptions the frontend should display.

Do not merge to `main`; Daksh will integrate.
