"""Where to look for someone's projects: the folders their AI chats actually ran in, so Glass Box works on any Mac,
not only one laid out like Milan's. Read from data/sessions.json (sessions.py runs first in the refresh). Milan's
Claude_Projects folder is included when it exists. A chat that ran in the home folder or on the Desktop adds that
folder alone, never everything under it."""
import glob, json, os
from paths import DATA

H = os.path.expanduser("~")
SKIP = ("/node_modules/", "/_Archive/", "/.git/", "/Library/")
SHALLOW = {H, H + "/Desktop", H + "/Documents", H + "/Downloads", "/"}


def _top(folder):
    """The project a folder belongs to: the highest folder above it, below the home folder, with a CLAUDE.md, AGENTS.md,
    .claude or .git in it; otherwise the folder itself."""
    best, d = folder, folder
    while d.startswith(H + "/") and d not in SHALLOW:
        if any(os.path.exists(os.path.join(d, x)) for x in ("CLAUDE.md", "AGENTS.md", ".claude", ".git")): best = d
        d = os.path.dirname(d)
    return best


def project_roots():
    deep, shallow = set(), set()
    hub = H + "/Desktop/Claude_Projects"
    if os.path.isdir(hub): deep.add(hub)
    try: rows = json.load(open(os.path.join(DATA, "sessions.json")))
    except Exception: rows = []
    for r in rows:
        f = r.get("folder")
        if not f or not isinstance(f, str) or not os.path.isdir(f) or any(s in f + "/" for s in SKIP): continue
        if f in SHALLOW: shallow.add(f); continue
        deep.add(_top(f))
    # a root inside another root adds nothing
    deep = {d for d in deep if not any(d != o and d.startswith(o + "/") for o in deep)}
    return sorted(deep), sorted(shallow - deep)


def find(pattern):
    """Every file matching pattern (for example "CLAUDE.md" or ".claude/skills/*/SKILL.md") in the project folders."""
    deep, shallow = project_roots()
    out = set()
    for d in deep: out.update(glob.glob(os.path.join(d, "**", pattern), recursive=True))
    for d in shallow: out.update(glob.glob(os.path.join(d, pattern)))
    return sorted(p for p in out if not any(s in p for s in SKIP) and os.access(p, os.R_OK))


def label(path):
    """A short name for where a file lives: inside Claude_Projects relative to it, elsewhere relative to the home folder."""
    hub = H + "/Desktop/Claude_Projects/"
    return path[len(hub):] if path.startswith(hub) else path.replace(H, "~", 1)


def settings():
    """Claude Code's own settings file, or nothing if this Mac doesn't have one."""
    try: return json.load(open(H + "/.claude/settings.json")) or {}
    except Exception: return {}
