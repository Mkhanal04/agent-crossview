#!/usr/bin/env python3
"""Refresh everything from the logs on this computer, in order. Usage: python3 tools/refresh.py [--progress <file>]
Each step reads counters only; nothing leaves the computer. With --progress, it also writes what it's doing and what it
found to a small file, in plain sentences, so the page can show the scan as it happens (the first open, Oct 18)."""
import subprocess, sys, os, time, json, datetime
if os.name == "nt" and not sys.flags.utf8_mode:  # Windows: read and write every file as UTF-8, as on a Mac
    os.environ["PYTHONUTF8"] = "1"
    sys.exit(subprocess.call([sys.executable] + sys.argv))
T = os.path.dirname(os.path.abspath(__file__))
STEPS = [
    ("Reading and pricing every reply", ["ledger.py"]),
    ("Listing sessions", ["sessions.py", "data/sessions.json"]),
    ("Grouping sessions into pieces of work", ["group.py", "data/sessions.json", "data/sessions-grouped.json"]),
    ("Taking stock of skills, agents and instructions", ["inventory.py", "data/inventory.json"]),
    ("Weeks, models and usage limits", ["dashboard_data.py"]),
    ("Which agents and connectors each piece of work used", ["machine_data.py"]),
    ("What stopped a run to ask: counts only", ["runstops.py"]),
    ("What you paid: plans and any API bills you added", ["bills.py"]),
    ("How each app is set up on this computer", ["anatomy_data.py"]),
    ("Signs of paid services outside your plans", ["other_costs.py"]),
    ("Your AI's instructions: rule files and notes", ["instructions.py"]),
    ("What you keep correcting: counts only, and only if you said yes", ["corrections.py"]),
    ("Building the app's data", ["build_app.py"]),
    ("Reading the task list", ["progress.py"]),
    ("Writing the test answer key (optional)", ["answer_key.py"]),
    ("Rebuilding the demo company (made-up data, dated to this week)", ["demo_company.py"]),
]
os.makedirs(os.path.join(T, "..", "data"), exist_ok=True)  # a fresh copy has no data folder yet
PROG = sys.argv[sys.argv.index("--progress") + 1] if "--progress" in sys.argv else None
state = {"started": datetime.datetime.now().isoformat(timespec="seconds"), "now": None, "step": 0, "of": len(STEPS), "found": [], "apps": {}, "done": False, "error": None}
def tell(**kw):
    """The page's view of the scan: written whole each time, so it's never read half-written."""
    if not PROG: return
    state.update(kw); tmp = PROG + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f: json.dump(state, f)
    os.replace(tmp, PROG)
def plural(n, w): return f"{n:,} {w}{'' if n == 1 else 's'}"
def found_apps():
    """What the records hold for each app, in plain sentences, once the chats are listed."""
    sys.path.insert(0, T)
    from paths import where_looked, HOME
    try: rows = json.load(open(os.path.join(T, "..", "data", "sessions.json"), encoding="utf-8"))
    except Exception: rows = []
    today = datetime.date.today(); monday = (today - datetime.timedelta(days=today.weekday())).isoformat()
    looked, lines, apps = where_looked(), [], {}
    when = lambda d: datetime.date.fromisoformat(d).strftime("%b ") + str(int(d[8:10]))
    for app, noun in (("Claude Code", "chat"), ("Cowork", "task"), ("Codex", "chat")):
        mine = [r for r in rows if r.get("tool") == app]
        firsts = sorted(str(r.get("start"))[:10] for r in mine if r.get("start"))
        week = sum(1 for r in mine if str(r.get("start") or "")[:10] >= monday)
        apps[app] = {"found": bool(mine or looked[app]["found"]), "count": len(mine), "week": week}
        if mine: lines.append(f"Found {app}{', inside the Claude app' if app == 'Cowork' else ''}: {plural(len(mine), noun)} kept since {when(firsts[0])}, {week if week else 'none'} this week.")
        elif looked[app]["found"]: lines.append(f"Found {app}, with no {noun}s kept on this computer.")
        else: lines.append(f"Didn't find {app} on this computer.")
    lines.append("Can't see: chats on the Claude and ChatGPT websites, or on your phone.")
    return lines, apps
def found_setup():
    return ["Read how each app is set up: its rule files, skills, subagents and connectors."]
# what each step is doing, in words for the page (the labels above are for this window)
WORDS = {"ledger.py": "Reading every reply and pricing it at published rates", "sessions.py": "Listing your chats", "group.py": "Sorting your chats into projects",
         "inventory.py": "Reading your skills, subagents and rule files", "dashboard_data.py": "Counting your weeks and limits", "machine_data.py": "Seeing what each project used", "runstops.py": "Counting what stopped a run to ask",
         "bills.py": "Reading your plans", "anatomy_data.py": "Reading how each app is set up", "other_costs.py": "Looking for paid services outside your plans",
         "instructions.py": "Reading your rule files and Claude's notes", "corrections.py": "Counting corrections, if you said yes", "build_app.py": "Putting the page together"}
def quick_found():
    """Before the slow reading starts: which apps are here, by counting their files (no reading yet)."""
    sys.path.insert(0, T)
    from paths import where_looked, claude_logs, codex_logs, cowork_dir, files
    looked, out = where_looked(), []
    n = {"Claude Code": len(claude_logs()), "Codex": len(codex_logs()), "Cowork": len(files(cowork_dir() + "/**/local_*.json"))}
    for app, noun in (("Claude Code", "chat"), ("Cowork", "task"), ("Codex", "chat")):
        if n[app]: out.append(f"Found {app}{', inside the Claude app' if app == 'Cowork' else ''}: {plural(n[app], noun)} to read.")
        elif not looked[app]["found"]: out.append(f"Didn't find {app} on this computer.")
    return out, {a: {"found": bool(n[a] or looked[a]["found"]), "count": n[a]} for a in n}
t0 = time.time()
try: _q, _a = quick_found(); tell(now="Looking for your AI apps", found=_q, apps=_a)
except Exception: tell(now="Looking for your AI apps")
for i, (label, cmd) in enumerate(STEPS):
    tell(now=WORDS.get(cmd[0], "Finishing up"), step=i)
    print(f"- {label}...", flush=True)
    r = subprocess.run([sys.executable, os.path.join(T, cmd[0])] + cmd[1:], cwd=os.path.join(T, ".."), capture_output=True, text=True)
    if r.returncode and "(optional)" in label:
        print("  skipped: nothing to write it from yet"); continue
    if r.returncode:
        tell(error=f"Stopped at: {label}", done=True)
        print(r.stdout[-2000:], r.stderr[-2000:]); sys.exit(f"Stopped at: {label}")
    if cmd[0] == "sessions.py":
        lines, apps = found_apps(); tell(found=lines, apps=apps)
    if cmd[0] == "inventory.py": tell(found=state["found"] + found_setup())
print(f"Done in {time.time() - t0:.0f} seconds.")
tell(now=None, step=len(STEPS), done=True)
# say plainly which apps' records were found, and where it looked for the ones it couldn't find
sys.path.insert(0, T)
from paths import where_looked, HOME
short = lambda p: p.replace(HOME, "~", 1)
for app, w in where_looked().items():
    if app == "Company settings":
        if w["found"]: print(f"- Settings your company manages for Claude Code: found in {short(w['found'])}.")
        continue
    if w["found"]: print(f"- {app}: records found in {short(w['found'])}.")
    else: print(f"- {app}: no records found. Looked in {' and '.join(short(p) for p in w['looked'])}.")
    if w.get("compressed_unread"): print(f"  {w['compressed_unread']} older Codex chats are compressed and couldn't be read. The README says how to read them.")
