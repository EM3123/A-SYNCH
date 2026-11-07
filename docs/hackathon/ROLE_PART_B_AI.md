# Part B Contributor AI Handoff — Perspective Voice Agent

You own Part B of **A-SYNCH**: a multi-turn voice conversation with one selected person's context agent, grounded in that person's explicitly stated and owner-confirmed reasoning.

This is a full-stack but isolated workstream. `main` is the source of truth. Do not merge to `main`; Daksh will combine the branches.

## Start here

1. Clone or pull the repository and fetch all branches.
2. Check out latest `main` and create `feature/part-b-perspective-voice`.
3. Read completely:
   - `AGENTS.md`
   - `docs/hackathon/PART_B_PERSPECTIVE_SPEC.md`
   - `docs/hackathon/MASTER_CONTEXT.md`
   - `docs/GOAL_CHECKLIST.md`
   - `lib/contracts.ts`
   - the existing `/api/people/[personId]/chat` route
4. Run `pnpm typecheck && pnpm eval && pnpm smoke:backend` before changing code.

## Important product definition

- **Part A is organizational data:** status, facts, sources, owners, next steps, and blockers.
- **Part B is perspective:** how one person has explicitly said they reason about a decision—principles, priorities, tradeoffs, scoped risk posture, past rationale, review questions, and known uncertainty.
- Voice is the conversational interface to Part B. Adding a microphone to Part A is not Part B.

The agent must always identify as a context agent, use a generic assistant voice, cite perspective, and hand approval/action back to the human.

## Your isolated ownership

You may change:

- `web/src/part-b/**` — self-contained Part B UI and browser voice controls.
- `lib/part-b/**` — perspective retrieval, conversation history, deterministic fallback, and prompt assembly.
- `data/atlas/perspectives.json` — owner-confirmed seeded perspective records.
- `evals/part-b.test.ts` — Part B behavior and safety tests.
- `app/api/people/[personId]/chat/route.ts` — wire the existing route to the Part B engine.
- `web/src/api.ts` only for a narrowly scoped Part B client method.

Do not change:

- `lib/contracts.ts` or the existing `AskResponse` response shape.
- Part A router/synthesis behavior.
- General frontend scenes outside `web/src/part-b/`.
- General Atlas evidence fixtures or Trust Layer internals unless Daksh approves a written proposal.

If you need a shared-contract change, document the exact proposed field and reason in your handoff; do not make it yourself.

## Backend implementation

Create an isolated Part B engine that accepts:

- selected `personId`;
- current user turn;
- prior conversation turns supplied by the client;
- requester identity as resolved by existing server-side demo policy;
- relevant current Situation Brief/evidence;
- the selected person's scoped perspective records.

No database is needed. The browser may send the active conversation history on each request. Validate its length, roles, and total characters server-side.

The existing endpoint may accept optional history without changing its existing response contract. Keep old callers working.

Each turn must classify the request as:

- factual context;
- stated perspective;
- supported application of perspective;
- approval/action request;
- missing or conflicting perspective.

Reuse the deterministic Trust Layer before returning anything. The final answer must remain an `AskResponse` with claims and evidence citations.

## Deterministic offline conversation

The demo must work without OpenRouter. Build distinct deterministic responses for this Priya conversation:

1. `Would you support a 10% Atlas beta today?`
   - Explain that Priya's stated reversible-beta principle supports a limited beta after rollout controls merge.
   - Label it supported guidance, not Priya's approval.
2. `Why 10% instead of 50%?`
   - Use her stated blast-radius and learning-signal reasoning.
   - Mention rollback ownership, success/failure signals, and kill-switch readiness.
3. `What would make you comfortable increasing it?`
   - Resolve “it” from the conversation history.
   - Give conditions from owner-confirmed perspective records, not a repeat of turn one.
4. `Approve it for me.`
   - Resolve the referent from history.
   - Refuse authority and produce a concise handoff request for Priya.

OpenRouter may improve free-form turns, but no network or model failure may break these four turns.

## Perspective data

Create enough seeded Priya perspective records to support the conversation naturally:

- reversible beta versus GA evidence thresholds;
- initial blast-radius reasoning;
- what constitutes a useful customer-learning signal;
- rollback owner, kill switch, and observability requirements;
- what conditions permit increased exposure;
- what always requires Priya's confirmation;
- known uncertainties and expiry/scope.

Add smaller sets for Alex, Sam, Jordan, and Maya to demonstrate the architecture. Every perspective record must be scoped, timestamped, source-linked, owner-confirmed, and revocable. Never encode inferred emotion, personality, or generalized risk appetite.

## Voice interface

Export a self-contained Part B component that Edmund can place inside the final shell.

Required behavior:

- Direct **Start voice conversation** action for the selected person.
- Browser `SpeechRecognition` / `webkitSpeechRecognition` push-to-talk input.
- Visible ready → listening → transcribing → checking context → speaking states.
- Editable transcript and typed fallback.
- Automatic submission after speech completes, with a manual-send fallback.
- `speechSynthesis` playback using a generic voice.
- Stop/interruption, replay, mute, and end-call controls.
- Permission request only after an explicit microphone action.
- Clear message when speech recognition is unsupported or permission is denied.
- No passive recording, storage claim, or imitation of the selected person's voice.

The UI must show the cited principle/rationale beside each judgment response and label it as stated perspective, supported guidance, or needs the person.

## Required tests

Add Part B tests proving:

- later turns use conversation history;
- the four deterministic demo turns produce distinct relevant answers;
- each perspective claim cites an accessible, owner-confirmed record;
- unsupported or expired perspective downgrades to needs-human;
- generalized personality/risk inference is rejected;
- approval synonyms and indirect action requests hand off;
- restricted perspective cannot leak through any output field;
- prompt injection in perspective source text is ignored;
- oversized/malformed history is rejected safely;
- existing Part A and person-chat callers still work.

## Acceptance test

After a hard refresh:

1. Open Priya's profile directly.
2. Start a voice conversation without asking Part A first.
3. Speak the 10% beta question and see an accurate transcript.
4. Hear a cited, supported-perspective response.
5. Ask why 10% rather than 50% and receive a different rationale.
6. Ask what would permit an increase and receive conditions that use prior context.
7. Ask for approval and see/hear a refusal plus human handoff.
8. Interrupt spoken playback and continue through text.

## Before handoff

- Run `pnpm typecheck && pnpm eval && pnpm smoke:backend`.
- Run the frontend build and lint.
- Test microphone-denied and unsupported-browser fallbacks.
- Commit only your owned paths.
- Push `feature/part-b-perspective-voice`.
- Send Daksh: branch name, commit SHA, test results, a short demo recording or screenshots, any browser limitations, and any proposed contract changes.

Your ChatGPT Plus subscription can help you write and debug the code, but it is not an API key for the product. The running demo uses browser speech APIs and the team's server-side OpenRouter configuration, with deterministic offline fallbacks.
