#!/usr/bin/env python3
"""A made-up person's computer, for testing Crossview without anyone's real records (Oct 17): a home folder with
Claude Code, Codex and Cowork records shaped like the real ones, dated to this week and the four before, and two
project folders. Nothing in it is real.

  personal: Claude Max, its limit readings in the Claude app, a weekly limit stop, ChatGPT Plus for Codex.
  business: a Claude Team seat and ChatGPT Business, both paid by the company; settings the company manages for
            Claude Code (in their own folder, given to Crossview as GLASSBOX_MANAGED); no limit readings for Claude.

Paths follow the system it runs on, so on Windows the records hold C:\\... folders the way Claude Code writes them.
Usage: python3 tools/checks/made_up_home.py <empty folder> [personal|business]
Prints the environment to run Crossview against it (HOME, USERPROFILE, APPDATA, LOCALAPPDATA, GLASSBOX_MANAGED).
The Claude app's folder is found the usual way (Application Support on a Mac, APPDATA on Windows), so that is tested too."""
import datetime, json, os, random, re, sys, uuid

WIN = os.name == "nt"


def write(path, text, crlf=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\r\n" if crlf else "\n") as f: f.write(text)


def jl(path, rows):
    write(path, "".join(json.dumps(r) + "\n" for r in rows))


def iso(t):
    return t.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def make(top, kind="personal"):
    rnd = random.Random(17)
    home = os.path.abspath(os.path.join(top, "home"))
    app_dir = os.path.join(home, "AppData", "Roaming", "Claude") if WIN else os.path.join(home, "Library", "Application Support", "Claude")
    env = {"HOME": home, "USERPROFILE": home, "APPDATA": os.path.join(home, "AppData", "Roaming"), "LOCALAPPDATA": os.path.join(home, "AppData", "Local"),
           "PYTHONUTF8": "1"}
    claude, codex = os.path.join(home, ".claude"), os.path.join(home, ".codex")
    now = datetime.datetime.now().astimezone().replace(microsecond=0)
    monday = (now - datetime.timedelta(days=now.weekday())).replace(hour=9, minute=0, second=0)
    # Windows files often end lines with CRLF: the made-up files there do too, so changes and Undo are tested on them
    crlf = WIN or os.environ.get("GLASSBOX_TEST_CRLF") == "1"  # forced on to test Windows line endings on a Mac

    # ---------- two projects, each with a rule file, plus a subagent and a skill of the person's own ----------
    projects = {"garden-site": "Pages for a garden center", "budget-report": "Monthly budget report"}
    folders = {}
    for name, what in projects.items():
        d = os.path.join(home, "Projects", name); folders[name] = d
        write(os.path.join(d, "CLAUDE.md"), f"# {what}\n\nKeep pages short. Ask before deleting files.\n", crlf)
    # Codex's rule file, and signs of a paid service outside the plans (a key's name, a code library), as real projects have
    write(os.path.join(folders["budget-report"], "AGENTS.md"), "# Budget report\n\nCheck every total twice.\n", crlf)
    write(os.path.join(folders["garden-site"], ".env.example"), "OPENAI_API_KEY=\n", crlf)
    write(os.path.join(folders["garden-site"], "package.json"), json.dumps({"dependencies": {"@fal-ai/client": "1.0.0"}}, indent=2) + "\n")
    write(os.path.join(claude, "CLAUDE.md"), "# How I work\n\nPlain words. Short answers.\n", crlf)
    write(os.path.join(claude, "agents", "proofreader.md"), "---\nname: proofreader\ndescription: Reads a page for typos and unclear sentences.\n---\n\nRead the page and list typos.\n", crlf)
    write(os.path.join(claude, "skills", "weekly-summary", "SKILL.md"), "---\nname: weekly-summary\ndescription: Writes a short summary of the week's changes.\n---\n\nSummarize.\n", crlf)
    write(os.path.join(claude, "settings.json"), json.dumps({"permissions": {"allow": ["Bash(ls:*)"]}}, indent=2) + "\n", crlf)
    SERVERS = {"google-drive": ["search_files", "delete_file"], "slack": ["send_message", "list_channels"], "github": ["create_issue", "get_file"], "playwright": ["browser_navigate", "browser_click"]}
    write(os.path.join(home, ".claude.json"), json.dumps({"mcpServers": {"google-drive": {"type": "http", "url": "https://example.invalid/mcp"}, "slack": {"type": "http", "url": "https://example.invalid/slack"},
        "github": {"command": "npx", "args": ["github-mcp"], "env": {"GITHUB_TOKEN": ""}}, "playwright": {"command": "npx", "args": ["@playwright/mcp", "--isolated"]}}}, indent=2) + "\n")

    # ---------- Claude Code chats: a few a week for five weeks ----------
    counts = {"Claude Code": 0, "Codex": 0, "Cowork": 0}
    model = "claude-sonnet-4-5" if kind == "business" else "claude-opus-4-6"
    for week in range(5):
        for k in range(3):
            proj = "garden-site" if k % 2 == 0 else "budget-report"
            cwd = folders[proj]
            start = monday - datetime.timedelta(days=7 * week) + datetime.timedelta(days=k * 2 % 5, hours=k)
            if start > now - datetime.timedelta(minutes=30): start = now - datetime.timedelta(hours=2 + k)
            sid = str(uuid.UUID(int=rnd.getrandbits(128)))
            pdir = os.path.join(claude, "projects", re.sub(r"[^A-Za-z0-9]", "-", cwd))
            rows = [{"type": "custom-title", "customTitle": f"{projects[proj]}, part {week * 3 + k + 1}", "sessionId": sid}]
            t = start
            # what loaded into the chat at its start: the rule files, the skill list and the connectors, as Claude Code records them
            mem = os.path.join(pdir, "memory")
            if not os.path.isdir(mem):  # Claude's notes for this project, as Claude Code keeps them
                write(os.path.join(mem, "prefers-short-pages.md"), "---\nname: prefers-short-pages\ndescription: Keeps pages short\nmetadata:\n  type: feedback\n---\n\nKeep pages short.\n", crlf)
                write(os.path.join(mem, "MEMORY.md"), "- [Short pages](prefers-short-pages.md) — keeps pages short\n", crlf)
            rows.append({"type": "attachment", "sessionId": sid, "cwd": cwd, "timestamp": iso(t), "attachment": {"type": "instructions", "files": [
                {"path": os.path.join(claude, "CLAUDE.md"), "type": "User", "content": "# How I work\n\nPlain words. Short answers.\n"},
                {"path": os.path.join(cwd, "CLAUDE.md"), "type": "Project", "content": f"# {projects[proj]}\n\nKeep pages short. Ask before deleting files.\n"},
                {"path": os.path.join(mem, "MEMORY.md"), "type": "AutoMem", "content": "- [Short pages](prefers-short-pages.md)\n"}]}})
            rows.append({"type": "attachment", "sessionId": sid, "cwd": cwd, "timestamp": iso(t), "attachment": {"type": "output_style", "style": "Explanatory"}})
            rows.append({"type": "attachment", "sessionId": sid, "cwd": cwd, "timestamp": iso(t), "attachment": {"type": "agent_listing_delta", "isInitial": True, "addedTypes": ["general-purpose", "Explore", "proofreader"], "addedLines": ["- general-purpose", "- Explore", "- proofreader: Reads a page for typos"]}})
            rows.append({"type": "attachment", "sessionId": sid, "cwd": cwd, "timestamp": iso(t), "attachment": {"type": "skill_listing", "skillCount": 3, "names": ["weekly-summary", "code-review", "simplify"], "content": "- weekly-summary: Writes a short summary"}})
            rows.append({"type": "attachment", "sessionId": sid, "cwd": cwd, "timestamp": iso(t), "attachment": {"type": "mcp_instructions_delta", "addedNames": list(SERVERS), "addedBlocks": ["(made-up)"] * len(SERVERS)}})
            for r in range(6):
                t += datetime.timedelta(minutes=4)
                rows.append({"type": "user", "sessionId": sid, "cwd": cwd, "timestamp": iso(t), "message": {"role": "user", "content": "(made-up message)"}})
                msg = {"id": f"msg_{sid[:8]}_{r}", "model": model, "stop_reason": "end_turn", "content": [{"type": "text", "text": "(made-up reply)"}],
                       "usage": {"input_tokens": 12, "cache_creation_input_tokens": 4000, "cache_read_input_tokens": 60000 + r * 9000, "output_tokens": 900}}
                if r == 2: msg["content"].append({"type": "tool_use", "id": "tu1", "name": "Agent", "input": {"subagent_type": "proofreader", "description": "check the page"}})
                if r == 3: msg["content"].append({"type": "tool_use", "id": "tu2", "name": "Skill", "input": {"skill": "weekly-summary"}})
                if r in (4, 5):  # connector uses, a different pair of connectors in each chat
                    for n, (srv, acts) in enumerate(SERVERS.items()):
                        if (n + k + r) % 2 == 0: msg["content"].append({"type": "tool_use", "id": f"tu{r}{n}", "name": f"mcp__{srv}__{acts[(week + n) % 2]}", "input": {}})
                rows.append({"type": "assistant", "sessionId": sid, "cwd": cwd, "timestamp": iso(t + datetime.timedelta(seconds=30)), "requestId": f"req_{sid[:8]}_{r}", "message": msg})
                for c in msg["content"]:  # each connector's answer comes back on a line that names the connector, as in real logs
                    if c.get("name", "").startswith("mcp__"):
                        _, srv, act = c["name"].split("__", 2)
                        rows.append({"type": "user", "sessionId": sid, "cwd": cwd, "timestamp": iso(t + datetime.timedelta(seconds=40)), "attributionMcpServer": srv, "attributionMcpTool": act,
                                     "message": {"role": "user", "content": [{"type": "tool_result", "tool_use_id": c["id"], "content": "(made-up result)"}]}})
            if kind == "personal" and week == 0 and k == 1:  # one weekly limit stop this week
                rows.append({"type": "assistant", "sessionId": sid, "cwd": cwd, "timestamp": iso(t + datetime.timedelta(minutes=2)), "error": "rate_limit", "isApiErrorMessage": True,
                             "quotaLimits": {"rateLimitType": "seven_day", "resetsAt": int((monday + datetime.timedelta(days=7)).timestamp())}})
            jl(os.path.join(pdir, sid + ".jsonl"), rows)
            # one subagent run, in the chat's own folder
            aid = format(rnd.getrandbits(64), "x")
            jl(os.path.join(pdir, sid, "subagents", f"agent-{aid}.jsonl"), [{"type": "assistant", "sessionId": sid, "isSidechain": True, "timestamp": iso(t), "requestId": f"req_a{aid}",
               "message": {"id": f"msg_a{aid}", "model": model, "stop_reason": "end_turn", "content": [], "usage": {"input_tokens": 8, "cache_creation_input_tokens": 2000, "cache_read_input_tokens": 20000, "output_tokens": 700}}}])
            write(os.path.join(pdir, sid, "subagents", f"agent-{aid}.meta.json"), json.dumps({"agentType": "proofreader", "description": "check the page"}))
            counts["Claude Code"] += 1

    # ---------- Codex: its own folder, dated folders, a session index, limit readings in each reply ----------
    idx = []
    for week in range(3):
        for k in range(2):
            t = monday - datetime.timedelta(days=7 * week) + datetime.timedelta(days=1 + k, hours=3)
            if t > now - datetime.timedelta(minutes=30): t = now - datetime.timedelta(hours=1 + k)
            sid = str(uuid.UUID(int=rnd.getrandbits(128)))
            cwd = folders["budget-report"]
            rows = [{"timestamp": iso(t), "type": "session_meta", "payload": {"id": sid, "cwd": cwd, "originator": "codex_cli_rs"}},
                    {"timestamp": iso(t), "type": "turn_context", "payload": {"cwd": cwd, "model": "gpt-5.1-codex", "turn_id": "t1"}}]
            for r in range(4):
                tt = t + datetime.timedelta(minutes=5 * r)
                used = min(95, 10 + 20 * (2 - week) + 5 * r + 10 * k)
                rows.append({"timestamp": iso(tt), "type": "event_msg", "payload": {"type": "token_count",
                    "info": {"last_token_usage": {"input_tokens": 30000, "cached_input_tokens": 24000, "output_tokens": 1200, "reasoning_output_tokens": 300, "total_tokens": 31200}},
                    "rate_limits": {"primary": {"used_percent": 20 + r, "window_minutes": 300, "resets_at": int((tt + datetime.timedelta(hours=4)).timestamp())},
                                    "secondary": {"used_percent": used, "window_minutes": 10080, "resets_at": int((monday + datetime.timedelta(days=7 - 7 * week, hours=3)).timestamp())}}}})
            day = t.strftime("%Y/%m/%d").split("/")
            jl(os.path.join(codex, "sessions", *day, f"rollout-{t.strftime('%Y-%m-%dT%H-%M-%S')}-{sid}.jsonl"), rows)
            idx.append({"id": sid, "thread_name": f"Budget numbers check {week * 2 + k + 1}", "updated_at": iso(t)})
            counts["Codex"] += 1
    jl(os.path.join(codex, "session_index.jsonl"), idx)
    write(os.path.join(codex, "config.toml"), 'model = "gpt-5.1-codex"\napproval_policy = "on-request"\nsandbox_mode = "workspace-write"\n')

    # ---------- Cowork: tasks inside the Claude app's folder ----------
    cw = os.path.join(app_dir, "local-agent-mode-sessions", str(uuid.UUID(int=rnd.getrandbits(128))), str(uuid.UUID(int=rnd.getrandbits(128))))
    for k in range(2):
        t = monday - datetime.timedelta(days=7 * k) + datetime.timedelta(days=2, hours=5)
        if t > now - datetime.timedelta(minutes=30): t = now - datetime.timedelta(hours=3)
        lid = "local_" + str(uuid.UUID(int=rnd.getrandbits(128)))
        write(os.path.join(cw, lid + ".json"), json.dumps({"sessionId": lid, "title": f"Sort the shared folder {k + 1}", "createdAt": int(t.timestamp() * 1000), "lastActivityAt": int((t + datetime.timedelta(minutes=20)).timestamp() * 1000), "model": model, "cwd": "/sessions/made-up"}))
        jl(os.path.join(cw, lid, "audit.jsonl"), [{"type": "result", "timestamp": iso(t), "modelUsage": {model: {"cacheReadInputTokens": 50000, "outputTokens": 2000, "costUSD": 0.4}}}])
        jl(os.path.join(cw, lid, ".claude", "projects", "-sessions-made-up", "c" + lid[6:] + ".jsonl"), [{"type": "assistant", "sessionId": lid, "timestamp": iso(t), "requestId": "rq" + lid[6:14],
            "message": {"id": "m" + lid[6:14], "model": model, "stop_reason": "end_turn", "content": [], "usage": {"input_tokens": 10, "cache_creation_input_tokens": 3000, "cache_read_input_tokens": 50000, "output_tokens": 2000}}}])
        counts["Cowork"] += 1
    write(os.path.join(app_dir, "claude_desktop_config.json"), json.dumps({"mcpServers": {}}))
    if kind == "personal":  # the Claude app's own readings of the 5-hour and weekly limits (Pro and Max)
        samples, t = [], monday - datetime.timedelta(days=14)
        while t < now:
            wk_start = t - datetime.timedelta(days=t.weekday())
            sd = min(100, round((t - wk_start.replace(hour=9)).total_seconds() / 3600 * 0.6))
            samples.append({"t": int(t.timestamp() * 1000), "u": {"fh": rnd.randint(5, 60), "sd": max(0, sd)}})
            t += datetime.timedelta(hours=2)
        write(os.path.join(app_dir, "plan-usage-history.json"), json.dumps({"samples": samples}))

    # ---------- settings the company manages, and the plans ----------
    plans = {"note": "Made-up plans for testing.", "plans": [
        {"name": "Claude Max 5x", "covers": ["Claude Code", "Cowork", "Claude app"], "monthly_usd": 100, "since": None},
        {"name": "ChatGPT Plus", "covers": ["Codex", "ChatGPT app"], "monthly_usd": 20, "since": None}]}
    if kind == "business":
        managed = os.path.join(top, "company")
        write(os.path.join(managed, "managed-settings.json"), json.dumps({
            "permissions": {"allow": ["Read"], "deny": ["WebFetch"], "defaultMode": "default", "disableBypassPermissionsMode": "disable"},
            "allowManagedPermissionRulesOnly": True, "availableModels": ["sonnet", "haiku"], "cleanupPeriodDays": 30,
            "statusLine": {"type": "command", "command": "company-status"}, "env": {"COMPANY_PROXY": "(made up)"},
            "forceLoginMethod": "claudeai", "companyAnnouncements": ["Use the shared drive for client files."]}, indent=2))
        write(os.path.join(managed, "CLAUDE.md"), "# Company rules\n\nNever paste customer data into a chat.\n")
        env["GLASSBOX_MANAGED"] = managed
        plans["plans"] = [
            {"name": "Claude Team, Premium seat", "covers": ["Claude Code", "Cowork", "Claude app"], "monthly_usd": None, "since": None, "pay": "company", "plan": "team_prem"},
            {"name": "ChatGPT Business", "covers": ["Codex", "ChatGPT app"], "monthly_usd": None, "since": None, "pay": "company", "plan": "business"}]
    return env, counts, plans, folders


if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__)
    env, counts, plans, _ = make(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "personal")
    write(os.path.join(sys.argv[1], "plans.json"), json.dumps(plans, indent=1))
    print(json.dumps({"env": env, "chats": counts}, indent=1))
