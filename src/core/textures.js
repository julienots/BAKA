// Textures procédurales générées sur canvas (aucun fichier externe)
import * as THREE from 'three';
import { rr, rnd, fbm, hash } from './util.js';

const cache = new Map();
export function canvasTex(key, size, draw, repeat = [1, 1], srgb = true) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}
function noiseFill(g, s, base, amp, scale, oct = 5, streakY = 1) {
  const img = g.createImageData(s, s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const n = fbm(x / scale, y / (scale * streakY), oct);
    const i = (y * s + x) * 4;
    img.data[i] = base[0] + (n - .5) * amp; img.data[i + 1] = base[1] + (n - .5) * amp; img.data[i + 2] = base[2] + (n - .5) * amp; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

export const T = {
  bark: () => canvasTex('bark', 256, (g, s) => {
    noiseFill(g, s, [70, 64, 60], 70, 14, 4, 6);
    g.globalAlpha = .35; g.strokeStyle = '#120f0e';
    for (let i = 0; i < 70; i++) { g.lineWidth = rr(.5, 2.5); const x = rnd() * s; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + rr(-8, 8), s * .3, x + rr(-8, 8), s * .7, x + rr(-6, 6), s); g.stroke(); }
  }, [2, 6]),
  rust: () => canvasTex('rust', 256, (g, s) => {
    noiseFill(g, s, [88, 52, 36], 90, 10, 4);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${rr(20, 60) | 0},${rr(14, 30) | 0},${rr(10, 20) | 0},${rr(.2, .6)})`; g.beginPath(); g.arc(rnd() * s, rnd() * s, rr(1, 9), 0, 7); g.fill(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(130,70,40,${rr(.1, .35)})`; g.fillRect(rnd() * s, rnd() * s, rr(2, 30), rr(1, 4)); }
  }, [1, 4]),
  dirt: () => canvasTex('dirt', 512, (g, s) => {
    noiseFill(g, s, [92, 82, 72], 80, 22, 5);
    for (let i = 0; i < 1800; i++) { const v = rr(30, 140) | 0; g.fillStyle = `rgba(${v},${v * .92 | 0},${v * .85 | 0},${rr(.2, .8)})`; g.beginPath(); g.arc(rnd() * s, rnd() * s, rr(.4, 2.6), 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(25,20,16,.5)';
    for (let i = 0; i < 60; i++) { g.lineWidth = rr(.5, 2); const x = rnd() * s, y = rnd() * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rr(-30, 30), y + rr(-6, 6)); g.stroke(); }
  }, [1, 1]),
  knit: () => canvasTex('knit', 128, (g, s) => {
    g.fillStyle = '#3a3c42'; g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 8) for (let y = 0; y < s; y += 6) {
      const h = hash(x, y) * 30;
      g.fillStyle = `rgb(${h + 70 | 0},${h + 72 | 0},${h + 80 | 0})`;
      g.beginPath(); g.ellipse(x + 2, y + 3, 2.2, 3.4, .5, 0, 7); g.fill();
      g.beginPath(); g.ellipse(x + 6, y + 3, 2.2, 3.4, -.5, 0, 7); g.fill();
    }
  }, [6, 3]),
  wool: () => canvasTex('wool', 128, (g, s) => {
    g.fillStyle = '#8a1414'; g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 6) for (let y = 0; y < s; y += 5) {
      g.fillStyle = `rgb(${170 + hash(x, y) * 60 | 0},${20 + hash(y, x) * 20 | 0},${20 + hash(y, x) * 20 | 0})`;
      g.beginPath(); g.ellipse(x + 1.5, y + 2.5, 1.6, 2.6, .5, 0, 7); g.fill();
      g.beginPath(); g.ellipse(x + 4.5, y + 2.5, 1.6, 2.6, -.5, 0, 7); g.fill();
    }
    g.fillStyle = 'rgba(235,220,200,.85)';
    for (let y = 18; y < s; y += 42) for (let x = 0; x < s; x += 10) { g.fillRect(x, y, 3, 3); g.fillRect(x + 5, y + 5, 3, 3); }
  }, [3, 1]),
  cloth: () => canvasTex('cloth', 256, (g, s) => { noiseFill(g, s, [40, 42, 48], 26, 3, 3); }, [3, 3]),
  plank: () => canvasTex('plank', 512, (g, s) => {
    for (let i = 0; i < 5; i++) {
      const y0 = i * s / 5, b = rr(58, 86);
      const img = g.createImageData(s, s / 5);
      for (let y = 0; y < s / 5; y++) for (let x = 0; x < s; x++) {
        const n = fbm(x / 60 + i * 9, y / 3, 4), k = (y * s + x) * 4, v = b + (n - .5) * 50;
        img.data[k] = v; img.data[k + 1] = v * .88; img.data[k + 2] = v * .74; img.data[k + 3] = 255;
      }
      g.putImageData(img, 0, y0);
      g.fillStyle = 'rgba(10,8,6,.9)'; g.fillRect(0, y0, s, 4);
      g.fillStyle = 'rgba(20,16,12,.9)';
      for (let n = 0; n < 2; n++) { g.beginPath(); g.arc(n ? s - 30 : 30, y0 + s / 10, 4, 0, 7); g.fill(); }
    }
  }),
  concrete: () => canvasTex('concrete', 512, (g, s) => {
    noiseFill(g, s, [96, 98, 100], 60, 30, 5);
    g.strokeStyle = 'rgba(20,20,22,.6)';
    for (let i = 0; i < 30; i++) { g.lineWidth = rr(.5, 1.5); let x = rnd() * s, y = rnd() * s; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += rr(-25, 25); y += rr(-25, 25); g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(30,28,26,${rr(.1, .4)})`; g.beginPath(); g.ellipse(rnd() * s, rnd() * s, rr(10, 60), rr(5, 30), rnd() * 3, 0, 7); g.fill(); }
  }),
  wallpaper: () => canvasTex('wallpaper', 512, (g, s) => {
    g.fillStyle = '#9fb0bc'; g.fillRect(0, 0, s, s);
    // petits motifs enfantins délavés
    const cols = ['#c98b7a', '#d9b56a', '#7e9cb3', '#a3b78a'];
    for (let y = 16; y < s; y += 48) for (let x = (y / 48 % 2) * 24 + 12; x < s; x += 48) {
      g.fillStyle = cols[(x + y) % 4]; g.globalAlpha = .55;
      g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 7, y + 6); g.lineTo(x - 7, y + 6); g.closePath(); g.fill();
      g.beginPath(); g.arc(x + 14, y + 16, 3.5, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
    // taches d'humidité
    for (let i = 0; i < 26; i++) { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, 'rgba(70,64,50,.35)'); gr.addColorStop(1, 'rgba(70,64,50,0)'); g.save(); g.translate(rnd() * s, rnd() * s); g.scale(rr(20, 90), rr(30, 140)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, 7); g.fill(); g.restore(); }
    for (let i = 0; i < 10; i++) { g.fillStyle = 'rgba(40,36,30,.5)'; g.fillRect(rnd() * s, 0, rr(1, 2), s); }
  }, [3, 1.5]),
  floorWood: () => canvasTex('floorWood', 512, (g, s) => {
    for (let i = 0; i < 8; i++) {
      const y0 = i * s / 8, b = rr(55, 80);
      const img = g.createImageData(s, s / 8);
      for (let y = 0; y < s / 8; y++) for (let x = 0; x < s; x++) {
        const n = fbm(x / 80 + i * 7, y / 4, 4), k = (y * s + x) * 4, v = b + (n - .5) * 40;
        img.data[k] = v; img.data[k + 1] = v * .86; img.data[k + 2] = v * .72; img.data[k + 3] = 255;
      }
      g.putImageData(img, 0, y0);
      g.fillStyle = 'rgba(8,6,4,.9)'; g.fillRect(0, y0, s, 3);
      g.fillRect((i * 137) % s, y0, 3, s / 8);
    }
  }, [6, 2]),
  grass: () => canvasTex('grass', 128, (g, s) => {
    g.clearRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      const x = rr(10, s - 10), w = rr(1, 3.5), hgt = rr(.4, 1) * s, bend = rr(-25, 25), v = rr(60, 120) | 0;
      g.strokeStyle = `rgb(${v},${v * .98 | 0},${v * .8 | 0})`; g.lineWidth = w;
      g.beginPath(); g.moveTo(x, s); g.quadraticCurveTo(x + bend * .3, s - hgt * .5, x + bend, s - hgt); g.stroke();
    }
  }),
  leaf: () => canvasTex('leaf', 64, (g, s) => {
    g.clearRect(0, 0, s, s); g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(s / 2, s / 2, s * .22, s * .42, .3, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(s * .4, s * .9); g.lineTo(s * .6, s * .1); g.stroke();
  }),
  soft: () => canvasTex('soft', 64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }),
  smoke: () => canvasTex('smoke', 128, (g, s) => {
    const img = g.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const dx = (x - s / 2) / (s / 2), dy = (y - s / 2) / (s / 2), r = Math.sqrt(dx * dx + dy * dy);
      const n = fbm(x / 18, y / 18, 4);
      const a = Math.max(0, 1 - r) * (n * 1.6 - .2);
      const k = (y * s + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.max(0, Math.min(255, a * 255));
    }
    g.putImageData(img, 0, 0);
  }),
};
