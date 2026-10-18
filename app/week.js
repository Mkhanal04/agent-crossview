/* Crossview: Your week. Since Oct 13 (Milan's pick) the front is four answers with his agents as a small row
   (answers.js); the week in detail sits one click behind: a thin strip for limits, the AI you talk to wired to the
   helpers it called in, and a receipt of what you paid and where your use went. Picked look: the tactile machine.
   Panel round 1 (Oct 13): the receipt keeps periods apart and adds up, plan dollars aren't split by project, connectors are
   judged by what they're allowed to do, and every card speaks about the week shown. Plain JavaScript; app.js passes in its helpers. */
window.GBWeek = function (X) {
  "use strict";
  const { G, S, esc, money, day, localDay, HITS, WARN, store, DEMO, LIVE, shares, riskOf, riskWords, since, snoozed, snoozedCount } = X;
  const M = G.machine || { periods: {}, apps: {}, plan: null, ports: [] }, B = G.money || { plans: [], sources: [] };
  const plus = (d, n) => { const t = new Date(d + "T12:00:00"); t.setDate(t.getDate() + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
  const thisWeek = G.week_start, lastWeek = plus(thisWeek, -7);
  const busy = (per) => Object.values(M.periods[per] || {}).filter((t) => t.usd >= 1).length >= 3;
  // a new copy with nothing logged last week opens on this week, not on an empty one
  if (!S.nper) S.nper = busy(thisWeek) || !Object.keys(M.periods[lastWeek] || {}).length ? thisWeek : lastWeek;
  const words = (per) => (per === thisWeek ? "this week" : "last week");
  const mon = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short" });
  const span = (w) => { const e = plus(w, 6); return mon(w) === mon(e) ? `${day(w)} to ${Number(e.slice(8))}` : `${day(w)} to ${day(e)}`; };
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const pctText = (a, b) => (b && a > 0 && pct(a, b) < 1 ? "under 1%" : pct(a, b) + "%");
  const workName = (w) => (w === "Not sure yet" ? "Not grouped yet" : w);
  const daysSince = (d) => (d ? Math.round((new Date(G.today + "T12:00:00") - new Date(d + "T12:00:00")) / 864e5) : null);
  const tip = (t) => `data-tip="${esc(t)}"`;
  const ampm = (s) => s.replace(" AM", " am").replace(" PM", " pm");
  const at = (ts) => new Date(ts + ":00Z");
  const shortWhen = (ts) => ampm(at(ts).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })).replace(/^(\w+),? /, "$1 at ");  // "Wed at 10:43 am"
  const kept = new Set(store.get("kept", []));
  const screws = '<i class="w-screw tl"></i><i class="w-screw tr"></i><i class="w-screw bl"></i><i class="w-screw br"></i>';
  const mod = (cls, title, body, note = "", hot = false) => `<section class="w-mod ${cls}">${screws}<header class="w-mh"><h3><i class="w-led${hot ? "" : " idle"}"></i>${esc(title)}</h3>${note}</header>${body}</section>`;
  const agentOf = (type) => G.agents.find((a) => a.name === type);
  const builtIn = (type) => { const a = agentOf(type); return a ? a.origin === "Came with Claude Code" : true; };
  const helperShare = (t) => pct(Object.entries(t.agents || {}).filter(([k]) => k.startsWith("helper:")).reduce((a, [, v]) => a + v.usd, 0), t.usd);
  const plural = (n, w) => `${typeof n === "number" ? n.toLocaleString() : n} ${w}${n === 1 ? "" : "s"}`;
  // how much of a week has happened: the current week is only part-way through
  const daysIn = (per) => (per === thisWeek ? Math.min(7, Math.max(1, daysSince(per) + 1)) : 7);
  const MONTHLY = B.plans.reduce((a, p) => a + (p.monthly_usd || 0), 0), PER_DAY = (MONTHLY * 12) / 365;
  let wires = [];

  // ---------- the strip: limits, and the week line ----------
  function gauge(v, label, sub) {
    const r = 15, c = 2 * Math.PI * r, arc = 0.75, f = Math.max(0, Math.min(100, v || 0)) / 100;
    const th = ((135 + 270 * f) * Math.PI) / 180, nx = 20 + 10 * Math.cos(th), ny = 20 + 10 * Math.sin(th);
    return `<div class="w-gauge${v >= 100 ? " full" : v >= 80 ? " hot" : ""}" role="img" aria-label="${esc(`${label} limit: ${v == null ? "no reading" : v + "%"}, ${sub}`)}" ${tip(/^Codex/.test(label) ? `${label} limit used, ${sub}. Codex has its own 5-hour and weekly limits. This reading comes from Codex's records on this Mac.` : `${label} limit used, ${sub}. Your limits are the 5-hour and weekly caps on your plan. This reading comes from the Claude app's own record on this Mac, which doesn't keep reset times. Claude Code and Cowork share these limits.`)}>
      <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><g transform="rotate(135 20 20)"><circle cx="20" cy="20" r="${r}" class="w-g-track" stroke-dasharray="${(c * arc).toFixed(1)} ${c.toFixed(1)}"/><circle cx="20" cy="20" r="${r}" class="w-g-fill" stroke-dasharray="${(c * arc * f).toFixed(1)} ${c.toFixed(1)}"/></g><line x1="20" y1="20" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" class="w-g-needle"/><circle cx="20" cy="20" r="2.6" class="w-g-hub"/></svg>
      <div><b>${esc(label)}${v == null ? "" : " " + v + "%"}</b><small>${esc(sub)}</small></div></div>`;
  }
  function strip(per) {
    // the dials and the stops follow Your week's app switch (release 1, Oct 16): Codex reads from its own records
    const cx = S.qapp === "Codex" && M.codex_plan && M.codex_plan.latest, who0 = cx ? "Codex" : "Claude";
    const P = cx ? M.codex_plan : M.plan; let fh = null, sd = null, sub = G.system && G.system !== "mac" ? "no reading here" : "no reading on this Mac";
    if (P && per === thisWeek && P.latest) { fh = P.latest.fh; sd = P.latest.sd; sub = "as of " + ampm(new Date(P.latest.at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })); }
    else if (!cx && P && P.week_peaks[per]) { fh = P.week_peaks[per].fh; sd = P.week_peaks[per].sd; sub = "highest that week"; }
    else if (cx) { const R = (M.codex_plan.readings || []).filter((r) => r[0].slice(0, 10) >= per && r[0].slice(0, 10) <= plus(per, 6)); if (R.length) { sd = Math.max(...R.map((r) => r[1] || 0)); fh = Math.max(...R.map((r) => r[2] || 0)); sub = "highest that week"; } }
    if (fh != null) fh = Math.round(fh); if (sd != null) sd = Math.round(sd);
    const inWeek = (e) => { const d = localDay(e.ts); return d >= per && d <= plus(per, 6); }, mine = (e) => (e.tool === "Codex") === !!cx;
    const hasCx = Object.values(M.apps || {}).some((a) => a && a.Codex);
    const hits = HITS.filter((e) => inWeek(e) && (!hasCx || mine(e))), warns = WARN.filter((e) => inWeek(e) && (!hasCx || mine(e)));
    const limitName = (h) => `${h.tool === "Codex" ? "Codex's" : "Claude's"} ${h.kind === "seven_day" ? "weekly" : h.kind === "five_hour" ? "5-hour" : ""} limit`.replace("  ", " ");
    const summary = [];
    const days = [0, 1, 2, 3, 4, 5, 6].map((i) => plus(per, i)).map((d) => {
      const h = hits.filter((x) => localDay(x.ts) === d), w = warns.filter((x) => localDay(x.ts) === d), future = d > G.today;
      const lab = new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
      const t = future ? `${lab} hasn't come yet.` : h.length ? `On ${lab}, ${[...new Set(h.map(limitName))].join(" and ")} stopped you ${h.length === 1 ? "once" : h.length === 2 ? "twice" : h.length + " times"}.` : w.length ? `On ${lab}, you came close to a ${hasCx ? who0 + " " : ""}limit but weren't stopped.` : `On ${lab}, no ${hasCx ? who0 + " " : ""}limit stopped you.`;
      if (h.length || w.length) summary.push(t);
      return `<span class="w-day${h.length ? " hit" : w.length ? " warn" : ""}${d === G.today ? " today" : ""}${future ? " future" : ""}" ${tip(t)}><small>${lab}</small><i></i></span>`;
    }).join('<b class="w-dash" aria-hidden="true"></b>');
    const last = hits[hits.length - 1];
    let text = `No ${hasCx ? who0 + " " : ""}limit stopped you ${words(per)}${per === thisWeek ? " so far" : ""}.`;
    if (last) {
      const r = (last.running || [])[0], t = r ? (M.periods[per] || {})[r.work] : null;
      const who = r && /^Codex chats with no project$/.test(r.work) ? "A Codex chat with no project was running" : r ? `<button class="w-link" data-nwork="${esc(r.work)}" ${tip(`Opens ${workName(r.work)} on Your work.${t && helperShare(t) > 50 ? " Its subagents were doing most of the work." : ""}`)}>${esc(workName(r.work))}</button> was running` : "The records on this Mac don't show anything running at the time";
      text = hits.length > 1 ? `${hasCx ? who0 + "'s limits" : "A limit"} stopped you ${hits.length === 2 ? "twice" : hits.length + " times"} ${words(per)}, the last on <b class="w-when" tabindex="0" ${tip(`That was ${limitName(last)}.`)}>${esc(shortWhen(last.ts))}</b>. ${who}.` : `On <b class="w-when">${esc(shortWhen(last.ts))}</b>, ${esc(limitName(last))} stopped you. ${who}.`;
    }
    return `<section class="w-mod w-strip" aria-label="Your limits">${screws}${gauge(fh, who0 + " 5-hour", sub)}<span class="w-sep" aria-hidden="true"></span>${gauge(sd, who0 + " weekly", sub)}
      <div class="w-weekline"><div class="w-days" role="img" aria-label="${esc(`The days of ${words(per)}. ${summary.length ? summary.join(" ") : "No limit stopped you."}`)}">${days}</div><p class="w-stoptext">${text}</p></div></section>`;
  }

  // ---------- your agents: the AI you talk to, wired to the helpers it called in ----------
  function agents(per, decs) {
    const P = M.periods[per] || {}, apps = (M.apps || {})[per] || {}, H = {};
    Object.entries(P).forEach(([w, t]) => Object.entries(t.agents || {}).forEach(([k, a]) => {
      if (!k.startsWith("helper:")) return;
      const parts = k.split(":"), app = parts[1], type = parts.slice(2).join(":");
      const h = (H[type] = H[type] || { type, runs: 0, usd: 0, apps: {}, works: {} });
      h.runs += a.runs; h.usd += a.usd; h.apps[app] = (h.apps[app] || 0) + a.usd; h.works[w] = (h.works[w] || 0) + a.usd;
    }));
    const ranked = Object.values(H).sort((a, b) => b.usd - a.usd), list = ranked.slice(0, ranked.length > 7 ? 6 : 7), rest = ranked.slice(list.length);
    const badge = {};
    decs.forEach((d, i) => { if (d.agent) badge[d.agent] = i + 1; });
    Object.keys(badge).forEach((name) => { if (!list.find((h) => h.type === name)) list.push({ type: name, runs: 0, usd: 0, apps: { "Claude Code": 0 }, works: {}, idle: true }); });
    // open slots show helpers that didn't run this week, dimmed and unwired, so your agents are always on the board
    // and it keeps the same shape every week: your own first, then built-in ones, most recently run first
    if (!rest.length) G.agents.filter((a) => !list.find((h) => h.type === a.name) && !ranked.find((h) => h.type === a.name))
      .sort((a, b) => (a.origin === "Came with Claude Code" ? 1 : 0) - (b.origin === "Came with Claude Code" ? 1 : 0) || String(b.last || "").localeCompare(String(a.last || "")))
      .slice(0, Math.max(0, 7 - list.length)).forEach((a) => list.push({ type: a.name, runs: 0, usd: 0, apps: {}, works: {}, idle: true, filler: true }));
    const maxU = Math.max(0.01, ...list.map((h) => h.usd)), allHelper = ranked.reduce((a, h) => a + h.usd, 0), allUse = Object.values(P).reduce((a, t) => a + t.usd, 0);
    // each helper's share of the week, rounded so the helpers add up to the total in the header
    const helperPct = pct(allHelper, allUse), each = shares(ranked.map((h) => h.usd), helperPct), shareOf = {};
    ranked.forEach((h, i) => (shareOf[h.type] = each[i]));
    wires = [];
    list.forEach((h) => Object.entries(h.apps).forEach(([app, usd]) => wires.push({ app, type: h.type, w: h.idle ? 1.2 : 1.6 + 7 * Math.sqrt(usd / maxU), idle: !!h.idle })));
    const wired = new Set(wires.map((w) => w.app)), appsUsed = [...new Set(ranked.flatMap((h) => Object.keys(h.apps)))];
    const appBox = (app) => {
      const a = apps[app] || {}, quiet = app === "Cowork" && per > G.cowork_end;
      const sub = quiet ? `nothing recorded on this Mac after ${day(G.cowork_end)}` : a.sessions ? plural(a.sessions, "chat") : "no chats";
      return `<button class="w-app${a.sessions ? " on" : ""}${wired.has(app) ? "" : " bare"}" data-wapp="${esc(app)}" data-w="setup:app:${esc(app)}" ${tip(`${quiet ? `${app} has nothing recorded on this Mac after ${day(G.cowork_end)}` : `${app} had ${sub} ${words(per)}`}. Click to see how it's built.`)}><i class="w-light"></i><span><b>${esc(app)}</b><small>${esc(sub)}</small></span><i class="w-port" aria-hidden="true"></i></button>`;
    };
    const helperBox = (h) => {
      const a = agentOf(h.type), top = Object.entries(h.works).sort((x, y) => y[1] - x[1])[0];
      const idleDays = a && a.last ? daysSince(a.last) : null;
      const sub = h.idle ? (a && a.runs ? (h.filler ? `last ran ${day(a.last)}` : `no runs in ${idleDays} days`) : "never run") : `${plural(h.runs, "run")} ${words(per)}`;
      const from = Object.keys(h.apps).filter((x) => h.apps[x] > 0);
      const t = h.idle ? (a && a.runs ? (h.filler ? `${h.type} didn't run ${words(per)}. It last ran on ${day(a.last)}.` : `${h.type} hasn't run in ${idleDays} days.`) : `${h.type} hasn't run since Claude Code's records start on ${since("Claude Code")}.`) : `${h.type} ran ${h.runs === 1 ? "once" : h.runs === 2 ? "twice" : plural(h.runs, "time")} ${words(per)}${from.length ? ` from ${from.join(" and ")}` : ""}. That's ${shareOf[h.type] < 1 ? "under 1%" : shareOf[h.type] + "%"} of the week's use${top ? `, most of it for ${workName(top[0])}` : ""}. A thicker wire means it used more.`;
      return `<button class="w-helper${h.idle ? " idle" : " on"}${a && !a.runs ? " never" : ""}" data-whelper="${esc(h.type)}" data-w="setup:helper:${esc(h.type)}" ${tip(t)}><i class="w-port" aria-hidden="true"></i><i class="w-light"></i><span><b>${esc(h.type)}${badge[h.type] ? `<em class="w-badge" aria-label="decision ${badge[h.type]}">${badge[h.type]}</em>` : ""}</b><small>${esc(sub)}</small></span></button>`;
    };
    const runs = ranked.reduce((a, h) => a + h.runs, 0), restRuns = rest.reduce((a, h) => a + h.runs, 0);
    const note = `<span class="w-mh-note" ${tip("Claude Code can hand part of a job to a subagent, a separate AI with its own instructions. This is the share of the week's pay-per-use price that went through subagents. The rest went through the chat you typed in. Each subagent's share is in its own hover, and they add up to this.")}>${plural(ranked.length, "subagent")} ran ${plural(runs, "time")}${appsUsed.length ? ` in ${appsUsed.join(" and ")}` : ""} · ${helperPct < 1 && allHelper > 0 ? "under 1%" : helperPct + "%"} of the week's use</span>`;
    const moreBox = rest.length ? `<button class="w-helper more" data-w="setup:helpers" ${tip(`${rest.map((h) => h.type).join(", ")}. Click to see them all in Your setup.`)}><span><b>+ ${plural(rest.length, "more subagent")}</b><small>${plural(restRuns, "run")} · see them all</small></span></button>` : "";
    const body = `<div class="w-board"><svg class="w-wires" aria-hidden="true"></svg>
        <div class="w-apps">${["Claude Code", "Cowork", "Codex"].map(appBox).join("")}</div>
        <div class="w-helpers">${list.length ? list.map(helperBox).join("") + moreBox : `<p class="w-empty">No subagents ran ${words(per)}.</p>`}</div></div>
      <footer class="w-legend"><span><i class="w-light on"></i>Ran ${words(per)}</span><span><i class="w-light"></i>Didn't run</span><span><i class="w-wire-key"></i>A thicker wire means more use</span></footer>`;
    return mod("w-agents", `Your apps and subagents ${words(per)}`, body, note);
  }

  // ---------- what you paid: the receipt, and where your use went ----------
  // The flow shows shares of your use only. A flat plan isn't charged by project, so it isn't split into dollars (panel round 1).
  function flow(per, works, use) {
    const top = works.slice(0, 4), rest = works.slice(4).reduce((a, [, t]) => a + t.usd, 0);
    // a long name wraps onto two lines of up to 20 letters, cut after that; the full name is in the band's hover
    const cut = (t) => { const w = String(t).split(" "), L = [""]; w.forEach((x) => { if ((L[L.length - 1] + " " + x).trim().length > 20 && L[L.length - 1]) L.push(x); else L[L.length - 1] = (L[L.length - 1] + " " + x).trim(); }); return L.length > 2 ? [L[0], (L[1].length > 18 ? L[1].slice(0, 17) : L[1]) + "…"] : L; };
    const right = top.map(([w, t]) => ({ key: w, label: cut(workName(w)), full: workName(w), usd: t.usd })).concat(rest > 0 ? [{ key: null, label: "Everything else", usd: rest }] : []);
    if (!right.length) return `<svg class="w-sankey" viewBox="0 0 500 208" role="img" aria-label="No work recorded"><text x="250" y="102" text-anchor="middle" class="w-sk-l">No work recorded ${words(per)}</text></svg>`;
    const own = top.map(([, t]) => t.share), p = own.every((x) => x != null) ? own.concat(rest > 0 ? [100 - own.reduce((a, b) => a + b, 0)] : []) : shares(right.map((n) => n.usd));
    right.forEach((n, i) => (n.p = p[i]));
    const W = 500, Hh = 176, x0 = 104, x1 = 228, nw = 5, gap = 6, scale = (Hh - gap * Math.max(right.length - 1, 1)) / use;
    const left = { label: "Your use", y: 4, h: Math.max(3, use * scale), cur: 4 };
    let ry = 4; right.forEach((n) => { n.h = Math.max(3, n.usd * scale); n.y = ry; n.cur = ry; ry += n.h + gap; });
    const tones = ["var(--amt-4)", "var(--amt-3)", "var(--amt-2)", "var(--amt-1)", "var(--mod-3)"];  // amounts are greys, largest darkest
    const band = (a0, a1, b0, b1, col, lab) => { const m = (x0 + nw + x1) / 2; return `<path d="M${x0 + nw},${a0.toFixed(1)} C${m},${a0.toFixed(1)} ${m},${b0.toFixed(1)} ${x1},${b0.toFixed(1)} L${x1},${b1.toFixed(1)} C${m},${b1.toFixed(1)} ${m},${a1.toFixed(1)} ${x0 + nw},${a1.toFixed(1)} Z" fill="${col}" class="w-band" ${tip(lab)}/>`; };
    let bands = "";
    right.forEach((n, i) => {
      const h = n.usd * scale;
      bands += band(left.cur, left.cur + h, n.cur, n.cur + h, tones[Math.min(i, tones.length - 1)], `${n.full || n.label} took ${n.p < 1 ? "under 1%" : n.p + "%"} of your use ${words(per)}, measured by pay-per-use price. You aren't charged for it separately.`);
      left.cur += h; n.cur += h;
    });
    let lastY = -99; right.forEach((n) => { const lines = Array.isArray(n.label) ? n.label.length : 1; n.ty = Math.max(n.y + Math.max(3, n.h) / 2 + 4 - (lines - 1) * 7, lastY + 16); lastY = n.ty + (lines - 1) * 14; });
    // room for a two-line name at the bottom, the same height every week so nothing moves between weeks (QA run 5, finding 6)
    const VH = Math.max(244, Math.ceil(lastY + 10));
    const nodes = `<rect x="${x0}" y="${left.y.toFixed(1)}" width="${nw}" height="${left.h.toFixed(1)}" rx="2" class="w-node"/><text x="${x0 - 10}" y="${(left.y + left.h / 2 + 4).toFixed(1)}" text-anchor="end" class="w-sk-l">${left.label}</text>`
      + right.map((n, i) => { const cy = n.y + Math.max(3, n.h) / 2, moved = n.ty - 4 - cy > 3;
        return `<rect x="${x1}" y="${n.y.toFixed(1)}" width="${nw}" height="${Math.max(3, n.h).toFixed(1)}" rx="2" class="w-node"/>${moved ? `<path d="M${x1 + nw + 1},${cy.toFixed(1)} L${x1 + 12},${(n.ty - 4).toFixed(1)}" class="w-sk-lead"/>` : ""}${n.key ? `<a data-nwork="${esc(n.key)}" class="w-sk-a" tabindex="0" role="link">` : "<g>"}<text x="${x1 + 14}" y="${n.ty.toFixed(1)}" class="w-sk-r${i === 0 ? " top" : ""}">${(Array.isArray(n.label) ? n.label : [n.label]).map((l, j, a) => `<tspan x="${x1 + 14}" dy="${j ? 14 : 0}">${esc(l)}${j === a.length - 1 ? ` <tspan class="w-sk-p">${n.p < 1 ? "under 1%" : n.p + "%"}</tspan>` : ""}</tspan>`).join("")}</text>${n.key ? "</a>" : "</g>"}`; }).join("");
    return `<svg class="w-sankey" viewBox="0 0 ${W} ${VH}" role="img" aria-label="${esc(`Your use ${words(per)}, by project: ${right.map((n) => `${n.full || n.label} ${n.p < 1 ? "under 1%" : n.p + "%"}`).join(", ")}`)}">${bands}${nodes}</svg>`;
  }
  // a monthly amount you typed in, spread over the days of this week that fall in that month (only the days so far)
  function weekShare(e, per) {
    const [y, m] = e.month.split("-").map(Number), dim = new Date(y, m, 0).getDate();
    let n = 0;
    for (let i = 0; i < daysIn(per); i++) if (plus(per, i).slice(0, 7) === e.month) n++;
    return { usd: (e.usd * n) / dim, days: n, dim };
  }
  function paid(per) {
    const nd = daysIn(per), soFar = nd < 7, plansNow = PER_DAY * nd, end = plus(per, nd - 1);
    const billed = B.sources.map((s) => ({ v: s.vendor, usd: Object.entries(s.by_day || {}).filter(([d]) => d >= per && d <= end).reduce((a, [, u]) => a + u, 0) })).filter((s) => s.usd > 0);
    const P = M.periods[per] || {}, works = Object.entries(P).filter(([, t]) => t.usd > 0).sort((a, b) => b[1].usd - a[1].usd), use = works.reduce((a, [, t]) => a + t.usd, 0) || 1;
    // a plan your company pays for, or paying per use, has no monthly price: the receipt says who pays instead (Oct 17)
    const own = B.plans.filter((p) => p.monthly_usd != null && (p.pay || "self") === "self"), others = B.plans.filter((p) => !own.includes(p));
    const planLine = own.map((p) => `${esc(p.name)} $${p.monthly_usd} a month`).join(", ");
    const otherLine = others.map((p) => `${esc(p.name)} is ${(p.pay || "company") === "api" ? "paid per use, with an API key" : "paid by your company"}`).join(". ");
    const oc = otherCosts(per, P, billed); ocHtml = oc.html;
    const extra = billed.reduce((a, s) => a + s.usd, 0) + oc.entered, allIn = plansNow + extra;
    const fresh = !S.wPrinted; S.wPrinted = true;
    const period = soFar ? `${words(per)} so far` : words(per);
    const howCounted = `Each reply ${words(per)} is priced at its model's published per-use rate, checked ${G.prices_checked}. Small background calls that the records don't keep are left out, so the total may run a little low.`;
    const body = `<div class="w-printer"><div class="w-slot" aria-hidden="true"></div><div class="w-receipt${fresh ? " print" : ""}">
        <div class="w-r-head"><span>Receipt</span><span>${esc(span(per))}</span></div>
        ${own.length || !others.length ? `<p class="w-r-line"><b>Your plans, about $${Math.round(plansNow)} ${esc(period)}</b><small>A daily share of ${planLine}${soFar ? `, for ${plural(nd, "day")}` : ""}</small></p>` : ""}${others.length ? `<p class="w-r-line"><b>${own.length ? "Your other plans" : "Your plans"}</b><small>${otherLine}.</small></p>` : ""}
        <div class="w-r-line w-r-peruse"><small>Pay-per-use price ${esc(period)}</small><b class="w-r-big">${money(use)} <em>an estimate</em></b>
          <small class="w-r-note">What the same work would cost without a plan, at published per-use rates checked ${esc(G.prices_checked)}. It may run a little low. ${DEMO ? `<span class="w-link" tabindex="0" ${tip(howCounted)}>How this is counted</span>` : `<button class="w-link" data-go="screen:mission" ${tip(howCounted)}>How this is counted</button>`}</small></div>
        ${!own.length && others.length && !extra ? "" : `<p class="w-r-line w-r-allin"><b>About $${Math.round(allIn)} in all ${esc(period)}</b><small>Plans $${Math.round(plansNow)}${extra > 0 ? ` + other costs about $${extra.toFixed(2)}` : ""}${oc.unknown ? ` · ${plural(oc.unknown, "paid service")} not entered yet` : ""}</small></p>`}
        <div class="w-r-split"><span>Your use, by project</span><em>shares of the pay-per-use price</em></div>
        ${flow(per, works, use)}
        <button class="w-btn w-r-dl" data-w="week:csv" ${tip(`Downloads ${words(per)}'s numbers as a spreadsheet file, with a note on what each column means. The file is made on this Mac and isn't sent anywhere.`)}>Download ${words(per)} as a spreadsheet</button>
        <div class="w-r-tear" aria-hidden="true"></div></div></div>`;
    return mod("w-paid", "What you paid", body, "");
  }

  // ---------- costs outside your plans: paid services your projects call with their own keys ----------
  const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");
  const monthName = (m) => new Date(m + "-15T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  function services() {
    const OC = G.other_costs || { services: [] }, by = {};
    OC.services.forEach((x) => { const v = (by[x.service] = by[x.service] || { service: x.service, where: x.where_to_look, projects: [] }); if (!v.projects.includes(x.project)) v.projects.push(x.project); });
    return Object.values(by);
  }
  function otherCosts(per, P, billed) {
    const OC = G.other_costs || { services: [], shell_keys: [] }, live = LIVE, month = plus(per, daysIn(per) - 1).slice(0, 7);
    const busyIn = (proj) => Object.keys(P).some((w) => { const a = norm(w), b = norm(proj); return a && b && (a.includes(b) || b.includes(a)); });
    const list = services().map((v) => Object.assign(v, { busy: v.projects.filter(busyIn) })).sort((a, b) => b.busy.length - a.busy.length || a.service.localeCompare(b.service));
    const entry = (svc) => (B.manual || []).find((e) => e.service === svc && e.month === month);
    ocNeeds = list.some((v) => v.busy.length && !entry(v.service));
    let entered = 0, unknown = 0;
    if (!list.length && !billed.length) return { html: `<p class="w-r-line"><b>No other costs found outside your plans</b><small>Crossview found no paid AI services in your project folders.</small></p>`, entered, unknown };
    const row = (v) => {
      const e = entry(v.service), names = v.projects.map((p) => (v.busy.includes(p) ? `${p} (worked on ${words(per)})` : p)), sh = e ? weekShare(e, per) : null;
      if (sh) entered += sh.usd; else unknown++;
      const prompt = `Please check my ${v.service} costs for ${monthName(month)} (projects: ${v.projects.join(", ")}). Use my signed-in Chrome and look at ${v.where}. Then add the amount to Crossview${DEMO ? "" : " (Ventures/Agent-Glass-Box, data/bills-manual.json)"} and tell me what you found.`;
      return `<div class="w-oc${v.busy.length && !e ? " busy" : ""}"><div class="w-oc-top"><b>${esc(v.service)}</b><span class="w-oc-amt">${sh ? `about $${sh.usd.toFixed(2)} <small>${plural(sh.days, "day")} of ${esc(monthName(month).split(" ")[0])}'s $${e.usd.toFixed(2)}, entered by you</small>` : "amount unknown"}</span></div>
        <details class="w-oc-act"><summary><small class="w-oc-where">${esc(names.slice(0, 3).join(" · "))}${names.length > 3 ? ` and ${names.length - 3} more` : ""}</small><span>${e ? "Change the amount" : "Add the amount"}</span></summary>
          <div class="w-pop">
          ${live ? `<div class="w-oc-form"><label>Amount for all of ${esc(monthName(month))} <span>$<input type="number" min="0" step="0.01" inputmode="decimal" data-oc-usd="${esc(v.service)}" value="${e ? e.usd : ""}"></span></label><button class="w-btn" data-w="cost:save:${esc(v.service)}:${month}">Save</button></div>` : (DEMO ? `<p>This is the demo company, so typing an amount is turned off.</p>` : `<p>To type an amount, start Crossview by double-clicking “Agent Crossview.command” in its folder.</p>`)}
          <p>You'll find it in ${esc(v.where)}.</p>
          <p><b>You can also ask Claude to look it up.</b> This copies a request to paste into Claude Code. If you paste it, Claude opens that billing page in your signed-in Chrome and asks before each step. Nothing happens until you paste it.<br><button class="w-link" data-w="cost:copy:${esc(v.service)}" data-prompt="${esc(prompt)}">${S.ocCopied === v.service ? "Copied. Paste it into Claude Code" : "Copy the request"}</button></p>
          </div></details></div>`;
    };
    const shell = (OC.shell_keys || []).length ? `<p class="w-oc-warn"><span ${tip(`The setting is named ${OC.shell_keys.join(" and ")}.`)}>Claude Code on this Mac is set to sign in with a key for Claude's API</span>, so its chats are billed separately at pay-per-use prices instead of coming out of your plan.</p>` : "";
    const html = `<div class="w-r-line w-ocs"><b>Other costs outside your plans</b><small>Crossview found signs that your projects call ${plural(list.length, "paid service")} with their own keys. It can't see these bills, so any monthly amount you enter is spread over the days.</small>
      ${billed.map((x) => `<div class="w-oc"><div class="w-oc-top"><b>${esc(x.v)}</b><span class="w-oc-amt">$${x.usd.toFixed(2)} <small>${words(per)}, from your bill file</small></span></div></div>`).join("")}
      ${list.map(row).join("")}${shell}
      <small class="w-oc-note">Crossview looks for key names and code libraries in your project folders and never reads the keys themselves. Apps hosted somewhere like Vercel keep their keys there, and services you reach through a connector bill separately, so some costs may not show up here.</small></div>`;
    return { html, entered, unknown };
  }
  let ocNeeds = false, ocHtml = "";
  // the costs outside your plans get their own card under the apps, so the two columns balance (QA run 5, finding 2)
  const others = () => ocHtml ? mod("w-others", "Costs outside your plans", `<div class="w-others-b">${ocHtml.replace("<b>Other costs outside your plans</b>", "")}</div>`) : "";

  // ---------- this week as a spreadsheet file, with what each column means ----------
  function csv(per) {
    const P = M.periods[per] || {}, works = Object.entries(P).filter(([, t]) => t.usd > 0).sort((a, b) => b[1].usd - a[1].usd), use = works.reduce((a, [, t]) => a + t.usd, 0);
    const p = shares(works.map(([, t]) => t.usd)), q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [
      `# Crossview, ${words(per)} (${span(per)}), made ${G.built}${DEMO ? ", demo company with made-up data" : ""}`,
      "# share_of_use_pct: this project's share of the week's pay-per-use price (whole numbers that add up to 100)",
      `# pay_per_use_usd: what its replies would cost at published pay-per-token rates (checked ${G.prices_checked}); an estimate, not a bill; may run a little low`,
      "# chats, helper_runs, days: counted from the logs on this Mac",
      ["week_start", "project", "share_of_use_pct", "pay_per_use_usd", "chats", "helper_runs", "days"].join(","),
    ].concat(works.map(([w, t], i) => [per, q(workName(w)), p[i], t.usd.toFixed(2), t.sessions, Object.entries(t.agents || {}).filter(([k]) => k.startsWith("helper:")).reduce((a, [, x]) => a + x.runs, 0), (t.day_list || []).length || t.days].join(",")));
    lines.push(["", q("All projects"), use ? 100 : 0, use.toFixed(2), "", "", ""].join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n") + "\n"], { type: "text/csv" }));
    a.download = `crossview-week-${per}.csv`; document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- the page: the four answers, or the week in detail behind them ----------
  const QA = window.GBAnswers ? window.GBAnswers(Object.assign({}, X, { words, span, plus, daysIn, PER_DAY, thisWeek, helperShare, workName, tip, screws, plural, pct, agentOf, builtIn, ampm, at, shortWhen, daysSince })) : null;
  // All weeks, the third choice on the week switch (release 2): Your week's long view (history.js)
  const HI = window.GBHistory && Object.keys(G.weekly || {}).length ? window.GBHistory(Object.assign({}, X, { plus, thisWeek, lastWeek, span, plural, tip, workName })) : null;
  function board() {
    const per = S.nper;
    if (S.allw && HI && S.nview !== "detail") return HI.page();
    if (QA && S.nview !== "detail") return QA.page(per);
    return `<div class="w-page">${QA ? `<nav class="q-back"><button class="w-link" data-w="q:front">← Your week</button><span>The week in detail, with your limits, your subagents and what you paid</span></nav>` : ""}${strip(per)}${((pd) => `<div class="w-row"><div class="w-col">${agents(per, [])}${others()}</div><div class="w-col">${pd}<div class="w-doors"><button class="w-door" data-go="screen:machine">${screws}<i class="w-door-ic" aria-hidden="true"></i><span><b>Show me one project</b><small>Who worked on it and what it cost</small></span><span class="w-arrow" aria-hidden="true">→</span></button>
      <button class="w-door" data-go="screen:armory">${screws}<i class="w-door-ic" aria-hidden="true"></i><span><b>Show me how my setup is built</b><small>Every part of Claude Code, Cowork and Codex, layer by layer</small></span><span class="w-arrow" aria-hidden="true">→</span></button></div></div></div>`)(paid(per))}</div>`;
  }
  function barRight(showAll) {
    const all = !!(showAll && S.allw && HI), pers = [[thisWeek, "This week"], [lastWeek, "Last week"]].concat(showAll && HI ? [["all", "All weeks"]] : []);
    return `<div class="w-seg" role="group" aria-label="Week">${pers.map(([k, l]) => `<button data-nper="${k}" aria-pressed="${k === "all" ? all : !all && S.nper === k}">${l}</button>`).join("")}</div><span class="w-asof" data-tip="${esc(`${all ? "Every week Crossview has, " + HI.range() : span(S.nper)}. Read from the logs on this Mac at ${String(G.built).replace(/^\w+ \d+, /, "").toLowerCase()}.`)}"><i class="w-led idle"></i><span>${esc(all ? HI.range() : span(S.nper))}</span></span>`;
  }

  // wires are drawn after the page is on screen, from where each box actually landed; a sheet that just opened gets the focus
  function after() {
    const cv = document.querySelector(".q-new .g-canvas"), stg = cv && cv.closest(".g-stage");
    if (cv) {
      cv.scrollTop = S.qscroll || 0;
      const pick = cv.querySelector(".q-row.sel, .q-pace-b.sel, .q-plan-b.sel");
      if (pick && S.qreveal) { const r = pick.getBoundingClientRect(), c = cv.getBoundingClientRect(); if (r.bottom > c.bottom) cv.scrollTop += r.bottom - c.bottom + 8; else if (r.top < c.top) cv.scrollTop -= c.top - r.top + 8; }
      S.qreveal = false;
      const mark = () => { S.qscroll = cv.scrollTop; stg.classList.toggle("q-more-below", cv.scrollHeight - cv.clientHeight - cv.scrollTop > 6); };
      mark(); cv.onscroll = mark;
    }
    if (S.qfocus) { const h = document.querySelector(".q-sheet h3"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); } S.qfocus = false; }
    if (S.qback) { const b = document.querySelector(`[data-w="q:sheet:${CSS.escape(S.qback)}"]`) || document.querySelector(`[data-q-card] .w-btn`); if (b) b.focus({ preventScroll: true }); S.qback = null; }
    const board = document.querySelector(".w-board"), svg = board && board.querySelector(".w-wires");
    if (!svg) return;
    const R = board.getBoundingClientRect(), out = [], count = {}, idx = {};
    svg.setAttribute("viewBox", `0 0 ${R.width.toFixed(0)} ${R.height.toFixed(0)}`);
    wires.forEach((w) => (count[w.app] = (count[w.app] || 0) + 1));
    wires.forEach((w) => {
      const a = board.querySelector(`[data-wapp="${CSS.escape(w.app)}"]`), h = board.querySelector(`[data-whelper="${CSS.escape(w.type)}"]`);
      if (!a || !h) return;
      const ra = a.getBoundingClientRect(), rh = h.getBoundingClientRect(), i = (idx[w.app] = (idx[w.app] || 0) + 1);
      const x0 = ra.right - R.left - 4, y0 = ra.top - R.top + ra.height / 2 + (i - (count[w.app] + 1) / 2) * Math.min(7, ra.height / (count[w.app] + 2));
      const x1 = rh.left - R.left + 4, y1 = rh.top - R.top + rh.height / 2, m = (x0 + x1) / 2;
      const d = `M${x0.toFixed(1)},${y0.toFixed(1)} C${m.toFixed(1)},${y0.toFixed(1)} ${m.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
      out.push(`<path d="${d}" class="w-wire${w.idle ? " idle" : ""}" stroke-width="${w.w.toFixed(1)}"/>${w.idle ? "" : `<path d="${d}" class="w-flow" stroke-width="${Math.max(1, w.w * 0.45).toFixed(1)}"/>`}`);
    });
    svg.innerHTML = out.join("");
  }
  let raf = 0;
  window.addEventListener("resize", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(after); });

  // Tab stays inside an open sheet
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Tab" || !S.qopen) return;
    const box = document.querySelector(".q-sheet"); if (!box) return;
    const f = [...box.querySelectorAll("button:not([disabled]),input,[tabindex='-1']")]; if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (ev.shiftKey && i <= 0) { ev.preventDefault(); f[f.length - 1].focus(); } else if (!ev.shiftKey && i === f.length - 1) { ev.preventDefault(); f[0].focus(); }
  });

  // clicks on this page, and the ones that leave it for Your setup
  function click(el) {
    const v = el.dataset.w || "";
    if (HI && v.startsWith("h:")) { const r = HI.click(el); return r === "stay" ? "stay" : r === "top" ? true : false; }
    if (QA && v.startsWith("q:")) { const r = QA.click(el, S.nper); return r === "stay" ? "stay" : r === "top" ? true : false; }
    if (v === "setup:never") { S.screen = "armory"; S.atool = "Claude Code"; S.alayer = "skills"; S.asel = null; S.afilter = "never"; return true; }
    if (v === "week:csv") { csv(S.nper); return false; }
    if (v.startsWith("cost:copy:")) {
      const text = el.dataset.prompt || "", done = () => { S.ocCopied = v.slice(10); };
      try { navigator.clipboard.writeText(text).then(done, () => { window.prompt("Copy this request:", text); }); } catch (e) { window.prompt("Copy this request:", text); }
      done(); return true;
    }
    if (v.startsWith("cost:save:")) {
      const parts = v.slice(10).split(":"), month = parts.pop(), svc = parts.join(":"), inp = document.querySelector(`[data-oc-usd="${CSS.escape(svc)}"]`);
      const usd = inp && inp.value !== "" ? Number(inp.value) : null;
      fetch("/api/bill", { method: "POST", headers: { "Content-Type": "application/json", "X-Glass-Box": "1" }, body: JSON.stringify({ service: svc, month, usd }) })
        .then((r) => r.json().then((j) => { if (!r.ok) throw new Error(j.error || "failed"); location.reload(); }))
        .catch((e) => window.alert("Couldn't save it: " + e.message));
      return false;
    }
    if (v === "setup:helpers") { S.screen = "armory"; S.atool = "Claude Code"; S.alayer = "helpers"; S.asel = null; }
    else if (v.startsWith("setup:port:")) { S.screen = "armory"; S.atool = "Claude Code"; S.alayer = "connectors"; S.asel = v.slice(11); }
    else if (v.startsWith("setup:layer:")) { S.screen = "armory"; S.atool = "Claude Code"; S.alayer = v.slice(12); S.asel = null; }
    else if (v.startsWith("setup:app:")) { S.screen = "armory"; S.atool = v.slice(10); S.alayer = "ai"; S.asel = null; }
    else if (v.startsWith("setup:helper:")) { S.screen = "armory"; S.alayer = "helpers"; S.asel = v.slice(13); S.atool = "Claude Code"; }
    else return false;
        return true;
  }
  return { board, kept, after, click, barRight, step: (d) => (S.allw && HI && S.nview !== "detail" ? HI.step(d) : QA && S.nview !== "detail" && QA.step ? QA.step(d) : false), closeSheet: () => (S.allw && HI && S.nview !== "detail" ? HI.close() : QA && QA.open() ? (QA.close(), true) : false) };
};
