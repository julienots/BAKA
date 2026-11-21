// Son robuste : joue un chapitre en temps réel (beaucoup d'objets physiques), mesure la sortie, puis simule
// une coupure Android (contexte suspendu / fermé) et vérifie que la musique et les bruitages reviennent seuls.
const { chromium } = require('playwright');
(async () => {
  const ch = +(process.argv[2] || 1);
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (/audio/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  await p.goto('http://localhost:4173/'); await p.waitForFunction(() => window.__game);
  const r = await p.evaluate(async ch => {
    const g = window.__game, a = g.audio, sleep = ms => new Promise(r => setTimeout(r, ms));
    g.settings.quality = 'low'; a.init(); await a.ctx.resume();
    g.startChapter(ch, 0, true); g.cine = null; g.player.state = 'normal'; g.player.control = true; g.player.cine = null; g.state = 'play';
    const lvl = async (sec, run) => { const out = []; const t0 = performance.now();
      while (performance.now() - t0 < sec * 1000) { if (run) { g.input.mx = 1; g.input.run = true; } await sleep(250);
        const an = a.probe, d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d); let s = 0, nan = 0; for (const v of d) { if (!isFinite(v)) nan++; else s += v * v; }
        out.push(nan ? -999 : 20 * Math.log10(Math.sqrt(s / d.length) + 1e-9)); }
      const ok = out.filter(v => v > -60).length; return { avg: (out.reduce((x, y) => x + y, 0) / out.length).toFixed(1), audible: ok + '/' + out.length, state: a.ctx.state }; };
    const R = {};
    R.jeu = await lvl(12, true);
    // coupure : Android suspend le contexte sans prévenir (appel, notification, casque)
    await a.ctx.suspend(); await sleep(300); R.apresSuspend = await lvl(4, true);
    // pire cas : le contexte meurt
    await a.ctx.close(); await sleep(300); R.apresFermeture = await lvl(5, true);
    // horloge figée sans changement d'état (sortie audio perdue) : simulée en gelant la mesure
    a.wd.last = a.ctx.currentTime + 1e6; R.horlogeFigee = await lvl(4, true);
    R.reconstructions = a.rebuilds || 0; return R;
  }, ch);
  console.log(JSON.stringify(r, null, 1)); console.log('erreurs:', errs.slice(0, 8)); await b.close();
})();
