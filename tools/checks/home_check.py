#!/usr/bin/env python3
"""Runs Crossview end to end on made-up computers (tools/checks/made_up_home.py), one personal and one business, on
whatever system this runs on: on a Mac here, and on GitHub's Windows test machine (.github/workflows/checks.yml).
For each: copies the app to a temporary folder, runs the refresh against the made-up home folder, and checks that
  - every app's records were found and counted, and chats are grouped by their project folders;
  - the business setup shows the settings its company manages, read-only, and the personal one shows none;
  - "Make this change" and Undo keep a file's line endings (CRLF on Windows) and put it back byte for byte, and a
    change to a setting the company manages is refused;
  - the first open reads the records in the background and says what it found;
  - the local server starts, serves the app, and saves a plan the company pays for.
Nothing here reads your own records. Usage: python3 tools/checks/home_check.py [--keep <folder>] [--browser]
--keep leaves the two copies (and their made-up homes) in <folder>, for a person or the qa agent to look at.
--browser also runs the browser checks (tools/checks/run.py) on each copy, which needs Google Chrome."""
import json, os, shutil, subprocess, sys, tempfile, time, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
import made_up_home

failed = []
def check(ok, what):
    print(("PASS " if ok else "FAIL ") + what, flush=True)
    if not ok: failed.append(what)


def copy_app(dest):
    keep = ["app", "tools", "demo", "README.md", "TASKS.md"]
    for k in keep:
        s = os.path.join(ROOT, k)
        if os.path.isdir(s): shutil.copytree(s, os.path.join(dest, k), ignore=shutil.ignore_patterns("data.js", "progress.js", "__pycache__", "video", "node_modules"))
        elif os.path.isfile(s): shutil.copy2(s, dest)
    os.makedirs(os.path.join(dest, "data"), exist_ok=True)


def run(cmd, cwd, env, timeout=600):
    return subprocess.run([sys.executable] + cmd, cwd=cwd, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)


def post(port, path, body):
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "X-Glass-Box": "1", "Host": f"127.0.0.1:{port}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")


def one(kind, top, port):
    print(f"\n--- {kind} setup ---", flush=True)
    app = os.path.join(top, "crossview"); os.makedirs(app)
    copy_app(app)
    env_add, counts, plans, folders = made_up_home.make(top, kind)
    env = {k: v for k, v in os.environ.items() if k not in ("CLAUDE_CONFIG_DIR", "CODEX_HOME", "GLASSBOX_MANAGED", "GLASSBOX_HOME", "GLASSBOX_CHANGES", "GLASSBOX_DATA", "GLASSBOX_OUT", "GLASSBOX_DEMO")}
    env.update(env_add)
    with open(os.path.join(app, "data", "plans.json"), "w", encoding="utf-8") as f: json.dump(plans, f)
    r = run(["tools/refresh.py"], app, env)
    check(r.returncode == 0, f"{kind}: the refresh runs to the end" + ("" if r.returncode == 0 else "\n" + r.stdout[-1500:] + r.stderr[-1500:]))
    if r.returncode: return
    out = r.stdout
    for name in ("Claude Code", "Codex", "Cowork"):
        check(f"{name}: records found" in out, f"{kind}: the refresh says it found {name}'s records")
    data = lambda n: json.load(open(os.path.join(app, "data", n), encoding="utf-8"))
    rows = data("sessions.json")
    got = {t: sum(1 for x in rows if x["tool"] == t) for t in counts}
    check(got == counts, f"{kind}: chats counted for each app {got} (made {counts})")
    works = {x["work"] for x in data("sessions-grouped.json") if x["tool"] != "Cowork"}
    check({"garden-site", "budget-report"} <= works, f"{kind}: chats grouped by their project folders {sorted(works)}")
    an = data("anatomy.json")
    m = an["Claude Code"].get("managed")
    if kind == "business":
        check(bool(m and m["items"]), "business: the settings the company manages are read")
        check(bool(m and m["locks"]["ask_rules"] and m["locks"]["status_line"]), "business: they turn off the changes they cover")
        check(not any("COMPANY_PROXY" in json.dumps(i) for i in (m or {}).get("items", [])), "business: the names and values of company settings passed to Claude Code stay hidden")
    else:
        check(m is None, "personal: no company layer")
    s = open(os.path.join(app, "app", "data.js"), encoding="utf-8").read()
    G = json.loads(s[s.index("{"):s.rindex("}") + 1])
    want = "windows" if os.name == "nt" else "mac" if sys.platform == "darwin" else "linux"
    check(G.get("system") == want, f"{kind}: the app knows it's on {want}")
    check(G.get("sessions", 0) > 0 or bool(G.get("work")), f"{kind}: the app's data has the made-up chats")

    # changes and Undo, on the made-up home, keeping line endings
    home = env_add["HOME"]
    ch_env = dict(env, GLASSBOX_HOME=home, GLASSBOX_CHANGES=os.path.join(top, "changes"))
    agent = os.path.join(home, ".claude", "agents", "proofreader.md")
    settings = os.path.join(home, ".claude", "settings.json")
    before = {p: open(p, "rb").read() for p in (agent, settings)}
    code = ("import sys, json; sys.path.insert(0, 'tools'); import changes\n"
            "def go(req):\n"
            "    try: cid = changes.make(req); left = changes.undo(cid); return {'ok': True, 'left': left}\n"
            "    except changes.Refused as e: return {'refused': str(e)}\n"
            "print(json.dumps([go({'kind': 'helper-model', 'model': 'opus', 'files': ['~/.claude/agents/proofreader.md']}),"
            " go({'kind': 'ask-first', 'rules': ['mcp__google-drive__delete_file']})]))")
    # make, then look at the file before undoing: a second script so the middle state can be read
    mk = ("import sys, json; sys.path.insert(0, 'tools'); import changes\n"
          "try: print(json.dumps({'id': changes.make({'kind': 'helper-model', 'model': 'haiku', 'files': ['~/.claude/agents/proofreader.md']})}))\n"
          "except changes.Refused as e: print(json.dumps({'refused': str(e)}))")
    r1 = subprocess.run([sys.executable, "-c", mk], cwd=app, env=ch_env, capture_output=True, text=True)
    res = json.loads(r1.stdout or "{}")
    mid = open(agent, "rb").read()
    crlf = b"\r\n" in before[agent]
    if "id" in res:
        check(b"model: haiku" in mid and (b"\r\n" in mid) == crlf and (crlf or b"\r" not in mid), f"{kind}: a subagent's model line is changed and its line endings kept ({'CRLF' if crlf else 'LF'})")
        r2 = subprocess.run([sys.executable, "-c", f"import sys; sys.path.insert(0, 'tools'); import changes; print(changes.undo({res['id']!r}))"], cwd=app, env=ch_env, capture_output=True, text=True)
        check(r2.returncode == 0 and open(agent, "rb").read() == before[agent], f"{kind}: Undo puts the subagent's file back byte for byte")
    else:
        check(False, f"{kind}: the subagent model change runs ({res.get('refused') or r1.stderr[-300:]})")
    r3 = subprocess.run([sys.executable, "-c", code], cwd=app, env=ch_env, capture_output=True, text=True)
    both = json.loads(r3.stdout or "[{}, {}]")
    if kind == "business":
        check("admin" in both[0].get("refused", ""), "business: a model the company doesn't allow is refused, and it says to ask the admin")
        check("admin" in both[1].get("refused", ""), "business: a rule the company's settings override is refused, and it says to ask the admin")
    else:
        check(both[1].get("ok") and open(settings, "rb").read() == before[settings], "personal: an ask-first rule is added and Undo puts the settings file back byte for byte")

    # the writing rules (release 3 slice 2): lines added to the main rule file, then Undo puts it back byte for byte; a
    # rule the page doesn't offer is refused. The made-up home may have no main rule file yet, and Undo then removes it
    main_rules = os.path.join(home, ".claude", "CLAUDE.md"); had = os.path.exists(main_rules); mr0 = open(main_rules, "rb").read() if had else None
    wr = ("import sys, json; sys.path.insert(0, 'tools'); import changes\n"
          "out = {}\n"
          "try: cid = changes.make({'kind': 'writing-rule', 'rules': ['plans-on-ask', 'short-replies']}); out['mid'] = open(changes.os.path.join(changes.HOME, '.claude', 'CLAUDE.md'), encoding='utf-8').read(); out['left'] = changes.undo(cid)\n"
          "except changes.Refused as e: out['refused'] = str(e)\n"
          "try: changes.make({'kind': 'writing-rule', 'rules': ['anything else']}); out['odd'] = 'made'\n"
          "except changes.Refused: out['odd'] = 'refused'\n"
          "print(json.dumps(out))")
    r4 = subprocess.run([sys.executable, "-c", wr], cwd=app, env=ch_env, capture_output=True, text=True)
    w = json.loads(r4.stdout or "{}")
    check("Write plan, summary and handoff files only when I ask for one." in (w.get("mid") or "") and (open(main_rules, "rb").read() == mr0 if had else not os.path.exists(main_rules)), f"{kind}: two writing rules are added and Undo puts the main rule file back byte for byte ({w.get('refused') or r4.stderr[-200:]})")
    check(w.get("odd") == "refused", f"{kind}: a writing rule the page doesn't offer is refused")

    # the first open: the server starts at once and reads the records in the background, saying what it found
    os.remove(os.path.join(app, "data", "plans.json"))
    srv = subprocess.Popen([sys.executable, "tools/serve.py", "--refresh"], cwd=app, env=dict(env, GLASSBOX_PORT=str(port)), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        st, seen_running = {}, False
        for _ in range(240):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/scan", timeout=5) as r: st = json.loads(r.read() or b"{}")
                if not st.get("done"): seen_running = True
                if st.get("done"): break
            except Exception: pass
            time.sleep(0.5)
        check(seen_running and st.get("done") and not st.get("error"), f"{kind}: the first open shows the reading as it happens and finishes ({st.get('error') or 'no error'})")
        found = " ".join(st.get("found") or [])
        check(all(f"Found {a}" in found for a in ("Claude Code", "Codex", "Cowork")) and "Can't see" in found, f"{kind}: the first open says what it found and what it can't see")
        mp = json.load(open(os.path.join(app, "data", "machine.json"), encoding="utf-8"))
        check((mp.get("codex_plan") or {}).get("plan_type") == ("business" if kind == "business" else "plus"), f"{kind}: Codex's own record of its plan is read, for the plan question")
        check(bool(mp.get("daily")), f"{kind}: day-by-day use is there for the limits module")
    finally:
        srv.terminate()
        try: srv.wait(10)
        except Exception: srv.kill()
    with open(os.path.join(app, "data", "plans.json"), "w", encoding="utf-8") as f: json.dump(plans, f)

    # the local server: the app loads, and a plan the company pays for is saved
    srv = subprocess.Popen([sys.executable, "tools/serve.py"], cwd=app, env=dict(env, GLASSBOX_PORT=str(port)), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ok = False
        for _ in range(40):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=5) as r: ok = r.status == 200 and b"Crossview" in r.read()
                break
            except Exception: time.sleep(0.5)
        check(ok, f"{kind}: the local server serves the app")
        st, body = post(port, "/api/plans", {"plans": [{"vendor": "claude", "name": "Claude Enterprise", "monthly_usd": None, "pay": "company", "plan": "ent"},
                                                       {"vendor": "chatgpt", "name": "Codex, paid per use", "monthly_usd": None, "pay": "api", "plan": "api"}]})
        saved = data("plans.json")["plans"] if st == 200 else []
        check(st == 200 and [p.get("pay") for p in saved] == ["company", "api"] and all(p["monthly_usd"] is None for p in saved), f"{kind}: a plan the company pays for and an API key are saved ({st} {body.get('error', '')})")
    finally:
        srv.terminate()
        try: srv.wait(10)
        except Exception: srv.kill()
    # put the made-up plans back, so the copy shows the setup it was made as
    with open(os.path.join(app, "data", "plans.json"), "w", encoding="utf-8") as f: json.dump(plans, f)
    run(["tools/bills.py"], app, env); run(["tools/build_app.py", "--fast"], app, env)
    if "--browser" in sys.argv:
        r = run(["tools/checks/run.py"], app, env, timeout=1800)
        print(r.stdout[-3000:])
        check(r.returncode == 0, f"{kind}: the browser checks pass on the made-up records")


if __name__ == "__main__":
    keep = sys.argv[sys.argv.index("--keep") + 1] if "--keep" in sys.argv else None
    base = os.path.abspath(keep) if keep else tempfile.mkdtemp(prefix="crossview-home-")
    if keep and os.path.exists(base) and os.listdir(base): sys.exit(f"{base} isn't empty.")
    for i, kind in enumerate(("personal", "business")):
        top = os.path.join(base, kind); os.makedirs(top, exist_ok=True)
        one(kind, top, 8790 + i)
    if not keep: shutil.rmtree(base, ignore_errors=True)
    else: print(f"\nKept in {base}")
    print(f"\n{'All checks passed.' if not failed else f'{len(failed)} failed.'}")
    sys.exit(1 if failed else 0)
