#!/usr/bin/env python3
"""How Claude works with you (task 24, draft): which instructions load into a chat, where they repeat, disagree or
point at nothing, and what Claude's memory holds. Reads your instruction files, memory notes and the "which files
loaded" records in Claude Code's logs. Never reads your messages or Claude's replies. Files in your private folders
(day job, personal) are counted but never named or quoted. Usage: python3 tools/instructions.py
Writes data/instructions.json (private, never committed)."""
import collections, datetime, glob, json, math, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import DATA, HOME as H, WIN, claude_dir, claude_logs, files as fglob, folder_id, slash
from roots import find

CP = H + "/Desktop/Claude_Projects"; CD = claude_dir()
PRIV = []
try: PRIV = [re.compile(p) for p in json.load(open(os.path.join(DATA, "private-patterns.json"))).values()]
except Exception: pass
SKIP_DIRS = ("/_Archive/", "/node_modules/", "/.git/")
private = lambda p: any(r.search(p) for r in PRIV)  # your private list (data/private-patterns.json) names those folders
short = lambda p: p.replace(H, "~")
today = datetime.date.today()


def words(t): return len(re.findall(r"\S+", t))


def front(text):
    """The header block of a memory note: its name, kind, and the date it was last changed, if it says."""
    out = {}
    if text.startswith("---"):
        head = text.split("---", 2)[1] if text.count("---") >= 2 else ""
        for k in ("name", "type", "modified"):
            m = re.search(r"^\s*%s:\s*(.+)$" % k, head, re.M)
            if m: out[k] = m.group(1).strip().strip('"')
    return out


# ---------- the files: instruction files, output styles, helper definitions, your skills, memory notes ----------
files = []
def add(path, kind):
    if any(s in path for s in SKIP_DIRS) or not os.path.isfile(path): return
    if private(path):  # counted, never read
        files.append({"path": path, "kind": kind, "words": 0, "modified": datetime.date.fromtimestamp(os.stat(path).st_mtime).isoformat(), "private": True, "text": ""}); return
    try: text = open(path, errors="ignore").read()
    except Exception: return
    files.append({"path": path, "kind": kind, "words": words(text), "modified": datetime.date.fromtimestamp(os.stat(path).st_mtime).isoformat(), "private": private(path), "text": text})

add(CD + "/CLAUDE.md", "your instructions (every chat)")
for p in find("CLAUDE.md") + find("CLAUDE.local.md"):  # in the folders your chats ran in (tools/roots.py)
    if not p.startswith(CD + "/"): add(p, "a folder's instructions")
for p in find("AGENTS.md"): add(p, "a folder's instructions (AGENTS.md)")
for p in fglob(CD + "/output-styles/*.md"): add(p, "reply style")
for p in sorted(set(fglob(CD + "/agents/*.md") + find(".claude/agents/*.md"))): add(p, "helper definition")
for p in sorted(set(fglob(CD + "/skills/*/SKILL.md") + find(".claude/skills/*/SKILL.md"))): add(p, "skill")
# memory folders are named after the folder a chat started in, with every / and _ turned into -
_DIRS = None
def mem_dir(folder):
    """The real folder a memory folder belongs to (its name is that folder's path with / and _ turned into -)."""
    global _DIRS
    if _DIRS is None: _DIRS = [CP] + glob.glob(CP + "/*") + glob.glob(CP + "/*/*") + glob.glob(CP + "/*/*/*") + glob.glob(CP + "/*/*/*/*") + glob.glob(CP + "/*/*/*/*/*") + [H + "/Desktop"]
    for d in _DIRS:
        if (folder_id(d) if WIN else re.sub(r"[/_. ]", "-", d)) == folder: return d
    return None
def mem_label(folder):
    """Each memory folder by its own name, so two folders inside one project stay apart."""
    d = mem_dir(folder)
    if not d: return "a folder that no longer exists"
    if private(d): return "a private folder"
    if d == H + "/Desktop": return "~/Desktop"
    return "Claude_Projects (the hub)" if d == CP else d[len(CP) + 1:]
def mem_project(folder):
    d = mem_dir(folder)
    return project_of(d) if d else None
mem = []
# notes can sit in subfolders of a memory folder too (Codex audit, Oct 19: 8 were missed)
for p in sorted(set(fglob(CD + "/projects/*/memory/*.md") + fglob(CD + "/projects/*/memory/**/*.md"))):
    if os.path.basename(p) == "MEMORY.md": continue
    add(p, "memory note")
    f = files[-1] if files and files[-1]["path"] == p else None
    if not f: continue
    fm = front(f["text"]); folder = p.split("/projects/")[1].split("/memory/")[0]
    mod = fm.get("modified", "")[:10] or f["modified"]
    mem.append({"path": p, "folder": folder, "name": fm.get("name") or os.path.basename(p)[:-3], "kind": fm.get("type") or ("feedback" if "feedback" in os.path.basename(p) else "unknown"),
                "modified": mod, "links": re.findall(r"\[\[([^\]]+)\]\]", f["text"]), "private": f["private"]})
# a memory note's kind often sits under "metadata:"; front() reads the first "type:" line wherever it is

# ---------- what loads into a chat, from the logs' "which files loaded" records ----------
def project_of(folder):
    """The project a chat ran in: the Claude_Projects path after the category, or the folder name."""
    if not folder: return "unknown"
    if "/scratch-workspaces/" in folder: return "a Claude app scratch chat"
    if private(folder): return "a private folder"
    if folder.startswith(CP):
        rest = folder[len(CP):].strip("/").split("/")
        if not rest or not rest[0]: return "Claude_Projects (the hub)"
        return "/".join(rest[:2]) if rest[0] in ("Ventures", "Career", "Education", "Side_Projects") and len(rest) > 1 else rest[0]
    return short(folder)

loads = []
unq = lambda s: slash(json.loads('"' + s + '"')) if "\\" in s else s
mem_seen = {}  # each memory folder: the last time any chat read its notes (every load record, not only the first)
for f in claude_logs():
    first = None; cwd = None; cwds = []; listing = {}; ts = None
    for line in open(f, errors="ignore"):
        if '"cwd"' in line and cwd is None:
            m = re.search(r'"cwd":"([^"]+)"', line)
            if m: cwd = unq(m.group(1))
        if '"cwd"' in line:
            m = re.search(r'"cwd":"([^"]+)"', line)
            if m and (not cwds or cwds[-1] != unq(m.group(1))): cwds.append(unq(m.group(1)))
        if '"attachment"' not in line: continue
        try: d = json.loads(line)
        except Exception: continue
        a = d.get("attachment")
        if not isinstance(a, dict): continue
        t = a.get("type")
        if t == "instructions":
            for x in a.get("files") or []:
                x["path"] = slash(x.get("path") or "")
                if x.get("type") == "AutoMem" and "/projects/" in x["path"]:
                    k = x["path"].split("/projects/")[1].split("/memory/")[0]; ts_ = (d.get("timestamp") or "")[:16]
                    if ts_ > mem_seen.get(k, ""): mem_seen[k] = ts_
        if t == "instructions" and first is None:
            first = [{"path": x.get("path", ""), "type": x.get("type", ""), "words": words(x.get("content") or "")} for x in a.get("files") or []]
            ts = d.get("timestamp")
        elif t == "skill_listing" and "skills" not in listing:
            # n: the skills Claude Code listed to Claude in this one chat (what Claude could see from this folder, that day).
            # Not the same figure as every skill found on this Mac and your account (build_app.py: shapes.skills_found).
            k_ = a.get("skillCount") or len(a.get("names") or [])
            listing["skills"] = {"n": k_, "listed_in_chat": k_, "chat_day": (d.get("timestamp") or "")[:10] or None, "chars": len(a.get("content") or "")}
        elif t == "agent_listing_delta" and a.get("isInitial") and "helpers" not in listing: listing["helpers"] = {"n": len(a.get("addedTypes") or []), "chars": sum(len(x) for x in a.get("addedLines") or [])}
        elif t == "mcp_instructions_delta" and "connectors" not in listing: listing["connectors"] = {"n": len(a.get("addedNames") or []), "chars": sum(len(x) for x in a.get("addedBlocks") or [])}
        elif t == "output_style" and "style" not in listing: listing["style"] = a.get("style")
    if first is None: continue
    am = [x for x in first if x["type"] == "AutoMem"]
    mf = am[0]["path"].split("/projects/")[1].split("/memory/")[0] if am and "/projects/" in am[0]["path"] else None
    mem_folder, mem_proj = (mem_label(mf), mem_project(mf)) if mf else (None, None)
    end_project = project_of(cwds[-1] if cwds else cwd)
    sty = listing.get("style")
    if sty:
        sp = [f for f in files if f["kind"] == "reply style" and os.path.basename(f["path"])[:-3].lower() == str(sty).lower()]
        listing["style_words"] = sp[0]["words"] if sp else None
    loads.append({"id": os.path.basename(f)[:-6], "mem_id": mf, "when": (ts or "")[:16], "project": project_of(cwd), "ended_in": end_project, "moved": len({project_of(c) for c in cwds}) > 1,
                  "files": [{"path": "a private folder" if private(x["path"]) else short(x["path"]), "type": x["type"], "words": x["words"]} for x in first],
                  "memory_from": mem_folder, "memory_project": mem_proj, "listing": listing})
loads.sort(key=lambda x: x["when"])

# ---------- the same rule in many places: sentences that say nearly the same thing, across files ----------
RULEISH = re.compile(r"\b(never|always|don't|do not|no|must|only|avoid|before|after|keep|use|check|ask|without|stop|show|end|start|search|commit|push|write|zero|nothing|every)\b", re.I)
STOP = set("the a an and or of to in on for with is are be it this that you your his he him its as at by from not never no do does don't if when what which who will can should must only one any all each every more most than then so but into out about there their they them we our us was were has have had i me my".split())
def sentences(text):
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"^---.*?---", " ", text, flags=re.S)
    for s in re.split(r"(?<=[.!?])\s+|\n+", text):
        if s.lstrip().startswith("#") or "[[" in s or s.lower().lstrip(" -*").startswith(("related", "**why", "**how", "why:", "how to apply")): continue
        s = re.sub(r"[#*>`_\[\]|]", " ", s).strip(" -•\t")
        if 25 <= len(s) <= 300 and RULEISH.search(s): yield s
def terms(s): return [w for w in re.findall(r"[a-z][a-z'-]{2,}", s.lower().replace("—", " dash ").replace("em-dash", "emdash").replace("em dash", "emdash")) if w not in STOP]
pool = [f for f in files if not f["private"]]
sents = []
for fi, f in enumerate(pool):
    for s in sentences(f["text"]):
        t = set(terms(s))
        if len(t) >= 3: sents.append((fi, s, t))
df = collections.Counter(w for _, _, t in sents for w in t)
N = len(sents)
idf = {w: math.log(N / c) for w, c in df.items()}
vec = [{w: idf[w] for w in t} for _, _, t in sents]
norm = [math.sqrt(sum(v * v for v in x.values())) or 1 for x in vec]
by_term = collections.defaultdict(list)
for i, (_, _, t) in enumerate(sents):
    for w in t:
        if 3 <= df[w] <= 40: by_term[w].append(i)  # compare only sentences that share a fairly rare word
parent = list(range(N))
def find(i):
    while parent[i] != i: parent[i] = parent[parent[i]]; i = parent[i]
    return i
done = set()
for w, ids in by_term.items():
    for x in range(len(ids)):
        for y in range(x + 1, len(ids)):
            i, j = ids[x], ids[y]
            if sents[i][0] == sents[j][0] or (i, j) in done: continue
            done.add((i, j))
            sim = sum(vec[i][k] * vec[j].get(k, 0) for k in vec[i]) / (norm[i] * norm[j])
            if sim >= 0.55: parent[find(i)] = find(j)
groups = collections.defaultdict(list)
for i in range(N): groups[find(i)].append(i)
repeats = []
for ids in groups.values():
    fset = {sents[i][0] for i in ids}
    if len(fset) < 3: continue
    common = collections.Counter(w for i in ids for w in sents[i][2]).most_common(4)
    sample = min((sents[i][1] for i in ids), key=len)
    repeats.append({"files": sorted({short(pool[sents[i][0]]["path"]) for i in ids}), "kinds": sorted({pool[sents[i][0]]["kind"] for i in ids}),
                    "sample": sample[:140], "words": [w for w, _ in common]})
repeats.sort(key=lambda r: -len(r["files"]))

# ---------- pointers to nothing: links between memory notes, and paths that no longer exist ----------
names = collections.defaultdict(set)
for m in mem: names[m["folder"]].add(m["name"]); names[m["folder"]].add(os.path.basename(m["path"])[:-3])
all_names = set().union(*names.values()) if names else set()
broken = []
for m in mem:
    for l in m["links"]:
        if l not in names[m["folder"]]: broken.append({"note": m["name"], "folder": "a private folder" if m["private"] else mem_label(m["folder"]), "to": l, "elsewhere": l in all_names})
PATH = re.compile(r"(?:`|\s|\()((?:~|/Users/[^/\s]+)/[^\s`'\")\]]+|(?:Desktop/Claude_Projects|Ventures|Career|_Knowledge|Education|Side_Projects)/[^\s`'\")\]]+)")
missing = []
for f in pool:
    for p in set(PATH.findall(" " + f["text"])):
        p = p.rstrip(".,;:")
        if "*" in p or "<" in p or "{" in p or "(" in p: continue
        full = p.replace("~", H, 1) if p.startswith("~") else p if p.startswith("/") else (H + "/" + p if p.startswith("Desktop/") else CP + "/" + p)
        if os.path.exists(full): continue
        # a path with a space in it gets cut at the space ("~/Library/Application"); if the cut-off name starts a real one, it's fine
        par, last = os.path.dirname(full.rstrip("/")), os.path.basename(full.rstrip("/"))
        try: cut = os.path.isdir(par) and any(n.startswith(last + " ") for n in os.listdir(par))
        except OSError: cut = False
        if not cut: missing.append({"in": short(f["path"]), "path": p})
# AGENTS.md is skipped when a CLAUDE.md sits in its folder or any folder above it (Claude Code's docs)
shadowed = []
for f in files:
    if not f["path"].endswith("/AGENTS.md") or f["private"]: continue
    d = os.path.dirname(f["path"]); up = d
    while up.startswith(CP):
        if os.path.exists(os.path.join(up, "CLAUDE.md")): shadowed.append({"file": short(f["path"]), "because": short(os.path.join(up, "CLAUDE.md"))}); break
        up = os.path.dirname(up)

# ---------- what memory holds ----------
def age(d):
    try: return (today - datetime.date.fromisoformat(d[:10])).days
    except Exception: return None
by_folder = collections.defaultdict(list)
LBL = {}
for m in mem: LBL.setdefault(m["folder"], "a private folder" if m["private"] else mem_label(m["folder"]))
for m in mem: by_folder[LBL[m["folder"]]].append(m)
memory = {"notes": len(mem), "folders": len(by_folder),
          "kinds": dict(collections.Counter(m["kind"] for m in mem)),
          "stale_90": sum(1 for m in mem if (age(m["modified"]) or 0) >= 90),
          "by_folder": sorted([{"folder": k, "id": None if k == "a private folder" else v[0]["folder"], "notes": len(v), "corrections": sum(1 for m in v if m["kind"] == "feedback"), "oldest_days": max((age(m["modified"]) or 0) for m in v),
                                "stale_90": sum(1 for m in v if (age(m["modified"]) or 0) >= 90), "newest": max(m["modified"] for m in v),
                                "stale_names": [] if k == "a private folder" else sorted(m["name"] for m in v if (age(m["modified"]) or 0) >= 90),
                                "last_loaded": mem_seen.get(v[0]["folder"])} for k, v in by_folder.items()], key=lambda x: -x["notes"])}

# ---------- reviewed by Claude: disagreements a word count can't find (data/instructions-reviewed.json, dated) ----------
REV = os.path.join(DATA, "instructions-reviewed.json")
reviewed = json.load(open(REV)) if os.path.exists(REV) else {"read": None, "items": []}
# a prepared rule change is offered only while every line it replaces is still in its file exactly once; a file you
# changed since drops it, so the page never shows a button that would be refused (QA run 4, finding 6)
def _still(e):
    try: return open(os.path.expanduser(e["file"]), errors="ignore").read().count(e["old"]) == 1
    except Exception: return False
for _cid in list((reviewed.get("changes") or {}).keys()):
    if not all(_still(e) for e in reviewed["changes"][_cid] if e.get("old")):
        reviewed["changes"].pop(_cid); reviewed.setdefault("stale_changes", []).append(_cid)

# typical load for each project: the most recent chat that started there
latest = {}
for l in loads: latest[l["project"]] = l
# chats that moved to another folder keep the memory of the folder they started in (seen in the logs: no new memory loads)
mixed = [l for l in loads if l["moved"] and l["memory_project"] and l["ended_in"] != l["memory_project"] and l["ended_in"] not in ("unknown",)]
out = {"built": datetime.datetime.now().isoformat(timespec="minutes"),
       "files": {"count": len(files), "public": len(pool), "by_kind": dict(collections.Counter(f["kind"] for f in files)), "words": sum(f["words"] for f in files if f["kind"] != "memory note")},
       "loads": {"chats": len(loads), "latest": latest, "since": loads[0]["when"][:10] if loads else None,
                 "moved_memory": {"chats": len(mixed), "since": mixed[0]["when"][:10] if mixed else None,
                        # notes those chats wrote, found by the chat named in each note's header, and where they landed
                        "notes_saved_to_start": sum(1 for l in mixed for p_ in fglob(CD + f"/projects/{l['mem_id']}/memory/*.md") if re.search(r"originSessionId:\s*" + re.escape(l["id"]), open(p_, errors="ignore").read(1500))), "examples": [{"started": l["project"], "ended": l["ended_in"], "memory": l["memory_from"], "when": l["when"]} for l in mixed[-4:]]}},
       "repeats": repeats[:12], "broken_links": broken, "missing_paths": missing[:40], "missing_count": len(missing), "shadowed": shadowed,
       "memory": memory, "reviewed": reviewed}
json.dump(out, open(os.path.join(DATA, "instructions.json"), "w"), indent=1)
print(f"instructions: {len(files)} files, {len(loads)} chats with a load record, {len(repeats)} repeated rules, {len(broken)} broken links, {len(missing)} missing paths, {len(shadowed)} skipped AGENTS.md, {len(mem)} memory notes")
