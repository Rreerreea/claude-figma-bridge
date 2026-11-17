// Edit example: change one text layer, idempotently, and return a picture of its frame to check the result.
// python3 fig.py examples/set-text.js --lib --file "File" --arg id=12:345 --arg text="New text" [--arg from="old fragment"]
// With --arg from=... only that fragment is replaced (styling of the rest and manual line breaks stay).
const t = await figma.getNodeByIdAsync(String(ARGS.id));
if (!t || t.type !== 'TEXT') return { __error: 'not a text layer: ' + ARGS.id };
const before = t.characters;
if (ARGS.from) { if (!(await replaceInText(t, String(ARGS.from), String(ARGS.text)))) return { __error: 'fragment not found' }; }
else if (t.characters !== String(ARGS.text)) await setText(t, String(ARGS.text));
const frame = t.parent && t.parent.type !== 'PAGE' ? t.parent : t;
return { j: J({ before, after: t.characters }), png_set_text: await png(frame, 2) };
