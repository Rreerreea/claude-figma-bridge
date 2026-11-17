// A harmless joke for the installer: a fake "blue screen" on a Mac for 20 seconds, then it just disappears.
// macOS JavaScript for Automation:  osascript -l JavaScript bsod.js
// - a borderless window above everything on the main screen; it takes mouse clicks itself, so nothing underneath
//   gets clicked blindly, and a click closes it early
// - closes by itself after 20 s; the installer also kills it after 35 s as a safety net
// - BSOD_DRY=1 builds everything without showing it (for checks); BSOD_SECONDS=N changes the duration;
//   NO_PRANK=1 in the installer skips it entirely
ObjC.import('Cocoa');

function env(name) {
  const v = $.NSProcessInfo.processInfo.environment.objectForKey(name);
  return v.isNil() ? '' : ObjC.unwrap(v);
}

function run() {
  const DRY = env('BSOD_DRY') === '1';
  const SECONDS = Number(env('BSOD_SECONDS')) || 20;
  const app = $.NSApplication.sharedApplication;
  app.setActivationPolicy(1); // accessory: no Dock icon

  const frame = $.NSScreen.mainScreen.frame;
  const W = frame.size.width, H = frame.size.height;
  const win = $.NSWindow.alloc.initWithContentRectStyleMaskBackingDefer(frame, 0, 2, false); // borderless, buffered
  win.setLevel(1000);                      // screen saver level: above the menu bar and the Dock
  win.setCollectionBehavior(1 | 256);      // all spaces + full-screen auxiliary
  win.setBackgroundColor($.NSColor.colorWithSRGBRedGreenBlueAlpha(0, 0.47, 0.84, 1));
  win.setOpaque(true);
  win.setIgnoresMouseEvents(false);        // clicks land here, not on hidden windows underneath
  win.setReleasedWhenClosed(false);
  const view = win.contentView;

  // AppKit counts y from the bottom; yTop is measured from the top of the screen
  function label(text, size, x, yTop, w, h) {
    const tf = $.NSTextField.alloc.initWithFrame($.NSMakeRect(x, H - yTop - h, w, h));
    tf.setStringValue(text);
    tf.setBezeled(false);
    tf.setDrawsBackground(false);
    tf.setEditable(false);
    tf.setSelectable(false);
    tf.setTextColor($.NSColor.whiteColor);
    tf.setFont($.NSFont.systemFontOfSizeWeight(size, 0));
    tf.cell.setWraps(true);
    tf.cell.setLineBreakMode(0); // word wrap
    view.addSubview(tf);
    return tf;
  }

  const x0 = Math.round(W * 0.12), tw = Math.round(W * 0.76);
  const s = Math.max(18, Math.round(H * 0.03));
  label(':(', Math.round(H * 0.17), x0, H * 0.14, tw, H * 0.22);
  label('На вашем ПК возникла проблема, и его необходимо перезагрузить. Мы лишь собираем некоторые сведения об ошибке, а затем будет автоматически выполнена перезагрузка.', s, x0, H * 0.38, tw, s * 3.6);
  const pct = label('0% завершено', s, x0, H * 0.38 + s * 4.4, tw, s * 1.4);
  label('Код остановки: FIGMA_TOO_MANY_LAYERS', Math.round(s * 0.6), x0, H * 0.74, tw, s);

  if (DRY) return 'ok: ' + Math.round(W) + 'x' + Math.round(H) + ', ' + SECONDS + ' s';

  win.orderFrontRegardless();
  const pump = (sec) => $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(sec));
  const t0 = Date.now();
  let shown = 0, nextJump = 1.2;
  while (true) {
    const elapsed = (Date.now() - t0) / 1000;
    if (elapsed >= SECONDS) break;
    if (Number($.NSEvent.pressedMouseButtons) > 0) break;          // a click closes it early
    if (elapsed >= nextJump && shown < 100) {                       // jumpy progress, like the real thing
      const target = Math.min(100, Math.round((elapsed / (SECONDS * 0.9)) * 100));
      shown = Math.max(shown, target);
      pct.setStringValue(shown + '% завершено');
      nextJump = elapsed + 0.4 + Math.random() * 1.1;
    }
    pump(0.05);
  }
  win.orderOut(null);
  win.close();
  return 'done';
}
