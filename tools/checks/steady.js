window.__err = []; window.addEventListener("error", (e) => window.__err.push(e.message));
// this week and last week, read from the switch, so the checks work in any week
const TW = () => document.querySelectorAll("[data-nper]")[0].dataset.nper, LW = () => document.querySelectorAll("[data-nper]")[1].dataset.nper;
const $ = (s) => document.querySelector(s), wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (el) => el && el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const out = [];
const snap = (sels) => Object.fromEntries(sels.map((s) => [s, [...document.querySelectorAll(s)].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })]));
const diff = (label, a, b) => { Object.keys(a).forEach((s) => { const x = JSON.stringify(a[s]), y = JSON.stringify(b[s]); if (x !== y) out.push(`MOVED ${label}: ${s} ${x} -> ${y}`); }); };
(async () => {
  await wait(400);
  const BAR = [".brand", ".tabs", ".tabs button", ".w-asof", ".more-menu"];
  // the four answers keep their frame when the week changes, and a prepared change opens over the page
  const FRONT = BAR.concat([".g-page", ".g-stage", ".g-canvas", ".g-panel", ".a-ph", ".g-strip"]);
  let a = snap(FRONT); click($(`[data-nper="${TW()}"]`)); await wait(120); let b = snap(FRONT); diff("Your week: last->this", a, b);
  click($(`[data-nper="${LW()}"]`)); await wait(120);
  if ($('[data-w="q:app:Codex"]')) { a = snap(FRONT); click($('[data-w="q:app:Codex"]')); await wait(120); b = snap(FRONT); diff("Your week: Claude->Codex", a, b); a = snap(FRONT); click($('[data-w="q:app:Claude"]')); await wait(120); b = snap(FRONT); diff("Your week: Codex->Claude", a, b); }
  for (const k of ["limit", "reach", "carry", "plan"]) { a = snap(FRONT); click($(`[data-w="q:plate:${k}"]`)); await wait(100); b = snap(FRONT); diff(`Your week: pick ${k}`, a, b); }
  for (const k of ["limit", "reach", "carry", "stops", "pace"]) {
    click($(`[data-w="q:plate:${k === "stops" || k === "pace" ? "limit" : k}"]`)); await wait(80);
    const btn = $(`[data-w="q:sheet:${k}"]`); if (!btn) continue;
    a = snap(FRONT); click(btn); await wait(120); b = snap(FRONT); diff(`Your week: open the ${k} sheet`, a, b);
    click($('[data-w="q:close"]')); await wait(80);
  }
  const WEEK = BAR.concat([".w-strip", ".w-gauge", ".w-sep", ".w-weekline", ".w-days", ".w-row", ".w-agents", ".w-paid", ".w-board", ".w-apps", ".w-sankey", ".w-doors", ".w-door"]);
  click($('[data-w="q:detail"]')); await wait(150);
  a = snap(WEEK); click($(`[data-nper="${TW()}"]`)); await wait(120); b = snap(WEEK); diff("The week in detail: last->this", a, b);
  click($(`[data-nper="${LW()}"]`)); await wait(120);
  a = snap(WEEK); click($(".w-oc-act summary")); await wait(120); b = snap(WEEK); diff("The week in detail: open Add it", a, b);
  click($(".w-oc-act summary")); await wait(60);
  const WORK = BAR.concat([".y-page", ".y-list", ".y-main", ".g-canvas", ".g-panel", ".a-ph"]);
  ((location.hash = "#chats"), 0); await wait(150);
  a = snap(WORK); click(document.querySelectorAll(".y-proj")[1]); await wait(120); b = snap(WORK); diff("Your work: project 1->2", a, b);
  a = snap(WORK); click($(`[data-nper="${TW()}"]`)); await wait(120); b = snap(WORK); diff("Your work: last->this week", a, b);
  click($(`[data-nper="${LW()}"]`)); await wait(120);
  const SET = BAR.concat([".a-page", ".a-stage", ".a-canvas", ".a-svg", ".a-panel", ".a-ph", ".a-step", ".a-strip"]);
  const PANEL = SET.concat([".a-viz", ".a-rings", ".a-tiles"]);
  click($('[data-go="screen:armory"]')); await wait(150);
  a = snap(SET); click($('[data-a="layer:skills"]')); await wait(120); b = snap(SET); diff("Setup: helpers->skills", a, b);
  a = snap(SET); click($('[data-a="layer:folder"]')); await wait(120); b = snap(SET); diff("Setup: skills->folder", a, b);
  a = snap(SET); click($('[data-a="tool:Codex"]')); await wait(120); b = snap(SET); diff("Setup: Claude Code->Codex", a, b);
  click($('[data-a="tool:Claude Code"]')); await wait(120); click($('[data-a="layer:skills"]')); await wait(120);
  a = snap(PANEL); click($(".a-shelf .a-tile")); await wait(120); b = snap(PANEL); diff("Setup: open a tile's details", a, b);
  a = snap(PANEL); click($('[data-a="filter:lit"]')); await wait(120); b = snap(PANEL); diff("Setup: filter by a ring", a, b);
  a = snap(PANEL); click($('[data-a="filter:never"]')); await wait(120); b = snap(PANEL); diff("Setup: filter never used", a, b);
  // Your AI's instructions: picking another project or opening a sheet moves nothing outside the picture
  const SHP = BAR.concat([".g-page", ".g-stage", ".g-canvas", ".g-panel", ".a-ph"]);
  ((location.hash = "#instructions"), 0); await wait(150);
  for (const app of ["Cowork", "Codex", "Claude Code"]) { const btn = $(`[data-w="s:app:${app}"]`); if (!btn) continue; a = snap(BAR.concat([".g-stage", ".g-panel"])); click(btn); await wait(120); b = snap(BAR.concat([".g-stage", ".g-panel"])); diff(`Your AI's instructions: to ${app}`, a, b); }
  const pj = document.querySelectorAll('[data-w^="s:proj:"]');
  if (pj.length > 1) { a = snap(SHP); click(pj[1]); await wait(120); b = snap(SHP); diff("Your AI's instructions: another project", a, b); }
  for (const id of ["main", "notes", "skills", "main"]) { const p = $(`.s-g .a-plate[data-w="s:plate:${id}"]`); if (!p) continue; a = snap(SHP); click(p); await wait(100); b = snap(SHP); diff(`What shapes Claude: pick ${id}`, a, b); }
  for (const k of ["memory", "fixes", "archive"]) { const pl = $(`.s-g .a-plate[data-w="s:plate:${k === "fixes" ? "main" : "notes"}"]`); if (pl) { click(pl); await wait(80); } const btn = $(`[data-w="s:sheet:${k}"]`); if (!btn) continue; a = snap(SHP); click(btn); await wait(120); b = snap(SHP); diff(`What shapes Claude: open the ${k} sheet`, a, b); click($('[data-w="s:close"]')); await wait(80); }
  a = snap(BAR); ((location.hash = "#limits"), 0); await wait(150); b = snap(BAR); diff("Bar: setup->this week", a, b);
  a = snap(BAR); ((location.hash = "#chats"), 0); await wait(150); b = snap(BAR); diff("Bar: this week->work", a, b);
  if ($('[data-nper="all"]')) { a = snap(BAR); click($('[data-nper="all"]')); await wait(150); b = snap(BAR); diff("Bar: work->all weeks", a, b); click($(`[data-nper="${TW()}"]`)); await wait(120); }
  // All weeks (release 2 QA, pattern D): picking a week, stepping, opening every limit stop and going back move nothing
  // but the panel's words; on Your work, the stage stands where it stands on This week, and a pick keeps the list's scroll
  if ($('[data-nper="all"]')) {
    const ALL = BAR.concat([".g-page", ".g-stage", ".g-canvas", ".h-svg", ".g-panel", ".a-ph", ".a-step", ".g-strip"]);
    ((location.hash = "#limits"), 0); await wait(150); click($('[data-nper="all"]')); await wait(200);
    const wk = () => document.querySelectorAll(".h-svg .h-week");
    a = snap(ALL); click(wk()[wk().length - 1]); await wait(120); b = snap(ALL); diff("All weeks: pick this week", a, b);
    a = snap(ALL); click($('[data-w="h:week:step:-1"]')); await wait(120); b = snap(ALL); diff("All weeks: Earlier", a, b);
    a = snap(ALL); click(wk()[0]); await wait(120); b = snap(ALL); diff("All weeks: pick the first week", a, b);
    if ($('[data-w="h:stops"]')) { a = snap(ALL); click($('[data-w="h:stops"]')); await wait(120); b = snap(ALL); diff("All weeks: every limit stop", a, b); a = snap(ALL); click($('[data-w="h:back"]')); await wait(120); b = snap(ALL); diff("All weeks: back from the stops", a, b); }
    a = snap(ALL); click($(".h-svg .h-week.sel")); await wait(120); b = snap(ALL); diff("All weeks: unpick, back to all weeks", a, b);
    const YW = BAR.concat([".g-page", ".g-stage", ".g-canvas", ".g-panel", ".a-ph"]);
    ((location.hash = "#chats"), 0); await wait(150); click($(`[data-nper="${TW()}"]`)); await wait(150);
    a = snap([".g-stage", ".g-panel"]); click($('[data-nper="all"]')); await wait(150); b = snap([".g-stage", ".g-panel"]);
    if (JSON.stringify(a[".g-stage"].map((r) => r[1])) !== JSON.stringify(b[".g-stage"].map((r) => r[1]))) out.push(`MOVED Your work: this week->all weeks: the stage's top ${JSON.stringify(a[".g-stage"])} -> ${JSON.stringify(b[".g-stage"])}`);
    const cv = $(".y-allpage .g-canvas"), rows = document.querySelectorAll(".y-allrow");
    if (cv && rows.length > 12) {
      cv.scrollTop = 200; cv.dispatchEvent(new Event("scroll")); const was = cv.scrollTop;
      a = snap(YW); click(rows[8]); await wait(120); b = snap(YW); diff("Your work, all weeks: pick a project", a, b);
      const now = $(".y-allpage .g-canvas").scrollTop; if (Math.abs(now - was) > 1) out.push(`MOVED Your work, all weeks: the list jumped from ${was}px to ${now}px on a pick`);
    }
    click($(`[data-nper="${TW()}"]`)); await wait(120);
  }
  out.push("ERR " + window.__err.join(" | "));
  const p = document.createElement("pre"); p.id = "stab"; p.textContent = out.join("\n"); document.documentElement.appendChild(p);
})();
