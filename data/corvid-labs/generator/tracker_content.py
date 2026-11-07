"""Jira tickets, GitHub PRs and meeting notes for the extended Corvid Labs corpus.
Storyline matches the Slack and email content (Oct 26 - Nov 6, 2026)."""

JIRA = [
 # id, title, type, priority, status, assignee, reporter, created, updated, epic, description, labels
 ("ATLAS-30","Beta release: design partner rollout (epic)","Epic","High","In Progress","priya","jasmine","10-20 10:00","11-06 12:20","-","Umbrella for the design-partner beta. Checklist: 7 of 9 done. Open: PR #219 merged, Priya go/no-go.",["beta"]),
 ("ATLAS-34","CSV export of usage","Story","Medium","Done","nadia","kwame","10-08 09:00","10-30 16:30","ATLAS-30","Export usage as CSV with workspace timezone timestamps.",["frontend"]),
 ("ATLAS-36","Rollout control UI (percentage slider, allowlist, kill switch)","Story","High","In Review","sam","kwame","10-20 09:00","11-06 13:31","ATLAS-30","Slider snaps to 1/5/10/25/50/100. Default 0% plus allowlist. aria-valuetext required.",["frontend","rollout"]),
 ("ATLAS-37","API v1 endpoints","Story","High","Done","alex","kwame","10-12 09:00","11-06 11:42","ATLAS-30","Workspaces, usage, dashboards, exports. Cursor pagination, max page size 500.",["backend"]),
 ("ATLAS-38","Security review for Atlas","Task","Critical","In Progress","jordan","priya","10-14 09:00","11-05 10:32","ATLAS-30","Threat model and pen test. Beta: no security blocker. GA: export audit log (ATLAS-50) and SSO verification (ATLAS-41) still open.",["security"]),
 ("ATLAS-40","Load test: dashboard queries at 200 concurrent users","Task","High","Done","ben","alex","10-22 09:00","10-30 12:40","ATLAS-30","Results: 30-day p99 420 ms, 90-day p99 1.4 s (target 800 ms). Decision: beta caps ranges at 30 days.",["perf"]),
 ("ATLAS-41","Enterprise SSO verification","Task","High","To Do","ingrid","jordan","10-14 10:00","11-05 09:10","ATLAS-38","Verification with Northwind (Okta) and Kestrel (Azure AD) on Nov 10. GA only; not required for flag-gated beta.",["sso"]),
 ("ATLAS-44","Azure AD SAML NotBefore failures","Bug","Critical","In Progress","ingrid","ingrid","11-04 14:00","11-06 10:01","ATLAS-41","About 8% of Azure AD logins fail; Azure clock runs ahead and we allow zero skew. Fix: 90-second tolerance (PR #223).",["sso","bug"]),
 ("ATLAS-47","Query cache for 90-day ranges","Story","Medium","To Do","alex","alex","10-30 12:52","11-05 17:06","ATLAS-40","Cache 90-day dashboard ranges. Target GA. PR #217 is the draft.",["perf"]),
 ("ATLAS-49","Verify kill switch end to end on staging","Task","High","Done","devon","sam","10-29 13:20","11-05 16:40","ATLAS-30","Turning atlas.enabled off returns 404 across pods within 9 s. Runbook updated.",["ops","rollout"]),
 ("ATLAS-50","Export audit log","Story","High","To Do","jordan","jordan","11-05 10:32","11-05 10:32","ATLAS-38","Required for GA. Not required for flag-gated design-partner beta.",["security","ga"]),
 ("ATLAS-52","Empty states for dashboards and date picker","Story","Low","In Progress","nadia","chloe","11-02 10:00","11-06 10:05","ATLAS-30","Copy from Chloe pending. Date picker capped at 30 days behind the flag.",["frontend"]),
 ("SEC-112","Cross-tenant access on GET /v1/exports/{id}","Bug","Critical","Done","alex","jordan","11-03 08:41","11-05 10:32","ATLAS-38","Fetch did not check workspace ownership. Fixed in #216; cross-tenant tests cover 14 endpoints. Retested on staging.",["security","bug"]),
 ("INC-2291","Duplicate usage events after DST fallback (Sev2)","Incident","High","Done","wei","wei","11-02 10:11","11-05 10:30","-","Hourly buckets keyed on local time double-counted 1-2 AM on Nov 1 for 41 workspaces. Fixed in #221; backfill and billing recompute done.",["incident","data-correctness"]),
 ("INC-2294","Staging deploy blocked by table lock","Incident","Low","Done","devon","devon","11-04 09:15","11-05 14:00","-","Non-concurrent index on usage_rollups locked the table for 41 minutes. CI check added (#222).",["incident","ci"]),
 ("SUP-1180","Northwind usage dashboard shows double usage","Support","High","Done","mateo","laura","11-02 09:48","11-05 11:00","-","Caused by INC-2291. Corrected report sent to Northwind. No duplicate charges.",["support"]),
 ("PLAT-412","Grafana SLO panels for Atlas beta","Task","Medium","In Progress","hana","hana","10-28 10:00","11-04 15:00","ATLAS-30","Panels under Atlas/Beta. Alerts route to #eng-oncall. On PTO Nov 5-13.",["observability"]),
 ("BILL-209","Recompute billing aggregates for Nov 1","Task","High","Done","lucas","wei","11-02 11:05","11-05 10:15","INC-2291","Aggregates recomputed for 41 workspaces; totals match raw events.",["billing"]),
 ("DOC-77","Atlas API guide: pagination and errors","Task","Medium","In Review","isabel","alex","10-27 16:10","11-03 09:00","ATLAS-37","Document cursor pagination and request ids (#225).",["docs"]),
 ("LEGAL-31","Lumen Health beta DPA addendum","Task","High","In Progress","rebecca","maya","10-29 09:40","11-06 10:45","ATLAS-30","30-day retention accepted; 72h deletion; 14-day sub-processor notice. Countersignature expected Monday Nov 9.",["legal"]),
 ("HIRE-58","Backend hire: Grace Kim","Task","Low","Done","olivia","kwame","09-20 10:00","11-02 09:05","-","Started Nov 2.",["people"]),
 ("ATLAS-54","Usage-based billing: metering topic schema v2","Story","Medium","To Do","lucas","ethan","11-03 10:00","11-03 10:00","-","Schema for usage events used by Atlas dashboards. Post-GA.",["billing"]),
]

GITHUB = [
 # number, title, author, state, created, merged/updated, reviewers, checks, description, linked
 (207,"Cursor pagination for API v1","alex","merged","10-26 17:00","10-27 16:02",["kwame"],"green","Cursor-based pagination, max 500. Docs ticket DOC-77.",["ATLAS-37"]),
 (209,"Hourly and daily rollup tables","wei","merged","10-27 12:00","10-28 17:20",["alex","lucas"],"green","Per-workspace rollups. Staging backfill finished.",["ATLAS-37"]),
 (211,"CSV export UI","nadia","merged","10-29 11:00","10-30 16:30",["sam"],"green","Timestamps use workspace timezone.",["ATLAS-34"]),
 (212,"Kill switch and rollout flags","sam","merged","10-28 14:00","10-29 13:05",["devon"],"green","atlas.enabled and atlas.rollout_pct in LaunchDarkly, default off.",["ATLAS-36"]),
 (214,"Atlas API v1","alex","merged","10-29 17:44","11-06 11:42",["wei","grace","kwame"],"green (184/184)","Workspaces, usage, dashboards, exports. Large PR; fixes from #216 and #222 included.",["ATLAS-37"]),
 (216,"Ownership check on export fetch + cross-tenant tests","alex","merged","11-03 09:30","11-04 16:12",["jordan","marcus"],"green (14 endpoints)","Fixes SEC-112.",["SEC-112"]),
 (217,"Query cache for 90-day ranges","alex","draft","11-04 11:00","11-05 17:06",[],"pending","Draft. Pairing with Grace. Not part of beta.",["ATLAS-47"]),
 (219,"Percentage rollout control UI","sam","open","10-27 10:00","11-06 13:31",["leo","chloe"],"failing: axe focus-order check","Slider, allowlist table, typed-confirm kill switch. Fix pushed for keyboard focus order. Leo re-reviewing.",["ATLAS-36"]),
 (221,"Dedupe usage events on event_id","wei","merged","11-02 14:00","11-04 13:35",["lucas","alex"],"green","Fixes INC-2291.",["INC-2291"]),
 (222,"CI: reject non-concurrent index on big tables","devon","merged","11-04 10:30","11-05 14:00",["alex"],"green","Migrations locking tables over 1M rows fail CI.",["INC-2294"]),
 (223,"SAML clock-skew tolerance (90 s)","ingrid","open","11-05 09:00","11-06 10:01",["jordan"],"green","Fixes ATLAS-44. Needed before Nov 10 verification.",["ATLAS-44"]),
 (225,"Request ids in API error responses","grace","merged","11-03 13:50","11-04 15:30",["alex"],"green","Grace's first PR.",["ATLAS-37"]),
]

MEETINGS = [
 ("MTG-1105","Launch review: beta sequence","2026-11-05 11:00","priya",["priya","kwame","maya","jordan","fatima","devon","sam","alex"],
  "Decisions:\n- Beta goes to Northwind and Kestrel first, by allowlist. Lumen waits for its countersigned DPA.\n- Beta caps date ranges at 30 days (ATLAS-40).\n- Security: no objection to flag-gated beta. GA still needs ATLAS-41 and ATLAS-50.\n- General availability is decided only after the Nov 10 SSO verification.\nOpen: Azure AD clock skew (ATLAS-44) must land before Nov 10.\nRecorded principle (owner-confirmed): internal or design-partner beta may ship before enterprise SSO if the rollout is reversible. GA may not."),
 ("MTG-1106","Incident review: INC-2291 and INC-2294","2026-11-06 13:00","jordan",["jordan","wei","devon","aisha","ethan"],
  "Reviewed the DST duplicate incident and the staging lock. Action items: postmortem Monday Nov 9 (Wei). Add concurrent-index CI check (done, #222). Confirm billing recompute (done, BILL-209)."),
 ("MTG-1103","Design partner check-in: Northwind, Kestrel, Lumen","2026-11-06 11:30","maya",["maya","diego","chloe","omar"],
  "Northwind and Kestrel: ready, agreements signed. Lumen: DPA countersignature expected Monday. All three accepted beta limits: no enterprise SSO, 30-day ranges, reversible rollout. Ops leads want to see who has access right now (allowlist table)."),
 ("MTG-1031","Q4 planning: Atlas headcount","2026-10-22 14:00","elena",["elena","marcus","priya","sanjay"],
  "Two backend hires and one SRE approved, contingent on GA forecast. Forecast assumes GA by Dec 15 with Halvorsen signed; a slip to Q1 moves about $60k out of Q4 recognized revenue."),
 ("MTG-1028","Design partner interview synthesis","2026-10-28 16:00","omar",["omar","chloe","priya","maya"],
  "Six interviews. Top needs: know who has access, pause a rollout instantly, see raw events behind numbers. Allowlist and kill switch are in the design."),
]

DOCS = [
 ("DOC-LP1","Launch plan v1 (SUPERSEDED)","jasmine","2026-10-20","Targets Nov 20 general launch with SSO. Superseded on Oct 21: do not use externally. Replaced by: beta early November for design partners; GA TBD after SSO verification."),
 ("DOC-BG1","Atlas beta guide (draft)","isabel","2026-11-03","Email and password with MFA for beta. Date ranges capped at 30 days. SSO arrives with GA. Kill switch and allowlist explained."),
 ("DOC-ONB1","Engineering onboarding","olivia","2026-10-01","Okta groups for staging read-only access; corvid db connect staging. Requests approved by the team lead."),
 ("DOC-OKR1","Q4 OKRs: Corvid","elena","2026-10-02","Ship Atlas design-partner beta; close Q4 at 100%+ of plan; keep SOC 2 evidence current."),
]
