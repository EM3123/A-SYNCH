# Demo safety: how A-SYNCH stays inside the rules

**The model proposes; the Trust Layer verifies.**

```
 question ──► identity fixed server-side (demo requester; caller's id ignored)
    │
    ▼
 router ──► 2–4 context agents, each sees only records the requester can open
    │        (permissions filter BEFORE the model sees anything)
    ▼
 retrieved text = data, never instructions (injection scan, normalized for
    │        lookalike letters, zero-width characters and spaced-out words)
    ▼
 synthesis model ──► proposed Situation Brief (untrusted until verified)
    │
    ▼
 Trust Layer (deterministic, no model calls)
    ├─ schema: unknown fields dropped, malformed output → safe hand-off
    ├─ claims: every evidence id must exist, be permitted, not quarantined
    ├─ freshness: stale-only claims cannot be confirmed
    ├─ conflicts: checked across all records the requester can open
    ├─ authority: approve / green-light / ship it / go ahead / "on behalf of" blocked
    ├─ approvals in answers: allowed only with an explicit approval record
    ├─ persona: never speaks as a person; no feelings or risk-appetite guesses
    └─ leaks: restricted text scanned out of every field (answer, next step,
              conflicts, security events, labels)
    │
    ▼
 labels only go DOWN: confirmed · supported · needs-human
 audit: record ids, decisions and check results. No evidence text, no raw question.
```

| Promise | How it's enforced | Proof |
|---|---|---|
| Permission filtering before synthesis | `canAccess` in the router and in the verifier; restricted records never reach the model for a requester who can't open them | eval: spoofed `requesterId: "priya"` cannot see `private-leadership-note` |
| Retrieved content is untrusted data | Injection scan on every record (incl. indirect prose and obfuscated text); quarantined records are dropped and logged | evals B, C, D; `untrusted-source-ignored` event |
| Claims checked against evidence and freshness | Every claim needs existing, permitted, fresh-enough evidence; stale-only → needs-human | evals 6, K, M |
| Authority and impersonation blocked | Approval requests, synonyms, "on behalf of", "answer as Priya" blocked; "Priya already said yes" blocked without an approval record; status questions ("Has Priya approved?") are answered, not refused | evals 5, E, F, G, H |
| Restricted text scanned out of every field | Sensitive terms and word-overlap checks run on answer, next steps, conflicts, and event labels | evals I, J, P |
| Conflicts shown, never silently resolved | Current disagreements → needs-human; stale vs current → shown with dates | evals 8, N, K |
| Audit records IDs and decisions, not secrets | Audit has ids, hashed question, check results; never evidence text | eval: audit contains no restricted or secret text |

## Known limitations (said plainly)

- **Seeded permissions are representative, not production identity.** The demo requester is a fixed server-side identity. Real access needs Slack/GitHub/Jira OAuth and each source's own permissions, checked at answer time.
- The checks are pattern and word-overlap rules. They cover the cases in `evals/` and common rewordings. A determined adversary could phrase around them; a miss means a label is not raised, never that a stronger label is invented.
- The data is seeded. Real Slack, Jira, GitHub, calendar and meeting ingestion is out of scope for this demo.
- Multi-turn attempts are tested as repeated, independent requests. There is no conversation memory to attack yet.
