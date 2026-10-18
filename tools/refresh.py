#!/usr/bin/env python3
"""Refresh everything from the logs on this computer, in order. Usage: python3 tools/refresh.py
Each step reads counters only; nothing leaves the computer."""
import subprocess, sys, os, time
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
t0 = time.time()
for label, cmd in STEPS:
    print(f"- {label}...", flush=True)
    r = subprocess.run([sys.executable, os.path.join(T, cmd[0])] + cmd[1:], cwd=os.path.join(T, ".."), capture_output=True, text=True)
    if r.returncode and "(optional)" in label:
        print("  skipped: nothing to write it from yet"); continue
    if r.returncode:
        print(r.stdout[-2000:], r.stderr[-2000:]); sys.exit(f"Stopped at: {label}")
print(f"Done in {time.time() - t0:.0f} seconds.")
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
