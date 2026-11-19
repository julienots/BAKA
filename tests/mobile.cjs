const { chromium, devices } = require('playwright');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const d = devices['Pixel 7 landscape'];
  const ctx = await b.newContext({ ...d });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:4173/');
  await p.waitForFunction(() => window.__game);
  await p.waitForTimeout(3000);
  await p.screenshot({ path: out + '/menu.png' });
  await p.tap('#m_play');
  await p.waitForTimeout(9000);
  await p.screenshot({ path: out + '/intro.png' });
  await p.evaluate(() => { const g = window.__game; g.cine = null; g.player.state = 'normal'; g.player.control = true; g.rig.override = null; g.ui.touch(true); g.player.place(40, 0, -.2, 1); });
  // joystick : glisser vers la droite
  const vp = p.viewportSize();
  await p.touchscreen.tap(vp.width * .15, vp.height * .7);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: out + '/touch.png' });
  console.log(JSON.stringify(await p.evaluate(() => ({ touch: window.__game.input.isTouch, q: window.__game.settings.quality, x: window.__game.player.pos.x }))));
  await b.close();
})();
