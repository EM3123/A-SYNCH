# AI Handoff: Safety and Privacy Workstream

You are helping build **A-SYNCH**. This workstream makes sure A-SYNCH is something a security team would approve and an employee would trust: people see only what they could already open, nothing speaks or decides for a person, and nothing is collected that wasn't chosen.

Read first: `docs/GOAL_CHECKLIST.md` (the promises), `docs/security/TRUST_LAYER.md` (what's already enforced).

## Why it matters

Your interviews said new vendor review is the hardest gate. Competitors lost trust by recording screens (Knowledgework) or acting for people (Viven). "Easy to approve" is one of our six differentiators, so safety and privacy are part of the product, not a side task.

## Ownership

| Area | Owner | Paths |
|---|---|---|
| Trust Layer rules, evals, data policy docs | Edmund | `lib/trust/`, `evals/`, `docs/security/` |
| Identity, API, model calls | Daksh | `app/api/`, `lib/backend.ts`, `lib/openrouter.ts` |
| Trust labels, warnings, owner view, consent UI | Vedant | `app/` UI, `components/` |

Only Daksh changes `lib/contracts.ts`. Propose contract changes to him.

## Already done (Nov 7)

- Deterministic Trust Layer on every answer: citations, permissions, freshness, conflicts, prompt injection, approval requests, fake approvals, impersonation, emotion inference, leaks of restricted records
- Labels only go down; unsure → hand off to the owner
- Audit trace with ids and decisions only (no evidence text, question hashed)
- 24 tests (`pnpm eval`)

## Work, in priority order

### P0: before the demo

1. **Requester identity is spoofable.** `app/api/ask`, `ask/stream` and `people/[personId]/chat` read `requesterId` straight from the request body, so anyone can send `"requesterId": "priya"` and see her private note. For the demo, ignore the body value and use `DEMO_REQUESTER_ID` (or a server-side demo user switcher). Before the pilot, take identity from a real login (Slack OAuth). *Daksh.* Test: a request claiming to be `priya` still can't see `private-leadership-note`.
2. **Show the trust state in the UI.** Every answer shows its label, the cited sources with dates, any security event ("Ignored 1 untrusted message", "Only Priya can approve this"), and an "Ask {owner}" button when `requiresHuman` is true. *Vedant.* See `TRUST_LAYER.md` for field names.
3. **Agents always identify as AI.** Person mode UI says "Priya's context agent", never just "Priya". *Vedant.*

### P1: before the Nov 15 pilot

4. **Decide the open tradeoff: owner visibility vs. asker anonymity.** Recommended default: owners see questions about their work, askers stay anonymous unless the question needs the owner's direct reply. Then store `requesterId` in the audit only when a hand-off happens. *Team decision, then Edmund + Daksh.*
5. **Owner view.** Owners see what was asked about their work (from `audit.ownerIds`) and can confirm or correct a predicted opinion, so their answer joins the context. *Vedant (UI), Daksh (API).*
6. **Owner controls what's shared.** Each owner chooses which sources feed their context agent and can exclude items. Nothing is collected passively. *Daksh, Vedant.*
7. **Model data handling.** Evidence is sent to the model provider through `lib/openrouter.ts`. Pick a provider/route with no training on prompts and no retention, write it down in `docs/security/DATA_HANDLING.md`, and never send records the asker can't open (already true: filtering happens before synthesis). *Daksh, Edmund.*
8. **Permissions from the source.** With real connectors, each record's `permittedUsers` must come from the source tool's own permissions (GitHub repo access, Jira project, Slack channel membership), checked at answer time. *Daksh.*
9. **Audit log storage.** `ASYNCH_AUDIT=1` only prints to the console. For the pilot, store audits with a retention limit (e.g. 30 days) and owner/asker access rules from item 4. *Daksh, Edmund.*

### P2: after the pilot

10. **Storage security.** Store text chunks encrypted per company with per-user keys; treat embeddings as sensitive (they can be largely reversed back to text). Namespaces separate companies; document-level permissions handle the rest.
11. **Distribution that's easy to approve.** Ship as an MCP server or Claude skill that runs inside AI tools companies already approved.
12. **Security one-pager** for pilot companies: what's collected, where it lives, who sees it, how to delete it, what we never do.
13. **Stronger checks.** Today's checks are patterns and word overlap. Add more adversarial eval cases (rephrased injections, indirect approval claims, multi-turn attempts) and widen the rules when one gets through.

## Never do (from the Full Context doc)

- No emotion inference: it reads as surveillance, and the EU AI Act broadly restricts emotion recognition at work
- No passive screen or audio recording
- No training on company data
- No "clone", "twin" or "replica"; they're context agents
- Never decide, approve or commit for a person; never speak as them

## Definition of done

- `pnpm typecheck && pnpm eval && pnpm smoke:backend` all pass
- A new eval case exists for every rule you add or bug you fix
- `docs/GOAL_CHECKLIST.md` rows updated in the same change
- No secrets, `.env.local` or real company data committed
