"""Where the data scripts read and write. Your own data lives in data/ and app/data.js (never committed).
The demo company (tools/demo_company.py) sets GLASSBOX_DATA=demo/data and GLASSBOX_OUT=app/demo-data.js, so the
same scripts build it from made-up files and nothing on this Mac is read."""
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DATA = os.path.abspath(os.environ.get("GLASSBOX_DATA") or os.path.join(ROOT, "data"))
OUT = os.path.abspath(os.environ.get("GLASSBOX_OUT") or os.path.join(ROOT, "app", "data.js"))
DEMO = os.environ.get("GLASSBOX_DEMO") == "1"
os.makedirs(DATA, exist_ok=True)  # a fresh copy has no data folder yet

# ---------- Codex's chat logs: one list and one reader for every script, so every screen counts the same chats ----------
# Newer Codex versions compress older chats to .jsonl.zst (first seen on this Mac Oct 14 2026); both kinds are read.
def codex_logs():
    H = os.path.expanduser("~")
    import glob
    found = {}
    for pat in (H + "/.codex/sessions/**/*.jsonl", H + "/.codex/sessions/**/*.jsonl.zst", H + "/.codex/archived_sessions/*.jsonl", H + "/.codex/archived_sessions/*.jsonl.zst"):
        for p in glob.glob(pat, recursive=True):
            key = p[:-4] if p.endswith(".zst") else p
            if key not in found or not p.endswith(".zst"): found[key] = p  # mid-compression: the plain copy is the whole one
    return sorted(found.values())
def log_lines(path):
    """The lines of one log, plain or compressed. Compressed ones need the zstd command (Homebrew); without it they read as empty."""
    if not path.endswith(".zst"): return open(path, errors="ignore")
    import io, shutil, subprocess
    exe = shutil.which("zstd") or next((p for p in ("/opt/homebrew/bin/zstd", "/usr/local/bin/zstd") if os.path.exists(p)), None)
    if not exe: return []
    try: r = subprocess.run([exe, "-dcq", path], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=120)
    except Exception: return []
    return io.StringIO(r.stdout.decode("utf-8", "ignore"))
