# Figma bridge — gotchas

Collected while building and fixing real mockups through the bridge. Each item: what goes wrong → what to do.

## Contents
1. Bridge and plugin windows
2. Scripts are not transactions
3. Auto layout
4. Resizing frames without auto layout
5. Text
6. Variables, styles, paints
7. Components and instances
8. Vectors, booleans, masks
9. Pages, sections, performance
10. Prototype behaviour
11. The designer works in the same file

---

## 1. Bridge and plugin windows

- **Plugin open in two files.** Every open plugin window polls the server; a job without a target goes to whoever polls first. A background Figma tab polls rarely, the active tab every 0.7 s. → Always run with `--file "<exact file name>"`: the server hands the job only to the window in that file, and the script refuses to run elsewhere.
- **Wrong file is a real risk**, not a nuisance: the other file may belong to a different client. Never "retry until it works" without a file guard.
- **Stale window after the computer slept.** Synchronous calls (`figma.root.name`, `currentPage.children`) still answer; async ones fail with "Unable to establish connection to Figma after 10 seconds". → Ask the user to close and reopen the plugin in that file.
- **Server restarted** → a new token is written; the runner reads it on every call, the plugin reconnects by itself (it polls every 0.7 s).
- **Errors from the plugin used to come without text.** The runner wraps the script in try/catch and returns `e.message` + stack; line numbers in the stack are offset by the prepended prelude/lib.
- **Non-ASCII in long payloads.** The runner sends pure ASCII (`\uXXXX`) and the server reads UTF-8 strings, so Cyrillic survives. If you write scripts through a shell heredoc, `а` may be turned into the letter by the shell — write script files with a file-writing tool instead.

## 2. Scripts are not transactions

- A script that throws halfway **keeps everything it did before the error** (unlike `use_figma` in the official MCP). → Write scripts so that re-running them is safe: check "already done?" before creating (`if (parent.children.some(n => n.name === 'x')) …`), find nodes by stable ids or names, never by "the last child".
- After a failed run, read the current state before running a fix — part of the change may already be there.
- Save a version before mass changes (`figma.saveVersionHistoryAsync(title)` works in a regular plugin). Mention the version name to the user: it is the undo button for a big batch.

## 3. Auto layout

- **FILL computed too early.** Setting one child to FILL while its siblings are still wide FIXED can give it 0 or negative width (later `resize` throws "expected number to be >= 0"). → Make all siblings FIXED with the target widths first, or use FIXED widths that sum exactly (264×3 + 20×2 = 832).
- **FILL splits unevenly** in some rows (267/263/263 instead of 264×3), stroke inclusion does not explain it. → Use FIXED widths when equal widths matter.
- **A clone dropped into a column inherits FILL vertically** and collapses (a card became 48 px tall in a hug column) or, in a growing page, shrinks to 1 px. → After `appendChild`/`insertChild` into auto layout set `layoutSizingVertical = 'HUG'` (or FIXED + height). After building, check that the sum of children equals the parent height.
- **A new auto-layout frame keeps its default 100 px height** until sizing is set; set `primaryAxisSizingMode` / `counterAxisSizingMode` (or `layoutSizingVertical = 'HUG'` once inside a parent) before reading sizes.
- **SPACE_BETWEEN with one child** centres it; switch to MIN after removing siblings.
- **Turning auto layout on** (`layoutMode = 'VERTICAL'`) stacks children in **layer order**, not visual order. → Sort children by `y` (or `x`) and re-insert them first.
- **Removing auto layout from many frames:** wrapping rows can collapse into one line. → Export before/after and compare (see recipes: image diff); fix rows by restoring HORIZONTAL+WRAP, recording x/y/size, then NONE and restoring them.
- **Absolute children** inside auto layout: set `layoutPositioning = 'ABSOLUTE'` after `appendChild`, then x/y and `constraints`.

## 4. Resizing frames without auto layout

- `frame.resize()` applies the children's constraints: bottom-pinned children move, STRETCH children grow (a footer moved twice, a background stretched by the same 28 px). → `const s = snapshot(frame)`, resize, `restore(s, [nodes that should move])`, then move those by hand. Or use `resizeWithoutConstraints`.
- Growing content inside a fixed column: compute the delta once and apply it consistently to the column, the frame and whatever sits below (footer), then verify positions.

## 5. Text

- Load fonts before editing: `getRangeAllFontNames(0, len)` → `loadFontAsync` each (`setText`/`replaceInText` in lib.js do it).
- **Non-breaking spaces (U+00A0)** are common after short words and in numbers. A pattern with a plain space silently fails to match. → Use `\s` in regexes; when building strings, put U+00A0 where a line must not break ("10 минут", "1 805 ₽").
- **U+2028 line separators** are manual line breaks made by the designer. Keep them: replace fragments with `replaceInText`, not the whole string.
- A text layer is named after its content; `findOne(n => n.name === 'Title')` may hit a text instead of the frame. → Filter by `type`.
- `insertCharacters(i, s, 'BEFORE')` takes the style of the preceding character — use it to insert without losing styling.
- `setTextStyleIdAsync` resets custom letter spacing; if a text relied on it (tight headings), re-apply after binding.

## 6. Variables, styles, paints

- `setBoundVariableForPaint(...)` returns a paint with opacity 1. → Apply opacity **after** binding (`paintVar(name, 0.4)` does it). For frame/rectangle fills that must be translucent, prefer dedicated overlay tokens; mass re-binding without this once made every translucent fill solid.
- Recolouring a layer inside an instance through a variable keeps the binding but may render the base colour; pass the real colour together with the binding.
- Variable order in the panel = creation order; the API cannot reorder.
- Reading a property that a node type does not have throws (`TypeError`). → Check `'prop' in node`.

## 7. Components and instances

- Inside an instance you can override fills, text, visibility, swap nested instances — **not vector geometry**. To change a shape everywhere, edit the main component.
- Editing the main component **in place** (`setVectorNetworkAsync` on the same vector, same node ids) keeps every instance's overrides. Replacing a node inside a component (remove + create) drops the overrides that instances had on it.
- Variant values must not contain commas ("Component set has existing errors").
- `swapComponent` between variants keeps matching overrides by layer name.
- Component properties are keyed `Name#id`; `setProp(inst, 'Name', value)` in lib.js finds the key.
- The designer may override a nested layer differently in each instance (e.g. a logo's inner fill made white in every header copy). When "the component looks fine but the page doesn't", look for instance overrides on the pages.

## 8. Vectors, booleans, masks

- `figma.createVector()` gets a default black 1 px stroke → set `strokes = []` right away.
- Vertex `cornerRadius` in a vector network rounds **concave** vertices too. A cutter with rounded concave vertices, subtracted from a rectangle, gives a shape whose cut ends are rounded (see recipes: rounded 45° cut).
- A boolean "rounded rectangle minus rotated square" leaves sharp corners at the cut. Flattening does not help (no editable radius).
- Vectors scale when their frame is resized (constraints), so a 45° cut stops being 45° in a stretched component. For shapes that must stretch, keep a boolean (base stretches, cutter pinned to the corner) or use a frame + corner "notch" vector pinned to the corner.
- A drop shadow on a frame follows the frame's rectangle, not a notch painted over it → put the shadow on the background vector instead.
- Patterns of cells (QR codes) imported as one evenodd path render wrong on the canvas (shared edges); build them from rectangles.
- `figma.createImage(bytes)` followed immediately by an export may show an empty image; export in a later call.
- Children of groups and booleans use the coordinates of the nearest frame, not of the group.

## 9. Pages, sections, performance

- `figma.currentPage` is the page the user looks at; `setCurrentPageAsync` moves the user's view. → Read other pages with `await page.loadAsync()` and work by node ids.
- Starter plan files allow 3 pages → organise with sections (`figma.createSection()`, white fill: the default is dark). Section children's x/y are relative to the section; grow a section with `resizeWithoutConstraints`.
- Heavy pages (tens of thousands of layers, big reference boards) make every call slow (minutes). Narrow `findAll` to a frame; export at most ~3 images per call; split big builds into several scripts.
- `getNodeByIdAsync` is fast; `findAll` over a page is not.

## 10. Prototype behaviour

- A scrolling container: `clipsContent = true` + `overflowDirection = 'HORIZONTAL' | 'VERTICAL'`.
- Overlays that must not scroll (fade, arrow button): put them last in the children and set `numberOfFixedChildren = k` (the top-most k children stay fixed).

## 11. The designer works in the same file

- Their Cmd+Z can undo the plugin's changes too. After each script, check that the result is still there before building on it.
- They move and rename things between your scripts: re-read ids and structure at the start of each task instead of trusting what you saw an hour ago.
- Don't change what they (or their client) edited unless asked — see workflow.md.
