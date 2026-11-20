// Boucle réelle : on joue au clavier quelques secondes et on vérifie qu'aucune erreur n'apparaît
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 800, height: 450 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:4173/'); await p.waitForFunction(() => window.__game && window.__game.player.model.skin, null, { timeout: 120000 });
  await p.evaluate(() => { const g = window.__game; g.settings.quality = 'low'; g.startChapter(0, 0, true); g.cine = null; g.player.state = 'normal'; g.player.control = true; g.rig.override = null; document.getElementById('titleCard').classList.add('hidden'); });
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(4000); await p.keyboard.down('ShiftLeft'); await p.waitForTimeout(3000); await p.keyboard.up('ShiftLeft'); await p.keyboard.up('ArrowRight');
  await p.keyboard.press('Space'); await p.waitForTimeout(1500);
  await p.screenshot({ path: process.argv[2] });
  console.log(JSON.stringify(await p.evaluate(() => { const g = window.__game; return { x: g.player.pos.x.toFixed(2), dyn: g.dynScale, ft: g.ft && (g.ft * 1000).toFixed(0) + 'ms', modelX: g.player.model.root.position.x.toFixed(2) }; })), errs.slice(0, 5));
  await b.close();
})();
