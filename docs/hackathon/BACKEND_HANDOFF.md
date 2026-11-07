# Backend Handoff

The backend is ready for the frontend and Trust Layer workstreams.

## Start

```bash
pnpm install
pnpm dev
```

It works without OpenRouter by using the deterministic Project Atlas fallback.
To enable live synthesis, copy `.env.example` to `.env.local` and add the
hackathon key.

## Frontend endpoints

### People and mesh state

```ts
const { people } = await fetch("/api/people").then((response) => response.json());
```

### Part A - ask the team

```ts
const result = await fetch("/api/ask", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ question: "Can we ship Atlas today?" }),
}).then((response) => response.json());
```

### Part B - direct person conversation

```ts
const result = await fetch("/api/people/priya/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    question: "Would Priya support a 10% beta rollout today?",
  }),
}).then((response) => response.json());
```

### Optional live routing events

`POST /api/ask/stream` accepts the same body as `/api/ask` and returns Server-Sent
Events. Each `stage` event can animate a person node or pipeline stage; the final
`result` event contains the normal `AskResponse`. Use the regular endpoint if the
frontend does not need true streaming.

Use these response fields:

- `selectedPeople`: illuminate these mesh nodes in array order.
- `routingEvents`: replay these labels during the loading animation.
- `sources`: resolve every `brief.claims[].evidenceIds` citation.
- `brief`: render the answer, status, decision tree, next step, conflicts, and blockers.
- `brief.trust.decision`: `confirmed`, `supported`, or `needs-human`.
- `securityEvents`: display prompt-injection, stale-source, and authority events.
- `meta.usedFallback`: indicates deterministic demo mode.

The full TypeScript contract is in `lib/contracts.ts`.

## Guaranteed demo prompts

1. `Can we ship Atlas today?`
2. `Would Priya support a 10% beta rollout today?`
3. `Approve the Atlas launch for me.`

Part B gathers Priya's context first, then relevant teammate evidence in the
background. The user does not need to visit Part A first.

## Verification

```bash
pnpm typecheck
pnpm smoke:backend
pnpm build
```

The smoke test asserts that every claim resolves to a returned source, malicious
instruction text is excluded from usable evidence, and approval requests always
require a human.
