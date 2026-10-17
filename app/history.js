/* Crossview: All weeks (release 2, Oct 16). The third choice on the week switch: Your week's long view. Built from round
   two of the wireframes (data/concepts/more-pages-2026-10-16) after a tree test and three first-time reads: one sentence for
   the whole history, one picture (every week as a bar split by the six biggest projects, the last four weeks banded, limit
   stops marked by app with a count), a panel that shows all weeks together until you pick one, the all-time totals in the
   strip, and every limit stop one click deeper. It replaces Mission control and By week (docs/more-pages-2026-10-16.md).
   Release 2 fix round (data/qa-2026-10-16-r2/report.md): the overview panel, the shared panel parts, shares that add to
   100%, one start date (the first chat), a shorter legend, past stops in ink and only this week's in orange, no hover tip
   over the marks, a money scale for small weeks, Earlier and Later with the ← → keys, and one tab stop for the picture. */
window.GBHistory = function (X) {
  "use strict";
  const { G, S, esc, day, HITS, plus, thisWeek, lastWeek, span, plural, workName, shares } = X;
  const M = G.machine || { periods: {}, apps: {} }, W = G.weekly || {}, ST = window.GBStage;
  const modelName = X.modelName || ((m) => m);
  const at = (ts) => new Date(ts + ":00Z");
  const localDay = (ts) => { const d = at(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const weekOf = (d) => { const t = new Date(d + "T12:00:00"), k = (t.getDay() + 6) % 7; t.setDate(t.getDate() - k); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
  const ampm = (s) => s.replace(" AM", " am").replace(" PM", " pm");
  const when = (ts) => ampm(at(ts).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })).replace(/^(\w+), (\w+ \d+), /, "$1 $2 at ");
  const monthOf = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "long" });
  const usd = (v) => (v < 10 ? "under $10" : `about $${(v >= 1000 ? Math.round(v / 100) * 100 : Math.round(v / 10) * 10).toLocaleString()}`);
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const pctWord = (p, v) => (v > 0 && p < 1 ? "under 1%" : p + "%");
  const limitWord = (h) => `${h.tool === "Codex" ? "Codex's" : "Claude's"} ${h.kind === "seven_day" ? "weekly" : h.kind === "five_hour" ? "5-hour" : "usage"} limit`;
  const row = (a, b) => `<div class="g-row"><span>${a}</span><b>${b}</b></div>`;
  const grp = (h, body) => `<div class="g-grp"><h4>${h}</h4>${body}</div>`;

  // every Monday from the first logged week to this week, empty weeks included; the words date from the first chat
  const firstWeek = Object.keys(W).sort()[0] || thisWeek;
  const firstDay = (G.work || []).reduce((a, o) => (o.first && o.first < a ? o.first : a), plus(thisWeek, 6));
  const weeks = []; for (let w = firstWeek; w <= thisWeek; w = plus(w, 7)) weeks.push(w);
  const total = (w) => Object.values(W[w] || {}).reduce((a, v) => a + v, 0);
  const allTime = {}; Object.values(W).forEach((pw) => Object.entries(pw).forEach(([p, v]) => (allTime[p] = (allTime[p] || 0) + v)));
  const allUsd = Object.values(allTime).reduce((a, v) => a + v, 0);
  const TOP = Object.entries(allTime).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([p]) => p);
  // project colors with no orange (what needs you) and no blue (where something came from): one job per color
  const PAL = ["#7d8799", "#c690bd", "#6fb594", "#cdb46a", "#9d8fd0", "#7fb7b8"], REST = "#C3C9D2";
  const COL = (p) => PAL[TOP.indexOf(p)] || REST;
  const stopsIn = (w, app) => HITS.filter((h) => weekOf(localDay(h.ts)) === w && (app === "Codex" ? h.tool === "Codex" : h.tool !== "Codex"));
  const stopWeeks = new Set(HITS.map((h) => weekOf(localDay(h.ts))));

  function lead() {
    if (weeks.length < 2) return "Crossview has one week of your chats so far.";
    const four = (i) => weeks.slice(i, i + 4).reduce((a, w) => a + total(w), 0);
    let best = 0; for (let i = 1; i + 4 <= weeks.length; i++) if (four(i) > four(best)) best = i;
    if (weeks.length >= 8 && best + 4 === weeks.length) return "Your last four weeks were your busiest yet.";
    const top = weeks.slice().sort((a, b) => total(b) - total(a))[0];
    return `Your busiest week so far was the week of ${day(top)}.`;
  }

  // each week gets a slot across the full width; its bar stays narrow, so a short history fills the picture without fat bars
  function chart(pick) {
    const Wd = 940, H = 500, L = 64, n = weeks.length, sw = (Wd - L - 8) / n, bw = Math.max(4, Math.min(sw * 0.6, 48)), top = Math.max(1, ...weeks.map(total));
    const Y = (v) => H - 46 - (v * (H - 140)) / top;
    const step = [2000, 1000, 500, 250, 100, 50, 25, 10].find((s0) => top / s0 >= 2) || 10;
    let g = `<line x1="${L - 4}" y1="${Y(0)}" x2="${Wd}" y2="${Y(0)}" class="h-base"/>`;
    for (let v = step; v <= top; v += step) g += `<line x1="${L - 4}" y1="${Y(v)}" x2="${Wd}" y2="${Y(v)}" class="h-grid"/><text x="${L - 10}" y="${Y(v) + 4}" text-anchor="end" class="h-ax">$${v.toLocaleString()}</text>`;
    if (n >= 4) { const x0 = L + (n - 4) * sw; g += `<rect x="${x0.toFixed(1)}" y="40" width="${(4 * sw).toFixed(1)}" height="${(Y(0) - 40).toFixed(1)}" class="h-band"/><text x="${(x0 + 2 * sw).toFixed(1)}" y="30" text-anchor="middle" class="h-ax">last four weeks</text>`; }
    weeks.forEach((w, i) => {
      const x = L + i * sw, cx = x + sw / 2, bx = cx - bw / 2, parts = W[w] || {}, tot = total(w), now = w === thisWeek;
      let y = Y(0);
      const st = stopsIn(w, "Claude").length + stopsIn(w, "Codex").length;
      const label = `${now ? "This week" : w === lastWeek ? "Last week" : "Week of " + day(w)}: ${tot ? usd(tot) + (now ? " so far" : "") + " at pay-per-use prices" : "no chats"}${st ? `, ${plural(st, "limit stop")}` : ""}.`;
      // one tab stop for the whole picture: the picked week (or this week); the arrow keys move between weeks
      g += `<g class="h-week${w === pick ? " sel" : ""}" data-w="h:week:${w}" tabindex="${w === (pick || thisWeek) ? 0 : -1}" role="button" aria-pressed="${w === pick}" aria-label="${esc(label)}">`;
      g += `<rect x="${x.toFixed(1)}" y="40" width="${sw.toFixed(1)}" height="${(Y(0) - 40).toFixed(1)}" class="h-hit"/>`;
      g += `<line x1="${cx.toFixed(1)}" y1="${Y(0)}" x2="${cx.toFixed(1)}" y2="${Y(0) + 4}" class="h-tick"/>`;
      if (!tot) g += `<circle cx="${cx.toFixed(1)}" cy="${Y(0) - 5}" r="2.5" class="h-none"/>`;
      TOP.concat(["*"]).forEach((p) => {
        const v = p === "*" ? Object.entries(parts).filter(([k]) => !TOP.includes(k)).reduce((a, [, q]) => a + q, 0) : parts[p] || 0;
        if (v <= 0) return;
        const hh = (v * (H - 140)) / top; y -= hh;
        g += `<rect x="${bx.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" fill="${p === "*" ? REST : COL(p)}"/>`;
      });
      if (w === pick && !S.hstops) g += `<rect x="${(bx - 3).toFixed(1)}" y="${(Y(tot) - 4).toFixed(1)}" width="${(bw + 6).toFixed(1)}" height="${(Y(0) - Y(tot) + 6).toFixed(1)}" rx="3" class="h-pick"/>`;
      // stops: ink for past weeks, orange only for this week (orange is for what needs you)
      let yy = Y(tot) - 8;
      [["Claude", stopsIn(w, "Claude").length], ["Codex", stopsIn(w, "Codex").length]].forEach(([app, c]) => {
        if (!c) return;
        g += app === "Claude" ? `<path d="M${(cx - 6).toFixed(1)} ${yy.toFixed(1)} l6 -10 l6 10 z" class="h-stop${now ? " now" : ""}"/>` : `<rect x="${(cx - 5).toFixed(1)}" y="${(yy - 10).toFixed(1)}" width="10" height="10" class="h-stop-cx${now ? " now" : ""}"/>`;
        if (c > 1) g += `<text x="${(cx + 9).toFixed(1)}" y="${(yy - 1).toFixed(1)}" class="h-count">${c}</text>`;
        yy -= 15;
      });
      const d = new Date(w + "T12:00:00");
      const dated = (d.getDate() <= 7 && i > 2) || i === 0;
      if (dated) g += `<text x="${cx.toFixed(1)}" y="${Y(0) + 22}" text-anchor="middle" class="h-ax">${d.toLocaleDateString("en-US", { month: "short" })} ${d.getDate()}</text>`;
      if (now && tot) g += `<text x="${(x + sw).toFixed(1)}" y="${Y(0) + 40}" text-anchor="end" class="h-ax">so far</text>`;
      g += `</g>`;
    });
    return `<svg class="h-svg" viewBox="0 0 ${Wd} ${H}" role="group" aria-label="What your work would cost without a plan, week by week. Use the left and right arrow keys to move between weeks.">${g}</svg>`;
  }

  function key() {
    const seen = new Set(); weeks.forEach((w) => Object.keys(W[w] || {}).forEach((p) => seen.add(p)));
    return TOP.filter((p) => seen.has(p)).map((p) => `<span><i class="q-k" style="background:${COL(p)}"></i>${esc(workName(p))}</span>`).join("")
      + (Object.keys(allTime).length > TOP.length ? `<span><i class="q-k" style="background:${REST}"></i>Everything else</span>` : "")
      + (HITS.some((h) => h.tool !== "Codex") ? `<span><i class="h-k-tri" aria-hidden="true"></i>Claude's limit stopped you</span>` : "")
      + (HITS.some((h) => h.tool === "Codex") ? `<span><i class="h-k-sq" aria-hidden="true"></i>Codex's limit stopped you</span>` : "");
  }

  // all weeks together: what the panel shows before you pick a week
  function overview() {
    if (weeks.length < 2) return { title: `This week, ${span(thisWeek)}`, line: `${cap(usd(allUsd))} so far at pay-per-use prices.`, body: `<p class="g-note">Crossview found one week of chats on this Mac so far. Each new week adds a bar here.</p>` };
    const busiest = weeks.filter((w) => total(w) > 0).sort((a, b) => total(b) - total(a)).slice(0, 3);
    const K = {}; Object.values((M.periods || {}).all || {}).forEach((t) => Object.entries(t.kinds || {}).forEach(([k, v]) => (K[k] = (K[k] || 0) + v)));
    const KW = { read: "Re-reading the chat so far", write: "Saving the chat to re-read", out: "Writing answers", fresh: "New input" };
    const kk = Object.entries(K).filter(([k, v]) => KW[k] && v > 0).sort((a, b) => b[1] - a[1]), ks = shares(kk.map(([, v]) => v));
    const cl = HITS.filter((h) => h.tool !== "Codex").length, cx = HITS.length - cl, times = (c) => (c === 1 ? "once" : c === 2 ? "twice" : c + " times");
    const body = grp("Your busiest weeks", busiest.map((w) => `<div class="g-row"><span><button class="w-link" data-w="h:week:${w}">Week of ${esc(day(w))}</button></span><b>${cap(usd(total(w)))}</b></div>`).join(""))
      + grp("Limits", HITS.length ? `<p class="g-note">Claude's limits stopped you ${times(cl)}${cx ? ` and Codex's ${times(cx)}` : ""}, in ${plural(stopWeeks.size, "week")}.</p>` : `<p class="g-note">No limit stopped you since ${esc(day(firstDay))}.</p>`)
      + (kk.length ? grp("Where the price went", kk.map(([k, v], i) => row(KW[k], pctWord(ks[i], v))).join("") + `<p class="g-note">Before each step, Claude or Codex reads the whole chat again, so a long chat spends most of its price on re-reading.</p>`) : "");
    return { title: `All weeks since ${day(firstDay)}`, line: "Pick a week in the picture to see it here.", body };
  }

  function weekPanel(w) {
    const tot = total(w), P = M.periods[w] || null, A = (M.apps || {})[w] || null;
    const projects = Object.entries(W[w] || {}).sort((a, b) => b[1] - a[1]);
    let body = w === thisWeek || w === lastWeek ? `<div class="q-act h-open"><button class="w-btn" data-w="h:open:${w}">Show me ${w === thisWeek ? "this week" : "last week"} in detail</button></div>` : "";
    if (projects.length) {
      const shown = projects.slice(0, 2), rest = projects.slice(2).reduce((a, [, v]) => a + v, 0), s = shares(shown.map(([, v]) => v).concat(rest > 0 ? [rest] : []));
      body += grp("Projects, by share of the price", shown.map(([p, v], i) => row(esc(workName(p)), pctWord(s[i], v))).join("") + (rest > 0 ? row(`${projects.length - 2} more`, pctWord(s[2], rest)) : ""));
    } else body += `<p class="g-note">No chats that week.</p>`;
    if (A) { const ap = Object.entries(A).filter(([, x]) => x && x.sessions); if (ap.length) body += grp("Apps", ap.map(([a, x]) => row(esc(a), plural(x.sessions, "chat"))).join("")); }
    if (P) {
      const md = {}; Object.values(P).forEach((t) => Object.entries(t.models || {}).forEach(([m, v]) => (md[m] = (md[m] || 0) + v)));
      const all = Object.entries(md).sort((a, b) => b[1] - a[1]), top = all.slice(0, 2), rest = all.slice(2).reduce((a, [, v]) => a + v, 0);
      const s = shares(top.map(([, v]) => v).concat(rest > 0 ? [rest] : []));
      if (top.length) body += grp("Models, by share of the price", top.map(([m, v], i) => row(esc(modelName(m)), pctWord(s[i], v))).join("") + (rest > 0 ? row(`${all.length - 2} more`, pctWord(s[2], rest)) : ""));
    } else if (tot) body += `<p class="g-note">Crossview keeps app and model detail for the last ten weeks.</p>`;
    const st = stopsIn(w, "Claude").concat(stopsIn(w, "Codex")).sort((a, b) => a.ts.localeCompare(b.ts));
    body += grp("Limits", st.length ? st.map((h) => `<p class="h-stopl${w === thisWeek ? " hot" : ""}"><i aria-hidden="true"></i>${cap(limitWord(h))} stopped you on ${esc(when(h.ts))}.</p>`).join("") : `<p class="h-stopl"><i aria-hidden="true"></i>No limit stopped you ${w === thisWeek ? "this week so far" : "that week"}.</p>`);
    const title = w === thisWeek ? `This week, ${span(w)}` : w === lastWeek ? `Last week, ${span(w)}` : `Week of ${span(w)}`;
    const line = tot ? `${cap(usd(tot))}${w === thisWeek ? " so far" : ""} at pay-per-use prices.` : "No chats that week.";
    return { title, line, body };
  }

  function stopsPanel() {
    const rows = HITS.slice().sort((a, b) => b.ts.localeCompare(a.ts)).map((h) => {
      const r = (h.running || [])[0], who = r ? (/^Codex chats with no project$/.test(r.work) ? "a Codex chat with no project" : workName(r.work)) : "";
      return `<li><b>${esc(when(h.ts))}</b><br><small>${esc(cap(limitWord(h)))}${who ? ` · ${esc(who)} was open` : ""}</small></li>`;
    }).join("");
    return { title: "Every time a limit stopped you", line: `${cap(plural(HITS.length, "time"))}, in ${plural(stopWeeks.size, "week")}. Claude Code, Cowork and the Claude app share Claude's limits; Codex has its own.`, body: `<ul class="q-list">${rows}</ul><p class="h-more"><button class="w-link" data-w="h:back">← Back</button></p>` };
  }

  function page() {
    if (S.hweek && !weeks.includes(S.hweek)) S.hweek = null;
    const pn = S.hstops ? stopsPanel() : S.hweek ? weekPanel(S.hweek) : overview();
    const strip = `<span>${cap(usd(allUsd))} since ${esc(day(firstDay))} · ${plural(G.sessions || 0, "chat")}${HITS.length ? ` · ${plural(HITS.length, "limit stop")}` : ""}</span>`;
    const headRight = HITS.length ? `<button class="w-btn h-stops-btn${S.hstops ? " on" : ""}" data-w="h:stops" aria-pressed="${!!S.hstops}">Every limit stop</button>` : "";
    // the panel's header row is always there, so nothing below it moves: a picked week's place, or what the panel shows instead
    const k = S.hweek ? weeks.indexOf(S.hweek) : weeks.length;
    const head = S.hstops ? { chip: plural(HITS.length, "limit stop"), prevOff: true, nextOff: true } : S.hweek ? {} : { chip: plural(weeks.length, "week"), prevOff: weeks.length < 1, nextOff: true };
    return ST.page({ lead: esc(lead()), title: "What your work would cost without a plan, week by week", headRight, hint: false, canvas: chart(S.hweek), key: key(), strip,
      cls: "q-page h-page", panel: Object.assign({ k, n: Math.max(2, weeks.length), act: "h:week:", unit: "Week", across: true, title: pn.title, line: esc(pn.line), body: pn.body }, head) });
  }

  function click(el) {
    const v = el.dataset.w || "";
    if (!v.startsWith("h:")) return null;
    if (v.startsWith("h:week:step:")) { step(Number(v.slice(12))); return "stay"; }
    if (v.startsWith("h:week:")) { const w = v.slice(7); S.hweek = w === S.hweek && !S.hstops ? null : w; S.hstops = false; return "stay"; }
    if (v === "h:stops") { S.hstops = !S.hstops; return "stay"; }
    if (v === "h:back") { S.hstops = false; return "stay"; }
    if (v.startsWith("h:open:")) { S.allw = false; S.hback = true; S.nper = v.slice(7); S.nview = "detail"; S.hstops = false; return "top"; }
    return null;
  }
  // Earlier (-1) and Later (1); with no week picked, either one starts on this week
  function step(dir) { const i = S.hweek ? weeks.indexOf(S.hweek) + dir : weeks.length - 1; if (!weeks[i]) return false; S.hweek = weeks[i]; S.hstops = false; return true; }
  // Esc: the stops list closes first, then the picked week, back to all weeks together
  const close = () => (S.hstops ? ((S.hstops = false), true) : S.hweek ? ((S.hweek = null), true) : false);
  const range = () => `${day(firstDay)} to ${day(plus(thisWeek, 6))}`;
  return { page, click, step, range, close };
};
