// Captures des moments clés (rendu réel)
const { chromium } = require('playwright');
const SHOTS = JSON.parse(process.argv[2]);
const outDir = process.argv[3];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: +(process.argv[4] || 1) });
  p.on('pageerror', e => console.log('ERR', e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('CERR', m.text().slice(0, 200)); });
  await p.goto('http://localhost:4173/');
  await p.waitForFunction(() => window.__game); await p.waitForTimeout(2500);
  for (const s of SHOTS) {
    await p.evaluate(s => {
      const g = window.__game, I = g.input; g.settings.quality = s.q || 'high'; g.resize();
      g.startChapter(s.ch, s.cp || 0, true); g.cine = null; g.player.state = 'normal'; g.player.control = true; g.rig.override = null; g.player.cine = null;
      document.getElementById('titleCard').classList.add('hidden');
      if (s.pos) g.player.place(...s.pos, 1);
      if (s.powers) s.powers.forEach((v, i) => g.powers.unlocked[i] = v);
      const step = (btn = {}, mx = 0, mz = 0) => { I.mx = mx; I.mz = mz; I.botBtn = btn; g.stepNoInput(1 / 60); };
      for (const a of (s.pre || [])) { if (a[0] === 'eval') eval(a[1]); else for (let i = 0; i < a[1] * 60; i++) step(a[2] || {}, a[3] || 0, a[4] || 0); }
      g.post.params.fade = 0; g.fadeTarget = 0; g.rig.snap(g.camTarget(), g.world.camZones);
      for (let i = 0; i < (s.settle ?? 90); i++) step(s.hold || {}, s.mx || 0, s.mz || 0);
      window.__freeze = s.freeze;
    }, s);
    await p.waitForTimeout(s.wait || 1500);
    await p.screenshot({ path: `${outDir}/${s.name}.png` });
    console.log('ok', s.name);
  }
  await b.close();
})();
