# Agent Crossview

My build experiment started with my own frustration: frequently running into rework, or Claude Code and Codex not following the instructions or skills I thought they were supposed to be running.

Claude can't report on other tools. I wanted one view across vendors like Codex and Claude, for my personal usage and potentially within an enterprise setting.

Made by [Milan Khanal](https://www.linkedin.com/in/milankhanal41/).

Agent Crossview shows what Claude Code, Cowork and Codex did on your computer, in one place.

It reads the records those apps already keep, and nothing it reads leaves your computer.

## What you'll see

- **Your week:** how much of your plan's limit you used, what changed from earlier weeks, and whether your plans cover the work.
- **Your work:** each project, which apps and subagents worked on it, and what that work would cost if you paid per use instead of a monthly plan. A subagent is a separate AI that Claude Code hands part of a job to.
- **Your setup:** how each app is put together, layer by layer. It includes your connectors, the links to other apps like Google Drive or Slack, and which of them can send, change or delete things there.
- **Your AI's instructions:** what Claude reads before every message, from your rule files (CLAUDE.md) to the notes Claude saves about you between chats.
- **All weeks:** every week Crossview has found, side by side.

Where it can't see something for an app, it says so.

## What it reads, keeps and sends

- **Reads:** the records Claude Code, Cowork and Codex keep on your computer: times, models, how much was read and written, and which subagents, skills and connectors ran. It also reads chat titles, the folder each chat ran in, and the switches in your settings files. It doesn't read what you typed or Claude's replies.
- **Keeps:** counts and names, in the `data` folder inside the Crossview folder. Delete that folder to remove everything it kept.
- **Sends:** nothing. The page loads nothing from the internet, and the address it opens only works on your own computer.
- **Changes:** nothing on its own. Some cards offer a change, like switching off a skill you never use. It happens only when you press "Make this change". A copy of the file as it was goes into the `data` folder first, and the same card has an Undo.

The full list is on the "How Crossview counts" page, linked at the bottom of every screen.

## What you need

- A Mac. Other computers are covered further down.
- Python 3.7 or later. It comes with Apple's command line developer tools, and your Mac offers to install them the first time if they're missing.
- A web browser.
- At least one of Claude Code, Cowork or Codex, used on this computer. Without them, you can still look around the demo company.

## Try it on a Mac

1. On this page, click **Code**, then **Download ZIP**. Open the ZIP and move the folder into your home folder (in Finder, choose Go, then Home).
2. Double-click **Agent Crossview.command** in that folder.
   - If your Mac says it can't be opened because it's from an unidentified developer, right-click it, choose **Open**, then **Open** again.
   - If your Mac offers to install the command line developer tools, say yes. They're Apple's own, and Crossview needs the Python that comes with them. It takes a few minutes, once.
3. A Terminal window reads your records, which takes about a minute the first time. Then your browser opens Crossview at http://127.0.0.1:8765.
4. On Your week, open **Your plans** and choose the plans you pay for. Crossview uses them to compare what you pay with the work you did.

To stop it, close the Terminal window. To remove it, delete the folder. Crossview doesn't install anything outside it.

If double-clicking doesn't work, open Terminal, type `cd ` with a space after it, drag the folder onto the window, press Return, and run these two lines:

```bash
python3 tools/refresh.py
```

```bash
python3 tools/serve.py --open
```

Press **Refresh** in Crossview, or double-click the file again, to read your newest chats.

## No chats on this computer?

Crossview only sees what the apps keep on this computer. Chats on the Claude or ChatGPT websites, and Cowork tasks that run in the cloud, may leave nothing here. In that case the first screen says so.

To see what it shows with real use, choose **Show the demo company** under More, or add `?demo` to the address: http://127.0.0.1:8765/?demo. The demo company, Quillmark, is made up, and its numbers come from made-up files in `demo/data`.

## Other computers

Crossview is built and tested on a Mac. On Windows or Linux:

- The double-click file is Mac only. The two Terminal lines above are the way in.
- Claude Code and Codex keep their records in the same folders on every computer, so those parts may work. This hasn't been tested yet.
- Cowork's records and the Claude app's limit readings are read from the Mac's own app folder, so they show as missing elsewhere.

## What's still rough

- The weekly limit chart fills in from the Claude app's own readings on a Mac. You can also switch on a short line at the bottom of Claude Code that shows your limits; Your week offers it, and Undo on the same card takes it out.
- Newer versions of Codex compress older chats, and Crossview can't read those yet unless a small tool called zstd is installed. Developers can add it with `brew install zstd`.
- Prices are the published pay-per-use prices on the date shown in `tools/prices.py`. Your plan's own price is whatever you choose in Your plans.

If something looks wrong, please open an issue on this page and say what you expected to see.

---

## For people who want to change it

There's no build step and nothing to install from the internet: the app is plain HTML, CSS and JavaScript, and the scripts use only Python's standard library.

- `app/`: the app. `index.html` loads one script per tab (`week.js`, `work.js`, `anatomy.js`, `shapes.js`); `stage.js` is the layout they share; `system.html` shows the design system.
- `tools/`: the scripts that read the records. `refresh.py` runs them in order; `serve.py` serves the app and saves your answers; `changes.py` makes and undoes the prepared changes; `statusline.py` is the optional status line for Claude Code; `prices.py` holds the published prices and when they were checked.
- `demo/data/`: the demo company's made-up files. `tools/demo_company.py` writes them and runs the same scripts on them, so the demo always matches what the app shows for real records.
- `docs/design-system-v0.md` and `docs/voice.md`: the colors, type and parts, and how the screens are worded.

`data/`, `app/data.js` and `app/progress.js` hold your own records and are never committed.

**Checks.** `python3 tools/checks/run.py` clicks through every screen in headless Google Chrome, on your records and on the demo, and checks that nothing moves when you click, that layouts fit narrower windows, that counts agree across screens, and that nothing from your own records shows in the demo. It expects Chrome in the Applications folder.

## License

MIT. Use it, change it and share it; keep the license file and the name with it. See `LICENSE`.
