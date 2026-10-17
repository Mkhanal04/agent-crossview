#!/usr/bin/env python3
"""One ledger of every reply from Claude Code, Cowork and Codex on this Mac, priced from tokens the same way
for all three (prices.py). Reads token counters, model names and helper-agent labels only, never prompt or reply text.
Rows are summed by tool, session, agent, model and hour. Usage: python3 ledger.py  (writes data/ledger.json)"""
import json, glob, os, collections, datetime
from paths import codex_logs, log_lines
from prices import claude_cost, openai_cost, base_model, CHECKED, SOURCES, CLAUDE

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
H = os.path.expanduser("~")
COWORK = H + "/Library/Application Support/Claude/local-agent-mode-sessions"

rows = collections.defaultdict(lambda: {"replies": 0, "partial": 0, "fresh_in": 0, "cache_write": 0, "cache_read": 0, "out": 0, "usd": 0.0, "priced": True})
agents = {}  # helper agent id -> who it was and what it was asked to do
seen = set()
unpriced = collections.Counter()


def add(tool, session, agent, model, ts, fresh, write, read, out, usd, priced, partial=False):
    r = rows[(tool, session, agent, model, ts[:13])]
    r["replies"] += 1; r["partial"] += partial; r["fresh_in"] += fresh; r["cache_write"] += write; r["cache_read"] += read; r["out"] += out; r["usd"] += usd
    if not priced: r["priced"] = False; unpriced[model] += fresh + write + read + out


def read_claude_log(path, tool, session, agent):
    """Each reply is written as several lines. Helper-agent logs often keep only the first line's counters, so the
    reply's written-token count (output) is too low; those replies are marked "partial" and estimated later."""
    msgs = {}
    for line in open(path, errors="ignore"):
        if '"usage"' not in line: continue
        try: d = json.loads(line)
        except Exception: continue
        m = d.get("message")
        if d.get("type") != "assistant" or not isinstance(m, dict) or not m.get("usage"): continue
        if (m.get("model") or "") == "<synthetic>": continue
        key = (m.get("id"), d.get("requestId"))
        u, prev = m["usage"], msgs.get(key)
        done = m.get("stop_reason") is not None
        if prev is None or (u.get("output_tokens") or 0) >= (prev[0].get("output_tokens") or 0):
            msgs[key] = (u, m.get("model") or "unknown", d.get("timestamp") or "", done or (prev[3] if prev else False))
        elif done:
            msgs[key] = (prev[0], prev[1], prev[2], True)
    for key, (u, model, ts, done) in msgs.items():
        if key in seen: continue
        seen.add(key)
        usd, priced = claude_cost(model, u)
        add(tool, session, agent, base_model(model), ts, u.get("input_tokens") or 0, u.get("cache_creation_input_tokens") or 0,
            u.get("cache_read_input_tokens") or 0, u.get("output_tokens") or 0, usd, priced, partial=not done)


def helper(path, tool, session):
    aid = os.path.basename(path)[6:-6]  # agent-<id>.jsonl
    meta = {}
    try: meta = json.load(open(path[:-6] + ".meta.json"))
    except Exception: pass
    agents[aid] = {"tool": tool, "session": session, "type": meta.get("agentType") or "general-purpose", "task": (meta.get("description") or "")[:120]}
    return aid


# Claude Code: main sessions, then their helper agents
for f in glob.glob(H + "/.claude/projects/*/*.jsonl"):
    read_claude_log(f, "Claude Code", os.path.basename(f)[:-6], "main")
for f in glob.glob(H + "/.claude/projects/*/*/subagents/agent-*.jsonl"):
    sid = f.split("/subagents/")[0].rsplit("/", 1)[1]
    read_claude_log(f, "Claude Code", sid, helper(f, "Claude Code", sid))

# Cowork: each task keeps a Claude Code style log inside its own folder
for f in glob.glob(COWORK + "/**/local_*/.claude/projects/*/*.jsonl", recursive=True):
    sid = "local_" + f.split("/local_")[1].split("/")[0]
    read_claude_log(f, "Cowork", sid, "main")
for f in glob.glob(COWORK + "/**/local_*/.claude/projects/*/*/subagents/agent-*.jsonl", recursive=True):
    sid = "local_" + f.split("/local_")[1].split("/")[0]
    read_claude_log(f, "Cowork", sid, helper(f, "Cowork", sid))

# Codex: one usage record per reply; the model comes from the turn's settings
for f in codex_logs():
    sid, model, turn_model, fallback = None, "unknown", {}, []
    has_records = False
    for line in log_lines(f):
        try: d = json.loads(line)
        except Exception: continue
        p = d.get("payload") if isinstance(d.get("payload"), dict) else {}
        t = d.get("type")
        if t == "session_meta": sid = p.get("id") or sid
        elif t == "turn_context":
            model = p.get("model") or model
            if p.get("turn_id"): turn_model[p["turn_id"]] = model
        elif t == "token_usage_record":
            has_records = True
            rid = p.get("response_id") or (f, d.get("ordinal"))
            if ("codex", rid) in seen: continue
            seen.add(("codex", rid))
            u = p.get("usage") or {}
            mdl = turn_model.get(p.get("turn_id"), model)
            usd, priced = openai_cost(mdl, u)
            inp, cached, write = u.get("input_tokens") or 0, u.get("cached_input_tokens") or 0, u.get("cache_write_input_tokens") or 0
            add("Codex", sid or p.get("session_id"), "main", mdl, d.get("timestamp") or "", max(0, inp - cached - write), write, cached, u.get("output_tokens") or 0, usd, priced)
        elif t == "event_msg" and p.get("type") == "token_count" and (p.get("info") or {}).get("last_token_usage"):
            fallback.append((d.get("timestamp") or "", model, p["info"]["last_token_usage"]))
    if not has_records:  # older files: per-turn counters only
        for ts, mdl, u in fallback:
            usd, priced = openai_cost(mdl, u)
            inp, cached = u.get("input_tokens") or 0, u.get("cached_input_tokens") or 0
            add("Codex", sid, "main", mdl, ts, max(0, inp - cached), 0, cached, u.get("output_tokens") or 0, usd, priced)

# What the tools recorded themselves, used to check our count and to estimate helper writing the logs dropped.
recorded = {}  # session -> {model: {"read", "out", "usd"}}, plus a total
for f in glob.glob(H + "/.claude/projects/*/*.jsonl"):
    best = None
    for line in open(f, errors="ignore"):
        if '"cost-state"' not in line: continue
        try: d = json.loads(line)
        except Exception: continue
        if d.get("type") == "cost-state" and (best is None or (d.get("totalCostUSD") or 0) >= (best.get("totalCostUSD") or 0)): best = d
    if best:
        recorded[os.path.basename(f)[:-6]] = ("Claude Code", {base_model(m): {"read": u.get("cacheReadInputTokens", 0), "out": u.get("outputTokens", 0), "usd": u.get("costUSD", 0)} for m, u in (best.get("modelUsage") or {}).items()})
for f in glob.glob(COWORK + "/**/local_*/audit.jsonl", recursive=True):  # one result per turn; not running totals
    mu = collections.defaultdict(lambda: {"read": 0, "out": 0, "usd": 0.0})
    for line in open(f, errors="ignore"):
        if '"result"' not in line: continue
        try: d = json.loads(line)
        except Exception: continue
        if d.get("type") != "result": continue
        for m, u in (d.get("modelUsage") or {}).items():
            x = mu[base_model(m)]; x["read"] += u.get("cacheReadInputTokens", 0); x["out"] += u.get("outputTokens", 0); x["usd"] += u.get("costUSD", 0)
    if mu: recorded["local_" + f.split("/local_")[1].split("/")[0]] = ("Cowork", dict(mu))

ours = collections.defaultdict(lambda: {"read": 0, "out": 0, "partial": 0, "usd": 0.0})
for k, v in rows.items():
    x = ours[(k[1], k[3])]; x["read"] += v["cache_read"]; x["out"] += v["out"]; x["partial"] += v["partial"]; x["usd"] += v["usd"]

# Estimate per partial reply, by model: pooled over sessions whose recorded totals cover the same replies we see
# (re-read tokens within 15% of each other), so the gap is the dropped writing, not missing replies.
pool = collections.defaultdict(lambda: [0, 0])
for sid, (tool, mu) in recorded.items():
    for m, r in mu.items():
        o = ours.get((sid, m))
        if o and o["partial"] and r["read"] and 0.85 <= o["read"] / r["read"] <= 1.05:
            pool[m][0] += max(0, r["out"] - o["out"]); pool[m][1] += o["partial"]
DEFAULT_PER_PARTIAL = 1000
per_partial = {m: round(a / b) for m, (a, b) in pool.items() if b >= 20}
for k, v in rows.items():
    v["usd_est"] = 0.0
    if v["partial"] and k[3] in CLAUDE:
        v["usd_est"] = v["partial"] * per_partial.get(k[3], DEFAULT_PER_PARTIAL) * CLAUDE[k[3]][4] / 1e6
        v["usd"] += v["usd_est"]

# The check: our count against the tools' own, on sessions where both cover the same replies.
checks = {}
for tool in ("Claude Code", "Cowork"):
    n, theirs, mine, all_theirs = 0, 0.0, 0.0, 0.0
    for sid, (t, mu) in recorded.items():
        if t != tool: continue
        all_theirs += sum(r["usd"] for r in mu.values())
        rr = sum(r["read"] for r in mu.values()); oo = sum(ours[(sid, m)]["read"] for m in mu if (sid, m) in ours)
        if rr and 0.85 <= oo / rr <= 1.05:
            n += 1; theirs += sum(r["usd"] for r in mu.values())
            mine += sum(v["usd"] for k, v in rows.items() if k[1] == sid)
    checks[tool] = {"sessions": n, "theirs": round(theirs, 2), "ours": round(mine, 2), "recorded_sessions": sum(1 for t, _ in recorded.values() if t == tool)}

out_rows = [{"tool": k[0], "session": k[1], "agent": k[2], "model": k[3], "hour": k[4], **{a: (round(b, 4) if a in ("usd", "usd_est") else b) for a, b in v.items()}} for k, v in rows.items()]
# Claude Code deletes a chat's log about 30 days after it was last touched (cleanupPeriodDays). What Glass Box already
# counted stays: rows for sessions whose logs are gone are carried over from the last ledger, marked "kept".
LEDGER = os.path.join(ROOT, "data/ledger.json")
os.makedirs(os.path.dirname(LEDGER), exist_ok=True)
kept_sessions = 0
if os.path.exists(LEDGER):
    try: old = json.load(open(LEDGER))
    except Exception: old = None
    if old:
        now_sessions = {r["session"] for r in out_rows}
        gone = {r["session"] for r in old.get("rows", []) if r["session"] not in now_sessions}
        kept_sessions = len(gone)
        out_rows += [dict(r, kept=True) for r in old["rows"] if r["session"] in gone]
        for aid, a in (old.get("agents") or {}).items():
            if aid not in agents and a.get("session") in gone: agents[aid] = a
sessions = collections.defaultdict(lambda: {"usd": 0.0, "usd_est": 0.0, "replies": 0, "helpers": set(), "first": "9", "last": "0", "unpriced_replies": 0})
for r in out_rows:
    s = sessions[r["session"]]; s["usd"] += r["usd"]; s["usd_est"] += r["usd_est"]; s["replies"] += r["replies"]
    if r["agent"] != "main": s["helpers"].add(r["agent"])
    s["first"] = min(s["first"], r["hour"]); s["last"] = max(s["last"], r["hour"])
    if not r["priced"]: s["unpriced_replies"] += r["replies"]
sessions = {k: {**v, "usd": round(v["usd"], 2), "usd_est": round(v["usd_est"], 2), "helpers": len(v["helpers"])} for k, v in sessions.items()}
by_tool = collections.Counter(); by_tool_n = collections.Counter(); by_tool_est = collections.Counter()
for r in out_rows: by_tool[r["tool"]] += r["usd"]; by_tool_n[r["tool"]] += r["replies"]; by_tool_est[r["tool"]] += r["usd_est"]
json.dump({"built": datetime.datetime.now().isoformat(timespec="minutes"), "prices_checked": CHECKED, "price_sources": SOURCES,
           "per_partial_reply": per_partial, "default_per_partial": DEFAULT_PER_PARTIAL, "checks": checks,
           "rows": out_rows, "agents": agents, "sessions": sessions, "unpriced_models": dict(unpriced)},
          open(LEDGER, "w"))
print("ledger:", len(out_rows), "rows,", len(agents), "helper agents,", len(sessions), "sessions", f"({kept_sessions} kept after their logs were deleted)" if kept_sessions else "")
for t in by_tool: print(f"  {t}: {by_tool_n[t]} replies, ${by_tool[t]:,.0f} at list price (${by_tool_est[t]:,.0f} of it estimated helper writing)")
print("  written tokens per partial helper reply:", per_partial)
for t, c in checks.items(): print(f"  check {t}: {c['sessions']} of {c['recorded_sessions']} sessions comparable; theirs ${c['theirs']:,.0f}, ours ${c['ours']:,.0f}")
if unpriced: print("  no published price for:", dict(unpriced))
