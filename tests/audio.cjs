// Vérifie que chaque son et chaque mode musical se construit sans erreur
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:4173/'); await p.waitForFunction(() => window.__game);
  const r = await p.evaluate(async () => {
    const a = window.__game.audio; a.init(); a.ctx.resume();
    const names = ['jump', 'land', 'breath', 'climb', 'grabLedge', 'ladder', 'scrape', 'lever', 'gate', 'latch', 'crash', 'howl', 'growl', 'pant', 'paw', 'bite', 'death', 'memory', 'unlock', 'lueurCharge', 'lueur', 'souffle', 'echoOn', 'echoOff', 'dash', 'grab', 'groan', 'stomp', 'knuckles', 'ghost', 'drip', 'creak', 'clank', 'steam', 'tick', 'bird', 'crow', 'splash', 'chime', 'thunder'];
    const bad = [];
    for (const n of names) { try { a.play(n, { x: Math.random() * 10 }); } catch (e) { bad.push(n + ': ' + e.message); } }
    for (const s of ['dirt', 'wood', 'metal', 'water', 'grass', 'concrete', 'stone']) { try { a.step(s, true); } catch (e) { bad.push('step ' + s + ': ' + e.message); } }
    for (let ch = 0; ch < 6; ch++) try { a.setChapter(ch); } catch (e) { bad.push('chap ' + ch + e.message); }
    a.setMood('calm'); a.playLullaby(1, 1);
    const t0 = performance.now();
    try { for (let i = 0; i < 400; i++) { a.update(1 / 60, { danger: i > 200 ? .7 : 0, chase: i > 300, exert: .6 }); } } catch (e) { bad.push('update: ' + e.message); }
    await new Promise(r => setTimeout(r, 1500));
    return { bad, state: a.ctx.state, ms: (performance.now() - t0).toFixed(0) };
  });
  console.log(JSON.stringify(r), errs.slice(0, 5));
  await b.close();
})();
