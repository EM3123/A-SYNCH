# Current Workstreams — Nov 7 Source of Truth

This file overrides older role assignments. The team switched Vedant and Edmund's responsibilities.

| Person | Current responsibility | Branch | Must read |
|---|---|---|---|
| Daksh | Backend integration, contracts, final merge, deployment | `main` / integration branch | `ROLE_DAKSH_AI.md` |
| Edmund | Complete frontend rebuild and demo UX | `feature/web-shell` (active, includes `eca2718`) | `ROLE_EDMUND_AI.md` |
| Vedant | Realistic seeded data, Trust Layer, adversarial evals | `feature/vedant-data-safety` | `ROLE_VEDANT_AI.md` |
| Part B contributor | Perspective dataset, multi-turn engine, voice conversation | `feature/part-b-perspective-voice` | `ROLE_PART_B_AI.md`, `PART_B_PERSPECTIVE_SPEC.md` |

## Message each teammate should give their AI

### Edmund

> Fetch the latest A-SYNCH branches. Read AGENTS.md and docs/hackathon/ROLE_EDMUND_AI.md completely, then continue the frontend workstream on feature/web-shell, preserving commit eca2718 and any newer teammate work. Part B voice is P0: direct entry from Priya's profile, push-to-talk browser speech recognition, transcript, context-agent response, spoken playback, clear call states, interrupt/stop controls, privacy-safe permission handling, and typed fallback. Judge the interface against every acceptance criterion; the metaphor is optional and clarity wins. Do not change backend contracts or data/safety files. Push the branch and report the commit SHA, screenshots, voice-browser test results, and general test results.

### Vedant

> Pull the latest A-SYNCH main branch. Read AGENTS.md and docs/hackathon/ROLE_VEDANT_AI.md completely, then execute that data-and-safety workstream on branch feature/vedant-data-safety. Preserve existing evidence IDs and contracts, make the seeded company context realistic, fix requester spoofing, and expand adversarial tests. Do not change frontend files. Push the branch and report the commit SHA, record counts, and test results.

### Part B contributor

> Pull the latest A-SYNCH main branch. Read AGENTS.md, docs/hackathon/ROLE_PART_B_AI.md, and docs/hackathon/PART_B_PERSPECTIVE_SPEC.md completely. Create feature/part-b-perspective-voice and implement the isolated full-stack Part B workstream: owner-confirmed perspective records, multi-turn conversation history, deterministic Priya judgment dialogue, browser push-to-talk and spoken responses, citations, authority handoff, and offline fallbacks. Do not change shared contracts or Part A. Push the branch and report the SHA, test results, demo recording/screenshots, and browser limitations.

All contributors must understand the Part B split: the dedicated contributor implements it; Vedant reviews its data/safety boundaries; Edmund integrates it into the final visual shell; Daksh owns final contracts and merge.

## Coordination rules

1. Pull `main` before branching.
2. Do not merge either feature branch into `main`; Daksh integrates both.
3. Do not change `lib/contracts.ts` without an explicit proposal to Daksh.
4. Do not edit another workstream's owned paths. Write an integration note instead.
5. Keep the exact three demo prompts deterministic and offline-safe.
6. Never commit secrets, `.env.local`, real company data, or claims that seeded integrations are live.
7. Every branch must pass its required builds/tests before handoff.
8. A-SYNCH uses “context agent” language only—never imitation language.

## Merge order

1. Vedant's general data/safety branch and the isolated Part B branch may develop in parallel because their owned paths do not overlap.
2. Daksh reviews and merges Vedant, then Part B, resolving only documented integration points.
3. Edmund merges latest `main`, integrates the exported Part B UI into the final visual shell, verifies the complete browser flow, and hands off.
4. Daksh performs the final integration, production build, demo rehearsal, and push.

The product scope remains a polished, honest seeded demo. Real Slack, Jira, GitHub, calendar, or meeting ingestion is explicitly out of scope.
