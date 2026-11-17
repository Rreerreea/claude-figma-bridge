// Find text layers by a regular expression (case-insensitive), under a node or on the current page.
// python3 fig.py examples/find-text.js --lib --file "File" --arg re="Оформить|Checkout" [--arg id=ROOT_ID] [--arg limit=50]
// Note: texts often contain non-breaking spaces (U+00A0); use \s in the pattern instead of a plain space.
const root = ARGS.id ? await figma.getNodeByIdAsync(String(ARGS.id)) : figma.currentPage;
if (!root) return { __error: 'root not found' };
const re = new RegExp(String(ARGS.re || '.'), 'i');
const hits = root.findAll((n) => n.type === 'TEXT' && re.test(n.characters)).slice(0, ARGS.limit || 50);
return { j: J(hits.map((t) => ({ id: t.id, text: t.characters.slice(0, 120), style: STYLENAME[t.textStyleId] || null, path: pathOf(t) }))) };
