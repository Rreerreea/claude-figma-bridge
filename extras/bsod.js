// A harmless joke for the installer: a fake "blue screen" on a Mac for ~3 s, then "just kidding", then it closes itself.
// macOS JavaScript for Automation:  osascript -l JavaScript bsod.js
// - a borderless window above everything on the main screen; mouse and keyboard pass through (nothing is captured)
// - closes by itself after ~5 s; the installer also kills it after 12 s as a safety net
// - BSOD_DRY=1 builds everything without showing it (for checks); NO_PRANK=1 in the installer skips it entirely
ObjC.import('Cocoa');

function env(name) {
  const v = $.NSProcessInfo.processInfo.environment.objectForKey(name);
  return v.isNil() ? '' : ObjC.unwrap(v);
}

function run() {
  const DRY = env('BSOD_DRY') === '1';
  const app = $.NSApplication.sharedApplication;
  app.setActivationPolicy(1); // accessory: no Dock icon

  const frame = $.NSScreen.mainScreen.frame;
  const W = frame.size.width, H = frame.size.height;
  const win = $.NSWindow.alloc.initWithContentRectStyleMaskBackingDefer(frame, 0, 2, false); // borderless, buffered
  win.setLevel(1000);                      // screen saver level: above the menu bar and the Dock
  win.setCollectionBehavior(1 | 256);      // all spaces + full-screen auxiliary
  win.setBackgroundColor($.NSColor.colorWithSRGBRedGreenBlueAlpha(0, 0.47, 0.84, 1));
  win.setOpaque(true);
  win.setIgnoresMouseEvents(true);
  win.setReleasedWhenClosed(false);
  const view = win.contentView;

  // AppKit counts y from the bottom; yTop is measured from the top of the screen
  function label(text, size, x, yTop, w, h, weight) {
    const tf = $.NSTextField.alloc.initWithFrame($.NSMakeRect(x, H - yTop - h, w, h));
    tf.setStringValue(text);
    tf.setBezeled(false);
    tf.setDrawsBackground(false);
    tf.setEditable(false);
    tf.setSelectable(false);
    tf.setTextColor($.NSColor.whiteColor);
    tf.setFont($.NSFont.systemFontOfSizeWeight(size, weight || 0));
    tf.cell.setWraps(true);
    tf.cell.setLineBreakMode(0); // word wrap
    view.addSubview(tf);
    return tf;
  }

  const x0 = Math.round(W * 0.12), tw = Math.round(W * 0.76);
  const s = Math.max(18, Math.round(H * 0.03));
  const bsod = [
    label(':(', Math.round(H * 0.17), x0, H * 0.14, tw, H * 0.22, 0),
    label('На вашем ПК возникла проблема, и его необходимо перезагрузить. Мы лишь собираем некоторые сведения об ошибке, а затем будет автоматически выполнена перезагрузка.', s, x0, H * 0.38, tw, s * 3.6, 0),
  ];
  const pct = label('0% завершено', s, x0, H * 0.38 + s * 4.4, tw, s * 1.4, 0);
  bsod.push(pct);
  bsod.push(label('Код остановки: FIGMA_TOO_MANY_LAYERS', Math.round(s * 0.6), x0, H * 0.74, tw, s, 0));

  const joke = [
    label('Шутка 😄', Math.round(H * 0.11), x0, H * 0.3, tw, H * 0.16, 0.3),
    label('Это Mac — синих экранов тут не бывает. Фигма-мост уже ставится, возвращайтесь в Терминал.', s, x0, H * 0.3 + H * 0.17, tw, s * 2.6, 0),
  ];
  joke.forEach((j) => j.setHidden(true));

  if (DRY) return 'ok: ' + Math.round(W) + 'x' + Math.round(H);

  win.orderFrontRegardless();
  const pump = (sec) => $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(sec));
  pump(0.6);
  for (let p = 0; p <= 100; p += 5) {
    pct.setStringValue(p + '% завершено');
    pump(0.13);
  }
  pump(0.4);
  bsod.forEach((b) => b.setHidden(true));
  joke.forEach((j) => j.setHidden(false));
  pump(2.4);
  win.orderOut(null);
  win.close();
  return 'done';
}
