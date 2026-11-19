// Planche d'animation : capture image par image (rendu figé entre deux captures)
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 800, height: 450 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:4173/');
  await p.waitForFunction(() => window.__game);
  const seqs = [
    { name: 'run', setup: "g.startChapter(0,0,true); g.cine=null; g.player.state='normal'; g.player.control=true; g.player.place(4,0,.3,1); window.__freeze=true; g.rig.override={dist:3.4,height:.35,look:.7,fov:30,ahead:.2,ease:100}; for(let i=0;i<40;i++) step({},1,0,true);", frame: "for(let i=0;i<4;i++) step({},1,0,true);", n: 8 },
    { name: 'climb', setup: "g.startChapter(0,0,true); g.cine=null; g.player.state='normal'; g.player.control=true; g.player.place(26.6,0,0,1); window.__freeze=true; g.rig.override={dist:4.2,height:.6,look:.9,fov:32,ahead:.6,ease:100}; for(let i=0;i<20;i++) step({},1,0); step({jump:true},1,0);", frame: "for(let i=0;i<5;i++) step({},1,0);", n: 8 },
    { name: 'ladder', setup: "g.startChapter(0,4,true); g.cine=null; g.player.state='normal'; g.player.control=true; g.player.place(160.5,0,0,1); window.__freeze=true; g.rig.override={dist:4.5,height:1.2,look:1.2,fov:34,ahead:0,ease:100}; for(let i=0;i<5;i++) step({},0,-1);", frame: "for(let i=0;i<9;i++) step({},0,-1);", n: 8 },
  ];
  for (const sq of seqs) {
    await p.evaluate(s => { const g = window.__game, I = g.input; window.step = (btn = {}, mx = 0, mz = 0, run = false) => { I.mx = mx; I.mz = mz; I.run = run; I.botBtn = btn; g.stepNoInput(1 / 60); }; const step = window.step; g.settings.quality = 'medium'; eval(s); g.post.params.fade = 0; g.fadeTarget = 0; document.getElementById('titleCard').classList.add('hidden'); }, sq.setup);
    for (let k = 0; k < sq.n; k++) {
      await p.evaluate(f => { const g = window.__game, step = window.step; eval(f); g.post.params.fade = 0; g.rig.snap(g.camTarget(), g.world.camZones); g.render(0); }, sq.frame);
      await p.waitForTimeout(300);
      await p.screenshot({ path: `${out}/${sq.name}_${k}.png` });
    }
    console.log('ok', sq.name);
  }
  await b.close();
})();
