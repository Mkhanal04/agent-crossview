#!/usr/bin/env python3
"""The anatomy of each AI tool on this Mac, for the "Your setup" page: its folder, settings, automatic checks,
instructions and the add-ons it can reach. Names and counts only; no file contents, no session text.
Writes data/anatomy.json. Usage: python3 tools/anatomy_data.py"""
import glob, json, os, re, datetime
import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from roots import find
from paths import codex_logs, HOME as H, SYSTEM, claude_dir, claude_logs, claude_app_dir, codex_dir, files, managed_settings, managed_dir
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
CP = H + "/Desktop/Claude_Projects"
APP = claude_app_dir()
CD, CX = claude_dir(), codex_dir()


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
logs = claude_logs()
helper_logs = claude_logs(helpers=True)
first, last = span(logs)
settings = read_json(CD + "/settings.json", {}) or {}
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
memory = [p for p in files(CD + "/projects/*/memory/*.md") if os.path.basename(p) != "MEMORY.md"]
memory_folders = {p.split("/memory/")[0] for p in memory}
styles = [os.path.basename(p)[:-3] for p in files(CD + "/output-styles/*.md")]
cc = {
    "folder": {"where": "a hidden folder in your home folder (.claude)", "session_logs": len(logs), "helper_logs": len(helper_logs),
               "project_folders": len(files(CD + "/projects/*/")), "mb": size_mb(logs + helper_logs), "first": first, "last": last,
               "parts": [["Session logs", f"{len(logs)} chats, {len(helper_logs)} subagent runs"],
                         ["Your main rule file", "one file, read in every chat" if os.path.exists(CD + "/CLAUDE.md") else "none"],
                         ["Subagents you made", f"{len(files(CD + '/agents/*.md'))} files"],
                         ["Skills you made", f"{len(files(CD + '/skills/*/SKILL.md'))} folders"],
                         ["Add-ons (plugins)", "installed from Anthropic's catalog"],
                         ["Automatic checks", f"{len(files(CD + '/hooks/*'))} script"],
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
cw_tasks = sorted({os.path.basename(p) for p in files(cw_dir + "/**/local_*") if os.path.isdir(p)})
cw_logs = files(cw_dir + "/**/*.jsonl")
desk = read_json(APP + "claude_desktop_config.json", {}) or {}
ext = (read_json(APP + "extensions-installations.json", {}) or {}).get("extensions") or {}
cw_first, cw_last = span(cw_logs)
cowork = {
    "folder": {"where": "inside the Claude app's own folder (" + ("AppData" if SYSTEM == "windows" else "Application Support") + ")", "session_logs": len(cw_tasks), "mb": size_mb(cw_logs),
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
try: toml = open(CX + "/config.toml").read()
except OSError: pass
tv = lambda k: (re.search(r'^%s\s*=\s*"?([^"\n]+)"?' % k, toml, re.M) or [None, None])[1]
cx_plugins = re.findall(r'^\[plugins\."([^"@]+)', toml, re.M)
cx_servers = sorted(set(re.findall(r"^\[mcp_servers\.([A-Za-z0-9_-]+)\]", toml, re.M)))
agents_md = find("AGENTS.md")  # in the folders your chats ran in (tools/roots.py)
# Codex's own rule files for Your AI's instructions (release 1, Oct 16): its main one in ~/.codex, then one per folder
cx_main = CX + "/AGENTS.md"
words_in = lambda f: len(re.findall(r"\S+", open(f, errors="ignore").read())) if os.path.exists(f) else 0
cx_rules = ([{"path": cx_main.replace(H, "~"), "where": "main", "words": words_in(cx_main)}] if os.path.exists(cx_main) else []) + \
           [{"path": f.replace(H, "~"), "where": "folder", "folder": os.path.basename(os.path.dirname(f)), "words": words_in(f)} for f in agents_md]
cx_skills = [os.path.basename(os.path.dirname(p)) for p in files(CX + "/skills/*/SKILL.md")]
# the plugins that came with Codex sit in its bundled caches; the rest were added from OpenAI's catalog (release 3)
cx_bundled = sorted({os.path.basename(p) for d in ("openai-bundled", "openai-primary-runtime") for p in files(CX + f"/plugins/cache/{d}/*")})
cx_first, cx_last = span(cx_logs)
codex = {
    "folder": {"where": "a hidden folder in your home folder (.codex)", "session_logs": len(cx_logs), "mb": size_mb(cx_logs), "first": cx_first, "last": cx_last,
               "parts": [["Session logs", f"{len(cx_logs)} chats"], ["Settings file", "one, read at start"],
                         ["Its own memory", "a small database" if files(CX + "/memories*.sqlite") else "none"]]},
    "settings": {"items": [["Model", tv("model") or "not set"], ["Thinking effort", tv("model_reasoning_effort") or "default"],
                           ["Approval rule", tv("approval_policy") or "default"], ["Sandbox", tv("sandbox_mode") or "default"]]},
    "checks": {"items": [{"when": "when it finishes", "name": "notify", "says": ""}] if tv("notify") else []},
    "instructions": {"files": len(agents_md), "main": os.path.exists(cx_main), "list": cx_rules},
    "memory": bool(files(CX + "/memories*.sqlite")),
    "skills": cx_skills, "plugins": cx_plugins, "bundled": cx_bundled, "connectors": cx_servers,
}

# ---------- settings your company set for Claude Code (business plans, Oct 17) ----------
# Read-only: an administrator sets them, they win over yours, and Crossview never changes them. Names, counts and
# plain values only; the values of keys, tokens and environment settings are never read out.
def managed_layer():
    m, where = managed_settings()
    rule = managed_dir() + "/CLAUDE.md"
    rule_words = len(open(rule, encoding="utf-8", errors="ignore").read().split()) if os.path.isfile(rule) else 0
    mcp = read_json(managed_dir() + "/managed-mcp.json", {}) or {}
    if not m and not rule_words and not mcp: return None
    perm = m.get("permissions") or {}
    MODE = {"default": "Asks before it changes things", "acceptEdits": "Makes edits without asking", "plan": "Plans before it acts",
            "bypassPermissions": "Never asks", "auto": "Auto mode", "dontAsk": "Doesn't ask; does only what's allowed"}
    LOGIN = {"claudeai": "With a Claude account", "console": "With an API account"}
    items, done = [], set()
    def add(key, name, value):
        done.add(key); items.append([name, value])
    if perm:
        n = {k: len(perm.get(k) or []) for k in ("allow", "ask", "deny")}
        if any(n.values()): add("permissions", "Rules for what it may do", ", ".join(x for x in (f"{n['allow']} {'action' if n['allow'] == 1 else 'actions'} allowed without asking" if n["allow"] else "", f"{n['ask']} ask you first" if n["ask"] else "", f"{n['deny']} blocked" if n["deny"] else "") if x))
        if perm.get("defaultMode"): add("permissions", "How it starts", MODE.get(perm["defaultMode"], perm["defaultMode"]))
        if perm.get("disableBypassPermissionsMode") == "disable": add("permissions", "Working without asking", "Turned off")
        done.add("permissions")
    if m.get("allowManagedPermissionRulesOnly"): add("allowManagedPermissionRulesOnly", "Your own permission rules", "Not used, because your company's rules replace them")
    if m.get("model"): add("model", "Model", str(m["model"]))
    if m.get("availableModels"): add("availableModels", "Models you can pick", ", ".join(str(x)[:1].upper() + str(x)[1:] if re.fullmatch(r"[a-z]+", str(x)) else str(x) for x in m["availableModels"]))
    if m.get("statusLine"): add("statusLine", "The line at the bottom of Claude Code", "Set by your company")
    if m.get("disableAllHooks"): add("disableAllHooks", "Automatic checks", "Turned off")
    if m.get("allowManagedHooksOnly"): add("allowManagedHooksOnly", "Automatic checks", "Only your company's run")
    if m.get("hooks"): add("hooks", "Automatic checks your company added", str(sum(len(g.get("hooks") or []) for gs in m["hooks"].values() for g in (gs or []))))
    if mcp.get("mcpServers"): items.append(["Connectors your company set up", str(len(mcp["mcpServers"]))])
    if m.get("allowedMcpServers") is not None: add("allowedMcpServers", "Connectors you may add", f"Only {len(m['allowedMcpServers'])} named ones" if m["allowedMcpServers"] else "None")
    if m.get("deniedMcpServers"): add("deniedMcpServers", "Connectors blocked", str(len(m["deniedMcpServers"])))
    if m.get("allowManagedMcpServersOnly"): add("allowManagedMcpServersOnly", "Connectors", "Only your company's")
    if m.get("enabledPlugins"): add("enabledPlugins", "Add-ons switched on", str(len(m["enabledPlugins"])))
    if m.get("strictKnownMarketplaces") is not None: add("strictKnownMarketplaces", "Where add-ons can come from", "Only your company's list")
    if m.get("forceLoginMethod"): add("forceLoginMethod", "How you sign in", LOGIN.get(m["forceLoginMethod"], str(m["forceLoginMethod"])))
    if m.get("forceLoginOrgUUID"): add("forceLoginOrgUUID", "Which account", "Your company's only")
    if m.get("apiKeyHelper"): add("apiKeyHelper", "Its key", "Comes from a script your company set")
    if m.get("cleanupPeriodDays") is not None: add("cleanupPeriodDays", "How long chat logs are kept", f"{m['cleanupPeriodDays']} days")
    if m.get("env"): add("env", "Other settings it starts with", f"{len(m['env'])} set by your company")
    if m.get("companyAnnouncements"): add("companyAnnouncements", "Messages from your company", f"{len(m['companyAnnouncements'])} shown when a chat starts")
    if rule_words: items.append(["Rule file for everyone", f"{rule_words:,} words, read in every chat"])
    for k in m:
        if k not in done and k not in ("managedSourcesBehavior", "$schema"): items.append(["Other setting", k])
    return {"items": items, "from": where or (["file"] if rule_words or mcp else []),
            # what Crossview's own changes may not touch while these are set (changes.py checks the same)
            "locks": {"ask_rules": bool(m.get("allowManagedPermissionRulesOnly")), "status_line": bool(m.get("statusLine") or m.get("disableAllHooks")),
                      "models": [str(x) for x in m["availableModels"]] if m.get("availableModels") else None}}
cc["managed"] = managed_layer()

# an app with no records here says where Crossview looked, so a missing app reads as "not found", not as "unused"
from paths import where_looked
for name, tool in (("Claude Code", cc), ("Cowork", cowork), ("Codex", codex)):
    w = where_looked()[name]
    if not tool["folder"]["session_logs"] and not w["found"]:
        tool["folder"]["where"] = "Not found on this computer"
        tool["folder"]["parts"] = [["Looked in", " and ".join(p.replace(H, "~", 1) for p in w["looked"])]]
out = {"Claude Code": cc, "Cowork": cowork, "Codex": codex, "read": datetime.datetime.now().isoformat(timespec="minutes")}
json.dump(out, open(os.path.join(ROOT, "data", "anatomy.json"), "w"), indent=1)
print("anatomy:", {k: v["folder"]["session_logs"] for k, v in out.items() if isinstance(v, dict)})
