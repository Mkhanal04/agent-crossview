/* Crossview: Your work. Milan's pick on Oct 13 (your-work-concept.png), redrawn on Oct 14 in the shared one-picture
   pattern (task 33): one sentence on top, the projects as chips, the picked project's machine as the picture (the apps
   that worked on it, the subagents they called in, the connectors it reached), the days it ran under it, and a panel on
   the right: the project's receipt and its one suggestion, or the part you picked. It suggests; it never changes anything.
   Plain JavaScript; app.js passes in its helpers, stage.js draws the frame. */
window.GBWork = function (X) {
  "use strict";
  const { G, S, esc, money, day, localDay, HITS, modelName, store, shares, riskOf, riskWords, since, snoozed, LIVE } = X;
  const M = G.machine || { periods: {}, ports: [] }, B = G.money || { plans: [] };
  const plus = (d, n) => { const t = new Date(d + "T12:00:00"); t.setDate(t.getDate() + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
  const per = () => S.nper || G.week_start;
  const words = () => (per() === G.week_start ? "this week" : "last week");
  const mon = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short" });
  const span = (w) => { const e = plus(w, 6); return mon(w) === mon(e) ? `${day(w)} to ${Number(e.slice(8))}` : `${day(w)} to ${day(e)}`; };
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const pctText = (a, b) => (b && a > 0 && pct(a, b) < 1 ? "under 1%" : pct(a, b) + "%");
  const plural = (n, w) => `${Number(n).toLocaleString()} ${w}${n === 1 ? "" : "s"}`;
  const andList = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}` : a[0] || "");
  const canDo = (p) => `It can ${andList(p.kinds)} things${p.outside ? " in another app" : ""}.`;
  const tip = (t) => `data-tip="${esc(t)}"`;
  const workName = (w) => (w === "Not sure yet" ? "Not in a project yet" : w);
  const helperName = (t) => t;  // real names, the ones in the logs and the files (panel round 1)
  const builtIn = (t) => { const a = G.agents.find((x) => x.name === t); return a ? a.origin === "Came with Claude Code" : true; };
  const kept = () => new Set(store.get("kept", []));
  const ACT = "work:peek:";  // the boxes and the panel's Above and Below share this prefix, so a click on them keeps the pick
  let wires = [], parts = [], mine = null, hubDim = false;  // mine: the project board() last showed, so a project named from another tab can be told apart

  const projects = () => Object.entries(M.periods[per()] || {}).filter(([, t]) => t.usd > 0).sort((a, b) => b[1].usd - a[1].usd);
  const portOf = (id) => (M.ports || []).find((p) => p.id === id) || { id, name: id, kinds: [] };
  const appOrder = (apps) => ["Claude Code", "Cowork", "Codex"].filter((a) => a in apps).concat(Object.keys(apps).filter((a) => !["Claude Code", "Cowork", "Codex"].includes(a)));

  // ---------- the one sentence on top: which project took most of the period, and in which app ----------
  // each app's pay-per-use share of one project: its own chats plus the subagents it called in
  const appUsd = (t) => {
    const u = {};
    Object.entries(t.agents || {}).forEach(([k, a]) => { const app = k.split(":")[1]; if (app) u[app] = (u[app] || 0) + (a.usd || 0); });
    if (!Object.values(u).some((x) => x > 0)) Object.entries(t.app_sessions || {}).forEach(([a, n]) => (u[a] = n));
    return Object.entries(u).filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]);
  };
  function lead(ps) {
    if (!ps.length) return `No chats were logged ${words()}.`;
    // the project on the stage: the top one, or the one picked from the chips (QA run 3 #6)
    const sh = shares(ps.map(([, t]) => t.usd)), i = Math.max(0, ps.findIndex(([x]) => x === S.mwork)), [w, t] = ps[i];
    const who = w === "Not sure yet" ? "chats not grouped into a project yet" : `one project: ${esc(w)}`;
    if (i > 0) return `${sh[i] < 1 ? "Under 1%" : sh[i] + "%"} of ${words()} went into ${w === "Not sure yet" ? "chats not grouped into a project yet" : esc(w)}.`;
    return `${sh[0] >= 50 ? "Most" : "The biggest share"} of ${words()} went into ${who}.`;
    const as = appUsd(t), all = as.reduce((a, [, x]) => a + x, 0), top = as.length ? as[0][1] / all : 0;
    const names = as.map(([a]) => esc(a)), list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
    const where = !as.length ? "" : as.length === 1 ? `, all of it in ${names[0]}` : top >= 0.85 ? `, nearly all of it in ${names[0]}` : top >= 0.6 ? `, mainly in ${names[0]}` : `, split across ${list}`;
    return `${who} ${how}${where}.`;
  }

  // ---------- the projects, as chips above the picture: one line, the rest in a small list under "+N more" ----------
  function chips(ps) {
    const sh = shares(ps.map(([, t]) => t.usd)), shareOf = {};
    ps.forEach(([w], i) => (shareOf[w] = sh[i]));
    let show = ps.slice(0, 5);
    if (ps.length > 5 && !show.find(([w]) => w === S.mwork)) show = ps.slice(0, 4).concat(ps.filter(([w]) => w === S.mwork));  // a project picked from the list keeps its chip
    const rest = ps.filter((p) => !show.includes(p));
    const sp = (w) => (shareOf[w] < 1 ? "under 1%" : shareOf[w] + "%");
    const chip = ([w, t]) => `<button class="y-proj${w === S.mwork ? " on" : ""}" data-w="work:select:${esc(w)}" aria-pressed="${w === S.mwork}" ${tip(`${workName(w)} took ${sp(w)} of your use${w === ps[0][0] ? ` ${words()}` : ""}, over ${plural(t.sessions, "chat")}.${w === ps[0][0] ? " A project is one of your project folders. The share is counted from the pay-per-use price, which is what the same work would cost at published per-use prices. Your plan isn't charged by project." : ""}`)}><i aria-hidden="true"></i><b>${esc(workName(w))}</b><span>${sp(w)}</span></button>`;
    const more = rest.length ? `<div class="y-morewrap"><button class="y-more" data-w="work:more" aria-expanded="${!!S.wall}" ${tip(S.wall ? "Hides the list." : "Lists the rest of your projects.")}>+${rest.length} more</button>${S.wall ? `<div class="y-morelist" role="group" aria-label="More projects">${rest.map(chip).join("")}</div>` : ""}</div>` : "";
    return `<div class="y-chiprow"><nav class="y-list" aria-label="Your projects ${words()}">${show.map(chip).join("")}</nav>${more}</div>`;
  }

  // ---------- the project's machine: the picture ----------
  // which apps' logs show subagents and connectors (machine_data.py); anything else is unknown, never "none"
  const SEEN = M.seen || { subagents: ["Claude Code", "Cowork"], connectors: ["Claude Code"] };
  const unseen = (kind, list) => list.filter((a) => !SEEN[kind].includes(a));
  function machine(w, t) {
    // the picked app: the picture keeps only what that app used and fades the rest, without moving (his note, Oct 14)
    const fx = (S.ypeek || "").startsWith("app:") ? S.ypeek.slice(4) : null, dim = (used) => (fx && !used ? " dim" : "");
    const apps = {}, helpers = {};
    Object.entries(t.agents || {}).forEach(([k, a]) => {
      const parts = k.split(":");
      if (parts[0] === "main") apps[parts[1]] = (apps[parts[1]] || 0) + a.usd;
      else { const app = parts[1], type = parts.slice(2).join(":"), h = (helpers[type] = helpers[type] || { type, runs: 0, usd: 0, apps: {} }); h.runs += a.runs; h.usd += a.usd; h.apps[app] = (h.apps[app] || 0) + a.usd; apps[app] = apps[app] || 0; }
    });
    const hl = Object.values(helpers).sort((a, b) => b.usd - a.usd), shown = hl.slice(0, hl.length > 6 ? 5 : 6), rest = hl.slice(shown.length);
    // each subagent's share of the project, rounded with the chat's share so they add up to 100 (and to the receipt)
    const hs = shares([t.usd - hl.reduce((x, h) => x + h.usd, 0)].concat(hl.map((h) => h.usd))), hShare = {};
    hl.forEach((h, i) => (hShare[h.type] = hs[i + 1]));
    const merged = {};
    Object.entries(t.connectors || {}).forEach(([id, n]) => { const p = portOf(id); if (p.built_in) return;  // the Claude app's own tools aren't a connector (camera fix batch)
      const m = (merged[p.name] = merged[p.name] || { name: p.name, n: 0, kinds: [], as_you: false, outside: false }); m.n += n; m.as_you = m.as_you || !!p.as_you; m.reach = m.reach || p.reach; m.outside = m.outside || !!p.outside; (p.kinds || []).forEach((k) => { if (!m.kinds.includes(k)) m.kinds.push(k); }); });
    const ports = Object.values(merged).sort((a, b) => b.n - a.n), pShown = ports.slice(0, 5), pRest = ports.slice(5);
    const maxU = Math.max(0.01, ...hl.map((h) => h.usd)), maxN = Math.max(1, ...ports.map((p) => p.n));
    wires = [];
    shown.forEach((h) => Object.entries(h.apps).forEach(([app, u]) => wires.push({ from: `[data-yapp="${app}"]`, to: `[data-yhelper="${h.type}"]`, w: 1.6 + 7 * Math.sqrt(u / maxU), cls: dim(app === fx) })));
    if (rest.length) Object.keys(apps).forEach((app) => { if (rest.some((h) => h.apps[app])) wires.push({ from: `[data-yapp="${app}"]`, to: "[data-yhelper-more]", w: 1.4, cls: " thin" + dim(app === fx) }); });
    // connector uses are counted per chat, not per subagent, so they hang off one hub beside the whole team
    hubDim = !!fx && !SEEN.connectors.includes(fx);
    pShown.forEach((p) => wires.push({ from: "hub", to: `[data-yport="${p.name}"]`, w: 1.2 + 3.5 * Math.sqrt(p.n / maxN), cls: " port" + (hubDim ? " dim" : "") }));
    const wiredApps = new Set(wires.filter((x) => x.from !== "hub").map((x) => x.from));
    const order = appOrder(apps);
    const appUse = (a) => apps[a] + hl.filter((h) => h.apps[a]).reduce((s2, h) => s2 + (h.apps[a] || 0), 0);
    const on = (k) => S.ypeek === k;
    // a count that's part of a bigger count elsewhere says which part (camera fix batch, Oct 15): this project's chats, of the week's
    const allChats = (a) => Object.values(M.periods[per()] || {}).reduce((x, p) => x + ((p.app_sessions || {})[a] || 0), 0);
    const appBox = (a) => { const n = (t.app_sessions || {})[a] || 0, all = allChats(a); return `<button class="w-app on${wiredApps.has(`[data-yapp="${a}"]`) ? "" : " bare"}${on("app:" + a) ? " sel" : dim(false)}" data-yapp="${esc(a)}" data-w="${ACT}app:${esc(a)}" aria-pressed="${on("app:" + a)}" ${tip(`${a} had ${plural(n, "chat")} on this project${all > n ? `, of your ${all} with ${a} ${words()}` : ""}, ${pctText(appUse(a), t.usd)} of this project's use. A chat is one conversation. Click for details.`)}><i class="w-light"></i><span><b>${esc(a)}</b><small>${all > n ? `${n} of your ${plural(all, "chat")}` : plural(n, "chat")}</small></span><i class="w-port" aria-hidden="true"></i></button>`; };
    const helperBox = (h) => `<button class="w-helper on${on("helper:" + h.type) ? " sel" : dim(!!h.apps[fx])}" data-yhelper="${esc(h.type)}" data-w="${ACT}helper:${esc(h.type)}" aria-pressed="${on("helper:" + h.type)}" ${tip(`${helperName(h.type)} ran ${h.runs === 1 ? "once" : plural(h.runs, "time")}, ${hShare[h.type] < 1 ? "under 1%" : hShare[h.type] + "%"} of this project's use.${h === shown[0] ? " A subagent is a separate AI with its own instructions, which Claude Code can hand part of a job to." : ""}`)}><i class="w-port" aria-hidden="true"></i><i class="w-light"></i><span><b>${esc(helperName(h.type))}</b><small>${plural(h.runs, "run")}</small></span></button>`;
    const restBox = rest.length ? `<button class="w-helper more${on("more") ? " sel" : dim(rest.some((h) => h.apps[fx]))}" data-yhelper-more="1" data-w="${ACT}more" aria-pressed="${on("more")}" ${tip(`${plural(rest.length, "more subagent")} worked on this project. Click to list them here.`)}><i class="w-port" aria-hidden="true"></i><span><b>+ ${plural(rest.length, "more subagent")}</b><small>${plural(rest.reduce((a, h) => a + h.runs, 0), "run")}</small></span></button>` : "";
    const can = (p) => (riskWords.hot(p) ? riskWords(p).replace(/ for you$/, "") : "");
    const portBox = (p) => `<button class="y-port${can(p) ? " risky" : ""}${on("port:" + p.name) ? " sel" : hubDim ? " dim" : ""}" data-yport="${esc(p.name)}" data-w="${ACT}port:${esc(p.name)}" aria-pressed="${on("port:" + p.name)}" ${tip(`${p.name} was used ${plural(p.n, "time")}. ${riskWords.line(p)}${p === pShown[0] ? " A connector is a link to another app, like Google Drive or Figma. Claude's settings call them MCP servers." : ""}`)}><i class="w-port" aria-hidden="true"></i><i class="y-jack" aria-hidden="true"></i><span><b>${esc(p.name)}</b><small>${plural(p.n, "use")}</small></span></button>`;
    const cols = `<div class="y-cols" aria-hidden="true"><span>Apps</span><span>Subagents they called in</span><span ${tip("The logs record which connectors each chat used. They don't say which subagent used them, so connectors are drawn from the chat and its subagents together.")}>Connectors used</span></div>`;
    const rows = Math.max(order.length, shown.length + (rest.length ? 1 : 0), pShown.length + (pRest.length ? 1 : 0));
    const body = `<div class="y-machine">${cols}<div class="w-board y-board${rows >= 5 ? " dense" : ""}" style="--rows:${rows}"><svg class="w-wires y-wires" aria-hidden="true"></svg>
        <div class="w-apps">${order.map(appBox).join("") || '<p class="w-empty">No app was logged.</p>'}</div>
        <div class="w-helpers">${shown.length ? shown.map(helperBox).join("") + restBox : (unseen("subagents", order).length === order.length && order.length ? `<p class="w-empty">${esc(andList(order))} ${order.length === 1 ? "doesn't" : "don't"} record subagents in ${order.length === 1 ? "its" : "their"} logs, so Crossview can't show any here.</p>` : `<p class="w-empty">No subagents worked on this project ${words()}.</p>`)}</div>
        <div class="y-ports">${pShown.length ? pShown.map(portBox).join("") + (pRest.length ? `<p class="y-small">+ ${plural(pRest.length, "more connector")}</p>` : "") : (unseen("connectors", order).length === order.length && order.length ? `<p class="w-empty">Crossview doesn't read connectors from ${esc(andList(order))} yet, so none are shown.</p>` : `<p class="w-empty">No connectors were used on this project ${words()}.</p>`)}</div></div></div>`;
    // the parts in picture order, for Above and Below: apps, then subagents (and the rest of them), then connectors
    const ids = order.map((a) => "app:" + a).concat(shown.map((h) => "helper:" + h.type), rest.length ? ["more"] : [], pShown.map((p) => "port:" + p.name));
    return { body, ids, helpers: hl, rest, hShare, ports, pShown, apps, appUse, t, risky: pShown.some((p) => !!can(p)) };
  }

  // ---------- the panel, when a part is picked (his note Oct 14: fewer trips between pages) ----------
  const ORIGIN = { "Came with Claude Code": "A subagent that came with Claude Code", "From your Claude account": "A subagent from your Claude account", "Made by you": "A subagent you made" };
  const originLine = (o) => ORIGIN[o] || (/^Only in /.test(o || "") ? `A subagent set up only in ${o.slice(8)}` : "A subagent");
  function part(m, w) {
    const [kind, ...rest] = (S.ypeek || "").split(":"), id = rest.join(":");
    const stat = (big, small, side) => `<div class="y-stat"><b>${esc(big)}</b><small>${esc(small)}</small>${side ? `<span>${esc(side)}</span>` : ""}</div>`;
    const share = (raw, p) => (p < 1 && raw > 0 ? "under 1%" : p + "%");
    let title = id, line = "", fig = "", body = "", go = "";
    if (kind === "helper") {
      const h = m.helpers.find((x) => x.type === id), a = G.agents.find((x) => x.name === id) || {};
      if (!h) return null;
      line = originLine(a.origin);
      fig = stat(plural(h.runs, "run"), `on ${workName(w)} ${words()}`, `${share(h.usd, m.hShare[h.type])} of this project's use`);
      body = `<p>${esc(a.plain || "A subagent is a separate AI with its own instructions, which Claude Code can hand part of a job to.")}</p>
        ${a.runs || a.model ? `<p class="y-pk-n">${a.runs ? `It ran ${plural(a.runs, "time")} in all, across every project.` : ""}${a.model ? ` It runs on ${esc(modelName(a.model))}.` : ""}</p>` : ""}
        <p class="y-pk-n">Any subagent can load a skill when its task comes up. The logs don't record which skills it loaded.</p>`;
      go = `setup:helper:${id}`;
    } else if (kind === "more") {
      if (!m.rest.length) return null;
      const runs = m.rest.reduce((x, h) => x + h.runs, 0);
      title = plural(m.rest.length, "more subagent");
      line = "The rest of the subagents on this project";
      fig = stat(plural(runs, "run"), `between them, on ${workName(w)} ${words()}`);
      body = `<ul class="y-mlist">${m.rest.map((h) => `<li><span>${esc(helperName(h.type))}</span><b>${plural(h.runs, "run")}</b></li>`).join("")}</ul>`;
      go = "setup:helpers";
    } else if (kind === "port") {
      const p = m.ports.find((x) => x.name === id);
      if (!p) return null;
      line = "A connector";
      fig = stat(plural(p.n, "use"), `on ${workName(w)} ${words()}`);
      body = `<p>The chat or one of its subagents used it ${p.n === 1 ? "once" : plural(p.n, "time")} on this project ${esc(words())}.</p>
        <p class="y-pk-n">${esc(riskWords.line(p))}</p>
        <p class="y-pk-n">A connector is a link to another app, like Google Drive or Figma. Claude's settings call them MCP servers.</p>`;
      go = "setup:layer:connectors";
    } else if (kind === "app") {
      if (!(id in m.apps)) return null;
      const n = (m.t.app_sessions || {})[id] || 0;
      line = "One of the AI apps you use";
      fig = stat(plural(n, "chat"), `on ${workName(w)} ${words()}`, `${pctText(m.appUse(id), m.t.usd)} of this project's use`);
      const blind = unseen("subagents", [id]).length ? (unseen("connectors", [id]).length ? "subagents or connectors" : "subagents") : unseen("connectors", [id]).length ? "connectors" : "";
      body = `<p>The picture now shows only what ${esc(id)} used here. Pick it again, or press Esc, to see everything.</p>${blind === "connectors" ? `<p class="y-pk-n">Crossview can't see which connectors ${esc(id)} used yet.</p>` : blind ? `<p class="y-pk-n">Crossview can't see which ${blind}${unseen("connectors", [id]).length ? " or connectors" : ""} ${esc(id)} used. ${esc(id)}'s logs don't show whether it hands work to subagents.</p>` : ""}<p class="y-pk-n">A chat is one conversation in ${esc(id)}. Its setup, layer by layer, is in Your setup.</p>`;
      go = `setup:app:${id}`;
    } else return null;
    // the main button sits under the figure, so it's never below the fold of the panel
    return { title, line: esc(line), body: `<div class="y-peek" role="region" aria-label="${esc(title)}">${fig}<div class="y-pk-btns"><button class="w-btn main y-pk-go" data-w="${esc(go)}">Open in Your setup</button><button class="w-btn quiet y-pk-back" data-w="${ACT}close" ${tip("Shows what this project used, and its suggestion. Esc does the same.")}>Back to the project summary</button></div>${body}</div>` };
  }

  // ---------- the days it ran: the strip under the picture ----------
  function days(w, t) {
    const p = per(), on = new Set(t.day_list || []);
    const hitOn = (d) => HITS.filter((h) => localDay(h.ts) === d && (h.running || []).some((r) => r.work === w));
    let anyHit = false;
    const dots = [0, 1, 2, 3, 4, 5, 6].map((i) => plus(p, i)).map((d) => {
      const hs = hitOn(d), lab = new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }), future = d > G.today;
      const times = hs.map((h) => new Date(h.ts + ":00Z").toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(" AM", " am").replace(" PM", " pm"));
      const when = times.length > 1 ? `${times.slice(0, -1).join(", ")} and ${times[times.length - 1]}` : times[0] || "";
      if (hs.length) anyHit = true;
      return `<span class="y-day${on.has(d) ? " on" : ""}${hs.length ? " hit" : ""}${future ? " future" : ""}" ${tip(`${future ? `${lab} is later this week` : on.has(d) ? `You worked on it on ${lab}` : `You didn't work on it on ${lab}`}${hs.length ? `. A limit stopped you at ${when} while it was running` : ""}.`)}><i></i><small>${lab}</small>${hs.length ? `<em class="sr">${hs.length > 1 ? `Limit reached ${hs.length} times` : `Limit reached at ${esc(when)}`}</em>` : ""}</span>`;
    }).join("");
    return `<div class="y-days"><span class="y-days-h">Days you worked on it</span><div class="y-track">${dots}</div>${anyHit ? `<span class="y-hitkey"><i aria-hidden="true"></i>A limit stopped you</span>` : ""}<b class="y-days-n">${plural(on.size, "day")}</b></div>`;
  }

  // ---------- the panel, by default: the receipt ----------
  // a rounded share that is really above zero says so, instead of 0%
  const pc = (p, raw) => (p < 1 && raw > 0 ? "under 1%" : p + "%");
  function receipt(w, t, hl) {
    const helperUsd = hl.reduce((a, h) => a + h.usd, 0), models = Object.entries(t.models || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const who = shares([t.usd - helperUsd, helperUsd]), ms = shares(models.map(([, u]) => u)), mine2 = shares(projects().map(([, x]) => x.usd))[projects().findIndex(([x]) => x === w)];
    // the share is the figure; the way to every chat sits right under it, so the panel never hides it
    return `<section class="y-paid" aria-label="Receipt for ${esc(workName(w))}"><div class="w-receipt">
        <div class="w-r-line y-r-first"><small>Share of your use ${esc(words())}</small><b class="y-big">${mine2 < 1 ? "under 1%" : mine2 + "%"}</b>
          ${window.GB_DEMO ? "" : `<button class="w-btn y-full" data-go="work:${esc(w)}" data-tip="Shows every chat in this project, across all weeks, where you can move a chat to another project. Use Back to return here.">See every chat in this project</button>`}</div>
        <p class="w-r-line"><small>Pay-per-use price</small><b><span class="y-price" tabindex="0" ${tip(`What the same work would cost at published per-use prices. It's an estimate, not your bill. Prices were checked ${G.prices_checked}.`)}>${money(t.usd)}</span></b></p>
        <div class="w-r-line"><small>Who did the work</small>
          <div class="y-row"><span>The chat you typed in</span><b>${pc(who[0], t.usd - helperUsd)}</b></div>
          <div class="y-row"><span>Subagents</span><b>${pc(who[1], helperUsd)}</b></div></div>
        <div class="w-r-line"><small>Models</small>${models.map(([m, u], i) => `<div class="y-row"><span>${esc(modelName(m))}</span><b>${pc(ms[i], u)}</b></div>`).join("")}</div>
        <div class="y-row"><span>Days worked</span><b>${(t.day_list || []).length || t.days}</b></div>
      </div></section>`;
  }

  // ---------- one suggestion for this project: what it reached first, then how it ran ----------
  function suggestion(w, t, hl, ports) {
    const helperUsd = hl.reduce((a, h) => a + h.usd, 0), share = pct(helperUsd, t.usd), top = Object.entries(t.models || {}).sort((a, b) => b[1] - a[1])[0];
    const hits = HITS.filter((h) => { const d = localDay(h.ts); return d >= per() && d <= plus(per(), 6) && (h.running || []).some((r) => r.work === w); });
    const cands = [], risky = ports.filter((p) => riskOf(p) >= 2).sort((a, b) => riskOf(b) - riskOf(a)), outside = ports.filter((p) => riskWords.outside(p));
    if (risky.length) cands.push({ key: `work:${w}:reach:${risky[0].name}`, risky: true, line: `This project used ${risky[0].name}, which ${riskWords(risky[0])}${outside.length > 1 ? `. It also used ${plural(outside.length - 1, "more connector")} that can act outside your Mac` : ""}.`, label: "How to limit it", could: "You can make it ask before each use, or turn it off, in Claude Code's settings or under Connectors in the Claude app." });
    if (share >= 40 && top && /opus|fable/i.test(top[0])) cands.push({ key: `work:${w}:helper-model`, line: `Subagents did ${share}% of the work on this project. Most of it ran on ${modelName(top[0])}, one of the most capable models.`, label: "What you could do", could: "On a flat plan, giving a routine subagent a smaller model makes your limits last longer. Name the model in the subagent's file, then try both on the same task before you keep the change." });
    if (hits.length) cands.push({ key: `work:${w}:limit`, risky: true, line: `A usage limit stopped you ${hits.length === 1 ? "once" : hits.length + " times"} ${words()} while this project was running.`, label: "What you could do", could: "Long chats use the most, because every step reads the whole conversation again. Start a new chat when you switch tasks." });
    const k = kept(), c = cands.find((x) => !k.has(x.key) && !snoozed(x.key));
    // nothing to decide: one quiet line, no empty box
    if (!c) return `<section class="y-sug quiet"><p><i class="w-led idle" aria-hidden="true"></i>No suggestion for this project ${words()}.</p></section>`;
    // "What you could do" opens in place under its button, so it never covers the sentence
    return `<section class="y-sug"><div class="y-sug-h"><i class="w-led" aria-hidden="true"></i><small>A suggestion for this project</small></div><p>${esc(c.line)}</p>
      <div class="w-btns"><details class="w-how y-how"><summary>${esc(c.label)}</summary><div class="w-pop"><p>${esc(c.could)} Crossview won't change anything for you.</p></div></details><button class="w-btn quiet" data-snooze="${esc(c.key)}" ${tip("Hides this suggestion for a week.")}>Not now</button>${c.risky ? "" : `<button class="w-btn quiet" data-keep="${esc(c.key)}" ${tip("Crossview won't suggest this for this project again.")}>Don't suggest this again</button>`}</div></section>`;
  }

  // the stage is shared; a few of its states are this tab's own
  function frame(html, picked, k, n) {
    html = html.replace(/class="([^"]*\bg-stage\b)(?![^"]*\by-main\b)([^"]*)"/, 'class="$1$2 y-main"');
    // above the first part is the receipt, so Above stays on once a part is picked, and is off before
    html = html.replace(/(data-w="work:peek:step:-1")\s*(disabled)?/, picked ? "$1 " : "$1 disabled ");
    if (!picked) html = html.replace(new RegExp(`Part 0 of ${n}(?=<)`), plural(n, "part"));
    if (!/class="a-ph"/.test(html)) {  // one part or none: keep the panel's header row, so nothing below it moves
      const at = html.indexOf('<aside class="a-panel'), sc = window.GBStage.screws, i = at < 0 ? -1 : html.indexOf(sc, at);
      const b = (dir, off, arrow, label) => `<button class="w-btn w-sbtn" data-w="${ACT}step:${dir}" ${off ? "disabled" : ""}><span aria-hidden="true">${arrow}</span> ${label}</button>`;
      const head = `<header class="a-ph"><div class="a-step" role="group" aria-label="Move between parts">${b(-1, !picked, "▲", "Above")}<span class="a-chip">${picked ? `Part ${k + 1} of ${n}` : plural(n, "part")}</span>${b(1, picked || !n, "▼", "Below")}</div></header>`;
      if (i >= 0) html = html.slice(0, i + sc.length) + head + html.slice(i + sc.length);
    }
    return html;
  }

  // which project to show: the top one of the week, unless a chip (or a link from another tab) picked one this week
  function project(ps) {
    const p = per();
    if (S.mwork && S.mwork !== mine && ps.find(([w]) => w === S.mwork)) S.ypick = { per: p, w: S.mwork };
    if (S.ypick && S.ypick.per !== p) S.ypick = null;  // a new week starts on its top project
    const ok = S.ypick && ps.find(([w]) => w === S.ypick.w);
    if (S.ywk !== p) { S.wall = false; S.ywk = p; }  // a new week starts with the chips closed
    S.mwork = mine = ok ? S.ypick.w : ps.length ? ps[0][0] : null;
  }


  // ---------- All weeks (release 2): every project across all time, and one project's chats, in one place. It replaces
  // Mission control's projects table and the old project page (docs/more-pages-2026-10-16.md) ----------
  const allProjects = () => (G.work || []).filter((o) => o.sessions > 0).slice().sort((a, b) => (b.usd || 0) - (a.usd || 0));
  const usdA = (v) => (v < 10 ? "under $10" : `about $${(v >= 1000 ? Math.round(v / 100) * 100 : Math.round(v / 10) * 10).toLocaleString()}`);
  const monthOf = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "long" });
  // how a chat landed in its project, said only when it was moved (release 2 QA: the usual way needs no line on every row)
  const BY = { "your correction": "moved here by you", "Claude's correction": "moved here by Claude, worth checking", none: "not grouped yet" };
  function allPage() {
    const St = window.GBStage, ps = allProjects();
    if (!ps.length) return `<div class="w-page"><p class="g-lead">No chats were logged yet.</p></div>`;
    if (!ps.some((o) => o.name === S.yall)) S.yall = ps[0].name;
    const firstDay = ps.reduce((a, o) => (o.first && o.first < a ? o.first : a), ps[0].first || G.today), all = ps.reduce((a, o) => a + (o.usd || 0), 0), mx = Math.max(1, ps[0].usd || 0);
    const rows = ps.map((o) => `<button class="y-allrow${o.name === S.yall ? " sel" : ""}" data-w="work:all:${esc(o.name)}" aria-pressed="${o.name === S.yall}"><span><b>${esc(workName(o.name))}</b><small>${plural(o.sessions, "chat")} · ${esc(Object.keys(o.tools || {}).join(", "))} · ${esc(day(o.first))} to ${esc(day(o.last))}</small></span><span class="y-allbar"><i style="width:${Math.max(1, (100 * (o.usd || 0)) / mx).toFixed(1)}%"></i></span><b class="y-allusd">${o.usd ? usdA(o.usd) : "no price"}</b></button>`).join("");
    const o = ps.find((x) => x.name === S.yall), k = ps.indexOf(o), d = o.detail || {};
    const names = (G.work || []).map((w) => w.name).filter((n) => n !== o.name && !["Day job", "Personal"].includes(n)).sort();
    const mover = (x) => (o.hidden_titles ? "" : LIVE ? `<select class="move" data-move="${esc(x.id)}" aria-label="Move this chat to another project"><option value="">Move to…</option>${names.map((n) => `<option>${esc(n)}</option>`).join("")}<option value="__new">A new project…</option>${x.by === "your correction" ? '<option value="__undo">Undo my move</option>' : ""}</select>` : "");
    const moved = (G.moves || []).filter((m) => m.to === o.name);
    const chats = (d.sessions || []).slice().sort((a, b) => String(b.start).localeCompare(String(a.start)));
    const row = (a, b) => `<div class="g-row"><span>${a}</span><b>${b}</b></div>`, grp = (h, b) => `<div class="g-grp"><h4>${h}</h4>${b}</div>`;
    // a chat's date is the day on this Mac's clock, the same day Your week counts it in
    const chatDay = (x) => (/T\d\d:\d\d$/.test(String(x.start)) ? day(localDay(x.start)) : day(String(x.start).slice(0, 10)));
    const how = (x) => (BY[x.by] && x.by !== "none" ? ` · ${esc(BY[x.by])}` : "");
    const body = grp("In all", `${o.usd ? row("At pay-per-use prices", cap(usdA(o.usd))) + row("Share of all your work", pctText(o.usd, all)) : row("At pay-per-use prices", "No published price")}${Object.entries(o.tools || {}).map(([t, n]) => row(esc(t), plural(n, "chat"))).join("")}${o.helpers ? row(`<span class="g-tipped" tabindex="0" ${tip("A subagent is a helper the main chat hands part of a task to. Each time one starts counts once.")}>Subagents ran</span>`, plural(o.helpers, "time")) : ""}`)
      + (moved.length ? grp("Chats moved here", `<ul class="y-chats-list">${moved.map((m) => `<li><span><b>${esc(m.title || "A chat")}</b><small>${esc(m.tool)} · ${esc(BY[m.by] || "moved here")}</small></span></li>`).join("")}</ul>`) : "")
      + grp(`Every chat${chats.length > 40 ? ", newest 40" : ""}`, `<ul class="y-chats-list">${chats.slice(0, 40).map((x) => `<li><span><b>${o.hidden_titles ? "Title kept private" : esc(x.title || "Untitled")}</b><small>${esc(chatDay(x))} · ${esc(x.tool)}${x.usd ? ` · ${usdA(x.usd)}` : o.usd ? "" : " · no published price"}${how(x)}</small></span>${mover(x)}</li>`).join("")}</ul>`)
      + (LIVE && !o.hidden_titles ? `<p class="g-note">If a chat is in the wrong project, move it. Crossview saves every move on this Mac, and you can undo it from the same list.</p>` : "");
    const above = `<div class="y-chiprow y-allnote"><span>The biggest projects are at the top. Pick one to see its chats${LIVE && !window.GB_DEMO ? " and move any that landed in the wrong one" : ""}.</span></div>`;
    return St.page({ lead: esc(`Your biggest project since ${monthOf(firstDay)} is ${workName(ps[0].name)}.`), above, title: `Every project since ${monthOf(firstDay)}`, hint: false,
      canvas: `<div class="y-all">${rows}</div>`, key: `<span>Bars show each project's pay-per-use price since ${esc(day(firstDay))}.</span>`,
      strip: `<span>${plural(ps.length, "project")} · ${plural(ps.reduce((a, x) => a + x.sessions, 0), "chat")} since ${esc(day(firstDay))}</span>`,
      cls: "y-page y-allpage", panel: { k, n: ps.length, act: "work:all:", unit: "Project", title: workName(o.name), line: esc(o.first === o.last ? `${plural(o.sessions, "chat")} on ${day(o.first)}.` : `${plural(o.sessions, "chat")} from ${day(o.first)} to ${day(o.last)}.`), body } });
  }
  function board() {
    if (S.allw) return allPage();
    const St = window.GBStage, ps = projects(), here = !!document.querySelector(".y-page");
    project(ps);
    const t = S.mwork ? (M.periods[per()] || {})[S.mwork] : null;
    if (!t) {
      parts = []; wires = []; S.ypeek = null;
      return frame(St.page({ cls: "y-page", lead: lead(ps), above: chips(ps), title: `Your work, ${words()}`, canvas: `<p class="w-empty">Pick the other week at the top to see its projects.</p>`, panel: { k: 0, n: 0, act: ACT, unit: "Part", title: "What it used", body: "" } }), false, 0, 0);
    }
    const w = S.mwork, m = machine(w, t);
    parts = m.ids;
    // coming back from another tab (Open in Your setup, then Back): the part picked before is picked again
    if (!here && !S.ypeek && S.ykeep && S.ykeep.per === per() && S.ykeep.w === w && parts.includes(S.ykeep.k)) S.ypeek = S.ykeep.k;
    const pk = S.ypeek ? part(m, w) : null;
    if (S.ypeek && !pk) S.ypeek = null;
    S.ykeep = S.ypeek ? { per: per(), w, k: S.ypeek } : here ? null : S.ykeep;
    const n = parts.length, k = pk ? parts.indexOf(S.ypeek) : -1;
    const total = Object.values(t.app_sessions || {}).reduce((a, x) => a + x, 0) || t.sessions;
    // the project's subagent runs, beside its chats: Your week's line counts every project (camera fix batch, Oct 15)
    const runsHere = (m.helpers || []).reduce((x, h) => x + (h.runs || 0), 0);
    // the key lists only what is drawn (every box here worked on the project, so its light needs no entry)
    const hasWires = wires.length > 0, bracket = m.pShown.length && m.helpers.length;
    const key = `${hasWires ? '<span><i class="w-wire-key"></i>Thicker lines mean more use</span>' : ""}${bracket ? `<span ${tip("The logs say which connectors each chat used, but not whether the chat or one of its subagents used them.")}><i class="y-key-port"></i>The bracket joins the chat and its subagents</span>` : ""}${m.risky ? `<span><i class="y-jack hot" aria-hidden="true"></i>${esc(riskWords.key)}</span>` : ""}`;
    const panel = pk ? { k, n, act: ACT, unit: "Part", title: pk.title, line: pk.line, body: pk.body }
      : { k: -1, n, act: ACT, unit: "Part", title: "What it used", line: `${esc(workName(w))}, ${esc(span(per()))}`, body: receipt(w, t, m.helpers) + suggestion(w, t, m.helpers, m.ports) };
    return frame(St.page({ cls: "y-page", lead: lead(ps), above: chips(ps), title: `${workName(w)}, ${words()}`, headRight: `<span class="y-chats" ${tip(`These are the chats${runsHere ? " and subagent runs" : ""} on ${workName(w)} ${words()}.${runsHere ? " Your week counts subagent runs across all your projects." : ""}`)}>${plural(total, "chat")}${runsHere ? `, <span class="y-cols-n">${plural(runsHere, "subagent run")}</span>` : ""}</span>`, canvas: m.body, key, strip: days(w, t), panel }), !!pk, k, n);
  }

  // the all-projects list keeps its scroll when a pick redraws the page, and a pick made by a step or a link is scrolled into view
  function allAfter() {
    const cv = document.querySelector(".y-allpage .g-canvas"); if (!cv) return;
    cv.scrollTop = S.yallscroll || 0;
    const pick = cv.querySelector(".y-allrow.sel");
    if (pick && S.yreveal) { const r = pick.getBoundingClientRect(), c = cv.getBoundingClientRect(); if (r.bottom > c.bottom) cv.scrollTop += r.bottom - c.bottom + 8; else if (r.top < c.top) cv.scrollTop -= c.top - r.top + 8; }
    S.yreveal = false; S.yallscroll = cv.scrollTop;
    cv.onscroll = () => { S.yallscroll = cv.scrollTop; };
  }
  function after() {
    if (S.allw) return allAfter();
    // a picked part's hover label would sit over the panel that now shows the same thing
    const tp = document.getElementById("tip");
    if (tp && S.ypeek) tp.style.opacity = 0;
    // the chip row scrolls sideways when it's too wide: fade its edge, and keep the picked chip in view
    const nav = document.querySelector(".y-page .y-list"), onc = nav && nav.querySelector(".y-proj.on");
    if (nav) {
      nav.classList.toggle("over", nav.scrollWidth > nav.clientWidth + 1);
      if (onc && onc.offsetLeft + onc.offsetWidth > nav.scrollLeft + nav.clientWidth - 36) nav.scrollLeft = onc.offsetLeft + onc.offsetWidth - nav.clientWidth + 40;
    }
    const how = document.querySelector(".y-sug .y-how");
    if (how && !how.dataset.on) { how.dataset.on = 1; how.addEventListener("toggle", () => { if (how.open) how.scrollIntoView({ block: "nearest" }); }); }
    const board = document.querySelector(".y-board"), svg = board && board.querySelector(".y-wires");
    if (!svg) return;
    const R = board.getBoundingClientRect(), count = {}, idx = {};
    svg.setAttribute("viewBox", `0 0 ${R.width.toFixed(0)} ${R.height.toFixed(0)}`);
    wires.forEach((w) => (count[w.from] = (count[w.from] || 0) + 1));
    const col = board.querySelector(".w-helpers").getBoundingClientRect(), hub = { x: col.right - R.left + 16, y: col.top - R.top + col.height / 2 };
    const hb = [...board.querySelectorAll(".w-helpers > *")].map((e) => e.getBoundingClientRect()), top = hb.length ? hb[0].top - R.top + 8 : hub.y, bot = hb.length ? hb[hb.length - 1].bottom - R.top - 8 : hub.y;
    svg.innerHTML = wires.map((w) => {
      const a = w.from === "hub" ? null : board.querySelector(w.from), h = board.querySelector(w.to);
      if ((!a && w.from !== "hub") || !h) return "";
      const ra = a ? a.getBoundingClientRect() : null, rh = h.getBoundingClientRect(), i = (idx[w.from] = (idx[w.from] || 0) + 1);
      const x0 = a ? ra.right - R.left - 4 : hub.x, y0 = a ? ra.top - R.top + ra.height / 2 + (i - (count[w.from] + 1) / 2) * Math.min(5, ra.height / (count[w.from] + 2)) : hub.y;
      const x1 = rh.left - R.left + 4, y1 = rh.top - R.top + rh.height / 2, m = (x0 + x1) / 2;
      const d = `M${x0.toFixed(1)},${y0.toFixed(1)} C${m.toFixed(1)},${y0.toFixed(1)} ${m.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
      return `<path d="${d}" class="w-wire${w.cls}" stroke-width="${w.w.toFixed(1)}"/>${w.cls ? "" : `<path d="${d}" class="w-flow" stroke-width="${Math.max(1, w.w * 0.45).toFixed(1)}"/>`}`;
    }).join("") + (wires.some((w) => w.from === "hub") ? `${hb.length && board.querySelector(".w-helpers > button") ? `<path d="M${(hub.x - 8).toFixed(1)},${top.toFixed(1)} H${hub.x.toFixed(1)} V${bot.toFixed(1)} H${(hub.x - 8).toFixed(1)}" class="y-bracket${hubDim ? " dim" : ""}"/>` : ""}<circle cx="${hub.x.toFixed(1)}" cy="${hub.y.toFixed(1)}" r="4" class="y-hubdot${hubDim ? " dim" : ""}"/>` : "");
  }
  let raf = 0;
  window.addEventListener("resize", () => { if (S.screen === "machine") { cancelAnimationFrame(raf); raf = requestAnimationFrame(after); } });

  // Above (-1) and Below (1) through the parts; above the first part is the receipt. True when the pick changed.
  function step(dir) {
    if (S.allw) { const ps = allProjects(), i = ps.findIndex((o) => o.name === S.yall) + dir; if (!ps[i]) return false; S.yall = ps[i].name; S.yreveal = true; return true; }
    if (!parts.length) return false;
    const was = S.ypeek, k = parts.indexOf(S.ypeek);
    if (k < 0) S.ypeek = dir > 0 ? parts[0] : null;
    else if (k === 0 && dir < 0) S.ypeek = null;
    else S.ypeek = window.GBStage.stepIn(parts, S.ypeek, dir);
    return S.ypeek !== was;
  }

  function click(el) {
    const v = el.dataset.w || "";
    if (v.startsWith("work:all:step:")) { const ps = allProjects(), i = ps.findIndex((o) => o.name === S.yall) + Number(v.slice(14)); if (ps[i]) { S.yall = ps[i].name; S.yreveal = true; } return "stay"; }
    if (v.startsWith("work:all:")) { S.yall = v.slice(9); return "stay"; }
    if (v.startsWith("work:select:")) { S.mwork = v.slice(12); S.ypick = { per: per(), w: S.mwork }; S.ypeek = null; S.wall = false; return true; }
    if (v === "work:more") { S.wall = !S.wall; return true; }
    if (v === ACT + "close") { S.ypeek = null; return true; }
    if (v.startsWith(ACT + "step:")) { step(Number(v.slice(ACT.length + 5))); return true; }
    if (v.startsWith(ACT)) { const k = v.slice(ACT.length); S.ypeek = S.ypeek === k ? null : k; return true; }
    return false;
  }
  // a click outside the "+N more" list closes it
  document.addEventListener("click", (ev) => {
    if (S.screen !== "machine" || !S.wall || (ev.target.closest && ev.target.closest(".y-morewrap"))) return;
    S.wall = false;
    const l = document.querySelector(".y-morelist"), b = document.querySelector(".y-more");
    if (l) l.remove();
    if (b) b.setAttribute("aria-expanded", "false");
  }, true);
  return { board, after, click, step, closePeek: () => (S.ypeek ? ((S.ypeek = null), true) : S.wall ? ((S.wall = false), true) : false) };
};
