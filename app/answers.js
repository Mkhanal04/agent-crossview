/* Crossview: the four answers on Your week (Milan's pick, Oct 13: four answers on top, his agents as a small row).
   Am I on the right plan? What used up my limit? What can my agents reach? What am I carrying that I never use?
   Each answer is counted from the numbers the same way every time (no AI), says why, and where it can, prepares a change:
   the exact lines, how to undo it, and nothing happens until he presses "Make this change" (tools/changes.py).
   week.js passes in its helpers. */
window.GBAnswers = function (X) {
  "use strict";
  const { G, S, esc, money, day, localDay, HITS, DEMO, LIVE, shares, riskOf, riskWords, since, snoozed, words, span, plus, daysIn, PER_DAY, thisWeek, helperShare, workName, tip, screws, plural, pct, agentOf, builtIn, ampm, at, shortWhen, daysSince } = X;
  const M = G.machine || { periods: {}, ports: [] }, B = G.money || { plans: [] }, PR = G.prices || {};
  const soFar = (per) => (per === thisWeek ? " so far" : "");
  const wk = (per) => (per === thisWeek ? "this week" : "last week");
  const nWord = (n) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const list = (a) => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
  const code = (s) => `<code>${esc(s)}</code>`;
  const useOf = (per) => Object.values(M.periods[per] || {}).reduce((a, t) => a + t.usd, 0);
  const hitsIn = (per) => HITS.filter((e) => { const d = localDay(e.ts); return d >= per && d <= plus(per, 6); });
  const RESETS = {}; (G.limit_hits || []).forEach((h) => (RESETS[h.ts] = h.resets));
  const waited = (h) => { const r = RESETS[h.ts]; if (!r) return null; const m = Math.round((r * 1000 - at(h.ts)) / 60000); return m > 0 && m < 6 * 60 ? m : null; };
  const dur = (m) => (m < 60 ? `${m} minutes` : `${Math.floor(m / 60)} hour${Math.floor(m / 60) === 1 ? "" : "s"}${m % 60 ? ` ${m % 60} minutes` : ""}`);
  const weekday = (ts) => at(ts).toLocaleDateString("en-US", { weekday: "long" });
  const limitName = (h) => (h.kind === "seven_day" ? "weekly" : h.kind === "five_hour" ? "5-hour" : "usage");
  const active = (q) => (G.changes || []).filter((c) => c.status === "made" && c.for === q);
  const when = (iso) => ampm(new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }));
  const short = (f) => String(f || "").replace(/^~\/Desktop\/Claude_Projects\/(Ventures\/)?/, "").replace(/^~\//, "");
  const PLAN_SRC = "Anthropic's help page on the Max plan at support.claude.com, checked Oct 13 2026";
  const MODEL_SRC = "Claude Code can hand part of a job to a subagent, a separate AI with its own instructions. What Anthropic says about models comes from its help page on models and usage limits in Claude Code at support.claude.com, checked Oct 13 2026.";

  // ---------- small parts ----------
  const card = (key, q, hot, body, act) => `<section class="w-mod q-card" data-q-card="${key}">${screws}<p class="q-q"><i class="w-led${hot ? "" : " idle"}"></i>${esc(q)}</p>${body}<div class="q-act">${act}</div></section>`;
  const later = (key) => `<button class="w-btn quiet" data-snooze="q:${key}" ${tip("Hides this suggestion for a week. The answer stays on the card.")}>Not now</button>`;
  const hiddenAct = (key, label) => `<span class="q-lead">${esc(label)} hidden until ${esc(day(plus(snoozedDay(key), 7)))}.</span><button class="w-btn quiet" data-w="q:unsnooze:${key}">Show it again</button>`;
  const snoozedDay = (key) => { try { return (JSON.parse(localStorage.getItem("gb:snoozedAt")) || {})["q:" + key] || G.today; } catch (e) { return G.today; } };
  const madeAct = (c, what) => `<span class="q-lead q-done"><b>Changed ${esc(when(c.when))}.</b> ${what}</span><button class="w-btn quiet" data-w="q:sheet:undo:${esc(c.id)}">Undo</button>`;

  // ---------- 1. Am I on the right plan? ----------
  // the plans people pay for, as listed on Oct 13 2026: Claude's from Anthropic's plan pages; ChatGPT's from published guides (OpenAI's page couldn't be read)
  const CATALOG = {
    claude: [["none", "No Claude plan", 0], ["pro", "Claude Pro", 20], ["max5", "Claude Max 5x", 100], ["max20", "Claude Max 20x", 200], ["other", "Another Claude plan", null]],
    chatgpt: [["none", "No ChatGPT plan", 0], ["plus", "ChatGPT Plus", 20], ["pro100", "ChatGPT Pro", 100], ["pro200", "ChatGPT Pro, top tier", 200], ["other", "Another ChatGPT plan", null]],
  };
  const vendorOf = (p) => ((p.covers || []).includes("Codex") ? "chatgpt" : "claude");
  function planPicks() {
    if (S.qplans) return S.qplans;
    const pick = { claude: "none", chatgpt: "none", claudeUsd: "", chatgptUsd: "" };
    (B.plans || []).forEach((p) => {
      const v = vendorOf(p), hit = CATALOG[v].find((c) => c[2] === p.monthly_usd && c[0] !== "none");
      pick[v] = hit ? hit[0] : "other"; if (!hit) pick[v + "Usd"] = p.monthly_usd;
    });
    return (S.qplans = pick);
  }
  function plansSheet() {
    const pk = planPicks();
    const group = (v, title) => `<div class="q-grp"><h4>${title}</h4><div class="q-radios">${CATALOG[v].map(([k, name, usd]) => `<label class="q-radio${pk[v] === k ? " on" : ""}"><input type="radio" name="plan-${v}" data-w="q:plan:${v}:${k}" ${pk[v] === k ? "checked" : ""}><span>${esc(name)}${usd != null && usd > 0 ? ` <small>$${usd} a month</small>` : ""}${k === "other" ? ` <span class="q-amt">$<input type="number" min="0" max="5000" step="1" inputmode="decimal" data-plan-usd="${v}" value="${esc(pk[v + "Usd"])}" aria-label="Monthly price"> a month</span>` : ""}</span></label>`).join("")}</div></div>`;
    return { title: "Which plans do you pay for?", kind: "plans", body: `<p>Crossview compares what you pay for each plan with the work you did on it. Pick your Claude plan and your ChatGPT plan. Codex comes with ChatGPT. If your bill shows a different price, pick "Another" and type it in.</p>
      ${group("claude", "Your Claude plan, for Claude Code, Cowork and the Claude app")}${group("chatgpt", "Your ChatGPT plan, which includes Codex")}
      <p class="q-small">Claude's prices come from Anthropic's plan pages, checked Oct 13 2026. ChatGPT's come from published guides because OpenAI's own page couldn't be read, so check them against your bill. Your answer is saved only on this Mac, and you can change it here at any time.</p>`,
      req: { kind: "plans" }, ask: null };
  }
  function askPlans() {
    return card("plan", "Am I on the right plan?", true, `<p class="q-a">Crossview first needs to know which plans you pay for.</p><p class="q-why">It compares what you pay with the work you did on them. It takes two clicks, and your answer stays on this Mac.</p>`,
      `<span class="q-lead">${LIVE ? "" : DEMO ? "" : "To save your plans, start Crossview by double-clicking “Agent Crossview.command” in its folder."}</span><button class="w-btn main" data-w="q:sheet:plans">Choose my plans</button>`);
  }
  function plan(per) {
    if (!DEMO && B.plans_asked === false) return askPlans();
    const nd = daysIn(per), paid = PER_DAY * nd, use = useOf(per), hits = hitsIn(per), ch = hits.filter((h) => h.tool !== "Codex"), cx = hits.length - ch.length;
    const ratio = paid ? use / paid : 0, claude = (B.plans || []).find((p) => /claude/i.test(p.name));
    // each plan on its own, this week and the four full weeks before, so the answer rests on more than a few days
    const prior = [1, 2, 3, 4].map((i) => plus(per, -7 * i)).filter((w) => M.periods[w]);
    const appUse = (w, apps) => apps.reduce((x, a) => x + ((((M.apps || {})[w] || {})[a] || {}).usd || 0), 0);
    const plans = (B.plans || []).map((pl) => {
      const day1 = (pl.monthly_usd * 12) / 365, now = appUse(per, pl.covers || []), before = prior.reduce((x, w) => x + appUse(w, pl.covers || []), 0);
      return { name: pl.name, paid: day1 * nd, now, before, paidBefore: day1 * 7 * prior.length, unlogged: (pl.covers || []).some((c) => c === "Claude app") || /chatgpt/i.test(pl.name) };
    });
    const low = plans.filter((x) => x.now < x.paid && x.before < x.paidBefore);
    const usd = (v) => (v < 1 ? "under $1" : "$" + Math.round(v).toLocaleString());
    let a;
    if (use < 1) a = `No work was recorded ${wk(per)}${soFar(per)}.`;
    else if (ratio >= 2) a = `Yes. Without a plan, the same work ${per === thisWeek ? "would cost far more than you pay" : "would have cost far more than you paid"}.${ch.length ? "" : cx ? ` Claude's limits haven't stopped you${soFar(per)}.` : ` No limit has stopped you${soFar(per)}.`}`;
    else if (ratio >= 1) a = `Without a plan, the same work ${per === thisWeek ? "would cost about what your plans cost" : "would have cost about what your plans cost"}, so it's about even.`;
    else a = `${cap(wk(per))}, your plans cost more than the same work would at pay-per-use prices.`;
    if (use >= 1 && low.length) a += ` ${esc(low.map((x) => x.name).join(" and "))} covered less work than it cost, ${wk(per)} and in the weeks before.`;
    const fig = `<div class="q-fig"><div class="q-big" ${tip(`What your plans cost for ${plural(nd, "day")} ${wk(per)}, as a daily share of what you pay each month. ${list((B.plans || []).map((p) => `${p.name} is $${p.monthly_usd} a month`))}.`)}>$${Math.round(paid)}<small>${nd < 7 ? `Your plans for ${plural(nd, "day")} so far` : "Your plans for the week"}</small></div><span class="q-vs">vs</span>
      <div class="q-big dim" ${tip(`The pay-per-use price is what the same work would cost at published per-use prices, without a plan. Each reply ${wk(per)} is priced at its model's published rate, checked ${G.prices_checked}. It's an estimate and may run a little low.`)}>${money(use)}<small>Pay-per-use price for the same work</small></div></div>`;
    // the stops, how long each kept you waiting, and the limit readings
    const pk = per === thisWeek && M.plan && M.plan.latest ? M.plan.latest : M.plan && M.plan.week_peaks ? M.plan.week_peaks[per] : null;
    const days = [...new Set(ch.map((h) => weekday(h.ts)))], waits = ch.map(waited).filter((m) => m != null);
    let line = "";
    if (ch.length) {
      const kinds = [...new Set(ch.map(limitName))];
      const total = waits.reduce((x, m) => x + m, 0);
      line = `The ${list(kinds)} limit stopped you <b>${nWord(ch.length)}</b> ${ch.length > 1 && days.length === 1 ? "on " + days[0] : "on " + list(days)}${total ? `, and you waited about ${dur(Math.round(total / 15) * 15 || total)} in all` : ""}.`;
    } else line = "";
    if (cx) line += ` Codex's limit stopped you ${nWord(cx)}.`;
    // the Claude app's own reading is kept in this Mac's local time
    const readAt = (t) => ampm(new Date(t).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }));
    if (pk && pk.sd != null && per !== thisWeek) line += ` Your weekly limit reached ${pk.sd}% at its highest.`;
    const trend = plans.length && prior.length >= 2 ? `<ul class="q-plans" ${tip(`Each plan's cost for these days, next to the pay-per-use price of the work done in the apps it covers. The ${prior.length} weeks before run from ${day(prior[prior.length - 1])} to ${day(plus(prior[0], 6))}. Chats in the Claude app and ChatGPT aren't recorded on this Mac, so a plan may be worth more than it shows here.`)}>${plans.map((x) => `<li><b>${esc(planName(B.plans.find((p) => p.name === x.name) || x))}</b><span>${usd(x.now)} of work for ${usd(x.paid)}${soFar(per)}</span><span class="dim">The ${prior.length} weeks before, ${usd(x.before)} of work for ${usd(x.paidBefore)}</span></li>`).join("")}</ul>${DEMO ? "" : `<button class="w-link q-change" data-w="q:sheet:plans">Change my plans</button>`}` : "";
    // the plan that would give more room, from Anthropic's own page; only worth saying when a limit stopped you
    let option = "";
    if (ch.length && claude) {
      option = claude.monthly_usd >= 200 ? "You're already on the largest Max plan. The next step up is a Team plan or an API plan."
        : claude.monthly_usd >= 100 ? "Max 20x costs $100 more a month and gives you four times as much room in each 5-hour window. Anthropic doesn't say how much bigger the weekly limit gets."
        : "Max 5x costs $100 a month and gives you five times as much room as Pro in each 5-hour window.";
      option = `<p class="q-why" ${tip(`Your limits are the 5-hour and weekly caps on your plan. This comes from ${PLAN_SRC}. Plans change, so check before you switch. You switch plans in your Claude account.`)}>${esc(option)}</p>`;
    }
    const act = `<span class="q-lead">${line}</span>${ch.length ? `<button class="w-btn" data-w="q:sheet:stops">Show me ${ch.length === 1 ? "the stop" : ch.length === 2 ? "both stops" : "the stops"}</button>` : ""}`;
    return card("plan", "Am I on the right plan?", use >= 1 && (ratio < 1 || low.length > 0), `<p class="q-a">${a}</p>${fig}${trend}${option}`, act);
  }
  const asWords = (k) => Math.round((k * 750) / 10000) * 10000;  // about three quarters of a word per token
  function causes(h) {
    const c = (G.stop_causes || {})[h.ts];
    if (!c) return { why: "", fix: [] };
    const why = [], fix = [];
    if (c.helpers >= 50) { why.push(`Subagents did ${c.helpers}% of the work${c.top_models >= 95 ? ", all of it on the top models" : ""}.`); if (c.top_models >= 80) fix.push("running subagents on Sonnet"); }
    if (c.top.per_reply_k && c.top.per_reply_k >= 80) { why.push(`The main ${esc(workName(c.top.work))} chat re-read about ${asWords(c.top.per_reply_k).toLocaleString()} words of conversation with every reply.`); fix.push("starting a fresh chat partway through"); }
    if (c.chats >= 2) why.push(`${cap(nWord(c.chats) === "twice" ? "two" : String(c.chats))} chats were busy at once.`);
    if (!why.length) why.push(`${esc(workName(c.top.work))} did ${c.top.share}% of it.`);
    return { why: `${why.join(" ")} These cover the five hours before the stop.`, fix };
  }
  function stopsSheet(per) {
    const ch = hitsIn(per).filter((h) => h.tool !== "Codex"), fixes = new Set();
    const rows = ch.map((h) => {
      const r = (h.running || [])[0], m = waited(h), c = causes(h);
      c.fix.forEach((x) => fixes.add(x));
      return `<li>On <b>${esc(shortWhen(h.ts))}</b>, the ${limitName(h)} limit stopped you${r ? ` while ${esc(workName(r.work))} was running` : ""}.${m != null ? ` It opened again ${dur(m)} later.` : ""}${c.why ? `<br><small>${c.why}</small>` : ""}</li>`;
    }).join("");
    const top = ch.map((h) => ((h.running || [])[0] || {}).work).filter(Boolean)[0], lf = limitFacts(per);
    return { title: `Why the limit stopped you ${wk(per)}`, body: `<ul class="q-list">${rows}</ul>
      ${fixes.size ? `<p class="q-sum"><b>It might have helped to try ${list([...fixes])}.</b></p>` : ""}
      <p class="q-small">This comes from Claude Code's record of each stop and the replies in the five hours before it. None of your messages are read for this. The shares are of the pay-per-use price, because Anthropic doesn't publish how the limit counts each part.</p>
      <p class="q-small">Claude Code and Cowork share these limits. The Claude app's chats aren't recorded on this Mac.</p>`,
      foot: (lf.cands.length ? `<button class="w-btn main" data-w="q:sheet:limit">Show me the change</button>` : "") + (top ? `<button class="w-btn" data-nwork="${esc(top)}">Open ${esc(workName(top))}</button>` : "") };
  }

  // ---------- 2. What used up my limit? ----------
  const CHECKS = /\b(review|reviews|reviewer|reviewing|test|tests|tester|testing|check|checks|checker|checking|qa|audit|audits|auditor|verify|verifies)\b/i;
  const smallModel = (m) => /^(sonnet|haiku)/i.test(m || "") || /sonnet|haiku/i.test(m || "");
  const family = (m) => (/fable|mythos/.test(m) ? "Fable" : /opus/.test(m) ? "Opus" : /sonnet/.test(m) ? "Sonnet" : /haiku/.test(m) ? "Haiku" : null);
  const priceOf = (m) => PR[m] || PR[Object.keys(PR).sort((a, b) => b.length - a.length).find((k) => String(m).startsWith(k))] || null;
  const KIX = { fresh: 0, write: 1, read: 3, out: 4 };
  // the same steps on Sonnet, at pay-per-use prices: each model's rate for each kind of token, weighted by this work's mix
  function onSonnet(usdByModel, kinds) {
    const S55 = PR["claude-sonnet-5-5"], tot = Object.values(kinds || {}).reduce((a, b) => a + b, 0);
    return Object.entries(usdByModel).reduce((sum, [m, u]) => {
      const p = priceOf(m), f = family(m);
      if (!p || !S55 || !tot || !f || f === "Sonnet" || f === "Haiku") return sum + u;
      let r = 0; Object.entries(kinds).forEach(([k, v]) => { const i = KIX[k]; if (i != null && p[i]) r += (v / tot) * (S55[i] / p[i]); });
      return sum + u * Math.min(1, r);
    }, 0);
  }
  function limitFacts(per) {
    const P = M.periods[per] || {}, ch = hitsIn(per).filter((h) => h.tool !== "Codex");
    const ran = ch.map((h) => ((h.running || [])[0] || {}).work).filter(Boolean), count = {};
    ran.forEach((w) => (count[w] = (count[w] || 0) + 1));
    const top = Object.entries(P).sort((a, b) => b[1].usd - a[1].usd)[0];
    const work = Object.keys(count).sort((a, b) => count[b] - count[a])[0] || (top && top[0]);
    const t = P[work] || null;
    // helpers on that work you could move to a smaller model: ones with a file of yours, not already on Sonnet or Haiku
    const helpers = t ? Object.entries(t.agents || {}).filter(([k]) => k.startsWith("helper:")).map(([k, v]) => ({ type: k.split(":").slice(2).join(":"), usd: v.usd, runs: v.runs })).sort((a, b) => b.usd - a.usd) : [];
    const cands = helpers.map((h) => Object.assign(h, { a: agentOf(h.type) })).filter((h) => h.a && h.a.file && !builtIn(h.type) && h.a.file !== "a private folder" && !smallModel(h.a.model) && h.usd >= 1).slice(0, 4);
    cands.forEach((h) => {
      const mix = h.a.models || {}, tot = Object.values(mix).reduce((a, b) => a + b, 0) || 1;
      h.pick = CHECKS.test(`${h.type} ${h.a.raw || ""}`);
      h.sonnet = onSonnet(Object.fromEntries(Object.entries(mix).map(([m, u]) => [m, (h.usd * u) / tot])), t.kinds);
    });
    return { P, ch, count, work, t, helpers, cands };
  }
  function limit(per) {
    const f = limitFacts(per), { ch, count, work, t, cands } = f, done = active("limit")[0];
    if (!t) return card("limit", "What used up my limit?", false, `<p class="q-a">No work was recorded ${wk(per)}${soFar(per)}.</p>`, "");
    const hp = helperShare(t), k = t.kinds || {}, kt = Object.values(k).reduce((a, b) => a + b, 0) || 1;
    const parts = [["read", "Re-reading the chat so far", "var(--amt-5)"], ["write", "Saving it to re-read", "var(--amt-3)"], ["out", "Writing answers", "var(--amt-1)"], ["fresh", "New input", "var(--mod-3)"]].filter(([x]) => (k[x] || 0) / kt >= 0.01);
    const p = shares(parts.map(([x]) => k[x] || 0)), carry = Math.round((100 * ((k.read || 0) + (k.write || 0))) / kt);
    const n = ch.length, times = count[work] || 0, share = t.share != null ? t.share : pct(t.usd, useOf(per));
    let a;
    if (n) a = `${esc(workName(work))} was running ${n === 1 ? "when the limit stopped you" : times === n ? (n === 2 ? "both times the limit stopped you" : `all ${n} times the limit stopped you`) : `at ${times} of the ${n} stops`}${hp > 50 ? ", and its subagents did most of its work" : ""}.${carry >= 60 ? " Most of its use went on re-reading long chats." : ""}`;
    else a = `${(() => { const cxn = hitsIn(per).filter((h) => h.tool === "Codex").length; return cxn ? `Claude's limits haven't stopped you${soFar(per)}` : `No limit has stopped you${soFar(per)}`; })()}. ${esc(workName(work))} used the most, ${share}% of ${wk(per)}'s use${hp > 50 ? ", mostly through its subagents" : ""}.`;
    const bar = `<div class="q-bar" role="img" aria-label="${esc(`${workName(work)}'s use ${wk(per)}: ${parts.map(([, l], i) => `${l} ${p[i]}%`).join(", ")}`)}" ${tip(`Where ${workName(work)}'s use went ${wk(per)}, as shares of its pay-per-use price. Re-reading costs little per word, but it happens before every step, so long chats add up. Anthropic doesn't publish how the limit counts each kind, so treat these shares as a guide.`)}>${parts.map(([, , c], i) => `<i style="width:${p[i]}%;background:${c}"></i>`).join("")}</div>
      <div class="q-key">${parts.map(([, l, c], i) => `<span><i style="background:${c}"></i>${esc(l)} ${p[i]}%</span>`).join("")}</div>`;
    // why: the models its helpers ran on
    const fams = Object.entries(t.models || {}).reduce((o, [m, u]) => { const x = family(m); if (x) o[x] = (o[x] || 0) + u; return o; }, {});
    const topFam = Object.keys(fams).filter((x) => x === "Opus" || x === "Fable"), topPct = pct(topFam.reduce((a, x) => a + fams[x], 0), t.usd);
    const named = f.helpers.filter((h) => agentOf(h.type) && agentOf(h.type).model).length;
    // where this week is heading, before it happens: the weekly limit at this pace, from the readings
    const wp = M.plan && M.plan.weekly_pace, wr = M.plan && M.plan.weekly_reset;
    let ahead = "", soon = false;
    if (per === thisWeek && wp && wr && wp.at >= per) {
      const rt = new Date(wr.next), rday = rt.toLocaleDateString("en-US", { weekday: "long" });
      if (wp.runs_out) { soon = true; ahead = `At this week's pace, the weekly limit would run out around ${esc(ampm(new Date(wp.runs_out).toLocaleString("en-US", { weekday: "short", hour: "numeric" })))}, before it resets on ${rday}.`; }
      else ahead = `At this week's pace, the weekly limit would reach about ${wp.at_reset}% before it resets on ${rday} morning.`;
      ahead = `<p class="q-why q-ahead-line" ${tip(`This assumes the rest of the week goes like the first ${wp.hours_in} hours after the weekly reset, when you'd used ${wp.sd}%. The reset time is worked out from ${wr.drops} drops in the Claude app's readings, so it falls somewhere between ${wr.from} and ${wr.to}. Switch on the warning in Claude Code to make this exact.`)}><b>${ahead}</b></p>`;
    }
    let why = "";
    const fableNote = fams.Fable ? ` Fable also has its own weekly limit, which isn't recorded on this Mac. Claude Code shows it in its own usage panel.` : "";
    if (cands.length) why = `${topPct}% of ${esc(workName(work))}'s use ran on <span class="w-link" tabindex="0" ${tip("Claude comes in models of different sizes. Fable and Opus are the largest, Sonnet is in the middle and Haiku is the smallest. Larger models use more of your limit for the same step.")}>${list(topFam)}</span>, ${topFam.length === 1 ? "one of the top models" : "the top models"}.${named ? "" : " None of its subagents' files name a model, so each one uses the same model as the chat."} Anthropic says Opus uses more of your limit per step than Sonnet, and suggests Sonnet for routine work.`;
    else if (f.helpers.length) why = `Its subagents came with Claude Code or already run on a smaller model, so there's nothing to change.`;
    else why = `No subagents ran on it ${wk(per)}. The chat did all the work itself.`;
    why += fableNote;
    let act;
    const picked = (S.qpick && S.qpick.limit) || new Set(cands.filter((h) => h.pick).map((h) => h.type));
    const names = cands.filter((h) => picked.has(h.type)).map((h) => `<b>${esc(h.type)}</b>`);
    if (done && !cands.length) act = madeAct(done, esc(done.summary));
    else if (!cands.length) act = `<span class="q-lead">There's nothing to change here.</span>`;
    else if (snoozed("q:limit")) act = hiddenAct("limit", "The suggested change is");
    else act = `<span class="q-lead">You can run ${names.length ? list(names) : "the subagents you pick"} on Sonnet, a smaller model, by adding one line to ${names.length === 1 ? "its file" : "each file"}. You can undo it at any time.</span><button class="w-btn main" data-w="q:sheet:limit">Show me the change</button>${later("limit")}`;
    if (done && cands.length) act = madeAct(done, esc(done.summary)) + `<button class="w-btn" data-w="q:sheet:limit">Show me the list</button>`;
    // the warning in Claude Code, as a switch: on only after a yes, off with Undo
    const pd = active("pace")[0], other = (G.rules || {}).status_line && !pd;
    const sw = `<button class="q-switch${pd ? " on" : ""}" data-w="${pd ? `q:sheet:undo:${esc(pd.id)}` : "q:sheet:pace"}" ${other ? "disabled" : ""} ${tip(pd ? "Claude Code shows your limits after each reply and warns you when you're on pace to run out. Click to switch it off." : other ? "You already have your own line at the bottom of Claude Code, so Crossview won't replace it." : "Shows your limits at the bottom of Claude Code. It turns orange when you're on pace to run out before the limit resets. Clicking shows you the change first.")}><i aria-hidden="true"></i>${pd ? "Claude Code now warns you before you run out" : "Warn me in Claude Code before I run out"}</button>`;
    return card("limit", "What used up my limit?", (!!n && !!cands.length && !snoozed("q:limit") && !done) || soon, `<p class="q-a">${a}</p>${ahead}${bar}<p class="q-why" ${tip(MODEL_SRC)}>${why}</p>${sw}`, act);
  }
  function limitSheet(per) {
    const f = limitFacts(per), { cands, work } = f;
    const picked = (S.qpick.limit = S.qpick.limit || new Set(cands.filter((h) => h.pick).map((h) => h.type)));
    const rows = cands.map((h) => `<li class="q-item${picked.has(h.type) ? " on" : ""}"><label><input type="checkbox" data-w="q:pick:limit:${esc(h.type)}" ${picked.has(h.type) ? "checked" : ""}>
        <span><b>${esc(h.type)}</b> <small>${esc(short(h.a.file))}</small><br><small>It ran ${nWord(h.runs)} on ${esc(workName(work))} ${wk(per)}, with a pay-per-use price of ${money(h.usd)}. On Sonnet, the same steps would come to ${money(h.sonnet)}.${h.pick ? " It's ticked because its file says it reviews or tests work." : " It's left unticked because its file doesn't say it reviews or tests, so its work may need the top model."}${/^~\/\.claude\/agents\//.test(h.a.file) ? " It's yours in every project, so the change applies everywhere." : ""}</small></span></label>
        ${picked.has(h.type) ? `<pre class="q-diff">${h.a.model ? `<del>- model: ${esc(h.a.model)}</del>\n` : ""}<ins>+ model: sonnet</ins></pre>` : ""}</li>`).join("");
    const sel = cands.filter((h) => picked.has(h.type)), was = sel.reduce((x, h) => x + h.usd, 0), now = sel.reduce((x, h) => x + h.sonnet, 0);
    const sum = sel.length ? `<p class="q-sum"><b>${sel.length === 1 ? "The one you ticked" : `The ${sel.length} you ticked`}</b> used ${money(was)} of ${wk(per)}'s use at pay-per-use prices. On Sonnet, the same steps would come to ${money(now)}. On your plan, the saving shows up as more room in your limit.</p>` : `<p class="q-sum">Tick the subagents you want to move to Sonnet.</p>`;
    return { title: "Run these subagents on Sonnet", kind: "helper-model", body: `<p>This adds one line, ${code("model: sonnet")}, to the top of each subagent's file and leaves the rest of the file alone. Claude Code uses it the next time it calls that subagent, without a restart.</p>
      <ul class="q-items">${rows}</ul>${sum}
      <p class="q-small">Crossview can't tell whether Sonnet does this work as well as the top model, so try it for a week and compare.</p>
      <p class="q-small">Undo on Your week puts each file back as it was. Crossview keeps a copy of every file on this Mac first, and you can also delete the line yourself.</p>`,
      req: sel.length ? { kind: "helper-model", model: "sonnet", files: sel.map((h) => h.a.file), for: "limit", summary: `${list(sel.map((h) => h.type))} ${sel.length === 1 ? "runs" : "run"} on Sonnet.` } : null,
      ask: `Please add the line "model: sonnet" to the header block (between the --- lines) of ${sel.length === 1 ? "this subagent file" : "these subagent files"}, and change nothing else: ${sel.map((h) => h.a.file).join(", ")}. Show me each change before you save it.` };
  }

  // ---------- 3. What can my agents reach? ----------
  function reachFacts(per) {
    const usedNow = {};
    Object.values(M.periods[per] || {}).forEach((t) => Object.entries(t.connectors || {}).forEach(([k, n]) => (usedNow[k] = (usedNow[k] || 0) + n)));
    const merged = {};
    (M.ports || []).filter((p) => !p.set_up_only && p.outside && riskOf(p) >= 1).forEach((p) => {
      const m = (merged[p.name] = merged[p.name] || Object.assign({}, p, { ids: [], used: 0 }));
      m.ids.push(p.id); m.used += usedNow[p.id] || 0;
      if (riskOf(p) > riskOf(m)) Object.assign(m, { kinds: p.kinds, as_you: p.as_you, reach: p.reach, outside: p.outside });
    });
    // how often each one runs in a typical week, over every week in the logs, so the prepared change doesn't flip with the week shown
    const weeks = Object.keys(M.periods || {}).filter((k) => k !== "all" && Object.keys(M.periods[k]).length);
    Object.values(merged).forEach((m) => { m.weekly = Math.round(weeks.reduce((x, w) => x + Object.values(M.periods[w]).reduce((y, t) => y + m.ids.reduce((z, i) => z + ((t.connectors || {})[i] || 0), 0), 0), 0) / Math.max(1, weeks.length)); });
    const ports = Object.values(merged).sort((a, b) => riskOf(b) - riskOf(a) || b.actions - a.actions);
    const ask = new Set(((G.rules || {}).ask) || []), safe = (s) => /^[A-Za-z0-9_-]+$/.test(s);
    // the rules that would make Claude Code ask first: every action for browser control, only the ones that send or delete for the rest
    ports.forEach((p) => {
      p.rules = p.as_you ? p.ids.filter(safe).map((i) => `mcp__${i}`) : p.ids.filter(safe).flatMap((i) => (p.risky_tools || []).filter((t) => /^[A-Za-z0-9_.-]+$/.test(t)).map((t) => `mcp__${i}__${t}`));
      p.covered = p.rules.length > 0 && p.rules.every((r) => ask.has(r) || ask.has(r.split("__").slice(0, 2).join("__")) || ask.has(r.split("__").slice(0, 2).join("__") + "__*"));
      p.pick = !p.as_you || p.weekly <= 50;
    });
    return { ports, open: ports.filter((p) => !p.covered && p.rules.length), usedNow, weeks };
  }
  const chipWords = (p) => ["", "can change things", "can send or publish", "can delete", "acts as you"][riskOf(p)];
  function reach(per) {
    const { ports, open } = reachFacts(per), done = active("reach")[0];
    if (!ports.length) return card("reach", "What can Claude reach outside my Mac?", false, `<p class="q-a">None of your connectors can change anything outside this Mac.</p>`, "");
    const asYou = ports.filter((p) => p.as_you), busiest = ports.slice().sort((a, b) => b.used - a.used)[0];
    const a = `${plural(ports.length, "connector")} can act outside your Mac.${asYou.length ? ` ${list(asYou.map((p) => esc(p.name)))} can act as you.` : ""}`;
    const chips = ports.slice(0, 5).map((p) => `<button class="q-chip${riskOf(p) >= 2 ? " hot" : ""}${p.covered ? " calm" : ""}" data-w="setup:port:${esc(p.name)}" ${tip(`${p.name} ${riskWords(p)}. ${p.used ? `It was used ${plural(p.used, "time")} ${wk(per)}` : `It wasn't used ${wk(per)}`}, and about ${plural(p.weekly, "time")} a week on average over the last ten weeks.${p.covered ? " Claude Code already asks you before it acts." : ""} Click to see every connector in Your setup.`)}>${esc(p.name)} <em>${esc(chipWords(p))}</em></button>`).join("") + (ports.length > 5 ? `<button class="q-chip" data-w="setup:layer:connectors">+ ${ports.length - 5} more</button>` : "");
    // the same question for Codex: plugins and connectors that control the computer or a browser can act as you there too
    const CX = (G.anatomy || {}).Codex || {}, cxYou = [...new Set([...(CX.plugins || []), ...(CX.connectors || [])].filter((n) => /computer|chrome|browser/i.test(n)))];
    const cxPlain = [...new Set(cxYou.map(cxName))];
    const why = `${asYou.length ? `The change below leaves out ${list(asYou.map((p) => esc(p.name)))}, because asking before every step in your browser would mean hundreds of questions a week. ` : ""}${((n) => (n.length ? `${list(n.map((p) => esc(p.name)))} ${n.length === 1 ? "isn't" : "aren't"} in it either, because ${n.length === 1 ? "it has" : "they have"} nothing that sends or deletes. ` : ""))(ports.filter((p) => !p.as_you && !p.covered && !(p.rules || []).length))}${busiest && busiest.used ? `The busiest ${wk(per)} was ${esc(busiest.name)}, ${plural(busiest.used, "time")}.` : `None of them ran ${wk(per)}.`}${cxPlain.length ? ` Codex can act as you too, because its ${esc(list(cxPlain))} ${cxPlain.length === 1 ? "tool is" : "tools are"} switched on there.` : ""}`;
    const sel = open.filter((p) => ((S.qpick && S.qpick.reach) || new Set(open.filter((x) => x.pick).map((x) => x.name))).has(p.name));
    const yous = sel.filter((p) => p.as_you).map((p) => `<b>${esc(p.name)}</b>`), sends = sel.filter((p) => !p.as_you).length;
    let act;
    if (!open.length) act = done ? madeAct(done, esc(done.summary)) : `<span class="q-lead">Claude Code already asks you before each of these acts.</span>`;
    else if (snoozed("q:reach")) act = hiddenAct("reach", "The suggested change is");
    else act = `<span class="q-lead">Claude Code could ask you${yous.length ? ` before ${list(yous)} ${yous.length === 1 ? "acts" : "act"}` : ""}${yous.length && sends ? ", and" : ""}${sends ? ` before ${sends === 1 ? "one connector" : sends + " connectors"} send${sends === 1 ? "s" : ""} or delete${sends === 1 ? "s" : ""} anything` : ""}${!yous.length && !sends ? " before the connectors you pick act" : ""}.</span><button class="w-btn main" data-w="q:sheet:reach">Show me the change</button>${later("reach")}`;
    if (done && open.length) act = madeAct(done, esc(done.summary)) + `<button class="w-btn" data-w="q:sheet:reach">Show me the list</button>`;
    return card("reach", "What can Claude reach outside my Mac?", !!open.length && !snoozed("q:reach") && !done, `<p class="q-a" ${tip("A connector is a link to another app, like Google Drive or Figma. Claude's settings call these MCP servers.")}>${a}</p><div class="q-chips">${chips}</div><p class="q-why" ${tip("Each connector is judged by every action it offers, including ones it hasn't used yet.")}>${why}</p>`, act);
  }
  function cxSheet() {
    const CX = (G.anatomy || {}).Codex || {}, you = [...new Set([...(CX.plugins || []), ...(CX.connectors || [])].filter((n) => /computer|chrome|browser/i.test(n)))];
    if (!you.length) return "";
    const st = Object.fromEntries(((CX.settings || {}).items || []).map(([k, v]) => [k, v]));
    return `<div class="q-grp"><h4>In Codex <small>not part of this change</small></h4><p class="q-tags">${[...new Set(you.map(cxName))].map((n) => `<span class="q-tag">${esc(n)}</span>`).join("")}</p>
      <p class="q-small">These let Codex control your computer or a browser. ${esc(cxRules(st))} Crossview can't change Codex yet, so switch these off in Codex's settings if you don't use them there. Crossview hasn't checked yet what Codex asks before each action.</p></div>`;
  }
  // Codex's own names for its tools and settings, in plain words
  const cxName = (n) => ({ "unified-computer-use": "computer control", "computer-use": "computer control", chrome: "Chrome", browser: "browser" })[n] || n;
  const cxRules = (st) => {
    const a = { never: "Codex's settings let it act without asking", "on-request": "Codex's settings let it decide when to ask you", untrusted: "Codex's settings make it ask before most actions", "on-failure": "Codex's settings make it ask only after something fails" }[st["Approval rule"]];
    const b = { "danger-full-access": "it can change files anywhere on this Mac", "workspace-write": "it can change files only in the folder it works in", "read-only": "it can only read files" }[st["Sandbox"]];
    return a || b ? `${a || "Codex's settings decide when it asks you"}${b ? `, and ${b}` : ""}.` : "";
  };
  const plainAct = (t) => t.replace(/^mcp__[^_]+(?:_[^_]+)*?__/, "").replace(/[_-]+/g, " ");
  function reachSheet(per) {
    const { open, weeks } = reachFacts(per);
    const picked = (S.qpick.reach = S.qpick.reach || new Set(open.filter((p) => p.pick).map((p) => p.name)));
    const rows = open.map((p) => `<li class="q-item${picked.has(p.name) ? " on" : ""}"><label><input type="checkbox" data-w="q:pick:reach:${esc(p.name)}" ${picked.has(p.name) ? "checked" : ""}>
        <span><b>${esc(p.name)}</b> <small>${esc(riskWords(p))}</small><br><small>${p.as_you ? `Claude Code would ask before every action. That's about ${plural(p.weekly, "question")} a week on average over the last ten weeks, going by the last ${plural(weeks.length, "week")}.${p.pick ? "" : " It's left unticked because that many questions would get in the way. Tick it if you want them anyway."}` : `Claude Code would ask only before actions like ${esc(p.risky_tools.slice(0, 4).map(plainAct).join(", "))}${p.risky_tools.length > 4 ? `, and ${p.risky_tools.length - 4} more like them` : ""}. Reading and everything else stay the same. ${p.risky_uses ? `Those actions ran ${plural(p.risky_uses, "time")} since ${since("Claude Code")}.` : `None of them have run since ${since("Claude Code")}.`}`}</small></span></label>
        ${picked.has(p.name) ? `<details class="q-exact"><summary>Show the exact lines</summary><pre class="q-diff"><ins>${esc(p.rules.map((r) => `+ "${r}"`).join("\n"))}</ins></pre></details>` : ""}</li>`).join("");
    const sel = open.filter((p) => picked.has(p.name)), rules = sel.flatMap((p) => p.rules);
    return { title: "Ask me before these connectors act", kind: "ask-first", body: `<p>This adds rules to the "ask" list in <span class="w-link" tabindex="0" ${tip("The file is ~/.claude/settings.json, in your home folder.")}>Claude Code's settings file</span> and leaves the rest of the file alone. Claude Code then stops and asks you before those actions, even when you've told it to work without asking.</p>
      <p class="q-small">It applies to Claude Code in every project, including the Code tab of the Claude app. Cowork and the Claude app's chats keep their own connector settings.</p>
      <p class="q-small">Undo on Your week takes out only the rules this added and leaves any you add later. Crossview keeps a copy of the file on this Mac first.</p>
      <ul class="q-items">${rows}</ul>${cxSheet()}`,
      req: rules.length ? { kind: "ask-first", rules, for: "reach", summary: `Claude Code asks before ${list(sel.map((p) => p.name))} ${sel.length === 1 && sel[0].as_you ? "acts" : "act"}${sel.some((p) => !p.as_you) ? ", and for some only before sending or deleting" : ""}.` } : null,
      ask: `Please add these rules to the "ask" list under "permissions" in ~/.claude/settings.json, and change nothing else in that file: ${rules.join(", ")}. Show me the change before you save it.` };
  }

  // ---------- 4. What am I carrying that I never use? ----------
  function carryFacts(per) {
    const sk = G.skills || [], unused = sk.filter((s) => !s.uses), helpers = (G.agents || []).filter((a) => !a.runs);
    // the list of every skill Claude reads with each reply: names and descriptions; built-in ones aren't on disk, so they count at the average
    const every = sk.filter((s) => s.scope === "every session"), known = every.filter((s) => s.desc_len), avg = known.length ? known.reduce((a, s) => a + s.desc_len, 0) / known.length : 300;
    const chars = every.filter((s) => !s.uses).reduce((a, s) => a + (s.desc_len || avg), 0), tokens = chars / 4;
    const P = M.periods[per] || {}, replies = Object.values(P).reduce((a, t) => a + (t.replies || 0), 0);
    const mix = {}; Object.values(P).forEach((t) => Object.entries(t.models || {}).forEach(([m, u]) => (mix[m] = (mix[m] || 0) + u)));
    const mt = Object.values(mix).reduce((a, b) => a + b, 0) || 1, read = Object.entries(mix).reduce((a, [m, u]) => a + ((priceOf(m) || [0, 0, 0, 0])[3] * u) / mt, 0);
    const usd = (tokens * replies * read) / 1e6, use = useOf(per);
    const groups = [
      ["From your Claude account", unused.filter((s) => s.origin === "From your Claude account"), "You can switch these off in claude.ai's settings, where skills are turned on and off. That changes the Claude app too, and its use isn't recorded on this Mac, so check you don't use one there first."],
      ["Made by you", unused.filter((s) => s.origin === "Made by you"), null],
      ["Came with Claude Code", unused.filter((s) => s.origin === "Came with Claude Code"), "These are part of Claude Code itself, so there's nothing to remove."],
      ["Only in one project", unused.filter((s) => s.scope === "one project"), "Claude reads these only in that project's chats, so they cost nothing anywhere else."],
    ];
    return { sk, unused, helpers, tokens, usd, use, groups };
  }
  function carry(per) {
    const f = carryFacts(per), { sk, unused, helpers, usd, use } = f;
    const acct = f.groups[0][1].length;
    const a = `${unused.length} of your ${sk.length} skills have never been used.${acct ? ` You could switch off ${acct} of them.` : ""}`;
    const order = sk.slice().sort((x, y) => (y.uses || 0) - (x.uses || 0)), mx = Math.max(1, ...sk.map((s) => s.uses || 0));
    const tiles = `<div class="q-tiles" role="img" aria-label="${esc(`${sk.length} skills, ${sk.length - unused.length} used and ${unused.length} never used`)}">${order.map((s) => `<i class="${s.uses ? "t" + Math.min(4, 1 + Math.floor((3 * Math.log(1 + s.uses)) / Math.log(1 + mx))) : "never"}" ${tip(`${s.name} ${s.uses ? `was used ${plural(s.uses, "time")}` : "has never been used"}. ${{ "Made by you": "You made it.", "From your Claude account": "It comes from your Claude account.", "Came with Claude Code": "It came with Claude Code." }[s.origin] || `It's ${String(s.origin).charAt(0).toLowerCase() + String(s.origin).slice(1)}.`}`)}></i>`).join("")}</div>`;
    const share = use ? (100 * usd) / use : 0;
    const why = `${acct ? "The rest came with Claude Code, are new, or load in only one project. " : ""}Claude reads every skill's name and description before each reply. For the skills you never use, that came to ${usd < 1 ? "less than $1" : `about $${Math.round(usd)}`} of ${wk(per)}'s use${use ? `, which is ${share < 1 ? "under 1%" : Math.round(share) + "%"} of it` : ""}. Every chat reads the whole list before it starts.`;
    const act = `<span class="q-lead">You can see which ones you could switch off, and where to do it.${helpers.length ? ` The list also shows ${plural(helpers.length, "subagent")} that never ran.` : ""}</span><button class="w-btn main" data-w="q:sheet:carry">Show me the list</button><button class="w-btn quiet" data-w="setup:never">Show them in Your setup</button>`;
    return card("carry", "What have I set up that I never use?", false, `<p class="q-a" ${tip(`A skill is a set of instructions for one kind of task, which Claude or a subagent loads when that task comes up. Never used means not once since Claude Code's records start on ${since("Claude Code")}.`)}>${a}</p>${tiles}<p class="q-why" ${tip(`This is an estimate. It counts about four characters per token, gives built-in skills the average length, and prices them at the re-read rate of the models used ${wk(per)}. Claude Code shortens the list when it's long, so the real figure may be lower.`)}>${why}</p>`, act);
  }
  function carrySheet(per) {
    // "new" only where the date is when it was made: an account skill's date on this Mac is when it last synced
    const f = carryFacts(per), recent = (s) => s.origin !== "From your Claude account" && s.added && daysSince(s.added) < 30;
    const grp = ([label, items, note]) => !items.length ? "" : `<div class="q-grp"><h4>${esc(label)} <small>${items.length}</small></h4><p class="q-tags">${items.map((s) => `<span class="q-tag" ${tip(s.plain || s.name)}>${esc(s.name)}${recent(s) ? " <small>new</small>" : ""}</span>`).join("")}</p>
      <p class="q-small">${note || (items.every(recent) ? "These were added in the last 30 days, so they're too new to judge." : "You made these, so they're yours to keep or delete. Each one is a folder in your skills folder.")}</p></div>`;
    const acct = f.groups[0][1];
    const help = f.helpers.length ? `<div class="q-grp"><h4>Subagents that never ran <small>${f.helpers.length}</small></h4><p class="q-tags">${f.helpers.map((a) => `<span class="q-tag" ${tip(a.plain || a.name)}>${esc(a.name)}</span>`).join("")}</p><p class="q-small">${f.helpers.map((a) => `${a.name} ${builtIn(a.name) ? "is part of Claude Code" : `is ${esc(String(a.origin).charAt(0).toLowerCase() + String(a.origin).slice(1))}`}`).join("; ")}.</p></div>` : "";
    return { title: "What you could switch off", body: `<p>None of these has been used in Claude Code since its records start on ${esc(since("Claude Code"))}. Crossview can't change your Claude account, so this is a list for you to work through.</p>${f.groups.map(grp).join("")}${help}`,
      req: null, cant: "Crossview can't switch skills off in your Claude account, so it can't make this change for you.", ask: acct.length ? `Please open claude.ai in my signed-in Chrome, go to the settings page where skills are turned on and off, and show it to me. These ${acct.length} skills have never been used in my Claude Code logs: ${acct.map((s) => s.name).join(", ")}. Ask me before switching off each one, and don't change anything else.` : null };
  }

  // ---------- the warning in Claude Code (tools/statusline.py), switched on only after a yes ----------
  function paceSheet() {
    const L = M.plan && M.plan.latest, wr = M.plan && M.plan.weekly_reset;
    const now = `5-hour ${L ? L.fh : 17}% · <span class="dim">resets 7 pm</span> · week ${L ? L.sd : 9}%`;
    const cmd = `"python3" "…/Agent-Glass-Box/tools/statusline.py"`;
    return { title: "Warn me in Claude Code before I run out", kind: "status-line", body: `<p>This adds a line from Crossview to the bottom of Claude Code. After each reply it shows your 5-hour and weekly limits. If the pace of the last 45 minutes would use up a limit before it resets, the line turns orange.</p>
      <div class="q-term" aria-label="What the line looks like"><div><span class="lbl">Most of the time, with your last reading and an example reset time</span>${now}</div><div><span class="lbl">An example of when you're on pace to run out</span>5-hour 62% · <span class="or">at this pace, out by 3:40 pm</span> (resets 4 pm) · week 41%</div><div><span class="lbl">When a limit stops you</span><span class="or">5-hour limit reached · reopens 4 pm</span> · week 63%</div></div>
      <p class="q-small">It saves the time of each reading, the two percentages and their reset times in Crossview's data folder on this Mac. That makes the forecast here exact.${wr ? ` Today the weekly reset is only known to fall between ${esc(wr.from)} and ${esc(wr.to)}.` : ""} It saves nothing about your chats.</p>
      <p class="q-small">Undo on Your week takes the line out. Crossview keeps a copy of the settings file first.</p>
      <details class="q-exact"><summary>Show the exact lines</summary><pre class="q-diff"><ins>+ "statusLine": {\n+   "type": "command",\n+   "command": ${esc(cmd)}\n+ }</ins></pre></details>
      <p class="q-small">Claude Code shows it under the box where you type. Crossview hasn't checked yet whether the Claude app's Code tab shows it too. If you already have your own line there, Crossview won't replace it.</p>`,
      req: { kind: "status-line", for: "pace", summary: "Claude Code shows your limits and warns before you run out." },
      ask: null };
  }

  // ---------- your agents, as a small row ----------
  function agentsRow(per) {
    const H = {};
    Object.values(M.periods[per] || {}).forEach((t) => Object.entries(t.agents || {}).forEach(([k, a]) => { if (!k.startsWith("helper:")) return; const ty = k.split(":").slice(2).join(":"); (H[ty] = H[ty] || { type: ty, runs: 0, apps: new Set() }).runs += a.runs; H[ty].apps.add(k.split(":")[1]); }));
    const hs = Object.values(H).filter((h) => h.runs).sort((a, b) => b.runs - a.runs), runs = hs.reduce((a, h) => a + h.runs, 0), apps = [...new Set(hs.flatMap((h) => [...h.apps]))];
    const chips = hs.slice(0, 4).map((h) => `<button class="q-chip" data-w="setup:helper:${esc(h.type)}" ${tip(`${h.type} ran ${nWord(h.runs)} ${wk(per)}. Click to see it in Your setup.`)}><i class="w-light on"></i>${esc(h.type)} <em>${h.runs}</em></button>`).join("") + (hs.length > 4 ? `<button class="q-chip" data-w="setup:helpers">+ ${hs.length - 4} more</button>` : "");
    return `<section class="w-mod q-row" aria-label="Your subagents">${screws}<b class="q-row-t">Your subagents ${wk(per)}</b><span class="q-row-n">${hs.length ? `${plural(hs.length, "subagent")} ran ${plural(runs, "time")}${apps.length ? " in " + list(apps) : ""}` : `No subagents ran${soFar(per)}`}</span>
      <div class="q-chips">${chips}</div><button class="w-btn" data-w="q:detail" ${tip("Opens the week in detail, with each app wired to the subagents it used, your limits and what you paid.")}>Show me how they connect</button></section>`;
  }

  // ---------- the sheet: a prepared change, opened over the page so nothing moves ----------
  function sheet(per) {
    if (!S.qopen) return "";
    S.qpick = S.qpick || {};
    let s;
    if (S.qopen === "stops") s = stopsSheet(per);
    else if (S.qopen === "limit") s = limitSheet(per);
    else if (S.qopen === "reach") s = reachSheet(per);
    else if (S.qopen === "carry") s = carrySheet(per);
    else if (S.qopen === "pace") s = paceSheet(per);
    else if (S.qopen === "plans") s = plansSheet();
    else if (S.qopen.startsWith("undo:")) {
      const c = (G.changes || []).find((x) => x.id === S.qopen.slice(5));
      if (!c) return "";
      s = { title: "Undo this change?", body: `<p><b>Made ${esc(when(c.when))}.</b> ${esc(c.summary)}</p><ul class="q-list">${c.items.map((it) => `<li>In ${code(short(it.file))}, ${it.added ? `this takes out the ${plural(it.added.length, "rule")} Crossview added` : it.set ? "this takes out Crossview's line" : it.before ? `this puts back ${code(it.before)}` : `this takes out ${code(it.after)}`}.</li>`).join("")}</ul>
        <p class="q-small">Anything you've changed in those files since then stays as it is. If something changed in the same spot, Crossview leaves it alone and tells you.</p>`, undo: c.id,
        ask: `Please undo this change Crossview made, and change nothing else: ${c.items.map((it) => it.added ? `in ${it.file}, take ${it.added.join(", ")} out of the "ask" list under "permissions"` : it.set ? `in ${it.file}, remove the "statusLine" setting` : it.before ? `in ${it.file}, change "${it.after}" back to "${it.before}"` : `in ${it.file}, remove the line "${it.after}" from the header block`).join("; ")}. Show me each change before you save it.` };
    }
    if (!s) return "";
    const off = DEMO ? "This is the demo company, so changes are turned off." : LIVE ? "" : `To ${S.qopen.startsWith("undo:") ? "undo" : "make"} it, start Crossview by double-clicking “Agent Crossview.command” in its folder (Agent-Glass-Box).${s.ask ? " You can also copy the request for Claude Code." : ""}`;
    const copied = S.qcopied === S.qopen;
    // one row on every sheet: Make this change, Copy it for Claude Code, Close; what a sheet can't do is said in a line,
    // not by a different row (QA run 4, finding 9)
    // a sheet that only explains (the stops) has no change to make or copy, so it keeps just its own buttons (QA run 5, finding 1)
    const explains = !s.kind && !s.ask && !s.undo && s.kind !== "plans";
    const why = s.kind === "plans" || s.undo || explains ? "" : [!s.kind ? (s.cant || "Crossview can't make this change itself, so copy the request instead.") : "", !s.ask ? "Crossview makes this change itself, so there's nothing to copy for Claude Code." : ""].filter(Boolean).join(" ");
    const btns = s.kind === "plans" ? `<button class="w-btn main" data-w="q:saveplans" ${LIVE ? "" : "disabled"}>Save my plans</button><button class="w-btn quiet" data-w="q:close">Close</button>` : (s.undo ? (LIVE ? `<button class="w-btn main" data-w="q:undo:${esc(s.undo)}">Undo it</button>` : "") : explains ? "" : `<button class="w-btn main" data-w="q:make" ${!s.kind || !LIVE || !s.req ? "disabled" : ""}>Make this change</button>`)
      + (s.kind === "plans" || explains ? "" : `<button class="w-btn" data-w="q:copy" data-prompt="${esc(s.ask || "")}" ${s.ask ? tip("Copies a request to paste into Claude Code. Claude then makes the same change and asks before saving. Nothing happens until you paste it.") : "disabled"}>${copied ? "Copied. Paste it into Claude Code" : "Copy it for Claude Code"}</button>`)
      + (s.foot || "") + (s.kind === "plans" ? "" : `<button class="w-btn quiet" data-w="q:close">Close</button>`);
    return `<div class="q-veil" data-w="q:close"></div><div class="q-sheet" role="dialog" aria-modal="true" aria-labelledby="q-sheet-h">
      <header><h3 id="q-sheet-h">${esc(s.title)}</h3><button class="q-x" data-w="q:close" aria-label="Close">×</button></header>
      <div class="q-sheet-b">${s.body}${why ? `<p class="q-off">${esc(why)}</p>` : ""}${off && (s.kind || s.undo) && !(s.kind === "plans" && DEMO) ? `<p class="q-off">${esc(off)}</p>` : ""}${S.qerr ? `<p class="q-err" role="alert">${esc(S.qerr)}</p>` : ""}</div>
      <div class="g-more q-more" aria-hidden="true">More below ↓</div><footer>${btns}</footer></div>`;
  }
  function current(per) {
    return S.qopen === "limit" ? limitSheet(per) : S.qopen === "reach" ? reachSheet(per) : S.qopen === "carry" ? carrySheet(per) : S.qopen === "stops" ? stopsSheet(per) : S.qopen === "pace" ? paceSheet(per) : null;
  }

  // a Mac with no chats in any of the three apps yet: say so, and offer the made-up company
  const empty = () => !DEMO && !(G.sessions > 0) ? `<section class="w-mod q-empty">${screws}<p class="q-q"><i class="w-led"></i>Nothing to read yet</p><p class="q-a">Crossview didn't find any chats from Claude Code, Cowork or Codex on this Mac.</p>
    <p class="q-why">It reads the records those apps keep on the Mac. Chats in the Claude website or ChatGPT's website aren't kept here, and Cowork tasks that run in the cloud may not be either. Use one of the three apps on this Mac, then refresh.</p>
    <div class="q-act"><span class="q-lead">You can see what it shows for a made-up company.</span><a class="w-btn main" href="?demo">Show me the demo company</a></div></section>` : "";
  // the page (task 33, Oct 14): one sentence, the four questions as four plates, and the picked question in the panel
  const QS = [["plan", "Am I on the right plan?", 2], ["limit", "What used up my limit?", 3], ["reach", "What can Claude reach outside my Mac?", 4], ["carry", "What have I set up that I never use?", 6]];
  function agentsLine(per) {
    const H = {};
    Object.values(M.periods[per] || {}).forEach((t) => Object.entries(t.agents || {}).forEach(([k, a]) => { if (!k.startsWith("helper:")) return; const ty = k.split(":").slice(2).join(":"); (H[ty] = H[ty] || { runs: 0, apps: new Set() }).runs += a.runs; H[ty].apps.add(k.split(":")[1]); }));
    const hs = Object.values(H).filter((h) => h.runs), runs = hs.reduce((a, h) => a + h.runs, 0), apps = [...new Set(hs.flatMap((h) => [...h.apps]))];
    return hs.length ? `${plural(hs.length, "subagent")} ran ${plural(runs, "time")} ${wk(per)}${apps.length ? " in " + list(apps) : ""}, across your projects.` : `No subagents ran${soFar(per)}.`;
  }
  // ---------- Your week, redrawn Oct 15 (his pick after three chart reads): Claude's weekly limit as one pace chart from
  // the Claude app's readings, his plans stated plainly, and what changed this week compared with the four weeks before,
  // picked by fixed rules. What's set up all week (reach, skills never used) sits at the end until it moves to Your setup.
  const weeksAll = () => Object.keys(M.periods || {}).filter((k) => k !== "all").sort();
  const priorOf = (per) => { const w = weeksAll(), i = w.indexOf(per); return i < 0 ? [] : w.slice(Math.max(0, i - 4), i); };
  const conOf = (per) => { const c = {}; Object.values(M.periods[per] || {}).forEach((t) => Object.entries(t.connectors || {}).forEach(([k, n]) => (c[k] = (c[k] || 0) + n))); return c; };
  const subOf = (per) => { const c = {}; Object.values(M.periods[per] || {}).forEach((t) => Object.entries(t.agents || {}).forEach(([k, a]) => { if (k.startsWith("helper:")) { const ty = k.split(":").slice(2).join(":"); c[ty] = (c[ty] || 0) + a.runs; } })); return c; };
  const portOf = (id) => (M.ports || []).find((p) => p.id === id) || { id, name: id, kinds: [] };
  const appTools = (id) => !!portOf(id).built_in || portOf(id).name === "Claude app's own tools";  // built into the app, not a connector
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const times = (r) => (r >= 3 ? `about ${Math.round(r)} times` : r >= 2 ? "more than twice" : "almost twice");
  const spell = (n) => ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"][n] || String(n);
  const partOfDay = (ts) => { const h = at(ts).getHours(); return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"; };
  const canDo = (p) => riskOf(p) ? riskWords.line(p).replace(/^It /, `${p.name} `) : ""; const canDoOld = (p) => { const k = (p.kinds || []).filter((x) => ["change", "send", "delete"].includes(x)); return k.length ? `${p.name} can ${list(k)} things${p.outside ? " in another app" : ""}.` : ""; };

  function changes(per) {
    const all = weeksAll(), i = all.indexOf(per), prior = priorOf(per), before = all.slice(0, Math.max(0, i)), out = [];
    if (i < 0 || !prior.length) return out;
    const now = conOf(per), was = prior.map(conOf), ever = before.map(conOf), hist = all.slice(Math.max(0, i - 7), i + 1);
    // a connector used far more than usual: at least twice its usual week, and at least 100 more uses
    Object.entries(now).sort((a, b) => b[1] - a[1]).forEach(([id, n]) => {
      const p = portOf(id), u = avg(was.map((c) => c[id] || 0));
      if (appTools(id) || !(u >= 20 && n >= 2 * u && n - u >= 100)) return;
      out.push({ id: "con:" + id, kind: "spike", hot: riskWords.hot(p), port: p, n, u, hist: hist.map((w) => conOf(w)[id] || 0),
        title: `${cap(p.name)} ran ${times(n / u)} its usual amount`, why: riskWords.line(p), line: `It ran ${n.toLocaleString()} times, against about ${Math.round(u).toLocaleString()} a week over the four weeks before.` });
    });
    // connectors used for the first time in Crossview's records
    const firsts = Object.keys(now).filter((id) => !appTools(id) && !ever.some((c) => c[id])).map(portOf);
    if (firsts.length) out.push({ id: "new", kind: "new", ports: firsts, title: `${firsts.length === 1 ? "A connector" : `${spell(firsts.length)} connectors`} ran for the first time`,
      line: `The new ${firsts.length === 1 ? "one is" : "ones are"} ${list(firsts.map((p) => p.name))}.${firsts.map(canDo).filter(Boolean).length ? " " + firsts.map(canDo).filter(Boolean).join(" ") : ""}` });
    // skills added this week, and whether they've been used yet
    // only skills you made: an account skill's date on this Mac is when it last synced, not when it was added
    const added = (G.skills || []).filter((k) => k.origin !== "From your Claude account" && k.added && k.added >= per && k.added <= plus(per, 6)).sort((a, b) => (a.added < b.added ? -1 : 1)), unused = added.filter((k) => !(k.uses > 0));
    if (added.length) out.push({ id: "skills", kind: "skills", skills: added, unused,
      title: `You added ${added.length === 1 ? "a skill" : `${spell(added.length).toLowerCase()} skills`}${!unused.length ? "" : unused.length === added.length ? `, and ${added.length === 1 ? "it hasn't" : added.length === 2 ? "neither has" : "none has"} been used yet` : `, and ${spell(unused.length).toLowerCase()} ${unused.length === 1 ? "hasn't" : "haven't"} been used ${per === thisWeek ? "yet" : "since"}`}`,
      line: `${list(added.map((k) => `${k.name} (${day(k.added)})`))}.` });
    // a subagent that ran far more than usual
    const sn = subOf(per), sw = prior.map(subOf);
    Object.entries(sn).sort((a, b) => b[1] - a[1]).forEach(([ty, n]) => {
      const u = avg(sw.map((c) => c[ty] || 0));
      if (u >= 2 && n >= 2 * u && n - u >= 5) out.push({ id: "sub:" + ty, kind: "sub", ty, n, u, title: `The ${ty} subagent ran ${times(n / u)} its usual amount`, line: `It ran ${plural(n, "time")}, against about ${Math.round(u)} a week over the four weeks before.` });
      else if (u < 2 && n >= 6) out.push({ id: "sub:" + ty, kind: "sub", ty, n, u, title: `The ${ty} subagent ran ${plural(n, "time")}`, line: `It barely ran in the four weeks before.` });
    });
    // several subagents far above usual (a team at work) read as one change, listed in its panel
    const subs = out.filter((c) => c.kind === "sub");
    if (subs.length > 2) {
      out.splice(out.indexOf(subs[0]), 0, { id: "subs", kind: "subs", items: subs, title: `${spell(subs.length)} subagents ran far more than usual`, line: `${list(subs.slice(0, 3).map((c) => c.ty).concat(subs.length > 3 ? [`${spell(subs.length - 3).toLowerCase()} more`] : []))}.` });
      subs.forEach((c) => out.splice(out.indexOf(c), 1));
    }
    // a different project took most of the week
    const top = (w) => Object.entries(M.periods[w] || {}).filter(([, t]) => t.usd > 0).sort((a, b) => b[1].usd - a[1].usd)[0];
    const t1 = top(per), t0 = i > 0 ? top(all[i - 1]) : null, use = useOf(per) || 1;
    if (t1 && t0 && t1[0] !== t0[0] && t1[1].usd / use >= 0.4) out.push({ id: "proj", kind: "proj", w: t1[0], prev: t0[0],
      title: `${t1[1].usd / use >= 0.5 ? "Most" : "The biggest share"} of ${wk(per)}'s use went to ${workName(t1[0])}`, line: `${per === thisWeek ? "Last week" : "The week before"} it was ${workName(t0[0])}.` });
    const order = { spike: 0, new: 1, skills: 2, sub: 3, subs: 3, proj: 4 };
    return out.sort((a, b) => (b.hot ? 1 : 0) - (a.hot ? 1 : 0) || order[a.kind] - order[b.kind]);
  }

  // read-only, for docs/what-changed-rules.md: what the rules pick in any week
  window.GBWeekChanges = (per) => changes(per).map((c) => ({ kind: c.kind, title: c.title, line: c.line }));
  // the connectors that ran this week, drawn out from "your Mac" (his favorite part of the Oct 15 concepts)
  function macPicture(per, mark) {
    const now = conOf(per), ever = weeksAll().filter((w) => w < per).map(conOf);
    const ids = Object.entries(now).filter(([id]) => !appTools(id)).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([id]) => id);
    if (!ids.length) return "";
    const H = 20 + ids.length * 22;
    const rows = ids.map((id, k) => { const p = portOf(id), y = 18 + k * 22, isNew = !ever.some((c) => c[id]), hot = riskWords.hot(p), on = mark && mark.includes(id);
      return `<path d="M84 ${H / 2} C150 ${H / 2} 150 ${y - 4} 200 ${y - 4}" class="q-mac-w${hot ? " hot" : ""}${on ? " on" : ""}"/><text x="208" y="${y}" class="q-mac-t${hot ? " hot" : ""}">${esc(p.name)}${isNew ? " · new" : ""}</text>`; }).join("");
    return `<svg class="q-mac" viewBox="0 0 400 ${H}" role="img" aria-label="${esc(`The connectors that ran ${wk(per)}: ${ids.map((id) => portOf(id).name).join(", ")}`)}"><rect x="2" y="${H / 2 - 16}" width="82" height="32" rx="8" class="q-mac-box"/><text x="18" y="${H / 2 + 4}" class="q-mac-t strong">your Mac</text>${rows}</svg>
      <p class="q-small">The connectors that ran ${wk(per)}. Orange marks the ones that can send, delete or act as you.</p>`;
  }
  const spark = (h, hot) => { const mx = Math.max(1, ...h); return `<svg class="q-spark" viewBox="0 0 ${h.length * 18} 26" aria-hidden="true">${h.map((v, i) => { const y = Math.max(1.5, (v / mx) * 22); return `<rect x="${i * 18}" y="${24 - y}" width="12" height="${y}" rx="2" class="${i === h.length - 1 ? (hot ? "now hot" : "now") : ""}"/>`; }).join("")}</svg>`; };

  function changePanel(c, per) {
    const act = (b) => `<div class="q-act">${b}</div>`;
    if (c.kind === "spike") {
      const where = Object.entries(M.periods[per] || {}).map(([w, t]) => [w, (t.connectors || {})[c.port.id] || 0]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
      const whereLine = where.length === 1 ? `All of them were on ${esc(workName(where[0][0]))}.` : where.length ? `Most were on ${esc(workName(where[0][0]))}.` : "";
      return `<div class="q-spark-l">${spark(c.hist, c.hot)}<small>its last ${plural(c.hist.length, "week")}, this one darkest</small></div>${macPicture(per, [c.port.id])}<p class="q-why">${whereLine}</p>`
        + (!c.port.reach ? "" : `<details class="q-how"><summary>How to switch it off when you're not using it</summary><p>In Claude Code, type ${code("/mcp")}, pick ${esc(c.port.name)} and choose to disable it. Turn it back on the same way.</p></details>`)
        + act(`<button class="w-btn" data-w="setup:layer:connectors" ${tip("Shows every connector, what each can do and how often it ran.")}>See every connector in Your setup</button>`);
    }
    if (c.kind === "new") return `${macPicture(per, c.ports.map((p) => p.id))}` + act(`<button class="w-btn" data-w="setup:layer:connectors">See every connector in Your setup</button>`);
    if (c.kind === "skills") return `<ul class="q-list">${c.skills.map((k) => `<li><b>${esc(k.name)}</b>${k.uses > 0 ? "" : " <small>not used yet</small>"}${k.plain ? `<br><small>${esc(k.plain)}</small>` : ""}</li>`).join("")}</ul><p class="q-why">A skill is instructions packaged for one kind of task. Claude reads each skill's name and description before every reply, so the ones you never use still take a little room.</p>`
      + act(`<button class="w-btn" data-w="q:plate:carry">Show me the skills I never use</button>`);
    if (c.kind === "sub") return `<p class="q-why">A subagent is a separate AI with its own instructions, which Claude Code can hand part of a job to.</p>` + act(`<button class="w-btn" data-w="setup:helper:${esc(c.ty)}">See it in Your setup</button>`);
    if (c.kind === "subs") return `<ul class="q-list">${c.items.map((x) => `<li><b>${esc(x.ty)}</b><br><small>${esc(x.line)}</small></li>`).join("")}</ul><p class="q-why">A subagent is a separate AI with its own instructions, which Claude Code can hand part of a job to.</p>` + act(`<button class="w-btn" data-w="setup:helpers">See your subagents in Your setup</button>`);
    if (c.kind === "proj") return act(`<button class="w-btn" data-nwork="${esc(c.w)}">Show me this project</button>`);
    return "";
  }

  // Claude's weekly limit through the week, from the Claude app's readings on this Mac, with every limit stop marked
  function pace(per, noCodex) {
    const P = M.plan || {}, t0 = new Date(per + "T00:00").getTime(), D = 86400000, off = (d) => (new Date(d).getTime() - t0) / D;
    const R = (P.readings || []).filter(([t, sd]) => sd != null && off(t) >= 0 && off(t) < 7).map(([t, sd]) => [off(t), sd, t]);
    const reset = P.weekly_reset && P.weekly_reset.last && off(P.weekly_reset.last) >= 0 && off(P.weekly_reset.last) < 7 ? off(P.weekly_reset.last) : null;
    const isNow = per === thisWeek, last = R[R.length - 1], END = 7, x = (d) => 96 + d * 116, y = (v) => 222 - v * 1.84;
    let g = `<line x1="${x(0)}" y1="${y(100)}" x2="${x(END)}" y2="${y(100)}" class="q-p-ceil"/><text x="0" y="${y(100) + 4}" class="q-p-ax">all used</text><line x1="${x(0)}" y1="${y(50)}" x2="${x(END)}" y2="${y(50)}" class="q-p-grid"/><text x="0" y="${y(50) + 4}" class="q-p-ax">half</text><line x1="${x(0)}" y1="${y(0)}" x2="${x(END)}" y2="${y(0)}" class="q-p-base"/><text x="0" y="${y(0) + 4}" class="q-p-ax">none</text>`;
    // what hasn't happened yet starts now, not at the last reading (release 1 QA, finding 5)
    const nowD = last ? Math.min(END, Math.max(last[0], (Date.now() - t0) / D)) : null;
    if (isNow && last) g += `<rect x="${x(nowD)}" y="${y(100) - 12}" width="${Math.max(0, x(END) - x(nowD))}" height="${y(0) - y(100) + 12}" class="q-p-ahead"/><text x="${x(nowD) + 10}" y="${y(100) + 16}" class="q-p-ax">hasn't happened yet</text>`;
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((d, i) => { const dd = plus(per, i), fut = isNow && dd > G.today; g += `<text x="${x(i + 0.5)}" y="${y(0) + 22}" text-anchor="middle" class="q-p-day${fut ? " fut" : ""}${dd === G.today ? " today" : ""}">${d}</text>`; });
    if (R.length) {
      const pts = (reset != null && reset < R[0][0] ? [[reset, 0]] : []).concat(R.map(([d, v]) => [d, v]));
      g += `<path d="M${pts.map(([d, v]) => `${x(d).toFixed(1)} ${y(v).toFixed(1)}`).join(" L")}" class="q-p-line"/>`;
      g += `<circle cx="${x(last[0])}" cy="${y(last[1])}" r="5" class="q-p-dot"/>`;
      const wp = P.weekly_pace || {};
      if (isNow) {
        g += `<line x1="${x(last[0])}" y1="${y(100) - 18}" x2="${x(last[0])}" y2="${y(0)}" class="q-p-now"/><text x="${x(last[0])}" y="${y(100) - 22}" text-anchor="middle" class="q-p-lab strong">the Claude app's last reading, ${esc(ampm(new Date(last[2]).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }).replace(",", "")))}</text>`;
        g += `<text x="${x(last[0]) + 10}" y="${y(last[1]) + 20}" class="q-p-lab strong">${last[1]}% used</text>`;
        if (wp.runs_out) { const ro = Math.min(END, off(wp.runs_out)); g += `<path d="M${x(last[0])} ${y(last[1])} L${x(ro)} ${y(100)}" class="q-p-proj hot"/><text x="${x(ro) - 8}" y="${y(100) + 18}" text-anchor="end" class="q-p-lab hot">at this pace it runs out ${esc(shortWhen(wp.runs_out))}</text>`; }
        else if (wp.at_reset != null) { const e = P.weekly_reset && P.weekly_reset.next ? Math.min(END + 0.3, off(P.weekly_reset.next)) : END; g += `<path d="M${x(last[0])} ${y(last[1])} L${x(Math.min(END, e))} ${y(wp.at_reset * Math.min(END, e) / e + last[1] * (1 - Math.min(END, e) / e))}" class="q-p-proj"/><text x="${x(END) - 4}" y="${y(Math.max(wp.at_reset, last[1])) - 12}" text-anchor="end" class="q-p-lab">${wp.at_reset >= 45 && wp.at_reset <= 55 ? "about half" : `about ${wp.at_reset}%`} when it resets</text>`; }
      } else g += `<text x="${x(last[0]) + 10}" y="${y(last[1]) + 20}" class="q-p-lab strong">${last[1]}% at the last reading, ${esc(new Date(last[2]).toLocaleDateString("en-US", { weekday: "long" }))}</text>`;
    } else g += `<text x="${x(3.5)}" y="${y(50)}" text-anchor="middle" class="q-p-ax">No readings of Claude's weekly limit ${wk(per)}</text>`;
    // Claude's chart marks only Claude's own limits; Codex's stops get their own line under it (camera fix batch, Oct 15)
    const hs = hitsIn(per).filter((h) => h.tool !== "Codex");
    hs.forEach((h) => { const d = off(at(h.ts)); g += `<line x1="${x(d)}" y1="${y(0) - 7}" x2="${x(d)}" y2="${y(0) + 7}" class="q-p-stop"/>`; });
    // the stop is told in words under the chart, in the same kind of line as Codex's
    const lab = `${R.length ? `Claude's weekly limit ${wk(per)}: ${last[1]}% used${isNow ? ` as of the last reading` : ""}.` : ""} ${hs.length ? `A Claude limit stopped you ${nWord(hs.length)}.` : "No Claude limit stopped you."}`;
    const when = (h) => esc(shortWhen(h.ts));
    const stopLine = (who, list_) => { const h = list_[list_.length - 1]; return `<p class="q-p-stopline${list_.length ? " hot" : ""}"><i aria-hidden="true"></i>${!list_.length ? `No ${who} limit stopped you ${wk(per)}${soFar(per)}.` : list_.length === 1 ? `${who}'s ${esc(limitName(h))} limit stopped you on ${when(h)}.` : `${who}'s limits stopped you ${nWord(list_.length)}, the last on ${when(h)}.`}</p>`; };
    const cx = hitsIn(per).filter((h) => h.tool === "Codex"), usesCodex = Object.values(M.periods || {}).some((P) => Object.values(P).some((t) => (t.app_sessions || {}).Codex));
    const lines = `<div class="q-p-stops">${stopLine("Claude", hs)}${usesCodex && !noCodex ? stopLine("Codex", cx) : ""}</div>`;
    return `<svg class="q-pace" viewBox="0 0 940 ${y(0) + 30}" role="img" aria-label="${esc(lab)}">${g}</svg>${lines}`;
  }

  // one name for each plan everywhere: the name it's sold under (QA run 7, finding 5)
  const planName = (p) => { const n = String(p.name).replace(/\s*\(for Codex\)$/i, ""); return /^Claude Max$/i.test(n) ? (p.monthly_usd >= 200 ? "Claude Max 20x" : "Claude Max 5x") : /^ChatGPT$/i.test(n) && p.monthly_usd === 20 ? "ChatGPT Plus" : n; };
  const dollars = (v) => (v < 100 ? `about $${Math.max(1, Math.round(v))}` : money(v));
  function plansBlock(per, app) {
    if (!B.plans.length) return `<p class="q-p-none">Crossview doesn't know which plans you pay for yet.</p>`;
    // one app's plan when the app switch is there (release 1): Codex's plan covers Codex; Claude's covers the rest
    const forCx = (p) => (p.covers || []).includes("Codex"), ps = !app ? B.plans : B.plans.filter((p) => (app === "Codex" ? forCx(p) : !forCx(p)));
    const cxUse = (((M.apps || {})[per] || {}).Codex || {}).usd || 0;
    const nd = daysIn(per), paid = !app ? PER_DAY * nd : (ps.reduce((a, p) => a + (p.monthly_usd || 0), 0) * 12 / 365) * nd, use = !app ? useOf(per) : app === "Codex" ? cxUse : Math.max(0, useOf(per) - cxUse), mx = Math.max(paid, use, 1), so = per === thisWeek ? "so far this week" : "last week";
    const nm = planName;
    if (!ps.length) return `<p class="q-p-none">Crossview doesn't know which plan covers ${esc(app)} yet.</p>`;
    return `<div class="q-plans">${ps.map((p) => `<span class="q-plan"><b>${esc(nm(p))}</b> $${p.monthly_usd} a month, flat<small>covers ${esc(list((p.covers || []).map((c) => (c === "Claude app" ? "the Claude app" : c))))}</small></span>`).join("")}</div>
      <div class="q-cmp"><span ${tip(per === thisWeek ? "A daily share of what you pay each month, for the days of this week so far. Your plans are flat fees, so this is how much of them this week used up." : "A daily share of what you pay each month, for the seven days of last week. Your plans are flat fees, so this is how much of them last week used up.")}>${ps.length === 1 ? (per === thisWeek ? "What your plan costs" : "What your plan cost") : "What your plans cost"} ${so}</span><span class="q-barw"><i class="q-bar paid" style="width:${Math.max(1, (paid / mx) * 70)}%"></i><b>about $${Math.round(paid)}</b></span>
        <span ${tip("Pay-per-use prices are what the same work would cost if you paid for each use instead of a flat plan. It isn't a bill.")}>If you paid per use instead</span><span class="q-barw"><i class="q-bar use" style="width:${Math.max(1, (use / mx) * 70)}%"></i><b>${app === "Codex" ? dollars(use) : money(use)}${per === thisWeek ? " so far" : ""}</b></span></div>`;
  }

  // ---------- Codex, one app at a time (release 1, Oct 16): its own limit chart, from the readings in its logs ----------
  const hasCodex = () => Object.values(M.apps || {}).some((a) => a && a.Codex) || !!((M.codex_plan || {}).readings || []).length;
  const appOf = () => (S.qapp === "Codex" && hasCodex() ? "Codex" : "Claude");
  const cxHits = (per) => hitsIn(per).filter((h) => h.tool === "Codex");
  const cxChats = (per) => (((M.apps || {})[per] || {}).Codex || {}).sessions || 0;
  function codexPace(per) {
    const C = M.codex_plan || {}, t0 = new Date(per + "T00:00").getTime(), D = 86400000, off = (d) => (new Date(d).getTime() - t0) / D;
    const R = (C.readings || []).filter(([t, sd]) => sd != null && off(t) >= 0 && off(t) < 7).map(([t, sd]) => [off(t), sd, t]);
    const starts = (C.window_starts || []).map(off).filter((d) => d > 0 && d < 7);
    const isNow = per === thisWeek, last = R[R.length - 1], END = 7, x = (d) => 96 + d * 116, y = (v) => 222 - v * 1.84;
    let g = `<line x1="${x(0)}" y1="${y(100)}" x2="${x(END)}" y2="${y(100)}" class="q-p-ceil"/><text x="0" y="${y(100) + 4}" class="q-p-ax">all used</text><line x1="${x(0)}" y1="${y(50)}" x2="${x(END)}" y2="${y(50)}" class="q-p-grid"/><text x="0" y="${y(50) + 4}" class="q-p-ax">half</text><line x1="${x(0)}" y1="${y(0)}" x2="${x(END)}" y2="${y(0)}" class="q-p-base"/><text x="0" y="${y(0) + 4}" class="q-p-ax">none</text>`;
    // what hasn't happened yet starts now, not at the last reading (release 1 QA, finding 5)
    const nowD = last ? Math.min(END, Math.max(last[0], (Date.now() - t0) / D)) : null;
    if (isNow && last) g += `<rect x="${x(nowD)}" y="${y(100) - 12}" width="${Math.max(0, x(END) - x(nowD))}" height="${y(0) - y(100) + 12}" class="q-p-ahead"/><text x="${x(nowD) + 10}" y="${y(100) + 16}" class="q-p-ax">hasn't happened yet</text>`;
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((d, i) => { const dd = plus(per, i), fut = isNow && dd > G.today; g += `<text x="${x(i + 0.5)}" y="${y(0) + 22}" text-anchor="middle" class="q-p-day${fut ? " fut" : ""}${dd === G.today ? " today" : ""}">${d}</text>`; });
    if (R.length) {
      // a new path where Codex's week started over, so the line drops instead of sliding down
      g += `<path d="${R.map(([d, v], k) => `${k && starts.some((s0) => R[k - 1][0] < s0 && s0 <= d) ? "M" : k ? "L" : "M"}${x(d).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")}" class="q-p-line"/>`;
      g += `<circle cx="${x(last[0])}" cy="${y(last[1])}" r="5" class="q-p-dot"/>`;
      if (isNow) g += `<line x1="${x(last[0])}" y1="${y(100) - 18}" x2="${x(last[0])}" y2="${y(0)}" class="q-p-now"/><text x="${x(last[0])}" y="${y(100) - 22}" text-anchor="middle" class="q-p-lab strong">Codex's last reading, ${esc(ampm(new Date(last[2]).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }).replace(",", "")))}</text>`;
      g += `<text x="${x(last[0]) + 10}" y="${y(last[1]) - 10}" class="q-p-lab strong">${Math.round(last[1])}% used</text>`;
    } else g += `<text x="${x(3.5)}" y="${y(50)}" text-anchor="middle" class="q-p-ax">No readings of Codex's weekly limit ${wk(per)}</text>`;
    starts.forEach((d, k) => (g += `<line x1="${x(d)}" y1="${y(100)}" x2="${x(d)}" y2="${y(0)}" class="q-p-start"/><text x="${x(d) + 6}" y="${y(100) + (isNow && last && Math.abs(d - last[0]) < 0.6 ? 52 : 34)}" class="q-p-ax">${k === 0 && (!R.length || R[0][0] >= d - 0.01) ? "its week started" : "its week started over"}</text>`));
    // Codex keeps its readings for about two weeks, so last week's start can come before them; each reading carries when its
    // week resets and how long the week is, which places the start even then (release 3)
    const first = R.length && !starts.length ? (C.readings || []).find(([t, sd]) => sd != null && t === R[0][2]) : null;
    if (first && first[3] && first[4]) { const d = off(new Date(new Date(first[3]).getTime() - first[4] * 60000)); if (d > 0 && d < 7) g += `<line x1="${x(d)}" y1="${y(100)}" x2="${x(d)}" y2="${y(0)}" class="q-p-start"/><text x="${x(d) + 6}" y="${y(100) + 34}" class="q-p-ax">its week started</text>`; }
    const hs = cxHits(per);
    hs.forEach((h) => { const d = off(at(h.ts)); g += `<line x1="${x(d)}" y1="${y(0) - 7}" x2="${x(d)}" y2="${y(0) + 7}" class="q-p-stop"/>`; });
    const lab = `${R.length ? `Codex's weekly limit ${wk(per)}: ${Math.round(last[1])}% used at its last reading.` : ""} ${hs.length ? `Codex's limits stopped you ${nWord(hs.length)}.` : "No Codex limit stopped you."}`;
    const h = hs[hs.length - 1];
    const line = `<div class="q-p-stops"><p class="q-p-stopline${hs.length ? " hot" : ""}"><i aria-hidden="true"></i>${!hs.length ? `No Codex limit stopped you ${wk(per)}${soFar(per)}.` : hs.length === 1 ? `Codex's ${esc(limitName(h))} limit stopped you on ${esc(shortWhen(h.ts))}.` : `Codex's limits stopped you ${nWord(hs.length)}, the last on ${esc(shortWhen(h.ts))}.`}</p></div>`;
    return `<svg class="q-pace" viewBox="0 0 940 ${y(0) + 30}" role="img" aria-label="${esc(lab)}">${g}</svg>${line}`;
  }
  function codexChanges(per) {
    const out = [], hs = cxHits(per);
    if (hs.length) {
      const h = hs[hs.length - 1], m = waited(h);
      out.push({ id: "cx:stops", kind: "cxstop", hot: true, title: `Codex's ${hs.length === 1 ? limitName(h) + " limit" : "limits"} stopped you ${nWord(hs.length)}`, line: `${hs.length === 1 ? "On" : "The last on"} ${shortWhen(h.ts)}.${m != null ? ` It opened again ${dur(m)} later.` : ""}` });
    }
    const n = cxChats(per), u = avg(priorOf(per).map(cxChats));
    if (u >= 2 && n >= 2 * u && n - u >= 5) out.push({ id: "cx:chats", kind: "cxchats", hot: false, title: `You used Codex ${times(n / u)} as much as usual`, line: `${plural(n, "chat")}, against about ${Math.round(u)} a week over the four weeks before.` });
    return out;
  }
  function codexStops(per) {
    const hs = cxHits(per);
    if (!hs.length) return `<p>No Codex limit stopped you ${wk(per)}${soFar(per)}.</p>`;
    return `<ul class="q-list">${hs.map((h) => { const r = (h.running || [])[0], m = waited(h); return `<li>On <b>${esc(shortWhen(h.ts))}</b>, its ${esc(limitName(h))} limit stopped you${r ? (/^Codex chats with no project$/.test(r.work) ? " while a Codex chat with no project was running" : ` while ${esc(workName(r.work))} was running`) : ""}.${m != null ? ` It opened again ${dur(m)} later.` : ""}</li>`; }).join("")}</ul>`;
  }
  const localWhen = (t) => ampm(new Date(t).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })).replace(/^(\w+),? /, "$1 at ");
  function codexPlanPanel(per) {
    const ps = B.plans.filter((p) => (p.covers || []).includes("Codex")), cxUse = (((M.apps || {})[per] || {}).Codex || {}).usd || 0;
    if (!ps.length) return `<p class="q-a">Crossview doesn't know which plan covers Codex yet.</p>`;
    const paid = (ps.reduce((a, p) => a + (p.monthly_usd || 0), 0) * 12 / 365) * daysIn(per), covered = cxUse >= paid;
    return `<p class="q-a">${covered ? `Yes. Codex's work ${per === thisWeek ? "this week would cost" : "last week would have cost"} ${dollars(cxUse)} at pay-per-use prices. Your ${esc(planName(ps[0]))} plan's share of those days is ${dollars(paid)}.` : `Your ${esc(planName(ps[0]))} plan's share of ${wk(per)} is ${dollars(paid)}${soFar(per)}. Codex's work would have cost ${dollars(cxUse)} at pay-per-use prices.`}</p>
      <p class="q-why">${esc(planName(ps[0]))} is $${ps[0].monthly_usd} a month, flat. Pay-per-use prices are what the same work would cost if you paid for each use instead; they aren't a bill. ${covered ? "" : "A plan still makes sense if you value never paying per use, or if Codex helps you elsewhere."}</p>`;
  }
  function codexLimitPanel(per) {
    const L = (M.codex_plan || {}).latest || {};
    return `<p class="q-a">${(() => { const R = ((M.codex_plan || {}).readings || []).filter((r) => r[0].slice(0, 10) >= per && r[0].slice(0, 10) <= plus(per, 6)), r = R[R.length - 1]; return r ? `${Math.round(r[1])}% of Codex's weekly limit used, at its last reading ${per === thisWeek ? "" : "that week "}on ${esc(localWhen(r[0]))}.` : `Crossview has no Codex readings for ${wk(per)}.`; })()}</p>
      <p class="q-why">Codex's week runs from when you first use it, not from Monday, so it can start over midweek. Codex records these numbers after each reply and shows them in Codex itself; Crossview reads them from Codex's records on this Mac.</p>${codexStops(per)}`;
  }

  function page(per) {
    const St = window.GBStage, html = { plan: plan(per), limit: limit(per), reach: reach(per), carry: carry(per) };
    const ans = (k) => ((html[k].match(/<p class="q-a"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const first = (k) => { const t = ans(k), m = t.match(/^.*?[.?!](\s|$)/); return (m ? m[0] : t).trim(); };
    const ch = changes(per), shown = ch.slice(0, 3), rest = ch.slice(3);
    const ids = ["limit"].concat(shown.map((c) => c.id), rest.length ? ["more"] : [], ["plan", "reach", "carry"]);
    if (appOf() !== "Codex" && !ids.includes(S.qsel)) S.qsel = (ch.find((c) => c.hot) || {}).id || "limit";
    // the lead: is the plan right, and did a limit stop you (his pick: a verdict on top, no dollar figure)
    const hs = hitsIn(per), tools = [...new Set(hs.map((h) => (h.tool === "Codex" ? "Codex" : "Claude")))];
    const planLine = !B.plans.length ? "" : /^Yes\b/.test(ans("plan")) ? (per === thisWeek ? "You're on the right plan." : "You were on the right plan.") : first("plan");
    const stopLine = !hs.length ? `No limit stopped you ${wk(per)}${soFar(per)}.` : tools.length === 1 ? `${tools[0]}'s limit stopped you ${nWord(hs.length)} ${wk(per)}${hs.length === 1 ? `, on ${weekday(hs[0].ts)} ${partOfDay(hs[0].ts)}` : ""}.` : `Limits stopped you ${nWord(hs.length)} ${wk(per)}.`;
    // the first sentence answers one question, "am I okay?", in plain words; the stop is on the chart and the thing to
    // act on is the orange row right below (screen-words, copy deck Oct 15)
    const covered = /^Yes\b/.test(ans("plan")), lead = esc(!B.plans.length ? "Crossview doesn't know which plans you pay for yet." : covered ? (per === thisWeek ? "Your plans are covering the cost of this week's work." : "Your plans covered the cost of last week's work.") : (per === thisWeek ? "Your plans cost more than this week's work would have." : "Your plans cost more than last week's work would have."));
    void planLine; void stopLine;
    const sw = !hasCodex() ? "" : `<div class="w-seg q-app" role="group" aria-label="Which app">${["Claude", "Codex"].map((a) => `<button data-w="q:app:${a}" aria-pressed="${appOf() === a}" ${tip(a === "Claude" ? "Claude Code, Cowork and the Claude app share one plan and one set of limits." : `Codex has its own plan and its own limits.${appOf() !== "Codex" && cxHits(per).length ? " The orange dot means a Codex limit stopped you " + wk(per) + "." : ""}`)}>${a}${a === "Codex" && appOf() !== "Codex" && cxHits(per).length ? '<i class="q-app-dot" aria-label="a Codex limit stopped you"></i>' : ""}</button>`).join("")}</div>`;
    const headRight = sw + `<button class="w-btn q-detail-btn" data-w="q:detail" ${tip("Opens the week in detail, with your limits, the subagents each app used and what you paid.")}>Show me the week in detail →</button>`;
    const TIP = { subs: "A subagent is a separate AI with its own instructions, which Claude Code can hand part of a job to.", spike: "A connector is a link to another app, like your browser or Google Drive. Claude's settings call them MCP servers.", new: "A connector is a link to another app, like your browser or Google Drive. Claude's settings call them MCP servers.", skills: "A skill is instructions packaged for one kind of task, which Claude loads when that task comes up.", sub: "A subagent is a separate AI with its own instructions, which Claude Code can hand part of a job to.", proj: "A project is one of your project folders. Crossview groups your chats by project." };
    const row = (id, q, a, mini, hot, kind) => `<button class="q-row${S.qsel === id ? " sel" : ""}${hot ? " hot" : ""}" data-w="q:plate:${esc(id)}" aria-pressed="${S.qsel === id}" ${kind && TIP[kind] ? tip(TIP[kind]) : ""}><i class="q-dot" aria-hidden="true"></i><span><b>${esc(q)}</b><small>${esc(a)}</small></span><span class="q-mini">${mini || ""}</span><span class="q-chev" aria-hidden="true">›</span></button>`;
    const miniOf = (c) => c.kind === "spike" ? spark(c.hist, c.hot) : c.kind === "new" ? c.ports.map((p) => `<em class="q-tag${riskWords.hot(p) ? " hot" : ""}">${esc(p.name)}</em>`).join("") : c.kind === "skills" ? c.skills.map((k) => `<i class="q-sq${k.uses > 0 ? " on" : ""}"></i>`).join("") : "";
    if (appOf() === "Codex") {
      const cch = codexChanges(per), cids = ["limit"].concat(cch.map((c) => c.id), ["plan"]);
      if (!cids.includes(S.qsel)) S.qsel = (cch.find((c) => c.hot) || {}).id || "limit";
      const cc = cch.find((x) => x.id === S.qsel), ck = cids.indexOf(S.qsel);
      const ccanvas = `<div class="q-wk">
      <div class="q-pace-b${S.qsel === "limit" ? " sel" : ""}" data-w="q:plate:limit" role="button" tabindex="0" aria-pressed="${S.qsel === "limit"}" aria-label="Codex's weekly limit"><span class="q-h">${per === thisWeek ? "How much of Codex's weekly limit you've used" : "How much of Codex's weekly limit you used"} <small>Its week runs from when you first use it, so it can start over midweek.${per === thisWeek && ((M.codex_plan || {}).latest || {}).resets ? ` This one resets ${esc(localWhen(M.codex_plan.latest.resets).replace(/^(\w+) at/, (m0, d0) => d0 + " " + new Date(M.codex_plan.latest.resets).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " at"))}.` : ""}</small></span>${codexPace(per)}</div>
      <div class="q-ch"><p class="q-h">What changed in Codex ${wk(per)} <small ${tip("Crossview compares the week with the four weeks before it: a Codex limit that stopped you, and Codex used far more than usual.")} tabindex="0" class="q-hint">compared with the four weeks before</small></p>
        ${cch.map((c) => row(c.id, c.title, c.line, "", c.hot)).join("")}<p class="q-quiet">${cch.length ? "Nothing else changed in Codex" : "Nothing changed in Codex"} ${wk(per)}. Crossview can't see which subagents or connectors Codex used yet.</p></div>
      <div class="q-plan-b${S.qsel === "plan" ? " sel" : ""}" data-w="q:plate:plan" role="button" tabindex="0" aria-pressed="${S.qsel === "plan"}" aria-label="Your plan for Codex: open Am I on the right plan?"><span class="q-h">Your plan for Codex</span>${plansBlock(per, "Codex")}</div></div>`;
      const cbody = cc ? (cc.kind === "cxstop" ? codexStops(per) : `<p>${esc(cc.line)}</p><p class="q-why">A chat is one conversation in Codex. Crossview counts them from Codex's records on this Mac.</p>`) : S.qsel === "plan" ? codexPlanPanel(per) : codexLimitPanel(per);
      const ctitle = cc ? cc.title : S.qsel === "plan" ? "Am I on the right plan for Codex?" : (per === thisWeek ? "How much of Codex's weekly limit you've used" : "How much of Codex's weekly limit you used");
      const ckey = `<span class="q-cue" aria-hidden="true">More below ↓</span><span><i class="q-k ink"></i>From Codex's records on this Mac</span><span><i class="q-k blue"></i>What you pay</span><span><i class="y-jack hot" aria-hidden="true"></i>Something you can act on</span>`;
      const cstrip = `<span>${esc(plural(cxChats(per), "Codex chat"))} ${wk(per)}, across your projects.</span>`;
      return `${empty()}${St.page({ lead, title: `Your week ${per === thisWeek ? "so far" : ""}`.trim(), headRight, hint: false, canvas: ccanvas, key: ckey, strip: cstrip, cls: "q-page q-new q-cx", panel: { k: ck, n: cids.length, act: "q:plate:", unit: "Item", title: ctitle, line: cc ? esc(cc.line) : "", body: cbody } })}${sheet(per)}`;
    }
    const canvas = `<div class="q-wk">
      <div class="q-pace-b${S.qsel === "limit" ? " sel" : ""}" data-w="q:plate:limit" role="button" tabindex="0" aria-pressed="${S.qsel === "limit"}" aria-label="Claude's weekly limit: open What used up my limit?"><span class="q-h">${per === thisWeek ? "How much of Claude's weekly limit you've used" : "How much of Claude's weekly limit you used"} <small>${hasCodex() ? "Claude Code, Cowork and the Claude app share this limit. " : ""}${per === thisWeek ? "It resets Monday morning." : `It reset on Monday, ${esc(day(per))}.`}</small></span>${pace(per, hasCodex())}</div>
      <div class="q-ch"><p class="q-h">What changed${hasCodex() ? " in Claude" : ""} ${wk(per)} <small ${tip("Crossview compares the week with the four weeks before it, by fixed rules: a connector used far more than usual or for the first time, a skill you made, a subagent far above usual, or a different project taking 40% or more of the week. The ones that can send, delete or act as you come first.")} tabindex="0" class="q-hint">compared with the four weeks before</small></p>
        ${shown.length ? shown.map((c) => row(c.id, c.title, c.line, miniOf(c), c.hot, c.kind)).join("") : `<p class="q-quiet">Nothing else changed ${wk(per)}, compared with the four weeks before.</p>`}
        ${rest.length ? row("more", `${plural(rest.length, "more change")}`, rest.map((c) => c.title).join(". ") + ".", "") : ""}</div>
      <div class="q-plan-b${S.qsel === "plan" ? " sel" : ""}" data-w="q:plate:plan" role="button" tabindex="0" aria-pressed="${S.qsel === "plan"}" aria-label="Your plans: open Am I on the right plan?"><span class="q-h">${hasCodex() ? "Your plan for Claude" : "Your plans"}</span>${plansBlock(per, hasCodex() ? "Claude" : null)}</div>
      <div class="q-ch standing"><p class="q-h">Your setup <small>as it is now, the same until you change it</small></p>${row("reach", "What can Claude reach outside my Mac?", ans("reach"), "", false)}${row("carry", "What have I set up that I never use?", ans("carry"), "", false)}</div></div>`;
    const k = ids.indexOf(S.qsel), c = ch.find((x) => x.id === S.qsel);
    const titles = { limit: per === thisWeek ? "How much of Claude's weekly limit you've used" : "How much of Claude's weekly limit you used", plan: "Am I on the right plan?", reach: "What can Claude reach outside my Mac?", carry: "What have I set up that I never use?", more: `${plural(rest.length, "more change")} ${wk(per)}` };
    const body = c ? changePanel(c, per) : S.qsel === "more" ? `<ul class="q-list">${rest.map((x) => `<li><b>${esc(x.title)}</b><br><small>${esc(x.line)}</small></li>`).join("")}</ul>` : `<div class="q-page-pick">${html[S.qsel]}</div>`;
    const key = `<span class="q-cue" aria-hidden="true">More below ↓</span><span><i class="q-k ink"></i>From your logs and the Claude app's readings</span><span><i class="q-k blue"></i>What you pay</span><span><i class="y-jack hot" aria-hidden="true"></i>Something you can act on</span>`;
    const strip = `<span ${tip("A subagent is a separate AI with its own instructions, which Claude Code can hand part of a job to.")}>${esc(agentsLine(per))}</span>`;
    return `${empty()}${St.page({ lead, title: `Your week ${per === thisWeek ? "so far" : ""}`.trim(), headRight, hint: false, canvas, key, strip, cls: "q-page q-new", panel: { k, n: ids.length, act: "q:plate:", unit: "Item", title: c ? c.title : titles[S.qsel], line: c ? esc(c.why || c.line) : "", body } })}${sheet(per)}`;
  }
  function idsFor(per) {
    if (appOf() === "Codex") return ["limit"].concat(codexChanges(per).map((c) => c.id), ["plan"]);
    const ch = changes(per); return ["limit"].concat(ch.slice(0, 3).map((c) => c.id), ch.length > 3 ? ["more"] : [], ["plan", "reach", "carry"]);
  }
  function step(dir) {
    const per = S.nper || thisWeek, ids = idsFor(per), was = S.qsel;
    S.qsel = window.GBStage.stepIn(ids, S.qsel || "limit", dir); S.qreveal = true; return S.qsel !== was;
  }

  // clicks: returns "stay" when the page should re-render without scrolling
  function click(el, per) {
    const v = el.dataset.w || "";
    if (v.startsWith("q:plate:step:")) { step(+v.slice(13)); return "stay"; }
    if (v.startsWith("q:plate:")) { S.qsel = v.slice(8); S.qreveal = true; return "stay"; }
    if (v.startsWith("q:app:")) { S.qapp = v.slice(6); S.qsel = null; S.qscroll = 0; return "stay"; }
    if (v === "q:detail") { S.nview = "detail"; S.qopen = null; S.hback = false; if (location.hash !== "#detail") history.pushState(null, "", "#detail"); return "top"; }
    // opened from All weeks (S.hback), it goes back there, to the same week
    // (the browser steps back too, so its own Back doesn't land on the same All weeks view twice)
    if (v === "q:front") { S.nview = null; if (S.hback && location.hash === "#detail") { S.allw = true; S.hback = false; S.fromHistory = true; history.back(); return "top"; } S.hback = false; if (location.hash === "#detail") history.replaceState(null, "", "#week"); return "top"; }
    if (v.startsWith("q:sheet:")) { S.qopen = v.slice(8); S.qerr = null; S.qcopied = null; S.qfocus = true; return "stay"; }
    if (v === "q:close") { const k = S.qopen; S.qopen = null; S.qerr = null; S.qback = k; return "stay"; }
    if (v.startsWith("q:pick:")) {
      const [, , q, ...rest] = v.split(":"), name = rest.join(":");
      S.qpick = S.qpick || {}; if (!S.qpick[q]) (q === "limit" ? limitSheet : reachSheet)(per);
      const set = S.qpick[q]; set.has(name) ? set.delete(name) : set.add(name);
      return "stay";
    }
    if (v.startsWith("q:plan:")) { const [, , vend, key] = v.split(":"); const pk = planPicks(); pk.claudeUsd = (document.querySelector('[data-plan-usd="claude"]') || {}).value || pk.claudeUsd; pk.chatgptUsd = (document.querySelector('[data-plan-usd="chatgpt"]') || {}).value || pk.chatgptUsd; pk[vend] = key; return "stay"; }
    if (v === "q:saveplans") {
      const pk = planPicks(), plans = [];
      for (const vend of ["claude", "chatgpt"]) {
        const c = CATALOG[vend].find((x) => x[0] === pk[vend]);
        if (!c || c[0] === "none") continue;
        const usdIn = c[0] === "other" ? Number((document.querySelector(`[data-plan-usd="${vend}"]`) || {}).value) : c[2];
        if (c[0] === "other" && !(usdIn >= 0)) { S.qerr = "Type the monthly price for your other plan."; window.dispatchEvent(new Event("gb:render")); return false; }
        plans.push({ vendor: vend, name: c[0] === "other" ? (vend === "claude" ? "Claude (other plan)" : "ChatGPT (other plan)") : c[1], monthly_usd: usdIn });
      }
      if (!LIVE) return false;
      el.disabled = true; el.textContent = "Saving…";
      fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json", "X-Glass-Box": "1" }, body: JSON.stringify({ plans }) })
        .then((r) => r.json().then((j) => { if (!r.ok) throw new Error(j.error || "it didn't work"); location.reload(); }))
        .catch((e) => { S.qerr = "Your plans weren't saved: " + e.message; el.disabled = false; window.dispatchEvent(new Event("gb:render")); });
      return false;
    }
    if (v.startsWith("q:unsnooze:")) {
      try { const o = JSON.parse(localStorage.getItem("gb:snoozedAt")) || {}; delete o["q:" + v.slice(11)]; localStorage.setItem("gb:snoozedAt", JSON.stringify(o)); } catch (e) {}
      location.reload(); return false;
    }
    if (v === "q:copy") {
      const text = el.dataset.prompt || "", k = S.qopen;
      try { navigator.clipboard.writeText(text).catch(() => window.prompt("Copy this request:", text)); } catch (e) { window.prompt("Copy this request:", text); }
      S.qcopied = k; return "stay";
    }
    if (v === "q:make" || v.startsWith("q:undo:")) {
      const s = v === "q:make" ? current(per) : null, body = v === "q:make" ? s && s.req : { id: v.slice(7) };
      if (!body || !LIVE) return false;
      el.disabled = true; el.textContent = v === "q:make" ? "Making the change…" : "Undoing…";
      fetch(v === "q:make" ? "/api/change" : "/api/undo", { method: "POST", headers: { "Content-Type": "application/json", "X-Glass-Box": "1" }, body: JSON.stringify(body) })
        .then((r) => r.json().then((j) => { if (!r.ok) throw new Error(j.error || "it didn't work"); location.reload(); }))
        .catch((e) => { S.qerr = (v === "q:make" ? "Nothing was changed: " : "It wasn't undone: ") + e.message; el.disabled = false; window.dispatchEvent(new Event("gb:render")); });
      return false;
    }
    return null;
  }
  return { page, click, step, open: () => !!S.qopen, close: () => { const k = S.qopen; S.qopen = null; S.qerr = null; S.qback = k; } };
};
