# Recipes

Snippets proven on real files. All assume `--lib` (helpers from scripts/lib.js) and `--file`.

## Contents
1. Read: structure, text search, components
2. Text edits that keep styling
3. Instances: variants, properties, icon swap
4. Build a stack / turn an absolute frame into auto layout
5. Grow content without breaking the page
6. Plate with a 45° cut: frame + notch (rounded ends)
7. Stretch-safe cut inside a component (boolean with rounded cutter)
8. Horizontal scroll row with a fade and a fixed arrow
9. Vertical list that visibly scrolls
10. A sheet of states next to a screen
11. Image diff before/after
12. Find instance overrides across pages

---

## 1. Read

```js
// structure + picture of a node
const n = await figma.getNodeByIdAsync('242:32380');
return { j: J(dump(n, 4)), png_view: await png(n, 0.5) };
```
`dump` prints `type | id | name | x,y | w×h | AL dir gap pad align | size in parent | «text» style | fill (variable names) | stroke | r`.

```js
// all variant names and non-variant properties of a component set
const set = await component('Button', 'Design system');
return { j: J({ variants: set.children.map(v => v.name), props: Object.entries(set.componentPropertyDefinitions).filter(([, d]) => d.type !== 'VARIANT').map(([k, d]) => k + ' ' + d.type) }) };
```

## 2. Text edits that keep styling

```js
const t = await figma.getNodeByIdAsync('235:14426');
await replaceInText(t, 'позвонит ', 'позвонит в течение 10 минут ');  // inserts, keeps line breaks and styles
```
Match fragments with `\s` when the text may contain non-breaking spaces: `/Для\s+сумки/.test(t.characters)`.

## 3. Instances

```js
const set = await figma.getNodeByIdAsync('131:8748');                    // component set
const field = variantOf(set, 'Тип=Поле, Фон=Белый, Состояние=Error');    // exact variant name
setProp(button, 'Текст', 'Применить');                                    // property by its visible name
const icon = await component('Icon/chevron-right', 'Design system');
setProp(iconButton, 'Иконка', icon.id);                                   // INSTANCE_SWAP property takes a component id
// nested instance without a property: inner.swapComponent(icon)
```
Recolour an icon inside an instance: set the fill/stroke of its vector child to `paintVar('Brand/primary')`.

## 4. Build a stack / auto layout

```js
function vstack(name, gap) {
  const f = figma.createFrame(); f.name = name; f.fills = []; f.clipsContent = false;
  f.layoutMode = 'VERTICAL'; f.primaryAxisSizingMode = 'AUTO'; f.counterAxisSizingMode = 'AUTO';
  bindNum(f, 'itemSpacing', gap); return f;
}
// absolute frame → auto layout, keeping the visual order
const kids = [...frame.children].sort((a, b) => a.y - b.y); kids.forEach((k, i) => frame.insertChild(i, k));
frame.layoutMode = 'VERTICAL'; frame.primaryAxisSizingMode = 'AUTO'; frame.counterAxisSizingMode = 'FIXED';
setPadding(frame, 24); bindNum(frame, 'itemSpacing', 16);
for (const k of frame.children) if (k.type !== 'TEXT') k.layoutSizingHorizontal = 'FILL';
```
Uneven gaps (16, 8, 16, 32): group children into nested stacks rather than adding spacer rectangles.

## 5. Grow content without breaking the page

```js
const page = await figma.getNodeByIdAsync(PAGE_FRAME), footer = page.children.find(c => c.name === 'Footer');
const snap = snapshot(page), h0 = page.height, col0 = column.height;
// … insert the new block into the auto-layout column …
const dh = Math.round(column.height - col0);
if (dh) { page.resize(page.width, h0 + dh); restore(snap, [footer]); footer.y += dh; }
```
`restore` undoes what the children's constraints did during `resize`; only the footer is moved, by hand.

## 6. Plate with a 45° cut: frame + notch

A plate = one auto-layout frame (fill, radius 20, `clipsContent`) + one vector «notch» in the corner painted with the colour behind the plate. The notch has rounded concave vertices, so both ends of the cut are rounded. Pinned to its corner, it survives any resize. Use it on solid backgrounds; on photos or with a drop shadow use a background vector instead (one vector with the cut, `constraints` STRETCH, shadow on it).

```js
function notchPts(W, H, corner, c, R) {           // plate-local coordinates; parts outside are clipped
  const a = 2 * R, E = 40;
  if (corner === 'TR') return [[W - c - a, -E, 0], [W - c - a, 0, 0], [W - c, 0, R], [W, c, R], [W, c + a, 0], [W + E, c + a, 0], [W + E, -E, 0]];
  if (corner === 'TL') return [[c + a, -E, 0], [c + a, 0, 0], [c, 0, R], [0, c, R], [0, c + a, 0], [-E, c + a, 0], [-E, -E, 0]];
  if (corner === 'BR') return [[W - c - a, H + E, 0], [W - c - a, H, 0], [W - c, H, R], [W, H - c, R], [W, H - c - a, 0], [W + E, H - c - a, 0], [W + E, H + E, 0]];
  return [[c + a, H + E, 0], [c + a, H, 0], [c, H, R], [0, H - c, R], [0, H - c - a, 0], [-E, H - c - a, 0], [-E, H + E, 0]];
}
async function addNotch(F, corner, c, R, bgPaint) {
  const pts = notchPts(F.width, F.height, corner, c, R);
  const minX = Math.min(...pts.map(p => p[0])), minY = Math.min(...pts.map(p => p[1]));
  const v = figma.createVector(); v.name = 'notch'; v.strokes = [];
  await v.setVectorNetworkAsync({ vertices: pts.map(p => ({ x: p[0] - minX, y: p[1] - minY, cornerRadius: p[2] })),
    segments: pts.map((_, i) => ({ start: i, end: (i + 1) % pts.length })), regions: [{ windingRule: 'NONZERO', loops: [pts.map((_, i) => i)] }] });
  v.fills = [bgPaint]; F.appendChild(v);
  if (F.layoutMode !== 'NONE') v.layoutPositioning = 'ABSOLUTE';
  v.x = minX; v.y = minY;
  v.constraints = { TR: { horizontal: 'MAX', vertical: 'MIN' }, TL: { horizontal: 'MIN', vertical: 'MIN' }, BR: { horizontal: 'MAX', vertical: 'MAX' }, BL: { horizontal: 'MIN', vertical: 'MAX' } }[corner];
  return v;
}
```
A single closed polygon with every vertex `cornerRadius: 20` is the simplest form of the same shape (use it for masks and fixed-size plates).

## 7. Stretch-safe cut inside a component

Keep the SUBTRACT boolean (base rectangle stretches, cutter is pinned to the corner) but replace the rotated square with the notch polygon above (vertices in the coordinates of the boolean's parent frame) and copy the square's constraints to it. Instances keep their overrides because the boolean node stays.

## 8. Horizontal scroll row

```js
row.layoutMode = 'HORIZONTAL'; row.itemSpacing = 20; row.clipsContent = true; row.overflowDirection = 'HORIZONTAL';
for (const t of tiles) { t.layoutSizingHorizontal = 'FIXED'; t.resize(240, 78); }   // last tile peeks out
const fade = figma.createRectangle(); row.appendChild(fade); fade.layoutPositioning = 'ABSOLUTE';
fade.resize(64, row.height); fade.x = row.width - 64; fade.y = 0; fade.constraints = { horizontal: 'MAX', vertical: 'MIN' };
fade.fills = [{ type: 'GRADIENT_LINEAR', gradientTransform: [[1, 0, 0], [0, 1, 0]],
  gradientStops: [{ position: 0, color: { r: 1, g: 1, b: 1, a: 0 } }, { position: 1, color: { r: 1, g: 1, b: 1, a: 1 } }] }];
// + a round arrow button (IconButton instance), ABSOLUTE, pinned right; then:
row.numberOfFixedChildren = 2;   // fade and button stay put while scrolling in the prototype
```
Vertical fade: `gradientTransform: [[0, 1, 0], [-1, 0, 1]]` (top → bottom).

## 9. Vertical list that visibly scrolls

Make the list taller than a whole number of items so the next item is cut in half, add a bottom fade (fixed), a thin scrollbar in the gutter (4 px track + darker 4×64 thumb), `clipsContent` and `overflowDirection = 'VERTICAL'`. Fill the extra rows with real data, not duplicates.

## 10. A sheet of states next to a screen

One white frame below the screen: title, one-line note ("values are examples"), then a row of columns — caption (H20) + a clone of the block in that state. Clones of auto-layout blocks need `layoutSizingVertical = 'HUG'` after insertion. Grow the section if the sheet does not fit (`section.resizeWithoutConstraints`).

## 11. Image diff before/after

```bash
ffmpeg -v error -i before.png -i after.png -filter_complex "[0][1]blend=all_mode=difference,format=gray,geq='if(gt(lum(X,Y),24),255,0)'" -frames:v 1 -y diff.png
ffmpeg -v error -i before.png -f md5 -   # identical exports have identical md5
```
White pixels in diff.png are the changes; anything outside the intended area is a regression.

## 12. Find instance overrides across pages

```js
const LIGHT = /Фон=(Светлый|Светлый индиго)$/;            // variants where white is NOT part of the design
for (const pg of figma.root.children) { await pg.loadAsync();
  for (const inst of pg.findAll(n => n.type === 'INSTANCE' && /Logo/.test(n.name))) {
    const mc = await inst.getMainComponentAsync(); if (!mc || !LIGHT.test(mc.name)) continue;
    for (const v of inst.findAll(n => n.type === 'VECTOR' && Array.isArray(n.fills) && n.fills.some(f => f.type === 'SOLID' && f.color.r > 0.98 && f.color.g > 0.98 && f.color.b > 0.98))) v.fills = [];
  } }
```
