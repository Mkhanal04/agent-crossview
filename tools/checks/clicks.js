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
  // Oct 15: the limit as a pace chart, his plans, what changed this week and what's set up all week, as rows; the picked one in the panel
  const pickQ = async (k) => { click($(`[data-w="q:plate:${k}"]`)); await wait(80); };
  ok("the week's picture renders", !!$(".q-pace") && !!$(".q-plan-b") && document.querySelectorAll(".q-row").length >= 2 && !!$(".g-lead") && $(".g-lead").textContent.trim().length > 20);
  ok("the panel shows the picked item", !!$(".g-panel h3") && !!$(".g-panel .a-line, .g-panel .q-a") && $(".g-panel .a-line, .g-panel .q-a").textContent.trim().length > 10);
  ok("the strip says what the subagents did", !!$(".g-strip") && /subagent/i.test($(".g-strip").textContent));
  ok("no old decision cards on the front", !$(".w-dec") && !$(".w-strip"));
  await pickQ("limit"); const ch0 = $(".a-chip").textContent; key("ArrowDown"); await wait(80);
  ok("the down arrow moves to the next item", $(".a-chip").textContent !== ch0 && !$(".q-pace-b.sel"), ch0 + " -> " + $(".a-chip").textContent);
  const ch1 = $(".a-chip").textContent; click($('[data-w="q:plate:step:1"]')); await wait(80); ok("Below moves down", $(".a-chip").textContent !== ch1);
  // one app at a time (release 1): Codex's view has its own chart, changes and plan, and Claude's comes back
  if ($('[data-w="q:app:Codex"]')) {
    click($('[data-w="q:app:Codex"]')); await wait(100);
    ok("Your week: Codex's view shows its own limit chart and plan", /Codex's weekly limit/.test(($(".q-pace-b .q-h") || {}).textContent || "") && /Your plan for Codex/.test(($(".q-plan-b") || {}).textContent || ""));
    ok("Your week: Codex's view says what Glass Box can't see", /can't see which subagents or connectors Codex used/.test(($(".q-ch") || {}).textContent || ""));
    click($('[data-w="q:plate:plan"]')); await wait(80); ok("Your week: Codex's plan opens in the panel", /right plan for Codex/.test(($(".g-panel h3") || {}).textContent || ""));
    const stopRow = $('[data-w="q:plate:cx:stops"]');
    if (stopRow) { click(stopRow); await wait(80); ok("Your week: Codex's stop item opens", /stopped you/.test(($(".g-panel h3") || {}).textContent || "")); }
    click($('[data-w="q:plate:limit"]')); await wait(60); const c0 = ($(".a-chip") || {}).textContent; click($('[data-w="q:plate:step:1"]')); await wait(80);
    ok("Your week: Below moves through Codex's items", ($(".a-chip") || {}).textContent !== c0, c0 + " -> " + (($(".a-chip") || {}).textContent));
    click($('[data-w="q:app:Claude"]')); await wait(100);
    ok("Your week: Claude's view comes back, naming who shares its limit", /Claude's weekly limit/.test(($(".q-pace-b .q-h") || {}).textContent || "") && /share this limit/.test(($(".q-pace-b .q-h") || {}).textContent || ""));
  }
  click($(`[data-nper="${LW()}"]`)); await wait(80);
  for (const k of ["limit", "reach", "carry", "pace"]) {
    await pickQ(k === "pace" ? "limit" : k);
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
  click($('[data-w="q:detail"]')); await wait(150);
  ok("the week in detail opens", !!$(".w-strip") && !!$(".w-board") && !!$(".q-back"));
  ok("strip has two gauges", document.querySelectorAll(".w-gauge").length === 2);
  ok("week line has 7 days", document.querySelectorAll(".w-day").length === 7);
  ok("apps shown", document.querySelectorAll(".w-app").length === 3);
  const nh = document.querySelectorAll(".w-helper").length; ok("helpers shown", nh > 0, nh + " helpers");
  await wait(100);
  const nw = document.querySelectorAll(".w-wire").length; ok("wires drawn", nw > 0, nw + " wires");
  ok("sankey drawn", !!$(".w-sankey") && document.querySelectorAll(".w-band").length > 0);
  click($('[data-w="q:front"]')); await wait(100);
  ok("back to the week's picture", !!$(".q-pace"));
  click($('[data-w="q:detail"]')); await wait(120);
  click($(`[data-nper="${TW()}"]`)); await wait(80);
  ok("this week switch", $(`[data-nper="${TW()}"]`).getAttribute("aria-pressed") === "true", $(".w-agents .w-mh h3") && $(".w-agents .w-mh h3").textContent);
  click($(`[data-nper="${LW()}"]`)); await wait(80);
  // helper -> anatomy
  const h = $(".w-helper.on"); const ht = h && h.dataset.whelper;
  click(h); await wait(120);
  ok("helper opens Your setup", !!$(".a-page"), ht);
  ok("helpers layer selected", $(".a-panel h3") && $(".a-panel h3").textContent === "Subagents it calls in");
  ok("that helper's details open in place", !!document.querySelector(".a-peek") && !!document.querySelector(".a-tile.on"), ht);
  ok("its row is marked, not scrolled to", !!document.querySelector(".a-row.picked") && $(".a-panel").scrollTop === 0);
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
  const pr = $(".a-row button[data-nwork]"); const pw = pr && pr.dataset.nwork; click(pr); await wait(120);
  ok("project opens Your work or its full page", (location.hash === "#work" && !!document.querySelector(".y-page")) || location.hash.startsWith("#work") || (location.hash === "#all-projects" && !!document.querySelector(".y-allpage")), pw + " " + location.hash);
  // a project that didn't run this week opens across all weeks; the switch stays on All weeks until you pick a week
  click($('[data-go="screen:note"]')); await wait(120);
  if ($('[data-nper="all"][aria-pressed="true"]')) { ok("the switch shows All weeks after opening an older project", !!$(".h-svg")); click($(`[data-nper="${window.GB.week_start}"]`)); await wait(120); }
  ok("tab back to Your week shows its picture", !!$(".q-pace"));
  click($('[data-w="q:detail"]')); await wait(120);
  click($(".w-app.on")); await wait(100);
  ok("app opens its anatomy", $(".a-panel h3") && $(".a-panel h3").textContent === "The chat you type in");
  click($('[data-go="screen:note"]')); await wait(100); click($('[data-w="q:detail"]')); await wait(120);
  const sk = $(".w-sk-a"); click(sk); await wait(100);
  ok("sankey work opens Your work", !!document.querySelector(".y-page"));
  click($('[data-go="screen:note"]')); await wait(100); click($('[data-w="q:detail"]')); await wait(120);
  click($('.w-door[data-go="screen:armory"]')); await wait(100);
  ok("door to setup", !!$(".a-page"));
  for (const sc of ["progress", "machine", "note", "armory"]) { const b = $(`[data-go="screen:${sc}"]`); if (!b) continue; click(b); await wait(100); ok("screen " + sc, $("#stage").innerHTML.length > 500); }
  // All weeks (release 2): the third choice on the week switch, on Your week and Your work; Mission control and By week are gone
  click($('[data-go="screen:note"]')); await wait(100);
  if ($('[data-nper="all"]')) {
    click($('[data-nper="all"]')); await wait(150);
    ok("All weeks: Your week shows every week", !!$(".h-svg") && document.querySelectorAll(".h-week").length >= 1 && !!$(".g-lead"));
    const wk0 = ($(".g-panel h3") || {}).textContent, bars = document.querySelectorAll(".h-week"); if (bars.length > 1) { click(bars[0]); await wait(100); ok("All weeks: picking a week opens it in the panel", ($(".g-panel h3") || {}).textContent !== wk0); }
    const st = $('[data-w="h:stops"]'); if (st) { click(st); await wait(80); ok("All weeks: every limit stop opens", /Every time a limit stopped you/.test(($(".g-panel h3") || {}).textContent || "")); click($('[data-w="h:back"]')); await wait(60); }
    click($('[data-go="screen:machine"]')); await wait(150);
    ok("All weeks: Your work lists every project", document.querySelectorAll(".y-allrow").length >= 1);
    const r2 = document.querySelectorAll(".y-allrow")[1]; if (r2) { click(r2); await wait(80); ok("All weeks: picking a project shows its chats", !!$(".y-chats-list")); }
    click($('[data-nper="' + (window.GB.week_start) + '"]')); await wait(100);
    ok("All weeks: This week comes back", !$(".y-allpage") && !$(".h-svg"));
  }
  ok("More holds only the design system and the demo", !document.querySelector('.more-list [data-go="screen:mission"], .more-list [data-go="screen:weeks"], .more-list [data-go="screen:progress"]'));
  key("t"); await wait(80); ok("key T", !!$(".q-pace"));
  key("s"); await wait(80); ok("key S", !!$(".a-page"));
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
  click($('[data-go="screen:note"]')); await wait(100); click($('[data-w="q:detail"]')); await wait(120);
  ok("per-use shown on receipt", !!$(".w-r-peruse"));
  ok("other costs listed", document.querySelectorAll(".w-oc").length > 0, document.querySelectorAll(".w-oc").length + " services");
  const tabsW = $(".tabs").getBoundingClientRect().width; click($(`[data-nper="${TW()}"]`)); await wait(80);
  ok("tabs keep their size", Math.abs($(".tabs").getBoundingClientRect().width - tabsW) < 1);
  const rowH = $(".w-row").getBoundingClientRect().height; click($(`[data-nper="${LW()}"]`)); await wait(80);
  ok("main row keeps its height", Math.abs($(".w-row").getBoundingClientRect().height - rowH) < 2, Math.round(rowH) + " vs " + Math.round($(".w-row").getBoundingClientRect().height));
  // Your work
  click($('[data-go="screen:machine"]')); await wait(150);
  ok("your work renders", !!$(".y-page") && !!$(".y-board"));
  await wait(60);
  ok("your work wires", document.querySelectorAll(".y-wires path").length > 0, document.querySelectorAll(".y-wires path").length + " paths");
  const second = document.querySelectorAll(".y-proj")[1]; const sn = second && second.dataset.w.slice(12);
  click(second); await wait(80);
  ok("pick another project", $(".y-main .w-mh h3").textContent.startsWith(sn.replace("Not sure yet", "Not grouped yet")), sn);
  const mb = $(".y-more"); if (mb) { const n = document.querySelectorAll(".y-proj").length; click(mb); await wait(60); ok("more projects", document.querySelectorAll(".y-proj").length > n); }
  click($(`[data-nper="${TW()}"]`)); await wait(80); ok("your work this week", !!$(".y-page"));
  click($(`[data-nper="${LW()}"]`)); await wait(80);
  click(document.querySelectorAll(".y-proj")[0]); await wait(80);
  // Oct 14: a click opens its details in place; "Open in Your setup" goes on from there
  const yp = $(".y-port"); click(yp); await wait(100);
  ok("connector details open in place", !!$(".y-peek") && !!$(".y-page"));
  key("Escape"); await wait(60); ok("Esc closes them", !$(".y-peek"));
  click($(".y-port")); await wait(100); click($(".y-pk-go")); await wait(100);
  ok("connector opens Your setup", $(".a-panel h3") && $(".a-panel h3").textContent === "Connectors to other apps");
  click($('[data-go="screen:machine"]')); await wait(120);
  click($(".y-board .w-helper.on")); await wait(100);
  ok("subagent details open in place", !!$(".y-peek"));
  click($(".y-pk-go")); await wait(100);
  ok("helper opens Your setup", $(".a-panel h3") && $(".a-panel h3").textContent === "Subagents it calls in");
  click($('[data-go="screen:machine"]')); await wait(120);
  if (window.GB_DEMO) ok("the demo has no full-receipt page", !$(".y-full"));
  else { if (!$(".y-full")) { key("Escape"); await wait(80); } click($(".y-full")); await wait(150); ok("full receipt opens", (location.hash.startsWith("#work") || location.hash === "#all-projects") && $("#stage").innerHTML.length > 500, location.hash); }
  if ($('[data-nper="all"][aria-pressed="true"]')) { ok("every chat in a project opens on All weeks", !!$(".y-allpage")); click($(`[data-nper="${window.GB.week_start}"]`)); await wait(120); }
  click($('[data-go="screen:note"]')); await wait(120); click($('[data-w="q:detail"]')); await wait(120);
  const nk = $(".w-sk-a"); const nwName = nk && nk.dataset.nwork; click(nk); await wait(150);
  ok("front door project opens it", $(".y-main .w-mh h3") && $(".y-main .w-mh h3").textContent.startsWith(nwName), nwName);
  ok("demo band only in the demo", !!window.GB_DEMO === !!document.getElementById("demoband"));
  if (window.GB_DEMO) {  // the demo shows only the redesigned screens: no way into the older pages
    const OLDSEL = '[data-go="screen:mission"],[data-go="screen:weeks"],[data-go="screen:progress"],[data-go^="work:"],[data-go^="week:"]';
    let found = 0;
    for (const sc of ["note", "machine", "armory"]) { click($(`[data-go="screen:${sc}"]`)); await wait(100); found += document.querySelectorAll(OLDSEL).length; }
    ok("no links to the older pages in the demo", found === 0, found + " found");
    key("w"); await wait(100);
    ok("the W key doesn't open By week in the demo", !$(".screen h2") || !/by week/i.test($(".screen h2").textContent));
  }
  // What shapes Claude (task 24)
  click($('[data-go="screen:shapes"]')); await wait(150);
  // Oct 14 (task 33): what Claude reads as a stack of plates; the picked plate's findings in the panel
  const pickS = async (id) => { const p = $(`.s-g .a-plate[data-w="s:plate:${id}"]`); if (p) { click(p); await wait(80); } return !!p; };
  for (const app of ["Codex", "Cowork", "Claude Code"]) {
    const btn = $(`[data-w="s:app:${app}"]`); if (!btn) { ok(`instructions: the ${app} switch exists`, false); continue; }
    click(btn); await wait(100);
    ok(`instructions: ${app} picked shows its own page`, app === "Codex" ? /What Codex reads/.test(($(".g-stage h3") || {}).textContent || "") && document.querySelectorAll(".s-g .a-plate").length === 6 : app === "Cowork" ? /can't read what Cowork reads/.test(($(".g-lead") || {}).textContent || "") : /What Claude Code reads/.test(($(".g-stage h3") || {}).textContent || ""));
  }
  ok("Your AI's instructions is the tab's name", /Your AI's instructions/.test(($('[data-go="screen:shapes"]') || {}).textContent || ""));
  ok("Your AI's instructions renders", !!$(".s-g") && document.querySelectorAll(".s-g .a-plate").length >= 6 && !!$(".g-lead"), document.querySelectorAll(".s-g .a-plate").length + " plates");
  const hasNotes = await pickS("notes");
  ok("Claude's notes carry the folder switch", !hasNotes || !!$(".s-flow") || /no chat has switched/i.test($('[data-s-card="memory"]') ? $('[data-s-card="memory"]').textContent : ""));
  await pickS("main"); const sc0 = $(".a-chip").textContent; key("ArrowDown"); await wait(80); ok("the down arrow moves to the next plate", $(".a-chip").textContent !== sc0, sc0 + " -> " + $(".a-chip").textContent);
  for (const k of ["memory", "fixes", "archive"]) {
    await pickS(k === "fixes" ? "main" : "notes");
    const b = $(`[data-w="s:sheet:${k}"]`); if (!b) continue;
    click(b); await wait(80);
    ok(`shapes sheet ${k} opens and takes the focus`, !!$(".q-sheet") && document.activeElement === $("#s-sheet-h"));
    key("Escape"); await wait(60); ok(`Esc closes shapes sheet ${k}`, !$(".q-sheet"));
  }
  await pickS("notes"); const ab = $('[data-w="s:sheet:archive"]');
  if (ab) { click(ab); await wait(80); const on0 = document.querySelectorAll(".q-item.on").length, box = $('.q-item input[data-w^="s:pick:"]'); click(box); await wait(60); ok("ticking a notes folder changes the change", document.querySelectorAll(".q-item.on").length !== on0); click($('[data-w="s:close"]')); await wait(60); }
  const pj = document.querySelectorAll('[data-w^="s:proj:"]');
  if (pj.length > 1) { const before = $(".s-proj summary b").textContent; click(pj[1]); await wait(100); ok("pick another project", $(".s-proj summary b").textContent !== before, before + " -> " + $(".s-proj summary b").textContent); }
  key("t"); await wait(80); key("c"); await wait(100); ok("key C opens it", !!$(".s-g"));
  click($('[data-go="screen:note"]')); await wait(100);
  ok("no script errors", window.__err.length === 0, window.__err.join(" | "));
  const pre = document.createElement("pre"); pre.id = "results"; pre.textContent = R.join("\n"); document.body.appendChild(pre);
})().catch((e) => { const pre = document.createElement("pre"); pre.id = "results"; pre.textContent = R.join("\n") + "\nCRASH " + e.stack; document.body.appendChild(pre); });
