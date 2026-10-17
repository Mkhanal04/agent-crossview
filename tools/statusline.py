#!/usr/bin/env python3
"""Crossview's line at the bottom of Claude Code: your 5-hour and weekly limits, and a warning before you run out.

Claude Code runs this after each reply and passes a small JSON note on stdin; for Pro and Max plans it includes
how much of the 5-hour and weekly limits is used and when each resets. This script:
  - prints one line, for example "5-hour 62% · at this pace, out by 3:40 pm (resets 4:00 pm) · week 41%";
    the warning part is orange, the one color that means "needs you";
  - keeps a small log of those readings (time, the two percentages, the two reset times, the model) in
    data/pace-log.jsonl, so Crossview can forecast and explain. Nothing else from the note is kept: not the
    folder, not the chat, not what you wrote.
It's switched on from Crossview (Your week, "What used up my limit?") only when you say yes, and switched off there.
Python 3.7 or later, standard library only, no network. Never fails loudly: a problem prints a plain line instead."""
import datetime, json, os, sys, time

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
LOG = os.environ.get("GLASSBOX_PACE_LOG") or os.path.join(ROOT, "data", "pace-log.jsonl")
ORANGE, DIM, RESET = "\033[38;5;208m", "\033[2m", "\033[0m"
# judge the pace from recent readings in the same window: the last 45 minutes for the 5-hour limit (once they span
# 5 minutes), the last 6 hours for the weekly one (once they span an hour)
LOOK = {"fh": (45 * 60, 5 * 60), "sd": (6 * 3600, 3600)}


def clock(t):
    s = datetime.datetime.fromtimestamp(t).strftime("%I:%M %p").lstrip("0").lower()
    return s.replace(":00 ", " ")


def day_or_clock(t, now):
    d = datetime.datetime.fromtimestamp(t)
    return clock(t) if d.date() == datetime.datetime.fromtimestamp(now).date() else d.strftime("%a ") + clock(t)


def read_log():
    try:
        with open(LOG) as f: lines = f.readlines()[-600:]
    except Exception: return []
    out = []
    for l in lines:
        try: out.append(json.loads(l))
        except Exception: pass
    return out


def write_log(rows, rec):
    # one line when a percentage moves, or every 3 minutes at most; the file is trimmed now and then
    last = rows[-1] if rows else None
    if last and last.get("fh") == rec["fh"] and last.get("sd") == rec["sd"] and rec["t"] - last.get("t", 0) < 180: return
    try:
        os.makedirs(os.path.dirname(LOG), exist_ok=True)
        with open(LOG, "a") as f: f.write(json.dumps(rec) + "\n")
        if os.path.getsize(LOG) > 400_000:
            keep = read_log()[-2000:]
            with open(LOG, "w") as f: f.write("".join(json.dumps(r) + "\n" for r in keep))
    except Exception:
        pass


def pace(rows, key, rkey, now, pct, resets):
    """When the limit would be used up at the recent pace, or None if it won't before it resets."""
    if pct is None or not resets or pct >= 100: return None
    back, need = LOOK[key]
    same = [r for r in rows if r.get(rkey) and abs(r[rkey] - resets) < 120 and r.get(key) is not None and now - r["t"] <= back]
    if not same: return None
    first = same[0]
    span, rise = now - first["t"], pct - first[key]
    if span < need or rise < 2: return None
    out = now + (100 - pct) * span / rise
    return out if out < resets - 120 else None


def line(note, rows, now):
    rl = note.get("rate_limits") or {}
    fh, sd = rl.get("five_hour") or {}, rl.get("seven_day") or {}
    p5, r5 = fh.get("used_percentage"), fh.get("resets_at")
    pw, rw = sd.get("used_percentage"), sd.get("resets_at")
    if p5 is None and pw is None:
        return DIM + "Crossview: your limits show here after the first reply" + RESET, None
    p5 = None if p5 is None else round(p5)
    pw = None if pw is None else round(pw)
    rec = {"t": int(now), "fh": p5, "fh_resets": r5, "sd": pw, "sd_resets": rw, "model": ((note.get("model") or {}).get("id") or "")[:40]}
    parts = []
    if p5 is not None:
        out = pace(rows + [rec], "fh", "fh_resets", now, p5, r5)
        if p5 >= 100: parts.append(ORANGE + f"5-hour limit reached · reopens {clock(r5)}" + RESET if r5 else ORANGE + "5-hour limit reached" + RESET)
        elif out: parts.append(f"5-hour {p5}% · " + ORANGE + f"at this pace, out by {clock(out)}" + RESET + (f" (resets {clock(r5)})" if r5 else ""))
        else: parts.append(f"5-hour {p5}%" + (DIM + f" · resets {clock(r5)}" + RESET if r5 else ""))
    if pw is not None:
        out = pace(rows + [rec], "sd", "sd_resets", now, pw, rw) if pw >= 50 else None
        if pw >= 100: parts.append(ORANGE + "weekly limit reached" + (f" · reopens {day_or_clock(rw, now)}" if rw else "") + RESET)
        elif out: parts.append(f"week {pw}% · " + ORANGE + f"at this pace, out by {day_or_clock(out, now)}" + RESET)
        else: parts.append(f"week {pw}%" if pw < 80 else ORANGE + f"week {pw}%" + RESET)
    return " · ".join(parts), rec


def main():
    now = time.time()
    try: note = json.loads(sys.stdin.read() or "{}")
    except Exception: note = {}
    rows = read_log()
    try:
        text, rec = line(note, rows, now)
        if rec: write_log(rows, rec)
    except Exception:
        text = "Crossview: couldn't read the limits this time"
    print(text)


if __name__ == "__main__":
    main()
