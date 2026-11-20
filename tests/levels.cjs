// Niveaux sonores : RMS de la musique (calme, danger) comparée aux pas et à l'ambiance
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:4173/'); await p.waitForFunction(() => window.__game);
  const r = await p.evaluate(async () => {
    const a = window.__game.audio; a.init(); await a.ctx.resume(); a.setChapter(0);
    const meter = node => { const an = a.ctx.createAnalyser(); an.fftSize = 2048; node.connect(an); return an; };
    const M = meter(a.music), S = meter(a.sfx), A = meter(a.amb);
    const rms = an => { const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d); let s = 0; for (const v of d) s += v * v; return Math.sqrt(s / d.length); };
    const run = async (mood, sec, steps) => { a.setMood(mood); a.nextChord = 0; const acc = { m: [], s: [], a: [] }; const t0 = performance.now(); let k = 0;
      while (performance.now() - t0 < sec * 1000) { a.update(1 / 30, { danger: mood === 'silence' ? .3 : 0 }); if (steps && k++ % 12 === 0) a.step('dirt', false); await new Promise(r => setTimeout(r, 33)); acc.m.push(rms(M)); acc.s.push(rms(S)); acc.a.push(rms(A)); }
      const avg = x => x.reduce((p, v) => p + v, 0) / x.length, db = v => (20 * Math.log10(v + 1e-9)).toFixed(1);
      return { music: db(avg(acc.m)), sfx: db(avg(acc.s)), amb: db(avg(acc.a)) }; };
    return { calme: await run('calm', 10, true), danger: await run('silence', 8, false) };
  });
  console.log(JSON.stringify(r)); await b.close();
})();
