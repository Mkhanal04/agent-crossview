#!/usr/bin/env python3
"""Before a commit: scan the staged text files for day-job and personal words (data/private-patterns.json,
never committed). Images are skipped: three random bytes inside compressed pixels can look like a short word.
Exits 1 on any hit, so `python3 tools/checks/private_scan.py && git commit ...` stops on a real one.
Usage: git add ...; python3 tools/checks/private_scan.py"""
import json, os, re, subprocess, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
pp = os.path.join(ROOT, "data", "private-patterns.json")
if not os.path.exists(pp): sys.exit("No data/private-patterns.json on this Mac, so nothing to scan against.")
pats = {k: re.compile(v) for k, v in json.load(open(pp)).items()}
files = subprocess.run(["git", "-C", ROOT, "diff", "--cached", "--name-only", "--diff-filter=ACMR"], capture_output=True, text=True).stdout.split()
hits, scanned = [], 0
for f in files:
    p = os.path.join(ROOT, f)
    if not os.path.isfile(p): continue
    raw = open(p, "rb").read()
    if b"\0" in raw[:8000] or f.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".ico")): continue
    try: text = raw.decode("utf-8")
    except UnicodeDecodeError: continue
    scanned += 1
    for k, rx in pats.items():
        for m in rx.finditer(text):
            line = text.count("\n", 0, m.start()) + 1
            hits.append(f"{f}:{line} ({k})")
print(f"Scanned {scanned} staged text files: " + ("no private words." if not hits else f"{len(hits)} hit(s)"))
for h in hits: print("  " + h)
sys.exit(1 if hits else 0)
