---
name: figma-bridge
description: Edit, build and inspect Figma mockups directly through a local plugin bridge (Claude Bridge) — no Figma MCP, no rate limits, full Plugin API. Use this whenever the user wants changes made inside a Figma file — fix a layout, apply a client's comments, add states or variants, rebuild layers with auto layout, change texts or prices, swap components, round corners, export frames to check them — or mentions the bridge, "Claude Bridge", "через мост", "поправь в фигме", "правки по комментам", "собери состояния", "макет", "в фигму". Also use it to set up the bridge for the first time. Not for code generation from designs or for FigJam/Slides.
---

# Figma bridge

Claude edits a live Figma file through a small development plugin. A local server passes JavaScript from Claude Code to the
plugin; the plugin runs it with the full Plugin API (`figma.*`) inside the file and returns a result, including PNG exports
that Claude can look at. The designer keeps working in the same file at the same time.

`SKILL_DIR` below is the base directory of this skill (shown when the skill loads).

## 1. Make sure the bridge is up

```bash
python3 "$SKILL_DIR/scripts/setup.py" check
```

- **Server not running** (e.g. after a reboot) → `python3 "$SKILL_DIR/scripts/setup.py" start` — installs the bridge
  folder `~/Documents/Claude Bridge` on first run and starts the server in the background (needs Node.js). Do this yourself,
  don't send the user to the terminal.
- **First time on this computer** → run `python3 "$SKILL_DIR/scripts/setup.py" open` (shows the folder in Finder) and ask the
  user to import the plugin once: Figma desktop app → Plugins → Development → Import plugin from manifest… →
  Documents → Claude Bridge → `manifest.json`.
- **Plugin not connected** → ask the user to run Plugins → Development → **Claude Bridge** inside the file to edit and keep its small window open.
- The check lists connected files by name. Use that exact name with `--file`. If the plugin is also open in some other file (another client, another project), ask the user to close it there — don't rely on luck.

## 2. Run scripts

```bash
python3 "$SKILL_DIR/scripts/fig.py" script.js --file "Exact file name" --lib [--arg id=12:345]
```

- A script is the body of an async function with `figma` in scope. Return `{ j: J(data), png_name: await png(node, 2) }`.
  `J()` keeps non-ASCII text intact; `png_*` keys become image files (paths are printed) — **open them and look**.
- `--file` routes the job only to the plugin window in that file and makes the script refuse to run anywhere else.
- `--lib` prepends `scripts/lib.js`: `dump`, `png`, `pathOf`, `paintVar`, `bindNum`, `setPadding`, `setRadius`, `txt`, `setText`,
  `replaceInText`, `variantOf`, `setProp`, `getProp`, `component`, `snapshot`/`restore`, `offGrid`, `saveVersion`.
  Token names differ per file: set `LIB.spacePrefix` / `LIB.radiusPrefix` at the top of a script if needed.
- `--arg key=value` → `ARGS.key` inside the script. The full result is saved to `~/Documents/Claude Bridge/out/<name>.json`.
- Write scripts to files with a file-writing tool (shell heredocs can mangle `\u` escapes). Keep them in a scratch folder.
- Ready-made examples in `scripts/examples/`: `probe.js` (file, page, selection; run without `--file` to see where the plugin is),
  `dump.js` (structure + picture of nodes), `find-text.js`, `set-text.js`.

Node ids come from links the user pastes: `…?node-id=242-32380` → `242:32380`.

## 3. How to work

1. **Read before you write.** Dump the area you are about to touch (depth 3–5) and look at its PNG. The designer edits in
   parallel, so re-read at the start of every task instead of trusting earlier output.
2. **Smallest change inside their structure.** Same blocks, same order, same components; reuse the file's components, text
   styles and variables. A request to fix something is not a request to redesign it.
3. **One focused script per change, safe to re-run.** Scripts are not transactions: if one throws halfway, the first half
   stays in the file. Check "already done?" before creating, find nodes by id or exact name, and after a failure read the
   state before running a fix.
4. **Verify by looking.** Export the changed area and inspect it; check that neighbours did not move, children fit their
   parent, sizes are whole numbers. Fix what you see before reporting. For "must look identical" rebuilds, diff the images.
5. **Before a mass change, save a version** (`await saveVersion('Before …')`) and tell the user its name.
6. **Report briefly** in the user's language: what changed and where (link with `node-id`), what you intentionally left alone,
   which values are examples, any side effects (e.g. "the footer moved down 22 px"). Then wait for the next request.
7. **Keep a task log** in the project folder with a "▶ NOW" block (working frame ids, what's done, what waits for an answer,
   how to reconnect). A new chat reads it first.

Client comments: Figma comments are not visible to plugins — the user pastes screenshots. Restate a terse comment's meaning
in one line, apply it to every copy of the same block (desktop/tablet/mobile, both variants of a screen) and say where.
States go on a sheet next to the screen, one captioned copy per state. Details, and when to ask instead of doing:
`references/workflow.md`.

## 4. Lines not to cross

- Only the file the user named. Never run without `--file` once you edit; never "retry until it lands" in an unknown file.
- Don't revert or "clean up" edits made by the client or the designer unless they ask. Don't touch pages they reserved.
- Don't delete frames, publish libraries, or change the design system's components without a clear request — instance
  overrides and other pages depend on them.
- Facts over invention: prices, terms and timings come from the client or their production site; otherwise label examples.

## 5. When something goes wrong

Read `references/gotchas.md` — it covers the traps that cost hours: jobs landing in another file, a stale plugin window after
sleep ("Unable to establish connection"), FILL collapsing in auto layout, constraints moving children on `resize`,
non-breaking spaces in texts, opacity lost when binding variables, instance overrides vs main components, vectors that
distort when stretched, Cmd+Z by the designer undoing your change.

Code for recurring tasks (rounded 45° cuts, horizontal/vertical scroll areas, sheets of states, image diff, finding
overrides across pages): `references/recipes.md`. Every project also has rules a model cannot guess (facts-only copy,
spacing scale, brand shapes) — keep them in the project folder; see `references/project-rules-example.md`.
