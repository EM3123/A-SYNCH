# A-SYNCH

An availability-aware intelligence layer for teams. Ask the organization a
question, receive one evidence-backed Situation Brief from the people who know,
and talk directly to a specific person's context agent when you need their
stated perspective.

## Local setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

The backend works without an API key by returning deterministic Project Atlas
demo responses. Add the hackathon OpenRouter key to `.env.local` to enable live
synthesis:

```bash
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=...
```

Never commit `.env.local`.

Open `http://localhost:3000` for the complete demo. The interface and API ship
as one Next.js deployment from the repository root, so no second frontend
project or cross-origin configuration is required.

## Demo scope

The hackathon build intentionally uses seeded Project Atlas records shaped like
GitHub, Jira, Slack, meeting, and customer context. It demonstrates the full
question-routing, evidence, trust, direct-conversation, and human-handoff flow;
live workplace connectors, production authentication, and passive data capture
are not part of this demo.

## Backend API

### List people

```http
GET /api/people
```

### Ask the team (Part A)

```http
POST /api/ask
Content-Type: application/json

{"question":"Can we ship Atlas today?"}
```

### Talk directly to a person (Part B)

```http
POST /api/people/priya/chat
Content-Type: application/json

{"question":"Would Priya support a 10% beta rollout today?"}
```

For live mesh animation, `POST /api/ask/stream` accepts the Part A body and emits
Server-Sent Events named `stage`, followed by one `result` event.

Both question endpoints return the same `AskResponse` contract from
[`lib/contracts.ts`](lib/contracts.ts), including:

- `selectedPeople` for the Team Intelligence Mesh
- `sources` with the safe evidence objects referenced by claim IDs
- `routingEvents` for the agent-routing animation
- `brief` with claims, citations, decision tree, next step, and blockers
- `securityEvents` for stale sources, prompt injection, and authority boundaries
- `meta.usedFallback` so the UI can display live or demo mode

## Verification

```bash
pnpm typecheck && pnpm eval && pnpm smoke:backend
pnpm build
npm run build --prefix web
```

The smoke script covers the team question, direct Priya conversation, and the
human-approval handoff.

## Hackathon context

See [`docs/hackathon/MASTER_CONTEXT.md`](docs/hackathon/MASTER_CONTEXT.md) for
the product story, demo scenario, team boundaries, and definition of done.
