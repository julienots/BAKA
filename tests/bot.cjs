// Robot de test : joue chaque chapitre du début à la fin (physique réelle, sans rendu)
// usage : node tests/bot.cjs <chapitre 0-4> [capture.png]
const { chromium } = require('playwright');

const SCRIPTS = {
  0: [
    ['goto', 12, -1.9], ['goto', 18, -1.9], ['goto', 26, 0], ['goto', 31, 0], ['goto', 36, 0],
    ['goto', 39.2, -.2], ['goto', 45.2, .2], ['goto', 47, .2], ['goto', 47.5, .2], ['goto', 59, 0], ['goto', 63, 0],
    ['goto', 65.9, -1.55], ['act'], ['wait', 1],
    ['goto', 99.0, .7], ['hold', 1.6], ['goto', 104, 0], ['wait', 1],
    ['goto', 111.6, -.1], ['act'], ['wait', 2.6],
    ['goto', 121, 0], ['wait', 1.5], ['power', 1.0], ['wait', .5], ['goto', 129.5, 0], ['power', 1.0], ['wait', 2], ['power', 1.0], ['wait', 1.5],
    ['goto', 141, -1], ['goto', 146, -1], ['goto', 150, -1], ['goto', 158, 0], ['goto', 174, 0],
  ],
  1: [
    ['goto', 27.6, -1.5], ['goto', 33.4, -1.5], ['goto', 34.2, -1.5], ['goto', 35, -1.5], ['goto', 42.6, -1.6], ['act'], ['wait', 2.5],
    ['goto', 47, -1.6], ['goto', 50, 0], ['wait', 1.5],
    ['goto', 57.5, 1.9], ['waitlight', 63.5], ['goto', 63.5, 1.9], ['waitlight', 69.5], ['goto', 69.5, 1.9], ['waitlight', 75.5], ['goto', 75.5, 1.9], ['waitlight', 81.5], ['goto', 81.5, 1.9], ['waitlight', 87], ['goto', 87, 1.9], ['waitlight', 92], ['goto', 93, 0],
    ['goto', 94.4, -.4], ['act'], ['wait', 2.5],
    ['goto', 101.5, -1.83], ['pushto', 113.5],
    ['report'], ['goto', 118, 0], ['wait', 3], ['goto', 122, 0], ['goto', 126, 0], ['goto', 139, 0], ['goto', 149.5, 0], ['goto', 155, 0], ['goto', 169, 0],
  ],
  2: [
    ['goto', 19.2, -.8], ['goto', 20.2, -.8], ['goto', 21.5, -.8], ['goto', 25, -1.2], ['act'], ['wait', 1], ['goto', 26.5, -1], ['goto', 31, 0], ['wait', 2.5],
    ['goto', 39.6, -.1], ['waithand', 50], ['goto', 50, .4], ['waithand', 57.2], ['goto', 57.2, 0], ['waithand', 66], ['goto', 66, 0],
    ['goto', 73.5, -1.6], ['act'], ['wait', 2.5],
    ['goto', 81.5, -.6], ['echo', 0, .4], ['goto', 83.4, -.6, true], ['goto', 85, -.6, true], ['goto', 86.6, -.6, true], ['goto', 88.4, -.6, true], ['echo', 1],
    ['goto', 96, -1], ['act'], ['wait', 1], ['goto', 108, 0],
    ['waithand', 121.5], ['goto', 121.5, 0], ['waithand', 128], ['goto', 128, 0], ['waithand', 140], ['goto', 140, 0], ['goto', 147, 0],
  ],
  3: [
    ['goto', 8.6, -1], ['act'], ['wait', 2.5], ['goto', 13, 0],
    ['goto', 21.6, .2], ['dash', 1, .6], ['wait', .4], ['goto', 30.5, 1.8], ['dash', 1, -1], ['wait', .4], ['goto', 41.6, -.6], ['dash', 1, .2], ['wait', .3], ['goto', 46, .2],
    ['goto', 49.5, 0], ['dash', 1, 0], ['wait', .5], ['goto', 59.6, 0], ['dash', 1, 0], ['wait', .3],
    ['power-sel', 0], ['goto', 64.5, 0], ['lueurnear', 5.5], ['lueurnear', 5.5], ['wait', 1], ['goto', 68, 0], ['power', 1], ['wait', 1.5], ['goto', 75, 0], ['power', 1], ['wait', 1.5], ['goto', 82.1, -2.0], ['act'], ['wait', 1], ['goto', 84.5, 0],
    ['jumpto', 87, 0], ['goto', 96, 0], ['wait', 1.5], ['goto', 107.2, 0], ['power-sel', 3], ['dash', 1, 0], ['wait', .6], ['goto', 120, 0], ['goto', 166, 0],
  ],
  4: [
    ['goto', 37, 0], ['wait', .5], ['power-sel', 0], ['power', 1], ['wait', 3], ['goto', 47, 0],
    ['goto', 60.7, -1.2], ['echo', 0, .3], ['goto', 61.6, -2.3, true], ['goto', 62.9, -2.3, true], ['goto', 64.4, -2.3, true], ['act'], ['echo', 1], ['wait', 1],
    ['goto', 66, 0], ['goto', 79.5, 0], ['goto', 83, 0], ['goto', 87, 0], ['goto', 98.8, -.6], ['act'], ['wait', 1], ['goto', 110, 0], ['act'], ['wait', 4],
  ],
};

(async () => {
  const ch = +(process.argv[2] || 0), shot = process.argv[3];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await p.goto('http://localhost:4173/?bot');
  await p.waitForFunction(() => window.__game, null, { timeout: 60000 });
  const res = await p.evaluate(([ch, script]) => {
    const g = window.__game, I = g.input; g.settings.quality = 'low';
    g.startChapter(ch, 0, true); g.cine = null; g.player.state = 'normal'; g.player.control = true; g.player.cine = null; g.rig.override = null;
    let deaths = 0, log = [];
    const origDie = g.player.die.bind(g.player);
    g.player.die = c => { const r = origDie(c); if (r) { deaths++; log.push(`MORT (${c}) à x=${g.player.pos.x.toFixed(1)} z=${g.player.pos.z.toFixed(1)}`); } return r; };
    const P = () => g.player;
    const step = (btn = {}, mx = 0, mz = 0, run = false) => { I.mx = mx; I.mz = mz; I.run = run; I.botBtn = btn; g.stepNoInput(1 / 60); };
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    for (const cmd of script) {
      const [op, a, b2, c2] = cmd;
      if (g.chapter !== ch) break;
      if (op === 'goto') {
        let t = 0, stuck = 0, jumpT = 0, ok = false;
        while (t < 25) {
          const p = P(); if (p.state === 'dead') { step(); t += 1 / 60; continue; }
          const dx = a - p.pos.x, dz = b2 - p.pos.z;
          if (Math.abs(dx) < .25 && Math.abs(dz) < .25) { ok = true; break; }
          const mx = clamp(dx * 3, -1, 1), mz = clamp(dz * 3, -1, 1);
          const moving = Math.hypot(p.vel.x, p.vel.z) > .4;
          stuck = moving || p.state !== 'normal' ? 0 : stuck + 1 / 60;
          let jump = false; if (stuck > .25 && jumpT <= 0) { jump = true; jumpT = .5; stuck = 0; }
          jumpT -= 1 / 60;
          step({ jump, power: !!c2 && g.powers.cur === 2 }, mx, mz, true); t += 1 / 60;
        }
        if (c2) log.push(`echo-goto ${a}: x=${P().pos.x.toFixed(2)} y=${P().pos.y.toFixed(2)} echoT=${g.world.echoT.toFixed(2)} en=${g.powers.echoEnergy.toFixed(2)} t=${t.toFixed(2)}`);
        if (!ok) log.push(`bloqué en allant vers x=${a} z=${b2} : pos x=${P().pos.x.toFixed(2)} y=${P().pos.y.toFixed(2)} z=${P().pos.z.toFixed(2)}`);
      } else if (op === 'jumpto') {
        for (let i = 0; i < 90; i++) { const p = P(); const dx = a - p.pos.x; step({ jump: i === 2 || i === 3 }, clamp(dx * 3, -1, 1), clamp((b2 - p.pos.z) * 3, -1, 1), true); }
      } else if (op === 'act') { step({ act: true }); step({}); }
      else if (op === 'hold') { for (let i = 0; i < a * 60; i++) step({ act: true }); }
      else if (op === 'wait') { for (let i = 0; i < a * 60; i++) step({}); }
      else if (op === 'face') { step({}, a, 0); step({}, a, 0); }
      else if (op === 'power') { for (let i = 0; i < Math.max(2, a * 60); i++) step({ power: true }); step({}); }
      else if (op === 'power-sel') { I.selectPower = a; step({}); }
      else if (op === 'dash') { I.selectPower = 3; step({}); step({ power: true }, a, b2, true); for (let i = 0; i < 30; i++) step({}, a, b2, true); }
      else if (op === 'echo') { if (a === 0) { I.selectPower = 2; step({}); for (let i = 0; i < b2 * 60; i++) step({ power: true }); } else step({}); }
      else if (op === 'behind') { const c = g.world.entities.find(e => e.heavy); const tx = c.pos.x - 1.25; let t = 0; while (t < 8 && Math.abs(P().pos.x - tx) > .2) { step({}, clamp((tx - P().pos.x) * 3, -1, 1), clamp((c.pos.z - P().pos.z) * 3, -1, 1)); t += 1 / 60; } step({}, 1, 0); step({}, 1, 0); }
      else if (op === 'waitlight') { const pr = g.enemies.find(e => e.kind === 'presence'); let t = 0; while (t < 20 && pr && pr.active && (Math.abs(pr.look.x - a) < 5 || Math.abs(pr.look.x - P().pos.x) < 4)) { step({}); t += 1 / 60; } }
      else if (op === 'pushto') {
        const c = g.world.entities.find(e => e.heavy);
        for (let k = 0; k < 12 && Math.abs(c.pos.x - a) > .45; k++) {
          const side = c.pos.x < a ? -1 : 1, tx = c.pos.x + side * 1.3; let t = 0;
          while (t < 8 && Math.abs(P().pos.x - tx) > .2) { step({}, clamp((tx - P().pos.x) * 3, -1, 1), clamp((c.pos.z - P().pos.z) * 3, -1, 1)); t += 1 / 60; }
          step({}, -side, 0); step({}, -side, 0); step({ power: true }); for (let i = 0; i < 80; i++) step({});
        }
        log.push('caisse finale x=' + c.pos.x.toFixed(2));
      }
      else if (op === 'waithand') { let t = 0; const hands = g.enemies.filter(e => e.kind === 'hand' && e.active); const x0 = Math.min(P().pos.x, a) - 1.5, x1 = Math.max(P().pos.x, a) + 1.5; while (t < 25 && hands.some(h => h.tip.x > x0 && h.tip.x < x1 && h.tip.y < 2)) { step({}); t += 1 / 60; } if (t >= 25) log.push('attente main trop longue'); }
      else if (op === 'lueurnear') { let t = 0; const near = () => g.enemies.filter(e => e.kind === 'wolf' && e.state === 'chase' && !(e.scared > 0)).some(e => e.pos.distanceTo(P().pos) < a); const any = () => g.enemies.some(e => e.kind === 'wolf' && (e.state === 'chase' || e.state === 'approach') && !(e.scared > 0) && e.pos.distanceTo(P().pos) < 20); while (t < 6 && any() && !near()) { step({ power: true }); t += 1 / 60; } log.push(`lueurnear t=${t.toFixed(2)} any=${any()} near=${near()} cur=${g.powers.cur} cast=${g.powers.casting} k=${g.powers.castK.toFixed(2)} x=${P().pos.x.toFixed(1)} st=${P().state}`); if (any()) { for (let i = 0; i < 20; i++) step({ power: true }); } step({}); log.push('  -> ' + g.enemies.filter(e => e.kind === 'wolf').map(w => w.state + ' sc' + (w.scared || 0).toFixed(1) + ' d' + w.pos.distanceTo(P().pos).toFixed(1)).join(' ')); for (let i = 0; i < 30; i++) step({}); }
      else if (op === 'report') log.push(`rapport : pos x=${P().pos.x.toFixed(2)} ; ` + g.world.entities.filter(e => e.heavy).map(e => 'caisse x=' + e.pos.x.toFixed(2) + ' z=' + e.pos.z.toFixed(2)).join(' ') + ' ; porte=' + (g.world.byId.gateC ? g.world.byId.gateC.open : '-'));
    }
    return { deaths, log, x: P().pos.x, chapter: g.chapter, mem: g.save.memories, powers: g.powers.unlocked };
  }, [ch, SCRIPTS[ch]]);
  await p.waitForTimeout(3500);
  const after = await p.evaluate(() => ({ chapter: window.__game.chapter, state: window.__game.state }));
  console.log(JSON.stringify({ ...res, after }, null, 1));
  if (shot) await p.screenshot({ path: shot });
  console.log(errs.slice(0, 10).join('\n'));
  await b.close();
})();
