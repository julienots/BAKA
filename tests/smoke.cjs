// Test de fumée : charge le jeu, lance un chapitre, capture
const { chromium } = require('playwright');
(async () => {
  const ch = +(process.argv[2] || 0), out = process.argv[3] || 'shot.png', secs = +(process.argv[4] || 0);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await p.goto('http://localhost:4173/');
  await p.waitForFunction(() => window.__game, null, { timeout: 60000 });
  await p.evaluate(([ch, secs]) => { const g = window.__game; g.settings.quality = 'medium'; g.startChapter(ch, 0, true); g.cine = null; g.player.state = 'normal'; g.player.control = true; if (secs) g.simulate(secs); }, [ch, secs]);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: out });
  const info = await p.evaluate(() => { const g = window.__game; return { pos: g.player.pos.toArray().map(v => +v.toFixed(2)), state: g.player.state, calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles }; });
  console.log(JSON.stringify(info));
  console.log(errs.slice(0, 15).join('\n'));
  await b.close();
})();
