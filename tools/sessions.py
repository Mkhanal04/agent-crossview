#!/usr/bin/env python3
"""List sessions from Claude Code, Cowork and Codex: tool, date, title, folder, and list price from the ledger (run ledger.py first).
Reads titles and counters only, never prompt or reply text. Usage: python3 sessions.py out.json"""
import json, glob, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import codex_logs, log_lines
H = os.path.expanduser("~")
rows = []
# Claude Code
for f in glob.glob(H + "/.claude/projects/*/*.jsonl"):
    sid = os.path.basename(f)[:-6]; title = None; first = last = None; cwd = None; cost = None
    for line in open(f, errors="ignore"):
        try: d = json.loads(line)
        except Exception: continue
        if d.get("customTitle"): title = d["customTitle"]
        elif d.get("agentName") and not title: title = d["agentName"]
        ts = d.get("timestamp")
        if ts: first = min(filter(None, [first, ts])); last = max(filter(None, [last, ts]))
        if d.get("cwd") and not cwd: cwd = d["cwd"]
        if d.get("type") == "cost-state":
            c = d.get("totalCostUSD") or 0
            if cost is None or c >= cost: cost = c
    subs = len(glob.glob(f[:-6] + "/subagents/*.jsonl"))
    rows.append({"tool": "Claude Code", "id": sid, "start": first, "end": last, "title": title, "folder": cwd, "list_price_usd": cost, "helpers": subs})
# Cowork
for f in glob.glob(H + "/Library/Application Support/Claude/local-agent-mode-sessions/**/local_*.json", recursive=True):
    try: d = json.load(open(f))
    except Exception: continue
    rows.append({"tool": "Cowork", "id": d.get("sessionId"), "start": d.get("createdAt"), "end": d.get("lastActivityAt"), "title": d.get("title") or d.get("name"), "folder": d.get("cwd"), "model": d.get("model"), "list_price_usd": None, "helpers": None})
# Codex
names = {}
idx = H + "/.codex/session_index.jsonl"
if os.path.exists(idx):
    for line in open(idx):
        try: d = json.loads(line); names[d["id"]] = d.get("thread_name")
        except Exception: pass
for f in codex_logs():
    sid = None; first = last = None; cwd = None
    for line in log_lines(f):
        try: d = json.loads(line)
        except Exception: continue
        ts = d.get("timestamp")
        if ts: first = min(filter(None, [first, ts])); last = max(filter(None, [last, ts]))
        p = d.get("payload") if isinstance(d.get("payload"), dict) else {}
        if d.get("type") == "session_meta": sid = p.get("id"); cwd = cwd or p.get("cwd")
        if d.get("type") == "turn_context" and not cwd: cwd = p.get("cwd")
    rows.append({"tool": "Codex", "id": sid, "start": first, "end": last, "title": names.get(sid), "folder": cwd, "list_price_usd": None, "helpers": None})
for r in rows:
    if isinstance(r["start"], (int, float)): r["start"] = __import__("datetime").datetime.utcfromtimestamp(r["start"] / (1000 if r["start"] > 1e12 else 1)).isoformat()
    if isinstance(r["end"], (int, float)): r["end"] = __import__("datetime").datetime.utcfromtimestamp(r["end"] / (1000 if r["end"] > 1e12 else 1)).isoformat()
# Cost comes from the ledger (every reply priced from tokens, all three tools). Claude Code's own figure is kept for checking.
lp = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "ledger.json")
if os.path.exists(lp):
    L = json.load(open(lp))["sessions"]
    for r in rows:
        r["tool_recorded_usd"] = r.get("list_price_usd")
        s = L.get(r["id"])
        r["list_price_usd"] = s["usd"] if s else None
        r["usd_est"] = s["usd_est"] if s else 0
        if s and r["tool"] != "Codex": r["helpers"] = s["helpers"]
# sessions whose logs were deleted since the last refresh stay on the list, marked "kept" (see ledger.py)
if os.path.exists(sys.argv[1]):
    try: old = json.load(open(sys.argv[1]))
    except Exception: old = []
    have = {r["id"] for r in rows}
    rows += [dict(r, kept=True) for r in old if r.get("id") and r["id"] not in have]
json.dump(sorted(rows, key=lambda r: str(r["start"])), open(sys.argv[1], "w"), indent=1)
print(len(rows), "sessions:", {t: sum(1 for r in rows if r["tool"] == t) for t in ("Claude Code", "Cowork", "Codex")})
