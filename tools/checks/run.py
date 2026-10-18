#!/usr/bin/env python3
"""Run the app's automated checks in headless Chrome, on your own numbers and on the demo company:
every click (clicks.js), the first-minute walk (walkthrough.js), that nothing moves or resizes when you click a tab, a week, a project or a layer
(steady.js), that counts shown on two screens agree and orange connectors really act as you (agree.js), and, on the demo, that nothing from your own data shows on any screen (leaks.js).
Copies the app to a temporary folder, so the app itself is untouched. Usage: python3 tools/checks/run.py [--demo-only]"""
import glob, html, json, os, re, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
import pathlib
def chrome():
    """Google Chrome on a Mac, on Windows (where GitHub's Windows test machine has it) or on Linux; CHROME overrides."""
    import shutil
    for p in (os.environ.get("CHROME"), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
              os.path.join(os.environ.get("ProgramFiles", "C:/Program Files"), "Google/Chrome/Application/chrome.exe"),
              os.path.join(os.environ.get("ProgramFiles(x86)", "C:/Program Files (x86)"), "Google/Chrome/Application/chrome.exe"),
              os.path.join(os.environ.get("LOCALAPPDATA", ""), "Google/Chrome/Application/chrome.exe"),
              shutil.which("google-chrome"), shutil.which("chrome"), shutil.which("chromium")):
        if p and os.path.isfile(p): return p
    sys.exit("Google Chrome wasn't found, so the browser checks can't run. Set CHROME to its path.")
CH = chrome()
tmp = tempfile.mkdtemp(prefix="glassbox-checks-")
for f in glob.glob(os.path.join(ROOT, "app", "*.js")) + glob.glob(os.path.join(ROOT, "app", "*.css")):
    shutil.copy(f, tmp)
page = open(os.path.join(ROOT, "app", "index.html")).read()


def private_terms():
    """Names from your own data that must never appear in the demo: pieces of work, helpers, skills, folders."""
    p = os.path.join(ROOT, "app", "data.js")
    if not os.path.exists(p): return []
    s = open(p).read(); G = json.loads(s[s.index("=") + 1:].rstrip().rstrip(";"))
    s = open(os.path.join(ROOT, "app", "demo-data.js")).read(); Dm = json.loads(s[s.index("window.GB = ") + 12:].rstrip().rstrip(";"))
    demo = {w["name"] for w in Dm["work"]} | {a["name"] for a in Dm["agents"]} | {k["name"] for k in Dm["skills"]} | {p["name"] for p in Dm["machine"]["ports"]}
    terms = {w["name"] for w in G["work"]} | {a["name"] for a in G["agents"] if a["origin"] != "Came with Claude Code"} | {k["name"] for k in G["skills"] if k["origin"] != "Came with Claude Code"}
    terms |= {"Milan", "Khanal", "/Users/", "Claude_Projects", "Ventures"}
    pp = os.path.join(ROOT, "data", "private-patterns.json")
    pats = list(json.load(open(pp)).values()) if os.path.exists(pp) else []
    generic = {"Not sure yet", "Untitled", "reviewer", "Agent Crossview"}  # "reviewer" is also app copy ("Codex's automatic reviewer"); "Agent Crossview" is the product's own name as well as his project's
    # one-word names that are everyday English ("morning", "reviewer") would flag ordinary demo sentences, so they're
    # skipped; names you made up (projects, most skills) are still checked (QA run 4, finding 19)
    try: english = {w.strip().lower() for w in open("/usr/share/dict/words", encoding="utf-8", errors="ignore")}
    except OSError: english = set()
    words = sorted(t for t in terms - demo if len(t) > 3 and t not in generic and not (re.fullmatch(r"[a-z]+", t) and t in english))
    return {"words": words, "patterns": pats}


failed = 0
# the demo's own files, before any screen: no day-job or personal word anywhere in them
pp = os.path.join(ROOT, "data", "private-patterns.json")
if os.path.exists(pp):
    pats = [re.compile(p) for p in json.load(open(pp)).values()]
    files = [os.path.join(ROOT, "app", "demo-data.js")] + glob.glob(os.path.join(ROOT, "demo", "data", "*.json"))
    hits = [(os.path.basename(f), p.pattern[:12]) for f in files for p in pats if p.search(open(f).read())]
    print("demo files:", "no private words" if not hits else "")
    for h in hits: print("  LEAK in", h[0])
    failed += len(hits)
runs = [("demo", "?demo", ("clicks.js", "steady.js", "steady.js@1280", "leaks.js", "fit.js@1440s", "fit.js@1380", "fit.js@1280", "fit.js@1000", "fit.js@990s", "agree.js", "walkthrough.js@1440", "walkthrough.js@1000"))]
if "--demo-only" not in sys.argv and os.path.exists(os.path.join(ROOT, "app", "data.js")):
    runs.insert(0, ("your data", "", ("clicks.js", "steady.js", "steady.js@1280", "fit.js@1440s", "fit.js@1380", "fit.js@1280", "fit.js@1000", "fit.js@990s", "agree.js", "walkthrough.js@1440", "walkthrough.js@1000")))
open(os.path.join(tmp, "private-terms.js"), "w").write("window.PRIVATE = " + json.dumps(private_terms()) + ";\n")
for mode, query, names in runs:
    for spec in names:
        name, _, w = spec.partition("@")
        bars = w.endswith("s"); w = w.rstrip("s")  # "990s": real scrollbars, the way his window looks (Oct 16)
        size = f"{w or 1440},{900 if w else 1000}"
        tag = {"clicks.js": "live", "steady.js": "stab", "leaks.js": "leaks", "fit.js": "fit", "agree.js": "agree", "walkthrough.js": "walk"}[name]
        shutil.copy(os.path.join(HERE, name), tmp)
        extra = '<script src="private-terms.js"></script>\n' if name == "leaks.js" else ""
        open(os.path.join(tmp, name + ".html"), "w").write(page.replace('<script src="app.js"></script>', f'<script src="app.js"></script>\n{extra}<script src="{name}"></script>'))
        # --use-mock-keychain and --password-store=basic: headless Chrome never reaches the Mac's login keychain (it asked on every run, Oct 17)
        dom = subprocess.run([CH, "--headless=new", "--disable-gpu", "--use-mock-keychain", "--password-store=basic"] + ([] if bars else ["--hide-scrollbars"]) + ["--force-prefers-reduced-motion", f"--window-size={size}",
                              "--virtual-time-budget=40000", "--dump-dom", pathlib.Path(tmp, name + ".html").as_uri() + (query + ("&walk" if query else "?walk") if name == "walkthrough.js" else query)], capture_output=True, text=True, encoding="utf-8", errors="replace").stdout
        m = re.search(r'<pre id="%s">(.*?)</pre>' % tag, dom, re.S)
        text = html.unescape(m.group(1)) if m else "no result (the check didn't finish)"
        bad = [l for l in text.split("\n") if l.startswith(("FAIL", "MOVED", "LEAK", "OVERFLOW")) or (l.startswith("ERR ") and l.strip() != "ERR")] if m else [text]
        label = f"{mode}, {spec}:"
        if name == "clicks.js": print(label, f"{text.count('PASS')} passed")
        elif name == "steady.js": print(label, "nothing moved" if not bad else "")
        elif name == "fit.js": print(label, f"fits on {text.count('FIT ')} screens" if not bad else "")
        elif name == "agree.js": print(label, f"{text.count('AGREE')} counts agree" if not bad else "")
        elif name == "walkthrough.js": print(label, f"{text.count('WALK ')} walk checks pass" if not bad else "")
        else: print(label, f"no names from your own data on {text.count('SCREEN')} screens" if not bad else "")
        for l in bad: print("  " + l)
        failed += len(bad)
shutil.rmtree(tmp, ignore_errors=True)
sys.exit(1 if failed else 0)
