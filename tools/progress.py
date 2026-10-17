#!/usr/bin/env python3
"""Reads TASKS.md and writes app/progress.js for the Progress page. Fast: no logs are read.
What this build has used comes from data/sessions-grouped.json (the piece of work "Agent Glass Box").
Usage: python3 progress.py"""
import json, os, re, datetime
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
TP = os.path.join(ROOT, "TASKS.md")  # the build's own task list; a shared copy may not have one
text = open(TP).read() if os.path.exists(TP) else ""

tasks, lists, cur = [], {}, None
for line in text.splitlines():
    m = re.match(r"^## (\d+)\. (.+)", line)
    if m:
        cur = {"n": int(m.group(1)), "name": m.group(2).strip(), "steps": []}; tasks.append(cur); continue
    m = re.match(r"^## (.+)", line)
    if m:
        cur = None; lists[m.group(1).strip()] = []; last_list = m.group(1).strip(); continue
    if cur is not None:
        m = re.match(r"^- \[( |x)\] (.+)", line)
        if m: cur["steps"].append({"done": m.group(1) == "x", "text": m.group(2).strip()}); continue
        m = re.match(r"^(Status|Estimate|Started|Finished|Why|Notes): ?(.*)", line)
        if m: cur[m.group(1).lower()] = m.group(2).strip()
    elif lists and line.startswith("- "):
        lists[last_list].append(line[2:].strip())

def minutes(a, b):
    try:
        f = lambda x: datetime.datetime.strptime(x.strip() + " 2026", "%a %b %d, %I:%M %p %Y")
        return max(1, round((f(b) - f(a)).total_seconds() / 60))
    except Exception: return None
for t in tasks:
    t["took"] = minutes(t["started"], t["finished"]) if t.get("started") and t.get("finished") else None

build = None
p = os.path.join(ROOT, "data", "sessions-grouped.json")
if os.path.exists(p):
    rows = [r for r in json.load(open(p)) if r.get("work") == "Agent Glass Box"]
    usd = [r.get("list_price_usd") for r in rows if r.get("list_price_usd") is not None]
    build = {"sessions": len(rows), "helpers": sum(r.get("helpers") or 0 for r in rows),
             "usd": round(sum(usd), 2) if usd else None, "usd_sessions": len(usd), "priced": any("usd_est" in r for r in rows),
             "first": min((str(r["start"])[:10] for r in rows), default=None)}

out = {"read": datetime.datetime.now().strftime("%a %b %-d, %-I:%M %p"), "tasks": tasks, "waiting": lists.get("Waiting on Milan", []),
       "after": lists.get("After the test", []), "build": build}
open(os.path.join(ROOT, "app", "progress.js"), "w").write("window.GB_PROGRESS = " + json.dumps(out) + ";\n")
print("app/progress.js:", len(tasks), "tasks,", sum(1 for t in tasks if t.get("status") == "done"), "done")
