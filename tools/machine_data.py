#!/usr/bin/env python3
"""Data for the machine (the front door): per week and in all, which agents did each piece of work, what it used,
which connectors it reached, and the plan-usage percentages the Claude app keeps on this Mac. Counters only.
Run after ledger.py, sessions.py, group.py and inventory.py. Usage: python3 tools/machine_data.py [--fast]
--fast reuses the last read of connector uses from the logs (after a grouping correction)."""
import json, glob, os, re, sys, collections, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prices import split_usd
from paths import DATA, DEMO, codex_logs, log_lines, claude_logs, claude_json, claude_dir, claude_app_dir, files, stamp
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
H = os.path.expanduser("~")
load = lambda n: json.load(open(os.path.join(DATA, n)))
LG = load("ledger.json"); rows = load("sessions-grouped.json"); inv = load("inventory.json")
work_of = {r["id"]: r["work"] for r in rows if r.get("id")}
CHAT_FOLDERS = sorted({r["folder"] for r in rows if r.get("folder") and r.get("tool") == "Claude Code"})
LA = LG["agents"]

# Log times are UTC; days and weeks here are this Mac's own (Monday to Sunday).
def local_day(t):
    t = str(t or "")
    try: return datetime.datetime.fromisoformat((t[:19] if len(t) > 13 else t[:13] + ":00:00") + "+00:00").astimezone().date().isoformat()
    except ValueError: return t[:10]
def wk(day): d = datetime.date.fromisoformat(day); return (d - datetime.timedelta(days=d.weekday())).isoformat()

# ---------- who did each piece of work, and what it used, by week ----------
def blank(): return {"usd": 0.0, "replies": 0, "sessions": set(), "agents": collections.defaultdict(lambda: {"usd": 0.0, "runs": set()}),
                     "models": collections.Counter(), "kinds": collections.Counter(), "connectors": collections.Counter(), "days": set(),
                     "app_sessions": collections.defaultdict(set), "ckinds": collections.Counter(), "cusd": 0.0}
P = collections.defaultdict(lambda: collections.defaultdict(blank))  # period -> work -> totals
TL = collections.defaultdict(lambda: collections.defaultdict(lambda: {"sessions": set(), "usd": 0.0, "helper_usd": 0.0}))  # period -> app -> totals
for x in LG["rows"]:
    day = local_day(x["hour"]); w = work_of.get(x["session"], "Not sure yet")
    app = x["tool"] if x["agent"] == "main" else (LA.get(x["agent"], {}).get("tool") or x["tool"])
    for per in (wk(day), "all"):
        a = TL[per][app]; a["usd"] += x["usd"]
        if x["agent"] == "main": a["sessions"].add(x["session"])
        else: a["helper_usd"] += x["usd"]
    # helpers are keyed by the app that called them, so they nest under it: helper:<app>:<type>
    key = "main:" + x["tool"] if x["agent"] == "main" else "helper:" + (LA.get(x["agent"], {}).get("tool") or x["tool"]) + ":" + LA.get(x["agent"], {}).get("type", "general-purpose")
    for per in (wk(day), "all"):
        t = P[per][w]; t["usd"] += x["usd"]; t["replies"] += x.get("replies", 0); t["sessions"].add(x["session"]); t["days"].add(day)
        if x["agent"] == "main": t["app_sessions"][x["tool"]].add(x["session"])
        a = t["agents"][key]; a["usd"] += x["usd"]
        if x["agent"] != "main": a["runs"].add(x["agent"])
        t["models"][x["model"]] += x["usd"]
        for k, v in split_usd(x["model"], x).items():
            t["kinds"][k] += v
            if x["tool"] != "Codex": t["ckinds"][k] += v  # Claude's apps only: Claude's limit never counts Codex's work (Oct 20)
        if x["tool"] != "Codex": t["cusd"] += x["usd"]

# ---------- connector uses per session and day, from Claude Code's logs (main sessions and helpers) ----------
CACHE = os.path.join(DATA, "connector-uses.json")
if DEMO or ("--fast" in sys.argv and os.path.exists(CACHE)):  # the demo never reads this Mac's logs
    uses = json.load(open(CACHE)) if os.path.exists(CACHE) else {"by_session": {}, "tools": {}, "offered": {}}
else:
    uses = collections.defaultdict(lambda: collections.defaultdict(collections.Counter))  # session -> day -> server -> n
    tools_used = collections.defaultdict(collections.Counter)  # server -> tool -> n
    offered = collections.defaultdict(set)  # server -> every action it offers, from the tool lists Claude Code logs at the start of a chat
    TOOL = re.compile(r"mcp__([A-Za-z0-9_-]+?)__([A-Za-z0-9_-]+)")
    for f in claude_logs() + claude_logs(helpers=True):
        sid = os.path.basename(f)[:-6] if "/subagents/" not in f else f.split("/subagents/")[0].rsplit("/", 1)[1]
        for line in open(f, errors="ignore"):
            if '"type":"attachment"' in line and "mcp__" in line:
                for srv, tool in TOOL.findall(line): offered[srv].add(tool)
            if "attributionMcpServer" not in line: continue
            try: d = json.loads(line)
            except Exception: continue
            s = d.get("attributionMcpServer")
            if not s: continue
            uses[sid][local_day(d.get("timestamp") or "")][s] += 1
            if d.get("attributionMcpTool"): tools_used[sid + "|" + s][d["attributionMcpTool"]] += 1
    tbs = collections.defaultdict(dict)
    for k, v in tools_used.items(): sid, srv = k.split("|", 1); tbs[sid][srv] = dict(v)
    new = {"by_session": {k: {dd: dict(c) for dd, c in v.items()} for k, v in uses.items()}, "tools_by_session": dict(tbs), "offered": {k: sorted(v) for k, v in offered.items()}}
    # chats whose logs Claude Code has since deleted keep their counts from the last refresh (see ledger.py)
    if os.path.exists(CACHE):
        try:
            old = json.load(open(CACHE))
            for sid, v in (old.get("by_session") or {}).items():
                if sid not in new["by_session"]: new["by_session"][sid] = v; new["tools_by_session"][sid] = (old.get("tools_by_session") or {}).get(sid, {})
            for srv, ts_ in (old.get("offered") or {}).items(): new["offered"][srv] = sorted(set(new["offered"].get(srv, [])) | set(ts_))
        except Exception: pass
    agg = collections.defaultdict(collections.Counter)
    for sid, srvs in new["tools_by_session"].items():
        for srv, ts_ in srvs.items(): agg[srv].update(ts_)
    new["tools"] = {k: dict(v) for k, v in agg.items()}
    uses = new
    json.dump(uses, open(CACHE, "w"))
for sid, days in uses["by_session"].items():
    w = work_of.get(sid, "Not sure yet")
    for day, c in days.items():
        for per in (wk(day), "all"):
            for s, n in c.items(): P[per][w]["connectors"][s] += n

# ---------- the ports: every connector seen in the logs or set up on this Mac ----------
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-")
VERBS = [("delete", r"delete|trash|remove|purge|revoke|kill|stop|cancel|pause"),
         ("send", r"send|reply|forward|post|publish|deploy|share|invite|comment|notify|push"),
         ("change", r"create|update|edit|upload|apply|write|set_|add|copy|move|rename|generate|import|merge|resize|label|draft|fill|run|execute|type|click|form|navigate|build|launch|tap|swipe"),
         ("read", r"get|list|search|read|fetch|find|download|query|view|screenshot|status|describe|inspect|context|metadata|export|reveal")]
def kinds_of(tools):
    k = set()
    for t in tools:
        for name, pat in VERBS:
            if re.search(pat, t.lower()): k.add(name); break
    return [n for n, _ in VERBS[::-1] if n in k]  # read, change, send, delete
def kind_of(t):
    for name, pat in VERBS:
        if re.search(pat, t.lower()): return name
    return None
READ_FIRST = re.compile(r"^(get|list|search|read|fetch|find|download|query|view|screenshot|status|describe|inspect|context|metadata|export|reveal|count|aggregate|whoami|help|learn)([_-]|$)")
def risky(t):
    # an action that sends or deletes, judged by its name; one that starts with a reading verb (get_deployment) only reads
    return not READ_FIRST.match(t.lower()) and kind_of(t) in ("send", "delete")
names = {c["id"]: c["server"].replace(" (name inferred from its tools)", "") for c in inv["connectors"]}
names = {k: ("Claude app's own tools" if v == "Claude desktop app controls" else v) for k, v in names.items()}
# What a connector can do comes from every action it offers (the panel's first finding: actions used only show what it did).
# A browser or computer connector's reach comes from how it's set up, not its name (camera fix batch, Oct 15):
#   your_browser  works inside your own Chrome, where you're signed in (claude-in-chrome, or Playwright's extension mode): acts as you
#   screen        controls the Mac's screen and keyboard (computer use): acts as you
#   own_browser   runs a browser of its own that keeps its sign-ins (Playwright's default, a profile in its own cache folder)
#   fresh_browser opens a fresh browser each time and keeps nothing (Playwright with --isolated)
# Playwright's modes: https://www.mintlify.com/microsoft/playwright-mcp/guides/user-profiles (checked Oct 15 2026).
BROWSERISH = re.compile(r"chrome|browser|playwright|computer", re.I)
def server_args(name):
    """Every set of arguments a server with this name is started with, from Claude Code, its plugins and the Claude app."""
    found = []
    def look(servers):
        for k, v in (servers or {}).items():
            if k.lower() == name.lower() and isinstance(v, dict): found.append([str(a) for a in v.get("args") or []])
    if DEMO: return found
    try:
        cj = json.load(open(claude_json())); look(cj.get("mcpServers"))
        for proj in (cj.get("projects") or {}).values(): look(proj.get("mcpServers"))
    except Exception: pass
    try: look(json.load(open(claude_app_dir() + "claude_desktop_config.json")).get("mcpServers"))
    except Exception: pass
    for sv, _ in mcp_files(): look(sv)  # a browser connector set up in one folder's .mcp.json (Codex audit, Oct 19)
    for f in files(claude_dir() + "/plugins/marketplaces/*/external_plugins/*/.mcp.json") + files(claude_dir() + "/plugins/cache/*/*/*/.mcp.json"):
        try: d = json.load(open(f)); look(d.get("mcpServers") or d)
        except Exception: pass
    return found
# a connector that runs on this Mac but is set up with an online account (a cloud project, an API key or token, or a web
# address) acts on that service, so its changes and deletes land outside the Mac (release 3: stitch's delete removes a
# project on Google's service). Read from how it's set up, never from its name; key names only, never their values.
ONLINE_KEY = re.compile(r"cloud|project|api[_-]?key|token|account|secret", re.I)
# Connectors whose start command names a package that works on an online service, with no key or web address in its
# settings (Codex audit, Oct 19: NotebookLM edits notebooks online; the gws command works on Google Drive and Sheets).
# The one place to add more: matched against the command and its arguments, never the connector's own name.
ONLINE_PACKAGE = re.compile(r"notebooklm-mcp|(^|/)gws$", re.I)
def mcp_files():
    """The .mcp.json files Claude Code reads: one in a folder applies to chats started in that folder (Codex audit, Oct 19:
    a connector set up this way, never used, was missing). Folders come from claude.json's project list and the chats."""
    if DEMO: return []
    folders = [claude_dir()]
    try: folders += list((json.load(open(claude_json())).get("projects") or {}).keys())
    except Exception: pass
    out = []
    for d in dict.fromkeys(folders + CHAT_FOLDERS):
        f = os.path.join(d, ".mcp.json")
        if os.path.isfile(f):
            try: d_ = json.load(open(f)); out.append((d_.get("mcpServers") or {}, d))
            except Exception: pass
    return out
def online_setup(name):
    if DEMO: return False
    def look(servers):
        for k, v in (servers or {}).items():
            if k.lower() != name.lower() or not isinstance(v, dict): continue
            if v.get("url") or v.get("type") in ("http", "sse"): return True
            if any(ONLINE_KEY.search(e) for e in (v.get("env") or {})): return True
            if any(ONLINE_PACKAGE.search(str(a)) for a in [v.get("command") or ""] + list(v.get("args") or [])): return True
        return False
    try:
        cj = json.load(open(claude_json()))
        if look(cj.get("mcpServers")) or any(look(p.get("mcpServers")) for p in (cj.get("projects") or {}).values()): return True
    except Exception: pass
    if any(look(sv) for sv, _ in mcp_files()): return True
    try: return look(json.load(open(claude_app_dir() + "claude_desktop_config.json")).get("mcpServers"))
    except Exception: return False
def reach_of(i, name):
    key = (i + " " + name).lower()
    if not BROWSERISH.search(key): return None
    if "computer" in key: return "screen"
    if "playwright" in key:
        sets = server_args("playwright")
        if any("--extension" in a for a in sets): return "your_browser"
        if sets and all("--isolated" in a for a in sets): return "fresh_browser"
        return "own_browser"
    return "your_browser"  # Claude in Chrome and other Chrome connectors work inside your own browser
ports = {}
for c in inv["connectors"]:
    i = c["id"]
    group = "app" if i.startswith("ccd_") else "account" if UUID.match(i) else "mac"
    used = list(uses["tools"].get(i, {}).keys() or c.get("tools_seen") or [])
    offer = (uses.get("offered") or {}).get(i) or []
    reach = None if group == "app" else reach_of(i, names[i])
    as_you = reach in ("your_browser", "screen")
    can = ["read", "change", "send", "delete"] if as_you else (kinds_of(set(offer) | set(used)) or (["read", "change"] if reach else []))
    ports[i] = {"id": i, "name": names[i], "group": group, "inferred": "inferred" in c["server"], "actions": c["actions"],
                "kinds": can, "did": kinds_of(used), "offered": len(offer), "from_list": bool(offer), "as_you": as_you, "reach": reach,
                "built_in": group == "app",  # the Claude app's own tools, not a connector to another app
                "outside": bool(reach) or group == "account" or (group == "mac" and online_setup(names[i])), "set_up_only": False,
                # the actions that send or delete, so a rule can ask before just those (Your week, What can my agents reach?)
                "risky_tools": sorted(t for t in set(offer) | set(used) if risky(t)),
                "risky_uses": sum(n for t, n in uses["tools"].get(i, {}).items() if risky(t))}
# set up on this Mac but never seen in the logs
def add_setup(name, where):
    if any(p["name"].lower() == name.lower() or p["id"].lower() == name.lower() for p in ports.values()): return
    ports["setup:" + name] = {"id": "setup:" + name, "name": name, "group": "mac", "inferred": False, "actions": 0, "kinds": [], "did": [], "offered": 0, "from_list": False, "as_you": False, "outside": online_setup(name), "set_up_only": True, "where": where}
APP = os.path.join(DATA, "") if DEMO else claude_app_dir()
try:
    if DEMO: raise FileNotFoundError  # the demo's setup is all in its own files
    cj = json.load(open(claude_json()))
    for n in (cj.get("mcpServers") or {}): add_setup(n, "Claude Code, every folder")
    for proj in (cj.get("projects") or {}).values():
        for n in (proj.get("mcpServers") or {}): add_setup(n, "Claude Code, one folder")
except Exception: pass
for servers, folder in mcp_files():
    for n in servers: add_setup(n, "Claude Code, one folder")
try:
    for n in (json.load(open(APP + "claude_desktop_config.json")).get("mcpServers") or {}): add_setup(n, "the Claude app")
except Exception: pass
try:
    for k, v in (json.load(open(APP + "extensions-installations.json")).get("extensions") or {}).items():
        add_setup((v.get("manifest") or {}).get("display_name") or k, "the Claude app (extension)")
except Exception: pass

# ---------- when the weekly limit resets, and where this week is heading ----------
# The Claude app's record has no reset times, but every reset shows as a drop between two readings. The reset is at the
# same time each week, so the drops narrow it down: the time of week that falls inside every drop's gap.
WEEK_S = 7 * 86400
def weekly_forecast(S, ts):
    t = lambda s: ts(s).timestamp()
    gaps = [(t(a), t(b)) for a, b in zip(S, S[1:]) if ((a.get("u") or {}).get("sd") or 0) - ((b.get("u") or {}).get("sd") or 0) >= 15]
    if len(gaps) < 2: return {}
    base = datetime.datetime(2026, 1, 5, tzinfo=datetime.timezone.utc).timestamp()  # a Monday, midnight UTC (resets don't move with daylight saving)
    ok = [p for p in range(0, WEEK_S, 900) if all(any(a <= base + p + k * WEEK_S <= b for k in range(int((a - base) // WEEK_S) - 1, int((b - base) // WEEK_S) + 2)) for a, b in gaps)]
    if not ok: return {}
    if ok[0] == 0 and ok[-1] == WEEK_S - 900:  # the window runs across the start of the week: count it from the other side
        ok = sorted(p + WEEK_S if p < WEEK_S / 2 else p for p in ok)
    lo, hi = ok[0], ok[-1]
    if hi - lo > 2 * 86400: return {}  # too loose to say
    mid = (lo + hi) / 2
    last_t, last_sd = t(S[-1]), (S[-1].get("u") or {}).get("sd")
    reset = base + mid + ((last_t - base - mid) // WEEK_S) * WEEK_S  # the most recent reset before the last reading
    loc = lambda x: stamp(datetime.datetime.fromtimestamp(x), "%a %-I:%M %p").replace("AM", "am").replace("PM", "pm")  # shown at this week's dates, so daylight saving is right
    out = {"weekly_reset": {"from": loc(reset - (mid - lo)), "to": loc(reset + (hi - mid)),
                            "drops": len(gaps), "last": datetime.datetime.fromtimestamp(reset).isoformat(timespec="minutes"), "next": datetime.datetime.fromtimestamp(reset + WEEK_S).isoformat(timespec="minutes")}}
    elapsed = last_t - reset
    if last_sd is not None and elapsed >= 12 * 3600 and last_sd >= 3:
        rate = last_sd / elapsed
        out["weekly_pace"] = {"sd": last_sd, "at": datetime.datetime.fromtimestamp(last_t).isoformat(timespec="minutes"), "hours_in": round(elapsed / 3600),
                              "at_reset": round(last_sd * WEEK_S / elapsed),
                              "runs_out": datetime.datetime.fromtimestamp(reset + 100 / rate).isoformat(timespec="minutes") if last_sd * WEEK_S / elapsed >= 100 else None}
    return out

# ---------- readings from Glass Box's own status line in Claude Code, if you switched it on (tools/statusline.py) ----------
pace = None
PL = os.path.join(DATA, "pace-log.jsonl")
if os.path.exists(PL) and not DEMO:
    rows = []
    for l in open(PL).readlines()[-3000:]:
        try: rows.append(json.loads(l))
        except Exception: pass
    if rows: pace = {"rows": [r for r in rows if r.get("t", 0) >= rows[-1]["t"] - 7 * 86400][-400:], "since": datetime.datetime.fromtimestamp(rows[0]["t"]).date().isoformat()}

# ---------- plan usage percentages the Claude app keeps (five-hour and weekly bars) ----------
plan = None
try:
    ph = json.load(open(APP + "plan-usage-history.json"))
    S = sorted(ph.get("samples") or [], key=lambda s: s["t"])
    if S:
        ts = lambda s: datetime.datetime.fromtimestamp(s["t"] / 1000 if s["t"] > 1e12 else s["t"])
        peaks = collections.defaultdict(lambda: {"fh": 0, "sd": 0})
        for s in S:
            p = peaks[wk(ts(s).date().isoformat())]; u = s.get("u") or {}
            p["fh"] = max(p["fh"], u.get("fh") or 0); p["sd"] = max(p["sd"], u.get("sd") or 0)
        last = S[-1]
        plan = {"latest": {"fh": (last.get("u") or {}).get("fh"), "sd": (last.get("u") or {}).get("sd"), "at": ts(last).isoformat(timespec="minutes")},
                "since": ts(S[0]).date().isoformat(), "samples": len(S), "week_peaks": dict(peaks),
                # each reading of the last 15 days (local time, weekly %, 5-hour %), for Your week's pace chart (Oct 15)
                "readings": [[ts(x).isoformat(timespec="minutes"), (x.get("u") or {}).get("sd"), (x.get("u") or {}).get("fh")] for x in S if ts(x) >= ts(last) - datetime.timedelta(days=15)]}
        plan.update(weekly_forecast(S, ts))
except Exception: pass

# ---------- Codex's own limit readings (release 1, Oct 16): its logs record how much of its 5-hour and weekly limits
# were used after each reply, with each window's reset time. Kept for the last 15 days, one reading per 10 minutes.
codex_plan = {}
try:
    if DEMO: raise FileNotFoundError
    cut = datetime.datetime.now() - datetime.timedelta(days=15)
    seen, rd, plan_type = set(), [], None
    for f in codex_logs():
        if datetime.datetime.fromtimestamp(os.path.getmtime(f)) < cut: continue
        for line in open(f, encoding="utf-8", errors="ignore"):  # plain logs only, as before (compressed ones: a follow-up)
            if '"rate_limits"' not in line: continue
            try: d = json.loads(line)
            except Exception: continue
            rl = (d.get("payload") or {}).get("rate_limits") or {}
            pr, se = rl.get("primary") or {}, rl.get("secondary") or {}
            if rl.get("plan_type"): plan_type = rl["plan_type"]  # the plan Codex says you're on (plus, pro, business...), for the first open's plan question
            if se.get("used_percent") is None or not d.get("timestamp"): continue
            t = datetime.datetime.fromisoformat(d["timestamp"].replace("Z", "+00:00")).astimezone().replace(tzinfo=None)
            if t < cut: continue
            key = t.strftime("%Y-%m-%d %H:") + str(t.minute // 10)
            if key in seen: continue
            seen.add(key)
            rs = se.get("resets_at")
            rd.append([t.isoformat(timespec="minutes"), se.get("used_percent"), pr.get("used_percent"),
                       datetime.datetime.fromtimestamp(rs).isoformat(timespec="minutes") if rs else None, se.get("window_minutes")])
    rd.sort()
    if rd:
        # a new weekly window starts when the reset time moves on: Codex's week runs from first use, not from Monday
        starts = [r[0] for i, r in enumerate(rd) if i and r[3] and rd[i - 1][3] and r[3] > rd[i - 1][3]]
        codex_plan = {"readings": rd, "window_starts": starts, "latest": {"sd": rd[-1][1], "fh": rd[-1][2], "at": rd[-1][0], "resets": rd[-1][3]}, "plan_type": plan_type}
except Exception: pass

def out_period(per):
    res = {}
    for w, t in P[per].items():
        res[w] = {"usd": round(t["usd"], 2), "replies": t["replies"], "sessions": len(t["sessions"]), "days": len(t["days"]),
                  "day_list": sorted(t["days"]) if per != "all" else [], "app_sessions": {k: len(v) for k, v in t["app_sessions"].items()},
                  "agents": {k: {"usd": round(a["usd"], 2), "runs": len(a["runs"])} for k, a in sorted(t["agents"].items(), key=lambda kv: -kv[1]["usd"])},
                  "models": {k: round(v, 2) for k, v in t["models"].most_common(6) if v > 0},
                  "kinds": {k: round(v, 2) for k, v in t["kinds"].items()}, "connectors": dict(t["connectors"].most_common()),
                  "ckinds": {k: round(v, 2) for k, v in t["ckinds"].items()}, "cusd": round(t["cusd"], 2)}
    return res
weeks = sorted(k for k in P if k != "all")
apps = lambda per: {k: {"sessions": len(v["sessions"]), "usd": round(v["usd"], 2), "helper_usd": round(v["helper_usd"], 2)} for k, v in TL[per].items()}
# day by day for the last six weeks, by plan family (Claude: Claude Code and Cowork; Codex), at pay-per-use prices: the
# home's limits module compares this week with the usual week when a plan records no limit readings (Oct 18)
_cut = (datetime.date.today() - datetime.timedelta(days=42)).isoformat()
daily = collections.defaultdict(lambda: collections.Counter())
for x in LG["rows"]:
    d = local_day(x["hour"])
    if d >= _cut: daily[d]["Codex" if x["tool"] == "Codex" else "Claude"] += x["usd"]
daily = {d: {k: round(v, 2) for k, v in c.items()} for d, c in sorted(daily.items())}
# ---------- the receipt (release 2, Oct 19): per week and in all, the same work at per-use prices split the ways the
# receipt shows it: by app (logged, with the estimate for subagent records kept only in part), by kind of use, by model, your
# chats against subagents, and replies with no published price (counted, never priced). Chats count only priced replies, so
# Codex's "Approve for me" reviews aren't counted as chats.
def receipt_blank(): return {"tools": collections.defaultdict(lambda: {"usd": 0.0, "est": 0.0, "chats": set(), "out": 0}), "kinds": collections.Counter(),
                             "models": collections.Counter(), "who": collections.Counter(), "unpriced": collections.Counter()}
RC = collections.defaultdict(receipt_blank)
for x in LG["rows"]:
    day = local_day(x["hour"]); priced = x.get("priced", True)
    for per in (wk(day), "all"):
        r = RC[per]; t = r["tools"][x["tool"]]
        t["usd"] += x["usd"]; t["est"] += x.get("usd_est", 0) or 0; t["out"] += x.get("out", 0) or 0  # what it wrote, in tokens (release 3)
        if x["agent"] == "main" and priced: t["chats"].add(x["session"])
        if not priced: r["unpriced"][x["model"]] += x.get("replies", 0)
        r["models"][x["model"]] += x["usd"]
        r["who"][("main:" if x["agent"] == "main" else "helper:") + x["tool"]] += x["usd"]
        for k, v in split_usd(x["model"], x).items(): r["kinds"][k] += v
# ---------- the work list (release 2 slice 4, Oct 19): per week and in all, every chat with its project, app, days, per-use
# price (with the estimate for subagent records kept only in part), main model and the subagents it called, by type
CH = collections.defaultdict(lambda: collections.defaultdict(lambda: {"usd": 0.0, "est": 0.0, "days": set(), "models": collections.Counter(), "main_usd": 0.0,
                                                                        "helpers": collections.defaultdict(lambda: {"usd": 0.0, "runs": set()}), "tool": None, "priced": False, "replies": 0}))
RUN_HOME = {}
for x in LG["rows"]:
    day = local_day(x["hour"])
    for per in (wk(day), "all"):
        c = CH[per][x["session"]]; c["tool"] = c["tool"] or x["tool"]
        c["usd"] += x["usd"]; c["est"] += x.get("usd_est", 0) or 0; c["days"].add(day); c["models"][x["model"]] += x["usd"]
        c["priced"] = c["priced"] or x.get("priced", True)
        if x["agent"] == "main": c["main_usd"] += x["usd"]; c["replies"] += x.get("replies", 0)
        else:
            # a subagent run counts once a week, under the first chat it appears in (a run can show up in two chats' records,
            # Oct 19: Work said 149 runs where the limit page said 147)
            h = c["helpers"][LA.get(x["agent"], {}).get("type", "general-purpose")]; h["usd"] += x["usd"]
            if RUN_HOME.setdefault((per, x["agent"]), x["session"]) == x["session"]: h["runs"].add(x["agent"])
def chats_out(k):
    out_ = []
    for sid, c in CH.get(k, {}).items():
        out_.append({"id": sid, "work": work_of.get(sid, "Not sure yet"), "tool": c["tool"], "usd": round(c["usd"], 2), "est": round(c["est"], 2),
                     "main_usd": round(c["main_usd"], 2), "days": sorted(c["days"]), "model": c["models"].most_common(1)[0][0] if c["models"] else None,
                     "priced": c["priced"], "replies": c["replies"],
                     "helpers": sorted(({"type": t, "usd": round(h["usd"], 2), "runs": len(h["runs"])} for t, h in c["helpers"].items()), key=lambda h: -h["usd"])})
    return sorted(out_, key=lambda o: -o["usd"])
def receipt_out(k):
    r = RC.get(k) or receipt_blank()
    return {"tools": {a: {"usd": round(t["usd"], 2), "est": round(t["est"], 2), "chats": len(t["chats"]), "out": t["out"]} for a, t in r["tools"].items()},
            "kinds": {a: round(v, 2) for a, v in r["kinds"].items()}, "models": {a: round(v, 2) for a, v in r["models"].items() if v or a in r["unpriced"]},
            "who": {a: round(v, 2) for a, v in r["who"].items()}, "unpriced": dict(r["unpriced"])}
out = {"daily": daily, "periods": {k: out_period(k) for k in weeks[-10:] + ["all"]}, "apps": {k: apps(k) for k in weeks[-10:] + ["all"]}, "ports": sorted(ports.values(), key=lambda p: (p["group"], -p["actions"])), "plan": plan, "codex_plan": codex_plan, "pace": pace, "receipt": {k: receipt_out(k) for k in weeks[-10:] + ["all"]}, "chats": {k: chats_out(k) for k in weeks[-10:]}}
# which apps' logs Glass Box can see subagents and connectors in, so a picture never says "none" when it means "unknown"
# (QA run 4, finding 2): subagents come from Claude Code's and the Claude app's logs; connector uses only from Claude
# Code's logs (~/.claude/projects), since the Claude app and Codex record theirs elsewhere and Glass Box doesn't read them yet
out["seen"] = {"subagents": sorted({LA[a].get("tool") for a in LA if LA[a].get("tool")} | {"Claude Code"}), "connectors": ["Claude Code"]}
json.dump(out, open(os.path.join(DATA, "machine.json"), "w"))
print("machine:", len(out["periods"]) - 1, "weeks,", len(ports), "ports,", "plan samples" if plan else "no plan history", plan and plan["samples"])
