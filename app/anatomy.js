/* Crossview: Your setup, the anatomy. Milan's idea on Oct 13: show Claude Code (or Cowork, or Codex) taken apart, layer by
   layer, from its folder on this Mac up to your projects. Each layer is lit if it was used in the week the front door shows,
   dimmed if not, dashed if there's nothing there. Click a layer to see what's in it. Crossview only looks.
   Plain JavaScript; app.js passes in its helpers. */
window.GBAnatomy = function (X) {
  "use strict";
  const { G, S, esc, money, day, riskOf, riskWords, since, shares } = X;
  const M = G.machine || { periods: {}, apps: {}, ports: [] }, AN = G.anatomy || {};
  const TOOLS = ["Claude Code", "Cowork", "Codex"];
  const OR = "var(--accent)";
  const words = () => (S.nper === G.week_start ? "this week" : "last week");
  const per = () => S.nper || G.week_start;
  const tip = (t) => `data-tip="${esc(t)}"`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const workName = (w) => (w === "Not sure yet" ? "Not grouped yet" : w);

  // what each app used in the period: helpers by type, connectors by id, pieces of work
  function usedIn(p, tool) {
    const helpers = {}, ports = {}, works = {};
    Object.entries(M.periods[p] || {}).forEach(([w, t]) => {
      Object.entries(t.agents || {}).forEach(([k, a]) => {
        const parts = k.split(":");
        if (parts[0] === "main" && parts[1] === tool && a.usd > 0) works[w] = (works[w] || 0) + a.usd;
        if (parts[0] === "helper" && parts[1] === tool) { const type = parts.slice(2).join(":"); helpers[type] = (helpers[type] || 0) + a.runs; works[w] = (works[w] || 0) + a.usd; }
      });
      if (tool !== "Codex") Object.entries(t.connectors || {}).forEach(([k, n]) => (ports[k] = (ports[k] || 0) + n));
    });
    return { helpers, ports, works };
  }

  // ---------- the nine layers for one app, bottom to top ----------
  function layers(tool) {
    const p = per(), wk = usedIn(p, tool), ever = usedIn("all", tool), A = AN[tool] || {}, app = ((M.apps || {})[p] || {})[tool] || {}, appAll = ((M.apps || {}).all || {})[tool] || {};
    const L = [];
    const add = (id, title, line, state, items, blocks, foot) => L.push({ id, title, line, state, items, blocks, foot: foot || "" });
    // the apps' own names for settings and tools, in plain words (QA run 5, finding 4)
    const PLAIN0 = { "Approval rule": "When it asks you", Sandbox: "What it may change", "Thinking effort": "How hard it thinks", "Auto mode notes": "Notes for when it works without asking", "unified-computer-use": "Computer control", "computer-use": "Computer control", node_repl: "Code runner", chrome: "Chrome", browser: "Browser" };
    const PLAIN = new Proxy(PLAIN0, { get: (o, k) => (window.GBStage && window.GBStage.name(k) !== k ? window.GBStage.name(k) : o[k]) });  // shared names (stage.js)
    const VAL = { default: "Codex's default", never: "Never asks", "on-request": "Decides when to ask", untrusted: "Asks before most actions", "on-failure": "Asks only after something fails", "danger-full-access": "Anything on this Mac", "workspace-write": "Only the folder it works in", "read-only": "Nothing; it only reads" };
    const model = (v) => (/^gpt-/i.test(v) ? "GPT-" + v.slice(4).split("-").map((x, i) => (i ? x.charAt(0).toUpperCase() + x.slice(1) : x)).join(" ") : v);
    const it = (name, sub, state, extra) => Object.assign({ name: PLAIN[name] || name, sub, state }, extra || {});
    const F = A.folder || {};
    add("folder", "Its folder on your Mac", F.session_logs ? `${plural(F.session_logs, tool === "Cowork" ? "task" : "chat")} logged, ${F.mb >= 1000 ? (F.mb / 1000).toFixed(1) + " GB" : F.mb + " MB"}` : "nothing found",
      F.last && F.last >= p ? "lit" : F.session_logs ? "dim" : "none",
      [it("Where it is", F.where || "Not found", "lit")].concat((F.parts || []).map(([n, s]) => it(n, s, "lit")), F.first ? [it("Oldest log kept", day(F.first), "lit"), it("Newest log", day(F.last), F.last >= p ? "lit" : "dim")] : []),
      5, tool === "Cowork" && G.cowork_end && G.cowork_end < G.week_start ? `The Claude app stopped saving Cowork's logs on this Mac after ${day(G.cowork_end)}, so Crossview can't see newer Cowork tasks.` : "Crossview reads these logs on this Mac and sends nothing anywhere.");
    const co = tool === "Claude Code" && A.managed && (A.managed.items || []).length ? A.managed : null;
    const st = (A.settings || {}).items || [];
    const off = tool === "Claude Code" ? Object.keys(G.plugin_state || {}) : [];
    add("settings", "Settings and permissions", tool === "Codex" ? "its model and when it asks you" : "what it may do without asking", st.length ? "lit" : "none",
      st.map(([n, v]) => it(n, n === "Model" ? model(v) : (tool === "Codex" || v !== "default" ? VAL[v] || v : v), "lit")).concat(off.map((n) => it(`Add-on "${n}"`, "You switched it off", "dim"))), 4,
      tool === "Claude Code" ? `These are kept in Claude Code's own settings file on this Mac. Crossview only reads them.${co ? " Your company's settings, on the layer above, win over these." : ""}` : tool === "Codex" ? "These are kept in Codex's own settings file on this Mac. Crossview only reads them." : "These are set inside the Claude app.");
    // settings your company set (Oct 17): their own layer, read-only, only when there are any
    if (co) add("company", "Set by your company", `${plural(co.items.length, "setting")}, read-only`, "lit", co.items.map(([n, v]) => it(n, v, "lit")), 4,
      "Someone who manages Claude Code at your company set these, and they win over your own settings. Crossview only reads them. To change one, ask your admin.");
    const hk = (A.checks || {}).items || [];
    add("checks", "Automatic checks", hk.length ? `${plural(hk.length, "check")}, ${hk[0].when}` : "none set up", hk.length ? "lit" : "none",
      hk.map((h) => it(h.name, `Runs ${h.when}${h.says ? ` and says "${h.says}"` : ""}`, "lit")), Math.max(1, hk.length),
      "These are small scripts the app runs on its own at set times, like the start of a chat.");
    if (tool === "Claude Code") {
      const ins = G.instruction_list || [], mem = A.memory || {};
      add("instructions", "Rule files it reads in every chat", `${plural(ins.length, "rule file")}, plus ${mem.notes || 0} of Claude's notes`, "lit",
        ins.slice().sort((a, b) => b.words - a.words).map((f, i, all) => { const seg = String(f.where).split("/").pop(), nm = (G.folder_names || {})[seg] || seg, twice = all.filter((g) => ((G.folder_names || {})[String(g.where).split("/").pop()] || String(g.where).split("/").pop()) === nm).length > 1; return it(twice && nm !== seg ? `${nm} (${seg})` : nm, `${f.words.toLocaleString()} words, changed ${day(f.modified)}`, "lit"); })
          .concat([it("Claude's notes", `${mem.notes || 0} notes across ${mem.folders || 0} projects`, "lit"), it("How Claude writes to you", (mem.styles || []).join(", ") || "Default", "lit")]),
        3, "A rule file is a set of instructions Claude reads at the start of every chat in its folder. Claude Code calls it CLAUDE.md. The logs don't show which parts Claude followed.");
    } else if (tool === "Codex") {
      const n = (A.instructions || {}).files || 0;
      add("instructions", "Rule files it reads (AGENTS.md)", n ? `${plural(n, "rule file")} in your projects` : "none found", n ? "lit" : "none",
        [it("Rule files written for Codex", `${n} in your project folders`, n ? "lit" : "none"), it("Its own notes", "A notes file in its folder", "lit")], 3,
        "Codex reads the rule file in the folder it works in. Codex's rule files are named AGENTS.md.");
    } else {
      add("instructions", "Rule files it reads in every chat", "kept in the Claude app", "none",
        [it("Project instructions", "Set in the Claude app, where Crossview can't read them", "none")], 3, "");
    }
    const quiet = tool === "Cowork" && p > G.cowork_end;
    add("ai", "The chat you type in", quiet ? `no record on this Mac after ${day(G.cowork_end)}` : `${tool}, ${plural(app.sessions || 0, "chat")} ${words()}`, app.sessions ? "lit" : "dim",
      [it(`Chats ${words()}`, quiet ? "No record on this Mac" : String(app.sessions || 0), app.sessions ? "lit" : "dim"), it("Chats in all your logs", String(appAll.sessions || 0), "lit"),
        it(`Pay-per-use price ${words()}`, app.usd ? `${money(app.usd)}, what this work would cost at published per-use prices` : "None logged", app.usd ? "lit" : "dim"),
        it("Share done by subagents", !((G.machine || {}).seen || { subagents: ["Claude Code", "Cowork"] }).subagents.includes(tool) ? "Not recorded in its logs" : app.usd ? `${Math.round((100 * (app.helper_usd || 0)) / app.usd)}% ${words()}` : appAll.usd ? `${Math.round((100 * (appAll.helper_usd || 0)) / appAll.usd)}% in all your logs` : "None", "lit")],
      1, "It reads the rule files on the layers below, and calls in the subagents, skills and connectors on the layers above.");
    // helpers
    let hl = [];
    // the front door counts a helper type across apps; here only this app's runs light it, and runs from another app are named
    const elsewhere = (type) => TOOLS.filter((t) => t !== tool).map((t) => [t, usedIn(p, t).helpers[type] || 0]).filter(([, n]) => n);
    const other = (type) => { const e = elsewhere(type); return e.length && !wk.helpers[type] ? `${e.map(([t, n]) => `${plural(n, "run")} ${words()} from ${t}`).join(", ")}, ` : ""; };
    // the logs name a subagent only by its name: when a project has one with the same name as yours, its runs count once, under yours
    const hNow = (a) => (a.same_name && a.origin !== "Made by you" ? 0 : wk.helpers[a.name]);
    if (tool === "Claude Code") hl = G.agents.map((a) => it(a.name, `${a.origin} · ${hNow(a) ? `${plural(hNow(a), "run")} ${words()}, ` : other(a.name)}${a.runs ? `${plural(a.runs, "run")} since ${since(tool)}, last on ${day(a.last)}` : (since(tool) ? `no runs since the logs start on ${since(tool)}` : "no runs in the logs on this Mac")}`, hNow(a) ? "lit" : a.runs ? "dim" : "none", { key: a.same_name ? `${a.name} (${a.origin})` : a.name, plain: a.same_name ? `${a.plain || ""} Another subagent is also named ${a.name}. The logs record only the name, so both show the same runs.`.trim() : a.plain, file: a.file, runsNow: hNow(a) || 0, uses: a.runs || 0, unit: "run", origin: a.origin, last: a.last }));
    else hl = Object.entries(ever.helpers).map(([type, n]) => it(type, `Came with ${tool} · ${wk.helpers[type] ? `${plural(wk.helpers[type], "run")} ${words()}, ` : ""}${plural(n, "run")} since ${since(tool)}`, wk.helpers[type] ? "lit" : "dim", { key: type, runsNow: wk.helpers[type] || 0, uses: n, unit: "run", origin: "Came with the app" }));
    hl.sort((a, b) => b.runsNow - a.runsNow || (a.state === "dim" ? 0 : 1) - (b.state === "dim" ? 0 : 1));
    const yours = tool === "Claude Code" ? G.agents.filter((a) => a.origin !== "Came with Claude Code").length : 0, never = hl.filter((h) => h.state === "none").length;
    add("helpers", "Subagents it calls in", hl.length ? (tool === "Claude Code" ? `${yours} made by you${yours - G.agents.filter((a) => a.origin === "Made by you").length ? `, ${yours - G.agents.filter((a) => a.origin === "Made by you").length} of them for one project` : ""}, ${hl.length - yours} came with Claude Code${never ? `, ${never} never run` : ""}` : `${plural(hl.length, "subagent")} that came with the app`) : tool === "Codex" ? "Crossview can't read Codex's subagents yet" : "none in its logs",
      hl.some((h) => h.state === "lit") ? "lit" : hl.length ? "dim" : "none", hl, 9,
      tool === "Claude Code" ? "A subagent is a separate AI with its own instructions, which Claude Code can hand part of a job to. The ones you made are files in a folder named agents, in your home folder or in a project." : "A subagent is a separate AI with its own instructions, which the app can hand part of a job to.");
    // the drawing's label has room for a short line; the panel keeps the whole count (release 3: it ran past the card at 1000)
    if (tool === "Claude Code" && hl.length) L[L.length - 1].short = `${yours} made by you, ${hl.length - yours} came with Claude Code`;
    // skills
    let sk = [];
    // a skill is lit for the week shown if Claude Code called it in a chat that started that week
    const skw = (G.skill_weeks || {})[p] || (p === G.week_start ? Object.fromEntries(G.skills.filter((k) => k.week).map((k) => [k.name, k.week])) : {});
    if (tool === "Claude Code") sk = G.skills.map((k) => it(k.name, `${k.origin}${skw[k.name] ? ` · ${plural(skw[k.name], "use")} ${words()}` : ""}${k.uses ? ` · ${plural(k.uses, "use")} since ${since(tool)}, last on ${day(k.last)}` : (since(tool) ? ` · not used since the logs start on ${since(tool)}` : " · not used in the logs on this Mac")}`, skw[k.name] ? "lit" : k.uses ? "dim" : "none", { plain: k.plain, uses: k.uses || 0, runsNow: skw[k.name] || 0, unit: "use", origin: k.origin, last: k.last }));
    else if (tool === "Cowork") sk = G.skills.filter((k) => k.origin === "From your Claude account").map((k) => it(k.name, "From your Claude account · Crossview can't count its use in Cowork", "dim", { plain: k.plain }));
    else sk = ((A.skills || []).map((n) => it(n, "Skill", "dim"))).concat((A.plugins || []).map((n) => it(n, `${(A.bundled || []).includes(n) ? "Came with Codex" : "Add-on"}${window.GBStage.actsAsYou(n) ? " · can act as you" : ""}`, "dim", window.GBStage.actsAsYou(n) ? { risky: true, as_you: true, reach: "can act as you" } : {})));
    const skNever = sk.filter((s) => s.state === "none").length;
    add("skills", tool === "Codex" ? "Skills and add-ons" : "Skills", sk.length ? `${sk.length} in all${skNever ? `, ${skNever} never used` : ""}` : "none found", sk.some((s) => s.state === "lit") ? "lit" : sk.length ? "dim" : "none",
      sk.sort((a, b) => ({ lit: 0, dim: 1, none: 2 }[a.state] - { lit: 0, dim: 1, none: 2 }[b.state])), 25,
      tool === "Codex" ? "A skill is a set of instructions for one kind of task, which Codex loads when that task comes up. Add-ons (Codex calls them plugins) give Codex more tools; the ones that work your screen or your own Chrome can act as you. Crossview can't count Codex's skill and add-on use yet." : "A skill is a set of instructions for one kind of task, which Claude or a subagent loads when that task comes up.");
    // connectors
    let cn = [];
    if (tool === "Codex") cn = (A.connectors || []).map((n) => it(n, window.GBStage.actsAsYou(n) ? "Set up in its settings · can act as you" : "Set up in its settings", "dim", window.GBStage.actsAsYou(n) ? { risky: true, as_you: true, reach: "can act as you" } : {}));
    else {
      // the desktop app's own controls come as several connectors with one name: show them as one
      const merged = {};
      (M.ports || []).filter((pt) => !pt.built_in && (tool === "Cowork" ? pt.group === "account" : true)).forEach((pt) => {
        const m = merged[pt.name];
        if (!m) merged[pt.name] = Object.assign({}, pt, { ids: [pt.id], kinds: (pt.kinds || []).slice(), did: (pt.did || []).slice() });
        else { m.actions += pt.actions; m.ids.push(pt.id); (pt.kinds || []).forEach((k) => { if (!m.kinds.includes(k)) m.kinds.push(k); }); (pt.did || []).forEach((k) => { if (!m.did.includes(k)) m.did.push(k); }); m.set_up_only = m.set_up_only && pt.set_up_only; m.as_you = m.as_you || pt.as_you; m.reach = m.reach || pt.reach; m.outside = m.outside || pt.outside; m.from_list = m.from_list || pt.from_list; }
      });
      const ORDER = ["read", "change", "send", "delete"];
      cn = Object.values(merged).map((pt) => {
        pt.kinds.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
        const usedNow = pt.ids.some((id) => wk.ports[id]);
        const wkUses = pt.ids.reduce((a, id) => a + ((ever.ports || {})[id] || 0), 0), firstWk = Object.keys(M.periods || {}).filter((k) => k !== "all").sort()[0];
        if (wkUses > (pt.actions || 0)) { pt.actions = wkUses; pt.since = firstWk; }
      const can = (pt.kinds || []).join(", "), did = (pt.did || []).join(", "), grp = pt.group === "account" ? "From your Claude account" : pt.group === "app" ? "Built into the desktop app" : "Set up on this Mac";
      return it(pt.name, `${grp}${pt.actions ? ` · ${pt.actions.toLocaleString()} ${pt.actions === 1 ? "use" : "uses"} since ${pt.since ? day(pt.since) : since("Claude Code")}` : " · never used"}${can ? ` · can ${can}` : ""}${did && did !== can ? ` · so far has ${and((pt.did || []).map((k) => ({ change: "changed", send: "sent", delete: "deleted" })[k] || k))}` : ""}`, usedNow && tool === "Claude Code" ? "lit" : pt.actions ? "dim" : "none",
        { risky: riskWords.hot(pt), out1: riskWords.outside(pt), line1: riskWords.line(pt), reach: riskOf(pt) ? riskWords(pt) : "", uses: pt.actions || 0, unit: "use", kinds: pt.kinds || [], did: pt.did || [], outside: !!pt.outside, as_you: !!pt.as_you });
      });
    }
    cn.sort((a, b) => ({ lit: 0, dim: 1, none: 2 }[a.state] - { lit: 0, dim: 1, none: 2 }[b.state]));
    const risky = cn.filter((c) => c.out1).length;  // the same count as Your week's (QA run 8, finding 1)
    add("connectors", "Connectors to other apps", cn.length ? `${cn.length} connected${risky ? `, ${risky} can act outside your Mac` : ""}` : "none found", cn.some((c) => c.state === "lit") ? "lit" : cn.length ? "dim" : "none", cn, 6,
      `A connector is a link to another app, like your browser, Gmail or Google Drive. ${tool === "Codex" ? "Codex's" : "Claude's"} settings call them MCP servers.${tool === "Codex" ? "" : " Tools built into the Claude app aren't counted here."}`);
    // projects
    const pw = G.work.filter((w) => (w.tools || {})[tool]).map((w) => it(workName(w.name), `${plural(w.tools[tool], "chat")} with ${tool} in all, last on ${day(w.last)}`, wk.works[w.name] ? "lit" : "dim", { work: w.name, uses: w.tools[tool] || 0, unit: "chat", last: w.last }));
    pw.sort((a, b) => (a.state === "lit" ? 0 : 1) - (b.state === "lit" ? 0 : 1));
    const busyN = pw.filter((x) => x.state === "lit").length;
    add("projects", "Your projects", pw.length ? `${plural(pw.length, "project")}, ${busyN} busy ${words()}` : "none", busyN ? "lit" : pw.length ? "dim" : "none", pw, 4,
      "A project is one of your project folders, and Crossview groups your chats by project. Click one to open it in Your work.");
    if (!app.sessions) L.forEach((l) => { if (l.state === "lit") l.state = "dim"; l.items.forEach((x) => { if (x.state === "lit") x.state = "dim"; }); });
    L.works = wk.works;
    return L;
  }


  // ---------- the exploded drawing ----------
  const CX = 500, PW = 160, PH = 70, TOP = 82;
  let GAP = 78;  // a tenth layer (settings your company set) packs the plates a little closer, so the drawing keeps its size
  const P = (y, i, j) => [CX + (i - j) * PW, y - PH + (i + j) * PH];
  const pts = (a) => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  function slab(y, t, cls) {
    const a = P(y, 0, 0), b = P(y, 1, 0), c = P(y, 1, 1), d = P(y, 0, 1), dn = (q) => [q[0], q[1] + t];
    return `<polygon class="a-side l ${cls}" points="${pts([d, c, dn(c), dn(d)])}"/><polygon class="a-side r ${cls}" points="${pts([c, b, dn(b), dn(c)])}"/><polygon class="a-top ${cls}" points="${pts([a, b, c, d])}"/>`;
  }
  function block(y, i, j, si, sj, h, cls) {
    const a = P(y, i, j), b = P(y, i + si, j), c = P(y, i + si, j + sj), d = P(y, i, j + sj), up = (q) => [q[0], q[1] - h];
    return `<g class="a-blk ${cls}"><polygon class="l" points="${pts([d, c, up(c), up(d)])}"/><polygon class="r" points="${pts([c, b, up(b), up(c)])}"/><polygon class="t" points="${pts([up(a), up(b), up(c), up(d)])}"/>${cls === "lit" || cls === "core" ? `<circle cx="${P(y, i + si / 2, j + sj / 2)[0].toFixed(1)}" cy="${(P(y, i + si / 2, j + sj / 2)[1] - h).toFixed(1)}" r="2.6" class="a-dot"/>` : ""}</g>`;
  }
  // what sits on each plate: a shape for each kind of part, filled from the front corner back
  function front(grid) { const c = []; for (let a = 0; a < grid; a++) for (let b = 0; b < grid; b++) c.push([a, b]); return c.sort((x, y) => y[0] + y[1] - (x[0] + x[1]) || x[0] - y[0]); }
  function contents(L, y) {
    const ls = L.state === "lit" ? "lit" : L.state === "none" ? "none" : "plain";
    const st = (k) => { const x = L.items[k], v = x ? x.state : L.state; return v === "lit" ? "lit" : v === "none" ? "none" : "plain"; };
    let g = "";
    if (L.id === "ai") return block(y, 0.38, 0.38, 0.24, 0.24, 8, L.state === "lit" ? "core" : "core dim");
    if (L.id === "instructions") { for (let k = 0; k < 3; k++) g += block(y, 0.3 - k * 0.04, 0.3 + k * 0.04, 0.42, 0.32, 2 + k * 3, ls); return g; }  // a stack of pages
    if (L.id === "folder") { [[0.6, 0.16], [0.6, 0.36], [0.16, 0.6], [0.38, 0.62], [0.62, 0.64]].forEach(([i, j], k) => (g += block(y, i, j, 0.12, 0.17, k < 2 ? 14 : 5, ls))); return g; }  // files and folders
    if (L.id === "settings" || L.id === "company") { for (let k = 0; k < 4; k++) { g += block(y, 0.18 + k * 0.17, 0.56, 0.06, 0.32, 2, ls); g += block(y, 0.165 + k * 0.17, 0.6 + (k % 2) * 0.16, 0.09, 0.07, 7, ls); } return g; }  // switches
    if (L.id === "checks") { const n = Math.max(1, Math.min(3, L.items.length)); for (let k = 0; k < n; k++) g += block(y, 0.64 - k * 0.2, 0.64, 0.15, 0.15, 10, L.items.length ? ls : "none"); return g; }
    if (L.id === "connectors") { [[0.86, 0.14], [0.86, 0.42], [0.86, 0.7], [0.14, 0.86], [0.42, 0.86], [0.7, 0.86]].slice(0, Math.max(1, Math.min(6, L.items.length))).forEach(([i, j], k) => (g += block(y, i - 0.05, j - 0.05, 0.1, 0.1, 11, L.items.length ? st(k) : "none"))); return g; }  // ports on the edge
    const spec = { helpers: [3, 0.6, 9], skills: [5, 0.55, 3], projects: [2, 0.66, 7] }[L.id] || [2, 0.6, 8];
    const grid = spec[0], cell = 1 / grid, size = cell * spec[1], cells = front(grid), n = Math.max(1, Math.min(L.items.length, grid * grid));
    for (let k = 0; k < n; k++) { const [a, b] = cells[k]; g += block(y, a * cell + (cell - size) / 2, b * cell + (cell - size) / 2, size, size, spec[2], L.items.length ? st(k) : "none"); }
    return g;
  }
  function drawing(L, sel) {
    GAP = L.length > 9 ? Math.round((78 * 8) / (L.length - 1)) : 78;
    const n = L.length, ys = L.map((_, k) => TOP + (n - 1 - k) * GAP);
    let g = `<line x1="${CX}" y1="${ys[n - 1] - PH - 14}" x2="${CX}" y2="${ys[0] + PH + 24}" class="a-axis"/>`;
    L.forEach((l, k) => {
      const y = ys[k], on = l.id === sel;
      g += `<g class="a-plate ${l.state}${on ? " sel" : ""}${l.id === "ai" ? " core" : ""}" data-a="layer:${l.id}" tabindex="0" role="button" aria-pressed="${on}" aria-label="${esc(`${l.title}: ${l.line}`)}" style="--from:${((n - 1) / 2 - k) * GAP * 0.55}px;--d:${k * 45}ms">${slab(y, l.id === "ai" ? 16 : 9, l.state)}${contents(l, y)}</g>`;
    });
    // labels: the dot at the end of each leader is the layer's light (lit, dimmed or dashed); the open layer is drawn in ink
    L.forEach((l, k) => {
      const y = ys[k], left = k % 2 === 0, cx = left ? CX - PW : CX + PW, x2 = left ? cx - 34 : cx + 34, tx = left ? x2 - 8 : x2 + 8, anc = left ? "end" : "start", on = l.id === sel;
      g += `<g class="a-label${on ? " sel" : ""} ${l.state}" data-a="layer:${l.id}"><line x1="${cx}" y1="${y}" x2="${x2}" y2="${y}"/><circle cx="${x2}" cy="${y}" r="3.5" class="a-lamp"/>
        <text x="${tx}" y="${y - 3}" text-anchor="${anc}" class="a-t">${esc(l.title)}</text><text x="${tx}" y="${y + 15}" text-anchor="${anc}" class="a-s">${esc(l.short || l.line)}</text>${on ? `<text x="${tx}" y="${y + 33}" text-anchor="${anc}" class="a-o">Details are in the panel</text>` : ""}</g>`;
    });
    return `<svg class="a-svg${S.aExploded ? "" : " explode"}" viewBox="-110 0 1220 800" role="group" aria-label="How ${esc(S.atool)} is built, layer by layer">${g}</svg>`;
  }

  // ---------- the panel on the right ----------
  // Milan's picks and notes, Oct 13: rings for how much of it you use, tiles for which ones, and for connectors a grid of
  // what each can do. The rings and their key filter the list; a tile's details open where you clicked; nothing scrolls.
  const within30 = (d) => d && (new Date(G.today + "T12:00:00") - new Date(d + "T12:00:00")) / 864e5 <= 30;
  const yoursOf = (l, x) => (l.id === "skills" ? x.origin === "Made by you" || /^Only in/.test(x.origin || "") : l.id === "helpers" ? !!x.origin && !/^Came with/.test(x.origin) : false);
  const counted = (l) => l.items.some((x) => typeof x.uses === "number");
  // the rings, outside in: how many were ever used (grey, an amount), how many are lit in the week shown (orange),
  // and how many of your own were used (blue, a category)
  function ringSpec(l) {
    const xs = l.items, n = xs.length, verb = l.id === "helpers" ? "Ran" : l.id === "projects" ? "Worked on" : "Used";
    const R = [l.id === "projects" ? { key: "used", label: "In the last 30 days", short: "30 days", test: (x) => within30(x.last), tone: "amt" }
      : { key: "used", label: `${verb} at least once`, short: verb === "Ran" ? "ran" : "used", test: (x) => x.uses > 0, tone: "amt" }];
    R.push({ key: "lit", label: l.id === "projects" ? `Busy ${words()}` : l.id === "helpers" && S.atool !== "Codex" ? `${verb} ${words()}` : `${verb} ${words()}`, short: words(), test: (x) => x.state === "lit", tone: "lit" });
    const yours = xs.filter((x) => yoursOf(l, x));
    if (yours.length) R.push({ key: "yours", label: l.id === "helpers" ? "Made by you, ran" : "Made by you, used", short: "yours", test: (x) => yoursOf(l, x) && x.uses > 0, of: yours.length, tone: "cat" });
    R.forEach((r) => { r.v = xs.filter(r.test).length; r.of = r.of || n; });
    return R;
  }
  const never = (l) => l.items.filter((x) => x.uses === 0);
  function filtered(l) {
    const R = ringSpec(l), r = R.find((x) => x.key === S.afilter);
    let xs = S.afilter === "never" ? never(l) : r ? l.items.filter(r.show || r.test) : l.items;
    if (counted(l)) xs = xs.slice().sort((a, b) => (b.uses || 0) - (a.uses || 0) || (b.runsNow || 0) - (a.runsNow || 0));
    return { xs, label: S.afilter === "never" ? (l.id === "helpers" ? "never run" : "never used") : r ? r.label.toLowerCase() : "all" };
  }
  function rings(l) {
    const R = ringSpec(l), radii = [52, 41, 30], on = R.find((r) => r.key === S.afilter);
    const arcs = R.map((r, i) => {
      const C = 2 * Math.PI * radii[i], f = r.of ? r.v / r.of : 0;
      return `<g class="a-ring-g ${r.tone}${S.afilter === r.key ? " on" : S.afilter !== "all" ? " off" : ""}" data-a="filter:${r.key}"><circle cx="60" cy="60" r="${radii[i]}" class="a-ring-track"/><circle cx="60" cy="60" r="${radii[i]}" class="a-ring" stroke-dasharray="${(C * f).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/><circle cx="60" cy="60" r="${radii[i]}" class="a-ring-hit"/></g>`;
    }).join("");
    // the number in the middle belongs to one ring and wears its color: the outer ring until you pick another
    const show = on || R[0], nv = never(l).length, pct = show.of ? Math.round((100 * show.v) / show.of) : 0;
    const mid = `<text x="60" y="62" text-anchor="middle" class="a-ring-big ${show.tone}">${pct}%</text><text x="60" y="75" text-anchor="middle" class="a-ring-sm">${esc(show.short)}</text>`;
    const leg = R.map((r) => `<button class="a-leg ${r.tone}" data-a="filter:${r.key}" aria-pressed="${S.afilter === r.key}" data-tip="${esc("Click to list only these. Click again to list them all.")}"><i></i><span>${esc(r.label)}</span><b>${r.v} of ${r.of}</b></button>`).join("")
      + (counted(l) && l.id !== "projects" ? `<button class="a-leg never" data-a="filter:never" aria-pressed="${S.afilter === "never"}" ${nv ? "" : "disabled"} data-tip="${esc(nv ? `Click to list only the ones that have never ${l.id === "helpers" ? "run" : "been used"}. Click again to list them all.` : l.id === "helpers" ? "Every one has run at least once." : "Every one has been used.")}"><i></i><span>${l.id === "helpers" ? "Never run" : "Never used"}</span><b>${nv}</b></button>` : "");
    return `<div class="a-rings"><svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="${esc(R.map((r) => `${r.label}: ${r.v} of ${r.of}`).join("; "))}">${arcs}${mid}</svg>
      <div class="a-ring-leg" role="group" aria-label="Show only">${leg}</div></div>`;
  }
  // where each one came from, as one category color: yours solid, your account and add-ons outlined, one project light, built in grey
  const catOf = (g) => (g === "Made by you" ? "mine" : /^Only in/.test(g) ? "proj" : /^From /.test(g) ? "acct" : /^Came with/.test(g) ? "built" : "none");
  const ORDER = ["Made by you", "Came with Claude Code", "From your Claude account", "Came with the app"];
  // the shelves say whose and where, so the ring's "Yours" is plainly their sum (camera fix batch, Oct 15)
  const shelfName = (g) => (g === "Made by you" ? "Made by you, for every project" : /^Only in /.test(g) ? g.replace(/^Only in /, "Made by you, only in ") : g);
  function tiles(l) {
    const max = Math.max(1, ...l.items.map((x) => x.uses || 0)), lvl = (u) => (!u ? "t0" : u >= 0.6 * max ? "t4" : u >= 0.3 * max ? "t3" : u >= 0.12 * max ? "t2" : "t1");
    const groupOf = (x) => (l.id === "projects" ? (x.state === "lit" ? `Busy ${words()}` : `Not busy ${words()}`) : x.origin || "Other");
    const groups = {}, shown = new Set(filtered(l).xs);
    l.items.forEach((x) => (groups[groupOf(x)] = groups[groupOf(x)] || []).push(x));
    const rank = (g) => { const i = ORDER.indexOf(g); return g.startsWith("Busy") ? -1 : i < 0 ? (g.startsWith("Only in") ? 1.5 : 9) : i; };
    return `<div class="a-tiles">${Object.keys(groups).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map((g) => {
      const xs = groups[g].slice().sort((a, b) => (b.uses || 0) - (a.uses || 0)), u = xs.filter((x) => x.uses > 0).length;
      return `<div class="a-shelf"><div class="a-shelf-h"><span>${l.id === "projects" ? "" : `<i class="a-cat ${catOf(g)}" aria-hidden="true"></i>`}${esc(shelfName(g))}</span><b>${u} of ${xs.length} ${l.id === "projects" ? "with chats" : l.id === "helpers" ? "ran" : "used"}</b></div>
        <div class="a-shelf-t">${xs.map((x) => `<button class="a-tile ${lvl(x.uses)}${x.state === "lit" ? " lit" : ""}${S.asel && (S.asel === x.name || S.asel === x.key) ? " on" : ""}${shown.has(x) ? "" : " out"}" data-a="pick:${esc(x.key || x.name)}" data-tip="${esc(`${x.name} ${x.uses ? (x.unit === "run" ? `has run ${plural(x.uses, "time")}` : x.unit === "chat" ? `has ${plural(x.uses, "chat")}` : `has been used ${plural(x.uses, "time")}`) + " in all" : x.unit === "run" ? "has never run" : "has never been used"}${x.state === "lit" ? `, including ${words()}` : ""}. Click it to see more.`)}" aria-label="${esc(x.name)}"></button>`).join("")}</div></div>`; }).join("")}
      <div class="a-key"><span><i class="a-tile t0"></i>Never used</span><span><i class="a-tile t1"></i><i class="a-tile t2"></i><i class="a-tile t3"></i><i class="a-tile t4"></i>Used less to more</span><span><i class="a-tile t2 lit"></i>Used ${esc(words())}</span></div></div>`;
  }
  function canDo(l) {
    const cols = ["read", "change", "send", "delete"], xs = l.items.slice().sort((a, b) => (b.uses || 0) - (a.uses || 0)), max = Math.max(1, ...xs.map((x) => x.uses || 0)), shown = new Set(filtered(l).xs);
    return `<div class="a-cando" role="table" aria-label="What each connector can do"><div class="a-cd-h" role="row"><span></span>${cols.map((c) => `<span role="columnheader">${c[0].toUpperCase() + c.slice(1)}</span>`).join("")}<span>Uses</span></div>
      ${xs.map((x) => `<button class="a-cd-r${S.asel === x.name ? " on" : ""}${shown.has(x) ? "" : " out"}" data-a="pick:${esc(x.name)}" role="row" data-tip="${esc(`${x.name} ${x.uses ? `has been used ${plural(x.uses, "time")}` : "is set up but has never been used"}.${x.kinds.length ? ` It can ${x.kinds.join(", ")}.` : ""}${x.reach ? ` It ${x.reach}.` : ""} Click it to see more.`)}"><b><i class="a-st ${x.state}" aria-hidden="true"></i>${esc(x.name)}</b>${cols.map((c) => { const can = x.kinds.includes(c), did = (x.did || []).includes(c), hot = can && (x.as_you || (x.outside && (c === "send" || c === "delete"))); return `<i class="${!can ? "off" : `${did ? "did" : "can"}${hot ? " hot" : ""}`}" aria-label="${!can ? "Can't " + c : did ? "Can " + c + " and has done it" : "Can " + c + " but hasn't yet"}"></i>`; }).join("")}<span class="a-cd-u"><em style="width:${x.uses ? Math.max(5, Math.round((100 * Math.sqrt(x.uses)) / Math.sqrt(max))) : 0}%"></em></span></button>`).join("")}
      <p class="a-cd-note"><span><i class="did" aria-hidden="true"></i>Has done it</span><span><i class="can" aria-hidden="true"></i>Allowed but not done yet</span><span><i class="did hot" aria-hidden="true"></i>${esc(riskWords.key)}</span></p>
      <p class="a-cd-note">Crossview reads what each connector can do from the actions it offers in your logs. A connector that works in your own Chrome can do anything you can do there.</p></div>`;
  }
  // a tile's or a connector's details, opened next to what you clicked, over the list (nothing moves or scrolls)
  function peek(l) {
    if (!S.asel) return "";
    const x = l.items.find((y) => y.key === S.asel || y.name === S.asel);
    if (!x) return "";
    const can = x.line1 ? `<p class="a-peek-can">${esc(x.line1)}${x.did && x.did.length ? ` So far it has ${and(x.did.map((k) => ({ change: "changed", send: "sent", delete: "deleted" })[k] || k))} things.` : " It hasn't been used yet."}</p>` : x.kinds && x.kinds.length ? `<p class="a-peek-can">It can ${and(x.kinds)} things.</p>` : "";
    return `<div class="a-peek" role="dialog" aria-label="${esc(x.name)}"><i class="a-peek-arrow" aria-hidden="true"></i>
      <header><i class="a-st ${x.state}" aria-hidden="true"></i><b>${esc(x.name)}</b><button class="a-peek-x" data-a="pick:${esc(x.key || x.name)}" aria-label="Close">×</button></header>
      <small>${esc(can ? x.sub.replace(/ · can [a-z, ]+( · so far has [a-z, ]+)?$/, "") : x.sub)}</small>${x.plain ? `<p>${esc(x.plain)}</p>` : ""}${can}${x.file ? `<code>${esc(x.file)}</code>` : ""}${x.work ? `<button class="w-link" data-nwork="${esc(x.work)}">Open it in Your work</button>` : ""}</div>`;
  }
  function viz(l) {
    if (!["skills", "helpers", "connectors", "projects"].includes(l.id) || !l.items.length || !counted(l)) return "";
    return `<div class="a-viz">${rings(l)}${l.id === "connectors" ? canDo(l) : tiles(l)}${peek(l)}</div>`;
  }
  const and = (a) => (a.length > 1 ? a.slice(0, -1).join(", ") + " and " + a[a.length - 1] : a[0] || "");
  const top3 = (xs) => xs.filter((x) => x.uses > 0).sort((a, b) => b.uses - a.uses).slice(0, 3).map((x) => x.name).join(", ");
  function insight(l) {
    const xs = l.items, used = xs.filter((x) => x.uses > 0), nv = xs.filter((x) => x.uses === 0);
    if (l.id === "skills" && S.atool === "Claude Code") { const addOn = nv.filter((x) => /^From /.test(x.origin || "")).length;
      return { say: `You've used ${used.length} of these ${xs.length} skills${used.length ? `, most often ${and(top3(xs).split(", "))}` : ""}. ${nv.length} have never been used${addOn ? `, and ${addOn} of those came from your Claude account` : ""}.`, could: "Claude reads the name and description of every skill at the start of each chat, including the ones you never use. Turning off the ones you don't need takes them off that list." }; }
    if (l.id === "helpers" && used.length) return { say: `Since ${since(S.atool)}, ${and(top3(xs).split(", "))} ${used.length === 1 ? "has" : "have"} run the most. ${nv.length ? `${plural(nv.length, "subagent")} ${nv.length === 1 ? "has" : "have"} never run.` : "Every subagent has run at least once."}`, could: nv.length ? "If a subagent never runs, you can rewrite its description so Claude picks it, or remove it. Open one to see its file." : "" };
    if (l.id === "connectors" && used.length) { const r = xs.filter((x) => x.out1); return { say: `Since ${since(S.atool)}, you've used ${and(top3(xs).split(", "))} the most.${r.length ? ` ${r.length === 1 ? `${r[0].name} can act outside your Mac` : `${r.length} of your connectors can act outside your Mac: ${and(r.map((x) => x.name))}`}.` : ""}`, could: r.length ? "You can set a connector that sends, deletes or acts as you to ask before each use. That's in the settings of the app that uses it." : "" }; }
    if (l.id === "projects" && used.length) return { say: `The projects with the most chats are ${and(top3(xs).split(", "))}.`, could: "" };
    return null;
  }
  function panel(L, sel) {
    const k = L.findIndex((l) => l.id === sel), l = L[k];
    if (!l) return "";
    const max = Math.max(1, ...l.items.map((x) => x.uses || 0));
    const valid = ["all", "never"].concat(ringSpec(l).map((r) => r.key));
    if (!valid.includes(S.afilter) || (S.afilter === "never" && !never(l).length)) S.afilter = "all";
    const F = filtered(l), ins = insight(l);
    const row = (x) => {
      const pk = S.asel && (x.key === S.asel || x.name === S.asel) ? " picked" : "";
      const extra = x.plain || x.file ? `<p>${esc(x.plain || "")}${x.file ? `<br><code>${esc(x.file)}</code>` : ""}</p>` : "";
      const bar = counted(l) && x.uses > 0 ? `<i class="a-bar${x.state === "lit" ? " lit" : ""}" style="width:${Math.max(3, Math.round((100 * x.uses) / max))}%" aria-hidden="true"></i>` : "";
      const asYou = / · can act as you$/.test(x.sub || ""), sub0 = asYou ? x.sub.replace(/ · can act as you$/, "") : x.sub;
      const inner = `<i class="a-st ${x.state}" aria-hidden="true"></i><span><b>${esc(x.name)}${asYou ? ' <em class="q-tag hot">can act as you</em>' : ""}</b><small>${esc(sub0)}</small>${bar}</span>`;
      if (x.work) return `<li class="a-row ${x.state}${pk}"><button class="a-rowb" data-nwork="${esc(x.work)}">${inner}<em>Open ›</em></button></li>`;
      return extra ? `<li class="a-row ${x.state}${pk}"><details><summary>${inner}</summary>${extra}</details></li>` : `<li class="a-row ${x.state}${pk}"><div class="a-rowb">${inner}</div></li>`;
    };
    return `<aside class="a-panel w-mod" aria-label="${esc(l.title)}"><i class="w-screw tl"></i><i class="w-screw tr"></i><i class="w-screw bl"></i><i class="w-screw br"></i>
      <header class="a-ph"><div class="a-step" role="group" aria-label="Move between layers"><button class="w-btn w-sbtn" data-a="step:1" ${k === L.length - 1 ? "disabled" : ""} data-tip="Go to the layer above. The ↑ key does the same."><span aria-hidden="true">▲</span> Above</button><span class="a-chip">Layer ${L.length - k} of ${L.length}</span><button class="w-btn w-sbtn" data-a="step:-1" ${k === 0 ? "disabled" : ""} data-tip="Go to the layer below. The ↓ key does the same."><span aria-hidden="true">▼</span> Below</button></div></header>
      <h3>${esc(l.title)}</h3><p class="a-line">${esc(((t) => t.charAt(0).toUpperCase() + t.slice(1))(String(l.short || l.line || "")))}</p>
      ${viz(l)}
      ${ins ? `<div class="a-insight"><p>${esc(ins.say)}</p>${ins.could ? `<small>${esc(ins.could)}</small>` : ""}</div>` : ""}
      ${l.items.length > 4 && counted(l) ? `<div class="a-lh"><span>Showing <b>${esc(F.label)}</b> · ${F.xs.length}${counted(l) && ["helpers", "skills", "connectors"].includes(l.id) && S.atool !== "Codex" ? ` · counted since ${esc(since(S.atool))}` : ""}</span>${S.afilter !== "all" ? '<button class="w-link" data-a="filter:all">Show all</button>' : "<span>Most used first</span>"}</div>` : ""}
      <ul class="a-list">${F.xs.length ? F.xs.map(row).join("") : `<li class="a-row none"><div class="a-rowb"><i class="a-st none"></i><span><b>Nothing to show</b><small>${/can't/.test(l.line || "") ? "Crossview can't read these yet" : "Crossview found none on this Mac"}</small></span></div></li>`}</ul>
      ${l.foot && (!ins || ins.could !== l.foot) ? `<p class="a-foot">${esc(l.foot)}</p>` : ""}
</aside>`;
  }

  function board() {
    // someone who only uses Codex opens on Codex, the same as on Your week (QA of the walk, Oct 17)
    const R0 = G.ranges || {}, codexOnly = R0.Codex && !R0["Claude Code"] && !R0.Cowork;
    if (!S.atool || !TOOLS.includes(S.atool)) S.atool = codexOnly && TOOLS.includes("Codex") ? "Codex" : "Claude Code";
    if (!S.afilter) S.afilter = "all";
    const L = layers(S.atool);
    if (!S.alayer || !L.find((l) => l.id === S.alayer)) S.alayer = S.atool === "Codex" && codexOnly ? "skills" : "helpers";  // Crossview can't read Codex's subagents yet, so a Codex-only user starts on its skills
    const ws = Object.entries(L.works || {}).filter(([, u]) => u > 0).sort((a, b) => b[1] - a[1]), use = ws.reduce((a, [, u]) => a + u, 0) || 1;
    // one sentence on top, like every other tab (QA run 3)
    const cnt = (id) => ((L.find((l) => l.id === id) || {}).items || []).length, parts = [];
    if (cnt("helpers")) parts.push(plural(cnt("helpers"), "subagent")); if (cnt("skills")) parts.push(plural(cnt("skills"), "skill")); if (cnt("connectors")) parts.push(plural(cnt("connectors"), "connector"));
    const stripSh = shares(ws.map(([, u]) => u)), stripN = ws.slice(0, 2).filter((_, i) => i === 0 || stripSh[i] >= 1).length;  // the strip names projects with 1% or more
    const lead = `<p class="g-lead">Your setup is built in layers, from a folder on this Mac up to your projects.</p>`;
    const html = `${lead}<div class="a-page"><section class="w-mod a-stage"><i class="w-screw tl"></i><i class="w-screw tr"></i><i class="w-screw bl"></i><i class="w-screw br"></i>
        <header class="w-mh"><h3><i class="w-led idle"></i>How ${esc(S.atool)} is built, layer by layer</h3>
          <div class="w-seg" role="group" aria-label="Which app">${TOOLS.map((t) => `<button data-a="tool:${esc(t)}" aria-pressed="${S.atool === t}">${esc(t)}</button>`).join("")}</div>
          <span class="w-mh-note" data-tip="Click any one to see it in the panel, or use the ↑ and ↓ keys.">Click one to see it here · ↑ ↓</span></header>
        <div class="a-canvas">${drawing(L, S.alayer)}</div>
        <div class="w-legend a-key"><span><i class="a-st lit"></i>Used ${words()}</span><span><i class="a-st dim"></i>Not used ${words()}</span><span><i class="a-st none"></i>Never used, or nothing there</span><span><i class="a-cat mine"></i>Blue shows where it came from, such as made by you or from your account</span></div>
        <footer class="a-strip"><span ${tip("A project is one of your project folders. These are the projects this app worked on, each with its share of the app's use. Your work counts all three apps together, so its list can be longer.")}>${ws.length ? `In ${esc(S.atool)}, worked on <b>${plural(ws.length, "project")}</b> ${words()}` : `No projects in ${esc(S.atool)} ${words()}`}</span>${(() => { const sh = shares(ws.map(([, u]) => u)); return ws.slice(0, 2).filter(([, u], i) => i === 0 || sh[i] >= 1).map(([w, u], i) => `<button class="w-link" data-nwork="${esc(w)}">${esc(workName(w))} <b>${u > 0 && sh[i] < 1 ? "under 1%" : sh[i] === 100 && ws.length > 1 ? "over 99%" : sh[i] + "%"}</b></button>`).join(""); })()}${ws.length > stripN ? `<button class="w-link" data-a="layer:projects">and ${ws.length - stripN} more</button>` : ""}</footer>
      </section>${panel(L, S.alayer)}</div>
`;
    S.aExploded = true;
    return html;
  }

  function click(el) {
    const v = el.dataset.a || "";
    if (v.startsWith("tool:")) { S.atool = v.slice(5); S.asel = null; S.afilter = "all"; S.aExploded = false; return true; }
    if (v.startsWith("layer:")) { S.alayer = v.slice(6); S.asel = null; S.afilter = "all"; return true; }
    if (v.startsWith("filter:")) { const f = v.slice(7); S.afilter = S.afilter === f ? "all" : f; S.asel = null; return true; }
    if (v.startsWith("pick:")) { const name = v.slice(5); S.asel = S.asel === name ? null : name; S.apkFocus = !!S.asel; return true; }
    if (v.startsWith("step:")) { const L = layers(S.atool), k = L.findIndex((l) => l.id === S.alayer) + Number(v.slice(5)); if (L[k]) S.alayer = L[k].id; S.asel = null; S.afilter = "all"; return true; }
    return false;
  }
  // the details card opens beside the panel, level with the tile or row you clicked, with an arrow pointing at it, so it
  // covers nothing in the panel; on a narrow screen it opens just under what you clicked. The panel keeps its scroll position.
  function place() {
    const pk = document.querySelector(".a-peek"), viz = pk && pk.closest(".a-viz"), panel = pk && pk.closest(".a-panel");
    if (!pk || !viz || !panel) return;
    const at = viz.querySelector(".a-tile.on, .a-cd-r.on");
    if (!at) { pk.remove(); return; }
    if (S.apkFocus) { const x = pk.querySelector(".a-peek-x"); if (x) x.focus({ preventScroll: true }); S.apkFocus = false; }
    const v = viz.getBoundingClientRect(), r = at.getBoundingClientRect(), P = panel.getBoundingClientRect(), arrow = pk.querySelector(".a-peek-arrow");
    const stage = document.querySelector(".a-stage");
    if (P.left > 360) {
      pk.classList.add("beside"); if (stage) stage.classList.add("peeking");  // the drawing fades behind the card, so no label is half covered
      const h = pk.offsetHeight, cy = r.top + r.height / 2, top = Math.max(76, Math.min(innerHeight - h - 12, cy - h / 2));
      pk.style.left = (P.left - pk.offsetWidth - 14).toFixed(0) + "px"; pk.style.top = top.toFixed(0) + "px";
      arrow.style.left = ""; arrow.style.top = Math.max(12, Math.min(h - 24, cy - top - 6)).toFixed(0) + "px";
    } else {
      pk.classList.remove("beside"); if (stage) stage.classList.remove("peeking");
      pk.style.left = ""; pk.style.top = (r.bottom - v.top + 8).toFixed(0) + "px";
      arrow.style.top = ""; arrow.style.left = Math.max(14, Math.min(v.width - 22, r.left - v.left + r.width / 2 - 6)).toFixed(0) + "px";
    }
  }
  // the drawing scales with its panel, so its words are sized back up to stay readable (never under 12px on screen);
  // when the drawing is small, the second line of each label hides and the panel says it instead
  function sizeText() {
    const svg = document.querySelector(".a-svg"); if (!svg) return;
    const m = svg.getScreenCTM(), k = m ? m.a : 0; if (!k) return;
    svg.style.setProperty("--ik", (1 / k).toFixed(3));
    svg.classList.toggle("a-tight", k < 0.72);
  }
  function after() { sizeText(); place(); const p = document.querySelector(".a-panel"); if (p) p.onscroll = place; }
  window.addEventListener("resize", () => { if (S.screen === "armory") sizeText(); });
  // the details card follows its tile when the page scrolls too, not only the panel (QA run 2)
  window.addEventListener("scroll", () => { if (S.screen === "armory" && S.asel) place(); }, { passive: true });
  function close() { if (!S.asel) return false; S.asel = null; return true; }
  return { board, click, after, close };
};
