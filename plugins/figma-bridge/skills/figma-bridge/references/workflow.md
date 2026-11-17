# Working with a designer through the bridge

How the sessions this skill was built from actually ran, and what made them work.

## Contents
1. The loop for one change
2. Going through client comments
3. When to ask, when to just do it
4. Verifying a change
5. Reporting
6. The task log (handoff between chats)
7. Respecting other people's work

---

## 1. The loop for one change

1. **Locate.** Get the frame/node id from the link the user pastes (`node-id=242-32380` → `242:32380`) or from the selection (`examples/probe.js`).
2. **Read before writing.** Dump the structure of the area you will touch (`examples/dump.js --arg depth=4 --arg png=1`) and look at the PNG. Files drift: what you remember from an hour ago may be wrong — the designer edits in parallel.
3. **Decide the smallest change** that does what was asked inside the designer's existing structure: same blocks, same order, same components. A change request is not an invitation to redesign.
4. **Write one focused, re-runnable script.** File guard via `--file`. Check for "already done" before creating. Prefer components, text styles and variables from the file over raw values.
5. **Run, then verify** (section 4). If something is off, fix it now — before reporting.
6. **Log and report** (sections 5–6).

## 2. Going through client comments

Plugins cannot read Figma comments, so the designer pastes screenshots of them one by one. For each:

- **Restate the meaning in one line** when the comment is terse or ambiguous ("«обязательной» — по роду это почта"; "«10 мин» — менеджер позвонит в течение 10 минут"). Clients write in shorthand; the designer often asks "what does this comment mean?" — answer that question first, offer the change second, and don't build anything on a question alone.
- **Find every place the comment applies to.** A block shown in one frame usually exists in its siblings (two checkout variants, desktop/tablet/mobile). Apply to the same block everywhere it is the same block; mention where you did and did not change it.
- **Prefer facts over invention.** Prices, timings and terms come from the client's production site or the client; if a value is unknown, either use a clearly labelled example ("пример") or keep the sentence honest ("Цена — после выбора пункта"). Say which values are examples.
- **States and variants go next to the screen**, not into it: when a comment asks for "состояния", build a sheet beside the frame with one copy per state and a caption each (input / loading / error / success; guest / logged in).
- One comment → one report → wait for the next screenshot. Keep a running list in the task log.

## 3. When to ask, when to just do it

- **Just do it:** the request is concrete ("цена за штуку", "почту обязательной", "скругли углы на 20 везде"), or the user already said "давай"/"попробуй".
- **Ask one short question** when the answer changes the result and you cannot infer it: a real design fork (dropdown vs stepper, where a new block goes when it pushes the layout), scope (one frame or all), or anything that touches files/frames outside the current task. Offer your recommended option first, in plain words; avoid multi-branch "if A then X, if B then Y" answers.
- **Never on your own:** changing pages the user said not to touch, reverting the client's edits, deleting frames, touching another client's file, pushing anything public.

## 4. Verifying a change

- Export the changed area (`png_*` in the result) and **look at it** (read the PNG). Most bugs are visible: a collapsed card, a white square in a cut corner, text wrapped into two lines, a footer that moved twice.
- Check the numbers you can check: positions and sizes of neighbours that should not have moved, sum of children vs parent height, even/whole sizes (`offGrid`).
- For changes that must not alter the look (rebuilding layers, removing auto layout): export before and after and diff the images (recipes.md → image diff). The only differences should be the intended ones.
- For components: export one instance at a non-default size to see that stretching still works.

## 5. Reporting

- Short, in the user's language. What changed, where, what you deliberately did not change, and what is an example value. One line per point.
- Give a link to a new frame/sheet: `https://www.figma.com/design/<fileKey>/<name>?node-id=<id with "-" instead of ":">`.
- Mention side effects honestly ("подвал опустился на 22 px", "first run failed halfway, fixed").
- If something was wrong and you fixed it, say so in one line; don't hide failed attempts.

## 6. The task log (handoff between chats)

Keep a markdown file in the project folder (e.g. `TASKS.md`) with a **"▶ NOW"** block at the top: the working frame ids, what was just done, what waits for the user's answer, how to reconnect the bridge. Add one line per finished change with node ids. A new chat starts by reading that block — this is what made multi-day work possible without re-explaining everything.

## 7. Respecting other people's work

- The designer's frames are theirs. Fix inside their structure; propose alternatives only when asked.
- Client edits (text, prices, layout the client changed directly in the file) are not "mistakes to clean up" even if they contradict your data. Ask before touching them.
- Before any mass change: save a version, tell the user its name.
- Keep sizes whole (no 22.4) and, where the file uses a grid, even; bind spacing/radius/colour to the file's variables and use its text styles — the next person (or developer) relies on them.
