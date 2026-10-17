#!/usr/bin/env python3
"""Serves Crossview on this Mac only (127.0.0.1) and saves your corrections.
POST /api/move {"session": id, "work": name or null} moves a session to another piece of work (null undoes it),
then regroups and rebuilds in about a second. The Progress page re-reads TASKS.md on every load.
POST /api/change and /api/undo make or undo one of the prepared changes on Your week, only when you press the
button (tools/changes.py says exactly which files and lines it may touch).
Usage: python3 tools/serve.py [--open]"""
import re, http.server, json, os, subprocess, sys, datetime, webbrowser, threading
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import changes
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
PORT = int(os.environ.get("GLASSBOX_PORT", "8765"))  # another port only for testing
OVR = os.path.join(ROOT, "data", "work-overrides.json")
HIDE = {"Day job", "Personal"}


def run(*args):
    return subprocess.run([sys.executable] + list(args), cwd=ROOT, capture_output=True, text=True)


def rebuild_fast():
    for a in (["tools/group.py", "data/sessions.json", "data/sessions-grouped.json"], ["tools/dashboard_data.py", "--fast"], ["tools/machine_data.py", "--fast"], ["tools/bills.py"], ["tools/build_app.py", "--fast"], ["tools/progress.py"]):
        r = run(*a)
        if r.returncode: return r.stderr[-800:]
    return None


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=os.path.join(ROOT, "app"), **k)

    def log_message(self, *a): pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?")[0] == "/progress.js": run("tools/progress.py")
        return super().do_GET()

    def reply(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)

    def do_POST(self):
        # Only this page may write: the custom header can't be sent by another website without a preflight we never answer.
        if self.headers.get("X-Glass-Box") != "1" or self.headers.get("Host") not in (f"127.0.0.1:{PORT}", f"localhost:{PORT}"):
            return self.reply(403, {"error": "not allowed"})
        try: req = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        except Exception: return self.reply(400, {"error": "bad request"})
        if self.path == "/api/move":
            sid, work = req.get("session"), req.get("work")
            rows = {r["id"]: r for r in json.load(open(os.path.join(ROOT, "data", "sessions-grouped.json"))) if r.get("id")}
            if sid not in rows: return self.reply(400, {"error": "unknown session"})
            if rows[sid]["work"] in HIDE: return self.reply(400, {"error": "day-job and personal sessions stay private"})
            if work is not None and (not isinstance(work, str) or not work.strip() or len(work) > 60): return self.reply(400, {"error": "name the piece of work in 60 characters or fewer"})
            o = json.load(open(OVR)) if os.path.exists(OVR) else {}
            if work is None: o.pop(sid, None)
            else: o[sid] = {"work": work.strip(), "by": "your correction", "when": datetime.datetime.now().isoformat(timespec="minutes"), "was": rows[sid]["work"]}
            json.dump(o, open(OVR, "w"), indent=1)
            err = rebuild_fast()
            return self.reply(500 if err else 200, {"error": err} if err else {"ok": True})
        if self.path == "/api/bill":
            # an amount you typed in for a paid service outside your plans, for one month; kept on this Mac
            svc, month, usd = req.get("service"), req.get("month"), req.get("usd")
            if not isinstance(svc, str) or not svc.strip() or len(svc) > 40: return self.reply(400, {"error": "name the service in 40 characters or fewer"})
            if not isinstance(month, str) or not re.match(r"^20\d\d-(0[1-9]|1[0-2])$", month): return self.reply(400, {"error": "pick a month"})
            if usd is not None and (not isinstance(usd, (int, float)) or usd < 0 or usd > 100000): return self.reply(400, {"error": "enter an amount between $0 and $100,000"})
            path = os.path.join(ROOT, "data", "bills-manual.json")
            o = json.load(open(path)) if os.path.exists(path) else {"entries": []}
            o["entries"] = [e for e in o["entries"] if not (e["service"] == svc.strip() and e["month"] == month)]
            if usd is not None: o["entries"].append({"service": svc.strip(), "month": month, "usd": round(float(usd), 2), "entered": datetime.datetime.now().isoformat(timespec="minutes")})
            json.dump(o, open(path, "w"), indent=1)
            r = run("tools/bills.py")
            if not r.returncode: r = run("tools/build_app.py", "--fast")
            return self.reply(500 if r.returncode else 200, {"error": r.stderr[-800:]} if r.returncode else {"ok": True})
        if self.path in ("/api/change", "/api/undo"):
            # a prepared change you said yes to, or undoing one; never anything else
            try:
                if self.path == "/api/change": out = {"ok": True, "id": changes.make(req)}
                else:
                    if not isinstance(req.get("id"), str): return self.reply(400, {"error": "which change?"})
                    out = {"ok": True, "left": changes.undo(req["id"])}
            except changes.Refused as e: return self.reply(400, {"error": str(e)})
            except Exception as e: return self.reply(500, {"error": f"it didn't work: {type(e).__name__}"})
            if os.environ.get("GLASSBOX_NO_REBUILD") != "1":
                changes.refresh_inventory()
                r = run("tools/build_app.py", "--fast")
                if r.returncode: return self.reply(500, {"error": "the change was made, but the page didn't rebuild: " + r.stderr[-400:]})
            return self.reply(200, out)
        if self.path == "/api/plans":
            # the plans you pay for, from the question on Your week; kept on this Mac in data/plans.json
            CLAUDE_APPS, GPT_APPS = ["Claude Code", "Cowork", "Claude app"], ["Codex", "ChatGPT app"]
            got = req.get("plans")
            if not isinstance(got, list) or len(got) > 4: return self.reply(400, {"error": "pick up to four plans"})
            out = []
            for p in got:
                name, usd, vendor = (p or {}).get("name"), (p or {}).get("monthly_usd"), (p or {}).get("vendor")
                if vendor not in ("claude", "chatgpt"): return self.reply(400, {"error": "unknown kind of plan"})
                if not isinstance(name, str) or not name.strip() or len(name) > 40: return self.reply(400, {"error": "name the plan in 40 characters or fewer"})
                if not isinstance(usd, (int, float)) or usd < 0 or usd > 5000: return self.reply(400, {"error": "enter a monthly price between $0 and $5,000"})
                out.append({"name": name.strip(), "covers": CLAUDE_APPS if vendor == "claude" else GPT_APPS, "monthly_usd": round(float(usd), 2), "since": None})
            json.dump({"note": "Your plans, from the question on Your week (" + datetime.date.today().isoformat() + "). Change them there.", "plans": out},
                      open(os.path.join(ROOT, "data", "plans.json"), "w"), indent=1)
            r = run("tools/bills.py")
            if not r.returncode: r = run("tools/build_app.py", "--fast")
            return self.reply(500 if r.returncode else 200, {"error": r.stderr[-800:]} if r.returncode else {"ok": True})
        if self.path == "/api/refresh":
            r = run("tools/refresh.py")
            return self.reply(500 if r.returncode else 200, {"ok": not r.returncode, "log": r.stdout[-1500:]})
        return self.reply(404, {"error": "not found"})


if __name__ == "__main__":
    url = f"http://127.0.0.1:{PORT}/"
    try: srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:  # already running from an earlier double-click: just open it
        print(f"Crossview is already running at {url}"); webbrowser.open(url); sys.exit(0)
    print(f"Crossview is open at {url}  (this Mac only). Close this window to stop it.")
    if "--open" in sys.argv: threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try: srv.serve_forever()
    except KeyboardInterrupt: pass
