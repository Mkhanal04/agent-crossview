#!/usr/bin/env python3
"""Builds app/data.js for the v0 office from the data files and Claude Code logs. Counters only.
Run after sessions.py, group.py, inventory.py and dashboard_data.py. Usage: python3 build_app.py"""
import json, glob, os, collections, datetime, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prices import split_usd, CLAUDE as PRICE_TABLE
from paths import DATA, OUT, DEMO, SYSTEM, claude_logs, stamp
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
H = os.path.expanduser("~")
load = lambda n: json.load(open(os.path.join(DATA, n)))
D = load("dashboard.json"); inv = load("inventory.json"); rows = load("sessions-grouped.json")
notes = load("advisor-notes.json") if os.path.exists(os.path.join(DATA, "advisor-notes.json")) else {"notes": []}
HIDE = {"Day job", "Personal"}
today = datetime.date.today(); WEEK = (today - datetime.timedelta(days=today.weekday())).isoformat()
# Log times are UTC; days and weeks here are this Mac's local ones, as the app shows them.
def local_day(t):
    t = str(t or "")
    if "T" not in t: return t[:10]
    try: return datetime.datetime.fromisoformat((t[:19] if len(t) > 13 else t[:13] + ":00:00") + "+00:00").astimezone().date().isoformat()
    except ValueError: return t[:10]

work_of = {r["id"]: r["work"] for r in rows if r.get("id")}
# agent and skill calls per session, read from Claude Code's logs once and cached, so a correction only regroups them
CACHE = os.path.join(DATA, "calls-by-session.json")
if DEMO or ("--fast" in __import__("sys").argv and os.path.exists(CACHE)):  # the demo never reads this Mac's logs
    calls = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
else:
    calls = {}
    for f in claude_logs():
        sid = os.path.basename(f)[:-6]; c_ag = collections.Counter(); c_sk = collections.Counter()
        for line in open(f, errors="ignore"):
            if '"tool_use"' not in line: continue
            try: d = json.loads(line)
            except Exception: continue
            m = d.get("message")
            if d.get("type") != "assistant" or not isinstance(m, dict): continue
            for c in m.get("content") or []:
                if isinstance(c, dict) and c.get("type") == "tool_use":
                    inp = c.get("input") or {}
                    if c.get("name") in ("Agent", "Task"): c_ag[inp.get("subagent_type") or "general-purpose"] += 1
                    if c.get("name") == "Skill": c_sk[(inp.get("skill") or "?").split(":")[-1]] += 1
        if c_ag or c_sk: calls[sid] = {"agents": dict(c_ag), "skills": dict(c_sk)}
    json.dump(calls, open(CACHE, "w"))
agent_work = collections.defaultdict(collections.Counter); skill_work = collections.defaultdict(collections.Counter)
for sid, c in calls.items():
    w = work_of.get(sid, "Not sure yet")
    for n, k in c["agents"].items(): agent_work[n][w] += k
    for n, k in c["skills"].items(): skill_work[n][w] += k

# one name per project on every screen (QA run 4, finding 8): a folder shows as the project its chats are grouped into,
# by the same rules (data/work-rules.json, plus its "folders" list for names the rules don't catch)
_WR = os.path.join(DATA, "work-rules.json")
_wr = json.load(open(_WR)) if os.path.exists(_WR) else {}
_FN = os.path.join(DATA, "folder-names.json")  # the demo's own list (tools/demo_company.py)
_fn = dict(json.load(open(_FN)) if os.path.exists(_FN) else {}, **(_wr.get("folders") or {}))
def proj(folder):
    f = str(folder or "")
    if f in _fn: return _fn[f]
    for name, pat in _wr.get("rules") or []:
        for v in (f, f.replace("-", " "), f.replace("_", " ")):
            try:
                if re.search(pat, v): return name
            except re.error: pass
    return f

def folder_names():
    """Every project folder's name mapped to its project's name, for the screens that show folders (What shapes Claude,
    Your setup). The demo uses only its own list; your own data also walks the project folders, three levels down."""
    names = set(_fn)
    if not DEMO:
        base = os.path.expanduser("~/Desktop/Claude_Projects")
        for root, dirs, _ in os.walk(base):
            dirs[:] = [d for d in dirs if not d.startswith((".", "_", "node_modules"))]
            if root[len(base):].count(os.sep) >= 3: dirs[:] = []
            names.update(dirs)
    global ALL_FOLDERS; ALL_FOLDERS = sorted(names)
    return {f: proj(f) for f in sorted(names) if proj(f) != f}
ALL_FOLDERS = []

def origin(where, plugin):
    if where.startswith("built"): return "Came with Claude Code"
    if where.startswith("your Claude account"): return "From your Claude account"
    if where == "account plugin": return f"From the {plugin} plugin"
    if where.startswith("yours"): return "Made by you"
    if where.startswith("one project only"): return "Only in " + proj(where.split(": ", 1)[1].split("/")[-1])
    return where

def clean(t):
    t = (t or "").replace("—", ",").replace("–", "-").strip()
    for stop in (". ", "! ", "? "):
        if stop in t: return t.split(stop)[0] + "."
    return t[:160]

PLAIN = {  # one-line plain descriptions of what comes with Claude Code and the Claude app, written by Claude (labeled as such in the app)
 "general-purpose": "Claude Code's general subagent for side tasks and research.", "Explore": "Claude Code's read-only subagent for searching many files.",
 "Plan": "Claude Code's subagent for planning a change before making it.", "claude-code-guide": "Answers questions about how Claude Code works.",
 "statusline-setup": "Sets up the status line at the bottom of Claude Code.", "chrome-browser": "How Claude uses your Chrome browser.",
 "artifact-design": "Design rules for pages Claude publishes.", "update-config": "Changes Claude Code's own settings.",
 "claude-api": "Reference for building with the Claude API.", "explain-usage": "Explains where a session's tokens went.",
 "pptx": "Makes and reads PowerPoint files.", "dataviz": "Guidance for charts and dashboards.",
 "artifact-capabilities": "What a published page can do.", "workflow-authoring": "Reference for multi-agent workflows.",
}
# lines for your own subagents and skills, if you wrote any: data/agent-notes.json, {"plain": {name: line}, "mine": {name: line}}
# ("mine" is for one of yours that shares a name with a project's); private like the rest of data/

_own = load("agent-notes.json") if os.path.exists(os.path.join(DATA, "agent-notes.json")) else {}
PLAIN.update(_own.get("plain", {})); PLAIN_MINE = _own.get("mine", {})

def nice_work(w): return dict(sorted(((k if k not in HIDE else k), v) for k, v in w.items()))

# what each helper agent used, from its own logs (ledger rows are priced from tokens; labeled as estimates in the app)
LG = json.load(open(os.path.join(DATA, "ledger.json")))
LA = LG["agents"]
ag_cost = collections.defaultdict(lambda: {"usd": 0.0, "usd_est": 0.0, "usd_week": 0.0, "runs": set(), "week_runs": set(), "last": "", "models": collections.Counter(), "work": collections.Counter(), "work_runs": collections.defaultdict(set), "tools": collections.Counter()})
main_cost = collections.Counter(); helper_cost = collections.Counter()
for x in LG["rows"]:
    if x["agent"] == "main": main_cost[x["tool"]] += x["usd"]; continue
    helper_cost[x["tool"]] += x["usd"]
    c = ag_cost[LA.get(x["agent"], {}).get("type", "general-purpose")]
    c["usd"] += x["usd"]; c["usd_est"] += x.get("usd_est", 0); c["runs"].add(x["agent"]); c["models"][x["model"]] += x["usd"]
    c["work"][work_of.get(x["session"], "Not sure yet")] += x["usd"]; c["tools"][x["tool"]] += x["usd"]
    c["work_runs"][work_of.get(x["session"], "Not sure yet")].add(x["agent"]); c["last"] = max(c["last"], local_day(x["hour"]))
    if local_day(x["hour"]) >= WEEK: c["usd_week"] += x["usd"]; c["week_runs"].add(x["agent"])
def cost_of(n):
    c = ag_cost.get(n)
    if not c: return {"usd": 0, "usd_est": 0, "usd_week": 0, "logged_runs": 0, "week_runs": 0, "last_run": None, "models": {}, "where": [], "tools_usd": {}, "runs_by_tool": {}}
    return {"usd": round(c["usd"], 2), "usd_est": round(c["usd_est"], 2), "usd_week": round(c["usd_week"], 2), "logged_runs": len(c["runs"]),
            "week_runs": len(c["week_runs"]), "last_run": c["last"] or None,
            "models": {k: round(v, 2) for k, v in c["models"].most_common()},
            "where": [{"work": k, "runs": len(c["work_runs"][k]), "usd": round(v, 2)} for k, v in c["work"].most_common(8)],
            "tools_usd": {k: round(v, 2) for k, v in c["tools"].items()},
            "runs_by_tool": dict(collections.Counter(LA[i]["tool"] for i in c["runs"] if i in LA))}

def agent_file(path):
    # where the agent's file lives, for "how to change it"; day-job and personal folders stay unnamed
    if not path: return None
    for k, pat in (json.load(open(os.path.join(DATA, "private-patterns.json"))) if os.path.exists(os.path.join(DATA, "private-patterns.json")) else {}).items():
        if re.search(pat, path): return "a private folder"
    return path.replace(H, "~")
agents = []
for a in inv["agents"]:
    n = a["name"]
    cst = cost_of(n)  # runs = helper runs whose logs we can see and price (Claude Code and Cowork); one count everywhere
    cc_logged = cst["runs_by_tool"].get("Claude Code", 0)
    agents.append({"id": "agent:" + n, "name": n, "origin": origin(a["where"], None), "runs": cst["logged_runs"], "week": cst["week_runs"],
                   "last": cst["last_run"] or a.get("last_used"), "plain": (PLAIN_MINE.get(n) if origin(a["where"], None) == "Made by you" else None) or PLAIN.get(n, clean(a.get("what"))), "raw": clean(a.get("what")),
                   "unlogged": max(0, a["calls"] - cc_logged), "file": agent_file(a.get("path")), "model": a.get("model"), **cst})
# the logs name a subagent only by its name, so two with the same name share one count of runs; the app says so
_names = collections.Counter(x["name"] for x in agents)
for x in agents: x["same_name"] = _names[x["name"]] - 1
def added(path):
    try: st = os.stat(path); return datetime.date.fromtimestamp(getattr(st, "st_birthtime", st.st_mtime)).isoformat()
    except Exception: return None
skills = []
for s in inv["skills"]:
    n = s["name"]
    skills.append({"id": "skill:" + n, "name": n, "origin": origin(s["where"], s.get("plugin")), "uses": s["calls"], "week": D.get("skill_week", {}).get(n, 0),
                   "last": s.get("last_used"), "plain": PLAIN.get(n, ""), "raw": clean(s.get("what")), "scope": "one project" if s["where"].startswith("one project") else "every session", "added": added(s.get("path")) if s.get("path") else None, "desc_len": s.get("desc_len"),
                   "work": dict(skill_work[n].most_common(6)) if n in skill_work else {}})
# One piece of work, opened up: days, agents, models, token kinds, sessions, skills and limit hits while it ran.
skills_by_work = collections.defaultdict(collections.Counter)
for sk, ws in skill_work.items():
    for w, n in ws.items(): skills_by_work[w][sk] += n
row_of = {r["id"]: r for r in rows if r.get("id")}
detail = collections.defaultdict(lambda: {"days": collections.defaultdict(collections.Counter), "helpers": collections.defaultdict(lambda: {"usd": 0.0, "runs": set()}),
                                          "main": collections.Counter(), "models": collections.Counter(), "kinds": collections.Counter(),
                                          "sess": collections.defaultdict(lambda: {"usd": 0.0, "replies": 0, "helpers": set()}), "hours": collections.Counter(), "usd_kinds": collections.Counter()})
for x in LG["rows"]:
    w = work_of.get(x["session"], "Not sure yet"); d = detail[w]
    d["days"][local_day(x["hour"])][x["tool"]] += x["usd"]; d["models"][x["model"]] += x["usd"]; d["hours"][x["hour"]] += x["usd"]
    d["kinds"]["read"] += x["cache_read"]; d["kinds"]["write"] += x["cache_write"]; d["kinds"]["out"] += x["out"]; d["kinds"]["fresh"] += x["fresh_in"]
    for k, v in split_usd(x["model"], x).items(): d["usd_kinds"][k] += v
    sv = d["sess"][x["session"]]; sv["usd"] += x["usd"]; sv["replies"] += x["replies"]
    if x["agent"] == "main": d["main"][x["tool"]] += x["usd"]
    else:
        h = d["helpers"][LA.get(x["agent"], {}).get("type", "general-purpose")]; h["usd"] += x["usd"]; h["runs"].add(x["agent"]); sv["helpers"].add(x["agent"])
# skill calls by week (the week each Claude Code chat started, your time), so Your setup can light a skill for any week
def week_of(t): d = datetime.date.fromisoformat(local_day(t)); return (d - datetime.timedelta(days=d.weekday())).isoformat()
skill_weeks = collections.defaultdict(collections.Counter)
for sid, c in calls.items():
    if sid in row_of and c.get("skills"):
        for n, k in c["skills"].items(): skill_weeks[week_of(row_of[sid]["start"])][n] += k
hits_by_work = collections.defaultdict(list)  # a limit hit counts for every piece of work running in the window before it
for e in D.get("limit_events", []):
    if e["status"] != "hit": continue
    for r in e.get("running", []):
        if r["share"] >= 1: hits_by_work[r["work"]].append({"ts": e["ts"], "kind": e["kind"], "tool": e["tool"], "share": r["share"]})
def detail_of(w):
    d = detail.get(w)
    if not d: return None
    sess = []
    for sid, v in sorted(d["sess"].items(), key=lambda kv: str(row_of.get(kv[0], {}).get("start"))):
        r = row_of.get(sid, {})
        sess.append({"id": sid, "by": r.get("grouped_by"), "tool": r.get("tool"), "start": str(r.get("start"))[:16], "end": str(r.get("end") or r.get("start"))[:16],
                     "title": None if w in HIDE else (r.get("title") or None), "usd": round(v["usd"], 2), "replies": v["replies"], "helpers": len(v["helpers"])})
    busiest = max(d["days"].items(), key=lambda kv: sum(kv[1].values())) if d["days"] else None
    return {"days": {k: {t: round(u, 2) for t, u in v.items()} for k, v in sorted(d["days"].items())},
            "helpers": sorted([{"type": k, "usd": round(v["usd"], 2), "runs": len(v["runs"])} for k, v in d["helpers"].items()], key=lambda a: -a["usd"]),
            "main": {k: round(v, 2) for k, v in d["main"].items()}, "models": {k: round(v, 2) for k, v in d["models"].most_common()},
            "kinds": dict(d["kinds"]), "usd_kinds": {k: round(v, 2) for k, v in d["usd_kinds"].items()}, "sessions": sess, "skills": dict(skills_by_work[w].most_common(12)), "hits": hits_by_work.get(w, []),
            "busiest": {"day": busiest[0], "usd": round(sum(busiest[1].values()), 2)} if busiest else None}

work = []
agg = collections.OrderedDict()
for r in rows:
    a = agg.setdefault(r["work"], {"sessions": 0, "tools": collections.Counter(), "first": "9", "last": "0", "usd": 0.0, "usd_n": 0, "cc": 0, "helpers": 0, "usd_tool": collections.Counter(), "est": 0.0})
    a["sessions"] += 1; a["tools"][r["tool"]] += 1
    a["first"] = min(a["first"], local_day(r["start"])); a["last"] = max(a["last"], local_day(r["end"] or r["start"]))
    if r["tool"] == "Claude Code": a["cc"] += 1
    if r.get("list_price_usd"): a["usd"] += r["list_price_usd"]; a["usd_n"] += 1; a["usd_tool"][r["tool"]] += r["list_price_usd"]; a["est"] += r.get("usd_est") or 0
    a["helpers"] += r.get("helpers") or 0
# per piece of work: the days its replies ran (local), and tokens on models with no published price
reply_days = collections.defaultdict(list); unpriced_tok = collections.Counter()
for x in LG["rows"]:
    w_ = work_of.get(x["session"], "Not sure yet"); reply_days[w_].append(local_day(x["hour"]))
    if not x.get("priced", True): unpriced_tok[w_] += x["fresh_in"] + x["cache_write"] + x["cache_read"] + x["out"]
for k, a in agg.items():
    if reply_days.get(k): a["first"], a["last"] = min(reply_days[k]), max(reply_days[k])
    work.append({"id": "work:" + k, "name": k, "hidden_titles": k in HIDE, "sessions": a["sessions"], "tools": dict(a["tools"]), "first": a["first"], "last": a["last"],
                 "usd": round(a["usd"], 2) if a["usd_n"] else None, "usd_sessions": a["usd_n"], "cc_sessions": a["cc"], "helpers": a["helpers"],
                 "usd_tool": {t: round(v, 2) for t, v in a["usd_tool"].items()}, "usd_est": round(a["est"], 2),
                 "week_usd": round(D["weekly"].get(WEEK, {}).get(k, 0), 2), "unpriced_tokens": unpriced_tok.get(k, 0), "detail": detail_of(k)})
work.sort(key=lambda w: (-(w["usd"] or 0), -w["sessions"]))
PP_PATH = os.path.join(DATA, "private-patterns.json")
PP = json.load(open(PP_PATH)) if os.path.exists(PP_PATH) else {}
def mask(path):
    for k, pat in PP.items():
        if re.search(pat, path): return "Day job folder" if k == "day_job" else "Personal folder"
    if path == "~/Desktop/Claude_Projects/CLAUDE.md": return "Claude_Projects (the hub)"
    return path.replace("~/Desktop/Claude_Projects/", "").replace("/CLAUDE.md", "").replace("/AGENTS.md", " (AGENTS.md)") or path
# an AGENTS.md that Claude Code skips (a CLAUDE.md sits in its folder or above) isn't one of its rule files (Codex audit, Oct 19)
try: _skipped = {s["file"] for s in json.load(open(os.path.join(DATA, "instructions.json"))).get("shadowed", [])}
except Exception: _skipped = set()
instruction_files = sorted([{"where": mask(f["path"]) if f["path"] != "~/.claude/CLAUDE.md" else "Every project (your main rule file)", "words": f["words"], "modified": f["modified"]} for f in inv["instruction_files"] if f["path"] not in _skipped], key=lambda f: f["modified"], reverse=True)
conn = collections.Counter()
for c in inv["connectors"]: conn[c["server"].replace(" (name inferred from its tools)", "")] += c["actions"]
connectors = [{"name": k, "actions": v} for k, v in conn.most_common()]
PAL10 = ["#7aa5dc", "#dc8db4", "#62bf98", "#dcbb66", "#a69ad9", "#dc9a6c", "#62b9cc", "#a5c96e", "#c4a585", "#cbd2dc",
         "#8fb8e8", "#b79be0", "#7fd1b0", "#e0c98a", "#9ec3d6", "#c9b3e6", "#a8d08d", "#d9b38c"]  # no red: red marks "worth a decision"
alltime = collections.Counter()
for wk_, v in D["weekly"].items():
    for k, u in v.items(): alltime[k] += u
work_colors = {k: PAL10[i % len(PAL10)] for i, (k, _) in enumerate([kv for kv in alltime.most_common() if kv[0] not in ("Not sure yet",)])}  # every piece of work keeps one color

# The log of corrections (rule 14): every move, by you or by Claude, with where it came from.
OV_PATH = os.path.join(DATA, "work-overrides.json")
moves = []
for sid, o in (json.load(open(OV_PATH)) if os.path.exists(OV_PATH) else {}).items():
    r = row_of.get(sid, {}); o = {"work": o} if isinstance(o, str) else o
    private = r.get("work") in HIDE or o.get("was") in HIDE
    moves.append({"id": sid, "title": None if private else r.get("title"), "tool": r.get("tool"), "to": o["work"], "was": o.get("was"), "by": o.get("by", "your correction"), "why": o.get("why"), "when": o.get("when")})

# The advisor's notes name numbers as {placeholders}, filled here on every refresh so they never go stale: once for all
# the kept logs, and once for each recent week, so a card on Your week speaks about the week shown (panel round 1).
toks = lambda x: x["cache_read"] + x["cache_write"] + x["out"] + x["fresh_in"]
# {tp_top}: the costliest session in the one piece of work a note names, as "top_work" in data/advisor-notes.json
tp = [r.get("list_price_usd") or 0 for r in rows if notes.get("top_work") and r["work"] == notes.get("top_work")]
money = lambda v: "under $10" if v < 10 else f"about ${round(v / 10) * 10:,.0f}"
def vals_for(rs, period):
    hr = [x for x in rs if x["agent"] != "main"]; alltok = sum(toks(x) for x in rs) or 1
    k = collections.Counter()
    for x in rs:
        for kk, v in split_usd(x["model"], x).items(): k[kk] += v
    tot = max(1e-9, sum(k.values())); hrep = sum(x["replies"] for x in hr)
    return {"period": period, "helper_replies": f"{hrep:,}", "helper_runs": len({x["agent"] for x in hr}),
            "helper_top_share": round(100 * sum(x["replies"] for x in hr if any(m in x["model"] for m in ("opus", "fable", "mythos"))) / max(1, hrep)),
            "reread_share": round(100 * sum(x["cache_read"] for x in rs) / alltok), "tp_top": money(max(tp) if tp else 0),
            "carry_usd_share": round(100 * (k["read"] + k["write"]) / tot), "reread_usd_share": round(100 * k["read"] / tot),
            "store_usd_share": round(100 * k["write"] / tot), "answers_usd_share": round(100 * k["out"] / tot),
            "skills_total": len(skills), "skills_unused": sum(1 for s_ in skills if not s_["uses"]),
            "skills_unused_account": sum(1 for s_ in skills if not s_["uses"] and s_["origin"] == "From your Claude account")}
first_day = min((local_day(x["hour"]) for x in LG["rows"]), default=WEEK)
def fill(o, V):
    if isinstance(o, str): return o.format_map(collections.defaultdict(lambda: "?", V)) if "{" in o else o
    if isinstance(o, list): return [fill(v, V) for v in o]
    if isinstance(o, dict): return {k: fill(v, V) for k, v in o.items()}
    return o
raw_notes = notes
notes = fill(raw_notes, vals_for(LG["rows"], f"in all the kept logs (since {stamp(datetime.date.fromisoformat(first_day), '%b %-d')})"))
notes_by_week = {}
for w_ in (WEEK, (datetime.date.fromisoformat(WEEK) - datetime.timedelta(days=7)).isoformat()):
    rs_ = [x for x in LG["rows"] if w_ <= local_day(x["hour"]) <= (datetime.date.fromisoformat(w_) + datetime.timedelta(days=6)).isoformat()]
    V = vals_for(rs_, "this week" if w_ == WEEK else "last week")
    # a week with almost no helper work has nothing to say about helper models
    notes_by_week[w_] = [n for n in fill(raw_notes, V)["notes"] if not (n["id"] == "note-helper-models" and V["helper_runs"] < 3)]

BILLS = os.path.join(DATA, "bills.json")
money = json.load(open(BILLS)) if os.path.exists(BILLS) else None
MACH = os.path.join(DATA, "machine.json")
machine = json.load(open(MACH)) if os.path.exists(MACH) else None
OC = os.path.join(DATA, "other-costs.json")
other_costs = json.load(open(OC)) if os.path.exists(OC) else None
for _x in (other_costs or {}).get("services", []): _x["project"] = proj(_x.get("project"))
ANAT = os.path.join(DATA, "anatomy.json")
anatomy = json.load(open(ANAT)) if os.path.exists(ANAT) else None
# why each 5-hour stop happened: what ran in the five hours before it, from the priced rows (no message text)
def stop_causes():
    out = {}
    for e in D.get("limit_events") or []:
        if e.get("status") != "hit" or e.get("kind") != "five_hour" or e.get("tool") == "Codex": continue
        end = datetime.datetime.strptime(e["ts"][:13], "%Y-%m-%dT%H")
        hours = {(end - datetime.timedelta(hours=i)).strftime("%Y-%m-%dT%H") for i in range(5)}
        rs = [x for x in LG["rows"] if x["hour"] in hours and x["tool"] in ("Claude Code", "Cowork")]
        tot = sum(x["usd"] for x in rs)
        if tot <= 0: continue
        by = collections.defaultdict(lambda: {"usd": 0.0, "replies": 0, "read": 0, "main_replies": 0})
        for x in rs:
            b = by[x["session"]]; b["usd"] += x["usd"]
            if x["agent"] == "main": b["main_replies"] += x.get("replies", 0); b["read"] += x.get("cache_read", 0)
        sid, top = max(by.items(), key=lambda kv: kv[1]["usd"])
        kinds = collections.Counter()
        for x in rs:
            for k, v in split_usd(x["model"], x).items(): kinds[k] += v
        w = work_of.get(sid, "Not sure yet")
        out[e["ts"]] = {"usd": round(tot, 2), "chats": sum(1 for v in by.values() if v["usd"] >= 0.15 * tot),
                        "top": {"work": w, "share": round(100 * top["usd"] / tot), "replies": top["main_replies"], "per_reply_k": round(top["read"] / top["main_replies"] / 1000) if top["main_replies"] else None},
                        "helpers": round(100 * sum(x["usd"] for x in rs if x["agent"] != "main") / tot),
                        "top_models": round(100 * sum(x["usd"] for x in rs if re.search(r"opus|fable|mythos", x["model"])) / tot),
                        "carry": round(100 * (kinds["read"] + kinds["write"]) / tot)}
    return out
SHP = os.path.join(DATA, "instructions.json")  # What shapes Claude (tools/instructions.py): files, what loaded, repeats, memory
shapes = json.load(open(SHP)) if os.path.exists(SHP) else None
# ---------- one figure per fact, whichever screen shows it ----------
def shares(vals, total=100):
    """Whole-number percentages that add up to the total (largest remainder), the same rule as shares() in app/app.js."""
    s = sum(vals)
    if not s: return [0 for _ in vals]
    raw = [v * total / s for v in vals]; fl = [int(r) for r in raw]; left = int(round(total)) - sum(fl)
    for _, i in sorted(((raw[i] - fl[i], i) for i in range(len(vals))), key=lambda x: -x[0]):
        if left <= 0: break
        fl[i] += 1; left -= 1
    return fl
# each project's share of a week, worked out once over every project that week, so Your week, the receipt and By week agree
for per_, P_ in ((machine or {}).get("periods") or {}).items():
    ws_ = [k for k, t_ in P_.items() if isinstance(t_, dict) and (t_.get("usd") or 0) > 0]
    for k, p_ in zip(ws_, shares([P_[k]["usd"] for k in ws_])): P_[k]["share"] = p_
    for k, t_ in P_.items():
        if isinstance(t_, dict) and k not in ws_: t_["share"] = 0
weekly_share = {}
for w_, v_ in D["weekly"].items():
    ks_ = [k for k, u in v_.items() if u > 0]
    weekly_share[w_] = dict(zip(ks_, shares([v_[k] for k in ks_])))
if shapes:
    # Claude's notes: one count (tools/instructions.py), also used by Your setup, so a note saved mid-refresh can't split them
    m_ = shapes.get("memory") or {}
    cc_ = (anatomy or {}).get("Claude Code") or {}
    if "notes" in m_ and cc_.get("memory") is not None:
        cc_["memory"]["notes"] = m_["notes"]; cc_["memory"]["folders"] = m_.get("folders", cc_["memory"].get("folders"))
        for part in (cc_.get("folder") or {}).get("parts") or []:
            if part and part[0] == "Its notes (memory)": part[1] = f"{m_['notes']} notes in {cc_['memory']['folders']} project folders"
    # two different skill figures, named apart: every skill found on this Mac and your account (Your week, Your setup),
    # and shapes.loads.latest[folder].listing.skills.listed_in_chat, what Claude Code listed in that folder's latest chat
    shapes["skills_found"] = len(skills)
CHG = os.path.join(DATA, "changes.json")  # changes you made from Glass Box, with how to undo each (tools/changes.py)
changes = json.load(open(CHG)).get("changes", []) if os.path.exists(CHG) else []
# connectors keep their ids; on screen they get the names their makers use, so a sentence never starts lower-case and
# "claude-in-chrome" never breaks at a hyphen (release 3)
SHOWN = {"claude-in-chrome": "Claude in Chrome", "playwright": "Playwright", "stitch": "Stitch", "notebooklm": "NotebookLM",
         "visualize": "Visualize", "mcp-registry": "Connector directory", "terminal": "Terminal", "scheduled-tasks": "Scheduled tasks"}
for _p in (lambda P: P.values() if isinstance(P, dict) else P)(machine.get("ports") or []):
    if _p.get("name") in SHOWN: _p["name"] = SHOWN[_p["name"]]
for _c in connectors:
    if isinstance(_c, dict) and _c.get("name") in SHOWN: _c["name"] = SHOWN[_c["name"]]
out = {"system": SYSTEM, "machine": machine, "money": money, "anatomy": anatomy, "other_costs": other_costs, "built": stamp(datetime.datetime.now(), "%b %-d, %-I:%M %p").replace("AM", "am").replace("PM", "pm"), "week_start": WEEK, "today": today.isoformat(), "agents": agents, "skills": skills, "work": work,
       "corrections": load("corrections.json") if os.path.exists(os.path.join(DATA, "corrections.json")) else None,
       "weekly": D["weekly"], "weekly_share": weekly_share, "model_cost": D["model_cost"], "token_kinds": D["token_kinds"], "limit_hits": D["limit_hits"],
       "sessions": D["sessions"], "tools": D["tools"], "connectors": D["connectors"], "instruction_files": D["instruction_files"],
       "plugin_state": load("plugin-state.json") if os.path.exists(os.path.join(DATA, "plugin-state.json")) else {},
       "notes": notes["notes"], "notes_by_week": notes_by_week, "flags": notes.get("flags", []),
       "moves": moves, "instruction_list": instruction_files, "connector_list": connectors, "work_colors": work_colors,
       "skill_weeks": {k: dict(v) for k, v in sorted(skill_weeks.items())[-12:]}, "week_runs": sum(a["week"] for a in agents), "all_runs": len(LA), "cowork_end": (D["ranges"].get("Cowork") or [None, None])[1],
       "rules": inv.get("rules") or {"allow": [], "ask": [], "deny": []}, "changes": changes, "stop_causes": stop_causes(), "shapes": shapes, "folder_names": folder_names(),
       "prices": {k: list(v) for k, v in PRICE_TABLE.items()},  # $ per million tokens: input, 5-minute write, 1-hour write, re-read, output
       "main_cost": {k: round(v, 2) for k, v in main_cost.items()}, "helper_cost": {k: round(v, 2) for k, v in helper_cost.items()},
       **{k: D[k] for k in ("usd_kinds", "limit_events", "weekly_tool", "by_tool", "est_tool", "ranges", "checks", "per_partial", "prices_checked", "price_sources", "unpriced")}}
# real clients and people under neutral display names (his call, Oct 15; data/display-aliases.json, private).
# Only what's shown changes: anything that looks like a path stays as it is, so prepared changes still find their files.
_AL = os.path.join(DATA, "display-aliases.json")
if os.path.exists(_AL) and not DEMO:
    _a = json.load(open(_AL)); _names = _a.get("names") or {}; _words = [(re.compile(r"\b" + re.escape(k) + r"\b"), v) for k, v in (_a.get("words") or {}).items()]
    def _alias_str(x):
        if "/" in x or x.startswith("~"): return x
        for pre in ("", "work:"):
            if x.startswith(pre) and x[len(pre):] in _names: return pre + _names[x[len(pre):]]
        for rx, v in _words: x = rx.sub(v, x)
        return x
    def _alias(o, keep_keys=False):
        if isinstance(o, dict): return {(k if keep_keys else _alias_str(k)): _alias(v) for k, v in o.items()}
        if isinstance(o, list): return [_alias(v) for v in o]
        return _alias_str(o) if isinstance(o, str) else o
    _fn_real = out.get("folder_names") or {}
    out = {k: (_alias(v, keep_keys=True) if k == "folder_names" else _alias(v)) for k, v in out.items()}
    # a folder name that was itself renamed still finds its project name
    for f, pname in _fn_real.items():
        if _alias_str(f) != f: out["folder_names"][_alias_str(f)] = _alias_str(pname)
    # a folder with no project of its own whose name holds a private name (a job application's folder, Oct 19) shows
    # under its private display name, or with the private word swapped, wherever Setup or the rule files show folders
    for f in ALL_FOLDERS:
        if f in _names: out["folder_names"][f] = _names[f]
        elif f not in out["folder_names"] and _alias_str(f) != f: out["folder_names"][f] = _alias_str(f)
    # the same folders inside a file path shown on screen (a rule finding's files, Gemini's turn 24): the path a change
    # needs stays real in the data, and the screens swap only the shown folder names
    out["private_folders"] = {f: (_names[f] if f in _names else _alias_str(f)) for f in ALL_FOLDERS if f in _names or _alias_str(f) != f}
# the writing rules the page can offer: their words live in tools/changes.py, so the page never sends its own text
try:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import changes as _ch
    out["writing_rules"] = _ch.WRITING
except Exception: out["writing_rules"] = {}
# what stops an unattended run, by week (release 3 slice 2, tools/runstops.py); the demo company gets a made-up week
try: out["runstops"] = json.load(open(os.path.join(DATA, "runstops.json"))) if not DEMO else {}
except Exception: out["runstops"] = {}
if DEMO:  # the made-up company: four made-up weeks, mostly in the default mode, with a few steps blocked
    _ws = datetime.date.fromisoformat(out.get("week_start") or datetime.date.today().isoformat())
    out["runstops"] = {(_ws - datetime.timedelta(days=7 * k)).isoformat(): {"modes": {"default": 40 + 5 * k, "acceptEdits": 12}, "blocked": {"commands": 1 + (k % 2)}, "declined": {"connectors": k % 2}, "steps": {"commands": 120}} for k in range(4)}
# plan names, prices and what comes with each plan: the one place they live (tools/plan-facts.json; his call, Oct 17)
try: out["plan_facts"] = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "plan-facts.json")))
except Exception: out["plan_facts"] = {"claude": [], "chatgpt": [], "unpriced": {}}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w").write("window.GB = " + json.dumps(out) + ";\n")
print("app/data.js:", len(agents), "agents,", len(skills), "skills,", len(work), "pieces of work,", len(out["notes"]), "notes")
