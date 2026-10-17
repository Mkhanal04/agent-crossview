#!/usr/bin/env python3
"""The anatomy of each AI tool on this Mac, for the "Your setup" page: its folder, settings, automatic checks,
instructions and the add-ons it can reach. Names and counts only; no file contents, no session text.
Writes data/anatomy.json. Usage: python3 tools/anatomy_data.py"""
import glob, json, os, re, datetime
import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from roots import find
from paths import codex_logs
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
H = os.path.expanduser("~")
CP = H + "/Desktop/Claude_Projects"
APP = H + "/Library/Application Support/Claude/"


def size_mb(paths):
    total = 0
    for p in paths:
        try: total += os.path.getsize(p)
        except OSError: pass
    return round(total / 1e6)


def day(ts):
    return datetime.datetime.fromtimestamp(ts).date().isoformat() if ts else None


def span(paths):
    times = []
    for p in paths:
        try: times.append(os.path.getmtime(p))
        except OSError: pass
    return (day(min(times)), day(max(times))) if times else (None, None)


def read_json(p, default=None):
    try: return json.load(open(p))
    except Exception: return default


# ---------- Claude Code ----------
logs = glob.glob(H + "/.claude/projects/*/*.jsonl")
helper_logs = glob.glob(H + "/.claude/projects/*/*/subagents/*.jsonl")
first, last = span(logs)
settings = read_json(H + "/.claude/settings.json", {}) or {}
hooks = []
for event, groups in (settings.get("hooks") or {}).items():
    for g in groups or []:
        for h in g.get("hooks") or []:
            cmd = h.get("command") or ""
            name = os.path.basename(cmd.split()[0]) if cmd.split() else "a command"
            hooks.append({"when": event, "name": name.replace("$HOME/", ""), "says": h.get("statusMessage") or ""})
WHEN = {"SessionStart": "when a chat starts", "SessionEnd": "when a chat ends", "PreToolUse": "before it uses a tool",
        "PostToolUse": "after it uses a tool", "UserPromptSubmit": "when you send a message", "Stop": "when it finishes a reply",
        "SubagentStop": "when a subagent finishes", "Notification": "when it notifies you", "PreCompact": "before it shortens a long chat"}
for h in hooks: h["when"] = WHEN.get(h["when"], h["when"])
perm = settings.get("permissions") or {}
memory = [p for p in glob.glob(H + "/.claude/projects/*/memory/*.md") if os.path.basename(p) != "MEMORY.md"]
memory_folders = {p.split("/memory/")[0] for p in memory}
styles = [os.path.basename(p)[:-3] for p in glob.glob(H + "/.claude/output-styles/*.md")]
cc = {
    "folder": {"where": "a hidden folder in your home folder (.claude)", "session_logs": len(logs), "helper_logs": len(helper_logs),
               "project_folders": len(glob.glob(H + "/.claude/projects/*/")), "mb": size_mb(logs + helper_logs), "first": first, "last": last,
               "parts": [["Session logs", f"{len(logs)} chats, {len(helper_logs)} subagent runs"],
                         ["Your main rule file", "one file, read in every chat" if os.path.exists(H + "/.claude/CLAUDE.md") else "none"],
                         ["Subagents you made", f"{len(glob.glob(H + '/.claude/agents/*.md'))} files"],
                         ["Skills you made", f"{len(glob.glob(H + '/.claude/skills/*/SKILL.md'))} folders"],
                         ["Add-ons (plugins)", "installed from Anthropic's catalog"],
                         ["Automatic checks", f"{len(glob.glob(H + '/.claude/hooks/*'))} script"],
                         ["Its notes (memory)", f"{len(memory)} notes in {len(memory_folders)} project folders"]]},
    "settings": {"items": [["How Claude writes to you", settings.get("outputStyle") or "default"],
                           ["Rules for what it may do without asking", f"{len(perm.get('allow') or [])} allowed, {len(perm.get('deny') or [])} blocked" if perm else "none written; it asks, or follows the mode you pick"],
                           ["Auto mode notes", "written" if settings.get("autoMode") else "none"],
                           ["Extra add-on catalogs", str(len(settings.get("extraKnownMarketplaces") or {}))]]},
    "checks": {"items": hooks},
    "memory": {"notes": len(memory), "folders": len(memory_folders), "styles": styles},
}

# ---------- Cowork (runs inside the Claude app) ----------
cw_dir = APP + "local-agent-mode-sessions"
cw_tasks = sorted({os.path.basename(p) for p in glob.glob(cw_dir + "/**/local_*", recursive=True) if os.path.isdir(p)})
cw_logs = glob.glob(cw_dir + "/**/*.jsonl", recursive=True)
desk = read_json(APP + "claude_desktop_config.json", {}) or {}
ext = (read_json(APP + "extensions-installations.json", {}) or {}).get("extensions") or {}
cw_first, cw_last = span(cw_logs)
cowork = {
    "folder": {"where": "inside the Claude app's own folder (Application Support)", "session_logs": len(cw_tasks), "mb": size_mb(cw_logs),
               "first": cw_first, "last": cw_last,
               "parts": [["Task folders", f"{len(cw_tasks)} kept on this Mac"], ["Task logs", f"{len(cw_logs)} files"],
                         ["Usage record", "your 5-hour and weekly limit readings" if os.path.exists(APP + "plan-usage-history.json") else "none"]]},
    "settings": {"items": [["Connectors set up in the Claude app", str(len(desk.get("mcpServers") or {}))], ["App extensions", str(len(ext))]]},
    "checks": {"items": []},
}

# ---------- Codex ----------
# the same files sessions.py counts (archived chats included), so Your setup and Mission control show one number
cx_logs = codex_logs()
toml = ""
try: toml = open(H + "/.codex/config.toml").read()
except OSError: pass
tv = lambda k: (re.search(r'^%s\s*=\s*"?([^"\n]+)"?' % k, toml, re.M) or [None, None])[1]
cx_plugins = re.findall(r'^\[plugins\."([^"@]+)', toml, re.M)
cx_servers = sorted(set(re.findall(r"^\[mcp_servers\.([A-Za-z0-9_-]+)\]", toml, re.M)))
agents_md = find("AGENTS.md")  # in the folders your chats ran in (tools/roots.py)
# Codex's own rule files for Your AI's instructions (release 1, Oct 16): its main one in ~/.codex, then one per folder
cx_main = H + "/.codex/AGENTS.md"
words_in = lambda f: len(re.findall(r"\S+", open(f, errors="ignore").read())) if os.path.exists(f) else 0
cx_rules = ([{"path": cx_main.replace(H, "~"), "where": "main", "words": words_in(cx_main)}] if os.path.exists(cx_main) else []) + \
           [{"path": f.replace(H, "~"), "where": "folder", "folder": os.path.basename(os.path.dirname(f)), "words": words_in(f)} for f in agents_md]
cx_skills = [os.path.basename(os.path.dirname(p)) for p in glob.glob(H + "/.codex/skills/*/SKILL.md")]
# the plugins that came with Codex sit in its bundled caches; the rest were added from OpenAI's catalog (release 3)
cx_bundled = sorted({os.path.basename(p) for d in ("openai-bundled", "openai-primary-runtime") for p in glob.glob(H + f"/.codex/plugins/cache/{d}/*")})
cx_first, cx_last = span(cx_logs)
codex = {
    "folder": {"where": "a hidden folder in your home folder (.codex)", "session_logs": len(cx_logs), "mb": size_mb(cx_logs), "first": cx_first, "last": cx_last,
               "parts": [["Session logs", f"{len(cx_logs)} chats"], ["Settings file", "one, read at start"],
                         ["Its own memory", "a small database" if glob.glob(H + "/.codex/memories*.sqlite") else "none"]]},
    "settings": {"items": [["Model", tv("model") or "not set"], ["Thinking effort", tv("model_reasoning_effort") or "default"],
                           ["Approval rule", tv("approval_policy") or "default"], ["Sandbox", tv("sandbox_mode") or "default"]]},
    "checks": {"items": [{"when": "when it finishes", "name": "notify", "says": ""}] if tv("notify") else []},
    "instructions": {"files": len(agents_md), "main": os.path.exists(cx_main), "list": cx_rules},
    "memory": bool(glob.glob(H + "/.codex/memories*.sqlite")),
    "skills": cx_skills, "plugins": cx_plugins, "bundled": cx_bundled, "connectors": cx_servers,
}

out = {"Claude Code": cc, "Cowork": cowork, "Codex": codex, "read": datetime.datetime.now().isoformat(timespec="minutes")}
json.dump(out, open(os.path.join(ROOT, "data", "anatomy.json"), "w"), indent=1)
print("anatomy:", {k: v["folder"]["session_logs"] for k, v in out.items() if isinstance(v, dict)})
