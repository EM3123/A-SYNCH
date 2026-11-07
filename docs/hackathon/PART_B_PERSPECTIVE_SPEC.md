# Part B — Perspective Conversation Specification

This is the source of truth for Part B. It comes directly from the Full Context product definition.

## The distinction

### Part A — Context / organizational truth

Part A answers questions such as:

- What is happening?
- What is the current status?
- Who knows about it?
- What is blocked?
- What source proves that?

It routes across the organization, gathers approved facts from work artifacts, and produces one evidence-backed Situation Brief.

### Part B — Perspective / judgment conversation

Part B answers questions such as:

- Am I approaching this the right way?
- How would this person evaluate the tradeoff?
- Which risks matter here, and which are acceptable?
- What would make them change direction?
- What questions would they ask before moving forward?
- How does this fit their stated priorities and longer-term vision?

It is a sustained one-to-one voice conversation with a selected person's **context agent**. Voice makes it feel like the fast, iterative huddle people already use; the underlying product is access to that person's approved perspective.

Product line:

> Layer 1 knows what you know. Layer 2 knows why you decided it, and only says what you'd say.

## What counts as perspective

Part B may use only perspective the owner explicitly stated or confirmed:

- Decision principles and rules of thumb.
- Project-specific priorities and impact weights.
- Context-specific risk posture: for example, strict on public launches but open to reversible internal experiments.
- Past decisions plus the owner's stated rationale.
- Tradeoffs the owner has explicitly made.
- Questions the owner usually asks during a review.
- Skills and experience relevant to the current problem.
- Long-term product/company direction the owner has approved for sharing.
- Known uncertainty: what the owner said they were unsure about.

It must not infer emotions, hidden beliefs, personality, generalized risk appetite, or a preference merely because it “sounds like” the person.

## How perspective is captured

The real product can build perspective records through low-cost, opt-in moments:

1. **Reasoning already in work:** PR descriptions, ticket comments, decision docs, and Slack threads, followed by one-tap owner confirmation.
2. **Two-minute voice debriefs:** what did you decide, why, what are you unsure about, and what should someone covering for you know?
3. **Repeated questions:** the owner answers a recurring judgment question once and approves it as a reusable scoped rule.
4. **Owner-written principles:** short statements such as “release blockers before new features.”
5. **Recorded walkthroughs:** the owner intentionally records how to approach a class of problems; no passive recording.
6. **Pre-leave handoff:** a short interview covering open threads, priorities, and decision boundaries.
7. **Onboarding calibration:** rank realistic scenarios, choose between tradeoffs, state what evidence would change the decision, and define where human confirmation is always required.
8. **Quick check-ins:** approve, revise, expire, or narrow previously captured principles as conditions change.

For this hackathon, all of these are represented honestly as seeded, owner-confirmed records. No live capture pipeline is required.

## Proposed perspective record

This is a data-sidecar proposal, not permission to change the shared API contract without Daksh:

```ts
type PerspectiveRecord = {
  id: string;
  ownerId: string;
  scope: string; // e.g. "Atlas reversible beta", not "all decisions"
  statement: string;
  rationale: string;
  appliesWhen: string[];
  doesNotApplyWhen: string[];
  reviewQuestions: string[];
  evidenceIds: string[];
  capturedBy:
    | "confirmed-work-reasoning"
    | "voice-debrief"
    | "owner-written"
    | "recorded-walkthrough"
    | "pre-leave-handoff"
    | "calibration";
  ownerConfirmedAt: string;
  expiresAt?: string;
};
```

Every record must be scoped, attributable, timestamped, permission-aware, and revocable.

## Part B conversation engine

Starting Part B should assemble:

1. The selected person's relevant perspective records.
2. The current Situation Brief and factual evidence from Part A.
3. The conversation history for this call.
4. The current user's permissions.
5. The selected person's explicit decision boundaries and unknowns.

Each turn then follows:

```text
Voice or typed turn
  -> transcript
  -> classify: fact / perspective / approval-action / missing context
  -> retrieve situation evidence + selected person's scoped perspective
  -> generate a conversational response with citations
  -> deterministic checks for provenance, permissions, authority, and impersonation
  -> speak the verified response and retain turn history
```

The response should distinguish:

- **Stated perspective:** the owner directly stated this within the relevant scope.
- **Supported guidance:** an explicitly labeled application of stated reasoning to a new case.
- **Needs the person:** no approved perspective exists, sources conflict, or the user asks for approval/action.

Part B must remember prior turns during the active conversation. A follow-up such as “why 10% instead of 50%?” must resolve “10%” from the conversation and provide a different, relevant answer—not replay the first canned response.

## Project Atlas demo perspective

Priya's seeded perspective needs enough depth for a real conversation:

- A reversible design-partner beta may precede enterprise SSO; GA may not.
- The initial rollout should minimize blast radius while producing a useful customer signal.
- Before increasing exposure, Priya asks for a named rollback owner, observable success/failure signals, and a tested kill switch.
- Customer learning matters, but it does not override security requirements for GA.
- A beta decision and GA decision use different evidence thresholds.
- Priya can explain conditions and principles through her context agent; only Priya can confirm the launch stage.

Other people should have smaller scoped perspective sets so the architecture feels real:

- Alex: backend reliability and rollback tradeoffs.
- Sam: accessibility and rollout-control quality boundaries.
- Jordan: security gates versus reversible experimentation.
- Maya: customer-learning value and commitment risk.

## Exact multi-turn demo

Open Priya's unavailable profile and start Part B directly.

1. User: **“Would you support a 10% Atlas beta today?”**
   - Agent grounds its guidance in Priya's reversible-beta principle.
   - It states the missing rollout-control condition.
   - It labels the answer as guidance, not approval.
2. User: **“Why 10% instead of 50%?”**
   - Agent uses Priya's stated blast-radius and learning-signal reasoning.
   - It asks or answers in terms of rollback ownership, success signals, and kill-switch readiness.
3. User: **“What would make you comfortable increasing it?”**
   - Agent lists owner-confirmed conditions and cites them.
4. User: **“Okay, approve it for me.”**
   - Agent refuses authority, explains the boundary, and creates a concise confirmation request for Priya with the Situation Brief attached.

The emotional moment is not that audio works. It is that the user can work through a decision with useful, sourced judgment while Priya is unavailable—without the system pretending to be Priya.

## Voice experience

- Direct **Start voice conversation** action from a person profile.
- Explicit ready, listening, transcribing, checking context, speaking, and stopped states.
- Live transcript remains visible and editable before or after submission.
- Verified responses are spoken with a generic assistant voice; never imitate the person's real voice.
- The user can interrupt playback, mute, replay, switch to typing, or end the call.
- Microphone access begins only after an explicit action; no passive recording or storage claim.
- If speech recognition is unavailable, the same multi-turn perspective conversation continues through text.

## Definition of done

- Part A and Part B are visually and conceptually distinct.
- Part B starts directly from a selected person, without requiring Part A first.
- Priya has enough approved perspective for at least three non-repetitive judgment turns.
- Conversation history affects later turns.
- Every perspective statement is cited and scoped.
- The UI clearly labels stated perspective, supported guidance, and needs-person boundaries.
- Approval/action requests always hand off.
- Spoken output uses a generic assistant voice and always identifies as a context agent.
- The complete voice conversation works offline against deterministic seeded data.
