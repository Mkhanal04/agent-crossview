/* Crossview: the receipt, release 2 slice 2 (his pick, Oct 19: concept C, data/concepts/receipt-2026-10-19; notes in
   docs/concepts-2026-10-19-receipt.md). It opens from the home's cost card. One long receipt: what you paid first, then what
   the same work would cost per use (logged and estimated on separate lines), where the per-use price went, and what comes
   with the plan but isn't counted. Beside it, the paid and per-use amounts drawn to scale, and one panel that says where the
   selected line came from, how it was worked out, how sure it is and what's missing. "By work" regroups the same week by
   who did the work and by model. Plan facts come from tools/plan-facts.json (G.plan_facts), never from this file. */
window.GBReceipt = function (X) {
  "use strict";
  const { G, S, esc, money, day } = X;
  const M = G.machine || {}, B = G.money || { plans: [] }, PF = G.plan_facts || { claude: [], chatgpt: [], unpriced: {} };
  const thisWeek = G.week_start, per = () => (S.nper && S.nper !== "all" ? S.nper : thisWeek), now = () => per() === thisWeek;
  const wk = () => (now() ? "this week" : "last week");
  const daysIn = (p) => (p === thisWeek ? Math.min(7, Math.max(1, Math.round((new Date(G.today + "T12:00:00") - new Date(p + "T12:00:00")) / 864e5) + 1)) : 7);
  const usd = (v) => (v > 0 && v < 1 ? "under $1" : "$" + Math.round(v).toLocaleString());
  const plural = (n, w) => `${Number(n).toLocaleString()} ${w}${n === 1 ? "" : "s"}`;
  const tip = (t) => `data-tip="${esc(t)}"`;
  const payOf = (p) => p.pay || (p.monthly_usd == null ? "company" : "self");
  // the name a plan is sold under, from the plan facts: the same names as the home
  const factOf = (p) => window.GBStage.planFact(PF, p);
  // a part shown after rounding: "under $1" when the real amount is above zero but the rounded share is $0
  const amt = (raw, part) => (raw > 0.004 && part < 1 ? "under $1" : "$" + Number(part).toLocaleString());
  const MODEL = (m) => (X.modelName ? X.modelName(m) : m);
  // largest-remainder rounding, so the shown parts add up to the shown total (first read, Oct 19: they summed to $979)
  const parts = (vals, total) => {
    const t = Math.round(total), fl = vals.map(Math.floor), rem = t - fl.reduce((a, b) => a + b, 0);
    vals.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).slice(0, Math.max(0, rem)).forEach(([, i]) => fl[i]++);
    return fl;
  };

  function facts() {
    const p = per(), nd = daysIn(p), R = ((M.receipt || {})[p]) || { tools: {}, kinds: {}, models: {}, who: {}, unpriced: {} };
    const T = (a) => R.tools[a] || { usd: 0, est: 0, chats: 0 };
    const ps = B.plans || [], own = ps.filter((x) => payOf(x) === "self"), co = ps.some((x) => payOf(x) === "company");
    const paidRows = own.map((x) => { const f = factOf(x); return { name: window.GBStage.planName(PF, x), monthly: x.monthly_usd || 0, week: (((x.monthly_usd || 0) * 12) / 365) * nd, perks: (f && f.includes) || [] }; });
    const paid = paidRows.reduce((a, r) => a + r.week, 0);
    const cc = T("Claude Code"), cw = T("Cowork"), cx = T("Codex");
    const total = cc.usd + cw.usd + cx.usd, est = cc.est + cw.est + cx.est;
    const unpriced = Object.entries(R.unpriced || {}).map(([m, n]) => ({ m, n, f: (PF.unpriced || {})[m] || { name: m, note: "This model has no published per-use price, so Crossview can't price it." } }));
    return { p, nd, R, cc, cw, cx, total, est, paid, paidRows, own, co, unpriced };
  }

  // ---------- what each line means: the evidence panel ----------
  function evidence(f, key) {
    const built = String(G.built || "");
    const base = { last: built };
    const E = {
      paid: { h: "What you paid", sub: "Your plans' monthly prices, shared out over the days shown.", from: "The plans you chose when Crossview first opened. You can change them with the link under What you paid.", how: `A year of each plan's price, shared out by day, for the ${plural(f.nd, "day")} shown.`, sure: 3, sureT: "Exact, from the prices you gave.", miss: "Tax, discounts and anything billed outside these plans." },
      cc: { h: "Claude Code, logged", sub: "What Claude Code's work would cost at published per-use prices.", from: "Claude Code's records on this computer, one record per reply.", how: "Each reply with a published price is priced by how much text it read and wrote, at that price, with re-reading, saving and writing priced separately.", sure: 3, sureT: "Straight from the records. It's a price for the same work. You pay your plans' flat prices.", miss: "Chats on Claude's website and phone app aren't on this computer." },
      est: { h: "Subagent replies recorded in part", sub: "A subagent is a separate AI that the app hands part of a job to. Some of their records keep only part of each reply, so Crossview adds an estimate for the rest.", from: `${[f.cc.est > 0.004 ? "Claude Code" : "", f.cw.est > 0.004 ? "Cowork" : "", f.cx.est > 0.004 ? "Codex" : ""].filter(Boolean).join(" and ") || "The apps"}'s records on this computer.`, how: "From chats where Claude kept full totals, Crossview learns how much a subagent reply usually writes. It adds that amount for each partial record.", sure: 2, sureT: "It's an estimate. The other lines come straight from the records.", miss: "The exact length of those replies." },
      cx: { h: "Codex", sub: "What Codex's work would cost at published per-use prices.", from: "Codex's records on this computer.", how: "Each reply's size is priced at OpenAI's published per-use price for its model.", sure: 3, sureT: "Straight from the records.", miss: "Codex chats on other computers." },
      cw: { h: "Cowork", sub: "What Cowork's tasks would cost at published per-use prices.", from: "Cowork's records on this computer.", how: "Each reply's size is priced at the published per-use price for its model.", sure: 3, sureT: "Straight from the records.", miss: "Cowork tasks on other computers." },
      kinds: { h: "Where the per-use price went", sub: "Every reply re-reads the chat so far, so long chats add up.", from: "The same records, split by kind of use.", how: "Re-reading the saved chat is cheap for each reply, but it happens on every reply. Saving the chat to re-read, writing answers and new input are priced separately.", sure: 3, sureT: "Straight from the records.", miss: "Anthropic doesn't say how each kind counts toward your plan's limit." },
      total: { h: "If you'd paid per use", sub: "The same work at published per-use prices.", from: "All the lines above it.", how: "Logged amounts plus the estimate.", sure: 2, sureT: `Mostly from the records, plus ${f.estShown != null ? amt(f.est, f.estShown) : usd(f.est)} of estimate.`, miss: "Work on other computers and on Claude's website and phone app." },
    };
    if (key.startsWith("perk:")) { const k = f.paidRows.flatMap((r) => r.perks)[+key.slice(5)] || {}; return Object.assign(base, { h: k.what || "Included with your plan", sub: k.note || "", from: `Crossview's plan facts, checked ${k.checked || PF.checked}.`, how: "The credits aren't added to any total on this receipt.", sure: 0, sureT: "Crossview can't see the credits from your computer.", miss: `Whether you've claimed the credits. Check ${k.where_to_check || "your plan's billing page"}.`, links: k.links || [] }); }
    if (key.startsWith("unp:")) { const u = f.unpriced[+key.slice(4)] || { f: {} }; return Object.assign(base, { h: u.f.name || "Not priced", sub: u.f.note || "", from: "Codex's records on this computer.", how: "Counted, but there's no published per-use price to apply.", sure: 1, sureT: "The count is exact. The price isn't known.", miss: "Whether it counts toward your plan's limit." }); }
    if (key.startsWith("who:") || key.startsWith("model:")) return Object.assign(base, { h: key.startsWith("who:helper") ? "Subagents" : key === "who:cowork" ? "Your tasks in Cowork" : key === "who:codex" ? "Your chats in Codex" : key.startsWith("who:") ? "Your chats in Claude Code" : key === "model:others" ? "Other models" : MODEL(key.slice(6)), sub: key.startsWith("who:helper") ? "A subagent is a separate AI that the app hands part of a job to." : "", from: "The same records, grouped a different way.", how: "Each reply is priced by its size at published per-use prices. It includes the estimate for records kept only in part.", sure: 2, sureT: "Mostly from the records.", miss: "Codex's subagents aren't in its records yet." });
    return Object.assign(base, E[key] || E.total);
  }

  function board() {
    const f = facts(), view = S.rview === "work" ? "work" : "plan", sel = S.rsel || (view === "work" ? (Object.keys(f.R.who || {}).some((k) => k.startsWith("helper:") && f.R.who[k] > 0.004) ? "who:helper" : "total") : f.est > 0.004 ? "est" : "total");
    const row = (key, name, mid, amt, cls = "") => `<div class="r-rr ${cls}${sel === key ? " sel" : ""}" data-r="sel:${key}" tabindex="0" role="button"><span title="${esc(name)}">${esc(name)}</span><span>${esc(mid)}</span><b>${amt}</b></div>`;
    // what you paid
    let top = f.paidRows.map((r) => row("paid", r.name, `$${r.monthly} a month`, usd(r.week))).join("");
    if (f.own.length) top += `<div class="r-rr tot paid big" ${tip(`Your plans' monthly prices shared out over ${plural(f.nd, "day")}. It isn't a payment you made this week.`)}><span>${now() ? "This week's share so far" : "Last week's share"}</span><b>${usd(f.paid)}</b></div>`;
    if (f.co) top += `<div class="r-stamp">Paid by your company</div>`;
    if (!(B.plans || []).length) top += `<div class="r-rr"><span>Your plans</span><b>not chosen yet</b></div>`;
    // per use
    let use = "";
    if (view === "plan") {
      const ccLog = f.cc.usd - f.cc.est, cwLog = f.cw.usd - f.cw.est, cxLog = f.cx.usd - f.cx.est;
      const [a, b, c, d] = parts([ccLog, f.est, cxLog, cwLog], f.total); f.estShown = b;
      use = `<p class="r-sec">If you'd paid per use</p>`
        + row("cc", "Claude Code", plural(f.cc.chats, "chat"), amt(ccLog, a))
        + (f.est > 0.004 ? row("est", "Subagent replies recorded in part", "estimate", "+" + amt(f.est, b), "est") : "")
        + row("cx", "Codex", plural(f.cx.chats, "chat"), amt(cxLog, c))
        + f.unpriced.map((u, i) => row("unp:" + i, u.f.name, plural(u.n, "reply").replace("replys", "replies"), "no published price", "nop unp")).join("")
        + row("cw", "Cowork", f.cw.chats ? plural(f.cw.chats, "task") : "no tasks", amt(cwLog, d), f.cw.chats ? "" : "nop")
        + `<div class="r-rr tot big${sel === "total" ? " sel" : ""}" data-r="sel:total" tabindex="0" role="button"><span>Per use</span><b>≈ ${usd(f.total)}</b></div>`;
    } else {
      const W = f.R.who || {}, mainCC = W["main:Claude Code"] || 0, mainCX = W["main:Codex"] || 0, mainCW = W["main:Cowork"] || 0;
      const helpers = Object.entries(W).filter(([k]) => k.startsWith("helper:")), helpTot = helpers.reduce((s2, [, v]) => s2 + v, 0), helpApps = helpers.filter(([, v]) => v > 0.004).map(([k]) => k.slice(7));
      const [a, b, c, d] = parts([mainCC, helpTot, mainCX, mainCW], f.total);
      const ms = Object.entries(f.R.models || {}).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]), top2 = ms.slice(0, 2), others = ms.slice(2).reduce((s2, [, v]) => s2 + v, 0);
      const mv = parts(top2.map(([, v]) => v).concat(others ? [others] : []), f.total), pct = (v) => (f.total ? (v / f.total < 0.01 ? "under 1%" : Math.round((100 * v) / f.total) + "%") : "");
      use = `<p class="r-sec">Per use, by who did the work</p>`
        + (mainCC > 0.004 ? row("who:main", "Your chats in Claude Code", plural(f.cc.chats, "chat"), amt(mainCC, a)) : "")
        + (helpTot > 0.004 ? row("who:helper", helpApps.length === 1 ? `${helpApps[0]}'s subagents` : "Subagents", f.est > 0.004 ? "with the estimate" : "", amt(helpTot, b)) : "")
        + (mainCX > 0.004 ? row("who:codex", "Your chats in Codex", plural(f.cx.chats, "chat"), amt(mainCX, c)) : "")
        + (mainCW > 0.004 ? row("who:cowork", "Your tasks in Cowork", plural(f.cw.chats, "task"), amt(mainCW, d)) : "")
        + `<p class="r-sec">Per use, by model</p>`
        + top2.map(([m, v], i) => row("model:" + m, MODEL(m), pct(v), amt(v, mv[i]))).join("")
        + (others ? row("model:others", `${plural(ms.length - 2, "other model")}`, pct(others), amt(others, mv[mv.length - 1]), "dim") : "")
        + `<div class="r-rr tot big${sel === "total" ? " sel" : ""}" data-r="sel:total" tabindex="0" role="button"><span>Per use</span><b>≈ ${usd(f.total)}</b></div>`;
    }
    // where it went
    const K = f.R.kinds || {}, kt = (K.read || 0) + (K.write || 0) + (K.out || 0) + (K.fresh || 0);
    const kv = parts([K.read || 0, K.write || 0, K.out || 0, K.fresh || 0], kt), KN = [["read", "Re-reading the chat so far"], ["write", "Saving the chat to re-read"], ["out", "Writing answers"], ["fresh", "New input"]];
    const kinds = kt ? `<p class="r-sec">Where the per-use price went</p><div class="r-kbar" aria-hidden="true">${KN.map(([k], i) => `<i class="k${i + 1}" style="width:${((100 * (K[k] || 0)) / kt).toFixed(1)}%"></i>`).join("")}</div>
      <p class="r-small">Every reply re-reads the chat so far, so long chats add up.</p><div class="r-klist${sel === "kinds" ? " sel" : ""}" data-r="sel:kinds" tabindex="0" role="button">${KN.map(([, n], i) => `<i class="k${i + 1}"></i><span>${n}</span><b>${amt(K[KN[i][0]] || 0, kv[i])}</b>`).join("")}</div>` : "";
    // included with the plan, never counted
    const perks = f.paidRows.flatMap((r) => r.perks.map((k) => ({ k, plan: r.name })));
    const inc = perks.length ? `<div class="r-perf"></div>` + perks.map(({ k, plan }, i) => `<p class="r-sec">Also with ${esc(plan)}</p>${row("perk:" + i, k.what, `$${k.monthly_usd} a month`, "included", "nop")}${(k.links || []).length ? `<p class="r-links r-links-in">${k.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener" title="${esc(l.note || "")}">${esc(l.label)} ↗</a>`).join("")}</p>` : ""}`).join("") : "";
    const chg = window.GB_DEMO ? "" : `<p class="r-links r-links-in"><button class="w-link" data-w="q:sheet:plans">Change my plans</button></p>`;
    const paper = `<div class="r-wrap"><div class="r-slot" aria-hidden="true"></div><div class="r-paper"><p class="r-sec">What you paid</p>${top}${chg}<div class="r-perf"></div>${use}${kinds}${inc}</div></div>`;
    // to scale: the two amounts as squares, the estimate as a strip
    const big = 150, side = f.total > 0 && f.paid > 0 ? Math.max(6, big * Math.sqrt(f.paid / f.total)) : 0, strip = f.total ? Math.max(f.est > 0.004 ? 2 : 0, (big * f.est) / f.total) : 0;
    const scale = f.total > 0 && f.paid > 0 && f.paid < f.total ? `<div class="r-card r-scale" role="img" aria-label="${esc(`What you paid, ${usd(f.paid)}, drawn to scale against the same work per use, about ${usd(f.total)}`)}">
        <div class="r-blk"><div class="r-sq paid" style="width:${side.toFixed(1)}px;height:${side.toFixed(1)}px"></div><span class="r-lbl">What you paid</span><span class="r-amt">${usd(f.paid)}</span></div>
        <div class="r-blk"><div class="r-sq use" style="width:${big}px;height:${big}px"><div class="r-est" style="height:${strip.toFixed(1)}px"></div></div><span class="r-lbl">The same work, per use</span><span class="r-amt">≈ ${usd(f.total)}</span></div>
        <p class="r-small" style="max-width:150px">Drawn to scale.${f.est > 0.004 ? " The striped strip is the subagent estimate." : ""}</p></div>` : "";
    // the evidence panel
    const e = evidence(f, sel), dots = (n) => `<span class="r-sure" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
    const ev = `<article class="r-card r-ev" aria-live="polite"><h3>${esc(e.h)}</h3>${e.sub ? `<p class="r-sub">${esc(e.sub)}</p>` : ""}<dl>
      <dt>Where it came from</dt><dd>${esc(e.from)}</dd><dt>How it was worked out</dt><dd>${esc(e.how)}</dd>
      <dt>How sure</dt><dd>${dots(e.sure)}${esc(e.sureT)}</dd><dt>What's missing</dt><dd>${esc(e.miss)}</dd><dt>Last updated</dt><dd>${esc(e.last)}</dd></dl>${(e.links || []).length ? `<p class="r-links">${e.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener" title="${esc(l.note || "")}">${esc(l.label)} ↗</a>`).join("")}</p>` : ""}</article>`;
    const note = view === "plan" ? `<div class="r-note"><b>Why your limit can look different</b>Re-reading is cheap for each reply, but it adds up in long chats. Anthropic doesn't say how much of it counts toward your limit.</div>` : "";
    // the lead: one idea, in plain words
    const lead = !f.total ? `No work was recorded ${wk()}.` : f.own.length && f.paid < f.total ? `Your plans covered about ${usd(f.total)} of AI use for ${usd(f.paid)}.` : f.own.length ? `Your plans cost more than ${wk()}'s work would have.` : f.co ? `Your company's plans covered about ${usd(f.total)} of AI use.` : `${now() ? "This week's" : "Last week's"} work would cost about ${usd(f.total)} per use.`;
    const crumb = `<p class="r-crumb"><button class="w-link" data-r="home">Home</button> › <b>${now() ? "What did this week's work cost?" : "What did last week's work cost?"}</b></p>`;
    const sw = `<span class="r-seg" role="group" aria-label="How to group the receipt"><button data-r="view:plan" aria-pressed="${view === "plan"}">By plan</button><button data-r="view:work" aria-pressed="${view === "work"}">By work</button></span>`;
    return `<main class="r-panel">${crumb}<div class="r-label"><h1>${esc(lead)}</h1>${sw}</div><section class="r-view">${paper}<div class="r-side">${scale}${ev}${note}</div></section></main>`;
  }

  function click(el) {
    const v = el.dataset.r || "";
    if (v === "home") { S.screen = "home"; return "go"; }
    if (v.startsWith("view:")) { S.rview = v.slice(5); S.rsel = null; return "stay"; }
    if (v.startsWith("sel:")) { S.rsel = v.slice(4); return "stay"; }
    return false;
  }
  return { board, click };
};
