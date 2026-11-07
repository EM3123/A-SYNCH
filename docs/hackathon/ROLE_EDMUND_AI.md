# Edmund AI Handoff — Rebuild the Frontend

You own the frontend of **A-SYNCH** for the Nova grand-prize demo. The interface currently on `main` is a disposable prototype. Your active `feature/web-shell` branch already contains a substantial scene redesign at commit `eca2718`; assess that work against the acceptance criteria below. Keep it only where it makes the product clearer. The outcome must be a professional, projector-readable experience that makes multi-agent routing and the Trust Layer immediately understandable.

## Start here

1. Fetch the latest remote branches and continue on `feature/web-shell` (currently at or after `eca2718`).
2. Merge or rebase the latest `main` into that branch before final handoff; never force-push over a teammate's newer commit.
3. Read `docs/hackathon/MASTER_CONTEXT.md`, `docs/GOAL_CHECKLIST.md`, `web/src/contracts.ts`, and this file.
4. Run the current demo once with `pnpm dev`, then redesign it from first principles.
5. Keep all API contracts unchanged. If data is missing, use a typed UI fixture or leave an integration note for Daksh—do not change `lib/contracts.ts`.

Owned paths: `web/src/`, `app/page.tsx`, `app/layout.tsx`, and frontend assets. Avoid `data/`, `lib/trust/`, `evals/`, and backend APIs.

## Product direction

Build a serious internal intelligence product, not a game and not a generic chatbot. Aim for the clarity of Linear, the operational density of Palantir, and one memorable custom visualization: the **Team Intelligence Mesh**.

The ocean metaphor is not a requirement and cannot come at the expense of comprehension. If the newest scene still reads like a game before it reads like a workplace product, replace it with the Team Intelligence Mesh. If you keep any ocean motif, simplify it until people, availability, routing, evidence, and the active situation are obvious without narration. No decorative gradients, glassmorphism everywhere, tiny terminal text, or novelty motion that delays the answer.

The UI must explain the product without narration:

- Ask the organization when you do not know who has the answer.
- Talk directly to one person's context agent when you already know who you need.
- Every important claim is connected to people and source evidence.
- The agent never pretends to be a person or grants approval for them.

## Required experience

### 1. Team Intelligence Mesh home

- Five human-looking teammate cards/nodes around an active `Project Atlas` situation.
- Each node shows initials/avatar, name, role, availability, and 1–2 expertise tags.
- Priya is visibly unavailable in an executive meeting; others show available, busy, or away states.
- A central prompt says **Ask your team anything** with an equally visible action to open any person's context agent directly.
- A restrained integration strip shows GitHub, Jira, Slack, meetings, and notes as **seeded demo sources**, never as live connections.
- Use SVG or DOM/CSS for the mesh so labels remain crisp and accessible.

### 2. Routing / agentic workflow state

For `Can we ship Atlas today?`, animate only 1–2 seconds:

- Alex, Sam, Jordan, Maya, and Priya illuminate in a clear sequence.
- Source packets move from selected people toward the active situation.
- Plain-language stages appear: routing → gathering evidence → checking trust → brief ready.
- Motion must be skippable and respect reduced-motion settings.

### 3. Situation Brief — the centerpiece

Use a split layout: persistent mesh/context on the left and a highly legible brief on the right. Above the fold at 1280×720, judges must see:

- The direct answer: **Beta can ship after rollout controls merge; GA cannot.**
- Confirmed / supported guidance / needs human state.
- Current status, exact next action, owner, and what is blocked downstream.
- A visual decision path: backend ready → rollout control pending → beta confirmation → GA blocked by security/SSO.
- Contributor chips explaining why each person was consulted.
- Source count and freshness.

Evidence details may open in a drawer, but every claim must visibly expose its citations. Show source type, realistic title, timestamp, owner, freshness, and permission state. Surface the stale conflict rather than hiding it.

### 4. Direct person conversation

Clicking Priya or choosing Part B opens a focused conversation screen:

- Header says **Priya's context agent**, not just Priya.
- Show Priya's availability, owned decisions, and the owner-approved principle being used.
- **Voice is a P0 demo requirement, not an optional enhancement.** Use the browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) for push-to-talk input and `speechSynthesis` for spoken responses.
- Provide an unmistakable **Start voice conversation** action directly from Priya's profile; Part B must not be buried behind the team-question form.
- Show explicit call states: ready → listening → transcribing → checking context → speaking → ready.
- After the user stops speaking, display the transcript, submit it through the existing person-chat API, and speak the returned answer. The user can interrupt/stop playback.
- Include microphone, mute/stop, replay, and end-conversation controls. Request microphone permission only after the user presses the voice button; never record passively and never imply audio is stored.
- If speech recognition is unavailable or permission is denied, keep the same conversation screen and fall back cleanly to typed input. Do not break the demo.
- Keep citations/principles visible beside the transcript so the answer never feels like role-play.

For `Would Priya support a 10% beta rollout today?`, clearly label the answer as guidance grounded in a stated principle—not approval.

### 5. Approval refusal / human handoff

For `Approve the Atlas launch for me.`:

- Make the Trust Layer moment visually memorable.
- State that the agent cannot approve or speak for Priya.
- Show why: no explicit approval record + only Priya owns this decision.
- Generate a concise confirmation request with a clear **Copy request for Priya** action.
- Show a compact security event: one malicious retrieved instruction was ignored.

## Presentation quality bar

- Primary target: 1440×900. Must also work at 1280×720 without clipped primary content.
- Large text and strong contrast for a projector viewed from the back of a room.
- No overlapping labels, hidden panels, horizontal scroll, or essential content below an unmarked fold.
- Keyboard-accessible primary flow and visible focus states.
- Responsive enough for a 390px mobile screenshot, but desktop demo quality comes first.
- Use seeded deterministic responses so every click works without OpenRouter or network access.
- No runtime or hydration warnings in the browser console.

## Exact acceptance flow

The following must work after a hard refresh:

1. Click `Can we ship Atlas today?` and submit.
2. See routing, then the complete Situation Brief and decision path.
3. Open Priya directly without returning to a generic chat screen.
4. Start a voice conversation and say `Would Priya support a 10% beta rollout today?`; see the transcript and hear the response.
5. Say or type follow-up `What remains blocked?` and receive a relevant second answer.
6. Say or type `Approve the Atlas launch for me.` and see the refusal + handoff.
7. Stop or interrupt spoken playback without ending the conversation.
8. Open citations and see the stale-source conflict and ignored-injection event.

## Before handing off

- Run `npm run build --prefix web`, `npm run lint --prefix web`, `pnpm typecheck`, and the exact browser flow above.
- Commit only your owned frontend paths.
- Push `feature/web-shell`.
- Send Daksh the branch name, latest commit SHA, screenshots at 1440×900 and 1280×720, test results, and any backend assumptions.

Do not merge to `main`; Daksh will integrate.
