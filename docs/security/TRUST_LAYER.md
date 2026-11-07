# Trust Layer

**The model proposes; the Trust Layer verifies.** Every Situation Brief goes through `verifyBrief` (in `lib/trust/verify.ts`) before anyone sees it. The checks are deterministic, with no model calls, so the same input always gets the same label.

## In one minute

```bash
pnpm install
pnpm eval            # 24 trust tests, no API key needed
pnpm smoke:backend   # the three demo prompts, end to end
ASYNCH_AUDIT=1 pnpm smoke:backend   # also prints the audit trace
```

## The three labels

| Label | Meaning | UI should show |
|---|---|---|
| `confirmed` | Every claim cites current, permitted evidence that says it | Green. Safe to act on |
| `supported` | Backed by evidence, but something is softer: a prediction, a stale-vs-current conflict, weaker wording overlap | Amber. "Check with the owner" |
| `needs-human` | Missing, forbidden or untrusted evidence, an approval request, or a broken answer | Grey/red. Show `ownerId` and a "Ask {owner}" button |

`brief.trust.requiresHuman` is `true` whenever the answer isn't fully confirmed. Use it to show the hand-off button. Labels can only go **down** from what the model proposed, never up.

## What gets checked, in order

1. **Schema.** Malformed model output becomes a safe hand-off brief.
2. **The question.** Injection ("ignore previous instructions…") or a request to approve, act, change access, or speak as someone → `needs-human` + an `authority-boundary` event.
3. **Each claim's citations.** Unknown id, a record the asker can't open, or a quarantined record → the claim is removed.
4. **Freshness.** Older than the limit for its source (`lib/trust/policy.ts`) → stale. A claim backed only by stale evidence → `needs-human`.
5. **Support.** Claim words must overlap their cited evidence. Predictive wording ("expected to", "likely") → `supported`.
6. **Approvals.** "Priya approved", "you can ship" etc. are only allowed if a cited record has `approvalRecord: true`.
7. **Persona.** "I'm Priya", or guessing feelings or risk appetite → blocked.
8. **Leaks.** Any text from a record the asker can't open → blocked.
9. **Conflicts.** Two records disagree on the same fact: stale vs current → shown with dates, `supported`; two current values → `needs-human`.

## Security events (for the UI)

`response.securityEvents[]`, each `{ type, label, evidenceId? }`:

- `untrusted-source-ignored`: a retrieved message contained instructions and was dropped. Show "Ignored 1 untrusted message".
- `stale-conflict`: an older note disagrees with newer evidence. Show the conflict line from `brief.conflicts`.
- `authority-boundary`: the asker wanted the agent to approve or act. Show "Only {owner} can approve this".

## Changing the demo data

Everything is JSON in `data/atlas/`; no code changes needed.

- `people.json`: the five teammates.
- `expertise.json`: who knows what (feeds the router).
- `evidence.json`: GitHub, Jira, Slack and meeting records. `permittedUsers: ["*"]` = everyone.
- `trust-metadata.json`: per record, the facts it asserts (`assertions`, used to spot conflicts), `sensitiveTerms` for restricted records, and `approvalRecord: true` for a real sign-off.

After editing, run `pnpm eval`. The data tests will tell you if a record is missing metadata or an owner.

## Audit trace

`verifyBrief` returns `audit`: requester id, a hashed question, evidence ids used and excluded, `ownerIds`, and the result of each check. It never contains evidence text or the raw question. Logged only when `ASYNCH_AUDIT=1`.

## For judges

Every claim is checked against the source it cites. The model can't upgrade its own confidence, can't approve anything, can't speak as a person, and can't show you what you couldn't already open. When it isn't sure, it hands you to the human.

## Limits

These are pattern and word-overlap checks built for a hackathon demo. They catch the cases in `evals/` and common rewordings, not every possible adversarial phrasing. A missed check means a stronger label isn't applied; it never invents one. See `docs/GOAL_CHECKLIST.md` for what isn't built yet.
