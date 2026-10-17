// On the demo company, open every screen, layer and project and look for any name from your own data:
// in the text, in tooltips, in labels and in links. One line per screen; a LEAK line names the word and where.
window.__err = []; window.addEventListener("error", (e) => window.__err.push(e.message));
const $ = (s) => document.querySelector(s), wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (el) => el && el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const out = [], P = window.PRIVATE || { words: [], patterns: [] };
const res = P.patterns.map((p) => { try { return new RegExp(p, "i"); } catch (e) { return null; } }).filter(Boolean);
function scan(where) {
  const parts = [document.body.innerText];
  document.querySelectorAll("*").forEach((el) => { for (const a of el.attributes) if (/^(data-|aria-|title|href|alt)/.test(a.name)) parts.push(a.value); });
  const text = parts.join("\n");
  out.push("SCREEN " + where);
  // whole names only: "reviewer" inside the demo's own "ux-reviewer" isn't a leak
  P.words.forEach((w) => { if (new RegExp(`(^|[^\\w-])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\w-])`).test(text)) out.push(`LEAK "${w}" on ${where}`); });
  res.forEach((r) => { if (r.test(text)) out.push(`LEAK pattern ${r} on ${where}`); });
}
(async () => {
  await wait(400);
  if (!window.GB_DEMO) out.push("LEAK the demo didn't load");
  for (const per of [0, 1]) {
    click(document.querySelectorAll("[data-nper]")[per]); await wait(80);
    click($('[data-go="screen:note"]')); await wait(120); scan("Your week " + per);
    for (const k of ["limit", "reach", "carry", "stops", "pace"]) { const btn = $(`[data-w="q:sheet:${k}"]`); if (!btn) continue; click(btn); await wait(80); scan(`Your week ${per}, ${k} sheet`); click($('[data-w="q:close"]')); await wait(60); }
    click($('[data-w="q:detail"]')); await wait(120);
    document.querySelectorAll("details").forEach((d) => (d.open = true)); scan("The week in detail, opened " + per);
    click($('[data-go="screen:machine"]')); await wait(120);
    const n = document.querySelectorAll(".y-proj").length;
    for (let i = 0; i < n; i++) { click(document.querySelectorAll(".y-proj")[i]); await wait(60); scan(`Your work ${per}.${i}`); }
  }
  click($('[data-go="screen:armory"]')); await wait(120);
  for (const t of ["Claude Code", "Cowork", "Codex"]) {
    click($(`[data-a="tool:${t}"]`)); await wait(60);
    for (const l of [...document.querySelectorAll(".a-plate[data-a]")].map((p) => p.dataset.a)) { click($(`.a-plate[data-a="${l}"]`)); await wait(40); document.querySelectorAll(".a-row details").forEach((d) => (d.open = true)); scan(`Setup ${t} ${l}`); }
  }
  click($('[data-go="screen:shapes"]')); await wait(150); scan("Your AI's instructions");
  for (const id of ["notes", "skills", "subagents", "connectors", "repeat"]) { const p = $(`[data-w="s:plate:${id}"]`); if (p) { click(p); await wait(80); scan(`What shapes Claude, ${id}`); } }
  for (const k of ["memory", "fixes", "archive"]) { const pl = $(`.s-g .a-plate[data-w="s:plate:${k === "fixes" ? "main" : "notes"}"]`); if (pl) { click(pl); await wait(80); } const btn = $(`[data-w="s:sheet:${k}"]`); if (!btn) continue; click(btn); await wait(80); scan(`What shapes Claude, ${k} sheet`); click($('[data-w="s:close"]')); await wait(60); }
  for (const sc of ["note", "machine"]) { click($(`[data-go="screen:${sc}"]`)); await wait(150); const all = $('[data-nper="all"]'); if (!all) continue; click(all); await wait(150); scan(sc + ", all weeks"); click($(`[data-nper="${window.GB.week_start}"]`)); await wait(100); }
  const w = $("[data-go^='work:'], [data-id^='work:']"); if (w) { click(w); await wait(150); scan("full receipt"); }
  out.push("ERR " + window.__err.join(" | "));
  const p = document.createElement("pre"); p.id = "leaks"; p.textContent = out.join("\n"); document.documentElement.appendChild(p);
})();
