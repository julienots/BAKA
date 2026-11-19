const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:4173/');
  await p.waitForFunction(() => window.__game);
  await p.evaluate(() => {
    const g = window.__game, I = g.input; g.settings.quality = 'low'; g.resize();
    g.save.memories = ['dessin', 'boite', 'lapin', 'moufle', 'photo'];
    g.startChapter(4, 3, true); g.cine = null; g.player.control = true;
    const step = (btn = {}, mx = 0, mz = 0) => { I.mx = mx; I.mz = mz; I.botBtn = btn; g.stepNoInput(1 / 60); };
    const goto = (x, z) => { for (let t = 0; t < 900; t++) { const dx = x - g.player.pos.x, dz = z - g.player.pos.z; if (Math.abs(dx) < .2 && Math.abs(dz) < .2) break; step({}, Math.max(-1, Math.min(1, dx * 3)), Math.max(-1, Math.min(1, dz * 3))); } };
    goto(98.7, -.5); step({ act: true }); step({}); for (let i = 0; i < 60; i++) step({});
    goto(110, 0); step({ act: true }); step({});
    window.__carry = !!g.world.byId.coat.placed;
  });
  console.log('relâché :', await p.evaluate(() => window.__carry));
  for (let k = 0; k < 14; k++) {
    await p.waitForTimeout(4000);
    const st = await p.evaluate(() => ({ ch: window.__game.chapter, st: window.__game.state, t: window.__game.time.toFixed(1), white: window.__game.post.params.white.toFixed(2) }));
    console.log(k, JSON.stringify(st));
    if (k === 1 || k === 6 || k === 9) await p.screenshot({ path: `${out}/fin${k}.png` });
    if (st.st === 'credits') { await p.waitForTimeout(3000); await p.screenshot({ path: `${out}/credits.png` }); break; }
  }
  await b.close();
})();
