#!/usr/bin/env python3
"""The demo company: one product manager at Quillmark, a made-up logistics software company, with ten weeks of
made-up AI work in Claude Code, Cowork and Codex. Every name and number here is invented. Nothing on this Mac is
read: the script writes the same files the real scripts write (into demo/data/), then runs the same scripts on them
to build app/demo-data.js. Dates move with today, so "this week" always has work in it.
Usage: python3 tools/demo_company.py"""
import datetime, json, os, random, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prices import claude_cost, openai_cost, CHECKED, SOURCES
from paths import ROOT

COMPANY = "Quillmark"  # made up; one place to change it
D = os.path.join(ROOT, "demo", "data")
os.makedirs(D, exist_ok=True)
rnd = random.Random(20261014)
TODAY = datetime.date.today()
WEEK = TODAY - datetime.timedelta(days=TODAY.weekday())
FIRST = WEEK - datetime.timedelta(weeks=9)
TZ = datetime.datetime.now().astimezone().tzinfo
def utc_hour(day, hour):  # a local day and hour, as the UTC hour the logs keep
    return datetime.datetime.combine(day, datetime.time(hour), TZ).astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H")
def hexid(n=32): return "".join(rnd.choice("0123456789abcdef") for _ in range(n))
def uuid(): h = hexid(); return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:]}"
def write(name, obj): json.dump(obj, open(os.path.join(D, name), "w"), indent=1)

# ---------- who is on the team: helpers, skills, connectors ----------
HELPERS = {  # name: (where, what it does, model it runs on)
    "spec-writer": ("yours (every project)", "Turns a rough feature idea into a one-page spec with goals, scope and open questions.", "claude-opus-5-5"),
    "ux-reviewer": ("yours (every project)", "Reviews a screen or flow against the team's design checklist and lists problems.", "claude-opus-5-5"),
    "research-synth": ("yours (every project)", "Pulls themes and quotes out of interview notes and survey answers.", "claude-sonnet-5-5"),
    "qa-checker": ("yours (every project)", "Walks a build step by step and writes up what breaks.", "claude-sonnet-5-5"),
    "metrics-analyst": ("yours (every project)", "Answers a numbers question from the data warehouse and shows its query.", "claude-opus-5-5"),
    "release-notes": ("yours (every project)", "Writes customer-facing release notes from merged changes.", "claude-sonnet-5-5"),
    "interview-coder": ("one project only: Product/customer-interviews", "Tags interview transcripts with the team's codebook.", "claude-sonnet-5-5"),
    "general-purpose": ("built into Claude Code", "Claude Code's general subagent for side tasks and research.", "claude-opus-5-5"),
    "Explore": ("built into Claude Code", "Claude Code's read-only subagent for searching many files.", "claude-haiku-5-5"),
    "Plan": ("built into Claude Code", "Claude Code's subagent for planning a change before making it.", "claude-opus-5-5"),
    "claude-code-guide": ("built into Claude Code", "Answers questions about how Claude Code works.", "claude-haiku-5-5"),
    "statusline-setup": ("built into Claude Code", "Sets up the status line at the bottom of Claude Code.", "claude-haiku-5-5"),
}
SKILLS = {  # name: (where, plugin, what)
    "prd-template": ("yours (every project)", None, "The team's product requirements template, filled from a conversation."),
    "status-update": ("yours (every project)", None, "Writes the Friday status note in the team's format."),
    "pricing-model": ("yours (every project)", None, "Builds a pricing scenario sheet from the rate cards."),
    "interview-notes": ("yours (every project)", None, "Cleans up raw interview notes into the shared format."),
    "okr-check": ("yours (every project)", None, "Checks a plan against this quarter's goals."),
    "carrier-glossary": ("one project only: Product/carrier-onboarding", None, "Carrier and freight terms, so drafts use the right words."),
    "docx": ("your Claude account (synced)", None, "Makes and edits Word documents."),
    "pptx": ("your Claude account (synced)", None, "Makes and edits slide decks."),
    "xlsx": ("your Claude account (synced)", None, "Makes and edits spreadsheets."),
    "pdf": ("your Claude account (synced)", None, "Reads and makes PDF files."),
    "dataviz": ("your Claude account (synced)", None, "Guidance for charts and dashboards."),
    "brand-voice": ("your Claude account (synced)", None, "Writes in the company's brand voice."),
    "canvas-design": ("your Claude account (synced)", None, "Makes posters and visual pieces."),
    "skill-creator": ("your Claude account (synced)", None, "Helps write new skills."),
    "meeting-notes": ("your Claude account (synced)", None, "Turns a meeting transcript into notes and actions."),
    "competitive-brief": ("your Claude account (synced)", None, "A one-page brief on a competitor."),
    "legal-review": ("your Claude account (synced)", None, "Flags risky clauses in a contract draft."),
    "hiring-rubric": ("your Claude account (synced)", None, "Scores interview notes against a rubric."),
    "sql-helper": ("your Claude account (synced)", None, "Writes and explains SQL queries."),
    "roadmap-builder": ("your Claude account (synced)", None, "Lays out a roadmap from a list of bets."),
    "update-config": ("built into Claude Code (list as of Oct 10 2026)", None, "Changes Claude Code's own settings."),
    "simplify": ("built into Claude Code (list as of Oct 10 2026)", None, "Reviews changed code for simpler ways to do it."),
    "code-review": ("built into Claude Code (list as of Oct 10 2026)", None, "Reviews a change for bugs."),
    "security-review": ("built into Claude Code (list as of Oct 10 2026)", None, "Reviews a change for security problems."),
    "init": ("built into Claude Code (list as of Oct 10 2026)", None, "Writes a first instruction file for a project."),
    "loop": ("built into Claude Code (list as of Oct 10 2026)", None, "Runs a task again on a schedule."),
    "schedule": ("built into Claude Code (list as of Oct 10 2026)", None, "Sets up a task that runs on its own later."),
    "claude-api": ("built into Claude Code (list as of Oct 10 2026)", None, "Reference for building with the Claude API."),
    "run": ("built into Claude Code (list as of Oct 10 2026)", None, "Starts the app you're building to check a change."),
}
UID = {}
def port_id(name): return UID.setdefault(name, uuid())
CONNECTORS = {  # name: (id kind, tool names it used)
    "Google Drive": ("account", ["search_files", "read_file_content", "create_file", "update_file", "trash_file"]),
    "Gmail": ("account", ["search_threads", "get_message", "create_draft", "send_message"]),
    "Slack": ("account", ["read_channel", "search_messages", "post_message"]),
    "Jira": ("account", ["search_issues", "get_issue", "create_issue", "update_issue"]),
    "Figma": ("account", ["get_design_context", "get_screenshot", "get_metadata"]),
    "Snowflake": ("account", ["query", "list_tables", "describe_table"]),
    "GitHub": ("account", ["list_pull_requests", "get_file", "add_comment"]),
    "claude-in-chrome": ("mac", ["navigate", "read_page", "get_page_text", "computer", "form_input"]),
    "ccd_session": ("app", ["list_sessions", "set_session_title"]),
}
def cid(name):
    k = CONNECTORS[name][0]
    return port_id(name) if k == "account" else name

# ---------- the work: ten made-up pieces of work, with when they ran and what they leaned on ----------
# weight: share of a busy week; weeks: which weeks back (0 = this week) it ran; apps; helpers; skills; connectors; folder
WORK = [
    ("Route planner redesign", 1.0, range(0, 7), {"Claude Code": .7, "Cowork": .3}, ["spec-writer", "ux-reviewer", "Explore", "Plan", "general-purpose"], ["prd-template", "okr-check", "dataviz"], ["Figma", "Jira", "Slack"], "~/Projects/route-planner"),
    ("Q4 pricing review", .7, range(0, 4), {"Cowork": .6, "Codex": .4}, ["metrics-analyst", "general-purpose"], ["pricing-model", "xlsx", "sql-helper"], ["Snowflake", "Google Drive", "Gmail"], "~/Projects/pricing-review"),
    ("Carrier onboarding flow", .55, range(1, 6), {"Claude Code": 1.0}, ["qa-checker", "Explore", "spec-writer"], ["prd-template", "carrier-glossary", "code-review"], ["Jira", "GitHub"], "~/Projects/carrier-onboarding"),
    ("Customer interview synthesis", .45, range(0, 9), {"Cowork": .5, "Claude Code": .5}, ["research-synth"], ["interview-notes", "meeting-notes"], ["Google Drive", "Gmail"], "~/Projects/customer-interviews"),
    ("Weekly status reports", .12, range(0, 10), {"Cowork": 1.0}, [], ["status-update"], ["Slack", "Gmail", "Jira"], "~/Projects/status"),
    ("Board deck, Q3 results", .6, range(4, 7), {"Cowork": 1.0}, ["metrics-analyst"], ["pptx", "dataviz", "brand-voice"], ["Google Drive", "Snowflake"], "~/Projects/board-deck"),
    ("Warehouse cleanup", .5, range(0, 3), {"Codex": .8, "Claude Code": .2}, ["Explore"], ["sql-helper"], ["Snowflake"], "~/Projects/warehouse-cleanup"),
    ("Support triage bot", .35, range(1, 4), {"Claude Code": 1.0}, ["Plan", "qa-checker", "general-purpose"], ["claude-api", "run", "simplify"], ["GitHub", "claude-in-chrome"], "~/Projects/triage-bot"),
    ("Learning and setup", .1, range(0, 10), {"Claude Code": .7, "Codex": .3}, ["claude-code-guide"], ["update-config", "skill-creator"], ["ccd_session"], "~/Projects"),
    ("Not sure yet", .08, range(0, 10), {"Cowork": .5, "Claude Code": .5}, [], [], ["claude-in-chrome"], "~"),
]
TITLES = {
    "Route planner redesign": ["Route planner: map screen spec", "Route planner: stop reordering flow", "Route planner: driver feedback pass", "Route planner: review the new filters", "Route planner: edge cases for late stops"],
    "Q4 pricing review": ["Q4 pricing: rate card scenarios", "Q4 pricing: margin by lane", "Q4 pricing: summary for finance"],
    "Carrier onboarding flow": ["Carrier onboarding: document upload step", "Carrier onboarding: test the signup", "Carrier onboarding: error messages"],
    "Customer interview synthesis": ["Interviews: dispatcher themes", "Interviews: tag this week's calls", "Interviews: quotes for the deck"],
    "Weekly status reports": ["Friday status note"],
    "Board deck, Q3 results": ["Board deck: Q3 numbers", "Board deck: story and charts"],
    "Warehouse cleanup": ["Warehouse: duplicate shipments table", "Warehouse: fix the lane codes"],
    "Support triage bot": ["Triage bot: first prototype", "Triage bot: test on old tickets"],
    "Learning and setup": ["How do subagents work", "Set up the Jira connector", "Try Codex on a small task"],
    "Not sure yet": [None, "Quick question", None],
}

rows, sessions, agents, calls, conn_uses = [], [], {}, {}, {}
CONN_TOOLS = {n: {} for n in CONNECTORS}
skill_last, helper_last, helper_calls, skill_calls = {}, {}, {}, {}

def tokens(scale, model):
    """A plausible hour of work: mostly re-reading the conversation, a little writing."""
    reread = int(rnd.uniform(5_000_000, 16_000_000) * scale)
    return {"fresh_in": int(rnd.uniform(20, 400)), "cache_write": int(reread * rnd.uniform(.04, .09)), "cache_read": reread, "out": int(reread * rnd.uniform(.008, .016))}

def price(model, t):
    if model.startswith("gpt"):
        return openai_cost(model, {"input_tokens": t["fresh_in"] + t["cache_read"] + t["cache_write"], "cached_input_tokens": t["cache_read"], "cache_write_input_tokens": t["cache_write"], "output_tokens": t["out"]})[0]
    return claude_cost(model, {"input_tokens": t["fresh_in"], "cache_creation_input_tokens": t["cache_write"], "cache_read_input_tokens": t["cache_read"], "output_tokens": t["out"]})[0]

def add_row(tool, sid, agent, model, hour, t, replies):
    usd = round(price(model, t), 4)
    est = round(usd * .06, 3) if agent != "main" else 0.0
    rows.append({"tool": tool, "session": sid, "agent": agent, "model": model, "hour": hour, "replies": replies, "partial": 1 if agent != "main" else 0, **t, "usd": round(usd + est, 4), "priced": True, "usd_est": est})
    return usd + est

for w, weight, weeks, apps, helpers, skills, ports, folder in WORK:
    for back in weeks:
        wk0 = WEEK - datetime.timedelta(weeks=back)
        last_day = (TODAY - wk0).days if back == 0 else 6
        workdays = [d for d in range(0, last_day + 1) if d < 5 or rnd.random() < .15]
        if not workdays: workdays = [0]
        n_sess = max(1, round(weight * rnd.uniform(2.2, 4.2) * (1.15 if back < 2 else 1) * (min(5, last_day + 1) / 5 if back == 0 else 1)))
        if w == "Weekly status reports": n_sess, workdays = 1, [min(4, last_day)]
        for _ in range(n_sess):
            app = rnd.choices(list(apps), weights=list(apps.values()))[0]
            day = wk0 + datetime.timedelta(days=rnd.choice(workdays))
            if day > TODAY: day = TODAY
            sid = ("local_" + uuid()) if app == "Cowork" else uuid()
            model = "gpt-6.1-sol" if app == "Codex" else "claude-opus-5-5"
            start_h = rnd.choice([9, 10, 11, 13, 14, 15, 16])
            hours = max(1, round((.6 + weight) * rnd.uniform(1.4, 3.6)))
            usd, n_help = 0.0, 0
            sk_here, ag_here = {}, {}
            for k in range(hours):
                h = utc_hour(day, min(22, start_h + k))
                usd += add_row(app, sid, "main", model, h, tokens(min(1.0, .45 + weight * .6) * rnd.uniform(.6, 1.1), model), rnd.randint(18, 64))
                # helpers: Claude Code calls your own and its built-in ones; Cowork has its own general helper; Codex's aren't read yet
                if app != "Codex" and helpers and rnd.random() < .55:
                    ht = rnd.choice(helpers) if app == "Claude Code" else "general-purpose"
                    if back <= 1 or rnd.random() < .8:
                        aid = hexid(17)
                        agents[aid] = {"tool": app, "session": sid, "type": ht, "task": f"{ht} for {w}"}
                        hm = HELPERS[ht][2]
                        usd += add_row(app, sid, aid, hm, h, tokens(rnd.uniform(.15, .45), hm), rnd.randint(8, 30))
                        n_help += 1; ag_here[ht] = ag_here.get(ht, 0) + 1
                        helper_last[ht] = max(helper_last.get(ht, ""), day.isoformat()); helper_calls[ht] = helper_calls.get(ht, 0) + 1
                if skills and rnd.random() < .5 and app == "Claude Code":
                    s = rnd.choice(skills); sk_here[s] = sk_here.get(s, 0) + 1
                    skill_last[s] = max(skill_last.get(s, ""), day.isoformat()); skill_calls[s] = skill_calls.get(s, 0) + 1
                if ports and app != "Codex" and rnd.random() < .7:
                    p = rnd.choice(ports); n = rnd.randint(2, 18)
                    conn_uses.setdefault(sid, {}).setdefault(day.isoformat(), {})
                    conn_uses[sid][day.isoformat()][cid(p)] = conn_uses[sid][day.isoformat()].get(cid(p), 0) + n
                    for _ in range(n):
                        tn = rnd.choice(CONNECTORS[p][1][:2] if rnd.random() < .7 else CONNECTORS[p][1])
                        CONN_TOOLS[p][tn] = CONN_TOOLS[p].get(tn, 0) + 1
            if ag_here or sk_here: calls[sid] = {"agents": ag_here, "skills": sk_here}
            end = datetime.datetime.combine(day, datetime.time(min(23, start_h + hours), rnd.randint(0, 59)))
            sessions.append({"tool": app, "id": sid, "start": datetime.datetime.combine(day, datetime.time(start_h, rnd.randint(0, 59))).isoformat(),
                             "end": end.isoformat(), "folder": folder, "model": model, "list_price_usd": round(usd, 2), "helpers": n_help,
                             "tool_recorded_usd": None, "usd_est": round(sum(r["usd_est"] for r in rows if r["session"] == sid), 2),
                             "work": w, "grouped_by": "title or folder" if w != "Not sure yet" else "none", "title": rnd.choice(TITLES[w])})
# one helper ran long ago and not since (a decision for the front door); release-notes never ran
old = FIRST + datetime.timedelta(days=3)
for k in range(2):
    sid = uuid(); aid = hexid(17); h = utc_hour(old, 10 + k)
    agents[aid] = {"tool": "Claude Code", "session": sid, "type": "interview-coder", "task": "Tag transcripts"}
    u = add_row("Claude Code", sid, "main", "claude-opus-5-5", h, tokens(.4, "claude-opus-5-5"), 9) + add_row("Claude Code", sid, aid, "claude-sonnet-5-5", h, tokens(.3, "claude-sonnet-5-5"), 6)
    sessions.append({"tool": "Claude Code", "id": sid, "start": f"{old.isoformat()}T{10 + k}:05:00", "end": f"{old.isoformat()}T{11 + k}:10:00", "folder": "~/Projects/customer-interviews",
                     "model": "claude-opus-5-5", "list_price_usd": round(u, 2), "helpers": 1, "tool_recorded_usd": None, "usd_est": 0.1, "work": "Customer interview synthesis", "grouped_by": "title or folder", "title": "Interviews: try the codebook subagent"})
    helper_last["interview-coder"] = old.isoformat(); helper_calls["interview-coder"] = helper_calls.get("interview-coder", 0) + 1
# a correction: one untitled Cowork chat moved to the pricing review by hand
moved = next(s for s in sessions if s["work"] == "Not sure yet" and s["tool"] == "Cowork")
moved["work"], moved["grouped_by"] = "Q4 pricing review", "your correction"
write("work-overrides.json", {moved["id"]: {"work": "Q4 pricing review", "by": "your correction", "when": f"{(WEEK - datetime.timedelta(days=4)).isoformat()}T16:20", "was": "Not sure yet"}})
sessions.sort(key=lambda s: s["start"])

# ---------- the ledger, with the same checks the real one keeps ----------
by_tool = {}
for r in rows: by_tool[r["tool"]] = by_tool.get(r["tool"], 0) + r["usd"]
write("ledger.json", {"built": datetime.datetime.now().isoformat(timespec="minutes"), "prices_checked": CHECKED, "price_sources": SOURCES,
                      "per_partial_reply": {"claude-opus-5-5": 1300, "claude-sonnet-5-5": 900, "claude-haiku-5-5": 400}, "default_per_partial": 900,
                      "checks": {"Claude Code": {"sessions": 12, "theirs": round(by_tool.get("Claude Code", 0) * .3 * 1.07, 2), "ours": round(by_tool.get("Claude Code", 0) * .3, 2), "recorded_sessions": 18},
                                 "Cowork": {"sessions": 20, "theirs": round(by_tool.get("Cowork", 0) * .5 * .92, 2), "ours": round(by_tool.get("Cowork", 0) * .5, 2), "recorded_sessions": 26}},
                      "rows": rows, "agents": agents, "sessions": len(sessions), "unpriced_models": {}})
write("sessions-grouped.json", sessions)
write("calls-by-session.json", calls)
# every action each connector offers (Claude Code lists them at the start of a chat), a superset of the ones used
OFFERED_EXTRA = {"Gmail": ["delete_draft", "trash_message", "forward"], "Slack": ["delete_message", "add_reaction"], "Jira": ["delete_issue", "add_comment", "transition_issue"],
                 "Figma": ["create_file", "add_comment"], "Snowflake": ["execute_statement"], "Google Drive": ["share_file", "copy_file"], "GitHub": ["merge_pull_request", "delete_branch", "create_issue"],
                 "claude-in-chrome": ["javascript_tool", "file_upload", "tabs_close"], "ccd_session": ["archive_session", "delete_session"]}
write("connector-uses.json", {"by_session": conn_uses, "tools": {cid(n): t for n, t in CONN_TOOLS.items()},
                              "offered": {cid(n): sorted(set(CONNECTORS[n][1]) | set(OFFERED_EXTRA.get(n, []))) for n in CONNECTORS}})

# ---------- what's installed: helpers, skills, instruction files, connectors ----------
inv_agents = [{"name": n, "where": wh, "plugin": None, "path": (f"~/.claude/agents/{n}.md" if wh.startswith("yours") else f"~/Projects/customer-interviews/.claude/agents/{n}.md" if wh.startswith("one project") else None),
               "what": what, "calls": helper_calls.get(n, 0), "last_used": helper_last.get(n),
               # a helper that runs on a smaller model names it in its file, as a real one would
               "model": ("sonnet" if "sonnet" in m else "haiku" if "haiku" in m else None) if wh.startswith(("yours", "one project")) else None} for n, (wh, what, m) in HELPERS.items()]
inv_skills = [{"name": n, "full": n, "where": wh, "plugin": pl, "path": None, "what": what, "calls": skill_calls.get(n, 0), "last_used": skill_last.get(n), "desc_len": len(n) + 3 * len(what)} for n, (wh, pl, what) in SKILLS.items()]
actions = {}
for sid, days in conn_uses.items():
    for d, c in days.items():
        for k, n in c.items(): actions[k] = actions.get(k, 0) + n
NAMES = {"claude-in-chrome": "claude-in-chrome", "ccd_session": "Claude app's own tools"}
inv_conn = [{"server": (NAMES.get(n) or n) + (" (name inferred from its tools)" if CONNECTORS[n][0] == "account" else ""), "id": cid(n), "actions": actions.get(cid(n), 0), "tools_seen": sorted(CONN_TOOLS[n])} for n in CONNECTORS]
inst = [("~/.claude/CLAUDE.md", 640, 12), ("~/Projects/route-planner/CLAUDE.md", 420, 3), ("~/Projects/pricing-review/CLAUDE.md", 260, 9), ("~/Projects/carrier-onboarding/CLAUDE.md", 380, 15),
        ("~/Projects/customer-interviews/CLAUDE.md", 310, 22), ("~/Projects/triage-bot/CLAUDE.md", 520, 11), ("~/Projects/warehouse-cleanup/AGENTS.md", 190, 6)]
write("inventory.json", {"skills": inv_skills, "agents": inv_agents, "skills_used_not_on_disk": {},
                         "instruction_files": [{"path": p, "words": wd, "modified": (TODAY - datetime.timedelta(days=dd)).isoformat()} for p, wd, dd in inst],
                         "connectors": inv_conn, "hooks": ["SessionStart"], "rules": {"allow": [], "ask": [], "deny": []}})
write("claude_desktop_config.json", {"mcpServers": {"Linear": {}}})  # set up in the Claude app, never used

# ---------- limits: the Claude app's readings, and the times a limit stopped this person ----------
samples, limit_raw, limit_hits = [], [], []
HIT_DAYS = {(0, 0), (1, 2), (1, 3), (4, 2)}  # weeks back, weekday: the days hit() below records a stop
for back in range(0, 6):
    wk0 = WEEK - datetime.timedelta(weeks=back)
    for d in range(7):
        day = wk0 + datetime.timedelta(days=d)
        if day > TODAY: break
        for hh in (10, 15, 19):
            t = datetime.datetime.combine(day, datetime.time(hh), TZ)
            if t > datetime.datetime.now(TZ): break
            # the 5-hour reading reaches 100% only after a time a limit stopped this person (see hit() below)
            fh = {15: 92, 19: 100}.get(hh, int(rnd.uniform(30, 70))) if (back, d) in HIT_DAYS else int(rnd.uniform(10, 74))
            samples.append({"t": int(t.timestamp() * 1000), "u": {"fh": fh, "sd": min(95, 8 * d + 12 + (6 if back == 0 else 0))}})
write("plan-usage-history.json", {"samples": samples})
def hit(back, d, hh, kind="five_hour", tool="Claude Code", status="hit", util=100):
    day = WEEK - datetime.timedelta(weeks=back) + datetime.timedelta(days=d)
    if datetime.datetime.combine(day, datetime.time(hh, 20), TZ) > datetime.datetime.now(TZ): return
    ts = datetime.datetime.combine(day, datetime.time(hh, 20), TZ).astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M")
    reset = int(datetime.datetime.combine(day, datetime.time(hh, 20), TZ).timestamp()) + 3 * 3600
    plan = "ChatGPT" if tool == "Codex" else "Claude"
    limit_raw.append([[plan, status, reset, kind], {"tool": tool, "plan": plan, "status": status, "kind": kind, "ts": ts, "session": None, "util": util}])
    if tool == "Claude Code" and status == "hit": limit_hits.append({"date": ts[:10], "ts": ts, "kind": kind, "session": None, "resets": reset})
hit(0, 0, 16); hit(1, 2, 16); hit(1, 3, 15); hit(1, 3, 11, tool="Cowork", status="warning", util=91); hit(2, 1, 14, tool="Codex", status="warning", util=82); hit(4, 2, 15)
wk_hour = utc_hour(WEEK, 0)
week_agents = {r["agent"] for r in rows if r["agent"] != "main" and r["hour"] >= wk_hour}
agent_week, skill_week = {}, {}
for aid in week_agents: agent_week[agents[aid]["type"]] = agent_week.get(agents[aid]["type"], 0) + 1
week_sids = {x["id"] for x in sessions if x["start"] >= WEEK.isoformat()}
for sid, c in calls.items():
    if sid in week_sids:
        for k, n in c["skills"].items(): skill_week[k] = skill_week.get(k, 0) + n
write("dashboard.json", {"limit_raw": limit_raw, "limit_hits": limit_hits, "agent_week": agent_week, "skill_week": skill_week})

# ---------- the person's own setup, plans and the costs outside them ----------
write("anatomy.json", {
    "Claude Code": {"folder": {"where": "a hidden folder in your home folder (.claude)", "session_logs": sum(1 for s in sessions if s["tool"] == "Claude Code"), "helper_logs": sum(1 for a in agents.values() if a["tool"] == "Claude Code"),
                               "project_folders": 9, "mb": 840, "first": FIRST.isoformat(), "last": TODAY.isoformat(),
                               "parts": [["Session logs", f"{sum(1 for s in sessions if s['tool'] == 'Claude Code')} chats"], ["Your main rule file", "one file, read in every chat"], ["Subagents you made", "6 files"],
                                         ["Skills you made", "5 folders"], ["Add-ons (plugins)", "installed by your company's admin"], ["Automatic checks", "1 script"], ["Its notes (memory)", "41 notes in 6 project folders"]]},
                    "settings": {"items": [["Reply style", "default"], ["Rules for what it may do without asking", "your company's managed rules, plus 3 of yours"], ["Model", "Opus 5.5"], ["Extra add-on catalogs", "1, from your company"]]},
                    "checks": {"items": [{"when": "when a chat starts", "name": "load-team-context.sh", "says": "Loading team context"}]},
                    "memory": {"notes": 41, "folders": 6, "styles": ["default"]}},
    "Cowork": {"folder": {"where": "inside the Claude app's own folder (Application Support)", "session_logs": sum(1 for s in sessions if s["tool"] == "Cowork"), "mb": 310, "first": FIRST.isoformat(), "last": TODAY.isoformat(),
                          "parts": [["Task folders", f"{sum(1 for s in sessions if s['tool'] == 'Cowork')} kept on this Mac"], ["Task logs", "one per task"], ["Usage record", "your 5-hour and weekly limit readings"]]},
               "settings": {"items": [["Connectors set up in the Claude app", "8"], ["App extensions", "1"]]}, "checks": {"items": []}},
    "Codex": {"folder": {"where": "a hidden folder in your home folder (.codex)", "session_logs": sum(1 for s in sessions if s["tool"] == "Codex"), "mb": 120, "first": FIRST.isoformat(), "last": TODAY.isoformat(),
                         "parts": [["Session logs", f"{sum(1 for s in sessions if s['tool'] == 'Codex')} chats"], ["Settings file", "one, read at start"], ["Its own memory", "a small database"]]},
              "settings": {"items": [["Model", "gpt-6.1-sol"], ["Thinking effort", "medium"], ["Approval rule", "ask before changes"], ["Sandbox", "this project's folder only"]]},
              "checks": {"items": []}, "instructions": {"files": 1}, "skills": [], "plugins": ["browser", "documents", "spreadsheets", "code-review"], "connectors": ["node_repl"]},
    "read": datetime.datetime.now().isoformat(timespec="minutes")})
write("other-costs.json", {"read": datetime.datetime.now().isoformat(timespec="minutes"), "shell_keys": [], "services": [
    {"service": "Claude API", "project": "triage-bot", "signs": ["its key is named in a settings file (ANTHROPIC_API_KEY)", "uses its code library (@anthropic-ai/sdk)"], "where_to_look": "the Claude Console, the site for Claude API bills, under Usage for the month"},
    {"service": "OpenAI API", "project": "warehouse-cleanup", "signs": ["its key is named in a settings file (OPENAI_API_KEY)"], "where_to_look": "OpenAI platform, under Usage, then pick the month"},
    {"service": "Google Maps Platform", "project": "route-planner", "signs": ["named in an example settings file (GOOGLE_MAPS_API_KEY)"], "where_to_look": "Google Cloud Billing: Reports"}]})
write("plans.json", {"note": "Made-up plans for the demo company.", "plans": [
    {"name": "Claude Max", "covers": ["Claude Code", "Cowork", "Claude app"], "monthly_usd": 100, "since": None},
    {"name": "ChatGPT Plus (for Codex)", "covers": ["Codex"], "monthly_usd": 20, "since": None}]})
write("bills-manual.json", {"entries": [{"service": "Claude API", "month": TODAY.strftime("%Y-%m"), "usd": 18.4, "entered": f"{WEEK.isoformat()}T09:12"}]})
write("plugin-state.json", {})
write("advisor-notes.json", {"written_by": "Claude, for the demo company", "notes": [
    {"id": "note-helper-models", "title": "Most of your subagents run on the top model",
     "because": [{"text": "{helper_top_share}% of the {helper_replies} steps your subagents took {period} ran on Opus, the most capable and most expensive model", "kind": "measured", "go": "screen:armory"},
                 {"text": "three of your six subagent files name no model, so they inherit the main chat's", "kind": "measured", "go": "screen:armory"}],
     "cant": "Whether a cheaper model would do the same work as well. Only running the same task on both can show that.",
     "could": "Pick one routine subagent, such as the spec writer, and try it on a smaller model for the same task before keeping the change.",
     "preview": {"text": "Effect not measured yet.", "kind": "unknown"}, "target": "screen:armory"},
    {"id": "note-long-sessions", "title": "Long chats cost the most, not the answers",
     "because": [{"text": "{carry_usd_share}% of the pay-per-use price {period} went to carrying the conversation (re-reading it {reread_usd_share}%, storing it to re-read {store_usd_share}%); writing answers was {answers_usd_share}%", "kind": "estimate", "go": "screen:mission"}],
     "cant": "Which parts of a long chat were actually needed.", "could": "Start a fresh chat when you switch tasks; a short summary carries over what matters.",
     "preview": {"text": "Effect not measured yet.", "kind": "unknown"}, "target": "screen:mission"},
    {"id": "note-unused-skills", "title": "{skills_unused} of your {skills_total} skills have never been used",
     "because": [{"text": "{skills_unused_account} of them came from your Claude account", "kind": "measured", "go": "screen:armory"}],
     "cant": "Whether a skill was followed by reading its file directly.", "could": "Ask your admin which account add-ons your team needs; unused ones still sit in the list every chat reads.",
     "preview": {"text": "Effect not measured yet.", "kind": "unknown"}, "target": "screen:armory"}], "flags": []})

# ---------- what shapes Claude: made-up rule files, what loaded, repeats and memory (the screen's data, written directly) ----------
def ago(n, h=10): return (datetime.datetime.combine(TODAY - datetime.timedelta(days=n), datetime.time(h, 12))).isoformat(timespec="minutes")
MF = lambda proj: "-Users-pm-Projects" + ("-" + proj if proj else "")
def load(proj, n, mem=None):
    return {"when": ago(n), "project": proj, "ended_in": proj, "moved": False, "memory_from": mem or proj, "memory_project": mem or proj,
            "files": [{"path": "~/.claude/CLAUDE.md", "type": "User", "words": 640}, {"path": f"~/Projects/{proj}/CLAUDE.md", "type": "Project", "words": {"route-planner": 420, "triage-bot": 520, "customer-interviews": 310, "pricing-review": 260}[proj]},
                      {"path": f"~/.claude/projects/{MF(proj)}/memory/MEMORY.md", "type": "AutoMem", "words": 160}],
            "listing": {"skills": {"n": 29, "chars": 15600}, "helpers": {"n": 12, "chars": 4200}, "connectors": {"n": 8, "chars": 16800}, "style": "Explanatory", "style_words": 310}}
mem_folders = [("route-planner", 18, 11, 0, 1), ("triage-bot", 12, 7, 0, 2), ("customer-interviews", 9, 3, 9, None), ("Projects", 7, 2, 0, 9), ("pricing-review", 6, 4, 0, 6)]
write("instructions.json", {"built": ago(0, 9),
  "files": {"count": 61, "public": 61, "by_kind": {"your instructions (every chat)": 1, "a folder's instructions": 5, "a folder's instructions (AGENTS.md)": 1, "reply style": 1, "helper definition": 7, "skill": 6, "memory note": 52}, "words": 9800},
  "loads": {"chats": 34, "since": (TODAY - datetime.timedelta(days=62)).isoformat(), "latest": {"route-planner": load("route-planner", 1), "triage-bot": load("triage-bot", 3), "customer-interviews": load("customer-interviews", 20), "pricing-review": load("pricing-review", 6)},
            "moved_memory": {"chats": 3, "since": (TODAY - datetime.timedelta(days=40)).isoformat(), "examples": [{"started": "Projects", "ended": "route-planner", "memory": "Projects", "when": ago(2)}]}},
  "repeats": [{"files": ["~/.claude/agents/spec-writer.md", "~/.claude/agents/ux-reviewer.md", "~/.claude/agents/release-notes.md", "~/Projects/route-planner/CLAUDE.md"], "kinds": ["helper definition"], "sample": "Link the ticket number in every status update.", "words": ["ticket", "status"]},
              {"files": ["~/.claude/CLAUDE.md", "~/Projects/pricing-review/CLAUDE.md", "~/.claude/skills/pricing-model/SKILL.md"], "kinds": ["skill"], "sample": "Never share customer names outside the team workspace.", "words": ["customer", "names"]}],
  "broken_links": [{"note": "carrier-tiers", "folder": "route-planner", "to": "old-rate-card", "elsewhere": False}, {"note": "sprint-cadence", "folder": "triage-bot", "to": "team-calendar", "elsewhere": True},
                   {"note": "interview-tags", "folder": "customer-interviews", "to": "codebook-v1", "elsewhere": False}, {"note": "launch-checklist", "folder": "Projects", "to": "go-live-steps", "elsewhere": False}],
  "missing_paths": [{"in": "~/Projects/triage-bot/CLAUDE.md", "path": "~/Projects/triage-bot/runbooks/escalation-v1.md"}, {"in": "~/.claude/projects/-Users-pm-Projects/memory/launch-checklist.md", "path": "~/Shared/Launch/2026-Q2/"}, {"in": "~/Projects/route-planner/CLAUDE.md", "path": "~/Projects/route-planner/specs/old/"}],
  "missing_count": 3, "shadowed": [{"file": "~/Projects/warehouse-cleanup/AGENTS.md", "because": "~/Projects/CLAUDE.md"}],
  "memory": {"notes": 52, "folders": 5, "kinds": {"feedback": 27, "project": 15, "reference": 6, "user": 4}, "stale_90": 9,
             "by_folder": [{"folder": f, "id": MF(None if f == "Projects" else f), "notes": n, "corrections": c, "oldest_days": 120 if st else 40, "stale_90": st, "newest": (TODAY - datetime.timedelta(days=100 if st else (ld or 3))).isoformat(),
                            "stale_names": [f"{f}-note-{i}" for i in range(st)], "last_loaded": ago(ld) if ld else None} for f, n, c, st, ld in mem_folders]},
  "reviewed": {"read": TODAY.isoformat(), "by": "Claude, reading made-up files", "items": [
     {"id": "notes-format", "title": "Two ways of writing release notes are in use", "line": "Your instructions ask for release notes in the changelog file; the release-notes subagent writes them as a separate page. Both are in use across 3 projects.", "files": ["~/.claude/CLAUDE.md", "~/Projects/route-planner/CLAUDE.md"], "fix": "Pick one place and say it once, in your instructions for every chat."},
     {"id": "old-dashboard", "title": "A retired dashboard is still named in 4 places", "line": "Your instructions say the old metrics dashboard was retired in August, but 4 files still send Claude to it.", "files": ["~/.claude/CLAUDE.md"], "fix": "Point those files at the new warehouse dashboard."}],
     "changes": {"memory-switch": [{"file": "~/.claude/CLAUDE.md", "label": "Your main rule file", "old": "Start in ~/Projects and switch into the project you name.", "new": "Open a project's chats in its own folder; notes only load from the folder a chat starts in.", "plain": "After this, Claude suggests opening each project's chats in its own folder, so its notes load."}]}}})

# ---------- run the real scripts on these files ----------
# one name per project on every screen: the demo's folders shown under their project names (build_app.py reads this)
json.dump({os.path.basename(w[-1].rstrip("/")): w[0] for w in WORK if w[-1] not in ("~", "")}, open(os.path.join(D, "folder-names.json"), "w"), indent=1)
env = dict(os.environ, GLASSBOX_DATA=D, GLASSBOX_OUT=os.path.join(ROOT, "app", "demo-data.js"), GLASSBOX_DEMO="1")
T = os.path.dirname(os.path.abspath(__file__))
for step in (["dashboard_data.py"], ["machine_data.py"], ["bills.py"], ["build_app.py"]):
    r = subprocess.run([sys.executable, os.path.join(T, step[0])] + step[1:], cwd=ROOT, env=env, capture_output=True, text=True)
    if r.returncode: print(r.stdout[-1500:], r.stderr[-1500:]); sys.exit("Stopped at " + step[0])
s = open(env["GLASSBOX_OUT"]).read()
open(env["GLASSBOX_OUT"], "w").write(s.replace("window.GB = ", f"window.GB_DEMO = {json.dumps({'company': COMPANY, 'who': 'product manager'})};\nwindow.GB = ", 1))
print(f"Demo company {COMPANY}: {len(sessions)} chats, {len(rows)} priced hours, {len(agents)} helper runs, this week from {WEEK}. Wrote app/demo-data.js")
