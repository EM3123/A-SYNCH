import json, sys, shutil, zipfile, pathlib
from datetime import datetime, timedelta, date
sys.path.insert(0, ".")
from world import PEOPLE, BY_ID, LEAVE, EXTERNAL, EXT, TEAMS, NOW, T, iso, email_of, name_of, ET
from slack_content import CHANNELS, DMS, THREADS
from email_content import EMAILS
import tracker_content as TC
from zoneinfo import ZoneInfo

OUT = pathlib.Path("./out/corvid-labs-context")
shutil.rmtree(OUT.parent, ignore_errors=True)
for d in ["people", "calendars", "slack", "email", "tracker", "meetings", "docs"]:
    (OUT / d).mkdir(parents=True, exist_ok=True)

ERRORS = []
def check(cond, msg):
    if not cond: ERRORS.append(msg)

ALLOWED_RECIPIENTS = {"all", "all-atlas-leads"}
def pid_ok(pid): return pid in BY_ID or pid in EXT or pid in ALLOWED_RECIPIENTS

# ---------- people ----------
(OUT/"people"/"people.json").write_text(json.dumps({
    "company": "Corvid Labs", "domain": "corvidlabs.io", "headcount": len(PEOPLE),
    "note": "Fictional company. All people, emails, messages and records are invented for the A-SYNCH demo.",
    "people": PEOPLE}, indent=2, ensure_ascii=False))
(OUT/"people"/"teams.json").write_text(json.dumps(TEAMS, indent=2))
(OUT/"people"/"external_contacts.json").write_text(json.dumps(EXTERNAL, indent=2, ensure_ascii=False))

# ---------- calendars and availability ----------
def leave_for(pid, day):
    for lv in LEAVE:
        if lv["personId"] == pid and date.fromisoformat(lv["start"]) <= day <= date.fromisoformat(lv["end"]):
            return lv
    return None

SPECIAL = {  # one-off events from the storyline, in US Eastern unless the person is elsewhere
    "2026-11-05": [("launch-review", "Launch review: beta sequence", "11:00", "11:45", ["priya","kwame","maya","jordan","fatima","devon","sam","alex"])],
    "2026-11-06": [
        ("qbr", "Executive QBR", "13:00", "16:30", ["priya"]),
        ("incident-review", "Incident review: INC-2291 and INC-2294", "13:00", "15:00", ["jordan","wei","devon","aisha","ethan"]),
        ("design-sync", "Design system sync", "13:00", "14:45", ["leo"]),
        ("partner-checkin", "Design partner check-in", "11:30", "12:00", ["maya","diego","chloe","omar"]),
        ("standup-go", "Beta go/no-go prep", "15:00", "15:30", ["kwame","fatima","devon"]),
    ],
    "2026-11-09": [("postmortem", "INC-2291 postmortem (draft review)", "10:00", "11:00", ["wei","aisha","ethan","lucas","jordan"])],
    "2026-11-10": [("sso-verify", "SSO verification: Northwind (Okta) and Kestrel (Azure AD)", "10:00", "11:00", ["ingrid","jordan","priya","kwame","maya"])],
}
WORKDAYS = [date(2026,11,d) for d in range(2,14) if date(2026,11,d).weekday() < 5]

def events_for(p):
    tz = ZoneInfo(p["timezone"]); sh, eh = map(int, (p["workingHours"]["start"][:2], p["workingHours"]["end"][:2]))
    evs = []
    for day in WORKDAYS:
        lv = leave_for(p["id"], day)
        if lv:
            evs.append({"title": lv["publicLabel"], "type": "out-of-office", "start": f"{day}T00:00", "end": f"{day}T23:59", "tz": p["timezone"], "visibility": "public"})
            continue
        def at(h, m=0, d=day, z=tz): return datetime(d.year, d.month, d.day, h, m, tzinfo=z)
        # lunch every day, in the person's own time zone
        evs.append({"title": "Lunch", "type": "focus", "start": at(12).isoformat(), "end": at(12,45).isoformat(), "tz": p["timezone"], "visibility": "public"})
        if p["team"] in {"atlas-backend","atlas-frontend","platform","qa","security","data","billing","design","customer-success"}:
            evs.append({"title": f"{p['teamName']} standup", "type": "standing", "start": at(sh+1,0).isoformat(), "end": at(sh+1,15).isoformat(), "tz": p["timezone"], "visibility": "public"})
        if p["managerId"] and day.weekday() == 1:
            evs.append({"title": f"1:1 with {BY_ID[p['managerId']]['name']}", "type": "1:1", "start": at(14).isoformat(), "end": at(14,30).isoformat(), "tz": p["timezone"], "visibility": "public"})
        if day.weekday() == 3 and p["team"] in {"leadership","product"}:
            evs.append({"title": "Leadership sync", "type": "standing", "start": at(10).isoformat(), "end": at(11).isoformat(), "tz": "America/New_York", "visibility": "public"})
        for key, title, s, e, attendees in SPECIAL.get(day.isoformat(), []):
            if p["id"] in attendees:
                sh_, sm_ = map(int, s.split(":")); eh_, em_ = map(int, e.split(":"))
                evs.append({"title": title, "type": "meeting", "start": datetime(day.year,day.month,day.day,sh_,sm_,tzinfo=ET).isoformat(), "end": datetime(day.year,day.month,day.day,eh_,em_,tzinfo=ET).isoformat(), "tz": "America/New_York", "visibility": "public"})
    if p["id"] == "ingrid":
        evs.append({"title": "Offline after 11 AM ET (Copenhagen working hours)", "type": "focus", "start": "2026-11-06T11:00:00-05:00", "end": "2026-11-06T23:59:00-05:00", "tz": "America/New_York", "visibility": "public"})
    return evs

def status_at(p, now):
    if leave_for(p["id"], now.date()):
        lv = leave_for(p["id"], now.date())
        return {"status": "away", "label": lv["publicLabel"], "reason": lv["type"]}
    # meetings and leave win over lunch and focus blocks
    for ev in sorted(events_for(p), key=lambda e: e["type"] in {"focus"}):
        s = datetime.fromisoformat(ev["start"]); e = datetime.fromisoformat(ev["end"])
        if s.tzinfo is None: s = s.replace(tzinfo=ZoneInfo(ev["tz"]))
        if e.tzinfo is None: e = e.replace(tzinfo=ZoneInfo(ev["tz"]))
        if s <= now < e:
            if ev["type"] in {"focus"}: return {"status": "away", "label": ev["title"], "reason": "focus"}
            if ev["type"] == "out-of-office": return {"status": "away", "label": ev["title"], "reason": "out-of-office"}
            return {"status": "busy", "label": f"{ev['title']} until {e.astimezone(ET):%-I:%M %p} ET", "reason": ev["type"]}
    local = now.astimezone(ZoneInfo(p["timezone"]))
    if not (int(p["workingHours"]["start"][:2]) <= local.hour < int(p["workingHours"]["end"][:2])) or local.weekday() >= 5:
        return {"status": "away", "label": "Outside working hours", "reason": "hours"}
    return {"status": "available", "label": "Available now", "reason": "free"}

allcal = {}
availability = []
for p in PEOPLE:
    evs = events_for(p)
    allcal[p["id"]] = {"personId": p["id"], "name": p["name"], "timezone": p["timezone"], "events": evs}
    (OUT/"calendars"/f"{p['id']}.json").write_text(json.dumps(allcal[p["id"]], indent=2))
    st = status_at(p, NOW)
    availability.append({"personId": p["id"], "name": p["name"], "title": p["title"], "team": p["teamName"],
                         "timezone": p["timezone"], "asOf": iso(NOW), "availability": st["status"], "label": st["label"], "reason": st["reason"]})
(OUT/"calendars"/"availability_now.json").write_text(json.dumps({"asOf": iso(NOW), "note": "Computed from calendars and leave at Fri Nov 6, 2026, 2:30 PM ET.", "people": availability}, indent=2))
(OUT/"people"/"leave.json").write_text(json.dumps(LEAVE, indent=2))

# ---------- Slack ----------
def chan_meta():
    return [{"id": cid, "name": n, "private": priv, "members": [m for m in mem if pid_ok(m)], "purpose": purpose} for cid, n, priv, mem, purpose in CHANNELS]
(OUT/"slack"/"channels.json").write_text(json.dumps(chan_meta(), indent=2, ensure_ascii=False))
(OUT/"slack"/"dms.json").write_text(json.dumps([{"id": i, "members": m} for i, m in DMS], indent=2))
chan_ids = {n: cid for cid, n, *_ in CHANNELS}
dm_ids = {i: i for i, _ in DMS}
channel_members = {n: set(mem) for _, n, _, mem, _ in CHANNELS}

by_chan = {}
thread_no = 0
for where, msgs in THREADS:
    if where not in chan_ids and where not in dm_ids:
        ERRORS.append(f"unknown channel {where}")
        continue
    thread_no += 1
    tid = f"T{thread_no:03d}"
    prev = None
    for author, stamp, text, reactions in msgs:
        check(author in BY_ID or author in EXT, f"unknown Slack author {author} in {where}")
        if author in BY_ID and where in channel_members:
            check(author in channel_members[where], f"{author} posts in {where} without membership")
        t = T(stamp)
        by_chan.setdefault(where, []).append({"thread": tid, "ts": iso(t), "author": author,
            "authorName": name_of(author), "isExternal": author in EXT, "text": text,
            "reactions": reactions or {}, "channel": where, "channelId": chan_ids.get(where, where)})
for where, items in by_chan.items():
    items.sort(key=lambda m: m["ts"])
    safe = where.replace("/", "_")
    (OUT/"slack"/f"{safe}.json").write_text(json.dumps(items, indent=2, ensure_ascii=False))

# ---------- Email ----------
threads_out = []
for th in EMAILS:
    msgs = []
    prev = None
    for sender, to, cc, stamp, body in th["messages"]:
        for pid in [sender, to, *cc]:
            check(pid_ok(pid), f"bad recipient {pid} in {th['id']}")
        t = T(stamp)
        if prev: check(t >= prev, f"email out of order {th['id']} {stamp}")
        prev = t
        def addr(x):
            if x in ALLOWED_RECIPIENTS: return x + "@corvidlabs.io"
            return email_of(x)
        msgs.append({"from": addr(sender), "fromName": name_of(sender) if sender in BY_ID or sender in EXT else sender,
                     "to": [addr(to)], "cc": [addr(c) for c in cc], "sentAt": iso(t), "body": body})
    threads_out.append({"id": th["id"], "subject": th["subject"], "participants": th["participants"], "messages": msgs})
(OUT/"email"/"threads.json").write_text(json.dumps(threads_out, indent=2, ensure_ascii=False))

# ---------- Jira / GitHub / meetings / docs ----------
(OUT/"tracker"/"jira.json").write_text(json.dumps([
    {"key": k, "title": t, "type": ty, "priority": pr, "status": st, "assignee": a, "reporter": rp,
     "created": iso(T(c)), "updated": iso(T(u)), "epic": ep, "description": d, "labels": lb}
    for (k, t, ty, pr, st, a, rp, c, u, ep, d, lb) in TC.JIRA], indent=2, ensure_ascii=False))
(OUT/"tracker"/"github_prs.json").write_text(json.dumps([
    {"repo": "corvidlabs/atlas", "number": n, "title": t, "author": a, "state": s, "opened": iso(T(c)),
     "lastUpdated": iso(T(u)), "reviewers": r, "checks": ck, "description": d, "linked": ln}
    for (n, t, a, s, c, u, r, ck, d, ln) in TC.GITHUB], indent=2, ensure_ascii=False))
(OUT/"meetings"/"meeting_notes.json").write_text(json.dumps([
    {"id": i, "title": t, "start": iso(datetime.fromisoformat(s).replace(tzinfo=ET)), "organizer": o, "attendees": a, "notes": n}
    for (i, t, s, o, a, n) in TC.MEETINGS], indent=2, ensure_ascii=False))
(OUT/"docs"/"docs.json").write_text(json.dumps([
    {"id": i, "title": t, "owner": o, "updated": u, "summary": s} for (i, t, o, u, s) in TC.DOCS], indent=2, ensure_ascii=False))

# ---------- checks on the cross-source story ----------
jira_keys = {j[0] for j in TC.JIRA}; pr_nums = {g[0] for g in TC.GITHUB}
for g in TC.GITHUB:
    for ln in g[9]:
        check(ln.startswith(("ATLAS","SEC","INC","SUP","PLAT","BILL","DOC","LEGAL","HIRE")) or ln in jira_keys, f"PR {g[0]} links missing {ln}")
for j in TC.JIRA:
    for who in [j[5], j[6]]:
        check(who in BY_ID, f"{j[0]} unknown person {who}")
for p in PEOPLE:
    check(p["managerId"] is None or p["managerId"] in BY_ID, f"bad manager {p['id']}")
    check(p["id"] in allcal, "missing calendar")
    check(len(allcal[p["id"]]["events"]) > 0, f"no calendar {p['id']}")

if ERRORS:
    print("VALIDATION ERRORS:"); [print(" -", e) for e in ERRORS[:50]]
    sys.exit(1)
print("OK: people", len(PEOPLE), "channels", len(CHANNELS), "slack messages", sum(len(v) for v in by_chan.values()), "emails", len(threads_out), "jira", len(TC.JIRA), "prs", len(TC.GITHUB))
