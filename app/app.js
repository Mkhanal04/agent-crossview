/* Crossview v0: the office front door (layout B), the armory and mission control.
   Plain JavaScript, no build step. Reads window.GB from data.js. Runs locally; sends nothing anywhere. */
(function () {
  "use strict";
  const G = window.GB;
  // On Windows (and Linux) the screens say "this computer" where they'd say "this Mac" (Oct 17): one pass over whatever
  // is drawn, so each screen keeps its own words. On a Mac nothing here runs.
  if (G && G.system && G.system !== "mac") {
    const SWAP = [[/\bthis Mac's\b/g, "this computer's"], [/\bthis Mac\b/g, "this computer"], [/\bThis Mac\b/g, "This computer"], [/\byour Mac's\b/g, "your computer's"], [/\byour Mac\b/g, "your computer"], [/\bmy Mac\b/g, "my computer"],
      [/\bthe Mac\b/g, "the computer"], [/\ba Mac\b/g, "a computer"], [/“Agent Crossview\.command”/g, "“Agent Crossview (Windows).cmd”"], [/\(Application Support\)/g, "(AppData)"]];
    const fix = (t) => SWAP.reduce((x, [a, b]) => x.replace(a, b), t);
    const walk = (root) => {
      if (root.nodeType === 3) { if (/Mac|\.command|Application Support/.test(root.nodeValue)) root.nodeValue = fix(root.nodeValue); return; }
      if (root.nodeType !== 1) return;
      ["data-tip", "aria-label", "aria-description", "title"].forEach((k) => { const v = root.getAttribute(k); if (v && /Mac|\.command/.test(v)) root.setAttribute(k, fix(v)); });
      root.childNodes.forEach(walk);
    };
    window.GBWords = () => walk(document.body);  // render() calls it once more after it sets the screen-reader notes
    const start = () => { walk(document.body); new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach(walk))).observe(document.body, { childList: true, subtree: true }); };
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
  }
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const roundUsd = (v) => (v >= 1000 ? Math.round(v / 100) * 100 : Math.round(v / 10) * 10);
  const about = (v) => (v == null ? '<span class="unknown">not recorded</span>' : v < 10 ? '<span class="estimate">under $10</span>' : `<span class="estimate">about $${roundUsd(v).toLocaleString()}</span>`);
  const measured = (n) => `<span class="measured">${Number(n).toLocaleString()}</span>`;
  const day = (d) => (d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null);
  const lastText = (d) => (d ? `<span class="measured">${day(d)}</span>` : '<span class="unknown">not in the logs on this Mac</span>');
  const R = G.ranges || {};
  const span = (t) => (R[t] ? `${new Date(R[t][0] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} to ${new Date(R[t][1] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "none kept");
  const COUNT = `Counted from the logs that Claude Code, Cowork and Codex keep on this Mac. Claude Code's logs cover ${span("Claude Code")}, Cowork's cover ${span("Cowork")} and Codex's cover ${span("Codex")}. Every reply in all three apps is priced the same way, at the per-use prices Anthropic and OpenAI publish, last checked ${G.prices_checked}. Older work is priced at today's rates. The pay-per-use price is what the same work would cost if you paid per use. You pay a flat subscription, so it isn't your bill. Subagent and skill runs come from Claude Code's logs.`;
  const CANT = `Some things aren't counted yet. Claude Code makes small background calls that never reach the logs. Cowork stopped keeping logs on this Mac after ${day(G.cowork_end)}. Codex's automatic reviewer has no published price. The exact share of your limit that you've used is on Anthropic's usage page.`;

  // the demo company (made-up data, see tools/demo_company.py) is read-only: no moves, amounts or refreshes
  const DEMO = window.GB_DEMO || null;
  const LIVE = location.protocol.startsWith("http") && !DEMO;
  const demoHref = (on) => location.pathname + (on ? "?demo" : "") + location.hash;
  const byId = {};
  G.agents.forEach((a) => (byId[a.id] = { type: "agent", ...a }));
  G.skills.forEach((s) => (byId[s.id] = { type: "skill", ...s }));
  G.work.forEach((w) => (byId[w.id] = { type: "work", ...w }));
  G.notes.forEach((n) => (byId["note:" + n.id] = { type: "note", ...n }));
  const A = Object.fromEntries(G.agents.map((a) => [a.name, a]));

  // ---------- state ----------
  const store = { get(k, d) { try { return JSON.parse(localStorage.getItem("gb:" + k)) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem("gb:" + k, JSON.stringify(v)); } catch (e) {} } };
  const S = { week: Object.keys(G.weekly).sort().slice(-1)[0], screen: "note", mode: "week", selected: null, side: "list", pulse: null, zoom: null, snoozed: new Set(store.get("snoozed", [])) };
  const DEF = [-43, 86, 1062, 577];  // the office floor plus a 24-unit margin
  let viewBox = DEF.slice();
  // Labels keep the same size on screen at any zoom: font sizes are set in map units per screen pixel.
  const pxu = () => (S.zoom ? roomBox(S.zoom)[2] : DEF[2]) / ((document.getElementById("stage") || {}).clientWidth || 1000);
  const fs = (px) => `style="font-size:${(px * pxu()).toFixed(2)}px"`;

  // ---------- numbers for the bar ----------
  const weekStart = G.week_start;
  const weekUsd = G.work.reduce((t, w) => t + (w.week_usd || 0), 0);
  const weekWork = G.work.filter((w) => w.week_usd > 0 && w.name !== "Not sure yet");
  const weekRuns = G.agents.reduce((t, a) => t + a.week, 0);
  const localDay = (ts) => { const d = new Date(ts + ":00Z"); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const when = (ts) => new Date(ts + ":00Z").toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).replace(" AM", " am").replace(" PM", " pm");
  // one stop per app, limit and time: the records can write the same stop twice (Codex's recheck, Oct 20)
  const HITS = ((seen) => (G.limit_events || []).filter((e) => e.status === "hit" && !seen.has(e.tool + e.kind + e.ts) && seen.add(e.tool + e.kind + e.ts)))(new Set());
  const WARN = (G.limit_events || []).filter((e) => e.status === "warning");
  const weekHits = HITS.filter((h) => localDay(h.ts) >= weekStart);
  const KIND = { five_hour: "five-hour limit", seven_day: "weekly limit", unknown: "limit of a kind the log didn't record" };
  const totalUsd = Object.values(G.weekly).reduce((t, w) => t + Object.values(w).reduce((a, b) => a + b, 0), 0);
  const allRuns = G.agents.reduce((t, a) => t + a.runs, 0);

  // ---------- how each number was made ----------
  // Every number says what it counts, how sure it is and what it can't see: on hover, on keyboard focus, and to screen readers.
  const CK = G.checks || {};
  const gapTo = (k) => { const x = CK[k]; if (!x || !x.theirs) return null; const d = Math.round((100 * (x.ours - x.theirs)) / x.theirs); return `${Math.abs(d)}% ${d < 0 ? "lower" : "higher"} than ${k}'s own`; };
  const CHECKED = [gapTo("Claude Code"), gapTo("Cowork")].filter(Boolean).join(" and ");
  const UNLOGGED = G.agents.reduce((t, a) => t + (a.unlogged || 0), 0);
  const CW = day(G.cowork_end), SINCE = day(Object.values(R).map((r) => r[0]).sort()[0]);
  const EST = Object.values(G.est_tool || {}).reduce((a, b) => a + b, 0);
  const PRICE = `Each reply is priced from how much it read and wrote, at the per-use prices Anthropic and OpenAI publish, last checked ${G.prices_checked}. That's what the work would cost if you paid per use. It isn't your bill.`;
  const SURE = {
    counted: "This is counted straight from the logs.",
    estimate: `This is a rounded estimate. Where the apps keep their own figure, ours comes out ${CHECKED}.`,
    grouped: `This is a rounded estimate. Where the apps keep their own figure, ours comes out ${CHECKED}. Claude groups each chat into a project by its title, folder and date, and you can move any chat.`,
  };
  const NOCOWORK = `It leaves out Cowork after ${CW}, when its logs on this Mac stop, and small background calls that never reach the logs.`;
  const HOW = {
    weekUsd: () => [`Every reply since Monday in your time zone, in Claude Code, Cowork and Codex. ${PRICE}`, SURE.estimate, NOCOWORK],
    weekHits: () => ["How many times a limit stopped you since Monday. It comes from Claude Code's and Codex's own records, and each limit window counts once.", SURE.counted, `It can't show how close you came without hitting one, because Claude Code doesn't record that. Cowork after ${CW} is missing too.`],
    weekRuns: () => ["Subagents started since Monday in Claude Code and Cowork, where the subagent's own log was kept. Claude Code can hand part of a job to a subagent, a separate AI with its own instructions.", SURE.counted, `It leaves out ${UNLOGGED} runs so far whose logs weren't kept, and Codex's subagents, which Crossview doesn't read yet.`],
    weekWork: () => ["Projects that used anything since Monday. A project is one of your project folders. Chats that aren't grouped into a project yet aren't counted.", "It depends on how Claude grouped your chats into projects, and you can move any chat."],
    worth: () => ["The advisor's notes and the counts worth a decision, up to five. Anything you hid with Not now is left out.", "The red items come straight from the counts. An AI writes the advisor's notes from these numbers."],
    allUsd: () => [`Every reply in the logs kept on this Mac. Claude Code's logs cover ${span("Claude Code")}, Cowork's cover ${span("Cowork")} and Codex's cover ${span("Codex")}. ${PRICE} Older work is priced at today's rates.`, SURE.estimate, `It leaves out Cowork after ${CW}, background calls, and Codex's automatic reviewer, which has no published price.`],
    sessions: () => ["Chats each app kept a log for on this Mac. A chat is one conversation, however long.", SURE.counted, "Chats from before the logs start, or deleted since, aren't counted."],
    allRuns: () => ["Every time Claude Code or Cowork handed part of a job to a subagent and kept the subagent's own log. A subagent is a separate AI with its own instructions.", SURE.counted, `It leaves out ${UNLOGGED} more runs whose logs Claude Code didn't keep, and Codex's subagents.`],
    allHits: () => ["How many times a limit stopped you, from each app's own records. A limit is one of the 5-hour and weekly caps on your plan, and each limit window counts once.", SURE.counted, `It can't show how close you came on other days, because Claude Code doesn't record that. Cowork and Codex logged ${WARN.length} near-limit warnings. Cowork after ${CW} is missing.`],
    weekChart: () => [`Each bar is one week, Monday to Sunday in your time zone, split by project. A reply counts in the week it ran, even if its chat started earlier. ${PRICE}`, SURE.grouped, `The striped weeks come after ${CW}, when Cowork's logs on this Mac stop, so its work is missing there.`],
    models: () => ["The pay-per-use price of each model's replies, each at its own published price.", SURE.estimate, "Whether a cheaper model would have done the same work isn't known. Only the same task run on both can show that."],
    went: () => ["The pay-per-use price split by what each reply paid for. Before each step the app re-reads the conversation so far, and it stores the conversation so it can re-read it. It also writes the answer and reads anything new. Each of these has its own published rate. Re-reading is the cheapest per word, but it happens before every step, so it adds up.", SURE.estimate, `Subagents' logs keep only part of what they wrote, so ${money(EST)} of the total is an estimate for that.`],
    workTable: () => [`One row per project, with its chats in all three apps, its first and last day, and its pay-per-use price. ${PRICE}`, SURE.grouped, "Crossview reads chat titles but no message or reply text, so it only knows what a chat was about from its title."],
    workUsd: () => [`Every reply in this project's chats. ${PRICE}`, SURE.grouped, NOCOWORK],
    workShare: () => [`This project's share of the pay-per-use price of everything in the logs since ${SINCE}.`, "It's an estimate, and it changes if you move chats between projects."],
    workRuns: () => ["Subagents started in this project's chats, where the subagent's log was kept. A subagent is a separate AI that Claude Code hands part of a job to.", SURE.counted],
    workHits: () => ["Times a limit stopped you while this project was running in the five hours or the week before.", "The hits are counted. Which project was running comes from the times of its replies.", "It can't tell whether this project caused the hit. Everything running at the time counts toward the same limit."],
    workSessions: () => [`Replies and subagents are counted from each chat's log and priced like everything else. The line under each title says how the chat ended up in this project. ${PRICE}`, SURE.grouped, "The logs are read for counts only, so what each reply was about isn't known."],
    timeline: () => ["The pay-per-use price by the day each reply ran, in your time zone, split by app. Long projects show weeks instead of days. A triangle marks a day when a limit stopped you.", SURE.estimate],
    weekDetail: () => ["This week runs Monday to Sunday in your time zone. The pay-per-use price is split by project, each as a share of the week's total.", SURE.grouped, NOCOWORK],
    agentRuns: () => [`Times the app you talk to handed work to this subagent and kept its log. This week starts on Monday in your time zone.`, SURE.counted],
    agentUsd: () => ["Every reply in this subagent's own log, priced like everything else, plus an estimate for the writing its log only partly kept.", SURE.estimate],
    agentSide: () => ["Runs are counted from the logs. The pay-per-use price covers every reply in the subagent's own log, priced from how much it read and wrote. It isn't your bill.", SURE.estimate, "The logs are read for counts only, so what it was asked and what it said aren't known."],
    skillUses: () => [`Times Claude Code called this skill by name. Its logs cover ${span("Claude Code")}.`, SURE.counted, "It misses a skill Claude followed by reading its file directly, and uses in Cowork and Codex."],
    workSide: () => [`Chats and subagents are counted from the logs. The pay-per-use price covers every reply in its chats. ${PRICE}`, SURE.grouped],
    skills: () => [`A skill shows as used once Claude Code has called it by name. Its logs cover ${span("Claude Code")}. Rule files are counted by their words and when they last changed. Connectors are counted by the actions Claude Code ran through them.`, SURE.counted, "It misses a skill Claude followed by reading its file directly, skill uses in Cowork and Codex, and which parts of a rule file Claude followed."],
    tasksDone: () => ["Tasks marked done in the project's task list. Claude updates the list as the work moves.", "This is counted from the list. Your test is what shows whether each one really works."],
    hours: () => ["Claude's guesses in hours, made before the work started. The clock times show when each task started and finished.", "These hours are guesses. Nothing here was measured."],
  };
  const howText = (k) => (HOW[k] ? HOW[k]() : []).filter(Boolean).join("\n");
  // a number that explains itself; the side note is for screen readers
  const fig = (html, k) => `<span class="fig" tabindex="0" data-tip="${esc(howText(k))}">${html}<span class="sr">. ${esc(howText(k))}</span></span>`;
  const howCard = (...ks) => `<details class="how"><summary>How this was counted</summary>${ks.map((k) => `<p>${esc(howText(k)).replace(/\n/g, "<br>").replace(/(^|<br>)(How sure:|Can&#39;t see:|Hatched:)/g, "$1<b>$2</b>")}</p>`).join("")}</details>`;

  // ---------- rooms ----------
  const ROOMS = [
    { id: "room:team", label: "north", name: "Your team", sub: "subagents you made", x: 0.5, y: 0.5, w: 6.5, d: 5, color: "#7dd3fc", fig: "#38bdf8", agents: ["reviewer", "challenger", "voice-check", "go-to-market", "designer", "discovery-lead"] },
    { id: "room:helpers", label: "north", name: "Built-in subagents", sub: "came with Claude Code", x: 8.5, y: 0.5, w: 6, d: 5, color: "#a7f3d0", fig: "#34d399", agents: ["general-purpose", "Explore", "Plan", "claude-code-guide", "statusline-setup"] },
    { id: "room:armory", label: "north", name: "Skills", sub: `${G.skills.length} skills, by where they came from`, x: 16, y: 0.5, w: 6.5, d: 5, color: "#fbbf24" },
    { id: "room:door", name: "Advisor", sub: "suggestions from your numbers", x: 0.5, y: 8.5, w: 3.5, d: 4.5, color: "#fde68a" },
    { id: "room:control", name: "Mission control", sub: "the full dashboard", x: 5.5, y: 8.5, w: 5.5, d: 4.5, color: "#60a5fa" },
  ];
  ROOMS.forEach((r) => (byId[r.id] = { type: "room", ...r }));
  // "!" items, worked out from the counts by fixed rules: an agent you or a project made that never ran, or a room with no runs for a week
  const daysAgo = (d) => (d ? Math.round((new Date(G.today + "T12:00:00") - new Date(d + "T12:00:00")) / 864e5) : null);
  const FLAGS = [];
  G.agents.filter((a) => !a.runs && a.origin !== "Came with Claude Code").forEach((a) => FLAGS.push({ id: "never-" + a.name, title: `${a.name} has never run`, line: `It hasn't run since Claude Code's logs start on ${day((R["Claude Code"] || [])[0])}. You can keep it, rewrite it or remove it.`, target: a.id }));
  ROOMS.filter((r) => r.agents && r.agents.length > 1).forEach((r) => {
    const ag = r.agents.map((n) => A[n]).filter(Boolean), last = ag.map((a) => a.last).filter(Boolean).sort().pop();
    if (last && daysAgo(last) >= 7) FLAGS.push({ id: "quiet-" + r.id, title: `${r.name} is quiet`, line: `None of its ${ag.length} subagents has run since ${day(last)}, ${daysAgo(last)} days ago.`, target: r.id });
  });
  FLAGS.forEach((f) => (byId["flag:" + f.id] = { type: "flag", ...f }));

  const OX = 345, OY = 132, U = 26;
  const iso = (x, y, z = 0) => [OX + (x - y) * U, OY + (x + y) * U * 0.5 - z * U];
  const pts = (arr) => arr.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
  const quad = (x, y, w, d, z = 0) => [iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)];
  function box(x, y, z, w, d, h, c) {
    const t = quad(x, y, w, d, z + h);
    const l = [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
    const r = [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)];
    return `<polygon points="${pts(l)}" fill="${c[1]}"/><polygon points="${pts(r)}" fill="${c[2]}"/><polygon points="${pts(t)}" fill="${c[0]}"/>`;
  }
  const DESK = ["#334155", "#1e293b", "#273449"];

  // Cost is a coin stack labeled as an estimate: never a color, never a face. More coins = more list price (each coin roughly doubles it).
  const coinsFor = (usd) => (usd >= 1 ? Math.min(9, 1 + Math.floor(Math.log2(usd))) : usd > 0 ? 1 : 0);
  function coins(cx, cy, usd, label) {
    const n = coinsFor(usd); if (!n) return "";
    let g = "";
    for (let i = 0; i < n; i++) g += `<ellipse cx="${cx}" cy="${cy - i * 3.1}" rx="5.6" ry="2.4" fill="#c9a54a" stroke="#6f5618" stroke-width=".8"/>`;
    return `<g class="coins" aria-hidden="true">${g}${label ? `<text x="${cx + 9}" y="${cy - n * 3.1 + 2}" class="coin-label" ${fs(12)}>${label}</text>` : ""}</g>`;
  }
  const money = (v) => (v < 10 ? "under $10" : `about $${roundUsd(v).toLocaleString()}`);
  const agentUsd = (a) => (S.mode === "week" ? a.usd_week : a.usd) || 0;

  function figure(x, y, a, color, showName) {
    const h = 0.5 + 0.42 * Math.log10(1 + a.runs);
    const [bx, by] = iso(x, y);
    const top = iso(x, y, h)[1];
    let op = 1, glow = "";
    if (S.mode === "week") { op = a.week ? 1 : a.runs ? 0.42 : 0.22; if (a.week) glow = `<ellipse cx="${bx}" cy="${by}" rx="17" ry="7.5" fill="${color}" opacity=".45"/>`; }
    else { op = a.runs ? 1 : 0.22; }
    const never = a.runs === 0;
    const sel = S.selected === a.id ? `<ellipse class="sel-ring" cx="${bx}" cy="${by}" rx="19" ry="8.5"/>` : "";
    const pulse = S.pulse === a.id ? `<ellipse class="pulse" cx="${bx}" cy="${by}" rx="26" ry="11"/>` : "";
    const num = never ? "never" : S.mode === "week" ? (a.week ? `${a.week}` : "") : `${a.runs}`;
    const stroke = never ? ` stroke="${color}" stroke-dasharray="3 2" fill-opacity="0"` : "";
    const dim = S.zoom && a.room !== S.zoom ? ' opacity=".18"' : "";
    const cu = agentUsd(a), [cx, cy] = iso(x + 0.55, y + 0.05);
    const coinTip = cu ? ` That's ${money(cu)} at pay-per-use prices ${S.mode === "week" ? "this week" : "in all"}, estimated.` : "";
    const tipText = `${a.name} ${a.runs ? `ran ${a.runs} times in the logs, ${a.week} of them this week.` : "never ran in the logs."}${coinTip}`;
    return `<g class="hit" data-id="${esc(a.id)}"${dim} role="button" aria-label="${esc(tipText)}" data-tip="${esc(tipText)}"><title>${esc(tipText)}</title>${glow}${sel}${pulse}${coins(cx, cy, cu, "")}
      <g class="body" opacity="${op}"><rect x="${bx - 7}" y="${top}" width="14" height="${by - top}" rx="7" fill="${color}"${stroke}/><circle cx="${bx}" cy="${top - 6}" r="6.5" fill="${color}"${stroke}/></g>
      <text x="${bx}" y="${top - 14 - 2 * pxu()}" text-anchor="middle" class="fig-num" ${fs(12)}>${num}</text>${showName ? `<text x="${bx}" y="${top - 14 - 16 * pxu()}" text-anchor="middle" class="fig-name" ${fs(12)}>${esc(a.name)}</text>` : ""}</g>`;
  }

  function roomShape(r) {
    const q = quad(r.x, r.y, r.w, r.d);
    const selected = S.selected === r.id;
    const [fx, fy] = iso(r.x + r.w, r.y + r.d);
    const pulse = S.pulse === r.id ? `<polygon class="pulse" points="${pts(q)}"/>` : "";
    const dimR = S.zoom && S.zoom !== r.id ? ' opacity=".25"' : "";
    const rusd = roomUsd(r);
    return `<g class="hit" data-id="${r.id}"${dimR} data-tip="${esc(r.name)}. Click to zoom in.${rusd ? ` Its subagents used ${money(rusd)} at pay-per-use prices ${S.mode === "week" ? "this week" : "in all"}, estimated.` : ""}">
      <polygon points="${pts(q)}" fill="${r.color}" opacity="${selected ? 0.26 : 0.13}"/><polygon points="${pts(q)}" fill="none" stroke="${r.color}" stroke-width="${selected ? 2.4 : 1.2}" opacity=".8"/>${pulse}
      ${roomLabel(r)}</g>`;
  }

  function roomLabel(r) { return ""; }
  const roomUsd = (r) => (r.agents || []).reduce((t, n) => t + (A[n] ? agentUsd(A[n]) : 0), 0);
  function roomCoins(r) {
    const v = roomUsd(r); if (!r.agents || !v) return "";
    const [bx, by] = iso(r.x + r.w, r.y + r.d);
    return `<g class="hit" data-id="${r.id}"${dimAttr(r.id)} data-tip="${esc(r.name)}. Its subagents used ${money(v)} at pay-per-use prices ${S.mode === "week" ? "this week" : "in all"}. That's an estimate, and it isn't your bill.">${coins(bx + 8, by + 14, v, money(v))}</g>`;
  }

  const dimAttr = (room) => (S.zoom && S.zoom !== room ? ' opacity=".22"' : "");
  function office() {
    let s = "";
    for (let i = 0; i < 25; i++) for (let j = 0; j < 14; j++) s += `<polygon points="${pts(quad(i, j, 1, 1))}" fill="${(i + j) % 2 ? "#15213a" : "#17243f"}"/>`;
    ROOMS.forEach((r) => (s += roomShape(r)));
    // agents
    ROOMS.filter((r) => r.agents).forEach((r) => {
      const n0 = r.agents.length, cols = n0 <= 1 ? 1 : n0 <= 6 ? 3 : 3, rowsN = Math.ceil(n0 / cols);
      const x0 = r.label === "north" ? 1.4 : 0.75, y0 = r.label === "north" ? 1.6 : 0.95;
      const sx = (r.w - x0 - 0.7) / Math.max(1, cols - 1 || 1), sy = (r.d - y0 - 0.5) / Math.max(1, rowsN - 1 || 1);
      r.agents.forEach((n, k) => {
        const a = A[n]; if (!a) return;
        const x = n0 === 1 ? r.x + r.w / 2 : r.x + x0 + (k % cols) * sx, y = n0 === 1 ? r.y + r.d / 2 : r.y + y0 + Math.floor(k / cols) * sy;
        s += `<g>${box(x - 0.35, y + 0.25, 0, 1.2, 0.55, 0.42, r.quietNames ? ["#2e2a4a", "#1f1c36", "#29254a"] : DESK)}</g>`;
        a.room = r.id;
        s += figure(x, y, a, r.fig, S.zoom === r.id);
      });
    });
    ROOMS.forEach((r) => (s += roomCoins(r)));
    // armory: one cube per skill, grouped by origin
    const groups = {};
    G.skills.forEach((k) => (groups[k.origin] = groups[k.origin] || []).push(k));
    const order = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
    let gx = 16.5;
    order.forEach((o) => {
      const list = groups[o].sort((a, b) => b.uses - a.uses);
      const cols = Math.ceil(list.length / 8);
      list.forEach((k, i) => {
        const x = gx + Math.floor(i / 8) * 0.55, y = 1.0 + (i % 8) * 0.52;
        const lit = k.uses > 0;
        const c = lit ? ["#e6dcc4", "#9c8d70", "#c4b591"] : ["#2a3446", "#1a2232", "#222c3e"];
        const sel = S.selected === k.id ? 1 : 0;
        s += `<g class="hit" data-id="${esc(k.id)}"${dimAttr("room:armory")} data-tip="${esc(k.name)}, ${k.uses ? "used " + k.uses + " times" : "never called in Claude Code's logs"}. ${esc(k.origin)}.">${box(x, y, 0, 0.4, 0.4, lit ? 0.42 : 0.22, c)}${sel ? `<ellipse class="sel-ring" cx="${iso(x + 0.2, y + 0.2)[0]}" cy="${iso(x + 0.2, y + 0.2)[1]}" rx="9" ry="4"/>` : ""}</g>`;
      });
      gx += cols * 0.55 + 0.35;
    });
    // control room: a wall screen whose three bars are the last three weeks at list price
    s += `<g class="hit" data-id="room:control"${dimAttr("room:control")} data-tip="Mission control. The wall shows the last three weeks at pay-per-use prices. Click once to zoom in and again to go in.">${box(6.2, 9.2, 0, 4.2, 0.35, 1.6, ["#1e3a5f", "#0f2340", "#17304f"])}`;
    const wks = Object.keys(G.weekly).sort().slice(-3), mx = Math.max(...wks.map((w) => Object.values(G.weekly[w]).reduce((a, b) => a + b, 0)));
    wks.forEach((w, i) => { const v = Object.values(G.weekly[w]).reduce((a, b) => a + b, 0); const hh = 1.2 * v / mx; s += box(7 + i * 1.2, 9.2, 0.2, 0.6, 0.05, hh, ["#93c5fd", "#3b82f6", "#60a5fa"]); });
    s += `${box(7.2, 10.6, 0, 2.6, 0.8, 0.45, DESK)}</g>`;
    // the door and the advisor's desk
    const adv = { id: "advisor", name: "advisor", runs: G.notes.length, week: G.notes.length };
    s += `<g class="hit" data-id="advisor"${dimAttr("room:door")} data-tip="The advisor has ${G.notes.length} notes, written by AI from these numbers.">${box(1.4, 10.2, 0, 1.3, 0.6, 0.45, DESK)}`;
    const [ax, ay] = iso(1.9, 9.8); const at = iso(1.9, 9.8, 1.0)[1];
    const k = pxu();
    s += `<g opacity="1"><rect x="${ax - 7}" y="${at}" width="14" height="${ay - at}" rx="7" fill="#e0b85a"/><circle cx="${ax}" cy="${at - 6}" r="6.5" fill="#e0b85a"/></g>`;
    s += `<rect x="${ax + 10}" y="${at - 8 - 20 * k}" width="${64 * k}" height="${20 * k}" rx="${10 * k}" fill="#1c1a12" stroke="#e0b85a" stroke-width="${k}"/><text x="${ax + 10 + 32 * k}" y="${at - 8 - 6 * k}" text-anchor="middle" style="font-size:${12 * k}px;font-weight:600;fill:#f1dca0">${G.notes.length} notes</text>${S.selected === "advisor" ? `<ellipse class="sel-ring" cx="${ax}" cy="${ay}" rx="19" ry="8.5"/>` : ""}${S.pulse === "advisor" ? `<ellipse class="pulse" cx="${ax}" cy="${ay}" rx="26" ry="11"/>` : ""}</g>`;
    const crumb = S.zoom ? `<span class="linkish" data-unzoom="1">Office</span> › ${esc(byId[S.zoom].name)}` : "Your subagents' office";
    const tabs = ROOMS.map((r) => `<button class="rtab${S.zoom === r.id ? " on" : ""}" data-zoom="${r.id}" style="--c:${r.color}"><i></i>${esc(r.name)}</button>`).join("");
    return `<div class="maphead"><div class="title">${crumb}<small>${S.mode === "week" ? `Bright figures worked this week, ${G.week_start === G.today ? "today, " + day(G.today) : day(G.week_start) + " to " + day(G.today)}. The number is this week's runs, a taller figure has more runs overall, and coins show the pay-per-use price.` : "The number and height show runs in all the logs. Faded figures never ran. Coins show the pay-per-use price."}</small></div>
      <div class="modes" role="group" aria-label="Map mode"><button data-mode="week" aria-pressed="${S.mode === "week"}">1 · This week</button><button data-mode="all" aria-pressed="${S.mode === "all"}">2 · All logs</button></div></div>
      <div class="rtabs" role="tablist" aria-label="Rooms">${tabs}</div>
      <svg id="office-map" viewBox="${viewBox.join(" ")}" role="img" aria-label="An office where each figure is one subagent. Click a room to zoom in. The arrow keys move between rooms, and Escape zooms out.">${s}</svg>`;
  }

  function roomBox(id) {
    const r = byId[id]; if (!r) return DEF.slice();
    const q = quad(r.x, r.y, r.w, r.d);
    const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
    let x0 = Math.min(...xs) - 30, x1 = Math.max(...xs) + 30, y0 = Math.min(...ys) - 110, y1 = Math.max(...ys) + 50;
    const w = x1 - x0, h = y1 - y0, ratio = DEF[2] / DEF[3];
    if (w / h > ratio) { const nh = w / ratio; y0 -= (nh - h) / 2; return [x0, y0, w, nh]; }
    const nw = h * ratio; x0 -= (nw - w) / 2; return [x0, y0, nw, h];
  }
  function tweenTo(target) {
    const svg = document.getElementById("office-map"); if (!svg) { viewBox = target; return; }
    const from = viewBox.slice(), t0 = performance.now(), dur = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 380;
    const step = (t) => {
      const k = dur ? Math.min(1, (t - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3);
      viewBox = from.map((v, i) => v + (target[i] - v) * e);
      svg.setAttribute("viewBox", viewBox.join(" "));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function zoomTo(id) {
    S.zoom = id; S.screen = "office";
    if (id) { S.selected = id; S.side = "detail"; } else { S.selected = null; S.side = "list"; }
    render(); tweenTo(id ? roomBox(id) : DEF.slice());
  }

  // ---------- armory ----------
  function armory() {
    const groups = {};
    G.skills.forEach((k) => (groups[k.origin] = groups[k.origin] || []).push(k));
    const order = ["Made by you", "From your Claude account", "Came with Claude Code"].concat(Object.keys(groups).filter((o) => !["Made by you", "From your Claude account", "Came with Claude Code"].includes(o)));
    const shelf = (o) => {
      const list = (groups[o] || []).sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
      const used = list.filter((k) => k.uses).length;
      return `<div class="shelf"><h4>${esc(o)}</h4><div class="count">${used} of ${list.length} used</div><div class="tools">${list.map((k) => `<button class="tool ${k.uses ? "lit" : ""}" data-id="${esc(k.id)}" data-tip="${esc(k.name)}: ${k.uses ? k.uses + " uses, last " + day(k.last) : "not called in Claude Code's kept logs"}">${esc(k.name)}</button>`).join("")}</div></div>`;
    };
    const off = Object.entries(G.plugin_state || {});
    const offShelf = off.length ? `<div class="shelf"><h4>Switched off</h4><div class="count">Plugins you turned off</div><div class="tools">${off.map(([p, st]) => `<span class="tool off" data-tip="${esc(st)}">${esc(p)}</span>`).join("")}</div><p class="cant" style="margin-top:10px">These no longer load. You switched them off on Oct 10.</p></div>` : "";
    const instr = (G.instruction_list || []).map((f) => `<li><span>${esc(f.where)}</span><span><span class="measured">${f.words.toLocaleString()} words</span> · changed ${day(f.modified)}</span></li>`).join("");
    const conns = (G.connector_list || []).map((c) => `<li><span>${esc(c.name)}</span><span class="measured">${c.actions.toLocaleString()} action${c.actions === 1 ? "" : "s"}</span></li>`).join("");
    return `<div class="screen"><h2>Your setup</h2><p class="sub">The skills, rule files and connectors that shape what Claude does. Skills are grouped by where they came from, and a bright one has been used at least once in Claude Code's logs. Click any skill for details.</p>
      <div class="shelves">${order.filter((o) => groups[o]).map(shelf).join("")}${offShelf}</div>
      <div class="mc-grid" style="margin-top:12px"><div class="card"><h3>Rule files (${(G.instruction_list || []).length})</h3><ul class="mini">${instr}</ul><p class="cant">A rule file is a file of instructions Claude reads at the start of every chat in its folder. The logs don't record which parts Claude followed, so their use can't be counted. Day-job and personal folders show without their names.</p></div>
      <div class="card"><h3>Connectors that ran (${(G.connector_list || []).length})</h3><ul class="mini">${conns}</ul><p class="cant">A connector is a link to another app, like Google Drive or Figma. Claude's settings call these MCP servers. They're counted from Claude Code's logs, and connectors you set up but never used don't show here yet.</p></div></div>
      ${howCard("skills")}</div>`;
  }

  // ---------- mission control ----------
  const PAL = ["#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#fb923c"];
  // One week chart for mission control and the by-week screen: fixed colors per piece of work, the Cowork gap hatched.
  const colOf = (k) => (G.work_colors || {})[k] || "#334155";
  const wkOf = (d) => { const t = new Date(d + "T12:00:00"); return new Date(t - ((t.getDay() + 6) % 7) * 864e5).toISOString().slice(0, 10); };
  function weekChart(weeks, W, H, opts) {
    const tots = weeks.map((w) => Object.values(G.weekly[w] || {}).reduce((a, b) => a + b, 0)), mx = Math.max(...tots) || 1;
    const slot = (W - 20) / weeks.length, bw = Math.max(6, Math.min(40, slot * 0.6)), base = H - 26, top = 30;
    let g = '<defs><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#64748b" stroke-width="2"/></pattern></defs>';
    const ce = G.cowork_end, bi = ce ? weeks.findIndex((w) => w > wkOf(ce)) : -1;
    if (bi >= 0) g += `<rect x="${10 + bi * slot}" y="${top - 18}" width="${(weeks.length - bi) * slot}" height="${base - top + 18}" fill="url(#hatch)" opacity=".18"/><text x="${10 + bi * slot + 6}" y="${top - 6}" class="band-label">No Cowork logs after ${day(ce)}</text>`;
    let lastY = null;
    weeks.forEach((w, i) => {
      const x = 10 + i * slot + (slot - bw) / 2, on = opts.selected === w; let y = base;
      if (opts.clickWeek) g += `<rect class="hit wk" data-week="${w}" x="${10 + i * slot}" y="${top}" width="${slot}" height="${base - top}" fill="${on ? "rgba(251,191,36,.10)" : "transparent"}"/>`;
      Object.entries(G.weekly[w] || {}).sort((a, b) => ((G.work_colors || {})[a[0]] ? 0 : 1) - ((G.work_colors || {})[b[0]] ? 0 : 1) || b[1] - a[1]).forEach(([k, v]) => {
        const h = ((base - top - 16) * v) / mx;
        g += `<rect class="hit" ${opts.clickWeek ? `data-week="${w}"` : `data-id="work:${esc(k)}"`} x="${x}" y="${y - h}" width="${bw}" height="${h}" fill="${colOf(k)}"><title>Week of ${day(w)}, ${esc(k)}, ${money(v)} at pay-per-use prices</title></rect>`; y -= h;
      });
      (opts.hits ? opts.hits[w] || [] : []).forEach((h, j) => (g += `<path d="M${x + bw / 2 - 5} ${y - 9 - j * 9} L${x + bw / 2 + 5} ${y - 9 - j * 9} L${x + bw / 2} ${y - 2 - j * 9} Z" fill="${h.plan === "Claude" ? "#fde68a" : "none"}" stroke="#fde68a"><title>${esc(h.tool)} limit hit, ${when(h.ts)}</title></path>`));
      if (opts.totals && tots[i] >= 10) { let ly = y - 6 - (opts.hits && opts.hits[w] ? opts.hits[w].length * 9 : 0); if (lastY != null && Math.abs(ly - lastY) < 13) ly -= 13; lastY = ly; g += `<text x="${x + bw / 2}" y="${ly}" text-anchor="middle" class="tot">$${roundUsd(tots[i]).toLocaleString()}</text>`; } else lastY = null;
      if (weeks.length <= 10 || (weeks.length - 1 - i) % 2 === 0) g += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" class="ax"${on ? ' style="fill:#fbbf24"' : ""}>${day(w)}</text>`;
    });
    const present = {}; weeks.forEach((w) => Object.entries(G.weekly[w] || {}).forEach(([k, v]) => (present[k] = (present[k] || 0) + v)));
    const leg = Object.entries(present).filter(([k]) => (G.work_colors || {})[k]).sort((a, b) => b[1] - a[1]).map(([k]) => `<span><i style="background:${colOf(k)}"></i>${esc(k)}</span>`).join("")
      + '<span><i style="background:#334155"></i>Everything else</span>' + (bi >= 0 ? '<span><i class="hatch-key"></i>No Cowork logs</span>' : "")
      + (opts.hits ? '<span><i style="background:#fde68a;border-radius:0"></i>Claude limit hit</span><span><i style="border:1px solid #fde68a;border-radius:0"></i>Codex limit hit</span>' : "");
    return `<svg viewBox="0 0 ${W} ${H}" style="max-width:${W}px" role="img" aria-label="${esc(opts.label)}">${g}</svg><div class="legend" style="font-size:12px;color:#c7cfdd">${leg}</div>`;
  }
  function mission() {
    const weeks = Object.keys(G.weekly).sort().slice(-10);
    const mt = Object.values(G.model_cost).reduce((a, b) => a + b, 0);
    const mlist = Object.entries(G.model_cost).filter(([k, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const mtop = mlist.slice(0, 6), rest = mlist.slice(6).reduce((a, [, v]) => a + v, 0);
    const models = mtop.concat(rest ? [["others", rest]] : []).map(([k, v], i) => `<div class="row"><span>${k === "others" ? `${mlist.length - 6} other models` : esc(modelName(k))}</span>${about(v)}</div><div class="track"><i style="width:${Math.max(1, (100 * v) / mt)}%;background:${PAL[i] || "#475569"}"></i></div>`).join("");
    const uk = G.usd_kinds || {}, ut = Object.values(uk).reduce((a, b) => a + b, 0) || 1;
    const went = [["Re-reading the conversation", uk.read, "#60a5fa"], ["Storing it for re-reading", uk.write, "#a78bfa"], ["Writing answers", uk.out, "#fbbf24"], ["New input", uk.fresh, "#94a3b8"]]
      .map(([n, v, c]) => `<div class="row"><span>${n}</span><span>${about(v || 0)} <span class="estimate">${Math.round((100 * (v || 0)) / ut)}%</span></span></div><div class="track"><i style="width:${Math.max(0.6, (100 * (v || 0)) / ut)}%;background:${c}"></i></div>`).join("");
    const rows = G.work.filter((w) => w.name !== "Not sure yet").map((w) => `<tr class="click" data-id="${esc(w.id)}"><td>${esc(w.name)}</td><td>${measured(w.sessions)}</td><td>${esc(Object.keys(w.tools).join(", "))}</td><td>${day(w.first)} to ${day(w.last)}</td><td>${!w.usd && w.unpriced_tokens ? '<span class="unknown">no published price</span>' : w.usd == null ? '<span class="unknown">not recorded</span>' : about(w.usd)}</td></tr>`).join("");
    return `<div class="screen"><h2>Mission control</h2><p class="sub">Everything Claude Code, Cowork and Codex did, from the logs they keep on this Mac. Click any bar or row for details.</p>
      <div class="kpis"><div class="kpi"><div class="v">${fig(about(totalUsd), "allUsd")}</div><div class="l">of work at pay-per-use prices since ${day(Object.values(R).map((r) => r[0]).sort()[0])}</div></div>
      <div class="kpi"><div class="v">${fig(measured(G.sessions), "sessions")}</div><div class="l">chats, with ${G.tools["Claude Code"]} in Claude Code, ${G.tools.Cowork} in Cowork and ${G.tools.Codex} in Codex</div></div>
      <div class="kpi"><div class="v">${fig(measured(G.all_runs), "allRuns")}</div><div class="l">subagent runs in Claude Code and Cowork</div></div>
      <div class="kpi"><div class="v">${fig(measured(HITS.length), "allHits")}</div><div class="l">times a limit stopped you, ${HITS.filter((h) => h.plan === "Claude").length} on Claude and ${HITS.filter((h) => h.plan === "ChatGPT").length} on Codex</div></div></div>
      <div class="mc-grid"><div class="card"><h3>Where did the last 10 weeks go?</h3>${weekChart(weeks, 760, 300, { totals: true, label: "Pay-per-use price by week for the last 10 weeks" })}<p class="cant"><span class="linkish" data-go="screen:weeks">See every week and when a limit stopped you</span>.</p>${howCard("weekChart")}</div>
      <div class="card"><h3>Which models did the work?</h3>${models}<h3 style="margin-top:14px">What did the replies pay for?</h3>${went}<p class="cant">Before every step, the app re-reads the conversation so far, and storing it for that costs money too. That's why most of a long chat's price goes to re-reading, and a small part goes to writing answers.</p>${howCard("models", "went")}</div></div>
      <div class="mc-grid">${toolsCard()}${checkCard()}</div>
      ${movesCard()}
      <div class="card"><h3>Projects</h3><table class="work"><thead><tr><th>Project</th><th>Chats</th><th>Apps</th><th>When</th><th>Pay-per-use price</th></tr></thead><tbody>${rows}</tbody></table>
      ${howCard("workTable")}<p class="cant">${esc(CANT)}</p></div></div>`;
  }
  function coinSvg(usd) { const n = coinsFor(usd); return `<svg width="22" height="${n * 3.1 + 10}" viewBox="0 ${-n * 3.1 - 4} 22 ${n * 3.1 + 10}" aria-hidden="true">${coins(11, 0, usd, "")}</svg>`; }
  function modelRows(models, total) {
    const e = Object.entries(models).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const top = e.slice(0, 3), rest = e.slice(3).reduce((a, [, v]) => a + v, 0);
    return top.concat(rest >= 0.5 ? [[`${e.length - 3} other models`, rest]] : []).map(([m, v]) => `<li><span>${esc(m.includes(" other ") ? m : modelName(m))}</span><span class="measured">${Math.max(1, Math.round((100 * v) / (total || 1)))}%</span></li>`).join("");
  }
  function modelName(k) {
    const m = String(k).match(/^claude-(opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d+))?/);
    if (m) return `${m[1][0].toUpperCase() + m[1].slice(1)} ${m[2]}${m[3] ? "." + m[3] : ""}`;
    const g = String(k).match(/^gpt-([\d.]+)-(\w+)/);
    if (g) return `GPT-${g[1]} ${g[2][0].toUpperCase() + g[2].slice(1)}`;
    return k === "codex-auto-review" ? "Codex's automatic reviewer" : k;
  }
  const TOOLC = { "Claude Code": "#60a5fa", Cowork: "#a78bfa", Codex: "#34d399" };
  function toolsCard() {
    const t = G.by_tool || {}, tot = Object.values(t).reduce((a, b) => a + b, 0) || 1;
    const rows = ["Claude Code", "Cowork", "Codex"].map((k) => `<div class="row"><span>${k} <small class="unknown" style="font-style:normal">${span(k)}</small></span>${t[k] ? about(t[k]) : '<span class="unknown">none</span>'}</div><div class="track"><i style="width:${Math.max(0.6, (100 * (t[k] || 0)) / tot)}%;background:${TOOLC[k]}"></i></div>`).join("");
    const est = Object.values(G.est_tool || {}).reduce((a, b) => a + b, 0);
    const un = Object.entries(G.unpriced || {}).map(([m, n]) => `${m === "codex-auto-review" ? "Codex's automatic reviewer" : m} has no published price, so its ${(n / 1e6).toFixed(1)} million tokens aren't priced.`).join(" ");
    const hc = Object.values(G.helper_cost || {}).reduce((a, b) => a + b, 0);
    const hline = hc ? `<div class="row" style="margin-top:4px"><span>Subagents' share of that</span>${about(hc)}</div><div class="track"><i style="width:${(100 * hc) / tot}%;background:#fbbf24"></i></div>` : "";
    return `<div class="card"><h3>Which app used the most?</h3>${rows}${hline}
      <p class="cant">This includes ${about(est)} estimated for subagents' writing, because their logs keep only part of it. The estimate comes from chats where Claude Code kept its own total.${un ? ` ${esc(un)} A token is a small piece of text that AI models read and write.` : ""}</p></div>`;
  }
  function movesCard() {
    const m = G.moves || []; if (!m.length) return "";
    const rows = m.map((x) => `<li><span>${x.title ? esc(x.title) : '<span class="unknown">untitled or private</span>'} <small class="unknown" style="font-style:normal">(${esc(x.tool || "")})</small></span><span>${x.was ? esc(x.was) + " → " : ""}<span class="linkish" data-id="work:${esc(x.to)}">${esc(x.to)}</span> · ${x.by === "your correction" ? "moved by you" : "moved by Claude, worth checking"}${x.when ? ", " + esc(x.when.slice(0, 10)) : ""}</span></li>`).join("");
    return `<div class="card" style="margin-bottom:12px"><h3>Chats moved to another project (${m.length})</h3><ul class="mini">${rows}</ul><p class="cant">Every move is saved on this Mac. To undo one, open its project and use the chat's row.</p></div>`;
  }
  function checkCard() {
    const c = G.checks || {}, pct = (a, b) => (b ? Math.round((100 * (a - b)) / b) : 0);
    const ten = (v) => `<span class="estimate">about $${(Math.round(v / 10) * 10).toLocaleString()}</span>`;
    const line = (k, why) => { const x = c[k]; if (!x || !x.sessions) return ""; const d = pct(x.ours, x.theirs); return `<div class="row"><span>${k}, ${x.sessions} of the ${x.recorded_sessions} chats that kept a figure</span><span class="measured">ours is ${d > 0 ? d + "% higher" : d < 0 ? -d + "% lower" : "the same"}</span></div><p class="cant" style="margin:4px 0 10px">On those chats, ${k}'s own figure is ${ten(x.theirs)} and Crossview counts ${ten(x.ours)}. ${why}</p>`; };
    return `<div class="card"><h3>Do these numbers match the apps' own?</h3>
      ${line("Claude Code", "Ours is lower because Claude Code also makes small background calls that never reach the logs, such as writing chat titles and summing up web pages.")}
      ${line("Cowork", "Ours is higher because Cowork's own figure prices the stored conversation at the cheaper short-term rate. Its logs show the longer-kept kind, which has a higher published price.")}
      <p class="cant">Codex records how much text it read and wrote but no dollar figure, so it can't be checked this way. Only chats where both counts cover the same replies are compared.</p>
      <p class="cant">Limits are counted once per limit window, from each app's own records. To check this week yourself, type /usage in Claude Code and press w. The skills and subagents it lists as using the most in the last 7 days should lead here too. It reads the same logs on this Mac and keeps no past weeks.</p></div>`;
  }

  // ---------- progress of this build (reads TASKS.md through progress.js) ----------
  const P = window.GB_PROGRESS || null;
  const ST = { done: ["Done", "st-done"], doing: ["In progress", "st-doing"], next: ["Next", "st-next"], waiting: ["Waiting on you", "st-wait"], later: ["Later", "st-later"] };
  const hrs = (e) => { const m = String(e || "").match(/(\d+(?:\.\d+)?)(?:\s*to\s*(\d+(?:\.\d+)?))?/); return m ? [Number(m[1]), Number(m[2] || m[1])] : [0, 0]; };
  const nowTask = () => (P ? P.tasks.find((t) => t.status === "doing") || P.tasks.find((t) => t.status === "next") : null);
  function progress() {
    if (!P) return `<div class="screen"><h2>How Crossview is being built</h2><p class="sub">There's no task list yet. Refresh from the logs, then open this page again.</p></div>`;
    const steps = P.tasks.reduce((a, t) => a.concat(t.steps), []), stepsDone = steps.filter((x) => x.done).length;
    const done = P.tasks.filter((t) => t.status === "done");
    const est = P.tasks.reduce((a, t) => { const h = hrs(t.estimate); return [a[0] + h[0], a[1] + h[1]]; }, [0, 0]);
    const left = P.tasks.filter((t) => t.status !== "done").reduce((a, t) => { const h = hrs(t.estimate); return [a[0] + h[0], a[1] + h[1]]; }, [0, 0]);
    const range = (r) => (r[0] === r[1] ? `${r[0]}` : `${r[0]} to ${r[1]}`);
    const days = Math.max(0, Math.round((new Date("2026-10-16T12:00:00") - new Date()) / 864e5));
    const rows = P.tasks.slice().sort((a, b) => (a.n || 0) - (b.n || 0)).map((t) => {
      const st0 = String(t.status || "").split(/[ (]/)[0], [word, cls] = ST[st0 === "building" ? "doing" : st0] || ["Not set", "st-later"], stNote = (String(t.status || "").match(/\((.*)\)/) || [])[1];
      const n = t.steps.length, d = t.steps.filter((x) => x.done).length;
      const list = t.steps.map((x) => `<li class="${x.done ? "on" : ""}"><span class="tick" aria-hidden="true">${x.done ? "✓" : ""}</span>${esc(x.text)}<span class="sr">${x.done ? " (done)" : " (not yet)"}</span></li>`).join("");
      const when = t.finished ? `Finished ${esc(t.finished)}.${t.took != null ? ` It took ${t.took < 60 ? t.took + " minutes" : (t.took / 60).toFixed(1) + " hours"} by the clock, and the plan said ${esc(t.estimate || "nothing")}.` : ""}` : t.started ? `Started ${esc(t.started)}` : "Not started";
      const open = cls === "st-doing" ? " open" : "";
      return `<details class="task ${cls}"${open}><summary><span class="tn">${t.n}</span><span class="tname">${esc(t.name)}<small>${esc(t.why || "")}</small></span>
        <span class="tmeta"><span class="st ${cls}"${stNote ? ` data-tip="${esc(stNote.charAt(0).toUpperCase() + stNote.slice(1))}."` : ""}>${word}</span><span class="tbar" title="${d} of ${n} steps"><i style="width:${n ? (100 * d) / n : 0}%"></i></span><small>${d} of ${n} steps · ${esc(t.estimate || "")}</small></span></summary>
        <ul class="steps">${list}</ul>${t.notes ? `<p class="when" style="color:var(--ink)">${esc(t.notes)}</p>` : ""}<p class="when">${when}</p></details>`;
    }).join("");
    return `<div class="screen build-page"><p class="r-crumb"><button class="w-link" data-go="screen:home">Home</button> › <b>How Crossview is being built</b></p><h2>How Crossview is being built</h2><p class="sub">The build's task list, in number order. Claude keeps it up to date, and this page reads it.</p>
      <div class="kpis"><div class="kpi"><div class="v">${fig(`<span class="measured">${done.length} of ${P.tasks.length}</span>`, "tasksDone")}</div><div class="l">tasks done</div></div>
      <div class="kpi"><div class="v"><span class="measured">${stepsDone} of ${steps.length}</span></div><div class="l">steps done</div></div>
      <div class="kpi"><div class="v">${fig(`<span class="estimate">${range(left)} h</span>`, "hours")}</div><div class="l">planned for what's left, out of ${range(est)} in all${P.tasks.some((t) => t.took != null) ? `. The finished tasks took ${P.tasks.reduce((a, t) => a + (t.took || 0), 0)} minutes by the clock` : ""}</div></div>
      </div>
      <div class="overall" title="${stepsDone} of ${steps.length} steps"><i style="width:${(100 * stepsDone) / Math.max(1, steps.length)}%"></i></div>
      <div class="tasks">${rows}</div></div>`;
  }
  function progressSide() {
    // the build's own project, counted the way Work counts it (QA, Oct 19, night: the old count looked for its old name)
    const wb = (G.work || []).find((w) => /^Agent (Crossview|Glass Box)$/.test(w.name)), b0 = P && P.build;
    const b = b0 ? Object.assign({}, b0, wb && !b0.sessions ? { sessions: Object.values(wb.tools || {}).reduce((x, y) => x + y, 0) } : {}) : null;
    const used = b ? `<div class="kv"><span>Chats</span>${measured(b.sessions)}<span>Subagents started</span>${measured(b.helpers)}${b.first ? `<span>Since</span><span class="measured">${day(b.first)}</span>` : ""}<span>Pay-per-use price so far</span>${b.priced ? about(b.usd) : '<span class="unknown">being recounted in task 1</span>'}</div>
      <p class="cant">Crossview counts its own build as one project, Agent Crossview, the same way it counts your other work.</p>` : '<p class="empty">Not counted yet.</p>';
    const wait = P && P.waiting.length ? P.waiting.map((w) => `<li><span>${esc(w)}</span></li>`).join("") : "";
    return `<div class="build-side"><div class="card"><h3>What this build has used</h3>${used}</div>
      ${wait ? `<div class="card"><h3>Waiting on you</h3><ul class="mini">${wait}</ul></div>` : ""}</div>`;
  }

  // ---------- one piece of work, opened up ----------
  const ORIGIN_COLOR = (o) => (o === "Made by you" ? "#38bdf8" : o === "Came with Claude Code" ? "#34d399" : "#a78bfa");
  const pctOf = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  function teamSvg(o) {
    const d = o.detail, mains = Object.entries(d.main).filter(([, v]) => v > 0), helpers = d.helpers.slice(0, 8), more = d.helpers.length - helpers.length;
    const W = 560, cols = 4, rowsN = Math.ceil(helpers.length / cols), H = 150 + rowsN * 92 + (more > 0 ? 18 : 0), cx = W / 2;
    let g = `<ellipse cx="${cx}" cy="96" rx="${70 + mains.length * 60}" ry="34" fill="#1b2b48" stroke="#2b4068"/>`;
    const person = (x, y, color, scale, label, sub, usd, id) => `<g class="hit"${id ? ` data-id="${esc(id)}"` : ""} data-tip="${esc(label)}, ${esc(sub)}">
      <rect x="${x - 7 * scale}" y="${y - 30 * scale}" width="${14 * scale}" height="${30 * scale}" rx="${7 * scale}" fill="${color}"/><circle cx="${x}" cy="${y - 37 * scale}" r="${6.5 * scale}" fill="${color}"/>
      ${coins(x + 15 * scale, y, usd, "")}<text x="${x}" y="${y + 16}" text-anchor="middle" class="tm-name">${esc(label)}</text><text x="${x}" y="${y + 29}" text-anchor="middle" class="tm-sub">${esc(sub)}</text></g>`;
    mains.forEach(([t, v], i) => { const x = cx + (i - (mains.length - 1) / 2) * 150; g += person(x, 92, "#e2e8f0", 1.3, `${t}`, money(v), v); });
    helpers.forEach((h, i) => {
      const r = Math.floor(i / cols), inRow = Math.min(cols, helpers.length - r * cols), x = cx + ((i % cols) - (inRow - 1) / 2) * (W / cols), y = 200 + r * 92;
      const a = A[h.type]; g += person(x, y, ORIGIN_COLOR(a ? a.origin : "Came with Claude Code"), 0.9, h.type, `${h.runs} run${h.runs === 1 ? "" : "s"} · ${money(h.usd)}`, h.usd, a ? a.id : null);
    });
    if (!helpers.length) g += `<text x="${cx}" y="170" text-anchor="middle" class="tm-sub">No subagents worked on this project</text>`;
    if (more > 0) g += `<text x="${cx}" y="${H - 4}" text-anchor="middle" class="tm-sub">and ${more} more kinds of subagent</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" style="max-width:${W}px;margin:0 auto" role="img" aria-label="The app you talk to and the subagents that worked on this project">${g}</svg>`;
  }
  function whyCard(o) {
    const d = o.detail, k = d.kinds, tk = (k.read || 0) + (k.write || 0) + (k.out || 0) + (k.fresh || 0);
    const mainUsd = Object.values(d.main).reduce((a, b) => a + b, 0), helpUsd = d.helpers.reduce((a, h) => a + h.usd, 0), runs = d.helpers.reduce((a, h) => a + h.runs, 0);
    const ms = Object.entries(d.models).filter(([, v]) => v > 0), topM = ms[0], longest = d.sessions.slice().sort((a, b) => b.usd - a.usd)[0];
    const top = (m) => /opus|fable|mythos|gpt-6-astra|gpt-5.6-sol/.test(m);
    const topShare = pctOf(ms.filter(([m]) => top(m)).reduce((a, [, v]) => a + v, 0), o.usd);
    const lines = [];
    const uk = d.usd_kinds || {}, ut = Object.values(uk).reduce((a, b) => a + b, 0);
    if (ut) lines.push(`<b>${pctOf((uk.read || 0) + (uk.write || 0), ut)}%</b> of its pay-per-use price went to the conversation itself. Re-reading it before each step took ${pctOf(uk.read || 0, ut)}%, and storing it for re-reading took ${pctOf(uk.write || 0, ut)}%. Writing answers took ${pctOf(uk.out || 0, ut)}%. Long chats cost more because every step re-reads everything so far.`);
    if (o.usd) lines.push(`The app you talk to used <b>${pctOf(mainUsd, o.usd)}%</b> of its pay-per-use price. Subagents used ${pctOf(helpUsd, o.usd)}% across ${runs} run${runs === 1 ? "" : "s"}${(() => { if (!d.helpers.length) return ""; const byRuns = d.helpers.slice().sort((a, b) => b.runs - a.runs)[0], byUsd = d.helpers.slice().sort((a, b) => b.usd - a.usd)[0]; return byRuns.type === byUsd.type ? `, mostly ${esc(byRuns.type)}` : `. ${esc(byRuns.type)} ran most often, ${byRuns.runs} times, and ${esc(byUsd.type)} cost the most, ${money(byUsd.usd)}`; })()}.`);
    if (topM) lines.push(`<b>${topShare}%</b> of its pay-per-use price went to the most capable and most expensive models, which are Claude's Opus and Fable and OpenAI's GPT-6 Astra and GPT-5.6 Sol. ${esc(modelName(topM[0]))} took the most, ${pctOf(topM[1], o.usd)}%. Only running the same task on a cheaper model can show whether it would have done as well, and that comes later.`);
    if (d.busiest && d.sessions.length > 1) lines.push(`The busiest day was ${day(d.busiest.day)}, at ${money(d.busiest.usd)}.`);
    if (longest && d.sessions.length > 1) lines.push(`The costliest of its ${d.sessions.length} chats used ${money(longest.usd)} over ${longest.replies.toLocaleString()} replies.`);
    if (d.hits.length) lines.push(`A limit stopped you ${d.hits.length} time${d.hits.length === 1 ? "" : "s"} while it was running. On average, it made up ${Math.round(d.hits.reduce((a, h) => a + (h.share || 0), 0) / d.hits.length)}% of what ran before those hits.`);
    return `<div class="card why"><h3>Why did it cost what it did?</h3><ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>
      <p class="ai" style="border-left-color:var(--sky)">These lines come straight from the numbers on this page. No AI wrote them.</p>
      <p class="cant">The logs are read for counts only, so what each reply was about isn't known. Work outside Claude Code, Cowork and Codex isn't counted.</p></div>`;
  }
  function timeline(o) {
    const d = o.detail, days = Object.keys(d.days); if (!days.length) return "";
    const first = new Date(days[0] + "T12:00:00"), last = new Date(days[days.length - 1] + "T12:00:00"), span = Math.round((last - first) / 864e5) + 1;
    const byWeek = span > 45, buckets = {};
    Object.entries(d.days).forEach(([k, v]) => { const dt = new Date(k + "T12:00:00"); const key = byWeek ? new Date(dt - ((dt.getDay() + 6) % 7) * 864e5).toISOString().slice(0, 10) : k; buckets[key] = buckets[key] || {}; Object.entries(v).forEach(([t, u]) => (buckets[key][t] = (buckets[key][t] || 0) + u)); });
    const keys = [], step = byWeek ? 7 : 1;
    for (let t = byWeek ? new Date(Object.keys(buckets).sort()[0] + "T12:00:00") : first; t <= last; t = new Date(+t + step * 864e5)) keys.push(t.toISOString().slice(0, 10));
    const W = 1300, H = 190, mx = Math.max(...keys.map((k) => Object.values(buckets[k] || {}).reduce((a, b) => a + b, 0))) || 1, slot = (W - 20) / keys.length, bw = Math.max(2, Math.min(34, slot * 0.6));
    let g = "";
    keys.forEach((k, i) => {
      let y = H - 22; const x = 10 + i * slot + (slot - bw) / 2;
      ["Claude Code", "Cowork", "Codex"].forEach((t) => { const v = (buckets[k] || {})[t] || 0; if (!v) return; const h = ((H - 40) * v) / mx; g += `<rect x="${x}" y="${y - h}" width="${bw}" height="${h}" rx="2" fill="${TOOLC[t]}"><title>${byWeek ? "Week of " : ""}${day(k)}, ${t}, ${money(v)}</title></rect>`; y -= h; });
      if (i === 0 || i === keys.length - 1 || keys.length <= 8 || i % Math.ceil(keys.length / 6) === 0) g += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" class="ax">${day(k)}</text>`;
    });
    if (o.tools && o.tools.Cowork && G.cowork_end) { const bi = keys.findIndex((k) => k > G.cowork_end); if (bi >= 0) g = `<defs><pattern id="hatch2" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#64748b" stroke-width="2"/></pattern></defs><rect x="${10 + bi * slot}" y="6" width="${(keys.length - bi) * slot}" height="${H - 28}" fill="url(#hatch2)" opacity=".18"/><text x="${10 + bi * slot + 6}" y="18" class="band-label">No Cowork logs after ${day(G.cowork_end)}</text>` + g; }
    d.hits.forEach((h) => { const k = byWeek ? null : localDay(h.ts); const i = k ? keys.indexOf(k) : -1; if (i < 0) return; const x = 10 + i * slot + slot / 2; g += `<g><path d="M${x - 5} 14 L${x + 5} 14 L${x} 22 Z" fill="#fde68a"/><title>${esc(h.tool || "")} limit hit, ${when(h.ts)}. This project was ${h.share || "?"}% of what ran before it.</title></g>`; });
    const leg = ["Claude Code", "Cowork", "Codex"].filter((t) => o.usd_tool && o.usd_tool[t]).map((t) => `<span><i style="background:${TOOLC[t]}"></i>${t}</span>`).join("") + (d.hits.length ? '<span><i style="background:#fde68a;border-radius:0"></i>A limit stopped you</span>' : "");
    return `<div class="card"><h3>Pay-per-use price ${byWeek ? "by week" : "by day"}</h3><svg viewBox="0 0 ${W} ${H}" style="max-width:${W}px" role="img" aria-label="Timeline of this project">${g}</svg><div class="legend" style="font-size:12px;color:#c7cfdd">${leg}</div>${howCard("timeline")}</div>`;
  }
  function workView() {
    const o = byId[S.work]; if (!o || !o.detail) return `<div class="screen"><h2>Project</h2><p class="sub">There are no replies in the logs for this project.</p></div>`;
    const d = o.detail, allUsd = Object.values(G.by_tool || {}).reduce((a, b) => a + b, 0);
    const BY = { "title or folder": "Grouped here by its title or folder", "folder only": "Grouped here by its folder", "your correction": "Moved here by you", "Claude's correction": "Moved here by Claude, worth checking", none: "Not grouped yet, so pick a project" };
    const names = G.work.map((w) => w.name).filter((n) => n !== o.name && !["Day job", "Personal"].includes(n)).sort();
    const mover = (x) => (o.hidden_titles ? '<span class="unknown">kept private</span>' : LIVE ? `<select class="move" data-move="${esc(x.id)}" aria-label="Move this chat to another project"><option value="">Move to…</option>${names.map((n) => `<option>${esc(n)}</option>`).join("")}<option value="__new">A new project…</option>${x.by === "your correction" ? '<option value="__undo">Undo my move</option>' : ""}</select>` : "");
    const sess = d.sessions.map((x) => `<tr><td>${day(x.start.slice(0, 10))}</td><td>${esc(x.tool)}</td><td>${x.title ? esc(x.title) : o.hidden_titles ? '<span class="unknown">title hidden</span>' : '<span class="unknown">untitled</span>'}<div class="by">${esc(BY[x.by] || x.by || "")}</div></td><td>${measured(x.replies)}</td><td>${x.helpers ? measured(x.helpers) : "0"}</td><td>${about(x.usd)}</td><td>${mover(x)}</td></tr>`).join("");
    const skills = Object.entries(d.skills).map(([k, n]) => { const sk = G.skills.find((z) => z.name === k); return `<button class="tool lit" ${sk ? `data-id="${esc(sk.id)}"` : ""}>${esc(k)} · ${n}</button>`; }).join("") || '<span class="unknown">Claude Code’s logs show no skills used.</span>';
    return `<div class="screen work-screen"><div class="crumb"><span class="linkish" data-go="screen:mission">Mission control</span> › ${esc(o.name)}</div>
      <h2>${esc(o.name)}</h2><p class="sub">${o.sessions} chat${o.sessions === 1 ? "" : "s"} from ${day(o.first)} to ${day(o.last)}, with ${Object.entries(o.tools).map(([t, n]) => `${n} in ${esc(t)}`).join(", ")}.${o.hidden_titles ? " Titles are hidden." : ""}</p>
      <div class="kpis"><div class="kpi"><div class="v">${fig(about(o.usd), "workUsd")}</div><div class="l">at pay-per-use prices</div></div>
      <div class="kpi"><div class="v">${fig(`<span class="estimate">${pctOf(o.usd, allUsd)}%</span>`, "workShare")}</div><div class="l">of everything in the logs, at pay-per-use prices</div></div>
      <div class="kpi"><div class="v">${fig(measured(d.helpers.reduce((a, h) => a + h.runs, 0)), "workRuns")}</div><div class="l">subagent runs</div></div>
      <div class="kpi"><div class="v">${fig(measured(d.hits.length), "workHits")}</div><div class="l">times a limit stopped you while it was running</div></div></div>
      <div class="mc-grid"><div class="card"><h3>Who worked on it?</h3>${teamSvg(o)}<p class="cant">The large figure is the app you talk to. The smaller ones are subagents it handed part of the job to. Coins show the estimated pay-per-use price. Click a subagent for its details.</p></div>${whyCard(o)}</div>
      ${timeline(o)}
      <div class="card"><h3>Which skills did it use?</h3><div class="tools">${skills}</div></div>
      <div class="card" style="margin-top:12px"><h3>Chats</h3><table class="work"><thead><tr><th>Started</th><th>App</th><th>Title</th><th>Replies</th><th>Subagents</th><th>Pay-per-use price</th><th></th></tr></thead><tbody>${sess}</tbody></table>
      ${LIVE ? '<p class="cant">If a chat is in the wrong project, move it and every total updates. Moves are saved on this Mac, and you can undo them.</p>' : DEMO ? '<p class="cant">This is the demo company, so moving chats is turned off.</p>' : '<p class="cant">To move a chat to another project, open Crossview by double-clicking the Agent Crossview file in its folder.</p>'}
      ${howCard("workSessions")}</div></div>`;
  }

  // ---------- side column ----------
  const items = () => [...G.notes.map((n) => ({ key: "note:" + n.id, kind: "note", title: n.title, line: n.because[0].text, target: n.target })), ...FLAGS.map((f) => ({ key: "flag:" + f.id, kind: "flag", title: f.title, line: f.line, target: f.target }))].filter((i) => !S.snoozed.has(i.key)).slice(0, 5);
  function listView(noWeek) {
    const it = items();
    const list = it.length ? it.map((i) => `<div class="item" data-open="${esc(i.key)}"><span class="it-ic" style="background:${i.kind === "note" ? "#e0b85a" : "#f87171"}">${i.kind === "note" ? "A" : "!"}</span><div><div class="it-title">${esc(i.title)}</div><div class="it-line">${esc(i.line)}</div></div><button class="snooze" data-snooze="${esc(i.key)}" title="Hides this from the list until you press Show hidden">Not now</button></div>`).join("") : '<p class="empty">Nothing needs a look right now.</p>';
    const ww = weekWork.map((w) => `<li class="linkish" data-id="${esc(w.id)}"><span>${esc(w.name)}</span>${about(w.week_usd)}</li>`).join("");
    return `<div class="card"><h3>Worth a look (${it.length})</h3>${list}${S.snoozed.size ? `<button class="back" data-unsnooze="1" style="margin-top:8px">Show ${S.snoozed.size} hidden</button>` : ""}
      <p class="ai">Items marked A are the advisor's notes, which an AI wrote on Oct 10. Their numbers update on every refresh. The red items come straight from the counts and point out a subagent that never ran or a room where nothing ran for a week.</p></div>
      ${noWeek ? "" : `<div class="card"><h3>This week's work</h3><ul class="mini">${ww}</ul><p class="cant">${weekHits.length ? `A limit stopped you ${weekHits.length} time${weekHits.length === 1 ? "" : "s"} this week, on ${[...new Set(weekHits.map((h) => day(localDay(h.ts))))].join(", ")}.` : "No limit stopped you this week."}</p></div>`}`;
  }

  function linkTo(go, text) { return `<span class="linkish" data-go="${esc(go)}">${text}</span>`; }

  function detailView(id) {
    const o = byId[id] || (id === "advisor" ? { type: "advisor" } : null);
    if (!o) return listView();
    const back = '<button class="back" data-back="1">← Back to the list</button>';
    const how = howCard(o.type === "agent" ? "agentSide" : o.type === "skill" ? "skillUses" : "workSide");
    if (o.type === "agent") {
      const rbt = o.runs_by_tool || {}, split = Object.keys(rbt).length > 1 ? `, with ${Object.entries(rbt).map(([t, n]) => `${n} in ${t}`).join(", ")}` : "";
      const where = (o.where || []).map((x) => `<li class="linkish" data-id="work:${esc(x.work)}"><span>${x.work === "Not sure yet" ? "Not in a project yet" : esc(x.work)}</span><span><span class="measured">${x.runs} run${x.runs === 1 ? "" : "s"}</span> · ${about(x.usd)}</span></li>`).join("");
      return `<div class="card det">${back}<h2>${esc(o.name)}</h2><span class="chip">${esc(o.origin)}</span><span class="chip">subagent</span>
        <p>${esc(o.plain)}</p><p class="ai">An AI wrote this description. ${o.raw ? "What its file says is below." : ""}</p>
        <div class="kv"><span>Runs in all the logs</span>${o.runs ? fig(`<span class="measured">${o.runs}${esc(split)}</span>`, "agentRuns") : '<span class="unknown">none in the logs</span>'}<span>Runs this week</span>${measured(o.week)}<span>Last ran</span>${lastText(o.last)}<span>Pay-per-use price, all time</span>${o.usd ? fig(about(o.usd), "agentUsd") : '<span class="unknown">none in the logs</span>'}<span>Pay-per-use price, this week</span>${o.usd_week ? about(o.usd_week) : '<span class="unknown">none</span>'}</div>
        ${o.usd ? `<div class="coinrow">${coinSvg(o.usd)}<span>${coinsFor(o.usd)} coins. Each extra coin means roughly double the pay-per-use price. Cost is shown only by coins and never by color.</span></div>` : ""}
        ${Object.keys(o.models || {}).length ? `<h3>Which models did it run on, by share of its price?</h3><ul class="mini">${modelRows(o.models, o.usd)}</ul>` : ""}
        ${where ? `<h3>Which projects did it work on?</h3><ul class="mini">${where}</ul>
        <p class="cant">A run is one time the app you talk to handed it work. The price is estimated from its own logs, with every reply at pay-per-use prices${o.usd_est >= 1 ? `, plus ${about(o.usd_est)} for writing those logs only partly kept` : ""}.${o.unlogged ? ` Claude Code started it ${o.unlogged} more time${o.unlogged === 1 ? "" : "s"} without keeping the log, so those runs aren't counted.` : ""}</p>` : ""}
        ${o.raw ? `<details class="how"><summary>What its file says</summary><p>${esc(o.raw)}</p></details>` : ""}${how}
        <p class="cant">${o.runs ? "The logs are read for counts only, so what it was asked and what it said aren't known." : `It hasn't run in any log on this Mac. Claude Code's logs start on ${day((R["Claude Code"] || [])[0])} and Cowork's end on ${day(G.cowork_end)}. You can keep it, rewrite it or remove it.`}</p></div>`;
    }
    if (o.type === "skill") {
      const ran = Object.entries(o.work || {}).map(([w, n]) => `<li class="linkish" data-id="work:${esc(w)}"><span>${esc(w)}</span>${measured(n)}</li>`).join("") || '<li><span class="unknown">No uses recorded</span></li>';
      return `<div class="card det">${back}<h2>${esc(o.name)}</h2><span class="chip">${esc(o.origin)}</span><span class="chip">loads into ${esc(o.scope)}</span>
        ${o.plain ? `<p>${esc(o.plain)}</p><p class="ai">An AI wrote this description.</p>` : ""}
        <div class="kv"><span>Uses in Claude Code since ${day((R["Claude Code"] || [])[0])}</span>${o.uses ? fig(measured(o.uses), "skillUses") : '<span class="unknown">none found</span>'}<span>Uses this week</span>${measured(o.week)}<span>Last used</span>${lastText(o.last)}${o.added ? `<span>Added</span><span class="measured">${day(o.added)}</span>` : ""}</div>
        <h3>Which projects used it?</h3><ul class="mini">${ran}</ul>
        ${o.raw ? `<details class="how"><summary>What its file says</summary><p>${esc(o.raw)}</p></details>` : ""}${how}
        <p class="cant">${o.origin === "Came with Claude Code" ? "This came with Claude Code and can't be removed." : o.uses ? "" : "Claude Code's logs show no uses, and Cowork and Codex weren't checked. It still loads into every chat it applies to."}</p></div>`;
    }
    if (o.type === "work") {
      const tools = Object.entries(o.tools).map(([t, n]) => `${n} in ${t}`).join(", ");
      return `<div class="card det">${back}<h2>${esc(o.name)}</h2><span class="chip">project</span>${o.hidden_titles ? '<span class="chip">titles hidden</span>' : ""}
        <div class="kv"><span>Chats</span><span>${measured(o.sessions)}, with ${esc(tools)}</span><span>When</span><span class="measured">${day(o.first)} to ${day(o.last)}</span><span>Subagents started</span>${measured(o.helpers)}<span>Pay-per-use price, all time</span>${o.usd == null ? '<span class="unknown">not recorded</span>' : about(o.usd)}<span>Pay-per-use price, this week</span>${o.week_usd ? about(o.week_usd) : '<span class="unknown">none recorded</span>'}</div>
        ${o.usd != null ? `<h3>By app</h3><ul class="mini">${Object.entries(o.usd_tool || {}).map(([t, v]) => `<li><span>${esc(t)}</span>${about(v)}</li>`).join("")}</ul>${o.usd_est >= 1 ? `<p class="cant">This includes ${about(o.usd_est)} estimated for subagents' writing, because their logs keep only part of it.</p>` : ""}` : '<p class="cant">There are no replies in the logs for these chats.</p>'}${how}</div>`;
    }
    if (o.type === "room") {
      const wk = S.mode === "week";
      const mem = (o.agents || []).map((n) => A[n]).filter(Boolean).map((a) => `<li class="linkish" data-id="${esc(a.id)}"><span>${esc(a.name)}</span><span>${!a.runs ? '<span class="unknown">never</span>' : wk ? (a.week ? `${measured(a.week)} · ${about(a.usd_week)}` : '<span class="unknown">none this week</span>') : `${measured(a.runs)} · ${about(a.usd)}`}</span></li>`).join("");
      const extra = o.id === "room:armory" ? `<p>${G.skills.length} skills, ${G.skills.filter((k) => k.uses).length} used. ${linkTo("screen:armory", "Open the skills view")}.</p>` : o.id === "room:control" ? `<p>${linkTo("screen:mission", "Open Mission control")} to see the pay-per-use price by week and by model, what the replies paid for, and every project.</p>` : o.id === "room:door" ? `<p>The advisor reads your numbers and suggests one thing per note. ${linkTo("advisor", "Read its notes")}.</p>` : "";
      const runs = (o.agents || []).reduce((t, n) => t + (A[n] ? (wk ? A[n].week : A[n].runs) : 0), 0);
      return `<div class="card det">${back}<h2>${esc(o.name)}</h2><span class="chip">room</span>${extra}${mem ? `<div class="kv"><span>Subagents</span>${measured(o.agents.length)}<span>${wk ? "Runs this week" : "Runs in all the logs"}</span>${measured(runs)}</div><h3>Who's here, with runs and pay-per-use price ${wk ? "this week" : "in all the logs"}</h3><ul class="mini">${mem}</ul><p class="cant">Press 1 for this week or 2 for all the logs.</p>` : ""}</div>`;
    }
    if (o.type === "note") {
      const bec = o.because.map((b) => `<li>${linkTo(b.go, esc(b.text))} <span class="${b.kind}">(${{ measured: "counted", estimate: "estimate", unknown: "not recorded" }[b.kind] || b.kind})</span></li>`).join("");
      return `<div class="card det">${back}<span class="chip">advisor note</span><h2 style="margin-top:6px">${esc(o.title)}</h2>
        <div class="note-part"><b>Because</b><ul style="margin:0;padding-left:18px">${bec}</ul></div>
        <div class="note-part"><b>What I can't see</b>${esc(o.cant)}</div>
        <div class="note-part"><b>You could</b>${esc(o.could)}</div>
        <div class="note-part"><b>Effect</b><span class="${o.preview.kind}">${esc(o.preview.text)}</span></div>
        <p class="ai">An AI wrote this on Oct 10 from the numbers on this screen. It only suggests and never changes anything.</p>
        <button class="snooze" data-snooze="note:${esc(o.id)}">Not now</button> <button class="snooze" data-go="${esc(o.target)}">Show me where</button></div>`;
    }
    if (o.type === "flag") {
      return `<div class="card det">${back}<span class="chip">worth a decision</span><h2 style="margin-top:6px">${esc(o.title)}</h2><p>${esc(o.line)}</p><p class="ai" style="border-left-color:var(--sky)">This comes straight from the counts. No AI wrote it.</p><button class="snooze" data-go="${esc(o.target)}">Show me where</button> <button class="snooze" data-snooze="flag:${esc(o.id)}">Not now</button></div>`;
    }
    if (o.type === "advisor") {
      const ns = G.notes.map((n) => `<div class="item" data-open="note:${esc(n.id)}"><span class="it-ic" style="background:#e0b85a">A</span><div><div class="it-title">${esc(n.title)}</div><div class="it-line">${esc(n.because[0].text)}</div></div><span></span></div>`).join("");
      return `<div class="card det">${back}<h2>The advisor</h2><span class="chip">${G.notes.length} notes</span><span class="chip">written Oct 10</span>
        <p>It reads the same numbers you see and suggests one thing per note. It never changes anything, and it says what it can't see.</p>${ns}
        <p class="ai">An AI writes these notes, at most three per refresh. After you act on one, the next refresh checks whether it had the effect it predicted.</p></div>`;
    }
    return listView();
  }

  // ---------- shared by the three screens (panel round 1, Oct 13) ----------
  // whole-number percentages that add up to their total (largest remainder), so parts never sum to 101%
  const shares = (vals, total = 100) => {
    const sum = vals.reduce((x, y) => x + y, 0);
    if (!sum) return vals.map(() => 0);
    const raw = vals.map((v) => (v * total) / sum), fl = raw.map(Math.floor);
    let left = Math.round(total) - fl.reduce((x, y) => x + y, 0);
    raw.map((r, i) => [r - fl[i], i]).sort((x, y) => y[0] - x[0]).forEach(([, i]) => { if (left > 0) { fl[i]++; left--; } });
    return fl;
  };
  // how far a connector reaches beyond this Mac, from every action it offers: 4 acts as you (browser or computer control),
  // 3 deletes in another app, 2 sends or publishes outside, 1 changes things in another app (or sends or deletes on this Mac), 0 reads
  const riskOf = (p) => { const k = p.kinds || [], out = p.outside; return p.as_you ? 4 : k.includes("delete") && out ? 3 : k.includes("send") && out ? 2 : (k.includes("change") && out) || k.includes("delete") || k.includes("send") ? 1 : 0; };
  // a browser or computer connector says what its setup really lets it do (camera fix batch, Oct 15; tools/machine_data.py reach_of)
  const REACH = { your_browser: "can act as you in your browser", screen: "can use your screen and keyboard as you", own_browser: "can use websites in a browser of its own", fresh_browser: "can use websites in a fresh browser" };
  const REACH_LINE = { your_browser: "It works in your own Chrome, where you're signed in, so it can act as you.", screen: "It can use your Mac's screen and keyboard as you.", own_browser: "It runs a browser of its own, which keeps anything you sign in to there.", fresh_browser: "It opens a fresh browser each time and keeps nothing." };
  const riskWords = (p) => p.reach && REACH[p.reach] ? REACH[p.reach] : ["", p.outside ? "can change things in another app" : "can change or remove things on this Mac", "can send or publish for you", "can delete things in another app", "can act as you in your browser"][riskOf(p)];
  // One rule for every screen (QA run 8): a connector "can act outside your Mac" when it can change, send or delete things
  // beyond this Mac; it's orange when it can send, delete or act as you there. One sentence for it, everywhere.
  riskWords.line = (p) => REACH_LINE[p.reach] || (riskOf(p) ? `It ${riskWords(p)}.` : "It only reads things.");
  riskWords.outside = (p) => !!p.outside && riskOf(p) >= 1;
  riskWords.hot = (p) => riskOf(p) >= 2;
  riskWords.key = "Can send, delete or act as you";
  // snoozed suggestions come back after a week; dismissed ones stay hidden until "Show hidden"
  const snoozedAt = store.get("snoozedAt", {});
  const snoozed = (k) => !!snoozedAt[k] && daysAgo(snoozedAt[k]) < 7;
  const snoozedCount = () => Object.keys(snoozedAt).filter(snoozed).length;
  const snooze = (k) => { snoozedAt[k] = G.today; store.set("snoozedAt", snoozedAt); };
  const unsnoozeAll = () => { Object.keys(snoozedAt).forEach((k) => delete snoozedAt[k]); store.set("snoozedAt", snoozedAt); };
  // the oldest log kept for an app, so "in all" and "never" say since when
  const since = (tool) => day(((G.ranges || {})[tool] || [])[0]);

  // ---------- render ----------
  let NOTE = null;
  const note = () => NOTE || (NOTE = window.GBWeek ? window.GBWeek({ G, S, esc, about, money, day, colOf, wkOf, localDay, HITS, WARN, KIND, when, items, byId, store, DEMO, LIVE, shares, riskOf, riskWords, since, snoozed, snoozedCount, modelName }) : null);
  let WORK = null;
  const workm = () => WORK || (WORK = window.GBWork ? window.GBWork({ G, S, esc, money, day, localDay, HITS, modelName, store, shares, riskOf, riskWords, since, snoozed, LIVE }) : null);
  let SHAPES = null;
  let HOME = null;
  // the receipt behind the home's cost card (release 2, Oct 19)
  let RECEIPT = null, WLIST = null;
  const wlist = () => WLIST || (WLIST = window.GBWorkList ? window.GBWorkList({ G, S, esc, day, modelName }) : null);
  const rec = () => RECEIPT || (RECEIPT = window.GBReceipt ? window.GBReceipt({ G, S, esc, money, day, modelName }) : null);
  const home = () => HOME || (HOME = window.GBHome ? window.GBHome({ G, S, esc, money, day, localDay, HITS, DEMO, LIVE, riskWords, note, anat }) : null);
  const shp = () => SHAPES || (SHAPES = window.GBShapes ? window.GBShapes({ G, S, esc, day, DEMO, LIVE, snoozed }) : null);
  let ANAT = null;
  const anat = () => ANAT || (ANAT = window.GBAnatomy ? window.GBAnatomy({ G, S, esc, money, day, shares, riskOf, riskWords, since, shapes: () => shp() }) : null);
  let MACH = null;
  const mach = () => MACH || (MACH = window.GBMachine ? window.GBMachine({ G, S, esc, about, money, day, measured, modelName, colOf, wkOf, localDay, HITS }) : null);
  const res = (go, k, html) => `<span class="res" role="link" tabindex="0" data-go="${go}" data-tip="${esc(howText(k))}">${html}<span class="sr">. ${esc(howText(k))}</span></span>`;
  // on the machine, the top bar counts the period the machine shows
  function machBar() {
    const b = mach().bar(), wk = b.per === "all" ? "screen:weeks" : "week:" + b.per, t = `What the work ${b.words} would cost if you paid per use. It's an estimate. You pay a flat subscription, so it isn't your bill. ${NOCOWORK}`;
    const planWeek = ((G.money || {}).plans || []).reduce((a, p) => a + (p.monthly_usd || 0), 0) * 12 / 52;
    const paid = b.per === "all" ? "" : `<b>about $${Math.round(planWeek)}</b> you paid ${esc(b.words)} · `;
    return `<span class="res" role="link" tabindex="0" data-go="${wk}" data-tip="${esc(t)}">${paid}${about(b.usd)} of work at pay-per-use prices<span class="sr">. ${esc(t)}</span></span>`;
  }
  function drawer() {
    let d = document.getElementById("drawer");
    if (!(S.screen === "machine" && S.drawer)) { if (d) d.remove(); return; }
    if (!d) { d = document.createElement("aside"); d.id = "drawer"; d.className = "drawer"; d.setAttribute("aria-label", "Worth a look"); document.body.appendChild(d); }
    d.innerHTML = `<button class="back" data-closedrawer="1">Close ✕</button>${S.side === "detail" && S.selected ? detailView(S.selected) : listView(true)}`;
  }
  function demoBand() {
    if (!DEMO || document.getElementById("demoband")) return;
    const b = document.createElement("div"); b.id = "demoband"; b.className = "demo-band"; b.setAttribute("role", "note");
    b.innerHTML = `<i class="w-led" aria-hidden="true"></i><b>Demo</b><span>One ${esc(DEMO.who)}'s AI work at ${esc(DEMO.company)}, a made-up company. Every name, project and number here is invented, so it's safe to show.</span><a href="${esc(demoHref(false))}">Leave the demo</a>`;
    document.body.insertBefore(b, document.body.firstChild);
  }
  // keyboard and screen readers (panel round 1): after a click redraws the page, focus goes back to the same control,
  // and a short line tells a screen reader what changed
  const FOCUS_KEYS = ["r", "wl", "h", "a", "go", "nper", "w", "keep", "snooze", "nwork", "whelper", "wapp", "yport", "unkeep"];
  function focusSel(el) {
    if (!el || el === document.body || !el.dataset) return null;
    for (const k of FOCUS_KEYS) if (el.dataset[k] != null) return `[data-${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}="${CSS.escape(el.dataset[k])}"]`;
    return el.id ? "#" + CSS.escape(el.id) : null;
  }
  let lastSaid = "";
  function say() {
    let live = document.getElementById("gb-live");
    if (!live) { live = document.createElement("div"); live.id = "gb-live"; live.className = "sr"; live.setAttribute("aria-live", "polite"); document.body.appendChild(live); }
    const per = S.nper === G.week_start ? "this week" : "last week", names = { cost: "What it cost", list: "Your work", note: "Your week", machine: "Your work", armory: "Your setup", shapes: "Your AI's instructions" };
    const t = S.screen === "armory" ? `Your setup, ${S.atool}, ${(document.querySelector(".a-panel h3") || {}).textContent || ""}${S.afilter && S.afilter !== "all" ? ", filtered" : ""}` : `${names[S.screen] || "Crossview"}, ${per}${S.screen === "machine" && S.mwork ? ", " + S.mwork : ""}`;
    if (t !== lastSaid) { live.textContent = t; lastSaid = t; }
  }
  function render() {
    const focused = focusSel(document.activeElement);
    // release 2 (Oct 19, his yes after Gemini's review): Home, Work and Setup on top; the older views move under More until release 3 retires them
    rooms();
    const TABS = [["home", "Home", "H"], ["armory", "Setup", "S"], ["list", "Work", "W"]], MORE = [];  // Setup before Work (his call, Oct 20)  // the older views left every click path (his call, Oct 19, night): More keeps the design system; the demo company leaves it until slice 3 fixes its pages (his yes, Oct 20)
    demoBand();
    const on = (k) => S.screen === k || (k === "home" && (S.screen === "cost" || S.screen === "note" || S.screen === "progress"));
    const light = S.screen === "home" || S.screen === "cost" || S.screen === "list" || S.screen === "note" || S.screen === "armory" || S.screen === "machine" || S.screen === "shapes";
    $("#bar").innerHTML = `<button class="brand" data-go="screen:home" aria-label="Agent Crossview: go to the home page"><i class="brand-mark" aria-hidden="true"></i>Agent Crossview</button>
      <nav class="tabs" aria-label="Main">${TABS.map(([k, l, kb]) => `<button data-go="screen:${k}" aria-pressed="${on(k)}"><i class="w-led" aria-hidden="true"></i>${l}<kbd aria-hidden="true">${kb}</kbd></button>`).join("")}</nav>
      <span class="spacer"></span>
      <div class="bar-slot${S.screen === "shapes" ? " s-bar" : ""}">${light && note() && S.screen !== "shapes" ? note().barRight(false) : `<span class="w-asof" data-tip="${esc(`${DEMO ? "Built from made-up logs" : "Read from the logs on this Mac"} at ${String(G.built).replace(/^\w+ \d+, /, "").toLowerCase()}.`)}"><i class="w-led idle"></i>Read at ${esc(String(G.built).replace(/^\w+ \d+, /, "").toLowerCase())}</span>`}</div>
      ${LIVE && light ? `<button class="w-btn quiet bar-refresh" data-refresh="1" aria-label="Refresh from the logs" data-tip="Reads the logs on this Mac again, about a minute. Nothing leaves this Mac."><span aria-hidden="true">↻</span><span class="bar-refresh-t"> Refresh</span></button>` : ""}
      <details class="more-menu"><summary${MORE.some(([k]) => on(k)) ? ' class="on"' : ""}><i class="w-led" aria-hidden="true"></i>More ▾</summary><nav class="more-list" aria-label="More pages">${MORE.map(([k, l, kb]) => `<button data-go="screen:${k}" aria-pressed="${on(k)}"${k === "progress" && nowTask() ? ` title="Now building ${esc(nowTask().name)}"` : ""}>${l}${k === "progress" && nowTask() ? '<span class="busy" aria-label="building now"></span>' : ""}<kbd>${kb}</kbd></button>`).join("")}<a class="more-link" href="system.html${DEMO ? "?demo" : ""}">Design system<small>The colors, type and parts it's built from</small></a>${DEMO ? `<a class="more-demo" href="${esc(demoHref(false))}">Leave the demo<small>Back to your own numbers</small></a>` : ""}</nav></details>`;
    $(".layout").classList.toggle("full", ["home", "cost", "list", "mission", "weeks", "work", "machine", "note", "armory", "shapes"].includes(S.screen));
    document.body.classList.toggle("lightpage", true);  // one light look across the app since Oct 13
    // Your setup keeps the panel's scroll position while you stay on one layer, so a click never makes the list jump
    const pnl = document.querySelector(".a-panel"), keepTop = S.screen === "armory" && pnl && S.aKey === S.atool + S.alayer ? pnl.scrollTop : 0;
    $("#stage").innerHTML = S.screen === "home" && home() ? home().board() : S.screen === "cost" && rec() ? rec().board() : S.screen === "list" && wlist() ? wlist().board() : S.screen === "shapes" && shp() ? shp().board() : S.screen === "note" && note() ? note().board() : S.screen === "machine" && workm() ? workm().board() : S.screen === "office" ? office() : S.screen === "armory" ? (anat() ? anat().board() : armory()) : S.screen === "progress" ? progress() : S.screen === "work" ? workView() : S.screen === "weeks" ? weeksView() : mission();
    if (S.qopen && ["home", "list", "cost", "armory"].includes(S.screen) && note() && note().sheetOver) $("#stage").insertAdjacentHTML("beforeend", note().sheetOver());
    drawer();
    $("#side").innerHTML = S.screen === "home" || S.screen === "cost" || S.screen === "list" || S.screen === "machine" || S.screen === "note" || S.screen === "armory" || S.screen === "shapes" ? "" : S.side === "detail" && S.selected ? detailView(S.selected) : S.side === "limits" ? limitsView() : S.screen === "progress" ? progressSide() : listView();
    $("#foot").innerHTML = S.screen === "home" || S.screen === "cost" || S.screen === "list" || S.screen === "machine" || S.screen === "note" || S.screen === "armory" || S.screen === "shapes" || S.screen === "progress" ? (DEMO ? `This demo company was built ${esc(G.built)} from made-up files. Nothing here comes from anyone's real logs, and Crossview sends nothing anywhere. <a href="reads.html${DEMO ? "?demo" : ""}">How Crossview counts</a>` : `Updated ${esc(G.built)} from the records on this Mac. Crossview sends nothing anywhere. <a href="reads.html${DEMO ? "?demo" : ""}">How Crossview counts</a>${P && P.tasks.length ? ` · <button class="w-link foot-built" data-go="screen:progress">How Crossview is being built</button>` : ""}${LIVE ? "" : " This copy is read-only. Double-click the Agent Crossview file to refresh it."}`) : `<div class="legend"><span><span class="measured">12</span> counted</span><span><span class="estimate">about $40</span> estimate, rounded</span><span><span class="unknown">not recorded</span> unknown</span><span><i style="background:#38bdf8"></i>Made by you</span><span><i style="background:#34d399"></i>Came with Claude Code</span><span><i style="background:#a78bfa"></i>Only in one project</span><span><i style="background:#fbbf24"></i>The advisor</span><span>${coinSvg(3)} Pay-per-use price, estimated, with each extra coin roughly doubling it</span><span><i style="background:#f87171;border-radius:4px"></i>Worth a decision</span></div>
      Updated ${esc(G.built)} from the records on this Mac. ${LIVE ? '<button class="snooze" data-refresh="1">Refresh from the logs now</button> ' : "This copy is read-only. To refresh it or correct it, double-click the Agent Crossview file in its folder. "}Nothing leaves this Mac. ${esc(CANT)}`;
    if (S.screen === "armory") { const p2 = document.querySelector(".a-panel"); if (p2) p2.scrollTop = keepTop; S.aKey = S.atool + S.alayer; }
    reachable();
    if (focused) { const back = document.querySelector(focused); if (back) back.focus({ preventScroll: true }); }
    // a sheet gives the focus back to the button that opened it when it closes, on every room (QA, Oct 20)
    const sheetOpen = !!(S.qopen || S.sopen);
    if (sheetOpen && !S.sheetWas) S.opener = focused;
    if (!sheetOpen && S.sheetWas && S.opener) { const b = document.querySelector(S.opener); if (b) b.focus({ preventScroll: true }); S.opener = null; }
    S.sheetWas = sheetOpen;
    say();
    // wires are drawn from where the boxes landed: now (reading the layout forces it), and again once fonts settle
    const wire = S.screen === "shapes" && shp() ? shp().after : S.screen === "note" && note() ? note().after : S.screen === "machine" && workm() ? workm().after : S.screen === "armory" && anat() ? anat().after : null;
    if (wire) { wire(); setTimeout(wire, 150); }
    // the before-reset preview opens below the chart: bring it into view so the link visibly did something (QA, Oct 20)
    if (S.qbrGo) { S.qbrGo = false; setTimeout(() => { const e = document.querySelector(".q-br"); if (e) e.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, 200); }
    // a change sheet opened over Home, Work, the receipt or Setup takes the focus, as it does on the limit page (QA, Oct 20)
    if (S.qfocus && ["home", "list", "cost", "armory"].includes(S.screen)) { const h = document.querySelector("#q-sheet-h"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); S.qfocus = false; } }
    if (window.GBWords) window.GBWords();  // on Windows: the screen-reader notes set just above say "computer" too
    textScale(); setTimeout(textScale, 160); morePanel(); setTimeout(morePanel, 170); moreSheet(); setTimeout(moreSheet, 170);
    // every move between screens is one step in the browser's history, so Back returns to where you were (QA run 2)
    const want = addressOf();
    if (!S.fromHistory && decodeURIComponent(location.hash) !== want) history.pushState(null, "", "#" + encodeURIComponent(want.slice(1)).replace(/%3A/g, ":"));
    S.fromHistory = false;
  }
  // three rooms only (his call, Oct 19, night): every screen belongs to Home, Work or Setup. The older views' screens open
  // the room that now holds what they showed; Your week's limit chart is Home's limit page, one level down, and the week
  // in detail and All weeks aren't reachable until release 4 brings past weeks into Work
  function rooms() {
    if (["machine", "office", "work", "mission", "weeks"].includes(S.screen)) S.screen = "list";
    if (S.screen === "shapes") { S.screen = "armory"; S.atool = S.atool || "Claude Code"; S.alayer = "instructions"; S.asel = null; }
    if (S.screen === "note") { S.nview = null; S.allw = false; }
  }
  // the address bar names the tab the way the tab does (his note, Oct 16); the screens keep their old inside names
  const ADDR = { home: "home", cost: "cost", list: "chats", note: "limits", armory: "setup" };
  const FROM = { chats: "list", limits: "note", week: "note", detail: "note", "all-weeks": "note", mission: "note", weeks: "note", work: "list", "all-projects": "list", setup: "armory", instructions: "shapes", office: "armory" };
  function addressOf() {
    if (S.screen === "weeks" && S.week) return "#week:" + S.week;
    return "#" + (ADDR[S.screen] || S.screen);
  }
  // drawings scale their text with the drawing; each one gets its inverse scale, so CSS keeps its words at 11px or more
  // the stage's panel says when there is more below, and stops saying it once you reach the end
  function morePanel() {
    const p = document.querySelector(".g-panel"), b = p && p.querySelector(".g-body"); if (!b) return;
    const set = () => p.classList.toggle("has-more", b.scrollHeight - b.clientHeight - b.scrollTop > 6);
    set(); b.onscroll = set;
  }
  // the same marker on a sheet that scrolls (QA run 4, finding 9); opening a fold can make it scroll
  function moreSheet() {
    const p = document.querySelector(".q-sheet"), b = p && p.querySelector(".q-sheet-b"); if (!b) return;
    const set = () => p.classList.toggle("has-more", b.scrollHeight - b.clientHeight - b.scrollTop > 6);
    // a click inside the same sheet (a plan picked lower down) keeps its place instead of jumping to the top (QA, Oct 17)
    const k = S.qopen || S.sopen || "sheet";
    if (moreSheet.k === k) b.scrollTop = moreSheet.top || 0; else moreSheet.top = 0;
    moreSheet.k = k;
    set(); b.onscroll = () => { moreSheet.top = b.scrollTop; set(); }; b.addEventListener("toggle", () => requestAnimationFrame(set), true);
  }
  function textScale() { document.querySelectorAll("#stage svg[viewBox]").forEach((svg) => { const m = svg.getScreenCTM && svg.getScreenCTM(); if (m && m.a) svg.style.setProperty("--ik", (1 / m.a).toFixed(3)); }); }
  window.addEventListener("resize", () => requestAnimationFrame(textScale));
  // keyboard and screen readers: everything clickable can be reached with Tab and opened with Enter; map figures get their tip as a name
  function reachable() {
    // a note that appears on hover is also read out to keyboard and screen-reader users
    document.querySelectorAll("button[data-tip], a[data-tip], [tabindex][data-tip], summary[data-tip]").forEach((el) => { if (!el.hasAttribute("aria-description")) el.setAttribute("aria-description", el.dataset.tip); });
    document.querySelectorAll('#stage g.hit:not([data-id^="skill:"]), #stage rect.wk, li.linkish, span.linkish, tr.click, .item[data-open]').forEach((el) => {
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
      if (!el.hasAttribute("role")) el.setAttribute("role", el.tagName === "TR" || el.matches("li,span") ? "link" : "button");
      if (el instanceof SVGElement && !el.hasAttribute("aria-label")) el.setAttribute("aria-label", el.dataset.tip || (el.dataset.week ? "Week of " + day(el.dataset.week) : "Open"));
    });
  }
  function hitLine(h) {
    const run = (h.running || []).slice(0, 3).map((r) => `<span class="linkish" data-id="work:${esc(r.work)}">${r.work === "Not sure yet" ? "Not in a project yet" : esc(r.work)}</span> <span class="estimate">${r.share}%</span>`).join(", ");
    const gap = h.plan === "Claude" ? (G.cowork_end && localDay(h.ts) > G.cowork_end ? ` Cowork has no logs after ${day(G.cowork_end)}, and the Claude app shares this limit but keeps no logs on this Mac, so work in either is missing.` : " The Claude app shares this limit but keeps no logs on this Mac, so its work is missing.")
      : (G.unpriced || {})["codex-auto-review"] ? " Codex's automatic reviewer has no published price, so its work can't show in these shares." : "";
    return `<li class="hitrow"><div><b>${when(h.ts)}</b> · ${esc(h.tool)}, ${KIND[h.kind] || esc(h.kind)}${h.repeats > 1 ? `, hit ${h.repeats} times` : ""}</div><div class="cant" style="margin-top:4px">In the ${h.kind === "seven_day" ? "week" : "five hours"} before, by share of the pay-per-use price, this ran: ${run || '<span class="unknown">nothing in the logs</span>'}.${gap}</div></li>`;
  }
  function limitsView() {
    const rows = HITS.slice().reverse().map(hitLine).join("");
    return `<div class="card det"><button class="back" data-back="1">← Back to the list</button><h2>When did a limit stop me?</h2>
      <div class="kv"><span>This week</span>${measured(weekHits.length)}<span>In all the logs</span>${measured(HITS.length)}<span>Near-limit warnings</span>${measured(WARN.length)}</div>
      <ul class="mini hits">${rows}</ul>
      <p class="cant">Claude Code, Cowork and the Claude app share one set of Claude limits, so what ran before a hit counts Claude Code and Cowork together. Codex has its own ChatGPT limits. Claude Code logs when a limit stopped you but not how close you came. Cowork and Codex also logged warnings with the share used. Anthropic's usage page has the exact bars.</p></div>`;
  }

  // ---------- by week ----------
  function weeksView() {
    const weeks = Object.keys(G.weekly).sort();
    const hitsBy = {}; HITS.forEach((h) => (hitsBy[wkOf(localDay(h.ts))] = (hitsBy[wkOf(localDay(h.ts))] || []).concat(h)));
    return `<div class="screen"><h2>By week</h2><p class="sub">Every week in the logs at pay-per-use prices, split by project. A triangle marks a week when a limit stopped you. Click a week to see what ran, and what was running when you hit a limit.</p>
      <div class="card">${weekChart(weeks, 1300, 320, { clickWeek: true, hits: hitsBy, selected: S.week, label: "Pay-per-use price by week, split by project" })}${howCard("weekChart")}</div>
      ${S.week ? weekDetail(S.week, hitsBy[S.week] || []) : '<p class="cant">Pick a week above.</p>'}
      <div class="card" style="margin-top:24px"><h3>Every time a limit stopped you (${HITS.length})</h3><ul class="mini hits">${HITS.slice().reverse().map(hitLine).join("")}</ul>
      <p class="cant">Claude Code, Cowork and the Claude app share one set of Claude limits, and Codex has its own. Cowork and Codex also logged ${WARN.length} near-limit warnings.</p></div>
      <div class="card" style="margin-top:12px"><h3>How can I check this myself?</h3><p style="font-size:14px;margin:0">Open Claude Code, type <b>/usage</b> and press <b>w</b>. It shows your plan's current five-hour and weekly bars, which come from Anthropic. It also lists the skills, subagents, plugins and connectors that used the most in the last 7 days, counted from the same logs on this Mac. It keeps no past weeks, so it can only check this one. Whatever leads there should lead here too. Its 7 days include last weekend, while this week here starts on Monday. Codex shows its own bars in its settings.</p>
      <p class="cant">${esc(COUNT)}</p></div></div>`;
  }
  function weekDetail(w, hits) {
    const v = G.weekly[w] || {}, tot = Object.values(v).reduce((a, b) => a + b, 0), tools = (G.weekly_tool || {})[w] || {};
    const ents = Object.entries(v).sort((a, b) => (a[0] === "Not sure yet") - (b[0] === "Not sure yet") || b[1] - a[1]);
    const rows = ents.slice(0, 9).map(([k, u]) => `<li class="linkish" data-id="work:${esc(k)}"><span>${k === "Not sure yet" ? "Not in a project yet" : esc(k)}</span><span>${about(u)} <span class="estimate">${((x) => (u > 0 && x < 1 ? "under 1" : x))((((G.weekly_share || {})[w] || {})[k]) ?? pctOf(u, tot))}%</span></span></li>`).join("");
    const grouped = ents.filter(([k]) => k !== "Not sure yet").length;
    const end = new Date(new Date(w + "T12:00:00").getTime() + 6 * 864e5).toISOString().slice(0, 10);
    const warns = WARN.filter((e) => localDay(e.ts) >= w && localDay(e.ts) <= end);
    const coworkGap = G.cowork_end && w > wkOf(G.cowork_end);
    return `<div class="mc-grid" style="margin-top:12px"><div class="card"><h3>Week of ${day(w)}, ${money(tot)} at pay-per-use prices</h3><p class="cant" style="margin:0 0 6px">It covers ${grouped} project${grouped === 1 ? "" : "s"}${ents.length > grouped ? ", plus chats not grouped yet" : ""}. Each percentage is a share of this week's pay-per-use price.</p><ul class="mini">${rows}</ul>
      <p class="cant">${["Claude Code", "Cowork", "Codex"].filter((t) => tools[t]).map((t) => `${t} ${money(tools[t])}`).join(", ")}${coworkGap ? ". Cowork has no logs on this Mac after " + day(G.cowork_end) : ""}. These are pay-per-use prices, which aren't your bill.</p>${howCard("weekDetail")}</div>
      <div class="card"><h3>Did a limit stop me that week?</h3>${hits.length ? `<ul class="mini hits">${hits.map(hitLine).join("")}</ul>` : '<p class="empty">No limit stopped you that week.</p>'}
      ${warns.length ? `<p class="cant">${esc([...new Set(warns.map((e) => e.tool))].join(" and "))} also logged ${warns.length} near-limit warning${warns.length === 1 ? "" : "s"}. The highest reached ${Math.max(...warns.map((e) => e.util || 0))}% of a ${warns[0].kind === "seven_day" ? "weekly" : "five-hour"} limit.</p>` : ""}</div></div>`;
  }

  const OLD = (id) => /^(screen:(mission|weeks|progress|office)|week:|work:|note:|flag:|limits$|advisor$|list$)/.test(id || "");
  function select(id, pulse) {
    // Mission control and By week are retired (release 2): their routes open All weeks on Your week
    if (id === "screen:mission" || id === "screen:weeks" || String(id).startsWith("week:")) { S.screen = "note"; S.allw = true; S.nview = null; S.hweek = String(id).startsWith("week:") ? id.slice(5) : null; render(); window.scrollTo(0, 0); return; }
    if (!DEMO && String(id).startsWith("work:") && byId[id]) { S.screen = "machine"; S.allw = true; S.yall = id.slice(5); S.yreveal = true; S.ypeek = null; S.side = "list"; render(); window.scrollTo(0, 0); const r = document.querySelector(".y-allrow.sel"); if (r) r.focus({ preventScroll: true }); return; }
    if (DEMO && OLD(id)) {  // in the demo, anything that led to an older page opens the redesigned one instead
      if (String(id).startsWith("work:")) { const w = id.slice(5), P = (G.machine || {}).periods || {}; const per = [S.nper, G.week_start].find((p) => P[p] && P[p][w]); if (per) { S.nper = per; S.mwork = w; } S.screen = "machine"; }
      else S.screen = "note";
      render(); window.scrollTo(0, 0); return;
    }
    if (id === "list") { if (S.screen === "machine") S.drawer = !S.drawer; S.side = "list"; S.selected = null; return render(); }
    if (id === "limits") { S.side = "limits"; return render(); }
    if (id && id.startsWith("week:")) { S.screen = "weeks"; S.week = id.slice(5); S.side = "list"; S.selected = null; return render(); }
    if (id && id.startsWith("screen:")) { S.hback = false; S.scrollAt = S.scrollAt || {}; S.scrollAt[S.screen] = window.scrollY; S.qopen = null; S.sopen = null; S.ypeek = null; if (id === "screen:note") S.nview = null; S.screen = id.slice(7); S.side = "list"; S.selected = null; render(); window.scrollTo(0, S.scrollAt[S.screen] || 0); return; }
    if (id === "room:control" && S.zoom === "room:control") { S.screen = "mission"; return render(); }
    if (id && id.startsWith("room:") && (S.screen === "office")) return zoomTo(id);
    if (id && id.startsWith("work:")) { S.screen = "work"; S.work = id; S.side = "list"; S.selected = null; render(); window.scrollTo(0, 0); return; }
    if (id && (id.startsWith("agent:") || id.startsWith("room:"))) { S.screen = "armory"; S.atool = "Claude Code"; S.alayer = id === "room:armory" ? "skills" : "helpers"; S.asel = id.startsWith("agent:") ? id.slice(6) : null; S.side = "list"; S.selected = null; return render(); }
    if (id && (id.startsWith("note:") || id.startsWith("flag:") || id === "advisor") && ["note", "machine", "armory", "office"].includes(S.screen)) S.screen = "mission";
    if (id && id.startsWith("skill:") && S.screen !== "armory") S.screen = "armory";
    S.selected = id; S.side = "detail"; S.pulse = pulse ? id : null;
    render();
  }

  // ---------- events ----------
  document.addEventListener("click", (ev) => {
    const m = mach(), at = (sel) => ev.target.closest(sel);
    if (S.screen === "machine" && S.ypeek && !at(".y-peek") && !at('[data-w^="work:peek:"]')) { S.ypeek = null; if (!at("button,a,summary,[data-go],[data-nwork],[data-id]")) return render(); }
    if (S.screen === "armory" && S.asel && !at(".a-peek") && !at("[data-a]")) { S.asel = null; if (!at("button,a,summary,[data-go],[data-nwork],[data-id]")) return render(); }
    if (at("[data-closedrawer]")) { S.drawer = false; return render(); }
    // on a narrow window the panel sits under the list, so picking a line brings it into view (QA, Oct 19)
    const seePanel = (sel) => { if (window.innerWidth > 1100) return; const p = document.querySelector(sel); if (p && p.getBoundingClientRect().top > window.innerHeight - 80) p.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); };
    if (at("[data-wl]") && wlist()) { const el = at("[data-wl]"), r = wlist().click(el); if (r) { render(); if (r === "go") window.scrollTo(0, 0); else if (/^chat:/.test(el.dataset.wl)) seePanel(".wl-ev"); } return; }
    if (at("[data-r]") && rec()) { const el = at("[data-r]"), r = rec().click(el); if (r) { render(); if (r === "go") window.scrollTo(0, 0); else if (/^sel:/.test(el.dataset.r)) seePanel(".r-ev"); } return; }
    if (at("[data-h]") && home()) { const r = home().click(at("[data-h]")); if (r) { render(); if (r === "go") window.scrollTo(0, 0); } return; }
    if (at("[data-w]")) { const el = at("[data-w]"); const fromPic = !!el.closest(".g-canvas, .a-canvas"); const r = (shp() && shp().click(el)) || (workm() && workm().click(el)) || (note() && note().click(el)); if (r) { render(); if (r !== "stay" && !el.dataset.w.startsWith("work:")) window.scrollTo(0, 0); if (fromPic && window.innerWidth <= 1180) { const p = document.querySelector(".g-panel"); if (p && p.getBoundingClientRect().top > window.innerHeight - 120) p.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); } } return; }
    if (at("[data-a]") && anat()) { if (anat().click(at("[data-a]"))) render(); return; }
    if (at("[data-nper]")) { const np = at("[data-nper]").dataset.nper; if (np === "all") { S.allw = true; S.hstops = false; } else { S.allw = false; S.nper = np; } S.hback = false; if (np === "all" && S.screen === "note") S.nview = null; S.qpick = null; S.qscroll = 0; return render(); }
    if (at("[data-keep]") && note()) { note().kept.add(at("[data-keep]").dataset.keep); store.set("kept", [...note().kept]); return render(); }
    if (at("[data-unkeep]") && note()) { note().kept.clear(); store.set("kept", []); S.snoozed.clear(); store.set("snoozed", []); unsnoozeAll(); return render(); }
    if (at("[data-nwork],[data-mw],[data-mw2]")) {
      const e2 = at("[data-nwork],[data-mw],[data-mw2]"), nwk = e2.dataset.nwork || e2.dataset.mw || e2.dataset.mw2, CHS = (G.machine || {}).chats || {};
      // the week shown, if the project has chats in it; otherwise the latest week that does (QA, Oct 19, night)
      const has = (w) => (CHS[w] || []).some((c) => c.work === nwk);
      if (!has(S.nper)) { const w = Object.keys(CHS).sort().reverse().find(has); if (w) S.nper = w; }
      S.qopen = null; S.screen = "list"; S.wlopen = new Set([nwk]); S.wlsel = ((CHS[S.nper] || []).find((c) => c.work === nwk) || {}).id || null; render(); window.scrollTo(0, 0); return;
    }
    if (!m || S.screen !== "machine") return;
    if (at("[data-mw]")) { S.mwork = at("[data-mw]").dataset.mw; m.go(20); return render(); }
    if (at("[data-mapp]")) { S.mapp = at("[data-mapp]").dataset.mapp; S.mallhelpers = false; m.go(10); return render(); }
    if (at("[data-mitem]")) { S.mitem = at("[data-mitem]").dataset.mitem; m.go(1); return render(); }
    if (at("[data-mlevel]")) { m.go(Number(at("[data-mlevel]").dataset.mlevel)); return render(); }
    if (at("[data-mper]")) { S.mper = at("[data-mper]").dataset.mper; S.mwork = null; m.go(30); return render(); }
    if (at("[data-allworks]")) { S.mallworks = !S.mallworks; return render(); }
    if (at("[data-allhelpers]")) { S.mallhelpers = !S.mallhelpers; return render(); }
    if (at("[data-mfull]")) { S.mfull = !S.mfull; return render(); }
  });
  // hovering a piece of work lights its wires
  document.addEventListener("mouseover", (ev) => {
    const c = ev.target.closest(".m-card"); const svg = document.querySelector(".m-board"); if (!svg) return;
    svg.querySelectorAll(".m-wire[data-mw]").forEach((p) => p.classList.toggle("hov", !!c && p.dataset.mw === c.dataset.mw));
  });
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-nper],[data-keep],[data-unkeep],[data-nwork],[data-closedrawer],[data-w],[data-a],[data-h],[data-r],[data-wl]")) return;
    if (S.screen === "machine" && ev.target.closest("[data-mw],[data-mapp],[data-mitem],[data-mlevel],[data-mper],[data-allworks],[data-allhelpers],[data-mfull]")) return;
    const wkEl = ev.target.closest("[data-week]");
    if (wkEl) { S.week = wkEl.dataset.week; return render(); }
    const t = ev.target.closest("[data-zoom],[data-unzoom],[data-snooze],[data-unsnooze],[data-back],[data-mode],[data-open],[data-go],[data-id]");
    if (!t) return;
    if (t.dataset.zoom) return zoomTo(S.zoom === t.dataset.zoom ? null : t.dataset.zoom);
    if (t.dataset.unzoom) return zoomTo(null);
    if (t.dataset.snooze) { ev.stopPropagation(); snooze(t.dataset.snooze); S.snoozed.add(t.dataset.snooze); store.set("snoozed", [...S.snoozed]); S.side = "list"; S.selected = null; return render(); }
    if (t.dataset.unsnooze) { S.snoozed.clear(); store.set("snoozed", []); return render(); }
    if (t.dataset.back) { S.side = "list"; S.selected = null; return render(); }
    if (t.dataset.mode) { S.mode = t.dataset.mode; return render(); }
    if (t.dataset.open) { const o = byId[t.dataset.open]; S.selected = t.dataset.open; S.side = "detail"; S.pulse = o && o.target ? o.target : null; return render(); }
    if (t.dataset.go) return select(t.dataset.go, true);
    if (t.dataset.id) return select(t.dataset.id, false);
  });
  document.addEventListener("click", async (ev) => {
    if (!ev.target.closest("[data-refresh]")) return;
    toast("Refreshing every number from your logs. This takes about half a minute.");
    try { const r = await fetch("/api/refresh", { method: "POST", headers: { "Content-Type": "application/json", "X-Glass-Box": "1" }, body: "{}" }); if (!r.ok) throw new Error("refresh failed"); location.reload(); }
    catch (e) { toast("Couldn't refresh: " + e.message); }
  });
  document.addEventListener("change", async (ev) => {
    const sel = ev.target.closest("select[data-move]"); if (!sel || !sel.value) return;
    let work = sel.value;
    if (work === "__new") { work = (prompt("Name the new project") || "").trim(); if (!work) { sel.value = ""; return; } }
    if (work === "__undo") work = null;
    toast("Saving your move and recounting…");
    try {
      const r = await fetch("/api/move", { method: "POST", headers: { "Content-Type": "application/json", "X-Glass-Box": "1" }, body: JSON.stringify({ session: sel.dataset.move, work }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || "failed");
      location.hash = S.screen === "work" && S.work ? encodeURIComponent(S.work) : location.hash; location.reload();
    } catch (e) { toast("Couldn't save the move: " + e.message); sel.value = ""; }
  });
  window.addEventListener("gb:render", () => render());  // a prepared change that couldn't be made shows why
  function toast(t) { let el = document.getElementById("toast"); if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); } el.textContent = t; el.style.opacity = 1; clearTimeout(el._t); el._t = setTimeout(() => (el.style.opacity = 0), 4000); }
  document.addEventListener("keydown", (ev) => {
    const k = ev.key.toLowerCase();
    if ((k === "enter" || k === " ") && ev.target.matches && ev.target.matches('svg [data-w][tabindex], div[role="button"][data-w][tabindex], svg [data-h][tabindex], [data-r][tabindex]')) { ev.preventDefault(); ev.target.dispatchEvent(new MouseEvent("click", { bubbles: true })); return; }
    // the arrow keys move between plates on the tabs built on the shared stage (task 33)
    if ((k === "arrowup" || k === "arrowdown") && !(ev.target.closest && ev.target.closest("input,textarea,select,[contenteditable]")) && !document.querySelector(".q-sheet")) {
      const m = S.screen === "note" ? note() : S.screen === "machine" ? workm() : S.screen === "shapes" ? shp() : null;
      if (m && m.step && m.step(k === "arrowup" ? -1 : 1)) { ev.preventDefault(); render(); const sel = document.querySelector(".g-svg .a-plate.sel, .y-board .sel, .h-svg .h-week.sel, .y-allrow.sel"); if (sel && sel.focus) sel.focus({ preventScroll: true }); return; }
    }
    // All weeks reads left to right: ← and → step between weeks
    if ((k === "arrowleft" || k === "arrowright") && S.screen === "note" && S.allw && S.nview !== "detail" && note() && !(ev.target.closest && ev.target.closest("input,textarea,select,[contenteditable]"))) {
      if (note().step(k === "arrowleft" ? -1 : 1)) { ev.preventDefault(); render(); const sel = document.querySelector(".h-svg .h-week.sel"); if (sel) sel.focus({ preventScroll: true }); }
      return;
    }
    if (k === "escape" && ["note", "home", "list", "cost", "armory"].includes(S.screen) && note() && note().closeSheet()) { ev.preventDefault(); return render(); }
    if (k === "escape" && (S.screen === "shapes" || S.screen === "armory") && shp() && shp().closeSheet()) { ev.preventDefault(); return render(); }
    if (k === "escape" && S.screen === "machine" && workm() && workm().closePeek && workm().closePeek()) { ev.preventDefault(); return render(); }
    if (ev.target.closest && ev.target.closest("input,textarea,select")) return;
    if ((k === "enter" || k === " ") && ev.target.matches && ev.target.matches("[tabindex][data-go],[tabindex][data-id],[tabindex][data-open],[tabindex][data-week],[tabindex][data-mw],[tabindex][data-port],[data-allports],[tabindex][data-a],[tabindex][data-nwork]")) { ev.preventDefault(); if (ev.target.dataset.a && anat()) { anat().click(ev.target); render(); const f = document.querySelector(`[data-a="${ev.target.dataset.a}"][tabindex]`); if (f) f.focus(); return; } return ev.target.click ? ev.target.click() : ev.target.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
    if ((k === "arrowup" || k === "arrowdown") && S.screen === "armory" && anat()) { ev.preventDefault(); anat().click({ dataset: { a: k === "arrowup" ? "step:1" : "step:-1" } }); return render(); }
    if (k === "h") select("screen:home"); else if (k === "w") select("screen:list"); else if (k === "s") select("screen:armory"); else if (k === "p" && !DEMO) select("screen:progress");
    else if (k === "1") { S.mode = "week"; render(); } else if (k === "2") { S.mode = "all"; render(); }
    else if ((k === "escape" || k === "backspace") && S.screen === "machine" && S.drawer) { S.drawer = false; render(); }
    else if ((k === "escape" || k === "backspace") && S.screen === "machine" && S.mlevel < 30 && mach()) { mach().go(S.mlevel === 1 ? 10 : S.mlevel === 10 ? 20 : 30); render(); }
    else if (k === "escape" && S.screen === "armory" && anat() && anat().close()) render();
    else if (k === "escape") { const open = document.querySelector("details[open]"); if (open) { open.open = false; return; } if (S.zoom) return zoomTo(null); if (S.side !== "list") { S.side = "list"; S.selected = null; render(); } }
    else if ((k === "arrowright" || k === "arrowleft") && S.screen === "office") {
      ev.preventDefault();
      const i = ROOMS.findIndex((r) => r.id === S.zoom), n = ROOMS.length;
      const next = i < 0 ? 0 : (i + (k === "arrowright" ? 1 : -1) + n) % n;
      zoomTo(ROOMS[next].id);
    }
  });
  const tip = $("#tip");
  // hover labels sit beside what they describe, never over it (design pass, Oct 14): under it, or above when there's no room
  let tipFor = null;
  document.addEventListener("mousemove", (ev) => {
    const t = ev.target.closest("[data-tip]");
    if (!t) { tip.style.opacity = 0; tipFor = null; return; }
    if (t === tipFor) return;
    tipFor = t; placeTip(t, ev.clientX);
  });
  function placeTip(t, cx) {
    const r = t.getBoundingClientRect();
    if (r.height > 160) return showTip(t.dataset.tip, (cx != null ? cx : r.left) + 14, r.top + 14);  // a big area: beside the pointer
    // in a picture's header, the note opens above, so it never covers the title or panel under it (release 3 QA)
    if (t.closest(".g-stage>.w-mh, .a-stage>.w-mh")) { tip.textContent = t.dataset.tip; tip.style.opacity = 1; const h = tip.offsetHeight; if (r.top - h - 8 > 8) return showTip(t.dataset.tip, r.left, r.top - h - 8); }
    showTip(t.dataset.tip, cx != null && r.width > 360 ? cx - 20 : r.left, r.bottom + 8, r.top - 8);
  }
  function showTip(text, x, y, above) {
    tip.textContent = text; tip.style.opacity = 1;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(x, innerWidth - w - 12)) + "px";
    tip.style.top = (y + h > innerHeight - 8 ? Math.max(8, (above != null ? above : y - 28) - h) : y) + "px";
  }
  // keyboard: the same notes on focus, and Enter opens what a click opens
  document.addEventListener("focusin", (ev) => { const t = ev.target.closest && ev.target.closest("[data-tip]"); if (!t) return; tipFor = t; placeTip(t); });
  document.addEventListener("focusout", () => (tip.style.opacity = 0));
  const start0 = decodeURIComponent(location.hash.slice(1)), start = FROM[start0] || start0;
  S.screen = "home";  // the home is the way in (release 1 of the redesign, Oct 18)
  // it opens on this week unless nothing has happened yet this week and last week has work (QA, Oct 18: light users always
  // landed on last week under Your week's older rule)
  { const P = (G.machine || {}).periods || {}, has = (w) => Object.values(P[w] || {}).some((t) => t.usd > 0), lw = Object.keys(P).filter((k) => k !== "all" && k < G.week_start).sort().pop();
    if (!S.nper) S.nper = has(G.week_start) || !lw || !has(lw) ? G.week_start : lw; }
  if (["home", "cost", "list", "note", "machine", "armory", "shapes", "progress"].includes(start) && !(DEMO && start === "progress")) S.screen = start;
  if (FROM[start]) S.screen = FROM[start];
  if (DEMO && !["home", "cost", "list", "note", "machine", "armory", "shapes"].includes(S.screen)) S.screen = "home";
  if (start.startsWith("week:") || start.startsWith("all-weeks:")) S.screen = "note";
  // Back, Forward, or an address typed into this tab: show the screen it names
  window.addEventListener("popstate", () => {
    const h0 = decodeURIComponent(location.hash.slice(1)), h = FROM[h0] || h0;
    S.qopen = null; S.sopen = null; S.ypeek = null; S.side = "list"; S.selected = null;
    if (h.startsWith("all-weeks:") || h.startsWith("week:")) { S.screen = "note"; }
    else if (h.startsWith("work:")) { S.screen = "list"; S.wlopen = new Set([h.slice(5)]); }
    else if (h === "" || h === "home") { S.screen = "home"; }
    else if (h === "cost") { S.screen = "cost"; }
    else if (h === "list" || h === "chats") { S.screen = "list"; }
    else if (["note", "machine", "armory", "shapes", "mission", "progress", "weeks"].includes(h) && !(DEMO && !["note", "machine", "armory", "shapes"].includes(h))) { S.screen = h; if (h === "note") S.nview = null; if (h === "note" || h === "machine") { S.allw = false; } }
    else return;
    S.fromHistory = true; render(); window.scrollTo(0, (S.scrollAt || {})[S.screen] || 0);
  });
  // Esc closes the home's "How this was made" panel (QA, Oct 19)
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && S.screen === "home" && S.hhow) { S.hhow = null; render(); const b = document.querySelector('[data-h^="how:"]'); if (b) b.focus(); } });
  render();
  if (start.includes(":") && (byId[start] || start === "advisor")) select(start, true);
  // the first open (Oct 18): while the refresh started by the double-click is reading, the home shows it happening;
  // when it's done, the page loads the new numbers once
  if (LIVE) (async () => {
    let was = null;
    for (;;) {
      let st = null;
      try { st = await (await fetch("/api/scan", { cache: "no-store" })).json(); } catch (e) { return; }
      if (!st || st.none) return;
      if (!st.done) { was = st; S.scan = st; if (S.screen === "home") render(); await new Promise((r) => setTimeout(r, 700)); continue; }
      S.scan = null; S.scanDone = st;
      if (was) { if (G.sessions > 0 && !DEMO) { S.scanReady = true; render(); } else location.reload(); return; }
      if (S.screen === "home") render();
      return;
    }
  })();
})();
