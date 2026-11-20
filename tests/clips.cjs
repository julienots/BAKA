// Planche de chaque clip capturé à plusieurs instants (vue de profil)
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 480, height: 480 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:4173/'); await p.waitForFunction(() => window.__game && window.__game.player.model.skin, null, { timeout: 150000 });
  await p.evaluate(() => { const g = window.__game; g.settings.quality = 'low'; g.settings.dynRes = false; g.resize(); g.startChapter(0, 0, true); g.cine = null; g.player.place(6, 0, .3, 1); window.__freeze = true; g.rig.override = { dist: 3.4, height: .2, look: .7, fov: 32, ahead: 0, ease: 100 }; g.rig.snap(g.camTarget(), []); document.getElementById('titleCard').classList.add('hidden'); g.post.params.fade = 0; g.fadeTarget = 0; });
  const clips = ['jump', 'fall', 'scared_01', 'flee_01', 'defeat_02', 'climb', 'look_around', 'lift_heavy'];
  for (const c of clips) for (let k = 0; k < 6; k++) {
    await p.evaluate(([c, k]) => { const g = window.__game, s = g.player.model.skin; for (const n in s.acts) { s.acts[n].setEffectiveWeight(n === c ? 1 : 0); s.acts[n].time = k / 6 * s.acts[c].getClip().duration; } s.mixer.update(0); g.rig.override.yawFix = 1; g.player.model.yawGroup.rotation.y = 0; g.post.params.fade = 0; g.render(0); }, [c, k]);
    await p.waitForTimeout(150); await p.screenshot({ path: `${out}/clip_${c}_${k}.png` });
  }
  await b.close();
})();
