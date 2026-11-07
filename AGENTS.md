<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## A-SYNCH goal checklist

Before finishing any change, and at every milestone (PR merge, Nov 15 prototype, demos), run `pnpm typecheck && pnpm eval && pnpm smoke:backend` and walk through `docs/GOAL_CHECKLIST.md`. It maps every promise in the team's Full Context doc (trust rules, what we won't do, perspective tiers, Situation Brief) to code and tests. Update a row's status in the same change if it moves. Never use "clone", "twin" or "replica" for context agents.

## Current hackathon ownership — source of truth

The team changed roles on Nov 7. Ignore older assumptions:

- **Edmund owns the frontend rebuild.** Read `docs/hackathon/ROLE_EDMUND_AI.md` before changing UI code. Owned paths: `web/src/`, `app/page.tsx`, `app/layout.tsx`, and frontend assets.
- **Vedant owns realistic demo data and safety.** Read `docs/hackathon/ROLE_VEDANT_AI.md` before changing fixtures or Trust Layer code. Owned paths: `data/`, `lib/trust/`, `evals/`, and `docs/security/`.
- **The Part B contributor owns the perspective voice agent.** Read `docs/hackathon/ROLE_PART_B_AI.md` and `docs/hackathon/PART_B_PERSPECTIVE_SPEC.md`. Owned paths: `web/src/part-b/`, `lib/part-b/`, `data/atlas/perspectives.json`, `evals/part-b.test.ts`, and the person-chat route. These narrower paths override the broader Edmund/Vedant ownership while that branch is active.
- **Daksh owns backend integration, contracts, final merges, and deployment.** Only Daksh changes `lib/contracts.ts` or API response shapes unless he explicitly approves a proposal.

Read `docs/hackathon/CURRENT_WORKSTREAMS.md` for branch rules, acceptance criteria, and the exact handoff procedure. Do not edit another person's owned paths merely to make your work easier; leave a written integration note instead.

For any Part B work, read `docs/hackathon/PART_B_PERSPECTIVE_SPEC.md`. Part B is not merely speech input/output: it is a multi-turn conversation grounded in a specific person's owner-confirmed reasoning, scoped priorities, tradeoff logic, and stated decision posture. Voice is the interface to that perspective layer.
