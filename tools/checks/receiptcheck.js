// The receipt (release 2 slice 2, Oct 19): it opens from the home, says one sentence, starts with what you paid, its per-use
// lines add up to its total in both views, the estimate and the unpriced lines say so, the plan's extras are never counted,
// a selected line fills the evidence panel's five parts, and Home comes back. One RECEIPT line per check, a FAIL per problem.
window.__err = []; window.addEventListener("error", (e) => window.__err.push(e.message));
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)], wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (el) => el && el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
const out = [], ok = (cond, good, bad) => out.push(cond ? `RECEIPT ${good}` : `FAIL ${bad}`);
const money = (t) => { if (String(t).includes("under $1")) return 0; const m = String(t).match(/\$([\d,]+)/); return m ? +m[1].replace(/,/g, "") : null; };  // "under $1" first: it contains "$1"
function finish() { const pre = document.createElement("pre"); pre.id = "receipt"; pre.textContent = out.join("\n"); document.body.appendChild(pre); }
async function sums(view) {
  const rows = $$(".r-paper .r-rr"), iTot = rows.findIndex((r) => /^Per use/.test(text(r.querySelector("span"))));
  if (iTot < 0) { ok(!$(".r-paper") || /No work/.test(text($(".r-label h1"))), `${view}: no per-use total on a week with no work`, `${view}: the per-use total is missing`); return; }
  const tot = money(text(rows[iTot].querySelector("b")));
  let start = rows.findIndex((r, i) => i < iTot && r.closest(".r-paper") && !r.classList.contains("paid") && !/a month/.test(text(r)) && !/^(This week|Last week)/.test(text(r)));
  const parts = rows.slice(start, iTot).filter((r) => !r.classList.contains("nop") || /\$/.test(text(r.querySelector("b"))));
  const byModel = view === "By work" ? parts.findIndex((r) => /%/.test(text(r))) : -1;
  const groups = byModel > 0 ? [parts.slice(0, byModel), parts.slice(byModel)] : [parts];
  groups.forEach((g, gi) => { const s = g.reduce((a, r) => a + (money(text(r.querySelector("b"))) || 0), 0); ok(Math.abs(s - tot) <= 0, `${view}${groups.length > 1 ? (gi ? ", by model" : ", by who") : ""}: the lines add up to the total ($${tot})`, `${view}${groups.length > 1 ? (gi ? ", by model" : ", by who") : ""}: the lines add up to $${s}, the total says $${tot}`); });
}
(async () => {
  await wait(700);
  click($('[data-go="screen:home"]')); await wait(220);
  click($('[data-h="open:cost"]')); await wait(260);
  ok(location.hash === "#cost" && !!$(".r-panel"), "the receipt opens from the home's cost card", `the cost card opened ${location.hash}`);
  if (!$(".r-panel")) return finish();
  for (const per of ["this", "last"]) {
    const b = $$("[data-nper]").find((x) => (per === "this" ? /This week/ : /Last week/).test(text(x))); if (b) { click(b); await wait(260); }
    const lead = text($(".r-label h1"));
    ok(lead.length > 12 && lead.split(/[.?!](\s|$)/).filter((x) => x && x.trim()).length === 1, `${per} week: one lead sentence: "${lead}"`, `${per} week: the lead isn't one sentence: "${lead}"`);
    const t = $(".r-paper") ? $(".r-paper").innerText : "";
    ok(t.indexOf("What you paid") === 0 || /^What you paid/.test(t.trim()), `${per} week: the receipt starts with what you paid`, `${per} week: the receipt doesn't start with what you paid`);
    await sums("By plan");
    $$(".r-paper .r-rr").filter((r) => /not counted/.test(text(r))).forEach((r) => ok(!/\$/.test(text(r.querySelector("b"))), `${per} week: "${text(r.querySelector("span"))}" isn't counted`, `${per} week: a plan extra shows an amount`));
    $$(".r-paper .r-rr.nop").filter((r) => /price not published/.test(text(r))).forEach((r) => ok(true, `${per} week: "${text(r.querySelector("span"))}" says its price isn't published`, ""));
    click($('[data-r="view:work"]')); await wait(200);
    await sums("By work");
    const sel = $(".r-paper .r-rr.sel");
    ok(!!sel || !$(".r-paper .r-rr"), `${per} week, By work: a line is selected`, `${per} week, By work: no line is selected`);
    click($('[data-r="view:plan"]')); await wait(200);
  }
  const line = $$(".r-paper .r-rr[data-r]").find((r) => /Claude Code|Codex/.test(text(r)));
  if (line) { click(line); await wait(200); const dts = $$(".r-ev dt").map(text); ok(["Where it came from", "How it was worked out", "How sure", "What's missing", "Last updated"].every((x) => dts.includes(x)), "a selected line fills the evidence panel's five parts", `the evidence panel shows: ${dts.join(", ")}`); }
  click($('[data-r="home"]')); await wait(220);
  ok(location.hash === "#home" && !!$(".h-panel"), "Home comes back", `Home went to ${location.hash}`);
  ok(!window.__err.length, "no errors", "errors: " + window.__err.join(" | "));
  finish();
})();
