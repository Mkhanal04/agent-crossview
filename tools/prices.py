"""List prices per million tokens, used to estimate what logged work would cost on pay-per-token plans.
These are estimates, never his bill: Claude and ChatGPT subscriptions are flat fees.

Claude: https://platform.claude.com/docs/en/about-claude/pricing (read Oct 10 2026, rechecked Oct 19 2026).
OpenAI: https://developers.openai.com/api/docs/pricing (read Oct 10 2026, rechecked Oct 19 2026; GPT-5.6 Sol at its promotional
rate, which the page says runs at least through Nov 21 2026).
Prices are today's, applied to all past work, so older work is priced at today's rates."""

CHECKED = "Oct 19, 2026"  # rechecked live Oct 19 (research/25): no changes since Oct 10
SOURCES = {"Claude": "platform.claude.com/docs/en/about-claude/pricing", "OpenAI": "developers.openai.com/api/docs/pricing"}

# Claude: input, 5-minute cache write, 1-hour cache write, cache read, output ($ per million tokens)
CLAUDE = {
    "claude-fable-5-1": (10, 12.5, 20, 0.25, 50), "claude-mythos-5-1": (10, 12.5, 20, 0.25, 50),
    "claude-fable-5": (10, 12.5, 20, 1, 50), "claude-mythos-5": (10, 12.5, 20, 1, 50),
    "claude-opus-5-5": (4, 5, 8, 0.20, 20), "claude-opus-5": (5, 6.25, 10, 0.50, 25),
    "claude-opus-4-8": (5, 6.25, 10, 0.50, 25), "claude-opus-4-7": (5, 6.25, 10, 0.50, 25),
    "claude-opus-4-6": (5, 6.25, 10, 0.50, 25), "claude-opus-4-5": (5, 6.25, 10, 0.50, 25),
    "claude-opus-4-1": (15, 18.75, 30, 1.50, 75),
    "claude-sonnet-5-5": (2, 2.5, 4, 0.10, 10), "claude-sonnet-5": (2, 2.5, 4, 0.20, 10),
    "claude-sonnet-4-6": (3, 3.75, 6, 0.30, 15), "claude-sonnet-4-5": (3, 3.75, 6, 0.30, 15),
    "claude-haiku-5-5": (0.10, 0.125, 0.20, 0.01, 0.50), "claude-haiku-4-5": (1, 1.25, 2, 0.10, 5),
}
HAIKU_55_LONG = (0.50, 0.625, 1, 0.05, 2.50)  # prompts over 100,000 tokens, counting cache reads and writes
FAST = {"claude-opus-5-5": (8, 40), "claude-opus-5": (10, 50), "claude-opus-4-8": (10, 50)}  # fast mode input, output
WEB_SEARCH = 10 / 1000  # $ per search

# OpenAI (Codex): input, cached input, cache write, output; then the same four over 272K input tokens
OPENAI = {
    "gpt-6.1-sol": ((2, 0.10, 2.5, 10), (4, 0.20, 5, 15)),
    "gpt-6-sol": ((2, 0.20, 2.5, 10), (4, 0.40, 5, 15)),
    "gpt-6-astra": ((10, 1, 12.5, 50), (20, 2, 25, 75)),
    "gpt-5.6-sol": ((4, 0.40, 5, 20), (8, 0.80, 10, 30)),
    "gpt-5.6-terra": ((2, 0.20, 2.5, 12), (4, 0.40, 5, 18)),
    "gpt-5.3-codex": ((1.75, 0.175, 1.75, 14), (1.75, 0.175, 1.75, 14)),
}


def base_model(m):
    m = (m or "").split("[")[0]
    for k in sorted(CLAUDE, key=len, reverse=True):
        if m == k or m.startswith(k + "-"):  # dated ids such as claude-haiku-4-5-20251001
            return k
    return m


def claude_cost(model, u):
    """u: a Claude usage record. Returns (usd, priced). Unknown models return (0, False)."""
    k = base_model(model)
    if k not in CLAUDE: return 0.0, False
    cc = u.get("cache_creation") or {}
    w1h = cc.get("ephemeral_1h_input_tokens") or 0
    w5m = cc.get("ephemeral_5m_input_tokens")
    if w5m is None: w5m = max(0, (u.get("cache_creation_input_tokens") or 0) - w1h)
    inp, rd, out = u.get("input_tokens") or 0, u.get("cache_read_input_tokens") or 0, u.get("output_tokens") or 0
    p = CLAUDE[k]
    if k == "claude-haiku-5-5" and inp + rd + w5m + w1h > 100_000: p = HAIKU_55_LONG
    if u.get("speed") == "fast" and k in FAST:
        fi, fo = FAST[k]; s = fi / p[0]; p = (fi, p[1] * s, p[2] * s, p[3] * s, fo)
    usd = (inp * p[0] + w5m * p[1] + w1h * p[2] + rd * p[3] + out * p[4]) / 1e6
    usd += ((u.get("server_tool_use") or {}).get("web_search_requests") or 0) * WEB_SEARCH
    if str(u.get("inference_geo")) == "us": usd *= 1.1
    return usd, True


def openai_cost(model, u):
    """u: a Codex usage record (input_tokens includes cached; output_tokens includes reasoning)."""
    if model not in OPENAI: return 0.0, False
    inp, cached, write, out = (u.get("input_tokens") or 0), (u.get("cached_input_tokens") or 0), (u.get("cache_write_input_tokens") or 0), (u.get("output_tokens") or 0)
    p = OPENAI[model][1 if inp > 272_000 else 0]
    fresh = max(0, inp - cached - write)
    return (fresh * p[0] + cached * p[1] + write * p[2] + out * p[3]) / 1e6, True


def split_usd(model, row):
    """Where a ledger row's list price went: re-reading (cache reads), new input, writing (output, including the
    estimate for helper writing the logs dropped) and storing for re-reading (cache writes and anything else, as the remainder)."""
    k = base_model(model)
    if k in CLAUDE: p_in, p_read, p_out = CLAUDE[k][0], CLAUDE[k][3], CLAUDE[k][4]
    elif model in OPENAI: p_in, p_read, _, p_out = OPENAI[model][0]
    else: return {"read": 0.0, "fresh": 0.0, "out": 0.0, "write": 0.0}
    read, fresh = row["cache_read"] * p_read / 1e6, row["fresh_in"] * p_in / 1e6
    out = row["out"] * p_out / 1e6 + row.get("usd_est", 0)
    return {"read": read, "fresh": fresh, "out": out, "write": max(0.0, row["usd"] - read - fresh - out)}
