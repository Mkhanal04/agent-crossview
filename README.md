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

- A Mac or a Windows computer. Linux is covered further down.
- Python 3.9 or later. On a Mac it comes with Apple's command line developer tools, and your Mac offers to install them the first time if they're missing. Windows doesn't come with it; step 1 below says how to get it.
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

## Try it on Windows

On a work laptop, check your company's rules on installing tools first.

1. If you don't have Python, install it, free, from [python.org/downloads](https://www.python.org/downloads/) or from the Microsoft Store (search for Python). It takes a few minutes, once.
2. On this page, click **Code**, then **Download ZIP**. Right-click the ZIP, choose **Extract All**, and put the folder somewhere you'll find it again, such as Documents.
3. Double-click **Agent Crossview (Windows).cmd** in that folder.
   - If Windows shows a blue box saying it protected your PC, click **More info**, then **Run anyway**. The file is a short list of steps you can open in Notepad to read first.
4. A window reads your records, which takes about a minute the first time. Then your browser opens Crossview at http://127.0.0.1:8765.
5. On Your week, open **Your plans** and choose the plans you have.

To stop it, close the window. To remove it, delete the folder.

If double-clicking doesn't work, open the folder, type `cmd` in the address bar at the top and press Enter, then run these two lines. If Windows says `py` isn't recognized, type `python` in its place.

```bat
py tools\refresh.py
```

```bat
py tools\serve.py --open
```

Where Crossview looks on Windows (the refresh lists what it found, and where it looked for anything it didn't):

- Claude Code: the `.claude` folder in your user folder.
- Codex: the `.codex` folder in your user folder, or wherever `CODEX_HOME` points. Codex run inside WSL keeps its records inside WSL, where Crossview can't see them.
- Cowork: the Claude app's folder, `AppData\Roaming\Claude`, or for the Microsoft Store version of the Claude app, its folder under `AppData\Local\Packages`. These two haven't been checked on a real Windows computer yet.

## On a work plan

If your company pays for Claude or ChatGPT (Claude Team or Enterprise, ChatGPT Business or Enterprise), pick that plan in **Your plans** (or **Not sure which plan**) and choose **My company pays for it**. You don't need to know the seat's price. Paying per use with an API key is there too.

- Your week then shows what your work would cost at pay-per-use prices, without comparing it with a price you don't pay. It never suggests a bigger plan; where a change is your company's to make, it says to ask your admin.
- Company plans usually don't record limit readings on your computer, so the weekly limit chart says so. In Claude Code, type `/usage` to see yours.
- Settings your company manages for Claude Code show in Your setup as their own layer, **Set by your company**. Crossview only reads them, and it turns off any change of its own that one of them would override.

## No chats on this computer?

Crossview only sees what the apps keep on this computer. Chats on the Claude or ChatGPT websites, and Cowork tasks that run in the cloud, may leave nothing here. In that case the first screen says so.

To see what it shows with real use, choose **Show the demo company** under More, or add `?demo` to the address: http://127.0.0.1:8765/?demo. The demo company, Quillmark, is made up, and its numbers come from made-up files in `demo/data`.

## Linux

Crossview hasn't been tested on Linux. The two Terminal lines in the Mac section are the way in. Claude Code and Codex keep their records in the same folders there, so those parts should work; the Claude app isn't made for Linux, so Cowork shows as not found.

## What's still rough

- The weekly limit chart fills in from the Claude app's own readings. You can also switch on a short line at the bottom of Claude Code that shows your limits; Your week offers it, and Undo on the same card takes it out.
- Newer versions of Codex can compress older chats. Python 3.14 or later reads them on its own. With an older Python, a small tool called zstd is needed; on a Mac, developers can add it with `brew install zstd`. The refresh says when there are chats it couldn't read.
- Prices are the published pay-per-use prices on the date shown in `tools/prices.py`. Your plan's own price is whatever you choose in Your plans.

If something looks wrong, please open an issue on this page and say what you expected to see.

---

## For people who want to change it

There's no build step and nothing to install from the internet: the app is plain HTML, CSS and JavaScript, and the scripts use only Python's standard library.

- `app/`: the app. `index.html` loads one script per tab (`week.js`, `work.js`, `anatomy.js`, `shapes.js`); `stage.js` is the layout they share; `system.html` shows the design system.
- `tools/`: the scripts that read the records. `paths.py` is the one place that knows where each app keeps its records on a Mac and on Windows; `refresh.py` runs the scripts in order; `serve.py` serves the app and saves your answers; `changes.py` makes and undoes the prepared changes; `statusline.py` is the optional status line for Claude Code; `prices.py` holds the published prices and when they were checked.
- `demo/data/`: the demo company's made-up files. `tools/demo_company.py` writes them and runs the same scripts on them, so the demo always matches what the app shows for real records.
- `docs/design-system-v0.md` and `docs/voice.md`: the colors, type and parts, and how the screens are worded.

`data/`, `app/data.js` and `app/progress.js` hold your own records and are never committed.

**Checks.** `python3 tools/checks/run.py` clicks through every screen in headless Google Chrome, on your records and on the demo, and checks that nothing moves when you click, that layouts fit narrower windows, that counts agree across screens, and that nothing from your own records shows in the demo. It needs Google Chrome, on a Mac or Windows.

`python3 tools/checks/home_check.py` runs Crossview end to end on two made-up computers, one on a personal plan and one on a work plan, with records shaped like the real ones (`tools/checks/made_up_home.py`). GitHub runs it on Windows for every update (`.github/workflows/checks.yml`).

## License

MIT. Use it, change it and share it; keep the license file and the name with it. See `LICENSE`.
