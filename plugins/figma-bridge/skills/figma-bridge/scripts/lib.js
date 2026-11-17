// ---- figma-bridge lib.js — prepended to a script by `fig.py --lib` ----
// Plain Plugin API helpers for reading and editing a Figma file from a bridge script.
// Token names differ between files: set LIB.spacePrefix / LIB.radiusPrefix at the top of your script
// (e.g. LIB.spacePrefix = 'spacing/') or pass the prefix explicitly.

const LIB = { spacePrefix: 'Spaces/space_', radiusPrefix: 'Radiuses/radius_' };
const __vars = await figma.variables.getLocalVariablesAsync();
const __textStyles = await figma.getLocalTextStylesAsync();
const __effectStyles = await figma.getLocalEffectStylesAsync();
const VARNAME = {}; for (const v of __vars) VARNAME[v.id] = v.name;
const STYLENAME = {}; for (const s of __textStyles) STYLENAME[s.id] = s.name;

const r2 = (n) => Math.round(n * 100) / 100;
const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');

// ---------- variables, paints, spacing, radius ----------
function V(name) {
  const v = __vars.find((x) => x.name === name);
  if (!v) throw new Error('no variable "' + name + '"');
  return v;
}
function resolveColor(v) {
  let val = v.valuesByMode[Object.keys(v.valuesByMode)[0]];
  for (let i = 0; i < 5 && val && val.type === 'VARIABLE_ALIAS'; i++) {
    const t = __vars.find((x) => x.id === val.id);
    val = t ? t.valuesByMode[Object.keys(t.valuesByMode)[0]] : null;
  }
  return val || { r: 0, g: 0, b: 0 };
}
// Solid paint bound to a COLOR variable. Opacity is applied after binding: binding resets it to 1.
function paintVar(name, opacity) {
  const v = V(name); const c = resolveColor(v);
  const p = figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b } }, 'color', v);
  return opacity == null ? p : Object.assign({}, p, { opacity });
}
// Bind a number field (itemSpacing, paddingTop, …) to a FLOAT variable "<prefix><value>" when it exists, else set the number.
function bindNum(node, field, value, prefix) {
  const v = __vars.find((x) => x.name === (prefix || LIB.spacePrefix) + value);
  if (v) node.setBoundVariable(field, v); else node[field] = value;
}
function setPadding(node, t, r, b, l) {
  if (r == null) r = t; if (b == null) b = t; if (l == null) l = r;
  bindNum(node, 'paddingTop', t); bindNum(node, 'paddingRight', r); bindNum(node, 'paddingBottom', b); bindNum(node, 'paddingLeft', l);
}
function setRadius(node, r, prefix) {
  const v = __vars.find((x) => x.name === (prefix || LIB.radiusPrefix) + r);
  for (const f of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']) {
    if (v) node.setBoundVariable(f, v); else node[f] = r;
  }
}
function effectStyle(name) { return __effectStyles.find((s) => s.name === name || s.name.endsWith('/' + name)) || null; }

// ---------- text ----------
function textStyle(name) {
  const s = __textStyles.find((x) => x.name === name || x.name.endsWith('/' + name));
  if (!s) throw new Error('no text style "' + name + '"');
  return s;
}
async function loadFontsOf(t) {
  const n = t.characters.length;
  const fonts = n ? t.getRangeAllFontNames(0, n) : [t.fontName];
  for (const f of fonts) if (f !== figma.mixed) await figma.loadFontAsync(f);
}
// New text node with a text style and an optional color variable.
async function txt(chars, styleName, colorVar) {
  const st = textStyle(styleName);
  await figma.loadFontAsync(st.fontName);
  const t = figma.createText();
  await t.setTextStyleIdAsync(st.id);
  t.characters = chars;
  if (colorVar) t.fills = [paintVar(colorVar)];
  return t;
}
// Replace the whole text (style of the first character is kept).
async function setText(t, chars) { await loadFontsOf(t); t.characters = chars; }
// Replace one fragment, keeping the styling of the rest (and manual line breaks, U+2028).
async function replaceInText(t, from, to) {
  const i = t.characters.indexOf(from);
  if (i < 0) return false;
  await loadFontsOf(t);
  t.insertCharacters(i + from.length, to, 'BEFORE');
  t.deleteCharacters(i, i + from.length);
  return true;
}

// ---------- components ----------
function variantOf(setOrComponent, variantName) {
  const set = setOrComponent.type === 'COMPONENT_SET' ? setOrComponent : setOrComponent.parent;
  const v = set.children.find((c) => c.name === variantName);
  if (!v) throw new Error('no variant "' + variantName + '" in ' + set.name + '; have: ' + set.children.map((c) => c.name).join(' | '));
  return v.createInstance();
}
function propKey(inst, key) { return Object.keys(inst.componentProperties).find((k) => k.split('#')[0] === key); }
function setProp(inst, key, value) {
  const full = propKey(inst, key);
  if (!full) throw new Error('no property "' + key + '" on ' + inst.name + '; have: ' + Object.keys(inst.componentProperties).map((k) => k.split('#')[0]).join(', '));
  inst.setProperties({ [full]: value });
}
function getProp(inst, key) { const full = propKey(inst, key); return full ? inst.componentProperties[full].value : undefined; }
// Find a component or component set by exact name. Give a page name on big files: loading every page is slow.
async function component(name, pageName) {
  const pages = pageName ? figma.root.children.filter((p) => p.name === pageName) : figma.root.children;
  for (const p of pages) {
    await p.loadAsync();
    const c = p.findOne((n) => (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET') && n.name === name);
    if (c) return c;
  }
  return null;
}

// ---------- inspection ----------
function paintsDesc(ps) {
  if (!ps || ps === figma.mixed) return ps === figma.mixed ? 'mixed' : '';
  return ps.filter((f) => f.visible !== false).map((f) => {
    if (f.type !== 'SOLID') return f.type;
    const bound = f.boundVariables && f.boundVariables.color && VARNAME[f.boundVariables.color.id];
    return (bound || hex(f.color)) + (f.opacity != null && f.opacity < 1 ? '@' + r2(f.opacity) : '');
  }).join('+');
}
// One line per node: type | id | name | x,y | w×h | auto layout | sizing in parent | text, style | fill | stroke | radius | hidden
function dump(node, maxDepth, depth) {
  maxDepth = maxDepth == null ? 3 : maxDepth; depth = depth || 0;
  const o = [node.type.slice(0, 4), node.id, String(node.name).slice(0, 40), r2(node.x) + ',' + r2(node.y), r2(node.width) + 'x' + r2(node.height)];
  if ('layoutMode' in node && node.layoutMode !== 'NONE') {
    o.push('AL ' + node.layoutMode[0] + ' gap ' + node.itemSpacing + ' pad ' + [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft].join('/') + ' ' + node.primaryAxisAlignItems + '/' + node.counterAxisAlignItems + (node.layoutWrap === 'WRAP' ? ' WRAP' : ''));
  }
  if (node.parent && 'layoutMode' in node.parent && node.parent.layoutMode !== 'NONE') {
    o.push('size ' + node.layoutSizingHorizontal + '/' + node.layoutSizingVertical + (node.layoutPositioning === 'ABSOLUTE' ? ' ABSOLUTE' : ''));
  }
  if (node.type === 'TEXT') {
    o.push('«' + node.characters.slice(0, 80) + '»');
    o.push((typeof node.textStyleId === 'string' && STYLENAME[node.textStyleId]) || ('font ' + String(node.fontSize)));
  }
  if ('fills' in node) { const f = paintsDesc(node.fills); if (f) o.push('fill ' + f); }
  if ('strokes' in node) { const s = paintsDesc(node.strokes); if (s) o.push('stroke ' + s + ' ' + String(node.strokeWeight)); }
  if ('cornerRadius' in node && node.cornerRadius) o.push('r ' + String(node.cornerRadius === figma.mixed ? 'mixed' : node.cornerRadius));
  if (node.isMask) o.push('MASK');
  if (node.visible === false) o.push('HIDDEN');
  const lines = ['  '.repeat(depth) + o.join(' | ')];
  if ('children' in node && node.type !== 'INSTANCE' && depth < maxDepth) for (const c of node.children) lines.push(...dump(c, maxDepth, depth + 1));
  return lines;
}
async function png(node, scale) {
  return figma.base64Encode(await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: scale || 1 } }));
}
function pathOf(node) {
  const a = []; let p = node.parent;
  while (p && p.type !== 'PAGE') { a.unshift(p.name + ' ' + p.id); p = p.parent; }
  return a.join(' > ');
}

// ---------- layout safety ----------
// Resizing a frame without auto layout applies the children's constraints (bottom-pinned move, STRETCH grows).
// snapshot() before the resize, restore() after, and move by hand only what should move.
function snapshot(frame) { return frame.children.map((c) => [c, c.x, c.y]); }
function restore(snap, keep) {
  for (const [c, x, y] of snap) {
    if (c.removed || (keep && keep.includes(c))) continue;
    if (Math.round(c.x) !== Math.round(x) || Math.round(c.y) !== Math.round(y)) { c.x = x; c.y = y; }
  }
}
// Nodes with fractional position/size (and optionally odd values) — designers usually want whole, even numbers.
function offGrid(root, oddToo) {
  const bad = [];
  for (const n of root.findAll((x) => 'width' in x)) {
    const vals = [n.x, n.y, n.width, n.height];
    if (vals.some((v) => Math.abs(v - Math.round(v)) > 0.01) || (oddToo && vals.some((v) => Math.round(v) % 2 !== 0))) {
      bad.push(n.id + ' «' + String(n.name).slice(0, 30) + '» ' + vals.map(r2).join(','));
    }
  }
  return bad;
}
async function saveVersion(title, description) { await figma.saveVersionHistoryAsync(title, description || ''); }
// ---- end of lib.js ----
