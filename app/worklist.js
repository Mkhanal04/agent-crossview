/* Crossview: the work list, release 2 slice 4 (his pick, Oct 19: concept A, data/concepts/work-2026-10-19; notes in
   docs/concepts-2026-10-19-work.md). One list for the week: projects biggest first, each with the days it ran, its share of
   the week and its per-use price; under each project its chats, and under each chat the subagents it called. Picking a chat
   fills a panel with what drove its price. Codex's "Approve for me" reviews sit in their own row, counted but not priced.
   Data: G.machine.chats[week] (tools/machine_data.py); titles come from the app's own list, already under display names. */
window.GBWorkList = function (X) {
  "use strict";
  const { G, S, esc, day } = X;
  const M = G.machine || {}, PF = G.plan_facts || { unpriced: {} };
  const thisWeek = G.week_start, per = () => (S.nper && S.nper !== "all" ? S.nper : thisWeek), now = () => per() === thisWeek;
  const usd = (v) => (v > 0 && v < 1 ? "under $1" : "$" + Math.round(v).toLocaleString());
  const plural = (n, w) => `${Number(n).toLocaleString()} ${w}${n === 1 ? "" : "s"}`;
  const MODEL = (m) => (X.modelName ? X.modelName(m) : m);
  const workName = (w) => (w === "Not sure yet" ? "Not in a project yet" : w);
  // titles and privacy from the app's own project list (display names already applied)
  const TITLE = {}, PRIVATE = new Set();
  (G.work || []).forEach((w) => { if (w.hidden_titles) PRIVATE.add(w.name); ((w.detail || {}).sessions || []).forEach((s) => { TITLE[s.id] = s.title; }); });
  // untitled chats of one app on one day are numbered, so fifteen of them don't share one name (design pass, Oct 19, night)
  const untitledNo = (c) => { const d0 = (c.days || [])[0], same = (((M.chats || {})[per()]) || []).filter((x) => !TITLE[x.id] && x.tool === c.tool && (x.days || [])[0] === d0); return same.length > 1 ? ` ${same.findIndex((x) => x.id === c.id) + 1}` : ""; };
  const titleOf = (c) => (PRIVATE.has(c.work) ? "A chat in this project" : TITLE[c.id] || (`Untitled ${c.tool === "Cowork" ? "Cowork task" : (APP[c.tool] || c.tool) + " chat"}${untitledNo(c)}, ${day((c.days || [])[0] || per())}`));
  const APP = { "Claude Code": "Claude Code", Codex: "Codex", Cowork: "Cowork" };
  const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
  const dayIx = (d) => Math.round((new Date(d + "T12:00:00") - new Date(per() + "T12:00:00")) / 864e5);
  const squares = (days) => { const on = new Set((days || []).map(dayIx)); return `<span class="wl-days" aria-label="${esc(`Ran on ${plural(on.size, "day")}`)}">${DAYS.map((d, i) => `<i class="${on.has(i) ? "on" : ""}" title="${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][i]}"></i>`).join("")}</span>`; };
  const span = (days) => { if (!days || !days.length) return ""; const N = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], a = N[dayIx(days[0])], b = N[dayIx(days[days.length - 1])]; return a === b ? a : `${a} to ${b}`; };

  function facts() {
    const all = ((M.chats || {})[per()]) || [];
    const chats = all.filter((c) => c.priced), unpriced = all.filter((c) => !c.priced);
    const total = chats.reduce((a, c) => a + c.usd, 0);
    const P = {};
    chats.forEach((c) => { const p = (P[c.work] = P[c.work] || { name: c.work, usd: 0, chats: [], days: new Set() }); p.usd += c.usd; p.chats.push(c); c.days.forEach((d) => p.days.add(d)); });
    const order = S.wlsort === "new" ? (a, b) => (b.chats.map((c) => c.days[c.days.length - 1]).sort().pop() || "").localeCompare(a.chats.map((c) => c.days[c.days.length - 1]).sort().pop() || "") : (a, b) => b.usd - a.usd;
    const projects = Object.values(P).sort(order);
    projects.forEach((p) => p.chats.sort(S.wlsort === "new" ? (a, b) => (b.days[b.days.length - 1] || "").localeCompare(a.days[a.days.length - 1] || "") : (a, b) => b.usd - a.usd));
    // the week's busiest subagent, for the one note under the panel
    const H = {};
    chats.forEach((c) => c.helpers.forEach((h) => { const x = (H[h.type] = H[h.type] || { type: h.type, runs: 0, usd: 0, chats: 0 }); x.runs += h.runs; x.usd += h.usd; x.chats += 1; }));
    const busiest = Object.values(H).sort((a, b) => b.usd - a.usd)[0] || null;
    return { chats, unpriced, total, projects, busiest };
  }
  const share = (v, t) => (!t ? "" : v / t < 0.01 ? "under 1%" : Math.round((100 * v) / t) + "%");
  // largest-remainder rounding, the receipt's way, so the projects' amounts add up to the week's total
  const parts = (vals, total) => { const t = Math.round(total), fl = vals.map(Math.floor), rem = t - fl.reduce((a, b) => a + b, 0); vals.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).slice(0, Math.max(0, rem)).forEach(([, i]) => fl[i]++); return fl; };
  const amt = (raw, part) => (raw > 0.004 && part < 1 ? "under $1" : "$" + Number(part).toLocaleString());

  // two subagents can share a name (one for every project, one for a single project); the records keep only the name, so
  // the panel says so in one sentence (release 3, Gemini's turn 23)
  const same = (c) => { const n = c.helpers.map((h) => h.type).filter((t) => (G.agents || []).filter((a) => a.name === t).length > 1); return n.length ? `${n.length === 1 ? `Two of your subagents are named ${n[0]}` : `More than one of your subagents share the names ${n.join(" and ")}`}, and the records keep only the name, so these runs could belong to either.` : ""; };
  function panel(f, c) {
    if (!c) return `<article class="wl-card wl-ev"><h3>Pick a chat</h3><p class="wl-sub">Pick any chat in the list to see what drove its price.</p></article>`;
    const sub = c.usd - c.main_usd, subRec = Math.max(0, sub - c.est), top = c.helpers[0];
    const find = !c.usd ? "This chat has no per-use price yet." : top && top.usd / c.usd > 0.5 ? "Almost all of this chat's price came from one subagent." : sub / c.usd > 0.5 ? "Most of this chat's price came from its subagents." : "Most of this chat's price came from Claude's own replies, not its subagents.";
    const pct = (v) => (c.usd ? ((100 * v) / c.usd).toFixed(1) : 0);
    const others = c.helpers.slice(1), oRuns = others.reduce((a, h) => a + h.runs, 0), oUsd = others.reduce((a, h) => a + h.usd, 0);
    const subTxt = !c.helpers.length ? "None" : `${top.type} was called ${plural(top.runs, "time")} for ${usd(top.usd)}.${others.length ? ` ${others.length === 1 ? others[0].type : plural(others.length, "other subagent")} ${others.length === 1 ? "was" : "were"} called ${plural(oRuns, "time")} for ${usd(oUsd)}.` : ""}`;
    return `<article class="wl-card wl-ev" aria-live="polite"><h3>${esc(titleOf(c))}</h3><p class="wl-sub">${esc(find)}</p>
      <div class="wl-big">${usd(c.usd)}<small> if paid per use, ${esc(span(c.days))}</small></div>
      <div class="wl-split" aria-hidden="true"><b class="s-main" style="width:${pct(c.main_usd)}%"></b><b class="s-sub" style="width:${pct(subRec)}%"></b><b class="s-est" style="width:${pct(c.est)}%"></b></div>
      <div class="wl-legend"><span><i class="s-main"></i>The chat itself</span>${c.helpers.length ? `<span><i class="s-sub"></i>Subagents, recorded</span>` : ""}${c.est > 0.004 ? `<span><i class="s-est"></i>Subagents, estimated</span>` : ""}</div>
      <dl><dt>Subagents</dt><dd>${esc(subTxt)}</dd><dt>Model</dt><dd>${esc(MODEL(c.model || ""))}</dd>
      <dt>The chat itself</dt><dd>${c.tool === "Codex" ? "Codex" : "Claude"} replied ${plural(c.replies, "time")}</dd>${c.est > 0.004 ? `<dt>Estimated</dt><dd>Crossview estimated ${usd(c.est)} of the subagents' price, because their records keep only part of each reply.</dd>` : ""}
      <dt>App</dt><dd>${esc(APP[c.tool] || c.tool)}</dd>${same(c) ? `<dt>Same name</dt><dd>${esc(same(c))}</dd>` : ""}</dl></article>`;
  }

  function board() {
    const f = facts(), sel = f.chats.find((c) => c.id === S.wlsel) || f.chats[0] || null;
    const open = S.wlopen || (S.wlopen = new Set(f.projects.length ? [f.projects[0].name] : []));
    const top = f.projects[0];
    const lead = !f.chats.length ? `No work was recorded ${now() ? "this week" : "last week"}.` : top && top.usd / (f.total || 1) >= 0.6 ? `Most of ${now() ? "this week" : "last week"} went into one project.` : `${now() ? "This week's" : "Last week's"} work was spread across ${plural(f.projects.filter((p) => !/^Not sure yet$|with no project$|^Untitled$/.test(p.name)).length || f.projects.length, "project")}.`;
    let rows = "";
    const pr = parts(f.projects.map((p) => p.usd), f.total);
    f.projects.forEach((p, pi) => {
      const isOpen = open.has(p.name), more = (S.wlmore || {})[p.name];
      rows += `<button class="wl-proj" data-wl="proj:${esc(p.name)}" aria-expanded="${isOpen}"><span class="nm"><span class="car" aria-hidden="true">${isOpen ? "▾" : "▸"}</span>${esc(workName(p.name))} <small>${plural(p.chats.length, "chat")}</small></span>${squares([...p.days].sort())}<span class="num">${share(p.usd, f.total)}</span><span class="num">${amt(p.usd, pr[pi])}</span></button>`;
      if (!isOpen) return;
      const shown = more ? p.chats : p.chats.slice(0, 5);
      shown.forEach((c) => {
        rows += `<button class="wl-chat${sel && sel.id === c.id ? " sel" : ""}" data-wl="chat:${esc(c.id)}"><span class="t"><span class="app">${esc(APP[c.tool] || c.tool)}</span><span class="ttl" data-clip title="${esc(titleOf(c))}">${esc(titleOf(c))}</span></span>${squares(c.days)}<span class="num dim">${share(c.usd, f.total)}</span><span class="num">${usd(c.usd)}</span></button>`;
        const hs = c.helpers.slice(0, 2), rest = c.helpers.slice(2);
        hs.forEach((h) => { rows += `<div class="wl-sub-r"><span class="t">${esc(h.type)} <small>called ${plural(h.runs, "time")}</small></span><span></span><span></span><span class="num">${usd(h.usd)}</span></div>`; });
        if (rest.length) rows += `<div class="wl-sub-r"><span class="t">${plural(rest.length, "more subagent")} <small>called ${plural(rest.reduce((a, h) => a + h.runs, 0), "time")}</small></span><span></span><span></span><span class="num">${usd(rest.reduce((a, h) => a + h.usd, 0))}</span></div>`;
      });
      if (p.chats.length > 5) rows += `<button class="wl-more" data-wl="more:${esc(p.name)}">${more ? "Show fewer" : `Show ${plural(p.chats.length - 5, "more chat")} in ${esc(workName(p.name))}`}</button>`;
    });
    // counted, never priced
    const byModel = {};
    f.unpriced.forEach((c) => { const k = c.model || "unpriced", x = (byModel[k] = byModel[k] || { n: 0, days: new Set() }); x.n += c.replies || 1; c.days.forEach((d) => x.days.add(d)); });
    Object.entries(byModel).forEach(([m, x]) => { rows += `<div class="wl-proj quiet"><span class="nm"><span class="car"></span>${esc(((PF.unpriced || {})[m] || {}).name || m)} <small>${plural(x.n, "reply").replace("replys", "replies")}</small></span>${squares([...x.days].sort())}<span class="num"></span><span class="num dim">no published price</span></div>`; });
    const hasSub = f.chats.some((c) => c.helpers.length);
    const list = `<div class="wl-list"><div class="wl-hd"><span>Project, chat or subagent</span><span class="wl-days hdr" aria-hidden="true">${DAYS.map((d) => `<i>${d}</i>`).join("")}</span><span>Share of the cost</span><span>If paid per use</span></div>${rows || `<p class="wl-quiet">No chats ${now() ? "this week so far" : "last week"}.</p>`}${hasSub ? `<p class="wl-def">A subagent is a separate AI that the app hands part of a job to. The indented rows are the subagents each chat called.</p>` : ""}</div>`;
    const b = f.busiest, note = b && b.usd >= 1 ? `<div class="wl-note"><b>${esc(b.type)} cost the most of any subagent ${now() ? "this week" : "last week"}</b>It was called ${plural(b.runs, "time")}, about ${usd(b.usd)} if paid per use, across ${plural(b.chats, "chat")}.<button class="wl-fix" data-wl="fix">Show me the change to a smaller model</button><small>How well it works on a smaller model hasn't been tested. Undo puts it back.</small></div>` : "";
    const crumb = "";  // Work is a top tab, so it needs no way back (QA, Oct 19, night)
    const sw = `<span class="wl-seg" role="group" aria-label="Order"><button data-wl="sort:big" aria-pressed="${S.wlsort !== "new"}">Biggest first</button><button data-wl="sort:new" aria-pressed="${S.wlsort === "new"}">Newest first</button></span>`;
    return `<main class="wl-panel">${crumb}<div class="wl-label"><h1>${esc(lead)}</h1>${sw}</div><section class="wl-view">${list}<div class="wl-side">${panel(f, sel)}${note}</div></section></main>`;
  }

  function click(el) {
    const v = el.dataset.wl || "";
    if (v === "home") { S.screen = "home"; return "go"; }
    if (v.startsWith("sort:")) { S.wlsort = v.slice(5); return "stay"; }
    if (v.startsWith("proj:")) { const k = v.slice(5), o = S.wlopen || (S.wlopen = new Set()); o.has(k) ? o.delete(k) : o.add(k); return "stay"; }
    if (v.startsWith("more:")) { const k = v.slice(5); S.wlmore = S.wlmore || {}; S.wlmore[k] = !S.wlmore[k]; return "stay"; }
    if (v.startsWith("chat:")) { S.wlsel = v.slice(5); return "stay"; }
    if (v === "fix") { S.qapp = "Claude"; S.qopen = "limit"; S.qfocus = true; return "stay"; }  // the change opens over Work (his call, Oct 19, night)
    return false;
  }
  return { board, click };
};
