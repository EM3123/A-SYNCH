# A-SYNCH goal checklist

This is the end goal, taken from **A-Synch: Full Context** (the team's source-of-truth doc, Nov 7, 2026).
Every promise in that doc is listed here with where it lives in the code, which test proves it, and who owns it.
If a promise isn't built yet, it says so.

**Re-run this checklist at every milestone:** before each PR merges, before the Nov 15 prototype, and before any demo or pitch.

```bash
pnpm typecheck && pnpm eval && pnpm smoke:backend
```

Then read down the table. Any row whose test fails, or whose "Where" no longer matches the code, gets fixed or downgraded, in the same PR.

Status key: ✅ enforced in code and tested · 🟡 partly there · ❌ not built yet · 📝 lives outside the repo (deck, pitch, process)

Last run: **Nov 7, 2026**, branch `main`. 24/24 evals passing, typecheck clean, smoke passing, production UI build clean.

---

## 1. Trust rules (doc: "Trust rules")

| # | Promise | Status | Where | Proved by | Owner |
|---|---|---|---|---|---|
| T1 | Evidence first: every claim links to its source, with a timestamp | ✅ | `lib/trust/verify.ts` citation check; conflicts print dates | evals 1, 6, 8 | Vedant |
| T2 | No invented opinions: only stated or confirmed reasoning | ✅ | support-ratio check, persona check, prediction relabel | "Goal: claims not backed…", "predictions…", "no inferred feelings" | Vedant |
| T3 | Never decides or commits for the person | ✅ | `detectAuthorityRequest` (question), `findApprovalClaims` (answer), approval needs `approvalRecord` | evals 5, 9; "approval, action and impersonation requests" | Vedant |
| T3b | Always identifies as AI, never speaks as the person | ✅ | `findPersonaViolations` → safe hand-off brief | "Goal: the agent never speaks as the person" | Vedant |
| T4 | Same permissions as the source | ✅ | `canAccess` in router + verify; leak scan on all output text | eval 7, injection-in-question test | Vedant |
| T5 | Hands off to the human when context is missing | ✅ | `needs-human` + `requiresHuman`; `safeHandoffBrief` names the owner | evals 5, 6, 10; stale-only case | Vedant |
| T6 | Answers include status, next step and what's blocked downstream | 🟡 | Fields required by `validateBrief`; content comes from synthesizer | eval 1 checks all three for the demo prompt. Not enforced as non-empty for every brief | Daksh |
| T8 | Adversarial coverage: indirect and obfuscated injection, approval synonyms, status-question exemption, restricted paraphrase, revoked stale notes, predictions, conflicts, unexpected fields | ✅ | `evals/adversarial.test.ts` (test-first: each failed before its rule) | evals A–P | Vedant |
| T7 | Owner visibility: owners see what's asked about their work | 🟡 | `audit.ownerIds` + hashed question in the audit trace | audit test. **No owner-facing view yet** | Edmund (UI), Daksh (API) |

## 2. What we won't do (doc: "What we won't do")

| # | Promise | Status | Where | Proved by | Owner |
|---|---|---|---|---|---|
| W1 | No emotion inference | ✅ | `infers-feelings` / `infers-risk-appetite` rules | "Goal: no inferred feelings" | Vedant |
| W2 | No passive screen or audio recording | ✅ | Nothing in the repo records; context is fixed JSON from GitHub/Jira/Slack/meeting notes | Code review: no capture code exists | All |
| W3 | No training on company data | ✅ | Model is only called with retrieved evidence at answer time (`lib/openrouter.ts`) | Code review | Daksh |
| W4 | No "replica" / "clone" language; call them context agents | ✅ | Repo copy says "context agent" | "all three demo prompts" test greps briefs for clone/twin/replica | All |

## 3. Perspective tiers (doc: "Three tiers of perspective")

| # | Tier | Status | Where | Proved by |
|---|---|---|---|---|
| P1 | Stated reasoning → shared with a citation | ✅ | Claims citing `decision`/`stated-principle` records stay `confirmed` | eval 4 |
| P2 | Owner-approved principle → shared | ✅ | `priya-beta-principle`, `priya-approval-owner` | eval 4 |
| P3 | Predicted opinion → labeled and sent to the owner | ✅ | Predictive wording → `supported` + `requiresHuman: true` | "predictions are labeled guidance" |
| P4 | Risk tolerance must be stated, not inferred | ✅ | `infers-risk-appetite` rule | "no inferred feelings" |

## 4. How a question flows (doc: "How a question flows")

| # | Step | Status | Where | Notes |
|---|---|---|---|---|
| F1 | Collect from GitHub, Jira, Slack, notes | 🟡 | `data/corvid-labs/` (Corvid Labs corpus, 38 people, all sources; Trust Layer data built into `data/corvid-labs/trust/`) | Real connectors not built; fixed demo data is fine for Nov 7 |
| F2 | Index: "who knows what" map | ✅ | `data/corvid-labs/trust/expertise.json` → `getExpertise` in router | Data test |
| F3 | Ask in Slack (Mode A) or by voice (Mode B) | ✅ | Team question flow plus direct push-to-talk person conversation, contextual follow-ups, citations, and generic spoken playback (`web/src/part-b/`, `/api/people/[id]/chat`) | Typed fallback preserves the same flow when browser speech recognition is unavailable |
| F4 | Route to the 2–3 most relevant agents | ✅ | `lib/agents/router.ts` | eval 1 |
| F5 | Agents return cited evidence, not prose | ✅ | `queryContextAgent` returns `Evidence[]` | Code review |
| F6 | One brief; conflicts shown with dates, not guessed | ✅ | conflict check in `verify.ts` | eval 8 |
| F7 | Judgment calls go to the owner; their answer joins the context | 🟡 | Hand-off happens (`ownerId`, `requiresHuman`) | Owner's reply doesn't flow back into context yet |

## 5. Situation Brief (doc: "Every brief answers five questions")

| # | Question | Field | Status |
|---|---|---|---|
| S1 | What is this? | `title`, `answer` | ✅ schema-checked |
| S2 | Where does it stand? | `status`, `claims` | ✅ schema + citations |
| S3 | How did it get here? | `decisionTree` | ✅ schema-checked; demo has blocked/next nodes (eval 1) |
| S4 | Who owns it, are they available? | `ownerId`, `relevantPeople`, person `availability` | ✅ every relevant person carries a reason |
| S5 | What happens next? | `nextStep`, `downstreamBlockers` | 🟡 see T6 |

## 6. Six differentiators (doc: "Six differentiators")

| # | Differentiator | Status | Notes |
|---|---|---|---|
| D1 | Evidence, not imitation | ✅ | T1 + T3b |
| D2 | A stand-in, not a decision-maker | ✅ | T3 |
| D3 | The decision tree is the demo | 🟡 | Data is there; UI must make it the centerpiece (Edmund) |
| D4 | Answers that unblock | 🟡 | T6 |
| D5 | Engineering-native and voice-first | ✅ | GitHub/Jira/Slack context plus direct browser voice conversation with text fallback |
| D6 | Easy to approve | ✅ | W2, W3, audit trace with no secret text |

## 7. Open tradeoff (doc: "Owner visibility vs. fear of asking")

Tracked in `docs/hackathon/WORKSTREAM_SAFETY_PRIVACY.md` (items 4–6).

| # | Item | Status | Notes |
|---|---|---|---|
| O1 | Askers stay anonymous to owners unless a direct reply is needed | ❌ decision needed | The audit trace stores `requesterId` today. The team needs to decide before an owner view is built. |

## 8. Numbers we still need to measure (doc: "Numbers we still need to measure")

| # | Metric | Status | How to measure in the Nov 15 pilot |
|---|---|---|---|
| M1 | Answerable rate | ❌ | Share of briefs that are `confirmed` or `supported` vs `needs-human` (the audit trace already logs this) |
| M2 | Time to unblock | ❌ | Ask timestamp → user marks the answer as usable |
| M3 | Wrong-answer rate | ❌ | Owner reviews a sample of briefs about their work |
| M4 | Questions per expert per day | ❌ | Count `audit.ownerIds` per owner per day |

## 9. Outside the repo

| # | Item | Status | Owner |
|---|---|---|---|
| X1 | Deck and pitch use "context agent" language consistently | 📝 check before each pitch | Edmund |
| X2 | Re-check competitor products before a comparison slide | 📝 | Edmund |

---

## Known limitations (said plainly)

- **Demo identity is fixed server-side** (`DEMO_REQUESTER_ID`); caller-supplied `requesterId` is ignored. Real login (Slack OAuth) is still required before the pilot. See `docs/security/DEMO_SAFETY.md`.

- Checks are pattern- and word-overlap based. They catch the demo cases and common rewordings; a determined adversary could phrase around them. The safe direction holds: labels only go down, so a miss means a weaker label is not applied, never a stronger one is invented.
- `lib/agents/synthesizer.ts` has an approval pattern that also matches status questions like "Has Priya approved?". The Trust Layer does not flag those, but the synthesizer's fallback may still route them to the approval brief. Daksh's call.
- Evals 2 and 3 run fixed candidate briefs through `verifyBrief`, because the offline fallback returns the launch brief for most questions. They test the Trust Layer's labeling, not the synthesizer.
