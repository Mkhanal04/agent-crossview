#!/usr/bin/env python3
"""Refresh everything from the logs on this Mac, in order. Usage: python3 tools/refresh.py
Each step reads counters only; nothing leaves the computer."""
import subprocess, sys, os, time
T = os.path.dirname(os.path.abspath(__file__))
STEPS = [
    ("Reading and pricing every reply", ["ledger.py"]),
    ("Listing sessions", ["sessions.py", "data/sessions.json"]),
    ("Grouping sessions into pieces of work", ["group.py", "data/sessions.json", "data/sessions-grouped.json"]),
    ("Taking stock of skills, agents and instructions", ["inventory.py", "data/inventory.json"]),
    ("Weeks, models and usage limits", ["dashboard_data.py"]),
    ("Which agents and connectors each piece of work used", ["machine_data.py"]),
    ("What you paid: plans and any API bills you added", ["bills.py"]),
    ("The anatomy of each tool on this Mac", ["anatomy_data.py"]),
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
