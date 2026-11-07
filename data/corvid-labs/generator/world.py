"""Corvid Labs: a fictional B2B SaaS company launching Project Atlas.

Everything here is invented. Any resemblance to real people or companies is coincidental.
"""
from datetime import datetime
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
COMPANY = "Corvid Labs"
DOMAIN = "corvidlabs.io"
NOW = datetime(2026, 11, 6, 14, 30, tzinfo=ET)  # Friday


def T(stamp: str) -> datetime:
    """'11-06 13:06' or '10-29 09:15' in US Eastern (handles the Nov 1 DST change)."""
    month_day, clock = stamp.split()
    month, day = map(int, month_day.split("-"))
    hour, minute = map(int, clock.split(":"))
    return datetime(2026, month, day, hour, minute, tzinfo=ET)


def iso(dt: datetime) -> str:
    return dt.isoformat()


# ---------------------------------------------------------------------------
# Teams
# ---------------------------------------------------------------------------
TEAMS = {
    "leadership": "Leadership",
    "atlas-backend": "Atlas Backend",
    "atlas-frontend": "Atlas Frontend",
    "platform": "Platform & SRE",
    "security": "Security",
    "qa": "Quality",
    "design": "Design & Research",
    "data": "Data Engineering",
    "billing": "Billing & Metering",
    "product": "Product",
    "customer-success": "Customer Success & Support",
    "sales": "Sales",
    "legal": "Legal & Compliance",
    "marketing": "Marketing",
    "people": "People Ops",
    "finance": "Finance",
    "docs": "Docs",
}

# id, name, title, team, manager, location, tz, hours (local), start date, status, skills, owns
P = [
    ("elena", "Elena Vasquez", "CEO", "leadership", None, "Pittsburgh, PA", "America/New_York", (9, 18), "2019-03-01",
     ["company strategy", "fundraising", "enterprise customers"], ["company roadmap", "board updates"]),
    ("marcus", "Marcus Webb", "CTO", "leadership", "elena", "Pittsburgh, PA", "America/New_York", (8, 17), "2019-03-01",
     ["architecture", "hiring", "platform strategy"], ["engineering org", "architecture decisions"]),
    ("priya", "Priya Shah", "Director, Product & Engineering (Atlas)", "product", "marcus", "Pittsburgh, PA", "America/New_York", (8, 17), "2021-06-14",
     ["launch strategy", "product tradeoffs", "release management"], ["Atlas launch approvals", "Atlas roadmap", "Atlas rollout policy"]),
    ("kwame", "Kwame Asante", "Engineering Manager, Atlas", "atlas-backend", "priya", "Pittsburgh, PA", "America/New_York", (9, 17), "2022-01-10",
     ["sprint planning", "people management", "delivery"], ["Atlas sprint plan", "Atlas on-call schedule", "Atlas team 1:1s"]),
    ("alex", "Alex Chen", "Senior Backend Engineer", "atlas-backend", "kwame", "Pittsburgh, PA", "America/New_York", (9, 18), "2021-09-07",
     ["Go", "API design", "Postgres", "testing"], ["Atlas API v1", "export endpoint", "API test suite"]),
    ("tomas", "Tomás Herrera", "Backend Engineer", "atlas-backend", "kwame", "Austin, TX", "America/Chicago", (9, 17), "2022-04-18",
     ["Kafka", "event pipelines", "metering ingestion"], ["usage-events consumer", "metering → Atlas integration"]),
    ("wei", "Wei Zhang", "Backend Engineer", "atlas-backend", "kwame", "Pittsburgh, PA", "America/New_York", (10, 19), "2023-02-06",
     ["Go", "Kafka", "data correctness"], ["usage dedupe job", "rollup tables"]),
    ("grace", "Grace Kim", "Backend Engineer (new hire)", "atlas-backend", "kwame", "Pittsburgh, PA", "America/New_York", (9, 17), "2026-11-02",
     ["Python", "Go (learning)", "APIs"], []),
    ("sam", "Sam Rivera", "Senior Frontend Engineer", "atlas-frontend", "kwame", "San Francisco, CA", "America/Los_Angeles", (9, 18), "2022-08-01",
     ["React", "TypeScript", "feature flags", "accessibility"], ["Atlas web app", "rollout controls UI"]),
    ("nadia", "Nadia Rahman", "Frontend Engineer", "atlas-frontend", "kwame", "Pittsburgh, PA", "America/New_York", (9, 17), "2023-05-15",
     ["React", "charts", "data viz"], ["Atlas dashboards", "CSV export UI"]),
    ("leo", "Leo Brooks", "Design Systems Engineer", "atlas-frontend", "kwame", "Remote (Denver, CO)", "America/Denver", (8, 16), "2022-11-07",
     ["design systems", "accessibility", "CSS"], ["Corvid UI kit", "a11y CI checks"]),
    ("devon", "Devon Price", "Staff SRE (Platform lead)", "platform", "marcus", "Pittsburgh, PA", "America/New_York", (9, 17), "2020-07-20",
     ["Kubernetes", "Postgres ops", "incident response"], ["staging + prod clusters", "deploy pipeline", "incident process"]),
    ("hana", "Hana Sato", "SRE", "platform", "devon", "Lisbon, Portugal", "Europe/Lisbon", (9, 17), "2023-09-04",
     ["observability", "Grafana", "alerting"], ["Atlas dashboards in Grafana", "SLO alerts"]),
    ("ravi", "Ravi Iyer", "Infrastructure Engineer", "platform", "devon", "Bangalore, India", "Asia/Kolkata", (10, 19), "2024-01-08",
     ["Terraform", "networking", "CI runners"], ["CI runners", "Terraform modules"]),
    ("jordan", "Jordan Okafor", "Security Engineer", "security", "marcus", "Pittsburgh, PA", "America/New_York", (9, 17), "2021-11-01",
     ["appsec", "threat modeling", "pen testing"], ["ATLAS-38 security review", "security sign-off"]),
    ("ingrid", "Ingrid Larsen", "Identity & Access Engineer", "security", "jordan", "Copenhagen, Denmark", "Europe/Copenhagen", (8, 16), "2024-03-11",
     ["SAML", "OIDC", "Okta", "Azure AD"], ["enterprise SSO", "ATLAS-41 SSO verification"]),
    ("fatima", "Fatima Noor", "QA Lead", "qa", "marcus", "Pittsburgh, PA", "America/New_York", (9, 17), "2021-02-22",
     ["test strategy", "release QA", "Playwright"], ["release checklist", "regression suite"]),
    ("ben", "Ben Carter", "QA Engineer", "qa", "fatima", "Columbus, OH", "America/New_York", (9, 17), "2024-06-03",
     ["Playwright", "load testing", "k6"], ["Atlas load tests"]),
    ("chloe", "Chloe Martin", "Senior Product Designer", "design", "priya", "Brooklyn, NY", "America/New_York", (10, 18), "2022-03-14",
     ["interaction design", "Figma", "prototyping"], ["Atlas UX", "rollout control design"]),
    ("omar", "Omar Haddad", "UX Researcher", "design", "chloe", "Toronto, ON", "America/Toronto", (9, 17), "2023-10-02",
     ["interviews", "usability testing"], ["design partner research"]),
    ("sofia", "Sofia Rossi", "Data Engineer", "data", "marcus", "Pittsburgh, PA", "America/New_York", (9, 17), "2022-09-19",
     ["dbt", "Snowflake", "rollups"], ["warehouse models", "Atlas rollup SQL"]),
    ("kenji", "Kenji Mori", "Analytics Engineer", "data", "sofia", "Seattle, WA", "America/Los_Angeles", (9, 17), "2024-02-12",
     ["SQL", "Looker", "metrics definitions"], ["metric definitions doc"]),
    ("ethan", "Ethan Walsh", "Product Manager, Billing", "billing", "priya", "Pittsburgh, PA", "America/New_York", (9, 17), "2023-01-09",
     ["pricing", "metering", "invoicing"], ["usage-based billing"]),
    ("lucas", "Lucas Moreau", "Backend Engineer, Billing", "billing", "ethan", "Montréal, QC", "America/Toronto", (9, 17), "2023-07-17",
     ["Kafka", "Go", "metering"], ["metering service", "usage-events topic schema"]),
    ("maya", "Maya Patel", "Customer Lead, Design Partner Program", "product", "priya", "Pittsburgh, PA", "America/New_York", (9, 17), "2022-05-02",
     ["customer discovery", "beta programs"], ["design partner program", "partner onboarding"]),
    ("laura", "Laura Bennett", "Customer Success Manager", "customer-success", "aisha", "Chicago, IL", "America/Chicago", (8, 17), "2022-10-24",
     ["account management", "renewals"], ["Northwind account"]),
    ("diego", "Diego Alvarez", "Customer Success Manager", "customer-success", "aisha", "Austin, TX", "America/Chicago", (8, 17), "2023-03-20",
     ["onboarding", "integrations"], ["Lumen account", "Kestrel account"]),
    ("aisha", "Aisha Mohammed", "Head of Support", "customer-success", "elena", "Pittsburgh, PA", "America/New_York", (8, 16), "2020-11-16",
     ["support operations", "escalations"], ["support queue", "customer escalations"]),
    ("mateo", "Mateo Silva", "Support Engineer", "customer-success", "aisha", "Pittsburgh, PA", "America/New_York", (11, 19), "2024-08-12",
     ["debugging", "SQL", "customer tickets"], ["tier-2 tickets"]),
    ("ryan", "Ryan O'Connor", "Enterprise Account Executive", "sales", "elena", "Chicago, IL", "America/Chicago", (8, 17), "2023-04-03",
     ["enterprise sales", "negotiation"], ["Halvorsen Freight deal"]),
    ("megan", "Megan Liu", "Sales Engineer", "sales", "ryan", "Chicago, IL", "America/Chicago", (8, 17), "2024-01-22",
     ["demos", "security questionnaires", "SSO setup"], ["Halvorsen technical eval"]),
    ("rebecca", "Rebecca Stone", "General Counsel", "legal", "elena", "Pittsburgh, PA", "America/New_York", (9, 17), "2021-08-09",
     ["contracts", "privacy law", "DPAs"], ["design partner agreements", "DPAs"]),
    ("victor", "Victor Petrov", "Compliance Manager", "legal", "rebecca", "Pittsburgh, PA", "America/New_York", (9, 17), "2023-11-06",
     ["SOC 2", "access reviews", "vendor risk"], ["SOC 2 evidence", "quarterly access review"]),
    ("jasmine", "Jasmine Taylor", "Product Marketing Manager", "marketing", "elena", "New York, NY", "America/New_York", (9, 18), "2023-06-05",
     ["launch messaging", "positioning"], ["Atlas launch comms"]),
    ("noah", "Noah Fischer", "Content Marketer", "marketing", "jasmine", "Remote (Portland, OR)", "America/Los_Angeles", (9, 17), "2024-09-09",
     ["blog", "release notes"], ["changelog", "blog"]),
    ("olivia", "Olivia Grant", "People Ops Partner", "people", "elena", "Pittsburgh, PA", "America/New_York", (9, 17), "2021-04-12",
     ["benefits", "leave", "onboarding"], ["leave tracking", "new hire onboarding"]),
    ("sanjay", "Sanjay Mehta", "Finance Lead", "finance", "elena", "Pittsburgh, PA", "America/New_York", (9, 17), "2022-02-07",
     ["forecasting", "revenue recognition"], ["ARR forecast"]),
    ("isabel", "Isabel Cruz", "Technical Writer", "docs", "priya", "Remote (Raleigh, NC)", "America/New_York", (9, 17), "2024-04-15",
     ["API docs", "guides"], ["Atlas API docs", "beta guide"]),
]

ACCENTS = ["#8B5CF6", "#3B82F6", "#F59E0B", "#EF4444", "#10B981", "#EC4899", "#14B8A6", "#6366F1", "#F97316", "#84CC16"]

PEOPLE = []
for i, (pid, name, title, team, mgr, loc, tz, hours, start, skills, owns) in enumerate(P):
    PEOPLE.append({
        "id": pid, "name": name, "title": title, "team": team, "teamName": TEAMS[team], "managerId": mgr,
        "email": f"{name.split()[0].lower().replace('á','a').replace('é','e')}@{DOMAIN}",
        "slackHandle": "@" + name.split()[0].lower().replace("á", "a"),
        "location": loc, "timezone": tz, "workingHours": {"start": f"{hours[0]:02d}:00", "end": f"{hours[1]:02d}:00", "days": "Mon-Fri"},
        "startDate": start, "skills": skills, "owns": owns, "accent": ACCENTS[i % len(ACCENTS)],
    })
BY_ID = {p["id"]: p for p in PEOPLE}

# Leave and other long absences (visible to everyone as "OOO", details restricted to People Ops + manager)
LEAVE = [
    {"personId": "tomas", "type": "parental-leave", "start": "2026-10-19", "end": "2027-01-11", "publicLabel": "Out of office until Jan 11",
     "backupId": "wei", "visibleDetailTo": ["olivia", "kwame", "tomas"]},
    {"personId": "hana", "type": "pto", "start": "2026-11-05", "end": "2026-11-13", "publicLabel": "PTO, back Nov 16",
     "backupId": "devon", "visibleDetailTo": ["*"]},
    {"personId": "wei", "type": "sick", "start": "2026-11-06", "end": "2026-11-06", "publicLabel": "Out sick today",
     "backupId": "alex", "visibleDetailTo": ["olivia", "kwame", "wei"]},
    {"personId": "noah", "type": "pto", "start": "2026-11-02", "end": "2026-11-06", "publicLabel": "PTO this week",
     "backupId": "jasmine", "visibleDetailTo": ["*"]},
]

# External people that appear in email and Slack Connect
EXTERNAL = [
    {"id": "ext-hollis", "name": "Dana Hollis", "title": "VP Operations", "company": "Northwind Logistics", "email": "dana.hollis@northwind-logistics.com"},
    {"id": "ext-park", "name": "Jae Park", "title": "IT Admin", "company": "Northwind Logistics", "email": "jpark@northwind-logistics.com"},
    {"id": "ext-osei", "name": "Kofi Osei", "title": "Head of Platform", "company": "Lumen Health", "email": "kofi.osei@lumenhealth.com"},
    {"id": "ext-brandt", "name": "Miriam Brandt", "title": "Senior Counsel", "company": "Lumen Health", "email": "mbrandt@lumenhealth.com"},
    {"id": "ext-lumenbot", "name": "lumen-integration-bot", "title": "Integration bot (Slack Connect)", "company": "Lumen Health", "email": None},
    {"id": "ext-reyes", "name": "Carla Reyes", "title": "Director of Ops Analytics", "company": "Kestrel Freightworks", "email": "creyes@kestrelfw.com"},
    {"id": "ext-novak", "name": "Petr Novak", "title": "Identity Engineer", "company": "Kestrel Freightworks", "email": "pnovak@kestrelfw.com"},
    {"id": "ext-lindqvist", "name": "Erik Lindqvist", "title": "Procurement Manager", "company": "Halvorsen Freight", "email": "erik.lindqvist@halvorsenfreight.com"},
    {"id": "ext-adeyemi", "name": "Tolu Adeyemi", "title": "CISO", "company": "Halvorsen Freight", "email": "tadeyemi@halvorsenfreight.com"},
]
EXT = {e["id"]: e for e in EXTERNAL}

ALL = [p["id"] for p in PEOPLE]
ENG = [p["id"] for p in PEOPLE if p["team"] in {"atlas-backend", "atlas-frontend", "platform", "security", "qa", "data", "billing"}] + ["priya", "marcus", "chloe", "omar", "isabel", "maya"]
ATLAS_CORE = ["priya", "kwame", "alex", "tomas", "wei", "grace", "sam", "nadia", "leo", "jordan", "ingrid", "fatima", "ben", "chloe", "devon", "maya", "isabel"]


def email_of(pid: str) -> str:
    return BY_ID[pid]["email"] if pid in BY_ID else EXT[pid]["email"]


def name_of(pid: str) -> str:
    return BY_ID[pid]["name"] if pid in BY_ID else EXT[pid]["name"]
