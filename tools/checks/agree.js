// Counts that show on more than one screen agree, and a connector is orange only when its setup lets it act as you
// (camera fix batch, Oct 15: docs/plan-2026-10-15-camera-fixes.md). One AGREE line per check, a FAIL line for each problem.
window.__err = []; window.addEventListener("error", (e) => window.__err.push(e.message));
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)], wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (el) => el && el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const num = (s) => +String(s || "").replace(/,/g, "").match(/\d+/)?.[0] || 0;
const out = [];
const ok = (cond, good, bad) => out.push(cond ? `AGREE ${good}` : `FAIL ${bad}`);
(async () => {
  await wait(400);
  const G = window.GB || {}, M = G.machine || { periods: {}, apps: {}, ports: [] };
  const weeks = Object.keys(M.periods || {}).filter((k) => k !== "all").sort().slice(-2);

  // 1. chats: the projects' chats with each app add up to the week in detail's count for that app
  for (const per of weeks) {
    const sum = {};
    Object.values(M.periods[per] || {}).forEach((t) => Object.entries(t.app_sessions || {}).forEach(([a, n]) => (sum[a] = (sum[a] || 0) + n)));
    Object.entries((M.apps || {})[per] || {}).forEach(([a, x]) => {
      if (!x || x.sessions == null) return;
      ok((sum[a] || 0) === x.sessions, `chats with ${a}, week of ${per}: ${x.sessions} on both screens`, `chats with ${a}, week of ${per}: Your work's projects add up to ${sum[a] || 0}, the week in detail says ${x.sessions}`);
    });
  }

  // 2. subagent runs: the limit page's line agrees with Work's chats (the records behind the work list), this week and last
  for (const per of weeks.slice().reverse()) {
    ((location.hash = "#limits"), 0); await wait(150); click($(`[data-nper="${per}"]`)); await wait(200);
    const line = $$("#stage .g-strip").map((e) => e.innerText).join(" "), m = line.match(/ran ([\d,]+) times? (this|last) week/);
    const runs = ((M.chats || {})[per] || []).filter((c) => c.tool !== "Codex").reduce((a, c) => a + c.helpers.reduce((x, h) => x + h.runs, 0), 0);
    if (m) ok(runs === num(m[1]), `subagent runs, week of ${per}: ${num(m[1])} on the limit page and across Work's chats`, `subagent runs, week of ${per}: the limit page says ${num(m[1])}, Work's chats add up to ${runs}`);
    else out.push(`AGREE subagent runs, week of ${per}: none ran`);
  }
  ((location.hash = "#limits"), 0); await wait(150); click($(`[data-nper="${weeks[weeks.length - 1]}"]`)); await wait(200);

  // 3. "Yours" in Your setup: the ring's count is the sum of the "Yours" shelves, for skills and subagents
  click($('[data-go="screen:armory"]')); await wait(200);
  for (const layer of ["skills", "helpers"]) {
    click($(`[data-a="layer:${layer}"]`)); await wait(200);
    const ring = $$(".a-leg").find((e) => /^Made by you, (used|ran)$/.test(((e.querySelector("span") || {}).textContent || "").trim()));
    const shelves = $$(".a-shelf-h").filter((h) => /^Made by you\b/.test(h.innerText.trim()));
    if (!ring || !shelves.length) { out.push(`AGREE "Yours" in ${layer}: nothing of yours to count`); continue; }
    const of = ((ring.querySelector("b") || {}).textContent || "").match(/(\d+)\s*of\s*(\d+)/);
    const used = shelves.reduce((x, h) => x + num((h.innerText.match(/(\d+) of/) || [])[1]), 0), total = shelves.reduce((x, h) => x + num((h.innerText.match(/of (\d+)/) || [])[1]), 0);
    ok(of && +of[1] === used && +of[2] === total, `"Yours" in ${layer}: ${used} of ${total} in the ring and the shelves`, `"Yours" in ${layer}: the ring says ${of ? of[1] + " of " + of[2] : "nothing"}, the shelves add up to ${used} of ${total}`);
  }

  // 4. Claude's chart carries no Codex stop
  ((location.hash = "#limits"), 0); await wait(200);
  if ($('[data-w="q:app:Claude"]')) { click($('[data-w="q:app:Claude"]')); await wait(150); }  // the page can open on Codex
  const chart = $(".q-pace");
  ok(!chart || !/Codex/.test(chart.textContent), "Claude's chart shows only Claude's limits", "Claude's chart names Codex");

  // 5. a connector is orange (acts as you) only when its setup reaches your own browser or your screen
  const wrong = (M.ports || []).filter((p) => p.as_you && !["your_browser", "screen"].includes(p.reach));
  ok(!wrong.length, "orange connectors all reach your own browser or screen", `orange without a setup that acts as you: ${wrong.map((p) => p.name).join(", ")}`);
  const builtIn = (M.ports || []).filter((p) => p.built_in && p.as_you);
  ok(!builtIn.length, "the Claude app's own tools aren't marked as a connector that acts as you", "a built-in tool is marked as acting as you");

  // 6. orange means one thing (release 3): the home's "N connectors can act for you" and Setup's "can send, delete or
  // act as you" count are the same number, and it's the number of orange rows in Setup's connector table
  click($('[data-go="screen:home"]')); await wait(200);
  const homeOut = (($("#stage").innerText.match(/(\d+) connectors? can act for you/) || [])[1]) || ((/None can act for you/.test($("#stage").innerText)) ? "0" : undefined);
  click($('[data-go="screen:armory"]')); await wait(200); click($('[data-a="layer:connectors"]')); await wait(200);
  const setupOut = (($("#stage").innerText.match(/Can act for you\s*(\d+)/) || [])[1]);
  const rowsOut = String([...document.querySelectorAll(".a-cd-r")].filter((r) => r.querySelector("i.hot")).length);
  ok(homeOut === setupOut && setupOut === rowsOut, `"can act for you": ${setupOut || "none"} on the home, in Setup and in its orange rows`, `orange count: the home says ${homeOut || "none"}, Setup says ${setupOut || "none"}, Setup's table has ${rowsOut} orange rows`);
  // 7. orange in Your setup's connector grid follows the one rule: sends, deletes or acts as you outside the Mac
  const byName = {};
  (M.ports || []).filter((p) => !p.built_in).forEach((p) => { const m = (byName[p.name] = byName[p.name] || { as_you: false, outside: false, kinds: new Set() }); m.as_you = m.as_you || p.as_you; m.outside = m.outside || p.outside; (p.kinds || []).forEach((k) => m.kinds.add(k)); });
  const hotRule = (n) => { const m = byName[n]; return !!m && (m.as_you || (m.outside && (m.kinds.has("send") || m.kinds.has("delete")))); };
  const badDots = $$(".a-cd-r").filter((r) => !!r.querySelector("i.hot") !== hotRule((r.querySelector("b") || {}).innerText.trim())).map((r) => r.querySelector("b").innerText.trim());
  ok(!badDots.length, "orange dots in Your setup's connector grid follow the one rule", `orange dots break the rule for: ${badDots.join(", ")}`);
  // 8. Your setup's subagents line counts "made by you" the way its ring does
  click($('[data-a="layer:helpers"]')); await wait(200);
  const sub = (($("#stage").innerText.match(/(\d+) made by you/) || [])[1]), ringB = ($$(".a-leg").find((e) => /^Made by you, ran$/.test(((e.querySelector("span") || {}).textContent || "").trim())) || {}).querySelector;
  const ringOf = ringB ? ((($$(".a-leg").find((e) => /^Made by you, ran$/.test(e.querySelector("span").textContent.trim())).querySelector("b").textContent).match(/of (\d+)/) || [])[1]) : null;
  if (sub || ringOf) ok(sub === ringOf, `"made by you" subagents: ${sub} in the line and the ring`, `"made by you" subagents: the line says ${sub}, the ring says ${ringOf}`);
  // 10. every tab answers for every app (release 1): Your week and Your AI's instructions have a switch for each app with data
  const apps = new Set(); Object.values(M.apps || {}).forEach((a) => Object.keys(a || {}).forEach((k) => apps.add(k)));
  ((location.hash = "#limits"), 0); await wait(150);
  ok(!apps.has("Codex") || !!$('[data-w="q:app:Codex"]'), "Your week has a Codex view", "Your week has no Codex view, though Codex has data");
  ((location.hash = "#setup"), 0); await wait(150);
  ok(["Claude Code", "Cowork", "Codex"].every((a) => !!$(`[data-a="tool:${a}"]`)), "Setup has a view for each app", "Setup is missing an app");

  // 11. the week in detail's Codex dials agree with Codex's chart readings for the same week (release 1 QA, finding 3)
  if ((M.codex_plan || {}).readings && $('[data-go="screen:note"]')) {
    for (const per of weeks) {
      ((location.hash = "#limits"), 0); await wait(120); click($(`[data-nper="${per}"]`)); await wait(120);
      const sw = $('[data-w="q:app:Codex"]'); if (!sw) break;
      click(sw); await wait(120); click($('[data-w="q:detail"]')); await wait(200);
      const R = M.codex_plan.readings.filter((r) => r[0].slice(0, 10) >= per && r[0].slice(0, 10) <= new Date(new Date(per + "T12:00").getTime() + 6 * 864e5).toISOString().slice(0, 10));
      const dial = ($$(".w-gauge b").map((b) => b.textContent).find((t) => /Codex weekly/.test(t)) || "");
      const shown = (dial.match(/(\d+)%/) || [])[1];
      if (R.length) { const want = per === weeks[weeks.length - 1] && G.today >= per ? Math.round(R[R.length - 1][1]) : Math.round(Math.max(...R.map((r) => r[1] || 0))); ok(String(want) === shown, `Codex's weekly dial, week of ${per}: ${want}% in the detail and the readings`, `Codex's weekly dial, week of ${per}: the detail says ${shown || "nothing"}, the readings say ${want}%`); }
      click($('[data-w="q:app:Claude"]') || document.body); await wait(60);
      const back = $('[data-w="q:front"]'); if (back) { click(back); await wait(120); }
      const cl = $('[data-w="q:app:Claude"]'); if (cl) { click(cl); await wait(80); }
    }
  }

  // 12. All weeks: the marks add up to the strip's count of stops, and the strip's chats are every chat (release 2)
  ((location.hash = "#limits"), 0); await wait(120);
  if ($('[data-nper="all"]')) {
    click($('[data-nper="all"]')); await wait(200);
    const marks = $$(".h-svg .h-week").reduce((a, g) => { const n = g.querySelectorAll(".h-stop, .h-stop-cx").length, c = [...g.querySelectorAll(".h-count")].reduce((x, t) => x + (Number(t.textContent) - 1), 0); return a + n + c; }, 0);
    const said = Number(((($(".g-strip") || {}).textContent || "").match(/([\d,]+) limit stops?/) || [])[1] || 0);
    ok(marks === said, `All weeks: ${marks} stop marks, the same as the strip`, `All weeks: the chart shows ${marks} stop marks, the strip says ${said}`);
    // the panel before a week is picked says how often each app's limits stopped you; the two add up to the marks
    const n = (w) => (w === "once" ? 1 : w === "twice" ? 2 : Number(String(w || "0").replace(/ times?/, ""))), lim = (($(".g-panel .g-body") || {}).textContent || "");
    const cl = n((lim.match(/Claude's limits stopped you (once|twice|[\d,]+ times)/) || [])[1]), cx = n((lim.match(/Codex's (once|twice|[\d,]+ times)/) || [])[1]);
    if (marks) ok(cl + cx === marks, `All weeks: the panel's ${cl} and ${cx} stops add up to the marks`, `All weeks: the panel says ${cl} Claude and ${cx} Codex stops, the chart shows ${marks}`);
    const chats = Number(((($(".g-strip") || {}).textContent || "").match(/([\d,]+) chats/) || [])[1]?.replace(/,/g, "") || 0);
    ok(chats === (G.sessions || 0), `All weeks: ${chats} chats in all`, `All weeks: the strip says ${chats} chats, the data has ${G.sessions}`);
    click($(`[data-nper="${weeks[weeks.length - 1]}"]`)); await wait(120);
  }

  // 9. no leftover code on any screen (QA recheck, Oct 15: a key printed ${esc(...)}): every tab, its layers and panels
  const raw = [];
  const look = (where) => { const t = ($("#stage") || document.body).innerText; const m = t.match(/\$\{|\besc\(|\bundefined\b|\bNaN\b|\[object Object\]/); if (m) raw.push(`${where}: "${t.slice(Math.max(0, m.index - 20), m.index + 30).replace(/\s+/g, " ")}"`); };
  for (const per of weeks) {
    ((location.hash = "#limits"), 0); await wait(150); click($(`[data-nper="${per}"]`)); await wait(150);
    for (const id of ["limit", "plan", "reach", "carry"]) { click($(`[data-w="q:plate:${id}"]`)); await wait(80); look(`Your week, ${id}, ${per}`); }
    $$('#stage .q-row').forEach(() => {}); for (const r of $$('#stage .q-row').map((e) => e.getAttribute("data-w"))) { click($(`[data-w="${CSS.escape(r)}"]`)); await wait(80); look(`Your week, ${r}, ${per}`); }
    click($('[data-w="q:detail"]')); await wait(150); look(`The week in detail, ${per}`);
    ((location.hash = "#chats"), 0); await wait(150);
    for (const w of Object.keys(M.periods[per] || {}).filter((k) => (M.periods[per][k].usd || 0) > 0)) { const b = document.createElement("button"); b.setAttribute("data-w", "work:select:" + w); ($("#stage") || document.body).appendChild(b); click(b); await wait(120); b.remove(); look(`Your work, ${per}`); }
    click($('[data-go="screen:armory"]')); await wait(150);
    for (const l of $$("[data-a^='layer:']").map((e) => e.getAttribute("data-a")).filter((v, i, a) => a.indexOf(v) === i)) { click($(`[data-a="${l}"]`)); await wait(80); look(`Your setup, ${l}, ${per}`); }
    ((location.hash = "#instructions"), 0); await wait(150); look(`Your AI's instructions, ${per}`);
  }
  ok(!raw.length, "no leftover code on any screen", `leftover code on screen: ${raw.slice(0, 4).join("; ")}`);

  out.push("ERR " + window.__err.join(" | "));
  const p = document.createElement("pre"); p.id = "agree"; p.textContent = out.join("\n"); document.documentElement.appendChild(p);
})();
