# Current Workstreams — Nov 7 Source of Truth

This file overrides older role assignments. The team switched Vedant and Edmund's responsibilities.

| Person | Current responsibility | Branch | Must read |
|---|---|---|---|
| Daksh | Backend integration, contracts, final merge, deployment | `main` / integration branch | `ROLE_DAKSH_AI.md` |
| Edmund | Complete frontend rebuild and demo UX | `feature/web-shell` (active, includes `eca2718`) | `ROLE_EDMUND_AI.md` |
| Vedant | Realistic seeded data, Trust Layer, adversarial evals | `feature/vedant-data-safety` | `ROLE_VEDANT_AI.md` |

## Message each teammate should give their AI

### Edmund

> Fetch the latest A-SYNCH branches. Read AGENTS.md and docs/hackathon/ROLE_EDMUND_AI.md completely, then continue the frontend workstream on feature/web-shell, preserving commit eca2718 and any newer teammate work. Judge the interface against the acceptance criteria; the metaphor is optional and clarity wins. Do not change backend contracts or data/safety files. Push the branch and report the commit SHA, screenshots, and test results.

### Vedant

> Pull the latest A-SYNCH main branch. Read AGENTS.md and docs/hackathon/ROLE_VEDANT_AI.md completely, then execute that data-and-safety workstream on branch feature/vedant-data-safety. Preserve existing evidence IDs and contracts, make the seeded company context realistic, fix requester spoofing, and expand adversarial tests. Do not change frontend files. Push the branch and report the commit SHA, record counts, and test results.

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

1. Vedant's data/safety branch is reviewed and merged first.
2. Daksh verifies backend/evals and records any API-visible data changes.
3. Edmund rebases or merges latest `main`, verifies the complete browser flow, and hands off.
4. Daksh performs the final integration, production build, demo rehearsal, and push.

The product scope remains a polished, honest seeded demo. Real Slack, Jira, GitHub, calendar, or meeting ingestion is explicitly out of scope.
