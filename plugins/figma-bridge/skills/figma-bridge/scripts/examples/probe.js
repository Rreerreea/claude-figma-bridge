// Which file, page and selection is the plugin in? Synchronous only — answers even from a plugin window
// that lost its connection (then async calls fail with "Unable to establish connection to Figma").
// Run without --file:  python3 fig.py examples/probe.js
return {
  j: J({
    file: figma.root.name,
    page: figma.currentPage.name,
    pages: figma.root.children.map((p) => p.name),
    selection: figma.currentPage.selection.map((n) => n.id + ' ' + n.type + ' «' + n.name + '»'),
  }),
};
