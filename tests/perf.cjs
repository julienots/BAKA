// Mesure : appels de dessin, triangles (passe scène + ombres), temps CPU d'une image de logique
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:4173/'); await p.waitForFunction(() => window.__game && window.__game.player.model.skin, null, { timeout: 120000 });
  for (const [ch, x] of [[0, 40], [1, 60], [2, 45], [3, 70], [4, 60]]) {
    const r = await p.evaluate(([ch, x]) => {
      const g = window.__game; window.__freeze = true; g.settings.quality = 'medium'; g.resize();
      g.startChapter(ch, 0, true); g.cine = null; g.player.state = 'normal'; g.player.place(x, 6, 0, 1);
      for (let i = 0; i < 30; i++) g.stepNoInput(1 / 60);
      const R = g.renderer; R.info.autoReset = false; R.info.reset();
      R.setRenderTarget(g.post.rtMain); R.render(g.scene, g.camera);
      const calls = R.info.render.calls, tris = R.info.render.triangles; R.info.autoReset = true;
      let meshes = 0, statics = 0; g.scene.traverse(o => { if (o.isMesh) meshes++; });
      const t0 = performance.now(); for (let i = 0; i < 60; i++) g.stepNoInput(1 / 60); const step = (performance.now() - t0) / 60;
      return { ch, calls, tris, meshes, stepMs: step.toFixed(2) };
    }, [ch, x]);
    console.log(JSON.stringify(r));
  }
  await b.close();
})();
