// Structure of nodes, one line per layer, plus an optional PNG of each.
// python3 fig.py examples/dump.js --lib --file "File" --arg id=12:345 [--arg depth=4] [--arg png=0.5]
// Without --arg id the current selection is used. Several ids: --arg id=1:2,3:4
const ids = ARGS.id ? String(ARGS.id).split(',') : figma.currentPage.selection.map((n) => n.id);
if (!ids.length) return { __error: 'pass --arg id=NODE_ID or select something in Figma' };
const out = {}; const res = {};
for (const id of ids) {
  const n = await figma.getNodeByIdAsync(id.trim());
  if (!n) { out[id] = 'not found'; continue; }
  out[id] = { path: pathOf(n), tree: dump(n, ARGS.depth == null ? 3 : ARGS.depth) };
  if (ARGS.png) res['png_' + id.replace(/[:;]/g, '_')] = await png(n, ARGS.png);
}
res.j = J(out);
return res;
