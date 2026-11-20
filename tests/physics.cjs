// Physique : nombre d'objets par chapitre, coût d'un pas, objets au repos, réaction à la Lueur
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('C', m.text().slice(0, 300)); });
  await p.goto('http://localhost:4173/');
  await p.waitForFunction(() => window.__game && window.__game.player.model.skin, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  for (const [ch, x] of [[0, 30], [1, 40], [2, 52], [3, 40], [4, 30]]) {
    const r = await p.evaluate(([ch, x]) => {
      const g = window.__game, I = g.input; g.settings.quality = 'high'; g.startChapter(ch, 0, true); g.cine = null; g.player.state = 'normal'; g.player.control = true;
      document.getElementById('titleCard').classList.add('hidden');
      const ph = g.physics; if (!ph) return { ch, err: 'pas de physique' };
      g.player.place(x, 0, .3, 1);
      const step = (btn = {}, mx = 0) => { I.mx = mx; I.mz = 0; I.botBtn = btn; g.stepNoInput(1 / 60); };
      let t0 = performance.now(); for (let i = 0; i < 180; i++) step(); const settle = (performance.now() - t0) / 180;
      const awake0 = ph.props.filter(q => !q.body.isSleeping()).length;
      // Mio court à travers les objets puis lance la Lueur
      const moved0 = ph.props.map(q => q.cur.clone());
      for (let i = 0; i < 150; i++) step({}, 1);
      t0 = performance.now(); let maxMs = 0;
      for (let i = 0; i < 60; i++) { const a = performance.now(); ph.step(1 / 60); maxMs = Math.max(maxMs, performance.now() - a); }
      g.powers.unlocked[0] = true; g.powers.cur = 0; g.powers.lueurBurst(1);
      for (let i = 0; i < 20; i++) step();
      const moved = ph.props.filter((q, i) => q.cur.distanceTo(moved0[i]) > .05).length;
      const fallen = ph.props.filter(q => q.cur.y < -5).length;
      g.post.params.fade = 0; g.fadeTarget = 0;
      return { ch, props: ph.props.length, statics: ph.statics.length, settleMs: settle.toFixed(2), physMaxMs: maxMs.toFixed(2), awakeAfterSettle: awake0, moved, fallenBelow: fallen };
    }, [ch, x]);
    console.log(JSON.stringify(r));
    await p.waitForTimeout(1200);
    if (out) await p.screenshot({ path: `${out}/phys${ch}.png` });
  }
  await b.close();
})();
