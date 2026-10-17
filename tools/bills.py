#!/usr/bin/env python3
"""What you actually pay: your plans (data/plans.json) and any API bills you exported into data/bills/
(the Claude Console's usage or cost CSV, fal.ai's billing report). Writes data/bills.json. Nothing is fetched;
only files you put there are read. API keys are mapped to pieces of work in data/bill-keys.json.
Usage: python3 tools/bills.py"""
import csv, glob, json, os, re, sys, collections, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import DATA, OUT, DEMO
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
D = DATA
plans = json.load(open(os.path.join(D, "plans.json"))) if os.path.exists(os.path.join(D, "plans.json")) else {"plans": []}
keymap_path = os.path.join(D, "bill-keys.json")
keymap = json.load(open(keymap_path)) if os.path.exists(keymap_path) else {}

def num(v):
    try: return float(re.sub(r"[^0-9.\-]", "", str(v)) or 0)
    except ValueError: return 0.0
def pick(cols, *pats):
    for p in pats:
        for c in cols:
            if re.search(p, c, re.I): return c
    return None
def day_of(v):
    s = str(v or "").strip()
    m = re.match(r"(\d{4}-\d{2}-\d{2})", s)
    if m: return m.group(1)
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", s)
    if m: return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
    m = re.match(r"(\d{4})-(\d{2})$", s)
    return f"{m.group(1)}-{m.group(2)}-01" if m else None

sources = []
for f in sorted(glob.glob(os.path.join(D, "bills", "*.csv"))):
    name = os.path.basename(f).lower()
    vendor = "fal.ai" if "fal" in name else "Anthropic API" if any(k in name for k in ("anthropic", "claude", "console", "usage", "cost")) else "Other API"
    rows = list(csv.DictReader(open(f, newline="", encoding="utf-8-sig")))
    if not rows: continue
    cols = list(rows[0].keys())
    c_usd = pick(cols, r"^cost.*usd|usd|amount|cost|price|spend|total")
    c_day = pick(cols, r"date|day|time|period|month|start")
    c_key = pick(cols, r"api.?key|key.?name|key|workspace|project")
    c_what = pick(cols, r"model|endpoint|app|product|description")
    by_day, by_key, by_what = collections.Counter(), collections.Counter(), collections.Counter()
    total = 0.0
    for r in rows:
        usd = num(r.get(c_usd)) if c_usd else 0.0
        if not usd: continue
        total += usd
        d = day_of(r.get(c_day)) if c_day else None
        if d: by_day[d] += usd
        k = (r.get(c_key) or "").strip() if c_key else ""
        by_key[k or "not named"] += usd
        if c_what: by_what[(r.get(c_what) or "").strip() or "not named"] += usd
    sources.append({"vendor": vendor, "file": os.path.basename(f), "rows": len(rows), "usd": round(total, 2),
                    "columns": {"usd": c_usd, "day": c_day, "key": c_key, "what": c_what},
                    "by_day": {k: round(v, 2) for k, v in sorted(by_day.items())},
                    "by_key": {k: round(v, 2) for k, v in by_key.most_common()},
                    "by_what": {k: round(v, 2) for k, v in by_what.most_common(12)},
                    "key_work": {k: keymap.get(k) for k in by_key}})
mp = os.path.join(D, "bills-manual.json")
manual = (json.load(open(mp)) if os.path.exists(mp) else {}).get("entries", [])
# "asked": whether the person has told Glass Box their plans yet (on a fresh copy, Your week asks first)
out = {"manual": manual, "plans": plans.get("plans", []), "plans_note": plans.get("note", ""), "plans_asked": os.path.exists(os.path.join(D, "plans.json")), "sources": sources,
       "bills_folder": "data/bills", "read": datetime.datetime.now().isoformat(timespec="minutes")}
json.dump(out, open(os.path.join(D, "bills.json"), "w"), indent=1)
print("bills:", len(out["plans"]), "plans,", len(sources), "bill files", [(s["vendor"], s["usd"]) for s in sources])
