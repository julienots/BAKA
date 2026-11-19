// Entrées : clavier, manette, tactile (joystick virtuel à gauche, boutons à droite)
export class Input {
  constructor() {
    this.keys = new Set();
    this.mx = 0; this.mz = 0; this.run = false;
    this.btn = { jump: false, act: false, power: false, swap: false, pause: false };
    this.prev = { ...this.btn };
    this.touchJoy = null; this.touchBtn = { jump: false, act: false, power: false, swap: false, pause: false };
    this.selectPower = -1;
    this.anyPressed = false;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.vibration = true;
    addEventListener('keydown', e => {
      if (e.repeat) return; this.keys.add(e.code); this.anyPressed = true;
      if (/^Digit[1-4]$/.test(e.code)) this.selectPower = +e.code.slice(5) - 1;
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }
  bindTouch(root) {
    this.ui = root;
    const joyZone = root.querySelector('#joyZone'), base = root.querySelector('#joyBase'), knob = root.querySelector('#joyKnob');
    let id = null, ox = 0, oy = 0;
    const R = () => base.offsetWidth * .5;
    joyZone.addEventListener('pointerdown', e => {
      id = e.pointerId; joyZone.setPointerCapture(id); ox = e.clientX; oy = e.clientY;
      base.style.left = ox + 'px'; base.style.top = oy + 'px'; base.classList.add('on'); this.touchJoy = { x: 0, y: 0 }; this.anyPressed = true;
      knob.style.transform = 'translate(-50%,-50%)';
    });
    joyZone.addEventListener('pointermove', e => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - ox, dy = e.clientY - oy; const r = R(), l = Math.hypot(dx, dy);
      if (l > r) { dx *= r / l; dy *= r / l; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.touchJoy = { x: dx / r, y: dy / r };
    });
    const end = e => { if (e.pointerId !== id) return; id = null; this.touchJoy = null; base.classList.remove('on'); knob.style.transform = 'translate(-50%,-50%)'; };
    joyZone.addEventListener('pointerup', end); joyZone.addEventListener('pointercancel', end);
    for (const name of ['jump', 'act', 'power', 'swap', 'pause']) {
      const el = root.querySelector('#b_' + name); if (!el) continue;
      el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); this.touchBtn[name] = true; el.classList.add('down'); this.anyPressed = true; this.vibrate(8); });
      const up = () => { this.touchBtn[name] = false; el.classList.remove('down'); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    }
  }
  vibrate(ms) { if (this.vibration && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }
  update() {
    const k = c => this.keys.has(c);
    let mx = (k('ArrowRight') || k('KeyD') ? 1 : 0) - (k('ArrowLeft') || k('KeyA') ? 1 : 0);
    let mz = (k('ArrowDown') || k('KeyS') ? 1 : 0) - (k('ArrowUp') || k('KeyW') || k('KeyZ') ? 1 : 0);
    let run = k('ShiftLeft') || k('ShiftRight');
    const b = {
      jump: k('Space'), act: k('KeyE') || k('Enter'), power: k('KeyF') || k('KeyR'), swap: k('Tab') || k('KeyC'), pause: k('Escape') || k('KeyP'),
    };
    // manette
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (Math.hypot(ax, ay) > .18) { mx = ax; mz = ay; run = run || Math.hypot(ax, ay) > .85; }
      const pb = i => p.buttons[i] && p.buttons[i].pressed;
      if (pb(14)) mx = -1; if (pb(15)) mx = 1; if (pb(12)) mz = -1; if (pb(13)) mz = 1;
      b.jump = b.jump || pb(0); b.act = b.act || pb(2); b.power = b.power || pb(1) || pb(7); b.swap = b.swap || pb(3) || pb(4) || pb(5); b.pause = b.pause || pb(9);
      if (pads.length && [0, 1, 2, 3, 9].some(pb)) this.anyPressed = true;
    }
    if (this.touchJoy) { mx = this.touchJoy.x; mz = this.touchJoy.y; run = Math.hypot(mx, mz) > .82; }
    for (const n in this.touchBtn) b[n] = b[n] || this.touchBtn[n];
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    this.mx = mx; this.mz = mz; this.run = run;
    this.prev = this.btn; this.btn = b;
  }
  pressed(n) { return this.btn[n] && !this.prev[n]; }
  released(n) { return !this.btn[n] && this.prev[n]; }
  held(n) { return this.btn[n]; }
  consumeSelect() { const s = this.selectPower; this.selectPower = -1; return s; }
}
