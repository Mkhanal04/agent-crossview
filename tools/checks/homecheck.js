// The home (release 1 of the redesign, Oct 18): it opens, says one sentence, shows three modules each with a question,
// an answer and a line, the receipt starts with what you paid, at most three things are worth a look, the panel fits,
// each module opens the screen behind it, the numbers agree with those screens, and the brand button comes back home.
// One HOME line per check, a FAIL line for each problem.
window.__err = []; window.addEventListener("error", (e) => window.__err.push(e.message));
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)], wait = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (k) => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
const click = (el) => el && el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
const out = [], ok = (cond, good, bad) => out.push(cond ? `HOME ${good}` : `FAIL ${bad}`);
const W = innerWidth;
const home = async () => { click($('[data-go="screen:home"]')); await wait(220); };
function finish() { const pre = document.createElement("pre"); pre.id = "home"; pre.textContent = out.join("\n"); document.body.appendChild(pre); }
(async () => {
  await wait(700);
  await home();
  const p = $(".h-panel");
  ok(!!p, `the home opens at ${W} wide`, `the home didn't open at ${W} wide`);
  if (!p) return finish();
  const lead = text($(".h-lead"));
  ok(lead.length > 12 && lead.split(/[.?!](\s|$)/).filter((x) => x && x.trim()).length === 1, `one lead sentence: "${lead}"`, `the lead isn't one sentence: "${lead}"`);
  const mods = $$(".h-mods > .h-mod");
  ok(mods.length === 3, "three modules", `${mods.length} modules`);
  mods.forEach((m) => {
    const q = text(m.querySelector(".h-q"));
    ok(q.endsWith("?") && text(m.querySelector(".h-big")).length > 0 && text(m.querySelector(".h-line")).length > 10, `"${q}" has a question, an answer and a line`, `"${q}" is missing its answer or line`);
  });
  const rec = $(".h-receipt");
  if (rec) {
    const t = rec.innerText, iPaid = Math.max(t.indexOf("What you paid"), t.indexOf("Paid by your company"), t.indexOf("Paid per use"), t.indexOf("not chosen"), t.indexOf("'s share")), iUse = t.indexOf("If you'd paid per use");
    ok(iPaid >= 0 && iUse > iPaid, "the receipt starts with what you paid", "the receipt doesn't start with what you paid");
  }
  ok($$(".h-pin").length <= 3, `${$$(".h-pin").length} things worth a look, three at most`, "more than three things worth a look");
  const r = p.getBoundingClientRect();
  ok(r.left >= 0 && r.right <= W + 0.5, "the panel fits the window's width", `the panel runs past the window (${Math.round(r.left)} to ${Math.round(r.right)})`);
  const lim = (text($('[data-h="open:limits"] .h-big')).match(/^(\d+)% used/) || [])[1];
  const conM = text($('[data-h="open:setup"] .h-line')).match(/of your (\d+) connectors|All (\d+) of your connectors|(Your one) connector/) || [], con = conM[1] || conM[2] || (conM[3] ? "1" : undefined);
  click($('[data-h="open:limits"]')); await wait(260);
  ok(location.hash === "#limits" && !!$(".q-pace-b"), "the limits module opens the limit page", `the limits module opened ${location.hash}`);
  // the page opens on Codex when only Codex's limit stopped you (Oct 20); the home's number is Claude's, so compare on Claude's view
  if (lim && $('[data-w="q:app:Claude"]') && $('[data-w="q:app:Claude"]').getAttribute("aria-pressed") !== "true") { click($('[data-w="q:app:Claude"]')); await wait(200); }
  if (lim) { const t = text($(".q-pace")); ok(new RegExp(`(^|\\D)${lim}% (used|at)`).test(t), `the limit agrees with Your week (${lim}%)`, `the home says ${lim}% but Your week's chart says "${t.slice(0, 80)}"`); }
  await home();
  click($('[data-h="open:cost"]')); await wait(260);
  ok(location.hash === "#cost" && !!document.querySelector(".r-panel"), "the cost module opens the receipt", `the cost module opened ${location.hash}`);
  await home();
  click($('[data-h="open:setup"]')); await wait(320);
  ok(location.hash === "#setup" && /Connectors/.test(text($(".a-panel h3"))), "the setup module opens Your setup at the connectors", `the setup module opened ${location.hash} at "${text($(".a-panel h3"))}"`);
  if (con) { const s = (text($(".a-panel .a-line")).match(/^(\d+) (?:in all|set up)/) || [])[1]; ok(s === con, `the connectors agree with Your setup (${con})`, `the home says ${con} connectors, Your setup says ${s}`); }
  await home();
  const pl = $(".h-plate");
  if (pl) { const id = pl.dataset.h.slice(6); click(pl); await wait(260); ok(location.hash === "#setup", `a plate opens Your setup (${id})`, `a plate opened ${location.hash}`); await home(); }
  const pin = $(".h-pin");
  if (pin) { click(pin); await wait(260); ok((location.hash === "#home" && !!$(".q-sheet")) || location.hash === "#limits" || (location.hash === "#setup" && /Connectors/.test(text($(".a-panel h3")))), "a thing worth a look opens its change over the home, the limit page at its answer, or Setup at that connector", `it opened ${location.hash}`); key("Escape"); await wait(120); await home(); }
  click($(".h-drawer")); await wait(260);
  ok(location.hash === "#chats" && !!$(".wl-panel"), "the drawer opens the work list", `the drawer opened ${location.hash}`);
  // the work list (release 2 slice 4): one lead sentence, each open project's chats add up to it when all are shown, and a chat fills the panel
  if ($(".wl-panel")) {
    const lead = text($(".wl-label h1"));
    ok(lead.length > 12 && lead.split(/[.?!](\s|$)/).filter((x) => x && x.trim()).length === 1, `the work list has one lead sentence: "${lead}"`, `the work list's lead isn't one sentence: "${lead}"`);
    const more = $(".wl-more"); if (more && /Show \d/.test(text(more))) { click(more); await wait(200); }
    const money = (t) => { if (/under \$1/.test(t)) return 0.5; const m = String(t).match(/\$([\d,]+)/); return m ? +m[1].replace(/,/g, "") : 0; };
    const proj = $(".wl-proj[aria-expanded='true']");
    if (proj) {
      const pv = money(text(proj.querySelectorAll(".num")[1])); let s = 0, el = proj.nextElementSibling;
      while (el && !el.classList.contains("wl-proj")) { if (el.classList.contains("wl-chat")) s += money(text(el.querySelectorAll(".num")[1])); el = el.nextElementSibling; }
      ok(Math.abs(s - pv) <= Math.max(2, $$(".wl-chat").length), `the open project's chats add up to it ($${pv})`, `the open project says $${pv}, its chats add up to $${s}`);
    }
    const ch = $(".wl-chat"); if (ch) { click(ch); await wait(200); ok(!!$(".wl-ev .wl-big"), "a chat fills the panel", "picking a chat didn't fill the panel"); }
  }
  await home();
  ok(location.hash === "#home" && !!$(".h-panel"), "the brand button comes back home", "the brand button didn't come back home");
  // How this was made (release 2 slice 3): each module opens one panel with the same five parts, and it closes again
  for (const id of ["limits", "cost", "setup"]) {
    click($(`[data-h="how:${id}"]`)); await wait(200);
    const dts = $$(".h-how dt").map(text);
    ok(["Where it came from", "How it was worked out", "How sure", "What's missing", "Last updated"].every((x) => dts.includes(x)), `"How this was made" on ${id} shows its five parts`, `"How this was made" on ${id} shows: ${dts.join(", ") || "nothing"}`);
  }
  click($('[data-h="how:close"]')); await wait(200);
  ok(!$(".h-how"), "the panel closes", "the panel didn't close");
  ok(!window.__err.length, "no errors", "errors: " + window.__err.join(" | "));
  finish();
})();
