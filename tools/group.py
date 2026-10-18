#!/usr/bin/env python3
"""First-pass grouping of sessions into pieces of work, from titles, folders and dates only.
Milan corrects the result; corrections go in work-overrides.json (session id -> piece of work, or
{"work": ..., "by": "Claude's correction", "why": ...} when Claude made the call and he should check it).
Usage: python3 group.py sessions.json out.json"""
import json, re, sys, os
rows = json.load(open(sys.argv[1]))
overrides_path = os.path.join(os.path.dirname(__file__), "..", "data", "work-overrides.json")
overrides = json.load(open(overrides_path)) if os.path.exists(overrides_path) else {}
# Day-job and personal keywords live in data/private-patterns.json, which is never committed.
private_path = os.path.join(os.path.dirname(__file__), "..", "data", "private-patterns.json")
PRIVATE = json.load(open(private_path)) if os.path.exists(private_path) else {}

# Day-job and personal keywords live in data/private-patterns.json; your own grouping rules live in data/work-rules.json.
# Both stay on this Mac and are never committed. Without a rules file (a fresh copy), chats group by the project folder they ran in.
RULES_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "work-rules.json")
WR = json.load(open(RULES_FILE)) if os.path.exists(RULES_FILE) else {}
RULES = [(n, PRIVATE[k]) for n, k in (("Day job", "day_job"), ("Personal", "personal")) if PRIVATE.get(k)] + [tuple(r) for r in WR.get("rules", [])]
CODEX_RULES = [tuple(r) for r in WR.get("codex_folder_rules", [])]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from roots import _top, H as HOME
from paths import under, same
def by_folder(f):
    """A chat's piece of work from the project folder it ran in, for anyone without their own rules."""
    if not f or not under(f, HOME) or "/Library/" in f or "/AppData/" in f: return None
    top = _top(f)
    return None if any(same(top, x) for x in (HOME, HOME + "/Desktop", HOME + "/Documents")) else os.path.basename(top)

def piece(r):
    o = overrides.get(r.get("id"))
    if isinstance(o, str): return o, "your correction"
    if isinstance(o, dict): return o["work"], o.get("by", "your correction")
    text = (r.get("title") or "") + " | " + (r.get("folder") or "")
    for name, pat in RULES:
        if re.search(pat, text): return name, "title or folder"
    f = r.get("folder") or ""
    for name, pat, tool in CODEX_RULES:
        if r["tool"] == tool and pat in f: return name, "folder only"
    if not WR and by_folder(f): return by_folder(f), "folder only"
    if r["tool"] == "Codex": return "Codex chats with no project", "folder only"
    if not r.get("title"): return "Untitled", "none"
    return WR.get("fallback", "Not sure yet"), "none"
out = []
for r in rows:
    p, basis = piece(r)
    out.append({**r, "work": p, "grouped_by": basis})
json.dump(out, open(sys.argv[2], "w"), indent=1)
