// The first-minute walk (task 11, Oct 17): it opens, every step's card fits the window and leaves the lit part
// uncovered, step 2's numbers are the plan's own numbers on screen, the last step closes it, Esc closes it, and the
// footer can open it again. One WALK line per check, a FAIL line for each problem. Opened with ?walk.
window.__err = []; window.addEventListener("error", (e) => window.__err.push(e.message));
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)], wait = (ms) => new Promise((r) => setTimeout(r, ms));
const out = [], ok = (cond, good, bad) => out.push(cond ? `WALK ${good}` : `FAIL ${bad}`);
const W = innerWidth, H = innerHeight;
const inside = (r) => r.left >= 0 && r.top >= 0 && r.right <= W + 0.5 && r.bottom <= H + 0.5;
const overlap = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
(async () => {
  await wait(1200);
  ok(!!$(".wk-card"), `opens at ${W} wide`, `the walk didn't open at ${W} wide`);
  for (let n = 1; n <= 3 && $(".wk-card"); n++) {
    await wait(200);
    const c = $(".wk-card"), r = c.getBoundingClientRect(), lead = text($(".wk-lead", c)), go = text($(".wk-go", c));
    ok(text($(".wk-n", c)) === `${n} of 3`, `step ${n} says ${n} of 3`, `step ${n} says "${text($(".wk-n", c))}"`);
    ok(inside(r), `step ${n} card fits the window`, `step ${n} card runs outside the window (${Math.round(r.left)},${Math.round(r.top)} to ${Math.round(r.right)},${Math.round(r.bottom)})`);
    ok(lead.length > 10 && go.length > 3, `step ${n} has a sentence and a button`, `step ${n} is missing its sentence or button`);
    ok(c.scrollWidth <= c.clientWidth + 1, `step ${n} has no text running out of the card`, `step ${n} has text running out of the card`);
    const hole = $(".wk-hole");
    if (hole && hole.style.display !== "none") {
      const h = hole.getBoundingClientRect();
      ok(!overlap(h, r), `step ${n} card leaves the lit part uncovered`, `step ${n} card covers the part it talks about`);
    }
    if (n === 2 && $(".wk-nums", c)) {
      const shown = $$(".wk-nums b", c).map(text), plate = $$('[data-w="q:plate:plan"] .q-cmp b').map((b) => text(b).replace(/ so far$/, ""));
      ok(shown.every((v, i) => v === plate[i]), `step 2's numbers match the plan on screen (${shown.join(", ")})`, `step 2 says ${shown.join(", ")} but the plan shows ${plate.join(", ")}`);
    }
    $(".wk-go", c).click();
    await wait(n === 1 ? 700 : 400);
  }
  ok(!$(".wk-card"), "the last step closes the walk", "the walk is still open after its last step");
  // the footer opens it again, and Esc closes it
  const again = $("[data-walk]");
  ok(!!again, "the footer can open it again", "no way to open the walk again in the footer");
  if (again) {
    again.click(); await wait(300);
    ok(!!$(".wk-card"), "the footer link opens it", "the footer link didn't open the walk");
    document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await wait(150);
    ok(!$(".wk-card"), "Esc closes it", "Esc didn't close the walk");
  }
  ok(!window.__err.length, "no script errors", "script errors: " + window.__err.join(" | "));
  const p = document.createElement("pre"); p.id = "walk"; p.textContent = out.join("\n"); document.documentElement.appendChild(p);
})();
