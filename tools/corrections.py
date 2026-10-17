#!/usr/bin/env python3
"""What you keep correcting (opt-in, Milan's yes on Oct 14 2026). Reads the messages YOU typed in Claude Code chats on
this Mac, finds the ones that correct or push back on Claude, and sorts them into plain topics by fixed word lists.
Runs only on this Mac and keeps only counts: no message text is written anywhere, printed, or sent. Chats in your
private folders (day job, personal) are skipped entirely. Usage: python3 tools/corrections.py
Writes data/corrections.json (private, never committed). It runs on a refresh only once you've said yes: the first
run needs --start, and after that the existing data/corrections.json is the sign that you opted in."""
import collections, datetime, glob, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import DATA
if not os.path.exists(os.path.join(DATA, "corrections.json")) and "--start" not in sys.argv:
    print("Not switched on: nothing read. Run it once with --start to opt in."); sys.exit(0)

H = os.path.expanduser("~"); CP = H + "/Desktop/Claude_Projects"
try: PRIV = [re.compile(p) for p in json.load(open(os.path.join(DATA, "private-patterns.json"))).values()]
except Exception: PRIV = []
private = lambda s: any(r.search(s or "") for r in PRIV)

# a message pushes back when it says it again, stops something, or says it's wrong
SIGNALS = {
    "says it again": r"\b(already (told|said|mentioned|asked|explained)|i (said|told you|mentioned)|as i said|how many times|again[,.!? ]|previously|i keep (saying|telling)|you keep|still (not|doesn'?t|isn'?t|wrong))",
    "stops or undoes": r"\b(stop|don'?t|do not|undo|revert|roll ?back|not what i (asked|meant|wanted|said)|that'?s not|no[,.!]\s)",
    "says it's wrong": r"\b(wrong|incorrect|not right|doesn'?t (work|match|make sense)|broken|made up|hallucinat|inaccurate|that'?s false)",
    "frustration": r"(\bf+u+c+k|\bshit\b|bullshit|\bwtf\b|\bdamn\b|!!|\?!|\bugh\b|annoy|frustrat|pissed|repulsive|ridiculous)",
}
# what the push-back is about: plain topics, each a short word list
TOPICS = {
    "too long or complicated": r"\b(too long|long (reply|response|answer)|concise|shorter|complicated|complex|too much|plain (words|english|language)|simple|simpler|summari[sz]e|tl;?dr|jargon)",
    "my own words echoed or wrong voice": r"\b(my words|my phrase|echo|repeat(ing)? (back|my)|sounds? (like|ai)|tone|voice|em.?dash|hyphen)",
    "asking instead of doing, or doing without asking": r"\b(just do|go ahead|don'?t ask|stop asking|without asking|ask(ed)? me first|why did you (change|do|delete|push)|permission|confirm)",
    "check live, don't guess": r"\b(search|research|latest|up to date|outdated|verify|double.?check|check (online|the web|live)|make sure|assum)",
    "files and docs as homework": r"\b(\.md\b|brief|document|doc\b|read (the|this) file|review (the|this) (doc|file)|in (the )?chat)",
    "links, files, where things are": r"\b(link|url|can'?t (find|open)|where (is|are|did)|which folder|open (it|the)|path)",
    "memory and lost context": r"\b(remember|forgot|forget|context|handoff|memory|lost|carry over|new chat|previous chat|last session|we (discussed|agreed|decided))",
    "design and how it looks": r"\b(design|layout|ugly|sloppy|visual|look(s|ing)? (bad|off|wrong)|moves?|align|font|color|colour|spacing)",
    "agreeing too fast or reopening decisions": r"\b(just agree|agreeing|push ?back|reconsider|challenge|devil|decided|decision|i already decided)",
    "numbers and facts": r"\b(number|count|math|doesn'?t add|figure|percent|\$\d|cost|price)",
    "piecemeal fixes": r"\b(piecemeal|one by one|batch|all at once|plan first|one plan)",
}
SIG = {k: re.compile(v, re.I) for k, v in SIGNALS.items()}
TOP = {k: re.compile(v, re.I) for k, v in TOPICS.items()}

def project_of(folder):
    if not folder: return "unknown"
    if "/scratch-workspaces/" in folder: return "a Claude app scratch chat"
    if folder.startswith(CP):
        rest = folder[len(CP):].strip("/").split("/")
        if not rest or not rest[0]: return "your main folder"
        return "/".join(rest[:2]) if rest[0] in ("Ventures", "Career", "Education", "Side_Projects") and len(rest) > 1 else rest[0]
    return folder.replace(H, "~")

# chats that start outside a project folder read the main rule file but not a project's rules or notes
OUTSIDE = {"your main folder", "~/Desktop", "a Claude app scratch chat", "unknown", "~"}
# Oct 14 2026, 8:25 am Central: his rule change (open chats in the project folder; settled calls in a Decided list)
CHANGE = "2026-10-14T13:25"  # the logs are in UTC

def week(ts):
    d = datetime.date.fromisoformat(ts[:10]); return (d - datetime.timedelta(days=d.weekday())).isoformat()

chats = []
for f in glob.glob(H + "/.claude/projects/*/*.jsonl"):
    msgs, cwds, skip = [], [], False
    for line in open(f, errors="ignore"):
        if '"type":"user"' not in line: continue
        try: d = json.loads(line)
        except Exception: continue
        if d.get("isMeta") or d.get("isSidechain"): continue
        if d.get("cwd"):
            if private(d["cwd"]): skip = True; break
            if not cwds or cwds[-1] != d["cwd"]: cwds.append(d["cwd"])
        m = d.get("message") or {}
        c = m.get("content")
        if isinstance(c, list): c = " ".join(x.get("text", "") for x in c if isinstance(x, dict) and x.get("type") == "text")
        if not isinstance(c, str): continue
        t = c.strip()
        if not t or t.startswith("<") or t.startswith("Caveat:") or "[Request interrupted" in t: continue
        msgs.append((d.get("timestamp") or "", t))
    if skip or not msgs: continue
    chats.append({"id": os.path.basename(f)[:-6], "start": project_of(cwds[0]) if cwds else "unknown", "moved": len({project_of(c) for c in cwds}) > 1, "msgs": msgs})

total = sum(len(c["msgs"]) for c in chats)
pb = 0; sig_n = collections.Counter(); top_n = collections.Counter(); by_proj = collections.defaultdict(lambda: [0, 0]); by_week = collections.defaultdict(lambda: [0, 0])
early = [0, 0]; moved = [0, 0]; stay = [0, 0]; first_hits = collections.Counter()
top_out = collections.Counter(); top_moved = collections.Counter(); after = [0, 0]; before = [0, 0]
since = (datetime.datetime.fromisoformat(CHANGE) - datetime.timedelta(days=14)).isoformat()
for c in chats:
    for i, (ts, t) in enumerate(c["msgs"]):
        hit = [k for k, r in SIG.items() if r.search(t)]
        bp = by_proj[c["start"]]; bp[0] += 1
        if ts: bw = by_week[week(ts)]; bw[0] += 1
        (moved if c["moved"] else stay)[0] += 1
        if i < 5: early[0] += 1
        if ts >= CHANGE: after[0] += 1
        elif ts >= since: before[0] += 1
        if not hit: continue
        if ts >= CHANGE: after[1] += 1
        elif ts >= since: before[1] += 1
        pb += 1; bp[1] += 1
        if ts: bw[1] += 1
        (moved if c["moved"] else stay)[1] += 1
        if i < 5: early[1] += 1
        for k in hit: sig_n[k] += 1
        topics = [k for k, r in TOP.items() if r.search(t)]
        for k in topics:
            top_n[k] += 1
            if c["start"] in OUTSIDE: top_out[k] += 1
            if c["moved"]: top_moved[k] += 1
        if i < 5:
            for k in topics: first_hits[k] += 1

# is each topic written down where a chat would read it? (rule files and Claude's notes, by the same word lists)
def texts(paths):
    out = []
    for p in paths:
        if "/_Archive/" in p or private(p): continue
        try: out.append(open(p, errors="ignore").read())
        except OSError: pass
    return out
main_rule = texts([H + "/.claude/CLAUDE.md"])
rule_files = texts([H + "/.claude/CLAUDE.md"] + glob.glob(CP + "/**/CLAUDE.md", recursive=True) + glob.glob(H + "/.claude/output-styles/*.md"))
note_files = texts(glob.glob(H + "/.claude/projects/*/memory/*.md"))
rule_text, note_text = "\n".join(rule_files), "\n".join(note_files)
# mentions: how often the topic's words appear; files: in how many files (main rule file, all rule files, notes)
written = {k: {"in_rules": len(r.findall(rule_text)), "in_notes": len(r.findall(note_text)),
               "main_rule": any(r.search(t) for t in main_rule), "rule_files": sum(1 for t in rule_files if r.search(t)),
               "note_files": sum(1 for t in note_files if r.search(t))} for k, r in TOP.items()}

pct = lambda a, b: round(100 * a / b) if b else 0
out = {"built": datetime.datetime.now().isoformat(timespec="minutes"), "chats": len(chats), "messages": total, "pushback": pb, "pushback_pct": pct(pb, total),
       "signals": dict(sig_n.most_common()), "topics": dict(top_n.most_common()),
       "topics_in_first_five": dict(first_hits.most_common()),
       "early_pct": pct(early[1], early[0]), "later_pct": pct(pb - early[1], total - early[0]),
       "moved_pct": pct(moved[1], moved[0]), "stayed_pct": pct(stay[1], stay[0]), "moved_msgs": moved[0],
       "by_project": {k: {"messages": v[0], "pushback": v[1], "pct": pct(v[1], v[0])} for k, v in sorted(by_proj.items(), key=lambda kv: -kv[1][0]) if v[0] >= 20},
       "by_week": {k: {"messages": v[0], "pushback": v[1], "pct": pct(v[1], v[0])} for k, v in sorted(by_week.items())},
       "written_down": written,
       "outside_msgs_pct": pct(sum(v[0] for k, v in by_proj.items() if k in OUTSIDE), total), "outside_pushback_pct": pct(sum(v[1] for k, v in by_proj.items() if k in OUTSIDE), pb),
       "topic_outside_pct": {k: pct(top_out[k], n) for k, n in top_n.items()}, "topic_moved_pct": {k: pct(top_moved[k], n) for k, n in top_n.items()},
       "change": {"at": "2026-10-14T08:25", "after_msgs": after[0], "after_pushback": after[1], "after_pct": pct(after[1], after[0]),
                  "before_msgs": before[0], "before_pushback": before[1], "before_pct": pct(before[1], before[0]), "enough": 100}}
json.dump(out, open(os.path.join(DATA, "corrections.json"), "w"), indent=1)
print("Wrote data/corrections.json: %d chats, %d messages, %d push-backs (counts only)." % (len(chats), total, pb))
