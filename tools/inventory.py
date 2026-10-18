#!/usr/bin/env python3
"""Inventory of skills, agents, instruction files, hooks and connectors on this Mac, with use counted
from Claude Code logs. Reads names, descriptions and counters only. Usage: python3 inventory.py out.json"""
import json, glob, os, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from roots import find, label, settings
from paths import HOME as H, claude_dir, claude_logs, cowork_dir, files
CP = H + "/Desktop/Claude_Projects"
AS = cowork_dir()
CD = claude_dir()

def front(path, field=None):
    name = desc = None
    try: text = open(path, errors="ignore").read(4000)
    except Exception: return None if field else (None, None)
    if field:  # one more field from the header block only, such as a helper's model line
        head = text.split("---")[1] if text.startswith("---") and text.count("---") >= 2 else ""
        m = re.search(r"^%s:\s*(.+)$" % field, head, re.M)
        return m.group(1).strip().strip('"') if m else None
    m = re.search(r"^name:\s*(.+)$", text, re.M); name = m.group(1).strip().strip('"') if m else None
    m = re.search(r"^description:\s*(.+)$", text, re.M); desc = m.group(1).strip().strip('"') if m else None
    return name, desc

def plugin_name(root):
    for p in (root + "/.claude-plugin/plugin.json",):
        try: return json.load(open(p)).get("name")
        except Exception: pass
    return os.path.basename(root)

skills, agents = [], []
def add_skill(path, where, plugin=None):
    n, d = front(path); n = n or os.path.basename(os.path.dirname(path))
    skills.append({"name": n, "full": f"{plugin}:{n}" if plugin else n, "where": where, "plugin": plugin, "path": path, "what": (d or "").replace("\u2014", ",").replace("\u2013", "-")[:220], "desc_len": len(n) + len(d or "")})
def add_agent(path, where, plugin=None):
    n, d = front(path); n = n or os.path.basename(path)[:-3]
    agents.append({"name": n, "where": where, "plugin": plugin, "path": path, "what": (d or "")[:220], "model": front(path, "model")})

for p in files(CD + "/skills/*/SKILL.md"): add_skill(p, "yours (every project)")
for root in files(AS + "/skills-plugin/*/*"):
    for p in files(root + "/skills/*/SKILL.md"): add_skill(p, "your Claude account (synced)", plugin_name(root) or "anthropic-skills")
for root in files(AS + "/*/*/rpm/plugin_*"):
    pn = plugin_name(root)
    for p in files(root + "/skills/*/SKILL.md"): add_skill(p, "account plugin", pn)
    for p in files(root + "/agents/*.md"): add_agent(p, "account plugin", pn)
for p in find(".claude/skills/*/SKILL.md"):  # in the folders your chats ran in (tools/roots.py)
    if p.startswith(CD + "/"): continue
    add_skill(p, "one project only: " + label(p).split("/.claude/")[0])
for p in files(CD + "/agents/*.md"): add_agent(p, "yours (every project)")
for p in find(".claude/agents/*.md"):
    if p.startswith(CD + "/"): continue
    add_agent(p, "one project only: " + label(p).split("/.claude/")[0])
BUILTIN_SKILLS = ["dataviz", "artifact-design", "artifact-diagramming", "artifact-capabilities", "update-config", "keybindings-help", "code-review", "simplify", "fewer-permission-prompts", "loop", "schedule", "claude-api", "workflow-authoring", "run", "plugin-authoring", "init", "security-review"]
for n in BUILTIN_SKILLS:
    if not any(x["name"] == n and x["where"].startswith("built") for x in skills):
        skills.append({"name": n, "full": n, "where": "built into Claude Code (list as of Oct 10 2026)", "plugin": None, "path": None, "what": ""})
BUILTIN_AGENTS = {"general-purpose": "Catch-all helper for multi-step tasks", "Explore": "Read-only search across many files", "Plan": "Plans an implementation", "claude-code-guide": "Answers questions about Claude Code", "statusline-setup": "Configures the status line"}
for n, d in BUILTIN_AGENTS.items(): agents.append({"name": n, "where": "built into Claude Code", "plugin": None, "path": None, "what": d})

# instruction files
instr = []
for p in [CD + "/CLAUDE.md"] + find("CLAUDE.md") + find("AGENTS.md"):
    if not os.path.isfile(p) or p.startswith(CD + "/") and p != CD + "/CLAUDE.md": continue
    try: st = os.stat(p); instr.append({"path": p.replace(H, "~"), "words": len(open(p, errors="ignore").read().split()), "modified": __import__("datetime").date.fromtimestamp(st.st_mtime).isoformat()})
    except OSError: continue  # a folder this Mac doesn't let Glass Box read (for example Documents without permission)

# use, from Claude Code logs (main sessions and helpers)
use_skill = collections.defaultdict(lambda: {"calls": 0, "last": "", "projects": set()})
use_agent = collections.defaultdict(lambda: {"calls": 0, "last": "", "projects": set()})
mcp = collections.Counter(); mcp_tools = collections.defaultdict(set)
# counted per chat, so chats whose logs Claude Code has since deleted (about 30 days after last use) still count:
# data/use-by-session.json keeps every chat's counts, and chats no longer on disk are added back from it
per = collections.defaultdict(lambda: {"skills": collections.defaultdict(lambda: [0, "", []]), "agents": collections.defaultdict(lambda: [0, "", []]), "mcp": collections.Counter(), "mcp_tools": collections.defaultdict(set)})
for f in claude_logs() + claude_logs(helpers=True):
    proj = os.path.basename(f.split("/projects/")[1].split("/")[0]).replace(re.sub(r"[/_. ]", "-", CP), "CP").replace("-", "/")[:40]
    sid = os.path.basename(f)[:-6] if "/subagents/" not in f else f.split("/subagents/")[0].rsplit("/", 1)[1]
    P = per[sid]
    def hit(kind, k, ts):
        u = P[kind][k]; u[0] += 1; u[1] = max(u[1], ts)
        if proj not in u[2]: u[2].append(proj)
    for line in open(f, errors="ignore"):
        if '"tool_use"' not in line and "attributionMcp" not in line and "command-name" not in line: continue
        try: d = json.loads(line)
        except Exception: continue
        ts = (d.get("timestamp") or "")[:10]
        if d.get("attributionMcpServer"):
            P["mcp"][d["attributionMcpServer"]] += 1
            if d.get("attributionMcpTool"): P["mcp_tools"][d["attributionMcpServer"]].add(d["attributionMcpTool"])
        m = d.get("message")
        if d.get("type") == "user" and isinstance(m, dict) and isinstance(m.get("content"), str):
            for cmd in re.findall(r"<command-name>/?([\w:.-]+)</command-name>", m["content"]): hit("skills", cmd.split(":")[-1], ts)
            continue
        if d.get("type") != "assistant" or not isinstance(m, dict): continue
        for c in m.get("content") or []:
            if not isinstance(c, dict) or c.get("type") != "tool_use": continue
            inp = c.get("input") or {}
            if c.get("name") == "Skill": hit("skills", (inp.get("skill") or "?").split(":")[-1], ts)
            elif c.get("name") in ("Agent", "Task"): hit("agents", inp.get("subagent_type") or "general-purpose", ts)
per = {sid: {"skills": {k: v for k, v in P["skills"].items()}, "agents": {k: v for k, v in P["agents"].items()}, "mcp": dict(P["mcp"]), "mcp_tools": {k: sorted(v) for k, v in P["mcp_tools"].items()}} for sid, P in per.items()}
from paths import DATA
UBS = os.path.join(DATA, "use-by-session.json")
if os.path.exists(UBS):
    try:
        for sid, P in json.load(open(UBS)).items():
            if sid not in per: per[sid] = dict(P, kept=True)
    except Exception: pass
json.dump(per, open(UBS, "w"))
for sid, P in per.items():
    for kind, table in (("skills", use_skill), ("agents", use_agent)):
        for k, (n, last, projs) in P[kind].items():
            u = table[k]; u["calls"] += n; u["last"] = max(u["last"], last); u["projects"].update(projs)
    for k, n in P["mcp"].items(): mcp[k] += n
    for k, ts_ in P["mcp_tools"].items(): mcp_tools[k].update(ts_)
for s in skills:
    u = use_skill.get(s["name"]); s.update({"calls": u["calls"], "last_used": u["last"]} if u else {"calls": 0, "last_used": None})
for a in agents:
    u = use_agent.get(a["name"]); a.update({"calls": u["calls"], "last_used": u["last"]} if u else {"calls": 0, "last_used": None})
known = {s["name"] for s in skills}
other_skill_use = {k: {"calls": v["calls"], "last_used": v["last"]} for k, v in use_skill.items() if k not in known}
NAMES = {"1ca655d6": "Google Drive", "a9164550": "Gmail", "9948e260": "Vercel", "5b55096e": "Supabase", "accfd397": "Figma", "13a4ba5e": "Canva", "ccd_": "Claude desktop app controls"}
def cname(k):
    for pre, n in NAMES.items():
        if k.startswith(pre): return n + (" (name inferred from its tools)" if pre != "ccd_" else "")
    return k
out = {"skills": skills, "agents": agents, "skills_used_not_on_disk": other_skill_use, "instruction_files": instr,
       "connectors": [{"server": cname(k), "id": k, "actions": v, "tools_seen": sorted(mcp_tools[k])[:8]} for k, v in mcp.most_common()],
       "hooks": list((settings().get("hooks") or {}).keys()),
       # your own rules for what Claude Code may do without asking (the permissions block only; nothing else in the file is read here)
       "rules": dict({k: list(((settings().get("permissions") or {}).get(k) or [])) for k in ("allow", "ask", "deny")},
                     status_line=bool(settings().get("statusLine")))}
state_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "plugin-state.json")
state = json.load(open(state_path)) if os.path.exists(state_path) else {}
for s_ in skills:
    if s_.get("plugin") in state: s_["state"] = state[s_["plugin"]]
json.dump(out, open(sys.argv[1], "w"), indent=1, default=list)
print("skills", len(skills), "agents", len(agents), "instruction files", len(instr), "connectors", len(mcp))
