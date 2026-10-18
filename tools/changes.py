#!/usr/bin/env python3
"""Changes you make from Crossview, and undoing them. Nothing here runs on its own: serve.py calls it only when you
press "Make this change" or "Undo" on Your week, and only for the two kinds of change below.

1. helper-model: one line in a helper's file (`model: sonnet`), so that helper runs on a smaller model.
   Only files in a `.claude/agents/` folder under your home folder. Claude Code picks the new line up on the next
   time it calls that helper.
2. ask-first: rules added to the "ask" list in Claude Code's settings (~/.claude/settings.json), so Claude Code
   asks you before it uses those connector actions, in every mode. Only rules naming a connector (mcp__...).
   Nothing else in that file is read or changed.
3. status-line: Crossview's line at the bottom of Claude Code (tools/statusline.py), which shows your limits and
   warns when you're on pace to run out. Only when you have no status line of your own; it never replaces one.
4. instruction-edit: exact lines in your CLAUDE.md files, prepared on What shapes Claude and stored in
   data/instructions-reviewed.json (the page sends only which one). Refused if a line has changed since.
5. archive-notes: memory notes untouched for 90 days or more, moved into an _archive folder inside the same
   memory folder, with their lines taken out of its MEMORY.md index. Undo moves them back.
6. tidy (What shapes Claude, Oct 14): a skill switched off by moving its folder from ~/.claude/skills to
   ~/.claude/skills-off (only a skill named in data/instructions-reviewed.json), and links between Claude's notes
   that lead nowhere turned into plain words ([[name]] becomes name) in the notes named. Undo moves the skill back
   and puts each note back exactly, if nothing has changed it since.

Every change keeps a copy of the file as it was, in data/changes/, and a line in data/changes.json saying what
changed. Undo puts back exactly what this changed (the model line, or the rules it added) and leaves anything
else you or Claude Code changed since alone.
GLASSBOX_HOME and GLASSBOX_CHANGES point both somewhere else, for testing on copies.

On Windows (Oct 17) files are written back with the line endings they had (Windows files often end lines with
CRLF), always as UTF-8, and a setting your company manages (paths.managed_settings) is never changed from here."""
import datetime, json, os, re, shutil, sys, tempfile
from paths import DATA, slash, managed_settings

HOME = os.path.abspath(os.path.expanduser(os.environ.get("GLASSBOX_HOME") or "~"))
BOX = os.path.abspath(os.environ.get("GLASSBOX_CHANGES") or DATA)
LOG = os.path.join(BOX, "changes.json")
MODELS = {"sonnet", "haiku", "opus", "inherit"}
RULE = re.compile(r"^mcp__[A-Za-z0-9_-]+(__[A-Za-z0-9_.-]+)?$")
# a memory folder's name in Claude Code's projects folder: -Users-ann-site on a Mac, C--Users-ann-site on Windows
FOLDER_ID = r"^(-|[A-Za-z]--)[A-Za-z0-9_.-]+$"
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
# the status line command is made here, never taken from the page
STATUS = {"type": "command", "command": f'"{slash(sys.executable)}" "{slash(os.path.join(ROOT, "tools", "statusline.py"))}"'}


class Refused(Exception):
    pass


def _real(p):
    """A path you gave as ~/..., inside your home folder, or refused."""
    if not isinstance(p, str) or not p.startswith("~/"): raise Refused("a file in your home folder, written as ~/...")
    full = os.path.realpath(os.path.join(HOME, p[2:]))
    if not full.startswith(os.path.realpath(HOME) + os.sep): raise Refused("only files in your home folder")
    return full


def _log():
    return json.load(open(LOG)) if os.path.exists(LOG) else {"changes": []}


def _save_log(o):
    os.makedirs(BOX, exist_ok=True)
    json.dump(o, open(LOG, "w"), indent=1)


def _write(path, text):
    # write next to the file, then swap it in, so a half-written file is never left behind; a file whose lines end
    # in CRLF (usual on Windows) keeps them, and every file is written as UTF-8
    try:
        with open(path, "rb") as f: crlf = b"\r\n" in f.read(65536)
    except OSError: crlf = False
    if crlf: text = text.replace("\r\n", "\n").replace("\n", "\r\n")
    d = os.path.dirname(path); fd, tmp = tempfile.mkstemp(dir=d, prefix=".glassbox-")
    with os.fdopen(fd, "w", encoding="utf-8", newline="") as f: f.write(text)
    try: shutil.copymode(path, tmp)
    except Exception: pass
    os.replace(tmp, path)


def _keep_copy(cid, path):
    d = os.path.join(BOX, "changes", cid); os.makedirs(d, exist_ok=True)
    dest = os.path.join(d, os.path.basename(path)); n = 1
    while os.path.exists(dest): n += 1; dest = os.path.join(d, f"{n}-{os.path.basename(path)}")
    shutil.copy2(path, dest)
    return os.path.relpath(dest, BOX)


def _head(text):
    """The header block of a helper file: (start, end) of the lines between the first two --- lines."""
    if not text.startswith("---"): raise Refused("its file has no header block (the lines between ---), so Crossview won't edit it")
    end = text.find("\n---", 3)
    if end < 0: raise Refused("its header block doesn't close")
    return text.index("\n") + 1, end + 1


def _set_model(text, model):
    a, b = _head(text); head = text[a:b]
    m = re.search(r"^model:[^\n]*\n?", head, re.M)
    before = m.group(0).rstrip("\n") if m else None
    after = f"model: {model}"
    if m: head = head[:m.start()] + after + "\n" + head[m.end():]
    else:
        n = re.search(r"^name:[^\n]*\n", head, re.M)
        at = n.end() if n else 0
        head = head[:at] + after + "\n" + head[at:]
    return text[:a] + head + text[b:], before, after


def _locked(what):
    """Why a change would touch a setting your company manages, or None. The page turns the button off for the same reasons."""
    m, _ = managed_settings()
    if what == "ask-first" and m.get("allowManagedPermissionRulesOnly"): return "your company's rules decide what Claude Code may do, so rules you add aren't used"
    if what == "status-line" and (m.get("statusLine") or m.get("disableAllHooks")): return "your company sets the line at the bottom of Claude Code"
    if isinstance(what, tuple) and what[0] == "helper-model" and m.get("availableModels") and what[1] != "inherit" and not any(what[1] in str(x).lower() for x in m["availableModels"]): return "your company limits which models Claude Code can use"
    return None


def _guard(what):
    why = _locked(what)
    if why: raise Refused(why + ". Ask your admin if it should change")


def _settings():
    full = os.path.join(HOME, ".claude", "settings.json")
    raw = open(full, encoding="utf-8").read().lstrip("\ufeff") if os.path.exists(full) else "{}"
    try: s = json.loads(raw or "{}")
    except Exception: raise Refused("Claude Code's settings file doesn't read as valid JSON right now, so Crossview won't touch it")
    if not isinstance(s, dict): raise Refused("Claude Code's settings file isn't laid out as expected")
    return full, raw, s


def _save_settings(full, raw, s):
    m = re.search(r"\n( +)\"", raw); indent = len(m.group(1)) if m else 2
    os.makedirs(os.path.dirname(full), exist_ok=True)
    if not os.path.exists(full): open(full, "w").write("{}\n")
    _write(full, json.dumps(s, indent=indent, ensure_ascii=False) + "\n")


def _age(path):
    """Days since a memory note last changed: the date in its header if it has one, else the file's own date."""
    try:
        m = re.search(r"^\s*modified:\s*(\d{4}-\d{2}-\d{2})", open(path, errors="ignore").read(2000), re.M)
        d = datetime.date.fromisoformat(m.group(1)) if m else datetime.date.fromtimestamp(os.stat(path).st_mtime)
        return (datetime.date.today() - d).days
    except Exception: return 0


def make(req):
    kind = req.get("kind"); summary = str(req.get("summary") or "")[:240]
    taken = {x["id"] for x in _log()["changes"]}
    cid = base = datetime.datetime.now().strftime("%Y%m%d-%H%M%S"); n = 1
    while cid in taken or os.path.exists(os.path.join(BOX, "changes", cid)): n += 1; cid = f"{base}-{n}"
    items = []
    if kind == "helper-model":
        model = req.get("model")
        if model not in MODELS: raise Refused("pick sonnet, haiku, opus or inherit")
        _guard(("helper-model", model))
        files = req.get("files") or []
        if not files or len(files) > 12: raise Refused("pick one to twelve helpers")
        plans = []
        for p in files:
            full = _real(p)
            if "/.claude/agents/" not in slash(full) or not full.endswith(".md"): raise Refused("only helper files in a .claude/agents folder")
            if not os.path.isfile(full): raise Refused(f"{p} isn't there any more")
            text = open(full).read(); new, before, after = _set_model(text, model)
            plans.append((p, full, new, before, after))
        for p, full, new, before, after in plans:
            if before == after: continue
            items.append({"file": p, "before": before, "after": after, "copy": _keep_copy(cid, full)})
            _write(full, new)
    elif kind == "status-line":
        _guard("status-line")
        full, raw, s = _settings()
        cur = s.get("statusLine")
        if cur == STATUS: raise Refused("nothing to change: it's already on")
        if cur: raise Refused("you already have a status line of your own, and Crossview won't replace it")
        copy = _keep_copy(cid, full) if os.path.exists(full) else None
        s["statusLine"] = STATUS
        _save_settings(full, raw, s)
        items.append({"file": "~/.claude/settings.json", "set": "statusLine", "value": STATUS, "copy": copy})
    elif kind == "instruction-edit":
        R = json.load(open(os.path.join(DATA, "instructions-reviewed.json"))) if os.path.exists(os.path.join(DATA, "instructions-reviewed.json")) else {}
        edits = (R.get("changes") or {}).get(req.get("id"))
        if not edits: raise Refused("unknown change")
        plans = []
        for e in edits:
            full = _real(e["file"])
            if os.path.basename(full) != "CLAUDE.md" or not os.path.isfile(full): raise Refused("only CLAUDE.md files")
            text = open(full).read()
            if text.count(e["old"]) != 1: raise Refused(f"{e['file']} has changed since this was prepared, so Crossview won't touch it")
            plans.append((e, full, text.replace(e["old"], e["new"], 1)))
        for e, full, new in plans:
            items.append({"file": e["file"], "old": e["old"], "new": e["new"], "copy": _keep_copy(cid, full)})
            _write(full, new)
    elif kind == "archive-notes":
        folders = req.get("folders") or []
        if not folders or len(folders) > 20 or not all(isinstance(f, str) and re.match(FOLDER_ID, f) for f in folders): raise Refused("pick the memory folders to tidy")
        stamp = datetime.date.today().isoformat()
        for fid in folders:
            mdir = _real(f"~/.claude/projects/{fid}/memory")
            if not os.path.isdir(mdir): raise Refused("that memory folder isn't there any more")
            old = [n for n in sorted(os.listdir(mdir)) if n.endswith(".md") and n != "MEMORY.md" and _age(os.path.join(mdir, n)) >= 90]
            if not old: continue
            dest = os.path.join(mdir, "_archive-" + stamp); os.makedirs(dest, exist_ok=True)
            index = os.path.join(mdir, "MEMORY.md"); lines = []
            if os.path.exists(index):
                text = open(index).read(); keep = []
                for line in text.splitlines(True):
                    (lines if any(f"({n})" in line for n in old) else keep).append(line)
                copy = _keep_copy(cid, index)
                _write(index, "".join(keep)); after = "".join(keep)
            else: copy = None; after = None
            for n in old: shutil.move(os.path.join(mdir, n), os.path.join(dest, n))
            items.append({"file": f"~/.claude/projects/{fid}/memory", "moved": old, "to": "_archive-" + stamp, "lines": lines, "copy": copy, "index_after": after})
    elif kind == "tidy":
        R = json.load(open(os.path.join(DATA, "instructions-reviewed.json"))) if os.path.exists(os.path.join(DATA, "instructions-reviewed.json")) else {}
        allowed = {it.get("skill_off") for it in R.get("items", []) if it.get("skill_off")}
        skills, links = req.get("skills_off") or [], req.get("unlink") or []
        if not skills and not links: raise Refused("pick something to tidy")
        if len(links) > 200 or not all(isinstance(x, str) and x in allowed for x in skills): raise Refused("only a skill this page suggested switching off")
        for name in dict.fromkeys(skills):
            src = _real(f"~/.claude/skills/{name}"); dst = _real(f"~/.claude/skills-off/{name}")
            if not os.path.isdir(src): continue
            if os.path.exists(dst): raise Refused(f"there is already a switched-off copy of {name}")
            os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.move(src, dst)
            items.append({"file": f"~/.claude/skills-off/{name}", "skill": name})
        byfile = {}
        for l in links:
            fid, note, to = (l or {}).get("folder"), (l or {}).get("note"), (l or {}).get("to")
            ok = lambda v: isinstance(v, str) and re.match(r"^[A-Za-z0-9_.-]+$", v)
            if not (isinstance(fid, str) and re.match(FOLDER_ID, fid) and ok(note) and ok(to)): raise Refused("a link to tidy isn't named the expected way")
            mdir = _real(f"~/.claude/projects/{fid}/memory")
            if os.path.exists(os.path.join(mdir, to + ".md")): continue  # it leads somewhere now: leave it
            byfile.setdefault(os.path.join(mdir, note + ".md"), (f"~/.claude/projects/{fid}/memory/{note}.md", set()))[1].add(to)
        for full, (tilde, tos) in byfile.items():
            if not os.path.isfile(full): continue
            text = open(full).read(); new = text
            for to in tos: new = new.replace(f"[[{to}]]", to)
            if new == text: continue
            items.append({"file": tilde, "copy": _keep_copy(cid, full), "after": new})
            _write(full, new)
    elif kind == "ask-first":
        rules = req.get("rules") or []
        if not rules or len(rules) > 200 or not all(isinstance(r, str) and RULE.match(r) for r in rules): raise Refused("only rules for connectors (mcp__...)")
        _guard("ask-first")
        full = os.path.join(HOME, ".claude", "settings.json")
        raw = open(full, encoding="utf-8").read().lstrip("\ufeff") if os.path.exists(full) else "{}"
        try: s = json.loads(raw or "{}")
        except Exception: raise Refused("Claude Code's settings file doesn't read as valid JSON right now, so Crossview won't touch it")
        if not isinstance(s, dict): raise Refused("Claude Code's settings file isn't laid out as expected")
        perm = s.setdefault("permissions", {})
        ask = perm.setdefault("ask", [])
        added = [r for r in dict.fromkeys(rules) if r not in ask]
        if added:
            copy = _keep_copy(cid, full) if os.path.exists(full) else None
            ask.extend(added)
            m = re.search(r"\n( +)\"", raw); indent = len(m.group(1)) if m else 2
            os.makedirs(os.path.dirname(full), exist_ok=True)
            if not os.path.exists(full): open(full, "w").write("{}\n")
            _write(full, json.dumps(s, indent=indent, ensure_ascii=False) + "\n")
            items.append({"file": "~/.claude/settings.json", "added": added, "copy": copy})
    else:
        raise Refused("unknown change")
    if not items: raise Refused("nothing to change: it's already that way")
    o = _log()
    o["changes"].append({"id": cid, "kind": kind, "when": datetime.datetime.now().isoformat(timespec="minutes"), "summary": summary, "for": str(req.get("for") or "")[:20], "items": items, "status": "made"})
    _save_log(o)
    return cid


def undo(cid):
    o = _log(); c = next((x for x in o["changes"] if x["id"] == cid), None)
    if not c: raise Refused("no change with that name")
    if c["status"] != "made": raise Refused("already undone")
    left = []  # files that changed again since, so they're left as they are
    for it in c["items"]:
        full = _real(it["file"])
        if not os.path.exists(full): left.append(it["file"]); continue
        if c["kind"] == "helper-model":
            text = open(full).read()
            try: a, b = _head(text)
            except Refused: left.append(it["file"]); continue
            head = text[a:b]; m = re.search(r"^model:[^\n]*\n?", head, re.M)
            if not m or m.group(0).rstrip("\n") != it["after"]: left.append(it["file"]); continue
            head = head[:m.start()] + ((it["before"] + "\n") if it["before"] else "") + head[m.end():]
            _write(full, text[:a] + head + text[b:])
        elif c["kind"] == "instruction-edit":
            text = open(full).read()
            if text.count(it["new"]) != 1: left.append(it["file"]); continue
            _write(full, text.replace(it["new"], it["old"], 1))
        elif c["kind"] == "archive-notes":
            dest = os.path.join(full, it["to"]); back = []
            for n in it["moved"]:
                if os.path.exists(os.path.join(dest, n)) and not os.path.exists(os.path.join(full, n)): shutil.move(os.path.join(dest, n), os.path.join(full, n)); back.append(n)
            if len(back) < len(it["moved"]): left.append(it["file"])
            index = os.path.join(full, "MEMORY.md")
            if it.get("copy") and os.path.exists(index) and open(index).read() == it.get("index_after"):
                _write(index, open(os.path.join(BOX, it["copy"])).read())  # untouched since: put the index back exactly
            elif it["lines"] and os.path.exists(index):
                text = open(index).read(); add = [l for l in it["lines"] if l.strip() and l.strip() not in text]
                if add: _write(index, text.rstrip("\n") + "\n" + "".join(l if l.endswith("\n") else l + "\n" for l in add))
            try: os.rmdir(dest)
            except OSError: pass
        elif c["kind"] == "tidy" and it.get("skill"):
            back = _real(f"~/.claude/skills/{it['skill']}")
            if os.path.exists(back): left.append(it["file"]); continue
            shutil.move(full, back)
            try: os.rmdir(os.path.dirname(full))
            except OSError: pass
        elif c["kind"] == "tidy":
            if open(full).read() != it["after"]: left.append(it["file"]); continue
            _write(full, open(os.path.join(BOX, it["copy"])).read())
        elif c["kind"] == "status-line":
            try: s = json.loads(open(full, encoding="utf-8").read().lstrip("\ufeff"))
            except Exception: left.append(it["file"]); continue
            if s.get("statusLine") != it["value"]: left.append(it["file"]); continue
            del s["statusLine"]
            _save_settings(full, open(full, encoding="utf-8").read(), s)
        elif c["kind"] == "ask-first":
            raw = open(full, encoding="utf-8").read().lstrip("\ufeff")
            try: s = json.loads(raw)
            except Exception: left.append(it["file"]); continue
            ask = (s.get("permissions") or {}).get("ask") or []
            s["permissions"]["ask"] = [r for r in ask if r not in it["added"]]
            if not s["permissions"]["ask"]: del s["permissions"]["ask"]
            if not s["permissions"]: del s["permissions"]
            m = re.search(r"\n( +)\"", raw); indent = len(m.group(1)) if m else 2
            _write(full, json.dumps(s, indent=indent, ensure_ascii=False) + "\n")
    c["status"] = "undone"; c["undone"] = datetime.datetime.now().isoformat(timespec="minutes")
    if left: c["left"] = left
    _save_log(o)
    return left


def refresh_inventory():
    """After a change: re-read each helper's model line and the ask rules into data/inventory.json, without the slow log scan."""
    p = os.path.join(DATA, "inventory.json")
    if not os.path.exists(p): return
    inv = json.load(open(p))
    for a in inv.get("agents", []):
        if not a.get("path") or not os.path.exists(a["path"]): continue
        text = open(a["path"], errors="ignore").read(4000)
        try: x, y = _head(text); m = re.search(r"^model:\s*(.+)$", text[x:y], re.M); a["model"] = m.group(1).strip().strip('"') if m else None
        except Refused: a["model"] = None
    sp = os.path.join(os.path.expanduser("~"), ".claude", "settings.json")
    try: perm = json.load(open(sp)).get("permissions") or {}
    except Exception: perm = {}
    inv["rules"] = {k: list(perm.get(k) or []) for k in ("allow", "ask", "deny")}
    try: inv["rules"]["status_line"] = bool(json.load(open(sp)).get("statusLine"))
    except Exception: inv["rules"]["status_line"] = False
    json.dump(inv, open(p, "w"), indent=1)
