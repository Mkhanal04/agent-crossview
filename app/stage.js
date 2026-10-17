/* Crossview: the stage every tab shares (task 33, Milan's pick on Oct 14). Your setup's pattern, built once: one sentence
   on top, one picture of plates on the left, and a panel on the right for the plate you pick, with Above and Below and
   the arrow keys. Each tab gives it plates and panel content; the stage draws them the same way everywhere.
   Plain JavaScript, no data of its own. */
window.GBStage = (function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const screws = '<i class="w-screw tl"></i><i class="w-screw tr"></i><i class="w-screw bl"></i><i class="w-screw br"></i>';

  // the same isometric geometry as Your setup's drawing
  const CX = 500, PW = 160, PH = 70;
  const P = (y, i, j) => [CX + (i - j) * PW, y - PH + (i + j) * PH];
  const pts = (a) => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  function slab(y, t, cls) {
    const a = P(y, 0, 0), b = P(y, 1, 0), c = P(y, 1, 1), d = P(y, 0, 1), dn = (q) => [q[0], q[1] + t];
    return `<polygon class="a-side l ${cls}" points="${pts([d, c, dn(c), dn(d)])}"/><polygon class="a-side r ${cls}" points="${pts([c, b, dn(b), dn(c)])}"/><polygon class="a-top ${cls}" points="${pts([a, b, c, d])}"/>`;
  }
  function block(y, i, j, si, sj, h, cls) {
    const a = P(y, i, j), b = P(y, i + si, j), c = P(y, i + si, j + sj), d = P(y, i, j + sj), up = (q) => [q[0], q[1] - h];
    return `<g class="a-blk ${cls}"><polygon class="l" points="${pts([d, c, up(c), up(d)])}"/><polygon class="r" points="${pts([c, b, up(b), up(c)])}"/><polygon class="t" points="${pts([up(a), up(b), up(c), up(d)])}"/></g>`;
  }
  // a few small blocks on a plate, filled from the front corner back: n of them, lit or plain
  function blocks(y, n, cls) {
    const grid = n <= 1 ? 1 : n <= 4 ? 2 : 3, cell = 1 / grid, size = cell * 0.5, cells = [];
    for (let a = 0; a < grid; a++) for (let b = 0; b < grid; b++) cells.push([a, b]);
    cells.sort((x, z) => z[0] + z[1] - (x[0] + x[1]) || x[0] - z[0]);
    let g = "";
    for (let k = 0; k < Math.min(n, cells.length); k++) { const [a, b] = cells[k]; g += block(y, a * cell + (cell - size) / 2, b * cell + (cell - size) / 2, size, size, 8, cls); }
    return g;
  }

  /* plates: [{ id, title, line, state: "lit" | "dim" | "none", hot, pins: [n], blocks, thick, dashed }], top plate first.
     act: the data-w prefix ("q:pick:" makes data-w="q:pick:<id>"); sel: the picked id; label: what the picture shows. */
  function stack({ plates, act, sel, label, gap }) {
    const n = plates.length, G = gap || (n <= 4 ? 150 : n <= 6 ? 110 : 84), TOP = 90, H = TOP + (n - 1) * G + PH * 2 + 40;
    const ys = plates.map((_, k) => TOP + k * G);
    let g = `<line x1="${CX}" y1="${ys[0] - PH - 14}" x2="${CX}" y2="${ys[n - 1] + PH + 34}" class="a-axis"/>`;
    // drawn bottom first, so upper plates sit on top
    for (let k = n - 1; k >= 0; k--) {
      const p = plates[k], y = ys[k], on = p.id === sel, cls = p.state === "lit" ? "lit" : p.state === "none" ? "none" : "plain";
      g += `<g class="a-plate ${p.state || "lit"}${on ? " sel" : ""}${p.dashed ? " none" : ""}" data-w="${esc(act + p.id)}" tabindex="0" role="button" aria-pressed="${on}" aria-label="${esc(`${p.title}: ${p.line || ""}`)}">${slab(y, p.thick || 16, cls)}${blocks(y, p.blocks == null ? 3 : p.blocks, p.hot ? "lit hot" : cls)}</g>`;
    }
    plates.forEach((p, k) => {
      const y = ys[k], left = k % 2 === 0, cx = left ? CX - PW : CX + PW, x2 = left ? cx - 34 : cx + 34, tx = left ? x2 - 8 : x2 + 8, anc = left ? "end" : "start", on = p.id === sel;
      const pin = (p.pins || []).map((m, i) => { const per = Math.min((p.pins || []).length, 4), px = CX - (per - 1) * 15 + (i % 4) * 30, py = y - 24 + Math.floor(i / 4) * 26; return `<g class="g-pin" data-w="${esc(act + p.id)}" data-pin="${m}" tabindex="0" role="button" aria-label="${esc(`Item ${m}, on ${p.title}`)}" data-tip="${esc(`Item ${m}. It's about ${p.title}. Click to see it in the panel.`)}"><circle cx="${px}" cy="${py}" r="11"/><text x="${px}" y="${py + 4}" text-anchor="middle">${m}</text></g>`; }).join("");
      g += `${pin}<g class="a-label${on ? " sel" : ""} ${p.state || "lit"}${p.hot ? " hot" : ""}" data-w="${esc(act + p.id)}"><line x1="${cx}" y1="${y}" x2="${x2}" y2="${y}"/><circle cx="${x2}" cy="${y}" r="4" class="a-lamp"/>
        <text x="${tx}" y="${y - 4}" text-anchor="${anc}" class="a-t">${esc(p.title)}</text>${p.line ? `<text x="${tx}" y="${y + 6}" dy="1.25em" text-anchor="${anc}" class="a-s g-line">${esc(p.line)}</text>` : ""}</g>`;
    });
    return `<svg class="a-svg g-svg" viewBox="-110 0 1220 ${H}" role="group" aria-label="${esc(label || "")}">${g}</svg>`;
  }

  /* the page: lead (one sentence, html), above (chips etc.), title and headRight (the picture's header), canvas (the svg),
     key (legend html), strip (one line under the picture), and the panel: { k, n, act, unit, title, line, body } */
  function page({ lead, above, title, headRight, canvas, key, strip, panel, cls, hint }) {
    const pn = panel || {}, n = pn.n || 1, k = pn.k || 0, unit = pn.unit || "Plate";
    // across (pn.across) for pictures read left to right, like weeks: Earlier and Later with the ← → keys;
    // chip, prevOff and nextOff let a tab say what the panel shows when nothing is picked (All weeks' overview)
    const sw = pn.across ? [["◀", "Earlier", "Shows the week before. The ← key works too."], ["▶", "Later", "Shows the week after. The → key works too."]]
      : [["▲", "Above", "Shows the one above. The ↑ key works too."], ["▼", "Below", "Shows the one below. The ↓ key works too."]];
    const step = n > 1 ? `<header class="a-ph"><div class="a-step" role="group" aria-label="Move between ${esc(unit.toLowerCase())}s">
        <button class="w-btn w-sbtn" data-w="${esc(pn.act)}step:-1" ${(pn.prevOff != null ? pn.prevOff : k === 0) ? "disabled" : ""} data-tip="${sw[0][2]}"><span aria-hidden="true">${sw[0][0]}</span> ${sw[0][1]}</button>
        <span class="a-chip">${esc(pn.chip || `${unit} ${k + 1} of ${n}`)}</span>
        <button class="w-btn w-sbtn" data-w="${esc(pn.act)}step:1" ${(pn.nextOff != null ? pn.nextOff : k === n - 1) ? "disabled" : ""} data-tip="${sw[1][2]}">${pn.across ? `${sw[1][1]} <span aria-hidden="true">${sw[1][0]}</span>` : `<span aria-hidden="true">${sw[1][0]}</span> ${sw[1][1]}`}</button></div></header>` : "";
    return `<div class="g-page ${cls || ""}">${lead ? `<p class="g-lead">${lead}</p>` : ""}${above || ""}
      <div class="a-page g-grid"><section class="w-mod a-stage g-stage">${screws}
        <header class="w-mh"><h3><i class="w-led idle"></i>${esc(title)}</h3>${headRight || ""}${hint === false ? "" : `<span class="w-mh-note" data-tip="Click any one to see it in the panel, or use the ↑ and ↓ keys.">Click one to see it here · ↑ ↓</span>`}</header>
        <div class="a-canvas g-canvas">${canvas}</div>
        ${key ? `<div class="w-legend a-key">${key}</div>` : ""}
        ${strip ? `<footer class="a-strip g-strip">${strip}</footer>` : ""}</section>
        <aside class="a-panel w-mod g-panel" aria-label="${esc(pn.title || "")}">${screws}${step}
          ${pn.title ? `<h3>${esc(pn.title)}</h3>` : ""}${pn.line ? `<p class="a-line">${pn.line}</p>` : ""}
          <div class="g-body">${pn.body || ""}</div><div class="g-more" aria-hidden="true">More below ↓</div></aside></div></div>`;
  }

  // the picked id after a step up (-1) or down (1), within the plates' order
  function stepIn(ids, cur, dir) { const k = Math.max(0, ids.indexOf(cur)); return ids[Math.max(0, Math.min(ids.length - 1, k + dir))]; }
  // the first sentence of a piece of html, for a plate's label (short, whole words)
  function short(html, max) {
    const t = String(html || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(), m = max || 52;
    const ss = t.match(/[^.?!]+[.?!]?(\s|$)/g) || [t];
    let s = (ss[0] || "").trim();
    if (s.length < 14 && ss[1]) s = (s + " " + ss[1].trim()).trim();  // "Yes." alone says too little
    if (s.length <= m) return s.replace(/\.$/, "");
    const cut = s.slice(0, m).replace(/\s+\S*$/, "");
    return cut.replace(/[,;:]$/, "") + "…";
  }
  // one name for each of Codex's parts and settings, on every tab (release 1 QA, pattern D)
  const NAMES = { "unified-computer-use": "Engine behind Browser and Computer control", "computer-use": "Computer control", node_repl: "Code runner", chrome: "Chrome", browser: "Browser",
    "codex-app-tools": "Codex app tools", "code-review": "Code review", "template-creator": "Template creator", visualize: "Visualize", documents: "Documents", pdf: "PDF", spreadsheets: "Spreadsheets", presentations: "Presentations",
    "Approval rule": "When it asks you", Sandbox: "What it may change", "Thinking effort": "How hard it thinks", "Auto mode notes": "Notes for when it works without asking" };
  const VALUES = { default: "Codex's default", never: "Never asks", "on-request": "Decides when to ask", untrusted: "Asks before most actions", "on-failure": "Asks only after something fails", "danger-full-access": "Anything on this Mac", "workspace-write": "Only the folder it works in", "read-only": "Nothing; it only reads", };
  // Codex's parts that work your screen or your own Chrome can act as you (the one reach rule)
  // (the engine behind them, unified-computer-use, carries no mark of its own: Chrome and Computer control already do; release 3)
  const ACTS_AS_YOU = new Set(["computer-use", "chrome"]);
  const name = (n) => NAMES[n] || n, value = (v) => VALUES[v] || v, actsAsYou = (n) => ACTS_AS_YOU.has(n);
  const model = (v) => (/^gpt-/i.test(v || "") ? "GPT-" + v.slice(4).split("-").map((x, i) => (i ? x.charAt(0).toUpperCase() + x.slice(1) : x)).join(" ") : v);
  return { stack, page, stepIn, short, screws, esc, name, value, actsAsYou, model };
})();
