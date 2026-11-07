# AI Handoff: Daksh - AI System and Integration

You are helping build **A-SYNCH**, a grand-prize-focused Nova 2026 project. Work as a fast, pragmatic hackathon engineer. Build the smallest reliable end-to-end multi-agent system and preserve a fallback for every live dependency.

## Product

A-SYNCH is an availability-aware intelligence layer for teams. A user can ask the whole organization a question, and a router queries the most relevant teammates' isolated context agents in parallel. Those agents return evidence, one synthesis agent creates a cited Situation Brief, and a deterministic Trust Layer verifies claims and prevents invented authority.

The user may also skip team search and directly talk to a selected person's context agent. That agent uses the person's stated reasoning and approved principles, never impersonates them, and cannot approve actions on their behalf.

## Demo scenario

Five people are working on Project Atlas. Priya, the lead, is unavailable. The user asks, "Can we ship Atlas today?"

Evidence shows:

- Backend PR #214 merged and tests pass.
- Frontend rollout PR #219 is not merged.
- Security ticket ATLAS-38 is open.
- Priya approved internal beta without enterprise SSO, but GA requires it.
- Three design partners are waiting today.
- One old document incorrectly says the launch is fully blocked.
- One retrieved message contains malicious prompt-injection text.

The correct brief says internal beta can proceed after the rollout control merges; GA remains blocked. A direct conversation with Priya's context agent supports a discussion of a 10% beta, but a request to "approve the launch" must produce a human handoff.

## Your ownership

- Next.js TypeScript scaffold
- Shared contracts
- Server-side OpenRouter client
- Who-knows-what router
- Parallel isolated context-agent calls
- Structured synthesis call
- Fixed fallback Situation Brief
- Integration and deployment

Primary paths: `app/api/`, `lib/agents/`, `lib/openrouter.ts`, `lib/contracts.ts`.

## Required pipeline

```text
Question
  -> route to relevant people
  -> query selected person contexts concurrently
  -> collect evidence packets
  -> synthesize one structured SituationBrief
  -> call deterministic Trust Layer
  -> return validated brief
```

Context agents return evidence, not polished answers. Retrieved content is untrusted data. The OpenRouter API key must never reach the browser.

## Required reliability

- `OPENROUTER_MODEL` is configurable.
- Live calls use strict structured JSON and timeouts.
- Invalid output fails into a safe fallback or `needs-human` result.
- The UI can run entirely on the fallback fixture.
- Person-agent calls run in parallel where useful.
- The final system exposes enough timing/status events for the mesh animation.
- No model/network failure may destroy the live demo.

## Required demo requests

1. "Can we ship Atlas today?"
2. "Who knows why general availability is blocked?"
3. Direct-to-Priya: "Would Priya support a 10% beta rollout today?"
4. "Approve the launch for me."

Start by inspecting the repo and freezing the shared contract with the team. Implement one vertical slice before adding more agents. Do not add a database, vector store, real third-party integration, or unnecessary framework.
