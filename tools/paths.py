"""Where the data scripts read and write. Your own data lives in data/ and app/data.js (never committed).
The demo company (tools/demo_company.py) sets GLASSBOX_DATA=demo/data and GLASSBOX_OUT=app/demo-data.js, so the
same scripts build it from made-up files and nothing on this computer is read.

Where each app keeps its records, on a Mac and on Windows, is also kept here and only here (Oct 17), so every script
looks in the same places. Every path is written with forward slashes, which Windows accepts too, so the scripts can
compare and split paths the same way on both. Each place below says where it comes from; "unconfirmed" means only
third-party guides say so, so the readers look in every known place and say which ones they couldn't find."""
import glob as _glob, os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DATA = os.path.abspath(os.environ.get("GLASSBOX_DATA") or os.path.join(ROOT, "data"))
OUT = os.path.abspath(os.environ.get("GLASSBOX_OUT") or os.path.join(ROOT, "app", "data.js"))
DEMO = os.environ.get("GLASSBOX_DEMO") == "1"
os.makedirs(DATA, exist_ok=True)  # a fresh copy has no data folder yet
WIN = os.name == "nt"
SYSTEM = "windows" if WIN else "mac" if sys.platform == "darwin" else "linux"


def slash(p):
    """A path with forward slashes (Windows gives backslashes; both work for opening files)."""
    return p.replace("\\", "/") if isinstance(p, str) else p


def same(a, b):
    """Two paths are the same place (Windows ignores upper and lower case)."""
    a, b = slash(a or "").rstrip("/"), slash(b or "").rstrip("/")
    return a.lower() == b.lower() if WIN else a == b


def under(p, top):
    """p is inside the folder top (not top itself)."""
    p, top = slash(p or ""), slash(top or "").rstrip("/") + "/"
    return p.lower().startswith(top.lower()) if WIN else p.startswith(top)


HOME = slash(os.path.expanduser("~"))


def files(pattern):
    """Every file matching a glob pattern, in the order the system lists them, written with forward slashes."""
    return [slash(p) for p in _glob.glob(pattern, recursive="**" in pattern)]


def stamp(dt, fmt):
    """strftime with %-d and %-I (a day or hour without a leading zero), which Windows' strftime doesn't take."""
    fmt = fmt.replace("%-d", str(dt.day))
    if "%-I" in fmt: fmt = fmt.replace("%-I", str(dt.hour % 12 or 12))
    return dt.strftime(fmt)


# ---------- Claude Code ----------
# Its folder is .claude in your home folder on every system (Anthropic's Claude Code docs, settings page); setting
# CLAUDE_CONFIG_DIR moves it (Claude Code's environment variables page).
def claude_dir():
    return slash(os.environ.get("CLAUDE_CONFIG_DIR") or HOME + "/.claude").rstrip("/")


def claude_json():
    """Claude Code's own file of connectors and per-folder settings: ~/.claude.json, or inside CLAUDE_CONFIG_DIR when set."""
    d = os.environ.get("CLAUDE_CONFIG_DIR")
    return slash(d).rstrip("/") + "/.claude.json" if d else HOME + "/.claude.json"


def claude_logs(helpers=False):
    """Claude Code's chat logs: one file per chat, in a folder named after the project's path."""
    return files(claude_dir() + ("/projects/*/*/subagents/*.jsonl" if helpers else "/projects/*/*.jsonl"))


def folder_id(path):
    """The name Claude Code gives a project's folder in its projects folder: the path with every character that isn't
    a letter or a digit turned into a dash (/Users/ann/site is -Users-ann-site; C:\\Users\\ann\\site is C--Users-ann-site)."""
    import re
    return re.sub(r"[^A-Za-z0-9]", "-", path or "")


# Company-managed settings, set by an administrator and read-only to you (Anthropic's Claude Code docs, managed settings
# page, checked Oct 17 2026): managed-settings.json plus any files in managed-settings.d, in a system folder. On Windows
# that's C:\Program Files\ClaudeCode; Claude Code no longer reads the older C:\ProgramData\ClaudeCode, so neither does this.
# Settings a company sends from Claude's admin console, or through device management, are read in managed_settings().
def managed_dir():
    if os.environ.get("GLASSBOX_MANAGED"): return slash(os.environ["GLASSBOX_MANAGED"]).rstrip("/")  # made-up company settings, for testing
    if WIN: return slash(os.environ.get("ProgramFiles") or "C:/Program Files") + "/ClaudeCode"
    if sys.platform == "darwin": return "/Library/Application Support/ClaudeCode"
    return "/etc/claude-code"


def managed_settings_paths():
    d = managed_dir()
    return [d + "/managed-settings.json"] + sorted(files(d + "/managed-settings.d/*.json"))


def managed_settings():
    """Every setting your company manages, merged, and where it came from. Empty when there are none."""
    import json
    out, where = {}, []
    def merge(a, b):
        for k, v in b.items():
            if isinstance(v, dict) and isinstance(a.get(k), dict): merge(a[k], v)
            elif isinstance(v, list) and isinstance(a.get(k), list): a[k] = a[k] + [x for x in v if x not in a[k]]
            else: a[k] = v
    def take(d, label):
        if isinstance(d, dict) and isinstance(d.get("Settings"), str):  # a policy can hold the settings as one JSON text
            try: d = json.loads(d["Settings"])
            except Exception: return
        if isinstance(d, dict) and d: merge(out, d); where.append(label)
    # the first of these that holds anything wins, unless it says to merge (managedSourcesBehavior), as in Claude Code
    sources = []
    if not os.environ.get("GLASSBOX_MANAGED"):
        if WIN:  # a policy set through Windows' registry (the same page)
            try:
                import winreg
                with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Policies\ClaudeCode") as k: sources.append(("Windows policy", json.loads(winreg.QueryValueEx(k, "Settings")[0])))
            except Exception: pass
        elif sys.platform == "darwin":  # a profile from the company's device management
            try:
                import plistlib
                with open("/Library/Managed Preferences/com.anthropic.claudecode.plist", "rb") as f: sources.append(("device management", plistlib.load(f)))
            except Exception: pass
    got = {}
    for p in managed_settings_paths():
        try:
            with open(p, encoding="utf-8") as f: merge(got, json.load(f))
        except Exception: pass
    if got: sources.append(("file", got))
    for label, d in sources:
        take(d, label)
        if out.get("managedSourcesBehavior") != "merge": break
    return out, where


# ---------- the Claude app (Cowork runs inside it) ----------
# Mac: ~/Library/Application Support/Claude (Anthropic's help page on the desktop app's config file).
# Windows: %APPDATA%\Claude for the usual installer (the same page); the Microsoft Store version keeps its files under
# %LOCALAPPDATA%\Packages\Claude_...\LocalCache\Roaming\Claude (unconfirmed: how Windows stores Store apps' files).
def claude_app_dirs():
    if os.environ.get("GLASSBOX_APP_DIR"): return [slash(os.environ["GLASSBOX_APP_DIR"]).rstrip("/")]
    if WIN:
        out = []
        if os.environ.get("APPDATA"): out.append(slash(os.environ["APPDATA"]) + "/Claude")
        out.append(HOME + "/AppData/Roaming/Claude")
        local = slash(os.environ.get("LOCALAPPDATA") or HOME + "/AppData/Local")
        out += [p + "/LocalCache/Roaming/Claude" for p in files(local + "/Packages/Claude_*")]
        return list(dict.fromkeys(out))
    if sys.platform == "darwin": return [HOME + "/Library/Application Support/Claude"]
    return [HOME + "/.config/Claude"]


def claude_app_dir():
    """The Claude app's folder, with a slash at the end: the one that holds Cowork's tasks, else its settings file,
    else the first that exists, else the usual place (so a missing app reads as empty)."""
    ds = claude_app_dirs()
    for test in ("local-agent-mode-sessions", "claude_desktop_config.json", ""):
        for d in ds:
            if os.path.exists(d + "/" + test if test else d): return d + "/"
    return ds[0] + "/"


def cowork_dir():
    return claude_app_dir() + "local-agent-mode-sessions"


def session_of(path):
    """The Cowork task a file belongs to: the local_... folder in its path."""
    return "local_" + slash(path).split("/local_")[1].split("/")[0]


# ---------- Codex ----------
# Its folder is .codex in your home folder, or CODEX_HOME when set (OpenAI's Codex docs). Codex run inside WSL on
# Windows keeps its records inside WSL's own Linux files instead, where this can't see them.
def codex_dir():
    return slash(os.environ.get("CODEX_HOME") or HOME + "/.codex").rstrip("/")


# Newer Codex versions compress older chats to .jsonl.zst (first seen on this Mac Oct 14 2026); both kinds are read.
def codex_logs():
    C = codex_dir()
    found = {}
    for pat in (C + "/sessions/**/*.jsonl", C + "/sessions/**/*.jsonl.zst", C + "/archived_sessions/*.jsonl", C + "/archived_sessions/*.jsonl.zst"):
        for p in files(pat):
            key = p[:-4] if p.endswith(".zst") else p
            if key not in found or not p.endswith(".zst"): found[key] = p  # mid-compression: the plain copy is the whole one
    return sorted(found.values())


def log_lines(path):
    """The lines of one log, plain or compressed. Compressed ones are read with Python's own zstd (Python 3.14 and later),
    else the zstd command (Homebrew on a Mac; winget or scoop on Windows); without either they read as empty."""
    if not path.endswith(".zst"): return open(path, encoding="utf-8", errors="ignore")
    import io
    try:
        from compression import zstd  # Python 3.14+
        with open(path, "rb") as f: return io.StringIO(zstd.decompress(f.read()).decode("utf-8", "ignore"))
    except Exception: pass
    import shutil, subprocess
    exe = zstd_command()
    if not exe: return []
    try: r = subprocess.run([exe, "-dcq", path], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=120)
    except Exception: return []
    return io.StringIO(r.stdout.decode("utf-8", "ignore"))


def zstd_command():
    import shutil
    return shutil.which("zstd") or next((p for p in ("/opt/homebrew/bin/zstd", "/usr/local/bin/zstd") if os.path.exists(p)), None)


def can_read_compressed():
    try:
        from compression import zstd  # noqa: F401
        return True
    except Exception: return bool(zstd_command())


# ---------- what was found, for the refresh to say plainly ----------
def where_looked():
    """For each app: where its records were found, or every place looked in when none were."""
    cc = claude_dir()
    cx = codex_dir()
    cw = [d + "/local-agent-mode-sessions" for d in claude_app_dirs()]
    zst = [p for p in codex_logs() if p.endswith(".zst")]
    return {
        "Claude Code": {"found": cc if claude_logs() else None, "looked": [cc + "/projects"]},
        "Codex": {"found": cx if codex_logs() else None, "looked": [cx + "/sessions", cx + "/archived_sessions"],
                  "compressed_unread": len(zst) if zst and not can_read_compressed() else 0},
        "Cowork": {"found": next((d for d in cw if os.path.isdir(d)), None), "looked": cw},
        "Company settings": {"found": managed_dir() if managed_settings()[0] else None, "looked": [managed_dir()]},
    }
