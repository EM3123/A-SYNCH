# Part B integration handoff

Part B is implemented as an isolated perspective conversation engine and voice-capable React component. It does not change shared contracts or Part A routing.

## Frontend integration

Import `PerspectiveVoiceAgent` from `web/src/part-b` and render it when a user chooses **Start voice conversation** for a person. Pass the selected `PersonProfile`; use `onClose` to return to the existing person view and `onLatestResponse` only if the parent needs the latest verified brief.

The component already provides:

- push-to-talk browser speech recognition with explicit microphone permission;
- typed fallback for unsupported or denied microphone access;
- multi-turn history sent to the person-chat route;
- generic browser speech synthesis, mute, stop, replay, and end controls;
- visible source citations and `confirmed`, `supported`, or `needs-human` boundaries;
- a copied human-confirmation request when the agent cannot act for the person.

Do not add passive recording, voice likeness, inferred personality, inferred risk appetite, or agent-side approval.

## Backend behavior

`POST /api/people/:personId/chat` accepts `{ question, history? }`. The route resolves demo identity server-side and ignores caller-supplied identity. History is limited to 16 turns, 1,200 characters per turn, and 8,000 total characters.

The deterministic demo path is intentionally offline-safe. Priya's four-turn golden path covers initial beta guidance, 10% versus 50% rationale, scale-up conditions, and a hard approval handoff. Other seeded people return scoped owner-confirmed perspective rather than fabricated personal judgment.

## Source and checklist notes

No change to `lib/contracts.ts` is required. After the component is wired into Edmund's owned scene, `docs/GOAL_CHECKLIST.md` rows F3 (direct person conversation) and D5 (multi-turn contextual conversation) can be marked complete in the integration change. Browser microphone behavior should be demoed in Chrome or Edge; unsupported and denied permission paths remain usable through typed input.
