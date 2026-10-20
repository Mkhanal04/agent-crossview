/* Crossview: the home, release 1 of the redesign (his pick, Oct 18: the Faceplate; plan in
   docs/plan-2026-10-18-release1-faceplate.md). One machine panel. On the first open it shows the scan happening, module by
   module, and asks who pays for each plan; after that it's the home: one sentence answering "am I okay?", then three modules,
   each leading with its question and one bold answer: limits (a dial), cost (a receipt that starts with what you paid) and
   setup (the layered stack). Under them, up to three things worth a look, and a drawer to this week's work. Every module
   opens the full picture behind it, which is unchanged in this release. Plain JavaScript; app.js passes in its helpers. */
window.GBHome = function (X) {
  "use strict";
  const { G, S, esc, money, day, localDay, HITS, DEMO, LIVE, riskWords, note, anat } = X;
  const perUse = (v) => (v > 0 && v < 1 ? "under $1" : "$" + Math.round(v).toLocaleString());  // the receipt's rounding (QA, Oct 19: the home rounded to $10)
  const M = G.machine || { periods: {}, apps: {}, ports: [] }, B = G.money || { plans: [] };
  const plus = (d, n) => { const t = new Date(d + "T12:00:00"); t.setDate(t.getDate() + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
  const thisWeek = G.week_start, per = () => (S.nper && S.nper !== "all" ? S.nper : thisWeek);
  const now = () => per() === thisWeek;
  const wk = () => (now() ? "this week" : "last week");
  const daysIn = (p) => (p === thisWeek ? Math.min(7, Math.max(1, Math.round((new Date(G.today + "T12:00:00") - new Date(p + "T12:00:00")) / 864e5) + 1)) : 7);
  const tip = (t) => `data-tip="${esc(t)}"`;
  const plural = (n, w) => `${Number(n).toLocaleString()} ${w}${n === 1 ? "" : "s"}`;
  const list = (a) => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
  const screws = '<i class="h-screw tl"></i><i class="h-screw tr"></i>';
  const usd = (v) => (v < 1 ? "under $1" : v < 10 ? "$" + v.toFixed(0) : "$" + Math.round(v).toLocaleString());
  const weekday = (ts) => new Date(ts + ":00Z").toLocaleDateString("en-US", { weekday: "long" });
  const AN = G.anatomy || {};
  const hasApp = (a) => !!(((AN[a] || {}).folder || {}).session_logs) || !!(((M.apps || {}).all || {})[a] || {}).sessions;

  // ---------- plans: who pays (the same reading as the plan card on Your week) ----------
  const payOf = (p) => p.pay || (p.monthly_usd == null ? "company" : "self");
  const forCodex = (p) => (p.covers || []).includes("Codex");
  const claudePlan = () => (B.plans || []).find((p) => !forCodex(p));
  const codexPlan = () => (B.plans || []).find(forCodex);
  const workPlan = (p) => !!p && (payOf(p) === "company" || /\b(Team|Enterprise|Business|through work)\b/.test(p.name));

  // ---------- the week's facts ----------
  function facts() {
    const p = per(), nd = daysIn(p), apps = (M.apps || {})[p] || {};
    // chats count only priced replies, the same as the receipt, so Codex's "Approve for me" reviews aren't chats (release 2)
    const RC = (M.receipt || {})[p] || null, use = (a) => (RC && RC.tools[a] ? RC.tools[a].usd : (apps[a] || {}).usd || 0), chats = (a) => (RC && RC.tools[a] ? RC.tools[a].chats : (apps[a] || {}).sessions || 0);
    const inWeek = (h) => { const d = localDay(h.ts); return d >= p && d <= plus(p, 6); };
    const stops = HITS.filter(inWeek), cStops = stops.filter((h) => h.tool !== "Codex"), xStops = stops.filter((h) => h.tool === "Codex");
    const P = M.plan || {}, WR = P.weekly_reset || {}, rs = now() ? [WR.last, WR.next].find((x) => x && x.slice(0, 10) >= p && x.slice(0, 10) <= plus(p, 6)) : null;
    // a reading taken before this week's reset still counts last week's use (first read, Oct 19), so it isn't this week's
    const R = (P.readings || []).filter(([t, sd]) => sd != null && t.slice(0, 10) >= p && t.slice(0, 10) <= plus(p, 6) && (!rs || t >= rs));
    const sd = now() ? (R.length ? R[R.length - 1][1] : null) : (P.week_peaks && P.week_peaks[p] ? P.week_peaks[p].sd : null);
    const wp = P.weekly_pace, ahead = now() && wp && wp.at >= p && (!rs || wp.at >= rs) ? wp : null;
    const CX = M.codex_plan || {}, CR = (CX.readings || []).filter(([t, v]) => v != null && t.slice(0, 10) >= p && t.slice(0, 10) <= plus(p, 6));
    const cxSd = CR.length ? (now() ? CR[CR.length - 1][1] : Math.max(...CR.map((r) => r[1]))) : null, cxAt = CR.length ? CR[CR.length - 1][0] : null;
    const own = (B.plans || []).filter((x) => payOf(x) === "self"), paid = own.reduce((a, x) => a + ((x.monthly_usd || 0) * 12) / 365, 0) * nd;
    const ownApps = [...new Set(own.flatMap((x) => x.covers || []))];
    const ownUse = ownApps.reduce((a, x) => a + use(x), 0), total = use("Claude Code") + use("Cowork") + use("Codex");
    return { p, nd, use, chats, total, paid, ownUse, own, stops, cStops, xStops, sd, ahead, cxSd, cxAt, R, rs };
  }

  // ---------- the lead: one sentence answering "am I okay?" (screen-words; plan in the release 1 doc) ----------
  function lead(f) {
    const cp = claudePlan();
    if (f.cStops.length) return `Claude's ${f.cStops[0].kind === "five_hour" ? "5-hour" : "weekly"} limit stopped you on ${weekday(f.cStops[f.cStops.length - 1].ts)}.`;
    if (f.xStops.length) return `Codex's limit stopped you on ${weekday(f.xStops[f.xStops.length - 1].ts)}.`;
    if (f.ahead && f.ahead.runs_out) return `At this pace, Claude's weekly limit runs out ${new Date(f.ahead.runs_out).toLocaleDateString("en-US", { weekday: "long" })}.`;
    if (f.total < 1) return `No AI work was recorded ${wk()}${now() ? " so far" : ""}.`;
    if (!(B.plans || []).length) return "Crossview doesn't know which plans you have yet.";
    if (cp && payOf(cp) === "company") return now() ? "Your company pays for your plan, so this week costs you nothing." : "Your company paid for your plan, so last week cost you nothing.";
    if (cp && payOf(cp) === "api") return now() ? "You pay per use, so this week's bill grows with the work." : "You paid per use, so last week's bill grew with the work.";
    // a limit nearly used up matters more than the price comparison
    if (f.sd != null && f.sd >= 80) return now() ? "You've used most of Claude's weekly limit this week." : "You used most of Claude's weekly limit last week.";
    if (f.ownUse < f.paid) return `You paid ${usd(f.paid)} for work that would have cost ${f.ownUse < 1 ? "under $1" : "about " + usd(f.ownUse)} per use.`;
    // with no limit reading, the sentence says only what Crossview knows: the price side (his test, Oct 19)
    if (f.sd == null) return now() ? `So far this week, your AI work would cost about ${usd(f.total)} if paid per use.` : `Last week, your AI work would have cost about ${usd(f.total)} if paid per use.`;
    return now() ? "This week's work fits easily in your plans." : "Last week's work fit easily in your plans.";
  }

  // ---------- module 1: limits, a dial (or the week against your usual week, when a plan records no readings) ----------
  const A0 = 135, SWEEP = 270, CXC = 130, CYC = 122;
  const pt = (v, r) => { const a = ((A0 + (SWEEP * Math.max(0, Math.min(100, v))) / 100) * Math.PI) / 180; return [CXC + r * Math.cos(a), CYC + r * Math.sin(a)]; };
  const arc = (v0, v1, r) => { const [x0, y0] = pt(v0, r), [x1, y1] = pt(v1, r); return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${(SWEEP * (v1 - v0)) / 100 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  function dial(f) {
    const v = f.sd, ghost = f.ahead ? Math.min(100, f.ahead.at_reset) : null;
    let g = `<circle cx="${CXC}" cy="${CYC}" r="108" class="h-dial-rim"/><circle cx="${CXC}" cy="${CYC}" r="100" class="h-dial-face"/>`;
    g += `<path d="${arc(0, 100, 88)}" class="h-dial-track"/><path d="${arc(80, 100, 88)}" class="h-dial-hot"/>`;
    for (let t = 0; t <= 100; t += 10) { const [a, b] = pt(t, 81), [c, d] = pt(t, 76); g += `<line x1="${a.toFixed(1)}" y1="${b.toFixed(1)}" x2="${c.toFixed(1)}" y2="${d.toFixed(1)}" class="h-tick"/>`; }
    if (v != null) {
      g += `<path d="${arc(0, Math.max(0.5, v), 88)}" class="h-dial-fill${v >= 80 ? " hot" : ""}"/>`;
      if (ghost != null && ghost > v) {
        const [gx, gy] = pt(ghost, 80), [lx, ly] = pt(ghost, 112), t = `≈ ${Math.round(ghost)}% at reset`, w = t.length * 7.2;
        // the label stays inside the drawing on either side of the dial
        const x = lx > CXC ? Math.min(lx, 258 - w) : Math.max(lx - w, 2), y = Math.max(12, ly);
        // near the end of the dial the label would sit under Codex's small dial: it moves under "used, weekly" instead (QA, Oct 20)
        const sub = f.cxSd != null, under = sub && y > 160 && x + w > 172;
        g += `<line x1="${CXC}" y1="${CYC}" x2="${gx.toFixed(1)}" y2="${gy.toFixed(1)}" class="h-ghost"/>` + (under ? `<text x="118" y="${CYC + 79}" text-anchor="middle" class="h-etch">${t}</text>` : `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="h-etch">${t}</text>`);
      }
      const [nx, ny] = pt(v, 76); g += `<line x1="${CXC}" y1="${CYC}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" class="h-needle"/>`;
    }
    g += `<circle cx="${CXC}" cy="${CYC}" r="9" class="h-hub"/><circle cx="${CXC}" cy="${CYC}" r="3" fill="#fff"/>`;
    if (v != null) g += `<text x="${CXC}" y="${CYC + 46}" text-anchor="middle" class="h-dial-big">${Math.round(v)}%</text><text x="${CXC}" y="${CYC + 63}" text-anchor="middle" class="h-etch">${now() ? "used, weekly" : "at its highest"}</text>`;
    if (f.cxSd != null || hasApp("Codex")) {
      const cv = f.cxSd == null ? null : f.cxSd, sx = 200, sy = 200;
      if (cv != null) g += `<circle cx="${sx}" cy="${sy}" r="24" class="h-sub"/>`;  // no reading, no empty dial: it read as a blank button (his note, Oct 20)
      if (cv != null) { const a = ((A0 + (SWEEP * cv) / 100) * Math.PI) / 180; g += `<line x1="${sx}" y1="${sy}" x2="${(sx + 15 * Math.cos(a)).toFixed(1)}" y2="${(sy + 15 * Math.sin(a)).toFixed(1)}" class="h-needle sm"/><circle cx="${sx}" cy="${sy}" r="3" class="h-hub"/>`; }
      g += `<text x="${sx}" y="${sy + 38}" text-anchor="middle" class="h-etch">${cv == null ? "Codex: no reading" : `Codex weekly ${Math.round(cv)}%`}</text>`;
    }
    return `<svg viewBox="0 0 260 244" class="h-dial" role="img" aria-label="${esc(v == null ? "No readings of Claude's weekly limit" : `Claude's weekly limit ${Math.round(v)}% used${ghost != null ? `, heading for about ${Math.round(ghost)}% at reset` : ""}`)}">${g}</svg>`;
  }
  // a plan with no readings: this week's use, day by day and added up, against the usual week (the four weeks before)
  function paceStrip(f) {
    const D = M.daily || {}, p = f.p, cum = (start) => { let t = 0; return [0, 1, 2, 3, 4, 5, 6].map((i) => (t += ((D[plus(start, i)] || {}).Claude || 0))); };
    const prior = [1, 2, 3, 4].map((i) => plus(p, -7 * i)).filter((w) => D[w] || D[plus(w, 3)] || D[plus(w, 6)]), usual = prior.length ? [0, 1, 2, 3, 4, 5, 6].map((i) => prior.reduce((a, w) => a + cum(w)[i], 0) / prior.length) : null;
    const mine = cum(p).slice(0, f.nd), top = Math.max(1, ...(usual || [0]), ...mine), x = (i) => 30 + i * 40, y = (v) => 150 - (v / top) * 120;
    let g = `<rect x="10" y="14" width="280" height="160" rx="10" class="h-strip"/>`;
    if (usual) g += `<path d="M${x(0)} 150 ${usual.map((v, i) => `L${x(i)} ${y(v).toFixed(1)}`).join(" ")} L${x(6)} 150 Z" class="h-usual"/>`;
    g += `<path d="${mine.map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v).toFixed(1)}`).join(" ")}" class="h-mine"/>`;
    if (mine.length) g += `<circle cx="${x(mine.length - 1)}" cy="${y(mine[mine.length - 1]).toFixed(1)}" r="5" class="h-hub"/>`;
    ["M", "T", "W", "T", "F", "S", "S"].forEach((d, i) => (g += `<text x="${x(i)}" y="168" text-anchor="middle" class="h-etch">${d}</text>`));
    const vs = usual && mine.length ? mine[mine.length - 1] / Math.max(1, usual[mine.length - 1]) : null;
    return { svg: `<svg viewBox="0 0 300 184" class="h-dial strip" role="img" aria-label="This week's use against your usual week">${g}</svg>`, vs };
  }
  function limits(f) {
    const cp = claudePlan(), noRead = f.sd == null && !(M.plan || {}).readings?.length;
    const face = noRead && cp && (workPlan(cp) || payOf(cp) === "api") ? "pace" : "dial";
    let big, line, body, note = "";
    if (face === "pace") {
      const s = paceStrip(f);
      body = s.svg;
      const usage = s.vs == null ? "" : s.vs >= 1.25 ? "busier than a usual week" : s.vs <= 0.75 ? "quieter than a usual week" : "about a usual week";
      big = f.cStops.length ? `Stopped ${f.cStops.length === 1 ? "on " + weekday(f.cStops[f.cStops.length - 1].ts) : f.cStops.length + " times"}` : "No stop";
      line = (usage ? `${now() ? "This week is" : "Last week was"} ${usage}. ` : "") + (payOf(cp) === "api" ? "Paying per use has no weekly limit." : "Crossview can't see your company plan's limit; your admin can.") + (f.cxSd != null ? ` Codex's weekly limit: ${Math.round(f.cxSd)}% used.` : "");
      note = `Grey is a usual week. The line is ${wk()}.`;
    } else {
      body = dial(f);
      big = f.cStops.length ? `Stopped ${f.cStops.length === 1 ? "on " + weekday(f.cStops[f.cStops.length - 1].ts) : f.cStops.length + " times"}` : f.sd == null ? "No Claude reading yet" : `${Math.round(f.sd)}% used`;
      line = f.cStops.length ? `Claude's limit stopped you ${f.cStops.length === 1 ? "once" : plural(f.cStops.length, "time")} ${wk()}${f.sd != null ? `, and ${Math.round(f.sd)}% of the weekly limit is used` : ""}.` : f.ahead && f.ahead.runs_out ? `At this pace it runs out before it resets.` : f.ahead ? `At this pace it resets Monday morning with about ${100 - Math.round(f.ahead.at_reset) >= 40 && 100 - Math.round(f.ahead.at_reset) <= 60 ? "half" : 100 - Math.round(f.ahead.at_reset) + "%"} left.` : f.sd == null ? (now() && f.rs ? "Crossview has no reading of Claude's weekly limit since the limit reset. To get a new reading, open the Claude app on your Mac." : "Crossview found no readings of Claude's weekly limit for these days.") : (f.xStops.length ? `Claude's limit didn't stop you ${wk()}.` : `No limit stopped you ${wk()}.`);
      if (!f.cStops.length && f.xStops.length) line += ` Codex's limit stopped you ${f.xStops.length === 1 ? "once" : plural(f.xStops.length, "time")}.`;
      note = hasApp("Cowork") ? "Claude Code, Cowork and the Claude app share this limit" : "";
    }
    return module("limits", "m5", now() ? "Will I hit a limit this week?" : "Did I hit a limit last week?", big, body, line, note, !!(f.cStops.length || (f.sd != null && f.sd >= 80) || (f.ahead && f.ahead.runs_out)), "Opens your limit, day by day, with each stop and what was running.");
  }

  // ---------- module 2: cost, a receipt that starts with what you paid ----------
  function cost(f) {
    const ps = B.plans || [], cp = claudePlan(), rows = [];
    ps.forEach((p) => {
      // one name for each plan everywhere: the name it's sold under, as on Your week
      const pay = payOf(p), name = window.GBStage.planName(G.plan_facts, p);
      if (pay === "self") rows.push(`<div class="h-rr"><span>${esc(name)}</span><span>$${p.monthly_usd} a month</span><b>${usd(((p.monthly_usd * 12) / 365) * f.nd)}</b></div>`);
    });
    const anyOwn = f.own.length, co = ps.some((p) => payOf(p) === "company"), api = ps.some((p) => payOf(p) === "api");
    let top = rows.join("");
    if (anyOwn) top += `<div class="h-rr tot paid"><span>${now() ? "This week's share so far" : "Last week's share"}</span><b>${usd(f.paid)}</b></div>`;
    if (co) top += `<div class="h-stamp">Paid by your company</div>`;
    if (api && !anyOwn && !co) top += `<div class="h-stamp">Paid per use</div>`;
    if (!ps.length) top += `<div class="h-rr"><span>Your plans</span><b>not chosen yet</b></div>`;
    const ap = ["Claude Code", "Cowork", "Codex"], apv = ((vals, total) => { const t = Math.round(total), fl = vals.map(Math.floor), rem = t - fl.reduce((x, y) => x + y, 0); vals.map((v, i) => [v - Math.floor(v), i]).sort((x, y) => y[0] - x[0]).slice(0, Math.max(0, rem)).forEach(([, i]) => fl[i]++); return fl; })(ap.map((a) => f.use(a)), f.total), shown0 = (a) => { const v = apv[ap.indexOf(a)], r = f.use(a); return r > 0.004 && v < 1 ? "under $1" : "$" + v.toLocaleString(); };
    // the same rounding as the receipt (the logged parts and the estimate together), so the two never differ by a dollar
    // (a cold read, Oct 20: Codex showed $25 here and $26 on the receipt)
    const RCw = ((M.receipt || {})[per()] || {}).tools || null, estOf = (a) => ((RCw || {})[a] || {}).est || 0;
    const rp = RCw ? ((vals, total) => { const t = Math.round(total), fl = vals.map(Math.floor), rem = t - fl.reduce((x, y) => x + y, 0); vals.map((v, i) => [v - Math.floor(v), i]).sort((x, y) => y[0] - x[0]).slice(0, Math.max(0, rem)).forEach(([, i]) => fl[i]++); return fl; })([f.use("Claude Code") - estOf("Claude Code"), estOf("Claude Code") + estOf("Cowork") + estOf("Codex"), f.use("Codex") - estOf("Codex"), f.use("Cowork") - estOf("Cowork")], f.total) : null;
    const shown = (a) => { if (!rp) return shown0(a); const v = a === "Claude Code" ? rp[0] + rp[1] : a === "Codex" ? rp[2] : rp[3], r = f.use(a); return r > 0.004 && v < 1 ? "under $1" : "$" + v.toLocaleString(); };
    const appRow = (a, noun) => hasApp(a) ? `<div class="h-rr dim"><span>${a}</span><span>${f.chats(a) ? plural(f.chats(a), noun) : `no ${noun}s`}</span><b ${f.chats(a) && !f.use(a) ? tip("These chats used a model with no published per-use price, so Crossview can't price them.") : ""}>${f.use(a) ? shown(a) : f.chats(a) ? "not priced" : "$0"}</b></div>` : "";
    const rec = `<div class="h-slot" aria-hidden="true"></div><div class="h-receipt">${top}<div class="h-perf"></div>${appRow("Claude Code", "chat")}${appRow("Cowork", "task")}${appRow("Codex", "chat")}<div class="h-rr tot"><span>If you'd paid per use</span><b>≈ ${perUse(f.total)}</b></div></div>`;
    const big = anyOwn ? `${usd(f.paid)} paid${now() ? " so far" : ""}` : co ? "Company pays" : api ? `${perUse(f.total)} per use` : perUse(f.total);
    const line = !ps.length ? "Choose your plans and Crossview compares them with the work." : co && !anyOwn ? `Your company pays the bill. Paying per use, this work would have cost ${perUse(f.total)}.` : api && !anyOwn ? "Paying per use, your bill should be close to this." : `If you paid per use instead, the same work would cost ${perUse(f.total)}.`;
    return module("cost", "m4", now() ? "What did this week's work cost?" : "What did last week's work cost?", big, rec, line, "", false, "Pay-per-use prices are what the same work would cost at published per-use prices. They aren't a bill. Opens the receipt.");
  }

  // ---------- module 3: setup, the layered stack ----------
  function setup() {
    const apps = ["Claude Code", "Cowork", "Codex"].filter(hasApp);
    if (!apps.includes(S.happ)) S.happ = apps[0] || "Claude Code";
    const A = anat(), L = A && A.layers ? A.layers(S.happ) : [];
    const lay = (id) => L.find((l) => l.id === id), con = lay("connectors"), out = con ? con.items.filter((x) => x.risky || x.as_you).length : 0;  // orange means one thing everywhere (release 3)
    const pick = ["projects", "connectors", "skills", "helpers", "company", "instructions"].map(lay).filter(Boolean);
    const name = { projects: "your projects", connectors: "connectors", skills: "skills", helpers: "subagents", company: "company settings", instructions: "rule files" };
    const DEF = { projects: "The project folders this app worked in.", connectors: "Links to other apps, like your browser, Gmail or Google Drive. Some can send, change or delete things there.", skills: "Instructions for one kind of task, which the AI loads when that task comes up.", helpers: "Separate AIs with their own instructions, which the app can hand part of a job to.", company: "Settings your company set for Claude Code. Only your admin can change them.", instructions: "Files of instructions the AI reads at the start of every chat." };
    const n = pick.length, H = 30, top = 14;
    let g = "";
    pick.slice().reverse().forEach((l, k) => {
      const i = n - 1 - k, y = top + i * H, hot = l.id === "connectors" && out, counted = ["connectors", "skills", "helpers", "company"].includes(l.id) && l.state !== "none" && !/can't/.test(l.line || ""), cnt = counted ? `${l.items.length} ` : "";
      g += `<g class="h-plate${hot ? " hot" : ""}${l.id === "company" ? " lock" : ""}" data-h="layer:${l.id}" tabindex="0" role="button" aria-label="${esc(`${l.title}: ${l.line}`)}" ${tip(DEF[l.id])}><path d="M110 ${y} L200 ${y + 24} L110 ${y + 48} L20 ${y + 24} Z"/><text x="110" y="${y + 28}" text-anchor="middle">${esc(cnt + name[l.id])}</text>${hot ? `<circle cx="182" cy="${y + 24}" r="6" class="h-jack"/>` : ""}</g>`;
    });
    const svg = `<svg viewBox="0 0 220 ${top + n * H + 34}" class="h-stack" role="group" aria-label="How ${esc(S.happ)} is built">${g}</svg>`;
    const sw = apps.length > 1 ? `<div class="h-apps" role="group" aria-label="Which app">${apps.map((a) => `<button data-h="app:${esc(a)}" aria-pressed="${S.happ === a}">${esc(a)}</button>`).join("")}</div>` : "";
    const total = con ? con.items.length : 0;
    const big = total ? (out ? `${plural(out, "connector")} can act for you` : "None can act for you") : "No connectors";
    const line = !total ? `Crossview found no connectors for ${S.happ}.` : total === 1 ? (out ? "Your one connector can act for you: send, delete or act as you outside your computer." : "Your one connector can't send, delete or act as you outside your computer.")
      : `${out === total ? `All ${total} of your connectors` : out === 0 ? `None of your ${total} connectors` : `${out} of your ${total} connectors`} can act for you: send, delete or act as you outside your computer, in apps like email or your files.`;
    return module("setup", "m3", "What can my apps reach?", big, svg + sw, line, "", !!(con && con.items.some((x) => x.as_you)), "A connector is a link to another app, like your browser, Gmail or Google Drive. Opens how this app is built, layer by layer.");
  }

  function module(id, cls, q, big, body, line, note, hot, hint) {
    return `<article class="h-mod ${cls}${hot ? " hot" : ""}" data-h="open:${id}">${screws}
      <h2 class="h-q"><button data-h="open:${id}" aria-description="${esc(hint)}">${esc(q)}</button></h2><p class="h-big">${esc(big)}</p><div class="h-body">${body}</div><p class="h-line">${esc(line)}</p>${note ? `<p class="h-engrave">${esc(note)}</p>` : ""}<button class="h-how-b" data-h="how:${id}" aria-expanded="${S.hhow === id}">How this was made</button></article>`;
  }

  // ---------- how each module's answer was made: one panel, five parts (release 2 slice 3; the receipt's panel, docs/plan-2026-10-19-phase3-requirements.md) ----------
  function how(f) {
    const id = S.hhow;
    if (!["limits", "cost", "setup"].includes(id)) return "";
    const P = M.plan || {}, CX = M.codex_plan || {}, last = P.latest && P.latest.at, R = P.weekly_reset;
    const DAY = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" }, full = (t) => String(t).replace(/^(\w{3})\b/, (d) => DAY[d] || d);
    const E = {
      limits: { h: "Will I hit a limit?", from: `The readings of your 5-hour and weekly limits that the Claude app saves on this computer${CX.latest ? ", and the limit lines in Codex's records" : ""}.`, how: `Crossview shows the latest reading and each week's highest one. The percentage is the app's own reading.${R ? ` Crossview works out when the week resets from when the reading falls back toward zero: somewhere between ${full(R.from)} and ${full(R.to)}.` : ""}`, sure: 2, sureT: "The readings are the app's own. The reset time is worked out from them.", miss: `The app saves a reading only while it's open${last ? `, so the latest one was taken ${day(last.slice(0, 10))} at ${((h) => `${h % 12 || 12}:${last.slice(14, 16)} ${h < 12 ? "am" : "pm"}`)(+last.slice(11, 13))}` : ""}. Anthropic doesn't say how each kind of use counts toward the limit.` },
      cost: { h: "What did the work cost?", from: "The records Claude Code, Cowork and Codex keep on this computer, one per reply, and the plans you chose.", how: "Each reply with a published price is priced by how much text it read and wrote, at that price, with re-reading, saving and writing priced separately. Replies with no published price are counted but have no price. What you paid is each plan's monthly price shared out over the days shown.", sure: 2, sureT: "Mostly from the records. Part of the subagents' price is an estimate, shown on its own line when you open the cost.", miss: "Work on other computers and on Claude's website and phone app. The per-use price is what the same work would cost per use; you pay your plans' flat prices." },
      setup: { h: "What can my apps reach?", from: "The apps' settings files on this computer, and the records of what each connector did.", how: "Crossview counts the connectors each app has set up or used. What a connector did comes from Claude Code's records; for Cowork and Codex it shows what's set up. Whether one can send, delete or act as you outside your computer is judged from the actions it offered in Claude Code's records and from how it's set up. One that only works on websites in a browser of its own isn't counted.", sure: 2, sureT: "Counts are from the settings and records. What a connector can do is partly judged from its setup.", miss: "A connector with no use found hasn't shown its actions yet, so it isn't counted as able to act. Codex's subagents aren't in its records yet." },
    }[id];
    const dots = (n) => `<span class="h-sure" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
    return `<section class="h-how" aria-live="polite"><div class="h-how-top"><h3>How this was made: ${esc(E.h)}</h3><button class="w-link" data-h="how:close">Close</button></div>
      <dl><dt>Where it came from</dt><dd>${esc(E.from)}</dd><dt>How it was worked out</dt><dd>${esc(E.how)}</dd><dt>How sure</dt><dd>${dots(E.sure)}${esc(E.sureT)}</dd><dt>What's missing</dt><dd>${esc(E.miss)}</dd><dt>Last updated</dt><dd>${esc(String(G.built || ""))}</dd></dl>
      ${id === "cost" ? `<button class="h-how-go" data-h="open:cost">See every line of the cost</button>` : ""}<p class="h-how-more">Everything Crossview reads, keeps and can change is on <a href="reads.html${DEMO ? "?demo" : ""}">How Crossview counts</a>.</p></section>`;
  }

  function looks() {
    const N = note && note(), xs = N && N.worth ? N.worth(per()) : [];
    if (!xs.length) return `<section class="h-look"><span class="h-lh">Worth a look</span><p class="h-quiet">Nothing needs a look ${wk()}.</p></section>`;
    return `<section class="h-look"><span class="h-lh">Worth a look</span>${xs.map((x) => `<button class="h-pin${x.hot ? " hot" : ""}" data-h="look:${esc(x.go)}"${x.pick ? ` data-pick="${esc(x.pick)}"` : ""}><i aria-hidden="true"></i><span><b>${esc(x.title)}</b><small>${esc(x.line)}</small></span></button>`).join("")}</section>`;
  }

  function drawer(f) {
    const P = M.periods[f.p] || {}, works = Object.keys(P).filter((w) => P[w].usd > 0 && !["Day job", "Personal", "Not sure yet", "Untitled"].includes(w) && !/with no project$/.test(w)).length;
    const n = f.chats("Claude Code") + f.chats("Codex"), t = f.chats("Cowork");
    return `<button class="h-drawer" data-h="open:work"><span>${now() ? "This week's" : "Last week's"} work: ${plural(n, "chat")}${t ? ` and ${plural(t, "Cowork task")}` : ""}${works ? ` in ${plural(works, "project")}` : ""}</span><b>See every chat ›</b></button>`;
  }

  // with numbers already here, the home shows them at once; a slim strip says the newest records are being read
  const fresh = () => {
    if (S.scanReady) return `<div class="h-fresh ready" role="status"><span>Your newest records are read.</span><button class="w-btn main" data-h="reload">Show the newest numbers</button></div>`;
    if (S.scan && !S.scan.done) return `<div class="h-fresh" role="status"><i aria-hidden="true"></i><span>${esc(S.scan.now || "Reading your newest records")}…</span><small>step ${Math.min((S.scan.step || 0) + 1, S.scan.of || 1)} of ${S.scan.of || 1}</small></div>`;
    return "";
  };
  function board() {
    if (S.scan && !S.scan.done && !(G.sessions > 0)) return scanBoard(S.scan);
    if (LIVE && !DEMO && B.plans_asked === false) return askBoard();
    const f = facts();
    return `<main class="h-panel" aria-label="Home">${screws}<i class="h-screw bl"></i><i class="h-screw br"></i>
      <div class="h-label"><h1 class="h-lead">${esc(lead(f))}</h1><a class="h-tag" href="reads.html${DEMO ? "?demo" : ""}" ${tip("Crossview reads the records your AI apps keep on this computer and sends nothing anywhere. This page lists what it reads and keeps.")}>Reads this computer only ›</a></div>
      ${fresh()}<section class="h-mods">${limits(f)}${cost(f)}${setup()}</section>
      ${how(f)}${looks()}${drawer(f)}</main>`;
  }

  // ---------- the first open: the scan, as it happens ----------
  function tape(lines, nowLine) {
    return `<div class="h-tape"><ol aria-live="polite">${lines.map((l) => `<li${/^Can't see|^Didn't find/.test(l) ? ' class="miss"' : ""}>${esc(l)}</li>`).join("")}${nowLine ? `<li class="now">${esc(nowLine)}…</li>` : ""}</ol></div>`;
  }
  function scanBoard(st) {
    const apps = st.apps || {}, mod = (a, sub) => {
      const x = apps[a], lit = x && x.found;
      return `<article class="h-mod ${a === "Codex" ? "m4" : "m5"} ${lit ? "" : "dark"}">${screws}<p class="h-q">${esc(a === "Claude Code" ? "Claude Code and Cowork" : a)}</p><div class="h-face${lit ? " on" : ""}">${lit ? `<b>Found</b>${esc(sub)}` : "reading"}</div></article>`;
    };
    return `<main class="h-panel scan" aria-label="Reading your records">${screws}<i class="h-screw bl"></i><i class="h-screw br"></i>
      <div class="h-label"><h1 class="h-lead">Crossview is reading what your AI apps keep on this computer.</h1><a class="h-tag" href="reads.html">Reads this computer only ›</a></div>
      ${tape(st.found || [], st.error ? null : st.now || "Looking for your AI apps")}
      ${st.error ? `<p class="h-err" role="alert">${esc(st.error)}</p>` : ""}
      <section class="h-mods">${mod("Claude Code", "One plan and one limit for Claude Code and Cowork")}${mod("Codex", "Its own plan and limit")}<article class="h-mod m3 dark">${screws}<p class="h-q">Setup</p><div class="h-face">reading</div></article></section>
      <p class="h-step">Step ${Math.min((st.step || 0) + 1, st.of || 1)} of ${st.of || 1}</p></main>`;
  }

  // ---------- the first open's one question: who pays for each plan (preset from the records where they say) ----------
  // the plans come from the one plan catalog, tools/plan-facts.json (Codex audit, Oct 19)
  const PFH = G.plan_facts || { claude: [], chatgpt: [] }, mine = (l) => (l || []).filter((p) => p.kind === "personal").map((p) => [p.key, p.name, p.monthly_usd]);
  const CLAUDE = mine(PFH.claude);
  const GPT = mine(PFH.chatgpt);
  function guess() {
    if (S.hask) return S.hask;
    const managed = !!(((AN["Claude Code"] || {}).managed || {}).items || []).length, pt = String((M.codex_plan || {}).plan_type || "").toLowerCase();
    const cxWork = /business|enterprise|team|edu/.test(pt), cxKey = { plus: "plus", pro: "pro200", free: "free", go: "go" }[pt];
    return (S.hask = { claude: managed ? "company" : "me", claudePlan: "max5", codex: cxWork ? "company" : cxKey ? "me" : "me", codexPlan: cxKey || "plus", told: { claude: managed, codex: !!pt } });
  }
  // what was found, from the scan if this page saw it, else from the numbers already read
  function foundLines(st) {
    if (st.found && st.found.length) return st.found;
    const out = [];
    [["Claude Code", "chat"], ["Cowork", "task"], ["Codex", "chat"]].forEach(([a, n]) => { const c = ((AN[a] || {}).folder || {}).session_logs || 0; if (c) out.push(`Found ${a}${a === "Cowork" ? ", inside the Claude app" : ""}: ${plural(c, n)} kept on this computer.`); });
    out.push("Can't see: chats on the Claude and ChatGPT websites, or on your phone.");
    return out;
  }
  function askBoard() {
    const k = guess(), st = S.scanDone || {}, apps = ["Claude Code", "Codex"].filter((a) => hasApp(a) || (st.apps || {})[a]);
    const opts = (v, cur) => (v === "claude" ? CLAUDE : GPT).map(([key, name, p]) => `<option value="${key}"${cur === key ? " selected" : ""}>${esc(name)}${p ? `, $${p} a month` : ""}</option>`).join("") + `<option value="other">Another plan…</option>`;
    const who = (v, label, why) => `<div class="h-who"><span>Who pays?</span><span class="h-seg" role="radiogroup" aria-label="Who pays for ${esc(label)}">${[["me", "Me"], ["company", "My company"], ["unsure", "Not sure"]].map(([x, l]) => `<button role="radio" aria-checked="${k[v] === x}" data-h="who:${v}:${x}">${l}</button>`).join("")}</span>
      ${k[v] === "me" ? `<select data-hplan="${v}" aria-label="Which plan">${opts(v, k[v + "Plan"])}</select>` : ""}${why ? `<small>${esc(why)}</small>` : ""}</div>`;
    const mods = apps.map((a) => a === "Codex"
      ? `<article class="h-mod m4">${screws}<p class="h-q">Codex</p><div class="h-face on"><b>Found Codex</b>It has its own plan and limit</div>${who("codex", "Codex", k.codex === "unsure" ? "Crossview will show what the work would cost per use, without comparing it with a plan." : k.told.codex ? "Picked from Codex's own records." : "")}</article>`
      : `<article class="h-mod m5">${screws}<p class="h-q">Claude Code and Cowork</p><div class="h-face on"><b>Found Claude Code</b>It shares one plan and one limit with Cowork</div>${who("claude", "Claude", k.told.claude ? "Your company manages some of Claude Code's settings, so this is preset." : k.claude === "unsure" ? "Crossview will show what the work would cost per use, without comparing it with a plan." : "Claude Code's records don't say which plan you have, so pick it here.")}</article>`).join("");
    return `<main class="h-panel scan" aria-label="Your plans">${screws}<i class="h-screw bl"></i><i class="h-screw br"></i>
      <div class="h-label"><h1 class="h-lead">${apps.length ? "Who pays for your AI apps?" : "No AI apps were found on this computer."}</h1><a class="h-tag" href="reads.html">Reads this computer only ›</a></div>
      ${tape(foundLines(st), null)}
      <section class="h-mods two">${mods || `<p class="h-quiet">Crossview reads the records Claude Code, Cowork and Codex keep on this computer, and found none. You can look around a made-up company instead.</p>`}</section>
      ${S.herr ? `<p class="h-err" role="alert">${esc(S.herr)}</p>` : ""}
      <div class="h-go">${apps.length ? "" : '<a class="w-btn main" href="?demo">Show me the demo company</a>'}${apps.length ? `<button class="w-btn main" data-h="save">Show my numbers</button>` : ""}</div>
      ${apps.length ? `<p class="h-small">Crossview compares what you pay with what the work would cost per use. You can change your answer later from the cost card on the home.</p>` : ""}</main>`;
  }
  async function save() {
    const k = guess(), plans = [], apps = ["Claude Code", "Codex"].filter((a) => hasApp(a) || ((S.scanDone || {}).apps || {})[a]);
    for (const v of ["claude", "codex"]) {
      if (!apps.includes(v === "claude" ? "Claude Code" : "Codex")) continue;
      const vendor = v === "claude" ? "claude" : "chatgpt";
      if (k[v] === "company") plans.push({ vendor, name: v === "claude" ? "Claude, through work" : "ChatGPT, through work", monthly_usd: null, pay: "company", plan: "work" });
      else if (k[v] === "me") {
        if (k[v + "Plan"] === "other") { S.qopen = "plans"; return "stay"; }
        const c = (v === "claude" ? CLAUDE : GPT).find((x) => x[0] === k[v + "Plan"]);
        if (c) plans.push({ vendor, name: c[1], monthly_usd: c[2] });
      }
    }
    try {
      const r = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json", "X-Glass-Box": "1" }, body: JSON.stringify({ plans }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || "it didn't work");
      location.reload();
    } catch (e) { S.herr = "Your answer wasn't saved: " + e.message; window.dispatchEvent(new Event("gb:render")); }
    return "stay";
  }

  function click(el) {
    const v = el.dataset.h || "";
    if (v.startsWith("open:")) {
      const id = v.slice(5);
      if (id === "limits") { const f0 = facts(); S.screen = "note"; S.nview = null; S.allw = false; S.qsel = "limit"; S.qapp = f0 && !f0.cStops.length && f0.xStops.length ? "Codex" : "Claude"; }
      if (id === "cost") { S.screen = "cost"; S.rsel = null; }  // the receipt (release 2, Oct 19)
      if (id === "setup") { S.screen = "armory"; S.atool = S.happ || "Claude Code"; S.alayer = "connectors"; S.asel = null; }
      if (id === "work") { S.screen = "list"; S.wlsel = null; }  // the work list (release 2, Oct 19)
      return "go";
    }
    if (v.startsWith("how:")) { const k = v.slice(4); S.hhow = k === "close" || S.hhow === k ? null : k; return "stay"; }
    if (v.startsWith("layer:")) { S.screen = "armory"; S.atool = S.happ || "Claude Code"; S.alayer = v.slice(6); S.asel = null; return "go"; }
    if (v.startsWith("app:")) { S.happ = v.slice(4); return "stay"; }
    if (v.startsWith("look:")) { const go = v.slice(5); S.lookPick = el.dataset.pick || null; S.qapp = "Claude"; if (go === "asyou") { S.screen = "armory"; S.atool = "Claude Code"; S.alayer = "connectors"; S.asel = (S.lookPick || null); S.afilter = "all"; return "go"; }
      if (["limit", "reach", "carry", "writing"].includes(go)) { S.qopen = go; S.qfocus = true; return "stay"; }
      if (go === "beforereset") { S.screen = "note"; S.nview = null; S.allw = false; S.qsel = "limit"; S.qapp = "Claude"; return "go"; }
      if (go.startsWith("setup:")) { S.screen = "armory"; S.atool = "Claude Code"; S.alayer = go.slice(6); S.asel = null; S.afilter = "all"; return "go"; }
      if (go.startsWith("work:")) { S.screen = "list"; S.wlopen = new Set([go.slice(5)]); S.wlsel = null; return "go"; } S.screen = "note"; S.nview = null; S.allw = false; S.qsel = go; S.qreveal = true; return "go"; }
    if (v.startsWith("who:")) { const [, which, x] = v.split(":"); guess()[which] = x; S.herr = null; return "stay"; }
    if (v === "save") { save(); return false; }
    if (v === "reload") { location.reload(); return false; }
    return false;
  }
  // a plan picked from the list on the first open
  document.addEventListener("change", (ev) => { const s = ev.target.closest && ev.target.closest("select[data-hplan]"); if (s) guess()[s.dataset.hplan + "Plan"] = s.value; });

  return { board, click };
};
