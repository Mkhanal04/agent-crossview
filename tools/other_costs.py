#!/usr/bin/env python3
"""Signs of costs outside your plans: paid AI services your projects call with their own keys (Claude API, OpenAI,
fal.ai and others). Looks in your project folders for the NAMES of API keys in settings files and for the services'
code libraries. Never reads a key's value. Also notes if such a key is set for this Mac's shell, since Claude Code would
then bill the API instead of your plan. Writes data/other-costs.json. Usage: python3 tools/other_costs.py"""
import glob, json, os, re, datetime
import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from roots import find
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
H = os.path.expanduser("~")
CP = H + "/Desktop/Claude_Projects"
SKIP = re.compile(r"/(node_modules|\.git|_archive|_Archive|\.next|dist|build|venv|\.venv|__pycache__)/")

# service: (key names, npm packages, python packages, where its bill lives)
SERVICES = {
    "Claude API": (["ANTHROPIC_API_KEY", "CLAUDE_API_KEY"], ["@anthropic-ai/sdk", "@ai-sdk/anthropic"], ["anthropic"], "the Claude Console, the site for Claude API bills, under Usage for the month"),
    "OpenAI API": (["OPENAI_API_KEY"], ["openai", "@ai-sdk/openai"], ["openai"], "OpenAI platform, under Usage"),
    "fal.ai": (["FAL_KEY", "FAL_API_KEY"], ["@fal-ai/client", "@fal-ai/serverless-client", "@fal-ai/server-proxy"], ["fal-client", "fal_client"], "fal.ai dashboard: Billing"),
    "Google Gemini": (["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"], ["@google/generative-ai", "@google/genai", "@ai-sdk/google"], ["google-generativeai", "google-genai"], "Google AI Studio, under Usage, or Google Cloud Billing"),
    "ElevenLabs": (["ELEVENLABS_API_KEY", "XI_API_KEY"], ["elevenlabs", "@elevenlabs/elevenlabs-js"], ["elevenlabs"], "ElevenLabs, under Subscription and usage"),
    "Replicate": (["REPLICATE_API_TOKEN"], ["replicate"], ["replicate"], "Replicate: Account, Billing"),
    "OpenRouter": (["OPENROUTER_API_KEY"], ["@openrouter/ai-sdk-provider"], [], "OpenRouter: Activity"),
    "Groq": (["GROQ_API_KEY"], ["groq-sdk", "@ai-sdk/groq"], ["groq"], "Groq console, under Usage"),
    "Mistral": (["MISTRAL_API_KEY"], ["@mistralai/mistralai", "@ai-sdk/mistral"], ["mistralai"], "Mistral console, under Usage"),
    "Perplexity": (["PERPLEXITY_API_KEY", "PPLX_API_KEY"], [], [], "Perplexity API settings, under Usage"),
}
KEY_TO = {k: s for s, v in SERVICES.items() for k in v[0]}
NPM_TO = {k: s for s, v in SERVICES.items() for k in v[1]}
PY_TO = {k.lower(): s for s, v in SERVICES.items() for k in v[2]}

pp = os.path.join(ROOT, "data", "private-patterns.json")
PRIV = json.load(open(pp)) if os.path.exists(pp) else {}
def label(folder):
    """The project a folder belongs to, as the app shows it; day-job and personal folders never show their names."""
    rel = os.path.relpath(folder, CP)
    for kind, pats in PRIV.items():
        for pat in (pats if isinstance(pats, list) else [pats]):
            try:
                if pat and re.search(pat, rel, re.I): return "Day job" if "day" in kind else "Personal"
            except re.error:
                if pat and pat.lower() in rel.lower(): return "Day job" if "day" in kind else "Personal"
    parts = rel.split(os.sep)
    return parts[1] if len(parts) > 1 and parts[0] in ("Ventures", "Side_Projects", "Career", "Education") else parts[0]

def env_names(path):
    names = set()
    try:
        for line in open(path, errors="ignore"):
            m = re.match(r"\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=", line)  # the name only; the value is never read
            if m: names.add(m.group(1))
    except OSError: pass
    return names

found = {}  # (service, project) -> signs
def add(service, folder, sign):
    k = (service, label(folder))
    found.setdefault(k, set()).add(sign)

for f in find(".env*"):  # in the folders your chats ran in (tools/roots.py)
    if SKIP.search(f) or os.path.isdir(f): continue
    example = bool(re.search(r"example|sample|template", os.path.basename(f), re.I))
    for n in env_names(f):
        if n in KEY_TO: add(KEY_TO[n], os.path.dirname(f), f"{'named in an example settings file' if example else 'its key is named in a settings file'} ({n})")
for f in find("package.json"):
    if SKIP.search(f): continue
    try: pj = json.load(open(f))
    except Exception: continue
    for sec in ("dependencies", "devDependencies"):
        for dep in (pj.get(sec) or {}):
            if dep in NPM_TO: add(NPM_TO[dep], os.path.dirname(f), f"uses its code library ({dep})")
for f in find("requirements*.txt") + find("pyproject.toml"):
    if SKIP.search(f): continue
    try: text = open(f, errors="ignore").read().lower()
    except OSError: continue
    for pkg, s in PY_TO.items():
        if re.search(r"(^|[\s\"'])" + re.escape(pkg) + r"\b", text, re.M): add(s, os.path.dirname(f), f"uses its code library ({pkg})")

shell = sorted(n for n in KEY_TO if os.environ.get(n))  # names only
out = {
    "read": datetime.datetime.now().isoformat(timespec="minutes"),
    "services": [{"service": s, "project": p, "signs": sorted(sg), "where_to_look": SERVICES[s][3]} for (s, p), sg in sorted(found.items())],
    "shell_keys": shell,
}
json.dump(out, open(os.path.join(ROOT, "data", "other-costs.json"), "w"), indent=1)
print("other costs:", len(out["services"]), "signs", sorted({x["service"] for x in out["services"]}), "shell keys:", shell)
