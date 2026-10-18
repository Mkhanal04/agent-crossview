#!/usr/bin/env python3
"""One data bundle for the app: weekly list price by piece of work and by tool, model mix, context vs answers
(all from the ledger, all three tools), limit hits, agents, skills. Counters only. Usage: python3 dashboard_data.py  (writes data/dashboard.json)"""
import json, glob, os, collections, datetime, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prices import split_usd
from paths import DATA, DEMO, codex_logs, log_lines, claude_logs, cowork_dir, files, session_of
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
# --fast: after a correction, reuse what was read from the logs last time and redo only what depends on the grouping
PREV_PATH = os.path.join(DATA, "dashboard.json")
FAST = DEMO or ("--fast" in sys.argv and os.path.exists(PREV_PATH))  # the demo never reads this Mac's logs
PREV = json.load(open(PREV_PATH)) if FAST and os.path.exists(PREV_PATH) else {}
rows = json.load(open(os.path.join(DATA, "sessions-grouped.json")))
inv = json.load(open(os.path.join(DATA, "inventory.json")))
# Log times are UTC; days and weeks are this Mac's own (Monday to Sunday, local time), as the app shows them.
def local_day(h): return datetime.datetime.fromisoformat(h[:13] + ":00:00+00:00").astimezone().date().isoformat()
def wk(d): d = datetime.date.fromisoformat(local_day(d) if "T" in d else d[:10]); return (d - datetime.timedelta(days=d.weekday())).isoformat()
L = json.load(open(os.path.join(DATA, "ledger.json")))
work_of = {r["id"]: r["work"] for r in rows}
# by week (the hour each reply ran, not the session's start), by model, by tool, and what the tokens were
weekly = collections.defaultdict(lambda: collections.Counter()); weekly_tool = collections.defaultdict(lambda: collections.Counter())
mcost = collections.Counter(); by_tool = collections.Counter(); est_tool = collections.Counter(); kinds = collections.Counter(); ranges = {}; usd_kinds = collections.Counter()
for x in L["rows"]:
    w = wk(x["hour"]); weekly[w][work_of.get(x["session"], "Not sure yet")] += x["usd"]; weekly_tool[w][x["tool"]] += x["usd"]
    mcost[x["model"]] += x["usd"]; by_tool[x["tool"]] += x["usd"]; est_tool[x["tool"]] += x.get("usd_est", 0)
    for k, v in split_usd(x["model"], x).items(): usd_kinds[k] += v
    kinds["re-reading context"] += x["cache_read"]; kinds["storing context"] += x["cache_write"]; kinds["answers"] += x["out"]; kinds["new input"] += x["fresh_in"]
    ld = local_day(x["hour"]); a = ranges.setdefault(x["tool"], [ld, ld]); a[0] = min(a[0], ld); a[1] = max(a[1], ld)
# limit hits from Claude Code logs
limit_hits = PREV.get("limit_hits", [])
for f in ([] if FAST else claude_logs()):
    for line in open(f, errors="ignore"):
        if "rate_limit" not in line: continue
        try: d = json.loads(line)
        except Exception: continue
        if d.get("error") == "rate_limit" and "/subagents/" not in f:
            q = d.get("quotaLimits") or {}
            limit_hits.append({"date": (d.get("timestamp") or "")[:10], "ts": (d.get("timestamp") or "")[:16], "kind": q.get("rateLimitType", "unknown"),
                               "session": os.path.basename(f)[:-6], "resets": q.get("resetsAt")})
# agent and skill runs this week (from Oct 5)
_t = datetime.date.today(); WEEK = (_t - datetime.timedelta(days=_t.weekday())).isoformat()
agent_week = collections.Counter(PREV.get("agent_week", {})); skill_week = collections.Counter(PREV.get("skill_week", {}))
for f in ([] if FAST else claude_logs() + claude_logs(helpers=True)):
    for line in open(f, errors="ignore"):
        if '"tool_use"' not in line: continue
        try: d = json.loads(line)
        except Exception: continue
        if (d.get("timestamp") or "") < WEEK: continue
        m = d.get("message")
        if d.get("type") != "assistant" or not isinstance(m, dict): continue
        for c in m.get("content") or []:
            if isinstance(c, dict) and c.get("type") == "tool_use":
                inp = c.get("input") or {}
                if c.get("name") in ("Agent", "Task"): agent_week[inp.get("subagent_type") or "general-purpose"] += 1
                if c.get("name") == "Skill": skill_week[(inp.get("skill") or "?").split(":")[-1]] += 1
# Limit events from all three tools: hits (stopped) and warnings (near the limit), one per limit window.
COWORK = cowork_dir()
events = {tuple(k): v for k, v in PREV.get("limit_raw", [])}
def ev(key, **kw):
    e = events.get(key)
    if e is None or kw.get("util", 0) > e.get("util", 0) or (kw["status"] == "hit" and e["status"] != "hit"): events[key] = {**(e or {}), **kw, "ts": min(kw["ts"], (e or kw)["ts"])}
for h in ([] if FAST else limit_hits):
    ev(("Claude", "hit", h.get("resets") or h["ts"], h["kind"]), tool="Claude Code", plan="Claude", status="hit", kind=h["kind"], ts=h["ts"], session=h.get("session"))
for f in ([] if FAST else files(COWORK + "/**/local_*/audit.jsonl")):
    sid = session_of(f)
    for line in open(f, errors="ignore"):
        if "rate_limit_event" not in line: continue
        try: d = json.loads(line)
        except Exception: continue
        i = d.get("rate_limit_info") or {}
        st = {"rejected": "hit", "allowed_warning": "warning"}.get(i.get("status"))
        if not st: continue
        kind = (i.get("rateLimitType") or "unknown").replace("_overage_included", "")
        ev(("Claude", st, i.get("resetsAt"), kind), tool="Cowork", plan="Claude", status=st, kind=kind, ts=(d.get("timestamp") or "")[:16], session=sid, util=round((i.get("utilization") or 0) * 100))
for f in ([] if FAST else codex_logs()):
    sid = None
    for line in log_lines(f):
        if '"session_meta"' in line:
            try: sid = json.loads(line)["payload"].get("id")
            except Exception: pass
        if "rate_limits" not in line: continue
        try: d = json.loads(line)
        except Exception: continue
        rl = (d.get("payload") or {}).get("rate_limits") or {}
        for win, kind in (("primary", "five_hour"), ("secondary", "seven_day")):
            w = rl.get(win) or {}; u = w.get("used_percent") or 0
            if u >= 75: ev(("Codex", "hit" if u >= 100 else "warning", w.get("resets_at"), kind), tool="Codex", plan="ChatGPT", status="hit" if u >= 100 else "warning", kind=kind, ts=(d.get("timestamp") or "")[:16], session=sid, util=round(u))
# what was running in the window before each event: Claude limits are shared by Claude Code and Cowork; Codex has its own
by_hour = collections.defaultdict(collections.Counter)
for x in L["rows"]: by_hour[("Codex" if x["tool"] == "Codex" else "Claude", x["hour"])][work_of.get(x["session"], "Not sure yet")] += x["usd"]
def running(plan, ts, kind):
    end = datetime.datetime.fromisoformat(ts[:13] + ":00"); hours = 5 if kind == "five_hour" else 168
    c = collections.Counter()
    for k in range(hours + 1): c.update(by_hour.get(("Codex" if plan == "ChatGPT" else "Claude", (end - datetime.timedelta(hours=k)).isoformat()[:13]), {}))
    tot = sum(c.values()) or 1
    return [{"work": w, "share": round(100 * v / tot), "usd": round(v, 2)} for w, v in c.most_common(4) if v > 0]
limit_events, last_hit = [], {}
for e in sorted([e for e in events.values() if e.get("ts")], key=lambda e: e["ts"]):
    if e["status"] == "hit":  # older logs give no reset time: repeated hits within five hours are one limit window
        prev = last_hit.get(e["plan"])
        t = datetime.datetime.fromisoformat(e["ts"])
        if prev and e["kind"] == "unknown" and t - datetime.datetime.fromisoformat(prev["ts"]) < datetime.timedelta(hours=5):
            prev["repeats"] = prev.get("repeats", 1) + 1; continue
    limit_events.append({**e, "running": running(e["plan"], e["ts"], e["kind"])})
    if e["status"] == "hit": last_hit[e["plan"]] = limit_events[-1]

work = collections.defaultdict(lambda: {"sessions": 0, "usd": 0.0, "helpers": 0, "last": ""})
for r in rows:
    w = work[r["work"]]; w["sessions"] += 1; w["usd"] += r.get("list_price_usd") or 0; w["helpers"] += r.get("helpers") or 0
    w["last"] = max(w["last"], str(r["end"] or r["start"])[:10])
out = {"built": datetime.datetime.now().isoformat(timespec="minutes"),
       "weekly": {k: {w: round(u, 4) for w, u in v.items()} for k, v in sorted(weekly.items())}, "weekly_tool": {k: {w: round(u, 4) for w, u in v.items()} for k, v in sorted(weekly_tool.items())},
       "model_cost": {k: round(v, 2) for k, v in mcost.most_common()}, "token_kinds": dict(kinds), "usd_kinds": {k: round(v, 2) for k, v in usd_kinds.items()}, "limit_hits": limit_hits, "limit_events": limit_events, "limit_raw": [[list(k), v] for k, v in events.items()],
       "by_tool": {k: round(v, 2) for k, v in by_tool.items()}, "est_tool": {k: round(v, 2) for k, v in est_tool.items()}, "ranges": ranges,
       "checks": L["checks"], "per_partial": L["per_partial_reply"], "prices_checked": L["prices_checked"], "price_sources": L["price_sources"],
       "unpriced": L["unpriced_models"],
       "work": {k: dict(v, usd=round(v["usd"], 2)) for k, v in work.items()}, "sessions": len(rows), "tools": dict(collections.Counter(r["tool"] for r in rows)),
       "skills": [{"name": s["name"], "where": s["where"], "plugin": s.get("plugin"), "calls": s["calls"], "last": s.get("last_used")} for s in inv["skills"]],
       "agents": [{"name": a["name"], "where": a["where"], "calls": a["calls"], "last": a.get("last_used")} for a in inv["agents"]],
       "agent_week": dict(agent_week.most_common()), "skill_week": dict(skill_week.most_common()), "connectors": inv["connectors"], "instruction_files": len(inv["instruction_files"])}
json.dump(out, open(os.path.join(DATA, "dashboard.json"), "w"), indent=1)
print("dashboard:", {k: round(v) for k, v in by_tool.items()}, "| weeks", len(weekly), "| limit hits", len(limit_hits),
      "| limit events", collections.Counter((e["tool"], e["status"]) for e in limit_events))
