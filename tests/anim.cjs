// Planche d'animation : capture image par image (rendu figé entre deux captures)
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 800, height: 450 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:4173/');
  await p.waitForFunction(() => window.__game && window.__game.player.model.skin, null, { timeout: 120000 });
  const seqs = [
    { name: 'edge', setup: "g.startChapter(2,0,true); g.cine=null; g.player.state='normal'; g.player.control=true; g.player.place(25.82,1.7,-.9,1); window.__freeze=true; g.rig.override={dist:3.6,height:1.9,look:.7,fov:32,ahead:0,ease:100}; for(let i=0;i<30;i++) step({},0,0);", frame: "for(let i=0;i<6;i++) step({},0,0);", n: 8 },
    { name: 'tired', setup: "g.startChapter(0,0,true); g.cine=null; g.player.state='normal'; g.player.control=true; g.player.place(4,0,.3,1); window.__freeze=true; g.rig.override={dist:3.2,height:.4,look:.65,fov:30,ahead:0,ease:100}; g.player.exert=1; for(let i=0;i<40;i++) step({},1,0,true); for(let i=0;i<40;i++) step({},0,0); g.player.exert=1;", frame: "for(let i=0;i<6;i++) step({},0,0);", n: 8 },
    { name: 'jump', setup: "g.startChapter(0,0,true); g.cine=null; g.player.state='normal'; g.player.control=true; g.player.place(4,0,.3,1); window.__freeze=true; g.rig.override={dist:4.2,height:.6,look:.9,fov:32,ahead:0,ease:100}; for(let i=0;i<30;i++) step({},1,0,true); step({jump:true},1,0,true);", frame: "for(let i=0;i<5;i++) step({jump:true},1,0,true);", n: 10 },
    { name: 'jumpstand', setup: "g.startChapter(0,0,true); g.cine=null; g.player.state='normal'; g.player.control=true; g.player.place(6,0,.3,1); window.__freeze=true; g.rig.override={dist:3.6,height:.6,look:.9,fov:32,ahead:0,ease:100}; for(let i=0;i<30;i++) step({},0,0); step({jump:true},0,0);", frame: "for(let i=0;i<5;i++) step({jump:true},0,0);", n: 10 },
    { name: 'run', setup: "g.startChapter(0,0,true); g.cine=null; g.player.state='normal'; g.player.control=true; g.player.place(4,0,.3,1); window.__freeze=true; g.rig.override={dist:3.4,height:.35,look:.7,fov:30,ahead:-.6,ease:100}; for(let i=0;i<40;i++) step({},1,0,true);", frame: "for(let i=0;i<4;i++) step({},1,0,true);", n: 8 },
    { name: 'climb', setup: "window.__climbClip=true; g.startChapter(0,0,true); g.cine=null; g.player.state='normal'; g.player.control=true; g.player.place(26.6,0,0,1); window.__freeze=true; g.rig.override={dist:4.6,height:.8,look:.9,fov:32,ahead:.2,zLook:0,ease:100}; for(let i=0;i<20;i++) step({},1,0); step({jump:true},1,0);", frame: "for(let i=0;i<4;i++) step({},1,0);", n: 8 },
    { name: 'walk', setup: "g.startChapter(0,0,true); g.cine=null; g.player.state='normal'; g.player.control=true; g.player.place(4,0,.3,1); window.__freeze=true; g.rig.override={dist:3.4,height:.35,look:.7,fov:30,ahead:-.3,ease:100}; for(let i=0;i<40;i++) step({},1,0,false);", frame: "for(let i=0;i<5;i++) step({},1,0,false);", n: 8 },
    { name: 'idle', setup: "g.startChapter(0,0,true); g.cine=null; g.player.state='normal'; g.player.control=true; g.player.place(6,0,.3,1); window.__freeze=true; g.rig.override={dist:3.2,height:.4,look:.65,fov:30,ahead:0,ease:100}; for(let i=0;i<30;i++) step({},0,0);", frame: "for(let i=0;i<30;i++) step({},0,0);", n: 8 },
    { name: 'step', setup: "window.__climbClip=false; g.startChapter(0,0,true); g.cine=null; g.player.state='normal'; g.player.control=true; g.player.place(21.8,0,.3,1); window.__freeze=true; g.rig.override={dist:3.6,height:.4,look:.6,fov:30,ahead:0,ease:100}; for(let i=0;i<10;i++) step({},.5,0);", frame: "for(let i=0;i<7;i++) step({},.5,0);", n: 8 },
    { name: 'turn', setup: "g.startChapter(0,0,true); g.cine=null; g.player.state='normal'; g.player.control=true; g.player.place(6,0,.3,1); window.__freeze=true; g.rig.override={dist:3.2,height:.4,look:.6,fov:30,ahead:0,ease:100}; for(let i=0;i<30;i++) step({},0,0);", frame: "for(let i=0;i<5;i++) step({},-.12,0);", n: 8 },
    { name: 'ladder', setup: "g.startChapter(0,4,true); g.cine=null; g.player.state='normal'; g.player.control=true; g.player.place(160.5,0,0,1); window.__freeze=true; g.rig.override={dist:4.5,height:1.2,look:1.2,fov:34,ahead:0,ease:100}; for(let i=0;i<5;i++) step({},0,-1);", frame: "for(let i=0;i<9;i++) step({},0,-1);", n: 8 },
  ];
  for (const sq of seqs.filter(q => !process.argv[3] || process.argv[3].split(',').includes(q.name))) {
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
