# Glass Box design system, v0 (Oct 13 2026)

The colors, type, spacing and parts the three main screens (This week, Your work, Your setup) are built from. It starts from the look Milan picked on Oct 13, the light tactile machine, and is meant to harden near the pilot MVP after the blind panel pushes on it. The live version, with every part and its states, is `app/system.html` (also under More, "Design system"). The values live in one place: the `:root` block at the top of `app/style.css`.

## Every color has one job

| Color | Job | Never |
|---|---|---|
| Greys (`--amt-1` to `--amt-5`) | Amounts and structure: bars, tiles, the money flow, wires. More is darker. The darkest (`--on`) marks what ran or was used in the week shown. | "Important" |
| Orange (`--lit`, with `--lit-line`, `--lit-soft`, `--lit-ink` for borders, backgrounds and text on them) | Needs you: a decision, a limit at 80% or more, a connector that can send, delete or act as you outside your Mac (one rule on every screen, QA run 8, Oct 15), a paid service whose amount nobody has entered. | "Ran", selection, links, hover, decoration |
| Blue (`--cat`, with `--cat-line`, `--cat-soft`, `--cat-ink`) | Where something came from: made by you (solid), your Claude account or an add-on (outline), one project only (light), built in (grey). In the rings, blue names the ring for your own; its length is how many. | A state (lit, picked, needs you) |
| Ink (`--ink`) | Selection (an ink outline, or the ink dot on the tab you're on) and keyboard focus (an ink ring). Text is ink, `--ink-2`, `--muted` or `--faint`. | A fill for data |

Changed Oct 13, after panel round 1 (both design seats, Milan's yes): "ran this week" moved from orange to the darkest grey, so orange is left for what needs you.

Why: Milan's round-two note 5 ("mostly orange in different shades isn't very helpful"). Before this batch the app used about twelve shades of orange for lit, selected, hover, amounts, categories and warnings at once. Checked Oct 13 2026:
- Apple's Human Interface Guidelines on color say to avoid using the same color to mean different things, and to use color consistently where it shows status or what can be clicked ([developer.apple.com, Color](https://developer.apple.com/design/human-interface-guidelines/color)).
- Atlassian's guide to chart colors says a numeric amount fits one hue that varies mostly in lightness, lighter for less and darker for more ([atlassian.com, How to choose colors for data visualizations](https://www.atlassian.com/data/charts/how-to-choose-colors-data-visualization)). Here that hue is grey, so amounts never compete with orange.
- Apple's guidance also says not to rely on color alone; every state here also has a shape or a word (a dashed edge for never, a dot for lit, an ink outline for picked, a label on every decision).

Surfaces: `--paper` (the page), `--mod` (a module), `--mod-2` (a well inside one), `--mod-3` (tracks and pressed areas), `--well` (behind switches). Lines: `--rim`, `--rim-2`, `--rule`.

## Type
One sans for words, one mono for counts, receipts and labels. Eight sizes: `--t-xs` 11 (eyebrow labels, captions), `--t-sm` 12 (counts, secondary lines), `--t-md` 13 (so-what lines), `--t-base` 14 (body and card names), `--t-lg` 16 (module titles, doors), `--t-xl` 20 (panel titles), `--t-2xl` 24 (page titles), `--t-3xl` 32 (the one big figure on an answer card, added Oct 13 with the four answers). Weights 400, 600 and 700 only. A heading is always larger than the lines it heads, never the same size or smaller: section headings inside a module ("What changed this week", "Your plans") are `--t-lg` 16 at 600, above rows whose names are `--t-base` 14 (added Oct 15, his note). A module that holds sections takes its title a size up, `--t-xl` 20 at 600, so it reads as the thing that holds them (Oct 15, QA run 7).

## Space, corners, depth, motion
- Space on a 4px grid: `--sp-1` 4 to `--sp-8` 32.
- Corners: `--r-xs` 4 (tiles, code), `--r-sm` 6 (chips, receipt boxes), `--r-md` 10 (buttons, switches), `--r-lg` 14 (cards inside a module), `--r-xl` 22 (modules).
- Depth: `--sh-mod` (modules), `--sh-raise` (cards on the machine), `--sh-key` (buttons, like a key), `--sh-float` (menus and the details card).
- Motion: `--ease`, `--quick` (.15s) and `--slow` (.6s). Everything that moves stops when the computer asks for reduced motion.

## The parts, and their states
- Lights: on (dark, ran in the week shown), pale (didn't), dashed (never used, or nothing there). The light in a module's title is orange only when the module holds something that needs you.
- Buttons: the main action is dark (the how-to on a decision); others are plain or quiet. States: hover (darker border), pressed (moves 1px), off (faded), focus (ink ring). Links are underlined in grey and go ink on hover.
- Switches: the week switch and the main tabs; the pressed one is raised white.
- Tags (neutral, or blue for where it came from), the layer chip, and the orange badge for a numbered decision.
- Cards on the machine: an app (lit or dimmed), a helper (ran, never ran with a dashed edge, or "more"), a selected project (ink outline), a connector (an orange jack if it can send or delete), a paid service nobody has entered (orange edge).
- Pictures of numbers: rings and their key (each one filters the list; the number in the middle belongs to one ring and wears its color: the outer ring until you pick another), tiles grouped by where they came from (grey for how much, an orange dot if lit, ink outline when picked, faded when filtered out), the can-do grid for connectors (filled: it has done it; ring: allowed to, hasn't yet; orange: can send, delete or act as you outside your Mac), the week line (none, close to a limit, stopped), limit dials (grey, orange from 80%), the receipt.
- Answer cards (Your week, Oct 13): the question as a mono eyebrow with its light (orange only when the question needs you that week), the answer in one or two sentences at `--t-xl`, one picture of the numbers (two figures, a bar, chips or tiles), a why line, and an action row: what's prepared, the main button (dark), "Not now" (hides the suggestion for a week; the answer stays). After a change: "Changed <when>: <what>" with Undo.
- The sheet: a prepared change opens over the page (a dimmed veil, a centered panel) so nothing on the page moves; Esc, × or a click outside closes it, and focus goes into it and back. Each item can be ticked; a ticked item shows its exact lines as a small diff. "Make this change" works only when the app is opened with its file; "Copy it for Claude Code" always works.
- The stack (Your AI's instructions, formerly What shapes Claude, Oct 14): plates in the order Claude reads them, widths by words. Yours: white with a grey edge; written by Claude for you: dashed; from the apps or your account: grey. Orange numbered pins mark something worth a look and match the cards below. The diagram for a folder switch: two boxes, a dashed arrow for the switch, an orange arrow for where new notes go.
- Before-and-after lines for an edit to your rules: "Now" (grey) and "After" (ink edge), in plain text rather than code-style plus and minus.
- Things that open: a decision's how-to and a bill's "Add it" open over the page; the details card opens beside the panel, level with the tile or row you clicked and pointing at it (under it on a narrow screen), and closes with ×, Esc or a click anywhere else. Nothing else on the page moves.

## Rules every screen keeps
1. One job per color, as above.
2. Nothing moves when you click. The checks (`python3 tools/checks/run.py`) measure every frame before and after each click, on your data and on the demo company.
3. Every number says how it was made (point at it).
4. Prices are pay-per-use estimates, always beside what you paid.
5. Glass Box changes nothing on its own. A prepared change shows the exact lines first, happens only when you press "Make this change", keeps a copy of the file, and has an Undo on the same card (Oct 13, the four answers).
6. Plain words on screen, in the voice in `docs/voice.md`.
7. Contrast, repetition, alignment, proximity (Robin Williams' four basics, Milan's call Oct 14). Contrast: what matters most is clearly bigger, darker or bolder, and nothing is almost-the-same. Repetition: one part looks the same on every screen. Alignment: everything sits on a shared edge or grid line. Proximity: things that belong together sit together, with more space between groups than inside them. Applied in the design pass, without breaking what works.

## Added Oct 14 (task 29)
- Hover labels: a light card (white, ink text, a thin edge, the float shadow), placed under what it describes, or above when there's no room; never over it. Full sentences in sentence case.
- Drawing text: every drawing gets its inverse scale after render (`--ik`), and its text is sized `max(its size, 11px x --ik)`, so nothing in a drawing is under 11 pixels on screen. When Your setup's drawing is small, the second line of each label hides and the panel says it. `<small>` is never under 11 pixels.
- Grey text: `--muted` is #565E6A (at least 4.5 to 1 on every surface, the well included); text never uses `--faint`.
- Your work: column headings over the diagram, and a bracket over the subagents column, because the logs record connectors per chat, not per subagent. Clicking a box opens its details card beside it; "Open in Your setup" goes on from there.
- Your AI's instructions: question headings in sentence case and normal type; numbered pins are buttons that bring their card into view.

## The shared stage (task 33, Oct 14)
Every main tab is one sentence on top (`.g-lead`, the answer, orange only for the part that needs you), one picture of plates on the left in the dotted canvas (`GBStage.stack`, Your setup's geometry: plates in order top to bottom, labels alternating left and right, pins on the plate's top face, the picked plate in ink), and a panel on the right for the picked plate (`GBStage.page`: Above and Below, "Plate k of n", the arrow keys), with everything else one click deeper. Your work's picture is its machine rather than a stack, in the same frame. The stage lives in app/stage.js; each tab keeps its own styles in tab-*.css.

## Not done yet (v0)
- Mission control, By week and Progress still use their older styles, mapped onto these colors; they get the system once the three main screens settle.
- No dark version.
- The money flow on This week and the wires use the system, but the office-era coin stacks on the older pages don't.
- Sizes are tuned for a laptop screen; phone layouts are untested (headless Chrome won't go below 500 pixels wide).
