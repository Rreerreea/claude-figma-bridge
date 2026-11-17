// Claude Bridge — main thread. Runs the scripts Claude sends (Plugin API, with `figma` in scope) and returns their result.
// The UI iframe does the networking; this side tells it which file it lives in, so the server can route jobs by file.
figma.showUI(__html__, { width: 300, height: 112, title: 'Claude Bridge' });

function hello() {
  figma.ui.postMessage({ type: 'hello', file: figma.root.name });
}
hello();

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

figma.ui.onmessage = async (msg) => {
  if (!msg) return;
  if (msg.type === 'whoami') return hello();
  if (msg.type !== 'job') return;
  const t0 = Date.now();
  try {
    let fn;
    try { fn = new AsyncFunction('figma', msg.code); }
    catch (e) { fn = eval('(async function (figma) {\n' + msg.code + '\n})'); }
    const result = await fn(figma);
    figma.ui.postMessage({ type: 'result', id: msg.id, ok: true, result, ms: Date.now() - t0 });
  } catch (e) {
    figma.ui.postMessage({
      type: 'result', id: msg.id, ok: false,
      error: String((e && e.message) || e),
      stack: String((e && e.stack) || ''),
      ms: Date.now() - t0,
    });
  }
};
