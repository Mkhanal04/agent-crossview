// At a narrower window (run.py opens this at 1280 and 1000 pixels): nothing on the three main screens scrolls the page
// sideways or sticks out of its panel. One FIT line per screen, an OVERFLOW line for each problem.
// Since Oct 14 (the QA found the fit check missed these): text inside a box or a drawing that is cut off, or drawn
// smaller than 11 pixels on screen, is an OVERFLOW too.
window.__err = []; window.addEventListener("error", (e) => window.__err.push(e.message));
const $ = (s) => document.querySelector(s), wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (el) => el && el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const out = [];
function check(where) {
  const W = document.documentElement.clientWidth, sw = document.documentElement.scrollWidth;
  if (sw > W + 1) out.push(`OVERFLOW ${where}: the page is ${sw - W}px wider than the window`);
  document.querySelectorAll(".w-app, .w-helper, .y-port, .y-proj, .w-dec, .w-oc, .a-cd-r, .w-gauge, .w-weekline, .a-panel, .a-stage, .q-chip, .q-act .w-btn, .q-fig, .q-tiles, .q-bar, .s-plate, .s-flow, .s-items, .s-bars").forEach((el) => {
    for (let q = el.parentElement; q && q !== document.body; q = q.parentElement) { const ox = getComputedStyle(q).overflowX; if (ox === "auto" || ox === "scroll") return; }  // inside a row that scrolls sideways on purpose
    const box = el.closest(".w-mod:not(.a-panel):not(.a-stage)") || el.closest(".w-page, .y-page, .a-page"), r = el.getBoundingClientRect(), b = box && box.getBoundingClientRect();
    if (b && r.width && (r.right > b.right + 1 || r.left < b.left - 1)) out.push(`OVERFLOW ${where}: ${el.className.split(" ")[0]} "${(el.innerText || "").split("\n")[0].slice(0, 30)}" sticks out ${Math.round(Math.max(r.right - b.right, b.left - r.left))}px`);
  });
  // text cut off by its box, or drawn below 11 pixels (drawings scale their text with the drawing)
  const seen = new Set();
  document.querySelectorAll("#stage b, #stage small, #stage span, #stage p, #stage td, #stage th, #stage button, #stage label, #stage em, #stage text").forEach((el) => {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own || el.closest(".sr, .sr-only")) return;  // text for screen readers only is hidden on purpose
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) return;
    const name = `${(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || el.tagName).toString().split(" ")[0] || el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 28)}"`;
    let px = parseFloat(cs.fontSize);
    if (el.tagName.toLowerCase() === "text" && el.getScreenCTM) { const m = el.getScreenCTM(); px = px * Math.hypot(m.a, m.b); }
    if (px < 10.5 && !seen.has("s" + name)) { seen.add("s" + name); out.push(`OVERFLOW ${where}: ${name} is drawn at ${px.toFixed(1)}px, under 11`); }
    const clips = cs.overflow !== "visible" || cs.textOverflow === "ellipsis";
    if (el.tagName.toLowerCase() !== "text" && clips && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2) && !seen.has("c" + name)) { seen.add("c" + name); out.push(`OVERFLOW ${where}: ${name} is cut off`); }
  });
  // a key next to its ring stays inside the ring's card (QA recheck, Oct 15: the "Made by you" keys ran into the edge at 1280)
  document.querySelectorAll(".a-leg").forEach((el) => { const box = el.closest(".a-rings, .a-viz"), r = el.getBoundingClientRect(), b = box && box.getBoundingClientRect(); if (b && r.width && r.right > b.right + 1) out.push(`OVERFLOW ${where}: the key "${el.innerText.split("\n")[0].slice(0, 30)}" runs ${Math.round(r.right - b.right)}px past its card`); });
  // text inside a drawing stays inside the drawing and its card (release 3: the known gap since Oct 14; the Your setup
  // labels at 1000 and the folder drawing at 1280 ran past their edges and nothing caught it)
  document.querySelectorAll("#stage svg text").forEach((el) => {
    if (!el.textContent.trim()) return;
    const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return;
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const svg = el.ownerSVGElement, sr = svg && svg.getBoundingClientRect(), card = el.closest(".w-mod, .a-panel, .g-panel, .a-stage, .g-stage"), cr = card && card.getBoundingClientRect();
    const past = (b) => b && Math.max(b.left - r.left, r.right - b.right, b.top - r.top, r.bottom - b.bottom);
    const name = `"${el.textContent.trim().slice(0, 28)}"`, a = past(sr), c = past(cr);
    if (c > 1) out.push(`OVERFLOW ${where}: the drawing's text ${name} runs ${Math.round(c)}px past its card`);
    else if (a > 2 && !(svg && getComputedStyle(svg).overflow === "visible")) out.push(`OVERFLOW ${where}: the drawing's text ${name} is cut ${Math.round(a)}px at the drawing's edge`);
  });
  // the strip under a picture holds its one line (release 2 QA: All weeks' totals ran past it at 1280)
  document.querySelectorAll("#stage .g-strip").forEach((el) => { if (el.scrollWidth > el.clientWidth + 1) out.push(`OVERFLOW ${where}: the strip "${el.innerText.slice(0, 30)}" runs ${el.scrollWidth - el.clientWidth}px past its line`); });
  out.push(`FIT ${where}`);
}
// the top bar (release 2 QA: "This week" and the date chip were cut at 1280, and at 1440 with scrollbars): every tab, week
// choice and the date chip shows whole, inside the window, at 11 pixels or more
function bar(where) {
  document.querySelectorAll("#bar .tabs button, #bar .w-seg button, #bar .w-asof, #bar .w-asof span, #bar .brand, #bar .more-menu summary, #bar .bar-refresh").forEach((el) => {
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const name = `${el.className ? String(el.className).split(" ")[0] : el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 24)}"`;
    if (r.left < -1 || r.right > document.documentElement.clientWidth + 1) out.push(`OVERFLOW ${where}: the top bar's ${name} runs past the window`);
    if (el.scrollWidth > el.clientWidth + 1) out.push(`OVERFLOW ${where}: the top bar's ${name} is cut off`);
    for (let q = el.parentElement; q && q.id !== "bar"; q = q.parentElement) {
      if (getComputedStyle(q).overflow === "visible") continue;
      const b = q.getBoundingClientRect(); if (r.left < b.left - 1 || r.right > b.right + 1) { out.push(`OVERFLOW ${where}: the top bar's ${name} is cut by its row`); break; }
    }
    if (parseFloat(getComputedStyle(el).fontSize) < 10.5) out.push(`OVERFLOW ${where}: the top bar's ${name} is under 11px`);
  });
  out.push(`FIT the top bar, ${where}`);
}
(async () => {
  await wait(400);
  const width = window.innerWidth;
  for (const [sc, name] of [["note", "Your week"], ["machine", "Your work"], ["armory", "Your setup"], ["shapes", "Your AI's instructions"]]) {
    click($(`[data-go="screen:${sc}"]`)); await wait(200); check(`${name} at ${width}px`); bar(`${name} at ${width}px`);
  }
  // All weeks, on both tabs that have it: the overview, a picked week, every limit stop, and Your work's every project
  const TW = () => document.querySelectorAll("[data-nper]")[0].dataset.nper;
  click($('[data-go="screen:note"]')); await wait(150);
  if ($('[data-nper="all"]')) {
    click($('[data-nper="all"]')); await wait(200);
    check(`All weeks at ${width}px`); bar(`All weeks at ${width}px`);
    const wk = document.querySelectorAll(".h-svg .h-week"); if (wk.length) { click(wk[Math.max(0, wk.length - 2)]); await wait(150); check(`All weeks, last week picked, at ${width}px`); }
    if ($('[data-w="h:stops"]')) { click($('[data-w="h:stops"]')); await wait(150); check(`Every limit stop at ${width}px`); click($('[data-w="h:stops"]')); await wait(100); }
    click($('[data-go="screen:machine"]')); await wait(200); check(`Your work, all weeks, at ${width}px`); bar(`Your work, all weeks, at ${width}px`);
    const rows = document.querySelectorAll(".y-allrow"); if (rows.length > 3) { click(rows[3]); await wait(150); check(`Your work, all weeks, a project picked, at ${width}px`); }
    click($(`[data-nper="${TW()}"]`)); await wait(150);
  }
  click($('[data-go="screen:note"]')); await wait(150);
  for (const k of ["reach", "carry"]) { if ($('[data-w="q:sheet:reach"]') || $('[data-w="q:sheet:carry"]')) break; click($(`[data-w="q:plate:${k}"]`)); await wait(80); }
  const sh = $('[data-w="q:sheet:reach"]') || $('[data-w="q:sheet:carry"]');
  if (sh) { click(sh); await wait(120); const r = $(".q-sheet").getBoundingClientRect(); if (r.left < 0 || r.right > window.innerWidth || r.top < 0 || r.bottom > window.innerHeight) out.push(`OVERFLOW a prepared change at ${width}px doesn't fit the window`); out.push(`FIT a prepared change at ${width}px`); click($('[data-w="q:close"]')); await wait(60); }
  click($('[data-w="q:detail"]')); await wait(200); check(`The week in detail at ${width}px`);
  click($('[data-go="screen:armory"]')); await wait(150);
  click($('[data-a="layer:connectors"]')); await wait(150); check(`Your setup connectors at ${width}px`);
  for (const l of ["skills", "helpers", "folder", "settings"]) { click($(`[data-a="layer:${l}"]`)); await wait(150); check(`Your setup ${l} at ${width}px`); }
  out.push("ERR " + window.__err.join(" | "));
  const p = document.createElement("pre"); p.id = "fit"; p.textContent = out.join("\n"); document.documentElement.appendChild(p);
})();
