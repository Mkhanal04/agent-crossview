/* The first-minute walk (task 11, his yes Oct 17; plan in docs/plan-2026-10-17-first-minute.md): three short steps over
   the real screens on the first open. It reads what's already drawn, so its numbers are the screen's own numbers. It
   changes nothing; the browser only remembers that it was seen. Opens by itself once, on a served copy with records;
   "Show the first walk again" in the footer, or ?walk in the address, opens it any time. */
(function () {
  "use strict";
  const G = window.GB; if (!G) return;
  const DEMO = !!window.GB_DEMO, KEY = "gb:walk" + (DEMO ? "-demo" : ""), LIVE = location.protocol.startsWith("http") && !DEMO;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const seen = () => { try { return localStorage.getItem(KEY) === "done"; } catch (e) { return false; } };
  const remember = () => { try { localStorage.setItem(KEY, "done"); } catch (e) {} };
  const R = G.ranges || {}, M = G.machine || {}, has = (t) => !!R[t];
  const claudeReadings = !!((M.plan || {}).readings || []).length;
  const codexOnly = has("Codex") && !has("Claude Code") && !has("Cowork") && !claudeReadings;
  const click = (sel) => { const el = $(sel); if (el) el.click(); return !!el; };
  const pressed = (sel) => { const el = $(sel); return !!el && el.getAttribute("aria-pressed") === "true"; };
  const firstSentence = (t) => ((t.match(/^.*?[.?!](\s|$)/) || [t])[0]).trim();
  // the walk's buttons open a set place: they send the same command a button on the page would, even when that button
  // isn't drawn yet (the QA, Oct 17: "Choose my plans" only exists once the plan row is picked)
  const act = (w) => { const b = document.createElement("button"); b.hidden = true; b.dataset.w = w; document.body.appendChild(b); b.click(); b.remove(); };
  const RESUME = "gb:walk-resume";
  const resumeAt = () => { try { const n = +sessionStorage.getItem(RESUME) || 0; sessionStorage.removeItem(RESUME); return n; } catch (e) { return 0; } };
  const plural = (n, w) => `${n.toLocaleString()} ${w}${n === 1 ? "" : "s"}`;
  const appsHere = ["Claude Code", "Cowork", "Codex"].filter(has);

  // ---------- the three steps, each built from what's on screen when it opens ----------
  function step1() {
    const row = (name, found, what) => [name, found ? what || "Chats found" : "Not found on this Mac"];
    return {
      target: null,
      lead: DEMO ? "Crossview shows what a made-up company's AI apps did." : "Crossview shows what your AI apps did on this Mac.",
      rows: [row("Claude Code", has("Claude Code")), row("Cowork", has("Cowork")), row("The Claude app", claudeReadings, "Your limits only, not its chats"), row("Codex", has("Codex"))],
      support: "The next two steps show your plan next to the work, and one thing in your setup worth a look.",
      main: ["Show me my week", () => { toWeek(); return 2; }],
    };
  }
  function toWeek() {
    if (!pressed('[data-go="screen:note"]')) click('[data-go="screen:note"]');
    if (!pressed(`[data-nper="${G.week_start}"]`)) click(`[data-nper="${G.week_start}"]`);
    if (codexOnly && !pressed('[data-w="q:app:Codex"]')) click('[data-w="q:app:Codex"]');
  }
  function step2() {
    const plate = $('[data-w="q:plate:plan"]'), page = txt($(".g-lead"));
    if (!plate) return step3();
    if ($(".q-p-none", plate)) return {
      target: '[data-w="q:plate:plan"]',
      lead: "Choose your plans to see whether they cover your work.",
      support: "Crossview sets what you pay next to what the work would cost at pay-per-use prices." + (!LIVE ? " To save your plans, start Crossview by double-clicking “Agent Crossview.command” in its folder." : askedPlans ? " You can choose them any time from Your plans on Your week." : ""),
      main: LIVE && !askedPlans ? ["Choose my plans", () => { askedPlans = true; try { sessionStorage.setItem(RESUME, "2"); } catch (e) {} pause(2); act("q:sheet:plans"); return 0; }] : ["Show me one thing in my setup", () => 3],
    };
    const vals = [...plate.querySelectorAll(".q-cmp b")].map((b) => txt(b).replace(/ so far$/, ""));
    const month = (txt($(".q-plan", plate)).match(/\$[\d,]+ a month/) || [])[0];
    const forApp = (txt($(".q-h", plate)).match(/^Your plan for (\w+)/) || [])[1];
    const plan = forApp ? `Your ${forApp} plan` : "Your plan";
    // the card says it in its own words, from the one plan's own two numbers (the page's top sentence covers every plan,
    // and repeating it read as an echo; the QA, Oct 17)
    const who = forApp === "Codex" ? "OpenAI's" : forApp === "Claude" ? "Anthropic's" : "the";
    const SAME = `The pay-per-use price isn't your bill. It's what you'd pay without a plan, at ${who} published prices.${forApp !== "Codex" && (has("Claude Code") || has("Cowork")) ? " Chats in the Claude app aren't kept on this Mac, so they aren't in it." : ""}`;
    if (vals.length >= 2) {
      const amt = (v) => (/under \$10/.test(v) ? 5 : +(String(v).replace(/[^\d.]/g, "")) || 0), paid = amt(vals[0]), use = amt(vals[1]);
      const fuzzy = /under/.test(vals[0] + vals[1]) && Math.max(paid, use) < 10, yours = plan.replace(/^Your/, "your");
      return {
        target: '[data-w="q:plate:plan"]',
        lead: fuzzy || Math.abs(use - paid) <= 0.1 * Math.max(use, paid) ? `So far this week, the work and ${yours}'s share are about even.`
          : use > paid ? `Without ${yours}, this week's work would have cost ${use >= 3 * paid ? "far " : ""}more.` : `So far this week, ${yours} costs more than the work would.`,
        nums: [[month ? `This week's share of your ${month}` : "What your plan costs so far this week", vals[0]], ["This week's work at pay-per-use prices", vals[1]]],
        support: SAME,
        main: ["Show me one thing in my setup", () => 3],
      };
    }
    const api = /bill grows/i.test(page);
    return {
      target: '[data-w="q:plate:plan"]',
      lead: api ? "You pay per use, so your bill grows with the work." : "Your company pays for your plan.",
      nums: [["This week's work at pay-per-use prices", vals[0]]],
      support: api ? "With an API key, this is close to what you'll be billed." : SAME,
      main: ["Show me one thing in my setup", () => 3],
    };
  }
  function step3() {
    const reach = $('[data-w="q:plate:reach"]'), carry = $('[data-w="q:plate:carry"]');
    // each row on Your week is a question (b) and its answer (small); the walk reads the answer
    const ansOf = (el) => txt(el && (el.querySelector("small") || el.querySelector(".q-a")));
    const rline = ansOf(reach), cline = ansOf(carry);
    const you = (rline.match(/\.\s*([^.]+?) can act as you\./) || [])[1];
    const last = ["Done", null];
    if (you) {
      const many = /,| and /.test(you), port = !many && (M.ports || []).find((p) => p.name === you), chrome = !many && /chrome/i.test(you);
      const from = ((R["Claude Code"] || [])[0]) && new Date(R["Claude Code"][0] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const used = port && port.actions ? `Claude has taken ${plural(port.actions, "action")} with it${from ? ` since ${from}` : ""}. ` : "";
      return {
        target: '[data-w="q:plate:reach"]', last,
        lead: `${you} can act as you${chrome ? " in your browser" : ""}.`,
        support: `${used}${many ? "They work" : "It works"} with your own logins, so Claude can click and type ${chrome ? "on any site" : "anywhere"} where you're signed in. ${chrome ? `That's how Claude does browser work for you, so keep it if you rely on that. To turn it off, type /chrome in Claude Code and switch off “Enabled by default”.` : "Keep them if Claude does that work for you. Otherwise you can switch them off in Claude's settings."}`,
        main: !many ? ["Show me where it's set up", () => { act(`setup:port:${you}`); return 0; }] : ["Show me what Claude can reach", () => { click('[data-w="q:plate:reach"]'); return 0; }],
      };
    }
    if (rline && /can act outside/.test(rline)) return {
      target: '[data-w="q:plate:reach"]', last,
      lead: firstSentence(rline),
      support: "A connector links Claude to another app, like Google Drive. This is what they're allowed to do, not something that happened. Some of them can change or delete things in those apps.",
      main: ["Show me the list", () => { click('[data-w="q:plate:reach"]'); return 0; }],
    };
    if (cline && /never been used/.test(cline)) return {
      target: '[data-w="q:plate:carry"]', last,
      lead: firstSentence(cline),
      support: "A skill is a set of instructions for one kind of task. Each one still adds words Claude reads before every message.",
      main: ["Show me which ones", () => { click('[data-w="q:plate:carry"]'); return 0; }],
    };
    const one = appsHere.length === 1 ? appsHere[0] : null;
    return {
      target: null, last,
      lead: one ? `Your setup shows how ${one} is put together.` : "Your setup shows how each app is put together.",
      support: `It shows what ${one || "each app"} reads and uses, one layer at a time.`,
      main: ["Show me my setup", () => { click('[data-go="screen:armory"]'); return 0; }],
    };
  }
  const STEPS = { 1: step1, 2: step2, 3: step3 };

  // ---------- drawing ----------
  let at = 0, box = null, card = null, hole = null, before = null, paused = 0, askedPlans = false;
  function show(n) {
    at = n; const s = STEPS[n]();
    if (!box) {
      before = document.activeElement;
      box = document.createElement("div"); box.className = "wk"; box.setAttribute("aria-hidden", "true");
      // four veils around the lit part, one per side (a single huge shadow came out too faint in some browsers)
      ["t", "r", "b", "l"].forEach((k) => { const v = document.createElement("div"); v.className = "wk-veil"; v.dataset.side = k; box.appendChild(v); });
      hole = document.createElement("div"); hole.className = "wk-hole"; box.appendChild(hole);
      card = document.createElement("div"); card.className = "wk-card"; card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true"); card.setAttribute("aria-labelledby", "wk-lead");
      // one live line that stays put, so screen readers hear each new step; the card's content changes under it
      card.innerHTML = `<p class="sr" aria-live="polite" id="wk-say"></p><div class="wk-in"></div>`;
      // a click on the card's own words keeps focus on its button (the QA recheck, Oct 17)
      card.addEventListener("mousedown", (ev) => { if (!ev.target.closest("button")) { ev.preventDefault(); const g = card.querySelector(".wk-go"); if (g) g.focus({ preventScroll: true }); } });
      document.body.appendChild(box); document.body.appendChild(card);
      box.addEventListener("click", (ev) => ev.stopPropagation());
      // a click on the dimmed page keeps focus on the card (the QA, Oct 17)
      box.addEventListener("mousedown", (ev) => { ev.preventDefault(); const g = card && card.querySelector(".wk-go"); if (g) g.focus({ preventScroll: true }); });
    }
    const dots = [1, 2, 3].map((i) => `<i class="${i === n ? "on" : ""}"></i>`).join("");
    const say = $("#wk-say", card); say.textContent = ""; setTimeout(() => { if (say.isConnected) say.textContent = `Step ${n} of 3. ${s.lead}`; }, 120);
    $(".wk-in", card).innerHTML = `<p class="wk-n" aria-hidden="true">${n} of 3</p><h2 class="wk-lead" id="wk-lead">${esc(s.lead)}</h2>
      ${s.rows ? `<ul class="wk-rows">${s.rows.map(([a, v]) => `<li><span>${esc(a)}</span><span class="wk-dim">${esc(v)}</span></li>`).join("")}</ul>` : ""}
      ${s.nums ? `<div class="wk-nums">${s.nums.map(([a, v]) => `<div><span>${esc(a)}</span><b>${esc(v)}</b></div>`).join("")}</div>` : ""}
      <p class="wk-sup">${esc(s.support)}</p>
      <div class="wk-foot"><button class="wk-skip" data-wk="skip">${s.last ? "Done" : "Skip"}</button><span class="wk-dots" aria-hidden="true">${dots}</span><button class="w-btn main wk-go" data-wk="go">${esc(s.main[0])}</button></div>`;
    card._main = s.main[1]; card._target = s.target;
    if (window.GBWords) window.GBWords();
    place(s.target);
    $(".wk-go", card).focus({ preventScroll: true });
  }
  // where the page and its frames were scrolled before the walk moved them, put back when the walk is skipped (the QA:
  // the chart's top stayed cut off)
  let scrolled = null;
  const remember_ = (el) => { scrolled = scrolled || new Map(); for (let n = el.parentElement; n; n = n.parentElement) if (n.scrollHeight > n.clientHeight && !scrolled.has(n)) scrolled.set(n, n.scrollTop); if (!scrolled.has(window)) scrolled.set(window, window.scrollY); };
  function place(sel, still) {
    const el = sel && $(sel), pan0 = $(".g-panel");
    if (el && !still) remember_(el);
    // beside a panel on the right, the lit part can sit in the middle; on narrower windows the card goes under it, so the
    // lit part moves up to just under the top bar to leave room (the walk check, 1000 wide)
    const side = el && pan0 && pan0.getBoundingClientRect().left >= el.getBoundingClientRect().right - 4 && pan0.getBoundingClientRect().width >= 320;
    if (still) {}
    else if (el && side) el.scrollIntoView({ block: "center" });
    else if (el) { el.scrollIntoView({ block: "start" }); const bar = ($("#bar") || {}).offsetHeight || 0; window.scrollBy(0, -(bar + 24)); }
    requestAnimationFrame(() => {
      if (!card) return;
      const r = el && el.getBoundingClientRect(), W = Math.min(400, innerWidth - 32);
      box.classList.toggle("dim", !r);
      const veils = box.querySelectorAll(".wk-veil");
      if (r) {
        const barB = Math.max(0, (($("#bar") || {}).getBoundingClientRect ? $("#bar").getBoundingClientRect().bottom : 0));
        const L = r.left - 8, T = Math.max(r.top - 8, barB), Rt = r.right + 8, B = Math.max(r.bottom + 8, T);
        Object.assign(hole.style, { display: "block", left: L + "px", top: T + "px", width: Rt - L + "px", height: B - T + "px" });
        const at_ = { t: [0, 0, innerWidth, Math.max(0, T)], b: [0, B, innerWidth, Math.max(0, innerHeight - B)], l: [0, T, Math.max(0, L), B - T], r: [Rt, T, Math.max(0, innerWidth - Rt), B - T] };
        veils.forEach((v) => { const [x, y, w, h] = at_[v.dataset.side]; Object.assign(v.style, { display: "block", left: x + "px", top: y + "px", width: w + "px", height: h + "px" }); });
      } else { hole.style.display = "none"; veils.forEach((v) => (v.style.display = "none")); }
      card.style.width = W + "px";
      const h = card.offsetHeight, pan = $(".g-panel"), pr = pan && pan.getBoundingClientRect();
      let left, top;
      if (!r) { left = (innerWidth - W) / 2; top = Math.max(16, innerHeight * 0.22); }
      else if (pr && pr.width >= 320 && pr.left >= r.right - 4) { const pad = parseFloat(getComputedStyle(pan).paddingLeft) || 16; card.style.width = Math.min(pr.width - 2 * pad, 480) + "px"; left = pr.left + pad; top = Math.max(pr.top + 16, Math.min(r.top, innerHeight - card.offsetHeight - 16)); }
      else if (r.bottom + 16 + h < innerHeight) { left = Math.min(Math.max(16, r.left), innerWidth - W - 16); top = r.bottom + 16; }
      else { left = Math.min(Math.max(16, r.left), innerWidth - W - 16); top = Math.max(16, r.top - h - 16); }
      card.style.left = left + "px"; card.style.top = Math.max(16, top) + "px";
    });
  }
  function close(remembered, putBack) {
    if (box) box.remove(); if (card) card.remove(); box = card = hole = null; at = 0;
    if (putBack && scrolled) scrolled.forEach((top, n) => (n === window ? window.scrollTo(0, top) : (n.scrollTop = top)));
    scrolled = null;
    if (remembered) remember();
    if (before && before.focus && document.contains(before)) before.focus({ preventScroll: true });
  }
  // "Choose my plan" steps aside while the plans sheet is open, then comes back to step 2
  function pause(n) {
    if (box) box.remove(); if (card) card.remove(); box = card = hole = null; paused = n;
    const wait = () => { if (!paused) return; if ($(".q-sheet")) return setTimeout(wait, 400); const k = paused; paused = 0; try { sessionStorage.removeItem(RESUME); } catch (e) {} setTimeout(() => show(k), 300); };
    setTimeout(wait, 600);
  }
  function go() {
    const next = card && card._main ? card._main() : 0;
    if (next) { const delay = next === 2 ? 350 : 60; setTimeout(() => show(next), delay); }
    else if (!paused) close(true);
  }
  function start() { if (at || paused) return; show(1); }

  document.addEventListener("click", (ev) => {
    const w = ev.target.closest("[data-wk]"), again = ev.target.closest("[data-walk]");
    if (again) { ev.preventDefault(); ev.stopPropagation(); return start(); }
    if (!w) return;
    ev.stopPropagation();
    if (w.dataset.wk === "skip") return close(true, true);
    if (w.dataset.wk === "go") return go();
  }, true);
  document.addEventListener("keydown", (ev) => {
    if (!card) return;
    if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); return close(true, true); }
    if (ev.key === "Tab") {  // focus stays on the card while it's open
      const f = [...card.querySelectorAll("button")], i = f.indexOf(document.activeElement);
      ev.preventDefault(); f[(i + (ev.shiftKey ? f.length - 1 : 1)) % f.length].focus();
      return;
    }
    // the app behind doesn't take keys (its letter shortcuts would switch tabs); Enter and Space still press the card's buttons
    ev.stopPropagation();
    if (!(ev.target.closest && ev.target.closest(".wk-card"))) ev.preventDefault();
  }, true);
  window.addEventListener("resize", () => { if (card) place(card._target, true); });
  // the outline and card follow the page when it scrolls under them (the QA, Oct 17)
  document.addEventListener("scroll", () => { if (card) place(card._target, true); }, { capture: true, passive: true });
  window.GBWalk = { start, close: () => close(false), step: () => at };

  const asked = /[?&]walk\b/.test(location.search), skip = /[?&]nowalk\b/.test(location.search);
  const records = DEMO || G.sessions > 0;
  const back = resumeAt();
  if (records && !skip && back === 2) setTimeout(() => { toWeek(); setTimeout(() => show(2), 350); }, 450);
  else if (records && !skip && (asked || (location.protocol.startsWith("http") && !seen()))) setTimeout(start, 450);
})();
