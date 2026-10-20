window.__err = [];
window.addEventListener("error", (e) => window.__err.push(e.message));
const R = [];
const ok = (name, cond, extra) => { R.push((cond ? "PASS " : "FAIL ") + name + (extra ? " :: " + extra : "")); let p = document.getElementById("live"); if (!p) { p = document.createElement("pre"); p.id = "live"; document.documentElement.appendChild(p); } p.textContent = R.join("\n") + "\nERR " + window.__err.join(" | "); };
// this week and last week, read from the switch, so the checks work in any week
const TW = () => document.querySelectorAll("[data-nper]")[0].dataset.nper, LW = () => document.querySelectorAll("[data-nper]")[1].dataset.nper;
const $ = (s) => document.querySelector(s);
const click = (el) => el && el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const key = (k, el) => (el || document.body).dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// the details card's arrow points at the middle of what was clicked
const level = (pk, el) => { if (!pk || !el) return false; const a = pk.querySelector(".a-peek-arrow").getBoundingClientRect(), r = el.getBoundingClientRect(); return Math.abs(a.top + a.height / 2 - (r.top + r.height / 2)) < 4; };
(async () => {
  try { localStorage.clear(); } catch (e) {}
  await wait(400);
  // Home's limit page (Gemini's turn 27): the limit chart and what used the limit, nothing about cost or setup
  const pickQ = async (k) => { click($(`[data-w="q:plate:${k}"]`)); await wait(80); };
  // the page opens on the app whose limit stopped you; these checks start from Claude's view
  if ($('[data-w="q:app:Claude"]') && $('[data-w="q:app:Claude"]').getAttribute("aria-pressed") !== "true") { click($('[data-w="q:app:Claude"]')); await wait(120); }
  ok("the limit page renders", !!$(".q-pace") && !$(".q-plan-b") && !$(".q-ch.standing") && !!$(".g-lead") && /limit/i.test($(".g-lead").textContent));
  ok("the panel shows the limit", !!$(".g-panel h3") && /weekly limit/.test($(".g-panel h3").textContent));
  ok("the strip says what the subagents did", !!$(".g-strip") && /subagent/i.test($(".g-strip").textContent));
  ok("no old decision cards on the front", !$(".w-dec") && !$(".w-strip"));
  if ($('[data-w="q:app:Codex"]')) {
    click($('[data-w="q:app:Codex"]')); await wait(100);
    ok("the limit page: Codex's view shows its own limit chart", /Codex's weekly limit/.test(($(".q-pace-b .q-h") || {}).textContent || "") && !$(".q-plan-b"));
    const stopRow = $('[data-w="q:plate:cx:stops"]');
    if (stopRow) { click(stopRow); await wait(80); ok("the limit page: Codex's stop item opens", /stopped you/.test(($(".g-panel h3") || {}).textContent || "")); }
    click($('[data-w="q:app:Claude"]')); await wait(100);
    ok("the limit page: Claude's view comes back, naming who shares its limit", /Claude's weekly limit/.test(($(".q-pace-b .q-h") || {}).textContent || "") && /share this limit/.test(($(".q-pace-b .q-h") || {}).textContent || ""));
  }
  click($(`[data-nper="${LW()}"]`)); await wait(80);
  for (const k of ["limit", "pace"]) {
    await pickQ("limit");
    const b = k === "pace" ? $(".q-switch") : $(`[data-w="q:sheet:${k}"]`);
    if (!b) { ok(`${k}: no change to prepare, and it says so`, /nothing to change|already asks/i.test($(`[data-q-card="${k}"] .q-act`).textContent)); continue; }
    click(b); await wait(80);
    ok(`sheet ${k} opens as a dialog`, !!$('.q-sheet[role="dialog"]') && !!$(".q-veil"));
    ok(`sheet ${k} takes the focus`, document.activeElement === $(".q-sheet h3"));
    if (k === "pace") ok("the warning sheet shows what the line looks like", document.querySelectorAll(".q-term > div").length === 3);
    if (k !== "carry") ok(`sheet ${k}: Make this change waits for the file-opened app`, !!$('[data-w="q:make"]') && (window.GB_DEMO || location.protocol === "file:" ? $('[data-w="q:make"]').disabled : true));
    ok(`sheet ${k} offers the request for Claude Code`, !!$('[data-w="q:copy"]') || k === "carry" || k === "pace");
    key("Escape"); await wait(60);
    ok(`Esc closes sheet ${k}`, !$(".q-sheet"));
  }
  await pickQ("limit"); const lb = $('[data-w="q:sheet:limit"]');
  if (lb) {
    click(lb); await wait(80);
    const items = document.querySelectorAll(".q-item"), on0 = document.querySelectorAll(".q-item.on").length;
    if (items.length) { click(items[0].querySelector("input")); await wait(60); ok("ticking a helper changes the change", document.querySelectorAll(".q-item.on").length !== on0, on0 + " -> " + document.querySelectorAll(".q-item.on").length); }
    click($(".q-x")); await wait(60); ok("the × closes it", !$(".q-sheet"));
  }
  const st = $('[data-w="q:sheet:stops"]'); if (st) { click(st); await wait(80); ok("the stops open", document.querySelectorAll(".q-sheet .q-list li").length > 0); click($(".q-veil")); await wait(60); ok("a click outside closes it", !$(".q-sheet")); }
  const nn = $('.q-card [data-snooze^="q:"]');
  if (nn) { const k = nn.dataset.snooze; click(nn); await wait(80); ok("Not now hides the prepared change", !$(`.q-card [data-snooze="${k}"]`) && !!$('[data-w^="q:unsnooze:"]'), k); }
  // three rooms (his call, Oct 19, night): the limit page is one level down from Home, with one way back, and nothing on it
  // leads into the week in detail or All weeks
  const lit = () => (($('#bar .tabs [aria-pressed="true"]') || {}).textContent || "").replace(/[A-Z]$/, "").trim();
  ok("the limit page lights Home", lit() === "Home", lit());
  ok("the limit page has one way back to Home", !!$('.q-crumb [data-go="screen:home"]'));
  ok("no way into the week in detail", !$('[data-w="q:detail"]'));
  ok("no All weeks on the week switch", !$('[data-nper="all"]'));
  click($(`[data-nper="${TW()}"]`)); await wait(80);
  ok("this week switch", $(`[data-nper="${TW()}"]`).getAttribute("aria-pressed") === "true");
  click($(`[data-nper="${LW()}"]`)); await wait(80);
  // Setup
  click($('[data-go="screen:armory"]')); await wait(150);
  ok("Setup lights its tab", lit() === "Setup", lit());
  click($('[data-a="layer:helpers"]')); await wait(60);
  ok("helpers layer selected", $(".a-panel h3") && $(".a-panel h3").textContent === "Subagents it calls in");
  const tl = $(".a-tile.t4") || $(".a-tile"); click(tl); await wait(100);
  ok("a subagent's details open in place", !!document.querySelector(".a-peek") && !!document.querySelector(".a-tile.on"));
  key("Escape"); await wait(60);
  ok("Esc closes the details", !document.querySelector(".a-peek"));
  // layers
  click($('[data-a="layer:connectors"]')); await wait(60);
  ok("layer click", $(".a-panel h3").textContent === "Connectors to other apps");
  click($('[data-a="step:1"]')); await wait(60);
  ok("layer above", $(".a-panel h3").textContent === "Your projects");
  key("ArrowDown"); await wait(60);
  ok("arrow down steps", $(".a-panel h3").textContent === "Connectors to other apps");
  for (const t of ["Cowork", "Codex", "Claude Code"]) { click($(`[data-a="tool:${t}"]`)); await wait(60); ok("tool " + t, $(".a-stage .w-mh h3").textContent.includes(t)); }
  const plate = document.querySelector('.a-plate[data-a="layer:folder"]'); plate.focus(); key("Enter", plate); await wait(60);
  ok("Enter on a layer", /^Its folder on your (Mac|computer)$/.test($(".a-panel h3").textContent));
  click($('[data-a="layer:projects"]')); await wait(60);
  const pr = $(".a-row button[data-nwork]"); const pw = pr && pr.dataset.nwork; click(pr); await wait(150);
  ok("a project opens in Work, with Work lit", location.hash === "#chats" && !!$(".wl-panel") && lit() === "Work", pw + " " + location.hash);
  for (const sc of ["home", "list", "armory", "progress"]) { const b = $(`[data-go="screen:${sc}"]`); if (!b) continue; click(b); await wait(120); ok("screen " + sc, $("#stage").innerHTML.length > 500); }
  // the older views' addresses open the room that holds what they showed
  for (const [h, want] of [["detail", "Home"], ["all-weeks", "Home"], ["work", "Work"], ["instructions", "Setup"], ["mission", "Home"]]) { location.hash = "#" + h; await wait(200); ok(`#${h} opens ${want}`, lit() === want, lit()); }
  ok("More holds only the design system and the demo", !document.querySelector(".more-list [data-go]"));
  key("s"); await wait(80); ok("key S", !!$(".a-page"));
  key("t"); await wait(80); ok("key T no longer opens an older view", !!$(".a-page"));
  // sorting and the steps on the drawing
  click($('[data-go="screen:armory"]')); await wait(100);
  click($('[data-a="layer:skills"]')); await wait(60);
  ok("ring key shows", document.querySelectorAll(".a-ring-leg .a-leg").length >= 3);
  const allRows = document.querySelectorAll(".a-row").length;
  click($('[data-a="filter:never"]')); await wait(60);
  ok("never used filter", [...document.querySelectorAll(".a-row")].every((r) => r.classList.contains("none")), document.querySelectorAll(".a-row").length + " rows");
  click($('[data-a="filter:never"]')); await wait(60);
  ok("same key again shows all", document.querySelectorAll(".a-row").length === allRows);
  click($(".a-ring-g.amt")); await wait(60);
  ok("a ring filters the list", $(".a-leg.amt").getAttribute("aria-pressed") === "true" && [...document.querySelectorAll(".a-row")].every((r) => !r.classList.contains("none")), document.querySelectorAll(".a-row").length + " rows");
  ok("other rings fade", !!document.querySelector(".a-ring-g.off"));
  click($('[data-a="filter:all"]')); await wait(60);
  ok("show all", document.querySelectorAll(".a-row").length === allRows);
  ok("so-what line", !!$(".a-insight"));
  ok("rings and tiles on skills", !!$(".a-rings") && document.querySelectorAll(".a-tile").length > 20);
  const tile = document.querySelector(".a-shelf .a-tile.t4") || document.querySelector(".a-shelf .a-tile.t3"); const tname = tile && tile.dataset.a.slice(5);
  const pTop = $(".a-panel").scrollTop; click(tile); await wait(80);
  const pk = $(".a-peek"), on = $(".a-tile.on");
  ok("a tile opens its details beside it, pointing at it", level(pk, on), tname);
  ok("and covers nothing in the panel", !!pk && pk.getBoundingClientRect().right <= $(".a-panel").getBoundingClientRect().left);
  ok("and the panel doesn't scroll", $(".a-panel").scrollTop === pTop);
  click($(".a-peek-x")); await wait(60);
  ok("the details close", !$(".a-peek"));
  click($('[data-a="layer:connectors"]')); await wait(80);
  ok("connectors show what each can do", document.querySelectorAll(".a-cd-r").length > 3);
  click(document.querySelectorAll(".a-cd-r")[1]); await wait(80);
  ok("a connector's details open beside it", level($(".a-peek"), $(".a-cd-r.on")));
  click($(".a-panel h3")); await wait(60);
  ok("a click elsewhere closes them", !$(".a-peek"));
  click($('[data-a="layer:skills"]')); await wait(60);
  click($('.a-step [data-a="step:-1"]')); await wait(60);
  ok("layer below, in the panel header", $(".a-panel h3").textContent === "Subagents it calls in");
  click($('.a-step [data-a="step:1"]')); await wait(60);
  ok("layer above, in the panel header", $(".a-panel h3").textContent === "Skills");
  ok("nothing sits on the drawing", !$(".a-canvas .w-btn"));
  // the receipt, one level down from Home, with one way back
  click($('[data-go="screen:home"]')); await wait(150); click($('[data-h="open:cost"]')); await wait(150);
  ok("the receipt lights Home and has one way back", lit() === "Home" && !!$('.r-crumb [data-r="home"]'), lit());
  if (!window.GB_DEMO && $('[data-r^="sel:perk"]')) ok("the API credits say where to claim and check them", document.querySelectorAll('.r-links a[href^="https://"]').length >= 2);
  const tabsW = $(".tabs").getBoundingClientRect().width; click($(`[data-nper="${TW()}"]`)); await wait(80);
  ok("tabs keep their size", Math.abs($(".tabs").getBoundingClientRect().width - tabsW) < 1);
  click($(`[data-nper="${LW()}"]`)); await wait(80);
  // Work: the smaller-model change opens over Work and closes back to it
  click($('[data-go="screen:list"]')); await wait(150);
  ok("Work lights its tab", lit() === "Work", lit());
  const fx0 = $('[data-wl="fix"]');
  if (fx0) { click(fx0); await wait(120); ok("the smaller-model change opens over Work", !!$(".q-sheet") && location.hash === "#chats"); key("Escape"); await wait(80); ok("Esc closes it and stays on Work", !$(".q-sheet") && location.hash === "#chats"); }
  // the home: a thing worth a look that is a change opens over the home
  click($('[data-go="screen:home"]')); await wait(150);
  const lk = $('[data-h="look:limit"]') || $('[data-h="look:reach"]') || $('[data-h="look:carry"]');
  if (lk) { click(lk); await wait(120); ok("a change worth a look opens over the home", !!$(".q-sheet") && location.hash === "#home"); key("Escape"); await wait(80); ok("Esc closes it on the home", !$(".q-sheet")); }
  // slice 2: how Claude writes, from the home's Worth a look; answers tick the rules they point to
  click($('[data-go="screen:home"]')); await wait(150);
  const wl = $('[data-h="look:writing"]');
  ok("the home offers the writing questions only when Claude wrote 100,000 words or more last week", !!wl === (() => { const d = new Date(window.GB.week_start + "T12:00:00"); d.setDate(d.getDate() - 7); const lw = d.toISOString().slice(0, 10); return Math.round(((((((window.GB.machine || {}).receipt || {})[lw] || {}).tools || {})["Claude Code"] || {}).out || 0) * 0.75) >= 100000; })(), [...document.querySelectorAll('[data-h^="look:"]')].map((e) => e.dataset.h).join(","));
  if (wl) { try { localStorage.removeItem("gb:writing:" + window.GB.week_start); } catch (e) {} click(wl); await wait(150);
    ok("the writing questions open over the home", !!$(".q-sheet") && document.querySelectorAll(".q-ask").length === 3 && location.hash === "#home");
    click($('[data-w="q:ans:files:few"]')); await wait(120);
    ok("an answer ticks the rule it points to", document.querySelectorAll(".q-sheet .q-item.on").length === 1);
    ok("Make this change waits for the file-opened app", !!$('[data-w="q:make"]') && (window.GB_DEMO || location.protocol === "file:" ? $('[data-w="q:make"]').disabled : true));
    key("Escape"); await wait(80); ok("Esc closes the writing questions", !$(".q-sheet")); }
  // slice 2: the before-reset card can be previewed from the limit page at any time
  location.hash = "#limits"; await wait(250);
  if ($('[data-w="q:br"]')) { click($('[data-w="q:br"]')); await wait(150); ok("the before-reset card previews on the limit page", !!$(".q-br") && /resets/.test($(".q-br").textContent)); click($('[data-w="q:br"]')); await wait(120); ok("the preview hides again", !$(".q-br")); }
  ok("demo band only in the demo", !!window.GB_DEMO === !!document.getElementById("demoband"));
  // no click path from a room into an older view
  const OLDSEL = '[data-go="screen:note"],[data-go="screen:machine"],[data-go="screen:shapes"],[data-go="screen:mission"],[data-go="screen:weeks"],[data-go^="work:"],[data-go^="week:"],[data-w="q:detail"],[data-nper="all"]';
  let found = 0;
  for (const sc of ["home", "list", "armory"]) { click($(`[data-go="screen:${sc}"]`)); await wait(120); found += document.querySelectorAll(OLDSEL).length; }
  click($('[data-go="screen:home"]')); await wait(120); click($('[data-h="open:cost"]')); await wait(120); found += document.querySelectorAll(OLDSEL).length;
  ok("no click path into an older view", found === 0, found + " found");
  // Setup's rule files: what Claude reads, the numbered things worth fixing, and the fixes sheet over Setup
  click($('[data-go="screen:armory"]')); await wait(150); click($('[data-a="tool:Claude Code"]')); await wait(60); click($('[data-a="layer:instructions"]')); await wait(100);
  ok("the rule files say what Claude reads before the first message", /What Claude reads before your first message/.test($(".a-panel").textContent) || !window.GB.shapes);
  const fxs = $('[data-w="s:sheet:fixes"]');
  if (fxs) { click(fxs); await wait(120); ok("the fixes sheet opens over Setup and takes the focus", !!$(".q-sheet") && document.activeElement === $("#s-sheet-h") && location.hash === "#setup"); key("Escape"); await wait(80); ok("Esc closes the fixes sheet", !$(".q-sheet")); }
  ok("no script errors", window.__err.length === 0, window.__err.join(" | "));
  const pre = document.createElement("pre"); pre.id = "results"; pre.textContent = R.join("\n"); document.body.appendChild(pre);
})().catch((e) => { const pre = document.createElement("pre"); pre.id = "results"; pre.textContent = R.join("\n") + "\nCRASH " + e.stack; document.body.appendChild(pre); });
