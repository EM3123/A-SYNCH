<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## A-SYNCH goal checklist

Before finishing any change, and at every milestone (PR merge, Nov 15 prototype, demos), run `pnpm typecheck && pnpm eval && pnpm smoke:backend` and walk through `docs/GOAL_CHECKLIST.md`. It maps every promise in the team's Full Context doc (trust rules, what we won't do, perspective tiers, Situation Brief) to code and tests. Update a row's status in the same change if it moves. Never use "clone", "twin" or "replica" for context agents.
