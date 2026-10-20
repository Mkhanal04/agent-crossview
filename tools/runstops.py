#!/usr/bin/env python3
"""What stops an unattended run (release 3 slice 2, the before-reset card): per week, from Claude Code's records on this
computer, how chats ran (the permission mode each message was sent in) and how often a step was blocked or turned down,
by tool. Counts only: no message text, no tool input or output, no file or project names leave this script.

A step counts as blocked when Claude Code's own result for it says the step was blocked or needs approval, and as turned
down when it says you didn't want to go ahead. Writes data/runstops.json."""
import collections, datetime, glob, json, os, re
from paths import DATA, claude_logs

BLOCK = re.compile(r"was blocked|requires approval|permission to use", re.I)
DECLINE = re.compile(r"doesn't want to proceed|didn't want to proceed", re.I)
MODE = re.compile(r'"permissionMode":"([a-zA-Z]+)"')


def local_day(ts):
    """The record's day on this computer's clock (records are stamped in UTC; Codex's audit, Oct 20)."""
    try: return datetime.datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone().date()
    except Exception: return None


def week(d):
    return (d - datetime.timedelta(days=d.weekday())).isoformat()


def tool_family(name):
    # one plain family per tool, so the card can say "commands", "file edits", "connectors"
    if name == "Bash": return "commands"
    if name in ("Edit", "Write", "MultiEdit", "NotebookEdit"): return "file edits"
    if name.startswith("mcp__"): return "connectors"
    if name in ("WebFetch", "WebSearch"): return "the web"
    return "other steps"


out = collections.defaultdict(lambda: {"modes": collections.Counter(), "blocked": collections.Counter(), "declined": collections.Counter(), "steps": collections.Counter()})
# chats and the subagents they called: a step can be blocked inside a subagent too (Codex's audit, Oct 20)
for f in claude_logs() + claude_logs(helpers=True):
    names = {}
    try:
        for line in open(f, errors="ignore"):
            try: o = json.loads(line)
            except Exception: continue
            d = local_day(str(o.get("timestamp") or ""))
            if not d: continue
            w = out[week(d)]
            content = ((o.get("message") or {}).get("content")) if isinstance(o.get("message"), dict) else None
            # a mode counts once per message you typed: not tool results or other records that also carry it
            typed = isinstance(content, str) or (isinstance(content, list) and any(isinstance(c, dict) and c.get("type") == "text" for c in content) and not any(isinstance(c, dict) and c.get("type") == "tool_result" for c in content))
            m = MODE.search(line)
            if m and o.get("type") == "user" and typed and not o.get("isMeta"): w["modes"][m.group(1)] += 1
            if not isinstance(content, list): continue
            for c in content:
                if not isinstance(c, dict): continue
                if c.get("type") == "tool_use":
                    names[c.get("id")] = str(c.get("name") or ""); w["steps"][tool_family(names[c.get("id")])] += 1
                elif c.get("type") == "tool_result":
                    body = c.get("content")
                    text = body if isinstance(body, str) else " ".join(x.get("text", "") for x in body if isinstance(x, dict)) if isinstance(body, list) else ""
                    fam = tool_family(names.get(c.get("tool_use_id"), ""))
                    if DECLINE.search(text[:400]): w["declined"][fam] += 1
                    elif BLOCK.search(text[:400]): w["blocked"][fam] += 1
    except OSError:
        continue

res = {k: {kk: dict(vv) for kk, vv in v.items()} for k, v in sorted(out.items())[-10:]}
os.makedirs(DATA, exist_ok=True)
json.dump(res, open(os.path.join(DATA, "runstops.json"), "w"))
print("runstops:", len(res), "weeks")
