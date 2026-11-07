"""Builds the Trust Layer dataset (../trust/) from the Corvid Labs corpus.

Inputs:  ../people/people.json, ../calendars/availability_now.json, ../trust/core-evidence.json
         (storyline records; ids are kept because the demo answers and tests cite them),
         plus the Slack, email, Jira, GitHub, meeting and doc sources in this folder.
Outputs: ../trust/people.json, ../trust/evidence.json, ../trust/expertise.json
Run:     python3 build_trust.py   (from this folder)
"""
import json, re, pathlib, sys
sys.path.insert(0, ".")
from world import BY_ID, EXT, PEOPLE, T, iso
from slack_content import CHANNELS, DMS, THREADS
from email_content import EMAILS
import tracker_content as TC

TRUST = pathlib.Path("../trust")
CORE = json.loads((TRUST/"core-evidence.json").read_text())
CORE_IDS = {r["id"] for r in CORE}
EXPERTISE_CORE = json.loads((TRUST/"expertise-core.json").read_text())
AVAIL = {p["personId"]: p for p in json.loads(pathlib.Path("../calendars/availability_now.json").read_text())["people"]}
INTERNAL = set(BY_ID)
# The five people the demo routes to. Richer topics keep launch questions routed to them.
CORE_TOPICS = {
    "priya": {"atlas", "launch", "release", "beta", "approval", "approve", "ship", "rollout", "ga", "general", "availability", "product", "tradeoffs", "principle", "support", "priya"},
    "alex": {"atlas", "backend", "api", "tests", "staging", "ship", "ready", "readiness", "deploy", "performance", "alex"},
    "sam": {"atlas", "rollout", "frontend", "ui", "accessibility", "feature", "flags", "beta", "ship", "kill", "switch", "sam"},
    "jordan": {"atlas", "security", "sso", "review", "risk", "ga", "launch", "approval", "jordan"},
    "maya": {"atlas", "customer", "customers", "design", "partner", "partners", "beta", "launch", "impact", "maya"},
}
from datetime import datetime
from zoneinfo import ZoneInfo
ET = ZoneInfo("America/New_York")
def when(text):
    """Accepts '2026-11-05 11:00' or '2026-10-20' (Eastern time)."""
    return datetime.fromisoformat(text.strip()).replace(tzinfo=ET) if " " in text.strip() else datetime.fromisoformat(text.strip() + " 09:00").replace(tzinfo=ET)
DM_MEMBERS = dict((i, m) for i, m in DMS)

# external contacts are represented by their internal account owner
EXT_OWNER = {"ext-hollis": "maya", "ext-park": "maya", "ext-osei": "maya", "ext-brandt": "rebecca",
             "ext-lumenbot": "maya", "ext-reyes": "maya", "ext-novak": "maya", "ext-lindqvist": "ryan", "ext-adeyemi": "ryan"}
EXT_OWNER = {k: v for k, v in EXT_OWNER.items() if v in INTERNAL}

def owner_for(author):
    if author in INTERNAL: return author
    return EXT_OWNER.get(author, "maya")

ACCENT = ["#8B5CF6","#3B82F6","#F59E0B","#EF4444","#10B981","#EC4899","#14B8A6","#6366F1","#F97316","#84CC16"]
chan_private = {n: priv for _, n, priv, *_ in CHANNELS}
chan_members = {n: set(m for m in mem if m in INTERNAL) for _, n, _, mem, _ in CHANNELS}
chan_public = {n for _, n, priv, *_ in CHANNELS if not priv}

# ---------- people ----------
people_out, expertise_out = [], {}
core_people = {p["id"] for p in json.loads(pathlib.Path("../trust/core-people.json").read_text())} if pathlib.Path("../trust/core-people.json").exists() else set()
for i, p in enumerate(PEOPLE):
    av = AVAIL[p["id"]]
    topics = sorted({w for s in p["skills"] + p["owns"] for w in re.findall(r"[a-z0-9]+", s.lower()) if len(w) > 2})
    topics = sorted(set(topics) | CORE_TOPICS.get(p["id"], set()))
    people_out.append({
        "id": p["id"], "name": p["name"], "role": p["title"],
        "availability": av["availability"], "availabilityLabel": av["label"],
        "expertise": p["skills"], "topics": topics, "accent": ACCENT[i % len(ACCENT)],
    })
    if p["id"] in EXPERTISE_CORE:
        expertise_out[p["id"]] = EXPERTISE_CORE[p["id"]]
    else:
        expertise_out[p["id"]] = {
            "selectionReason": (f"Owns: {p['owns'][0]}" if p["owns"] else f"Knows about {', '.join(p['skills'][:2])}"),
            "knowsAbout": p["skills"], "owns": p["owns"],
        }
(TRUST/"people.json").write_text(json.dumps(people_out, indent=2, ensure_ascii=False))
(TRUST/"expertise.json").write_text(json.dumps(expertise_out, indent=2, ensure_ascii=False))

# ---------- extra evidence from the Corvid sources ----------
extra, seen = [], set(CORE_IDS)
def add(rec):
    assert rec["id"] not in seen, rec["id"]
    assert rec["ownerId"] in INTERNAL, rec["id"]
    seen.add(rec["id"]); extra.append(rec)

ids_count = {}
def make_id(prefix, stamp):
    k = f"{prefix}-{stamp}"
    ids_count[k] = ids_count.get(k, 0) + 1
    return f"corvid-{prefix}-{re.sub(r'[^0-9]', '', stamp)}-{ids_count[k]}"

PREDICTIVE = re.compile(r"\b(i expect|probably|likely|should be|expect to)\b", re.I)

for where, msgs in THREADS:
    is_dm = where in DM_MEMBERS
    if is_dm:
        perm = sorted(m for m in DM_MEMBERS[where] if m in INTERNAL)
        label = "Slack DM (" + ", ".join(BY_ID[m]["name"] for m in DM_MEMBERS[where] if m in INTERNAL) + ")"
    elif chan_private.get(where):
        perm = sorted(chan_members[where]); label = f"Slack: #{where} (private)"
    else:
        perm = ["*"]; label = f"Slack: #{where}"
    for author, stamp, text, _ in msgs:
        kind = "prediction" if PREDICTIVE.search(text) and author in INTERNAL else "fact"
        add({"id": make_id("slack", stamp), "ownerId": owner_for(author), "sourceType": "slack",
             "title": text[:60].rstrip() + ("…" if len(text) > 60 else ""),
             "sourceLabel": label, "timestamp": iso(T(stamp)),
             "text": text, "permittedUsers": perm, "kind": kind, "ownerApproved": False})

for th in EMAILS:
    internal_parts = [p for p in th["participants"] if p in INTERNAL]
    for i, (sender, to, cc, stamp, body) in enumerate(th["messages"]):
        perm = sorted(set(p for p in [sender, to, *cc] if p in INTERNAL) | set(internal_parts))
        perm = sorted(set(perm) & INTERNAL) or ["*"]
        owner = owner_for(sender)
        add({"id": f"corvid-email-{th['id']}-{i+1}", "ownerId": owner, "sourceType": "note",
             "title": f"{th['subject']} ({i+1}/{len(th['messages'])})", "sourceLabel": f"Email: {th['subject']}",
             "timestamp": iso(T(stamp)), "text": body, "permittedUsers": perm, "kind": "fact", "ownerApproved": False})

for key, title, typ, pr, status, a, rp, c, u, ep, d, lb in TC.JIRA:
    if key in CORE_IDS or key.replace("-", "").lower() in {x.replace("-", "").lower() for x in CORE_IDS}: continue
    perm = ["alex", "jordan", "priya", "marcus", "kwame"] if key.startswith("SEC") else ["*"]
    add({"id": f"corvid-jira-{key.lower()}", "ownerId": a, "sourceType": "jira", "title": f"{key} {title}",
         "sourceLabel": f"Jira: {key} ({status})", "timestamp": iso(T(u)), "text": d, "permittedUsers": perm, "kind": "fact", "ownerApproved": False})

for num, title, author, state, c, u, reviewers, checks, desc, linked in TC.GITHUB:
    rid = f"gh-pr-{num}"
    if rid in CORE_IDS: continue
    add({"id": f"corvid-gh-pr-{num}", "ownerId": author, "sourceType": "github", "title": f"PR #{num} {title}",
         "sourceLabel": f"GitHub: PR #{num} ({state}; checks {checks})", "timestamp": iso(T(u)),
         "text": f"{desc} Reviewers: {', '.join(reviewers) or 'none yet'}. Linked: {', '.join(linked)}.", "permittedUsers": ["*"], "kind": "fact", "ownerApproved": False})

for mid, title, start, organizer, attendees, notes in TC.MEETINGS:
    add({"id": f"corvid-meeting-{mid.lower()}", "ownerId": organizer, "sourceType": "meeting", "title": title,
         "sourceLabel": f"Meeting notes: {title} ({mid})", "timestamp": iso(when(start)),
         "text": notes.replace("\n", " "), "permittedUsers": sorted(a for a in attendees if a in INTERNAL) or ["*"], "kind": "stated-principle" if "principle" in notes.lower() else "fact", "ownerApproved": True})

for did, title, owner, updated, summary in TC.DOCS:
    if owner not in INTERNAL: owner = "elena"
    rec = {"id": f"corvid-doc-{did.lower()}", "ownerId": owner, "sourceType": "note", "title": title,
           "sourceLabel": f"Doc: {title}", "timestamp": iso(when(updated)),
           "text": summary, "permittedUsers": ["*"], "kind": "fact", "ownerApproved": True}
    if "SUPERSEDED" in title: rec["stale"] = True
    add(rec)

out = CORE + extra
(TRUST/"evidence.json").write_text(json.dumps(out, indent=2, ensure_ascii=False))
(TRUST/"trust-metadata.json").write_text(pathlib.Path(TRUST/"trust-metadata.json").read_text())  # unchanged core metadata
print("people", len(people_out), "evidence", len(out), "(core", len(CORE), "+ corvid", len(extra), ")")
