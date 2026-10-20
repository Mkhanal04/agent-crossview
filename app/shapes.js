/* Crossview: Your AI's instructions (was What shapes Claude; renamed and given the app switch in release 1, Oct 16) (task 24, rebuilt for task 33's one-picture pattern on Oct 14). One sentence on top; one
   picture of everything Claude reads before you type, as a stack of plates in read order, thicker for more words, with
   numbered pins on what's worth a look; a panel for the plate you pick, carrying what used to be the three cards (the
   folder switch and the saved notes on Claude's notes, the rule problems on the rule files). "Why do I keep correcting
   Claude?" is one line under the picture. Built from tools/instructions.py: your files and the logs' record of which
   files loaded in each chat. Prepared changes go through tools/changes.py and apply only when you press "Make this change". */
window.GBShapes = function (X) {
  "use strict";
  const { G, S, esc, day, DEMO, LIVE, snoozed } = X;
  const D = G.shapes || null, ST = window.GBStage;
  const tip = (t) => `data-tip="${esc(t)}"`;
  const screws = '<i class="w-screw tl"></i><i class="w-screw tr"></i><i class="w-screw bl"></i><i class="w-screw br"></i>';
  const plural = (n, w) => `${n.toLocaleString()} ${w}${n === 1 ? "" : "s"}`;
  const round = (n) => (n >= 1000 ? Math.round(n / 100) * 100 : n >= 100 ? Math.round(n / 10) * 10 : n);
  const words = (chars) => Math.round((chars || 0) / 6);  // about six characters a word, spaces included
  const when = (iso) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).replace(" AM", " am").replace(" PM", " pm");
  const dayOf = (iso) => (iso ? day(String(iso).slice(0, 10)) : "");
  const active = (q) => (G.changes || []).filter((c) => c.status === "made" && c.for === q);
  const badge = (n) => `<em class="w-badge">${n}</em>`;
  const code = (s) => `<code>${esc(s)}</code>`;
  const PRIV = G.private_folders || {};  // a folder with a private name shows under its display name, even inside a path
  const short = (f) => String(f || "").replace(/^~\/Desktop\/Claude_Projects\//, "").replace(/^~\//, "").split("/").map((x) => PRIV[x] || x).join("/");
  const mine = () => (G.skills || []).filter((s) => s.origin === "Made by you").length;
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const NUM = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const spell = (n) => (n < NUM.length ? NUM[n] : n.toLocaleString());


  // ---------- one app at a time (release 1, Oct 16): the same switch as Your setup; Codex's rule files, settings, skills,
  // plugins and connectors from what Your setup already reads; Cowork says plainly what Crossview can't read ----------
  const CX = (G.anatomy || {}).Codex || null;
  const appNow = () => (S.sapp === "Codex" && CX ? "Codex" : S.sapp === "Cowork" ? "Cowork" : "Claude Code");
  const APPTIP = { "Claude Code": "Claude Code's rule files, notes, skills, subagents and connectors.", Cowork: "Cowork's instructions are set in the Claude app.", Codex: "Codex's rule files, settings, skills, add-ons and connectors." };
  const appSwitch = () => `<div class="w-seg s-app" role="group" aria-label="Which app">${["Claude Code", "Cowork", "Codex"].map((a) => `<button data-w="s:app:${a}" aria-pressed="${appNow() === a}" ${tip(APPTIP[a])}>${a}</button>`).join("")}</div>`;
  const cxn = (n) => ST.name(n);  // one name per part on every tab (stage.js)
  function codexPlates() {
    const I = CX.instructions || {}, L = I.list || [], main = L.find((f) => f.where === "main"), folders = L.filter((f) => f.where === "folder");
    const st = (CX.settings || {}).items || [], sv = (k) => ((st.find((x) => x[0] === k) || [])[1] || "");
    const fw = folders.reduce((a, f) => a + (f.words || 0), 0);
    const sk = (CX.skills || []).length + (CX.plugins || []).length, cn = (CX.connectors || []).length;
    // white: written by you; dashed: written by Codex; grey: came with the app; dotted and faint: nothing there
    return [
      { id: "main", title: "Codex's main rule file", line: main ? `${main.words.toLocaleString()} words, read in every chat` : "none found", state: main ? "lit" : "none" },
      { id: "folders", title: "Folder rule files", line: folders.length ? `${plural(folders.length, "file")}, ${fw.toLocaleString()} words in all` : "none found", state: folders.length ? "lit" : "none" },
      { id: "memory", title: "Notes Codex keeps about you", line: CX.memory ? "a notes file in its folder" : "none found", state: CX.memory ? "lit" : "none", dashed: !!CX.memory },
      { id: "settings", title: "Codex's settings", line: sv("Model") ? `${ST.model(sv("Model"))}, thinks ${ST.value(sv("Thinking effort") || "default")}` : "the defaults", state: "dim" },
      { id: "skills", title: "Skills and add-ons", line: sk ? `${sk} in all` : "none found", state: sk ? "dim" : "none" },
      { id: "connectors", title: "Connectors", line: cn ? plural(cn, "connector") : "none found", state: cn ? "dim" : "none" },
    ];
  }
  function codexPanel(id) {
    const I = CX.instructions || {}, L = I.list || [], folders = L.filter((f) => f.where === "folder"), st = (CX.settings || {}).items || [];
    const add = (CX.plugins || []), mine2 = (CX.skills || []), tag = (n) => (ST.actsAsYou(n) ? ` <em class="q-tag hot">can act as you</em>` : "");
    const P = {
      main: ["Codex's main rule file", "read in every chat", `<p>Codex reads one main rule file in its own folder at the start of every chat, like Claude's main rule file. ${L.some((f) => f.where === "main") ? "" : "You don't have one, so Codex starts each chat with only the folder files."}</p><p class="q-why">It would live in Codex's own folder, a hidden folder in your home folder.</p>`],
      folders: ["Folder rule files", "read when Codex works in that folder", `<p>Codex reads the AGENTS.md file in the folder it works in, and in the folders above it. Crossview found ${plural(folders.length, "file")} in your projects.</p><ul class="q-list">${folders.map((f) => `<li><b>${esc(short(f.path).replace(/\/AGENTS\.md$/, "").split("/").slice(-2).join(" › "))}</b><br><small>${(f.words || 0).toLocaleString()} words</small></li>`).join("")}</ul>`],
      memory: ["Notes Codex keeps about you", CX.memory ? "a notes file in its folder" : "none found", `<p>${CX.memory ? "Codex keeps its own notes about you in a file in its folder. Crossview sees that it's there, but doesn't read what's in it." : "Crossview didn't find any notes Codex keeps about you."}</p>`],
      settings: ["Codex's settings", "its settings file, read at the start of every chat", `<ul class="q-list">${st.map(([k, v]) => `<li><b>${esc(k === "Model" ? "The AI model it uses" : ST.name(k))}</b><br><small>${esc(k === "Model" ? ST.model(v) : ST.value(v))}</small></li>`).join("")}</ul><p class="q-why">The same settings show in Your setup, under Settings and permissions.</p>`],
      skills: ["Skills and add-ons", sk => sk, ""],
      connectors: ["Connectors", (CX.connectors || []).length ? plural(CX.connectors.length, "connector") : "none found", `<p>A connector is a link to another app. Codex's settings call them MCP servers.</p><ul class="q-list">${(CX.connectors || []).map((k) => `<li>${esc(cxn(k))}${tag(k)}</li>`).join("")}</ul>`],
    };
    P.skills = ["Skills and add-ons", `${mine2.length + add.length} in all`, `${mine2.length ? `<h4 class="s-h4">Skills</h4><ul class="q-list">${mine2.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : "<p>No skills of yours for Codex on this Mac.</p>"}${((came, mine3) => (came.length ? `<h4 class="s-h4">Came with Codex</h4><p class="q-why">Codex calls these plugins. They give it more tools, and the ones that work your screen or your own Chrome can act as you.</p><ul class="q-list">${came.map((k) => `<li>${esc(cxn(k))}${tag(k)}</li>`).join("")}</ul>` : "")
      + (mine3.length ? `<h4 class="s-h4">Add-ons you installed</h4><ul class="q-list">${mine3.map((k) => `<li>${esc(cxn(k))}${tag(k)}</li>`).join("")}</ul>` : ""))(add.filter((k) => (CX.bundled || []).includes(k)), add.filter((k) => !(CX.bundled || []).includes(k)))}`];
    return P[id] || P.folders;
  }
  function codexBoard() {
    const plates = codexPlates(), ids = plates.map((p) => p.id);
    if (!ids.includes(S.scx)) S.scx = "folders";
    const svg = ST.stack({ plates: plates.map((p) => Object.assign({ thick: p.state === "none" ? 8 : 18, blocks: p.state === "none" ? 0 : 3, pins: [] }, p)), act: "s:cx:", sel: S.scx, label: "What Codex reads before every message, from the top down" });
    const [title, line0, body] = codexPanel(S.scx), k = ids.indexOf(S.scx), line = line0 ? String(line0).charAt(0).toUpperCase() + String(line0).slice(1) : line0;  // a panel line starts like a sentence
    const key = `<span><i class="s-sw mine"></i>Written by you</span><span><i class="s-sw claude"></i>Written by Codex</span><span><i class="s-sw other"></i>Came with the app</span><span><i class="s-sw none"></i>Nothing there</span><span>Read from the top down</span>`;
    const html = ST.page({ lead: "Codex reads these files and settings before every message.", above: `<div class="s-above"><span class="s-same">The same in every project, except the folder files</span></div>`, title: "What Codex reads before every message", headRight: appSwitch(), canvas: svg, key, strip: `<span>Crossview reads these from Codex's folder and the folders your chats ran in. It doesn't check Codex's files for problems yet.</span>`, panel: { k, n: ids.length, act: "s:cx:", unit: "Layer", title, line, body }, cls: "s-g s-cx" });
    return `<div class="w-page s-page">${html}<p class="q-note s-foot">Read from Codex's folder and the folders your chats ran in, on this Mac.</p></div>`;
  }
  function coworkBoard() {
    return `<div class="w-page s-page">${ST.page({ lead: "Crossview can't read what Cowork reads on this Mac.", above: `<div class="s-above"><span class="s-same">Set in the Claude app</span></div>`, title: "What Cowork reads before every message", headRight: appSwitch(), canvas: `<div class="s-empty"><p class="q-a">Cowork's instructions are set in the Claude app, not in files on this Mac.</p><p class="q-why">Crossview reads files on this Mac, so it can't show them. In the Claude app, they're in Settings, and in each project's instructions.</p></div>`, hint: false, panel: { k: 0, n: 1, act: "s:cx:", unit: "Layer", title: "Cowork", line: "", body: "<p>Pick Claude Code or Codex to see what they read.</p>" }, strip: `<span>Cowork has no logs on this Mac after ${esc(day(G.cowork_end || ""))}.</span>`, cls: "s-g s-cw" })}</div>`;
  }

  if (!D || !ST) return { board: () => `<div class="w-page"><section class="w-mod q-empty">${screws}<p class="q-a">Nothing to show yet.</p><p class="q-why">Refresh from the logs to read your instructions and Claude's notes.</p></section></div>`, click: () => null, after() {}, step: () => false, closeSheet: () => false };

  // the projects a chat has started in, newest first; the picture shows one at a time
  const projects = Object.entries(D.loads.latest || {}).sort((a, b) => String(b[1].when).localeCompare(String(a[1].when))).map(([k]) => k);
  // a folder shows under its project's name, the one the other tabs use (build_app.py, folder_names)
  const label = (p) => { const f = p === "Claude_Projects (the hub)" ? "Claude_Projects" : String(p).split("/").pop(); return (G.folder_names || {})[f] || f; };

  // ---------- what's worth a look: one numbered list, the same everywhere ----------
  // The lead's count, the pins on the picture and the numbered items in the panel all come from this list (QA, Oct 14:
  // the lead said 4 while the panel listed more). Order: the folder switch and anything about Claude's notes first, then
  // the reviewed contradictions in your rules, the links that lead nowhere, and the rule files Claude skips.
  // Only open items are numbered: a fixed or hidden suggestion leaves the list.
  const reviewed = (D.reviewed && D.reviewed.items) || [];
  const moved = D.loads.moved_memory || { chats: 0, examples: [] };
  const memoryOpen = () => !active("shapes-memory").length && !snoozed("s:memory");
  const aboutNotes = (f) => f.id === "memory" || [...(f.files || []), ...(f.where || [])].some((x) => /(^|\/|\s)memory(\/|$)/.test(x)) && !(f.files || []).some((x) => x.startsWith("~"));
  const linkN = (D.broken_links || []).length, pathN = D.missing_count || 0, skipN = (D.shadowed || []).length;
  const findings = (() => {
    const rv = reviewed.filter((r) => r.id !== "agents-md").map((r) => Object.assign({ kind: "review" }, r));
    const all = (moved.chats && memoryOpen() ? [{ id: "memory", kind: "memory", title: "Claude's notes stay behind when you switch folders", files: [] }] : [])
      .concat(rv.filter(aboutNotes), rv.filter((r) => !aboutNotes(r)))
      .concat(linkN + pathN ? [{ id: "links", kind: "links", title: linkN + pathN === 1 ? "One broken link" : `${linkN + pathN} broken links`, line: linkN && pathN ? "Some point to notes that are missing, and some to folders or files that moved or were deleted." : linkN ? `${linkN === 1 ? "It points to a note that's" : "They point to notes that are"} missing.` : `${pathN === 1 ? "It points to a folder or file that" : "They point to folders or files that"} moved or were deleted.`, files: [] }] : [])
      .concat(skipN ? [{ id: "skipped", kind: "skipped", title: `Claude skips ${skipN === 1 ? "one of your rule files" : `${skipN} of your rule files`}`, line: `${skipN === 1 ? "It was" : "They were"} written for Codex, which still reads ${skipN === 1 ? "it" : "them"}. Claude Code skips ${skipN === 1 ? "it" : "them"} because one of your rule files for Claude sits in a folder above.`, hover: "These files are named AGENTS.md, and Claude Code reads one only when no CLAUDE.md file sits in its folder or above it.", files: [] }] : []);
    return all.map((f, i) => Object.assign({ n: i + 1 }, f));
  })();
  const pinsFor = (path, isMemory) => findings.filter((f) => (isMemory && f.id === "memory") || (f.files || []).includes(path)).map((f) => f.n).sort((a, b) => a - b);

  // ---------- the plates: everything read before you type, in read order ----------
  function plates(L) {
    const out = [];
    const projFiles = (L.files || []).filter((f) => f.type === "Project"), deepest = projFiles.length ? projFiles[projFiles.length - 1].path : null;
    let r = 0;
    (L.files || []).forEach((f) => {
      const p = f.path, folder = p.replace(/\/(CLAUDE|AGENTS)\.md$/, "").split("/").pop();
      if (f.type === "User") out.push({ id: "main", kind: "main", who: "mine", name: "Your main rule file", sub: "read in every chat", explain: "A rule file is a set of instructions Claude reads at the start of every chat. Claude Code calls it CLAUDE.md, and this one is read in every folder.", words: f.words, path: p, pins: pinsFor(p) });
      else if (f.type === "AutoMem") out.push({ id: "notes", kind: "notes", who: "claude", name: "Claude's notes", sub: L.memory_from && L.memory_from !== L.project ? `saved in ${label(L.memory_from)}` : "saved in this project", explain: `These are what Claude saves about you between chats, kept in Claude's own folder for each project.${L.memory_from && L.memory_from !== L.project ? ` This chat started in ${label(L.memory_from)}, so Claude read the notes saved there.` : ""}`, words: f.words, path: p, pins: pinsFor(p, true), memory: true });
      else { const hub = p === "~/Desktop/Claude_Projects/CLAUDE.md", nm = hub ? "Claude_Projects" : label(folder); out.push({ id: `rules-${r++}`, kind: "folder", who: "mine", name: `${nm} rules`, sub: hub ? "the folder above your projects" : p === deepest ? "this project" : "a folder above", explain: `This is the rule file for ${nm}. Claude reads it at the start of every chat in that folder and in the folders inside it.`, words: f.words, path: p, pins: pinsFor(p) }); }
    });
    // a finding that belongs to no plate shown here goes on Claude's notes (if it's about notes) or the main rule file
    const shown = new Set(out.flatMap((p) => p.pins));
    findings.filter((f) => !shown.has(f.n)).forEach((f) => {
      const mem = aboutNotes(f), home = out.find((p) => (mem ? p.memory : p.kind === "main")) || out.find((p) => p.kind === "main") || out[0];
      if (home) home.pins = home.pins.concat(f.n).sort((a, b) => a - b);
    });
    const li = L.listing || {};
    if (li.style) out.push({ id: "style", kind: "style", who: "mine", name: "How Claude writes to you", sub: `set to ${li.style}`, explain: `It sets how Claude writes its answers to you. Yours is set to ${li.style}.`, words: li.style_words || 0, path: "", pins: [] });
    const all = D.skills_found || (G.skills || []).length;
    // the chat's list counts every skill offered there, add-ons included; the Mac's count is the skills Crossview found
    // in your folders and account. They measure different things, so neither is shown as a share of the other (QA, Oct 14)
    if (li.skills) { const nl = li.skills.listed_in_chat || li.skills.n; out.push({ id: "skills", kind: "skills", who: "other", name: "Skills", sub: `${nl} listed in its last chat`, explain: `A skill is a set of instructions for one kind of task, which Claude or a subagent loads when that task comes up. Before you type, Claude reads only each skill's name and description. This project's last chat${li.skills.chat_day ? ` on ${dayOf(li.skills.chat_day)}` : ""} listed ${plural(nl, "skill")}. The list changes from folder to folder, because some skills come with add-ons or belong to one project. Crossview found ${plural(all, "skill")} on this Mac, and you made ${mine()} of them.`, words: words(li.skills.chars), path: "", pins: [] }); }
    if (li.helpers) out.push({ id: "subagents", kind: "subagents", who: "other", name: "Subagents", sub: `${li.helpers.n} available`, explain: `Claude Code can hand part of a job to a subagent, a separate AI with its own instructions. Before you type, Claude reads a short description of each of the ${li.helpers.n} it can call on in this project. Your setup counts every subagent on this Mac, including ones set up only in other projects, so its number can be higher.`, words: words(li.helpers.chars), path: "", pins: [] });
    if (li.connectors) out.push({ id: "connectors", kind: "connectors", who: "other", name: "Connectors", sub: `${li.connectors.n} add instructions`, explain: `Connectors link Claude to other apps, like Google Drive or Figma. Claude's settings call them MCP servers. ${li.connectors.n === 1 ? "One of them adds" : `${li.connectors.n} of them add`} instructions Claude reads before you type. Your setup lists every connector, including the ones that add none.`, words: words(li.connectors.chars), path: "", pins: [] });
    return out;
  }
  function model() {
    const proj = S.sproj && D.loads.latest[S.sproj] ? S.sproj : projects[0], L = proj ? D.loads.latest[proj] : null;
    if (!L) return null;
    const P = plates(L), tot = P.reduce((a, p) => a + p.words, 0) || 1, otherW = P.filter((p) => p.who === "other").reduce((a, p) => a + p.words, 0);
    const home = (k) => P.find((p) => p.kind === k);
    return { proj, L, P, tot, otherW, notesHome: (home("notes") || home("main") || P[0] || {}).id, rulesHome: (home("main") || P[0] || {}).id };
  }
  const repeatOn = () => !!(G.corrections && G.corrections.messages);
  function picked(m) {
    if (S.splate === "repeat" && repeatOn()) return "repeat";
    if (m.P.some((p) => p.id === S.splate)) return S.splate;
    const first = m.P.find((p) => p.pins.length) || m.P.find((p) => p.kind === "main") || m.P[0];
    return first ? first.id : null;
  }

  // ---------- the panel's parts ----------
  const sec = (key, q, body, act, n) => `<section class="s-sec" data-s-card="${key}"${n ? ` data-s-item="${n}"` : ""}><h4 class="s-q">${n ? badge(n) : ""}${q}</h4>${body}${act ? `<div class="s-act">${act}</div>` : ""}</section>`;
  const doneLine = (done) => `<span class="q-lead q-done">You made this change on ${esc(when(done.when))}. ${esc(done.summary)}</span><button class="w-btn quiet" data-w="s:sheet:undo:${esc(done.id)}">Undo</button>`;
  // the plate's main actions sit right under its size, before the long sections, so they show without scrolling the panel
  const todo = (rows) => (rows.filter(Boolean).length ? `<div class="s-todo">${rows.filter(Boolean).map((r) => `<div class="s-act">${r}</div>`).join("")}</div>` : "");

  // does Claude's memory follow you between folders? (on Claude's notes)
  function noteCount(lbl) { const f = (D.memory.by_folder || []).find((b) => b.folder === lbl); return f ? f.notes : 0; }
  function memorySec() {
    const n = (findings.find((f) => f.id === "memory") || {}).n, q = "Does Claude remember me when I switch folders?";
    if (!moved.chats) return sec("memory", q, `<p class="s-ans">So far, yes. No chat has switched folders yet.</p>`, "");
    const ex = moved.examples[moved.examples.length - 1] || {};
    const k = moved.notes_saved_to_start || 0;
    const a = `Only in the folder where the chat started. If you move to another folder partway through, Claude keeps reading the first folder's notes and saves anything new there too.${k ? ` ${k === 1 ? "One new note has" : `${spell(k)} new notes have`} ended up there so far.` : ""}`;
    const diagram = `<div class="s-flow" role="img" aria-label="${esc(`The chat started in ${label(ex.started)}, so Claude read its ${noteCount(ex.memory)} notes. It moved to ${label(ex.ended)}, whose ${noteCount(ex.ended)} notes weren't read in that chat.`)}">
      <svg viewBox="0 0 420 190" class="s-flow-svg" aria-hidden="true"><path d="M178 38 C 230 38, 246 74, 248 104" class="s-arrow"/><path d="M242 98 l6 9 6 -9" class="s-arrow"/><text x="262" y="62" class="s-flow-t">moved mid-chat</text><path d="M206 160 C 120 160, 92 132, 92 96" class="s-arrow lit"/><path d="M86 102 l6 -9 6 9" class="s-arrow lit"/><text x="6" y="184" class="s-flow-t lit">New notes saved here</text></svg>
      <div class="s-box" style="left:0;top:0"><b>${esc(label(ex.started)).replace(/_/g, "_<wbr>")}</b><small>Chat started here</small><span class="s-mem lit">${noteCount(ex.memory)} notes read</span></div>
      <div class="s-box ghost" style="left:206px;top:104px"><b>${esc(label(ex.ended)).replace(/_/g, "_<wbr>")}</b><small>You moved here</small><span class="s-mem off">${noteCount(ex.ended)} notes not read</span></div></div>
      <p class="s-caption">On ${esc(dayOf(ex.when))}, a chat started in ${esc(label(ex.started))} and moved to ${esc(label(ex.ended))}.</p>`;
    const often = `<p class="s-ans">This has happened in ${plural(moved.chats, "chat")} since ${esc(dayOf(moved.since))}.</p>`;
    return sec("memory", q, `<p class="s-ans">${a}</p>${often}${diagram}`, "", n);
  }
  // its action, for the row at the top of the panel
  function memoryAct() {
    if (!moved.chats) return "";
    const done = active("shapes-memory")[0];
    if (done) return doneLine(done);
    if (snoozed("s:memory")) return `<span class="q-lead">The suggested fix for the folder switch is hidden for a week.</span>`;
    if (((D.reviewed || {}).stale_changes || []).includes("memory-switch")) return `<span class="q-lead">You changed these rules after this fix was written, so there's nothing to press here.</span>`;
    return `<span class="q-lead">Two lines in your rules would let Claude find a project's notes after you switch folders.</span><button class="w-btn main" data-w="s:sheet:memory">Show me the two lines</button><button class="w-btn quiet" data-snooze="s:memory" ${tip("Hides this suggestion for a week.")}>Not now</button>`;
  }
  function archiveAct() {
    const done = active("shapes-archive")[0];
    if (done) return doneLine(done);
    if (!D.memory.stale_90) return "";
    return `<span class="q-lead">Old notes that no chat has read lately can move to an archive folder, and you can bring them back any time.</span><button class="w-btn main" data-w="s:sheet:archive" ${tip("Opens the list of old notes, so you can choose which ones move. Nothing moves until you press Make this change. To open your notes yourself, type /memory in Claude Code.")}>Choose notes to archive</button>`;
  }

  // what has Claude saved about you? (on Claude's notes)
  function memoryFolders() { return (D.memory.by_folder || []).filter((b) => b.id); }
  // ticked to start with: folders where every note is old and no chat has read them in 30 days
  const daysAgo = (iso) => (iso ? (new Date(G.today + "T12:00:00") - new Date(String(iso).slice(0, 10) + "T12:00:00")) / 864e5 : 9999);
  const archiveDefault = (b) => b.stale_90 && b.stale_90 === b.notes && daysAgo(b.last_loaded) > 30;
  const staleLoaded = (b) => b.last_loaded || null;  // the last chat that read this folder's notes
  function rememberSec() {
    const M = D.memory, F = M.by_folder || [], mx = Math.max(1, ...F.map((b) => b.notes));
    const bars = F.slice(0, 5).map((b) => `<div><b>${esc(label(b.folder))}</b><span class="s-tr" ${tip(`${label(b.folder)}: ${plural(b.notes, "note")} saved, ${b.corrections} of them corrections or preferences${b.stale_90 ? `, ${b.stale_90} unchanged for three months or more` : ""}. The newest is from ${dayOf(b.newest)}.`)}><i style="width:${(100 * b.corrections) / mx}%" class="dark"></i><i style="width:${(100 * (b.notes - b.corrections)) / mx}%" class="pale"></i></span><small>${b.notes}${b.stale_90 ? (b.stale_90 === b.notes ? ", all old" : `, ${b.stale_90} old`) : ""}</small></div>`).join("")
      + (F.length > 5 ? `<div><b>${F.length - 5} more projects</b><span class="s-tr"></span><small>${F.slice(5).reduce((a, b) => a + b.notes, 0)}</small></div>` : "");
    const corr = (M.kinds || {}).feedback || 0;
    const top = F.filter((b) => b.stale_90).sort((x, y) => y.stale_90 - x.stale_90)[0];
    const a = `Claude has saved ${plural(M.notes, "note")} across ${plural(M.folders, "project")}. ${corr} of them are corrections or preferences you gave it.${M.stale_90 ? ` ${M.stale_90} haven't changed in three months${top && top.stale_90 * 2 > M.stale_90 ? `, most of them in ${label(top.folder)}` : ""}.` : ""}`;
    return sec("remember", "What has Claude saved about me?", `<p class="s-ans">${a}</p><div class="s-bars">${bars}</div><div class="s-key"><span><i class="dark"></i>Corrections and preferences</span><span><i class="pale"></i>Facts and links</span></div>`, "");
  }

  // is anything in my rules wrong or out of date? On the main rule file: how many of the numbered items are here, the
  // button, then the items. Each item sits on every rule file it's in; one that's in none sits on the main rule file
  function findItem(f) { return `<div class="s-find" data-s-item="${f.n}">${badge(f.n)}<div><b${f.hover ? ` tabindex="0" ${tip(f.hover)}` : ""}>${esc(f.title)}</b>${f.line ? `<p>${esc(f.line)}</p>` : ""}${f.fix ? `<p class="s-fix">${esc(f.fix)}</p>` : ""}</div></div>`; }
  function fixesAct(lead) {
    const done = active("shapes-fixes")[0];
    return (done ? doneLine(done) : lead ? `<span class="q-lead">${lead}</span>` : "") + `<button class="w-btn main" data-w="s:sheet:fixes">Show me the fixes</button>`;
  }
  function rulesSec(here, onPlate) {
    const total = findings.length, T = tidyPlan(), can = T.skill || T.links.length;
    const q = "Is anything in my rules wrong or out of date?";
    if (!total) return sec("fixes", q, `<p class="s-ans">Your rules agree with each other and every link works.</p>`, "");
    const a = !onPlate ? "No problems in this file. The numbers on the picture show where the others are."
      : onPlate === total ? (total === 1 ? "The one problem is in this file." : `All ${spell(total).toLowerCase()} problems are in this file.`)
      : `${spell(onPlate)} of the ${spell(total).toLowerCase()} problems ${onPlate === 1 ? "is" : "are"} in this file.`;
    const lead = `Each one has a suggested fix${can ? ", and Crossview can make some of them for you" : ""}.`;
    return `<section class="s-sec" data-s-card="fixes"><h4 class="s-q">${q}</h4><p class="s-ans">${a}</p><div class="s-act">${fixesAct(lead)}</div>${here.length ? `<div class="s-finds">${here.map(findItem).join("")}</div>` : ""}</section>`;
  }

  // why do I keep correcting Claude? (task 28; counts only, from the messages you typed, read on this Mac with your yes)
  const TOPIC = { "design and how it looks": "How things look", "check live, don't guess": "Checking facts live instead of guessing", "memory and lost context": "Remembering what we already agreed",
    "files and docs as homework": "Handing you files to read instead of answering", "numbers and facts": "Numbers and facts", "links, files, where things are": "Where files and links are",
    "asking instead of doing, or doing without asking": "Asking when it should act, or acting without asking", "too long or complicated": "Replies that are too long or too complicated",
    "my own words echoed or wrong voice": "Repeating your words back, or the wrong voice", "agreeing too fast or reopening decisions": "Agreeing too fast, or reopening settled decisions", "piecemeal fixes": "Fixing things one at a time" };
  const oneIn = () => { const C = G.corrections; return Math.max(2, Math.round(C.messages / Math.max(1, C.pushback))); };
  function repeatBody() {
    const C = G.corrections;
    const base = C.outside_msgs_pct || 0, W = C.written_down || {};
    const why = (k) => {
      const w = W[k] || {}, out = (C.topic_outside_pct || {})[k] || 0;
      if (!w.rule_files && !w.note_files) return ["It isn't written down anywhere Claude reads.", "Add one short line about it to your main rule file."];
      if (!w.main_rule) return ["Some projects' rules mention it, but your main rule file doesn't, so chats in other folders never see it.", "Add one short line about it to your main rule file."];
      if (out >= base + 8) return [`${out}% of these came from chats started outside a project folder, where that project's rules and notes don't load.`, "Start each chat in its project's folder."];
      if (w.note_files > 2 * w.rule_files) return ["It's saved mostly as Claude's notes, and each set of notes is read in one folder only.", "Move it into your main rule file as one short line."];
      return ["It's already in your rules, so the wording may be too general for Claude to act on.", "Rewrite it as one specific line with an example."];
    };
    const top = Object.entries(C.topics || {}).slice(0, 5);
    const rows = top.map(([k, n]) => { const [w, fix] = why(k), mainR = (W[k] || {}).main_rule; return `<tr><th scope="row">${esc(TOPIC[k] || k)}</th><td class="s-num" data-k="Times">${n}</td><td data-k="In your main rule file">${mainR ? "In your main rule file" : "Not in your main rule file"}</td><td data-k="Why it may still happen">${esc(w)}</td><td data-k="What would help" class="s-help">${esc(fix)}</td></tr>`; }).join("");
    const ch = C.change || {}, enough = ch.enough || 100;
    const change = ch.after_msgs >= enough
      ? `Since you changed your rules on Oct 14, ${ch.after_pct}% of your messages pushed back, compared with ${ch.before_pct}% in the two weeks before.`
      : `You changed your rules on Oct 14. In the two weeks before, ${ch.before_pct}% of your messages pushed back. There are ${ch.after_msgs} messages since the change, and the comparison needs about ${enough} to mean much.`;
    const topNames = top.slice(0, 2).map(([k]) => (TOPIC[k] || k).toLowerCase());
    const a = `The most common ones are about ${topNames.join(" and ")}, and most of what you correct is already written in your rules.`;
    return `<section class="s-sec" data-s-card="repeat"><p class="s-ans">${a}</p>
      <table class="s-table s-tstack"><thead><tr><th scope="col">What you correct</th><th scope="col" ${tip("How many of your messages corrected Claude on this, across all your chats on this Mac. One message can touch more than one topic, so the rows add up to more than the total.")}>Times</th><th scope="col" ${tip("Whether your main rule file, the one every chat reads, mentions it.")}>In your main rule file</th><th scope="col">Why it may still happen</th><th scope="col">What would help</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="q-why">${esc(change)}</p>
      <p class="s-small s-muted" ${tip("Crossview reads the messages you typed in Claude Code on this Mac and keeps only counts by topic. Nobody sees the text, including Claude. Topics are found by fixed word lists, so treat the counts as rough.")} tabindex="0">Counted on this Mac from the ${C.messages.toLocaleString()} messages you typed in ${plural(C.chats, "chat")}, with your yes on Oct 14. Only counts are kept.</p></section>`;
  }

  // the panel for one plate: what it is, its size, then what needs a look there
  function panelFor(m, p) {
    const kind = { mine: "written by you", claude: "written by Claude", other: "mostly written by other people" };
    const where = (path) => { if (!path || !path.startsWith("~") || path.includes("/projects/")) return ""; const dir = path.replace(/\/(CLAUDE|AGENTS)\.md$/, "").replace(/^~\//, ""); return dir === ".claude" ? "It's in the .claude folder in your home folder." : `It's in ${dir}.`; };
    const pct = Math.max(1, Math.round((100 * p.words) / m.tot));
    const others = p.who === "other" && m.otherW ? ` Together, skills, subagents and connectors make up about ${Math.round((10 * m.otherW) / m.tot)} in 10 of the words Claude reads first, and most of that was written by other people.` : "";
    const size = `<div class="s-size"><p class="s-fig"><b>${round(p.words).toLocaleString()}</b><span>words, ${kind[p.who]}</span></p><span class="s-share" ${tip(`About ${pct}% of the ${plural(round(m.tot), "word")} Claude reads before your message.`)}><i style="width:${Math.min(100, (100 * p.words) / m.tot)}%"></i></span><small>About ${pct}% of what Claude reads before your message.${others}</small></div>`;
    const loc = where(p.path);
    const what = `<p class="s-what">${esc(p.explain || "")}${loc ? ` ${esc(loc)}` : ""}</p>`;
    const here = findings.filter((f) => p.pins.includes(f.n) && f.id !== "memory");
    const notes = p.id === m.notesHome;
    // the main actions first (right under the size), then the sections that explain them
    const top = notes ? todo([memoryAct(), archiveAct()]) : "";
    let rest = "";
    if (p.id === m.rulesHome) rest += rulesSec(here, p.pins.length);
    if (notes) rest += memorySec();
    if (p.id !== m.rulesHome && here.length) rest += sec("fixes", "Problems in this file", `<div class="s-finds">${here.map(findItem).join("")}</div>`, fixesAct(here.length === 1 ? "It has a suggested fix." : "Each one has a suggested fix."));
    if (notes) rest += rememberSec();
    if (!rest) rest = `<p class="s-calm">No problems found here.</p>`;
    return { title: p.name, line: cap(p.sub), body: `${what}${size}${top}${rest}` };
  }

  // ---------- the page ----------
  function board() {
    if (appNow() === "Codex") return codexBoard();
    if (appNow() === "Cowork") return coworkBoard();
    const m = model();
    const foot = `<p class="q-note s-foot">Counted from your rule files, Claude's notes, and Claude Code's record of which files each chat loaded${D.loads.since ? `, going back to ${esc(dayOf(D.loads.since))}` : ""}${G.corrections ? ", and counts from the messages you typed" : ""}.${D.reviewed && D.reviewed.read ? ` Claude checked your rules for contradictions on ${esc(dayOf(D.reviewed.read))}.` : ""} The counts update every time you refresh.</p>`;
    if (!m) return `<div class="w-page s-page"><section class="w-mod q-empty">${screws}<p class="q-a">What Claude reads before every message</p><p class="q-why">No chat has a record of what it read yet.</p></section>${foot}</div>${sheet()}`;
    const sel = picked(m), P = m.P;
    const max = Math.max(1, ...P.map((p) => p.words));
    const plateFor = (p) => ({ id: p.id, title: p.name, line: `${round(p.words).toLocaleString()} words, ${p.sub}`, state: p.who === "other" ? "dim" : "lit", dashed: p.who === "claude", hot: p.pins.length > 0, pins: p.pins,
      thick: Math.round(8 + 32 * Math.sqrt(p.words / max)), blocks: Math.max(1, Math.min(9, Math.round(Math.sqrt(p.words / 45)))) });
    let svg = ST.stack({ plates: P.map(plateFor), act: "s:plate:", sel, label: "What Claude reads before every message, from the top down" });
    // each pin says which item it is, in Crossview's own hover label, and can be reached with Tab (the stage places it)
    svg = svg.replace(/<g class="g-pin"([^>]*)>/g, (all, at) => {
      const n = (at.match(/data-pin="(\d+)"/) || [])[1], f = findings.find((x) => String(x.n) === n);
      if (!f) return all;
      const t = `${f.title}.`;
      at = at.replace(/\s(aria-label|data-tip|tabindex|role)="[^"]*"/g, "");
      return `<g class="g-pin"${at} tabindex="0" role="button" aria-label="${esc(`Item ${n}: ${f.title}`)}" data-tip="${esc(t)}">`;
    }).replace(/<title>[^<]*<\/title>/g, "");
    const open = findings.length;  // the same items the pins and the panel number
    const lead = `<span ${tip(`Each time you send a message, Claude first reads about ${plural(round(m.tot), "word")} of these files. Type /context in Claude Code to see the count for one chat.`)} tabindex="0">${open ? `${open === 1 ? "One thing" : `${spell(open)} things`} in your rule files and Claude's notes could be fixed.` : "Nothing in your rule files and Claude's notes needs fixing."}</span>`;
    const menu = `<details class="s-proj"><summary ${tip("Each project folder has its own set. Pick one to see it.")}><b>${esc(label(m.proj))}</b>, as of its last chat on ${esc(dayOf(m.L.when))} ▾</summary><div class="s-proj-list">${projects.map((k) => `<button data-w="s:proj:${esc(k)}" aria-pressed="${k === m.proj}">${esc(label(k))}<small>last chat ${esc(dayOf(D.loads.latest[k].when))}</small></button>`).join("")}</div></details>`;
    const key = `<span><i class="s-sw mine"></i>Written by you</span><span><i class="s-sw claude"></i>Written by Claude</span><span><i class="s-sw other"></i>Came with the apps</span><span>Read from the top down</span><span>Thicker means more words</span>${findings.length ? `<span><em class="w-badge s-pin-key">1</em> A problem, numbered</span>` : ""}`;
    const strip = repeatOn() ? `<span class="s-strip-q"><b>Why do I keep correcting Claude?</b> About 1 in ${oneIn()} of your messages corrects Claude.</span><button class="w-btn${sel === "repeat" ? " main" : ""}" data-w="s:plate:repeat" aria-pressed="${sel === "repeat"}">Show me why</button>` : "";
    let panel;
    // the corrections aren't a layer, but the stepper stays (Above goes back to the last layer), so the panel's title
    // doesn't jump when you open them; its chip says where you are instead of a layer number
    if (sel === "repeat") panel = { k: P.length - 1, n: P.length, act: "s:plate:", unit: "Layer", title: "Why do I keep correcting Claude?", line: "The topics you correct most, and why they may keep coming up.", body: repeatBody() };
    else { const k = Math.max(0, P.findIndex((p) => p.id === sel)), pf = panelFor(m, P[k]); panel = Object.assign({ k, n: P.length, act: "s:plate:", unit: "Layer" }, pf); }
    let html = ST.page({ lead, above: `<div class="s-above">${menu}</div>`, title: "What Claude Code reads before every message", headRight: appSwitch(), canvas: svg, key, strip, panel, cls: "s-g" });
    if (sel === "repeat") html = html.replace(/<span class="a-chip">[^<]*<\/span>/, '<span class="a-chip">Below the picture</span>');
    return `<div class="w-page s-page">${html}${foot}</div>${sheet()}`;
  }

  // ---------- the sheets: prepared changes and fixes, opened over the page ----------
  // the prepared lines exist only while the rule files still read as they did when they were prepared (Codex, release 3)
  const memReady = () => ((D.reviewed && D.reviewed.changes && D.reviewed.changes["memory-switch"]) || []).length > 0;
  // what's shown on screen never carries a private folder's real name; the copied request keeps the real paths it needs
  const privText = (t) => Object.entries(PRIV).reduce((x, [k, v]) => x.split(k).join(v), String(t || ""));
  function sheetMemory() {
    const R = (D.reviewed && D.reviewed.changes && D.reviewed.changes["memory-switch"]) || [];
    const rows = R.map((e) => `<li class="q-item on"><span><b>${esc(e.label)}</b></span><p class="s-plain">${esc(e.plain || "")}</p><details class="s-exact"><summary>Show the exact wording</summary><small class="s-file">${esc(e.file)}</small>${wordDiff(e.old, e.new)}</details></li>`).join("");
    return { title: "Two lines that fix the folder switch", kind: "instruction-edit", body: `<p>This changes one line in each of two rule files and leaves the rest alone.</p>
      <ul class="q-items">${rows}</ul>
      <p class="q-small">In ${plural(moved.chats, "chat")}, Claude read the notes of the folder the chat started in, even after you moved.</p>
      <p class="q-small">New ideas still start in the folder above your projects, so a brainstorm keeps reading its notes.</p>
      <p class="q-small">Undo puts both lines back. Crossview keeps a copy of each file on this Mac first.</p>`,
      req: R.length ? { kind: "instruction-edit", id: "memory-switch", for: "shapes-memory", summary: "Your rules now say Claude's notes stay with the folder a chat starts in." } : null,
      ask: R.length ? `Please make these two edits and change nothing else. ${R.map((e) => `In ${e.file}, replace "${e.old}" with "${e.new}".`).join(" ")} Show me each change before saving.` : null };
  }
  // the words that change, marked: struck in "Now", highlighted in "After"
  function wordDiff(a, b) {
    const A = a.split(/(\s+)/), B = b.split(/(\s+)/), n = A.length, m = B.length, T = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) T[i][j] = A[i] === B[j] ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1]);
    let i = 0, j = 0, was = "", will = "";
    while (i < n || j < m) {
      if (i < n && j < m && A[i] === B[j]) { was += esc(A[i]); will += esc(B[j]); i++; j++; }
      else if (j < m && (i >= n || T[i][j + 1] >= T[i + 1][j])) { will += /\S/.test(B[j]) ? `<mark>${esc(B[j])}</mark>` : esc(B[j]); j++; }
      else { was += /\S/.test(A[i]) ? `<del>${esc(A[i])}</del>` : esc(A[i]); i++; }
    }
    return `<div class="s-was"><small>Now</small><p>${was}</p></div><div class="s-will"><small>After</small><p>${will}</p></div>`;
  }
  // what the fixes sheet can change itself, with your press: a broken skill switched off, links that lead nowhere unlinked
  function tidyPlan() {
    const L = D.broken_links || [], ids = {}; (D.memory.by_folder || []).forEach((b) => { if (b.id) ids[b.folder] = b.id; });
    const skill = (reviewed.find((r) => r.skill_off) || {}).skill_off || null;
    const links = L.filter((b) => ids[b.folder]).map((b) => ({ folder: ids[b.folder], note: b.note, to: b.to }));
    return { skill, links };
  }
  function sheetFixes() {
    const dis = findings.filter((f) => f.kind === "review"), L = D.broken_links || [], P = D.missing_paths || [];
    const numOf = (id) => { const f = findings.find((x) => x.id === id); return f ? `${badge(f.n)} ` : ""; };
    const T = tidyPlan(); S.stidy = S.stidy || new Set([T.skill ? "skill" : "", T.links.length ? "links" : ""].filter(Boolean));
    const tick = (key, title, line) => `<li class="q-item${S.stidy.has(key) ? " on" : ""}"><label><input type="checkbox" data-w="s:tick:${key}" ${S.stidy.has(key) ? "checked" : ""}><span><b>${esc(title)}</b><br><small>${esc(line)}</small></span></label></li>`;
    const tidy = (T.skill || T.links.length) ? `<div class="q-grp"><h4>Crossview can do these for you</h4><ul class="q-items">${T.skill ? tick("skill", `Switch off the ${T.skill} skill`, `Its folder moves to a skills-off folder next to your skills, so Claude stops offering it. Undo moves it back.`) : ""}${T.links.length ? tick("links", `Unlink ${plural(T.links.length, "note link")} that are broken`, "Each link becomes plain words, so Claude stops trying to follow it. The note keeps everything else.") : ""}</ul></div>` : "";
    const sec = (h, body) => `<div class="q-grp"><h4>${h}</h4>${body}</div>`;
    const list = (arr, fmt, max = 40, what = "them") => `<details class="s-exact"><summary>Show ${what}</summary><ul class="q-list s-small">${arr.slice(0, max).map(fmt).join("")}${arr.length > max ? `<li>and ${arr.length - max} more</li>` : ""}</ul></details>`;
    const mem = findings.find((x) => x.id === "memory");
    const body = (mem ? sec(`${badge(mem.n)} ${esc(mem.title)}`, `<p class="q-small">When a chat moves to another folder partway through, Claude keeps reading the first folder's notes and saves anything new there too, so notes end up in the wrong project.</p>${memReady() ? `<p class="s-fix">Two lines in your rule files fix it, and Crossview can add them for you. <button class="w-link" data-w="s:sheet:memory">Show me that fix</button></p>` : `<p class="s-fix">Add a line to your main rule file saying that a chat which moves to another folder saves new notes with that folder. Your rule files changed since Crossview prepared the exact lines, so copy the request below into Claude Code instead.</p>`}`) : "") + dis.map((f) => sec(`${badge(f.n)} ${esc(f.title)}`, `<p class="q-small">${esc(f.line)}</p>${(f.where || []).length ? list(f.where, (w) => `<li>${esc(short(w))}</li>`, 40, f.where.length === 1 ? "where it is" : `the ${f.where.length} files`) : ""}<p class="s-fix">${esc(f.fix)}</p>`)).join("")
      + (L.length ? sec(`${numOf("links")}${L.length} broken links between Claude's notes`, `<p class="q-small">One note points to another that isn't in the same place, so Claude can't follow it.${L.some((b) => b.elsewhere) ? ` ${L.filter((b) => b.elsewhere).length} of the missing notes exist somewhere else.` : ""}</p>${list(L, (b) => `<li>${esc(b.note)} → ${esc(b.to)} <small>(${esc(label(b.folder))})</small></li>`, 40, `the ${L.length} links`)}<p class="s-fix">Point each link at the right note, or remove it.</p>`) : "")
      + (P.length ? sec(`${L.length ? "" : numOf("links")}${P.length} links to folders or files that moved or were deleted`, list(P, (m) => `<li>${esc(short(m.path))} <small>named in ${esc(short(m.in))}</small></li>`, 40, `the ${P.length} links`) + `<p class="s-fix">Update or remove each one.</p>`) : "")
      + ((D.shadowed || []).length ? sec(`${numOf("skipped")}${plural(D.shadowed.length, "rule file")} Claude skips`, `<p class="q-small" ${tip("From Claude Code's documentation, checked Oct 14.")}>These are rule files written for Codex. Codex reads them, but Claude Code reads one only when no rule file of its own sits in its folder or above it.</p><p class="s-fix">Move what they say into the rule file above them. <span class="w-link" tabindex="0" ${tip("Or type /config in Claude Code and set Project instructions to read both kinds of rule file. Codex's rule files are named AGENTS.md; Claude Code's are named CLAUDE.md.")}>Claude Code also has a setting that reads both files</span>.</p>${list(D.shadowed, (s) => `<li>${esc(short(s.file))}</li>`, 40, "the files")}`) : "")
      + ((D.repeats || []).length ? sec(`Said more than once`, `<p class="q-small">The same rule in three or more files. Subagents don't get the instructions for how Claude writes to you, so a copy in a subagent's file is useful. Anywhere else, keeping the rule in one file makes it easier to keep right.</p>${list(D.repeats, (r) => `<li>"${esc(r.sample.slice(0, 70))}${r.sample.length > 70 ? "…" : ""}" <small>${r.files.length} files</small></li>`, 40, `the ${D.repeats.length} rules`)}`) : "");
    const ask = `Please fix these in my Claude instruction files and memory notes, showing me each change before saving, and change nothing else: ${mem && !memReady() ? "In my main rule file, add one line saying that when a chat moves to another folder partway through, new notes are saved with that folder's notes. " : ""}${dis.map((f) => `${f.title}: ${f.fix}`.replace(/\bYour\b/g, "My").replace(/\byour\b/g, "my")).join(" ")} ${L.length ? `Fix or remove these memory links that point nowhere: ${L.map((b) => `${b.note} -> ${b.to}`).join(", ")}.` : ""} ${P.length ? `Update or remove these references to paths that no longer exist: ${P.map((m) => `${m.path} (in ${m.in})`).join(", ")}.` : ""}`;
    const req = (S.stidy.has("skill") && T.skill) || (S.stidy.has("links") && T.links.length) ? { kind: "tidy", for: "shapes-fixes", skills_off: S.stidy.has("skill") && T.skill ? [T.skill] : [], unlink: S.stidy.has("links") ? T.links : [], summary: [S.stidy.has("skill") && T.skill ? `the ${T.skill} skill switched off` : "", S.stidy.has("links") && T.links.length ? `${plural(T.links.length, "note link")} that led nowhere unlinked` : ""].filter(Boolean).join(", and ") + "." } : null;
    return { title: "Fixes for your rules and notes", kind: tidy ? "tidy" : null, body: `<p>Here's what's off in your rules and notes, with a suggested fix for each. The numbers match the numbered list in Setup. Crossview can make the ticked fixes below itself, and it keeps a copy of each file first. For the rest, copy the request into Claude Code, which shows each edit and asks before saving. <span class="w-link" tabindex="0" ${tip("Type /doctor prompt-audit in Claude Code, in the project's folder.")}>Claude Code can also check one project at a time</span>.</p>${tidy}${body}<details class="s-exact"><summary>See exactly what gets copied</summary><p class="s-small s-names">${esc(privText(ask))}</p></details>`, req, ask };
  }
  function sheetArchive() {
    const F = memoryFolders().filter((b) => b.stale_90);
    S.spick = S.spick || new Set(F.filter(archiveDefault).map((b) => b.id));
    const rows = F.map((b) => { const l = staleLoaded(b); return `<li class="q-item${S.spick.has(b.id) ? " on" : ""}"><label><input type="checkbox" data-w="s:pick:${esc(b.id)}" ${S.spick.has(b.id) ? "checked" : ""}><span><b>${esc(label(b.folder))}</b> <small>${plural(b.stale_90, "note")} of ${b.notes} unchanged for three months or more</small><br><small>${b.stale_90 === b.notes ? `None of its notes changed since ${esc(dayOf(b.newest))}, so this empties its notes.` : "Newer notes stay."}${l ? ` A chat on ${esc(dayOf(l))} still read them, so it isn't ticked.` : " No chat has read them since the records start, so this only tidies."}</small></span></label>${(b.stale_names || []).length ? `<details class="s-exact"><summary>Show the ${plural(b.stale_names.length, "note")}</summary><p class="s-small s-names">${b.stale_names.map(esc).join(", ")}</p></details>` : ""}</li>`; }).join("");
    const sel = F.filter((b) => S.spick.has(b.id));
    return { title: "Move old notes into an archive", kind: "archive-notes", body: `<p>This moves notes that haven't changed in three months into an archive folder beside them and takes them off Claude's list, so Claude stops reading them and nothing is deleted.</p>
      <ul class="q-items">${rows}</ul>
      <p class="q-small">Undo moves them back and restores the list. A note can be old and still right, so look before you archive it.</p>`,
      req: sel.length ? { kind: "archive-notes", folders: sel.map((b) => b.id), for: "shapes-archive", summary: `${sel.reduce((a, b) => a + b.stale_90, 0)} old notes moved into an archive (${sel.map((b) => label(b.folder)).join(", ")}).` } : null, ask: null };
  }
  function sheetUndo(id) {
    const c = (G.changes || []).find((x) => x.id === id); if (!c) return null;
    return { title: "Undo this change?", undo: c.id, body: `<p>You made this change on ${esc(when(c.when))}. ${esc(c.summary)}</p><ul class="q-list">${c.items.map((it) => `<li>${code(short(it.file))}: ${it.moved ? `moves ${plural(it.moved.length, "note")} back and restores the index` : it.skill ? "moves the skill back" : it.after !== undefined ? "puts the note back as it was" : "puts the old line back"}</li>`).join("")}</ul><p class="q-small">Anything changed in those files since is left alone.</p>` };
  }
  function sheet() {
    if (!S.sopen) return "";
    const s = S.sopen === "memory" ? sheetMemory() : S.sopen === "fixes" ? sheetFixes() : S.sopen === "archive" ? sheetArchive() : S.sopen.startsWith("undo:") ? sheetUndo(S.sopen.slice(5)) : null;
    if (!s) return "";
    const off = DEMO ? "This is the demo company, so changes are turned off." : LIVE ? "" : "To make changes, start Crossview by double-clicking “Agent Crossview.command” in its folder (Agent-Glass-Box).";
    const app = s.app || "Claude Code";  // the app the copied request is for (his note, Oct 20)
    const why = s.undo ? "" : [!s.kind ? "Crossview can't make these changes itself, so copy the request instead." : "", !s.ask ? `Crossview makes this change itself, so there's nothing to copy for ${app}.` : ""].filter(Boolean).join(" ");
    const btns = (s.undo ? (LIVE ? `<button class="w-btn main" data-w="s:undo:${esc(s.undo)}">Undo it</button>` : "") : `<button class="w-btn main" data-w="s:make" ${!s.kind || !LIVE || !s.req ? "disabled" : ""}>Make this change</button>`)
      + `<button class="w-btn" data-w="s:copy" data-prompt="${esc(s.ask || "")}" ${s.ask ? "" : "disabled"}>${S.scopied === S.sopen ? `Copied. Paste it into ${app}` : `Copy it for ${app}`}</button>` + `<button class="w-btn quiet" data-w="s:close">Close</button>`;
    return `<div class="q-veil" data-w="s:close"></div><div class="q-sheet" role="dialog" aria-modal="true" aria-labelledby="s-sheet-h">
      <header><h3 id="s-sheet-h">${esc(s.title)}</h3><button class="q-x" data-w="s:close" aria-label="Close">×</button></header>
      <div class="q-sheet-b">${s.body}${why ? `<p class="q-off">${esc(why)}</p>` : ""}${off && (s.kind || s.undo) ? `<p class="q-off">${esc(off)}</p>` : ""}${S.serr ? `<p class="q-err" role="alert">${esc(S.serr)}</p>` : ""}</div><div class="g-more q-more" aria-hidden="true">More below ↓</div><footer>${btns}</footer></div>`;
  }

  // the picked plate after a step: -1 is the plate above (the ↑ key), 1 the plate below (↓); true if the pick changed
  function step(dir) {
    if (appNow() === "Codex") { const ids = codexPlates().map((p) => p.id), was = S.scx; S.scx = ST.stepIn(ids, S.scx || "folders", dir); return S.scx !== was; }
    if (appNow() === "Cowork") return false;
    const m = model(); if (!m || !m.P.length) return false;
    const ids = m.P.map((p) => p.id), cur = picked(m);
    const nx = cur === "repeat" ? (dir < 0 ? ids[ids.length - 1] : null) : ST.stepIn(ids, cur, dir);
    if (!nx || nx === cur) return false;
    S.splate = nx; S.sfocusPick = true; return true;
  }

  function click(el) {
    const v = el.dataset.w || "";
    if (!v.startsWith("s:")) return null;
    if (v.startsWith("s:app:")) { S.sapp = v.slice(6); S.scx = null; return "stay"; }
    if (v.startsWith("s:cx:step:")) { const ids = codexPlates().map((p) => p.id); S.scx = ST.stepIn(ids, S.scx || "folders", Number(v.slice(10))); return "stay"; }
    if (v.startsWith("s:cx:")) { S.scx = v.slice(5); return "stay"; }
    if (v.startsWith("s:proj:")) { S.sproj = v.slice(7); const d = el.closest("details"); if (d) d.open = false; return "stay"; }
    if (v.startsWith("s:plate:step:")) { step(Number(v.slice(13))); return "stay"; }
    if (v.startsWith("s:plate:")) { S.splate = v.slice(8); S.spin = el.dataset.pin || null; S.sfocusPick = true; return "stay"; }
    if (v.startsWith("s:sheet:")) { S.sopen = v.slice(8); S.sret = v; S.serr = null; S.scopied = null; S.sfocus = true; return "stay"; }
    if (v === "s:close") { S.sopen = null; S.serr = null; S.sback = true; return "stay"; }
    if (v.startsWith("s:tick:")) { const k = v.slice(7); S.stidy = S.stidy || new Set(); S.stidy.has(k) ? S.stidy.delete(k) : S.stidy.add(k); return "stay"; }
    if (v.startsWith("s:pick:")) { const id = v.slice(7); S.spick = S.spick || new Set(); S.spick.has(id) ? S.spick.delete(id) : S.spick.add(id); return "stay"; }
    if (v === "s:copy") { const t = el.dataset.prompt || ""; try { navigator.clipboard.writeText(t).catch(() => window.prompt("Copy this request:", t)); } catch (e) { window.prompt("Copy this request:", t); } S.scopied = S.sopen; return "stay"; }
    if (v === "s:make" || v.startsWith("s:undo:")) {
      const s = v === "s:make" ? (S.sopen === "memory" ? sheetMemory() : S.sopen === "archive" ? sheetArchive() : S.sopen === "fixes" ? sheetFixes() : null) : null, body = s ? s.req : { id: v.slice(7) };
      if (!body || !LIVE) return false;
      el.disabled = true; el.textContent = v === "s:make" ? "Making the change…" : "Undoing…";
      fetch(v === "s:make" ? "/api/change" : "/api/undo", { method: "POST", headers: { "Content-Type": "application/json", "X-Glass-Box": "1" }, body: JSON.stringify(body) })
        .then((r) => r.json().then((j) => { if (!r.ok) throw new Error(j.error || "it didn't work"); location.reload(); }))
        .catch((e) => { S.serr = (v === "s:make" ? "Nothing was changed: " : "It wasn't undone: ") + e.message; el.disabled = false; window.dispatchEvent(new Event("gb:render")); });
      return false;
    }
    return null;
  }
  // a plate picked with the keyboard keeps the focus after the page redraws; Enter and Space pick a plate, as a click does
  if (!window.__gbShapesKeys) {
    window.__gbShapesKeys = true;
    document.addEventListener("keydown", (ev) => {
      const t = ev.target;
      if ((ev.key === "Enter" || ev.key === " ") && t && t.matches && t.matches('g[data-w^="s:plate:"]')) { ev.preventDefault(); ev.stopPropagation(); t.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
    }, true);
  }
  function showItem(n) {
    const t = document.querySelector(`.s-g .g-panel [data-s-item="${CSS.escape(String(n))}"]`); if (!t) return;
    const body = t.closest(".g-body"), scrolls = body && getComputedStyle(body).overflowY !== "visible" && body.scrollHeight > body.clientHeight + 2;
    if (scrolls) { const tr = t.getBoundingClientRect(), br = body.getBoundingClientRect(); if (tr.top < br.top || tr.bottom > br.bottom) body.scrollTop += tr.top - br.top - 8; }
    else { const r = t.getBoundingClientRect(); if (r.top < 0 || r.bottom > window.innerHeight) t.scrollIntoView({ block: "center" }); }
    t.classList.remove("s-flash"); void t.offsetWidth; t.classList.add("s-flash");
  }
  function after() {
    if (S.sfocus) { const h = document.querySelector("#s-sheet-h"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); } S.sfocus = false; }
    if (S.sback) { const b = S.sret && document.querySelector(`[data-w="${S.sret}"]`); if (b) b.focus({ preventScroll: true }); S.sback = false; }
    if (S.sfocusPick) {
      S.sfocusPick = false;
      const pin = S.spin, id = S.splate && CSS.escape(S.splate);
      const pg = pin && id && document.querySelector(`.g-pin[data-pin="${CSS.escape(pin)}"][data-w="s:plate:${id}"]`);
      if (pg) pg.focus({ preventScroll: true });  // a picked pin keeps the focus (the app would put it on the plate)
      else if (!document.activeElement || document.activeElement === document.body) { const g = id && document.querySelector(`.a-plate[data-w="s:plate:${id}"], [data-w="s:plate:${id}"]`); if (g) g.focus({ preventScroll: true }); }
      const pb = document.querySelector(".s-g .g-panel"), body = pb && pb.querySelector(".g-body"); if (pb) pb.scrollTop = 0; if (body) body.scrollTop = 0;
      // a pin: its own item comes into view inside the panel and flashes once
      if (pin) { S.spin = null; showItem(pin); }
    }
  }
  // Setup's rule-files layer (release 3 slice 1): the same reading count, the same numbered list and the same fixes
  // sheet as this view, so the two never disagree
  function summary() {
    const m = model(); if (!m) return null;
    const by = (w) => m.P.filter((p) => p.who === w).reduce((a, p) => a + p.words, 0);
    return { proj: label(m.proj), when: dayOf(m.L.when), tot: m.P.reduce((a, p) => a + p.words, 0), mine: by("mine"), claude: by("claude"), other: by("other"),
      findings: findings.map((f) => ({ n: f.n, title: f.title, line: f.line || "", hover: f.hover || "" })), oneIn: repeatOn() ? oneIn() : 0 };
  }
  return { board, click, after, step, summary, sheet, closeSheet: () => (S.sopen ? ((S.sopen = null), (S.sback = true), true) : false) };
};
