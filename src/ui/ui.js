// Interface : menus, options, cartes de titre, souvenirs, générique, commandes tactiles
import { POWERS } from '../game/powers.js';

const $ = s => document.querySelector(s);

export class UI {
  constructor(game) {
    this.game = game;
    this.screens = ['menu', 'options', 'pause', 'chapters'].reduce((o, k) => (o[k] = $('#' + k), o), {});
    this.back = 'menu';
    $('#m_play').onclick = () => game.newGame();
    $('#m_continue').onclick = () => game.continueGame();
    $('#m_options').onclick = () => this.show('options', 'menu');
    $('#m_chapters').onclick = () => { this.buildChapters(); this.show('chapters', 'menu'); };
    $('#p_resume').onclick = () => game.resume();
    $('#p_options').onclick = () => this.show('options', 'pause');
    $('#p_menu').onclick = () => game.toMenu();
    document.querySelectorAll('.back').forEach(b => b.onclick = () => this.show(this.back));
    // options
    const s = game.settings;
    const q = $('#o_quality'); q.value = s.quality; q.onchange = () => { s.quality = q.value; game.applySettings(true); };
    for (const [id, key] of [['#o_master', 'master'], ['#o_music', 'music'], ['#o_sfx', 'sfx']]) { const el = $(id); el.value = s[key]; el.oninput = () => { s[key] = +el.value; game.applySettings(); }; }
    const br = $('#o_bright'); br.value = s.bright; br.oninput = () => { s.bright = +br.value; game.applySettings(); };
    const fm = $('#o_film'); fm.checked = s.film; fm.onchange = () => { s.film = fm.checked; game.applySettings(); };
    const v = $('#o_vib'); v.checked = s.vibration; v.onchange = () => { s.vibration = v.checked; game.applySettings(); };
    const c = $('#o_ctrl'); c.value = s.ctrl; c.oninput = () => { s.ctrl = +c.value; game.applySettings(); };
    $('#m_hint').textContent = game.input.isTouch ? 'Touchez pour commencer' : 'Clavier · Manette';
    this.updateMenu();
    // navigation clavier/manette dans les menus
    this.menuIdx = 0;
  }
  updateMenu() { $('#m_continue').disabled = !this.game.save.started; $('#m_chapters').disabled = !this.game.save.started; }
  show(name, back) {
    for (const k in this.screens) this.screens[k].classList.toggle('hidden', k !== name);
    if (back) this.back = back;
    this.menuIdx = 0; this.focusFirst();
  }
  hideAll() { for (const k in this.screens) this.screens[k].classList.add('hidden'); }
  focusFirst() { const btns = this.visibleButtons(); btns.forEach((b, i) => b.classList.toggle('sel', i === this.menuIdx)); }
  visibleButtons() { for (const k in this.screens) if (!this.screens[k].classList.contains('hidden')) return [...this.screens[k].querySelectorAll('button:not(:disabled)')]; return []; }
  navigate(input) {
    const btns = this.visibleButtons(); if (!btns.length) return;
    if (!this._navT) this._navT = 0;
    this._navT -= 1 / 60;
    if (Math.abs(input.mz) > .5 && this._navT <= 0) { this.menuIdx = (this.menuIdx + (input.mz > 0 ? 1 : -1) + btns.length) % btns.length; this._navT = .22; this.focusFirst(); this.game.audio.play('chime'); }
    if (Math.abs(input.mz) < .3) this._navT = 0;
    if (input.pressed('jump') || input.pressed('act')) { const b = btns[this.menuIdx]; if (b) b.click(); }
  }
  buildChapters() {
    const list = $('#chapList'); list.innerHTML = '';
    this.game.chapterDefs.forEach((ch, i) => {
      const b = document.createElement('button'); b.textContent = `${['I', 'II', 'III', 'IV', 'V'][i]}. ${ch.title}`; b.disabled = i > this.game.save.maxChapter;
      b.onclick = () => this.game.startChapter(i, 0, true); list.appendChild(b);
    });
  }
  touch(on) { $('#touch').classList.toggle('hidden', !on); }
  setCtrlSize(k) { document.documentElement.style.setProperty('--ctrl', k); }
  titleCard(num, name, sub) {
    const el = $('#titleCard'); el.classList.add('hidden'); void el.offsetWidth;
    el.querySelector('.num').textContent = num; el.querySelector('.name').textContent = name; el.querySelector('.sub').textContent = sub;
    el.classList.remove('hidden'); clearTimeout(this._tc); this._tc = setTimeout(() => el.classList.add('hidden'), 6000);
  }
  memory(id) {
    const el = $('#memory'), cv = el.querySelector('canvas'), g = cv.getContext('2d');
    drawMemory(g, id, cv.width, cv.height);
    el.classList.add('hidden'); void el.offsetWidth; el.classList.remove('hidden');
    clearTimeout(this._mt); this._mt = setTimeout(() => el.classList.add('hidden'), 5500);
  }
  setPower(p) {
    const any = p.any(), btn = $('#b_power');
    btn.classList.toggle('locked', !any);
    $('#b_swap').classList.toggle('locked', p.unlocked.filter(Boolean).length < 2);
    $('#powIcon').style.color = POWERS[p.cur].color;
  }
  setPowerState(p) {
    const cd = [1.0, 1.1, 2, .85][p.cur]; let k = p.cool[p.cur] / cd;
    if (p.cur === 2) k = Math.max(k, 1 - p.echoEnergy);
    $('#powCool').style.transform = `scaleY(${Math.max(0, Math.min(1, k))})`;
  }
  credits(allMemories) {
    const el = $('#credits'); el.innerHTML = '';
    const roll = document.createElement('div'); roll.className = 'roll';
    roll.innerHTML = `<p class="big">LE MANTEAU ROUGE</p>
      <h3>Une histoire de Mio</h3><p>et de sa petite sœur</p>
      <h3>Direction artistique, code, musique</h3><p>générés entièrement en temps réel</p>
      <h3>Chapitres</h3><p>La Forêt morte — le déni</p><p>L'Usine — la colère</p><p>La Maison — le marchandage</p><p>Le Marais — la tristesse</p><p>La Colline — l'acceptation</p>
      <h3>Souvenirs retrouvés</h3><p>${allMemories}</p>
      <h3>&nbsp;</h3><p>À ceux qui portent encore un manteau qui n'est pas le leur.</p><p>Merci d'avoir joué.</p>`;
    el.appendChild(roll); el.classList.remove('hidden');
    return new Promise(res => { const done = () => { el.classList.add('hidden'); res(); }; roll.addEventListener('animationend', done); el.onclick = done; });
  }
  rotateHint(on) { $('#rotate').classList.toggle('hidden', !on); }
}

// Illustrations des souvenirs (dessins d'enfant)
function drawMemory(g, id, W, H) {
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#e9e1cf'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(120,100,70,${Math.random() * .06})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  const crayon = (col, w = 4) => { g.strokeStyle = col; g.fillStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; };
  const wob = (x, y) => [x + (Math.random() - .5) * 2, y + (Math.random() - .5) * 2];
  const line = pts => { g.beginPath(); pts.forEach((p, i) => { const [x, y] = wob(...p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); };
  const circle = (x, y, r) => { g.beginPath(); for (let a = 0; a <= 6.4; a += .2) { const [px, py] = wob(x + Math.cos(a) * r, y + Math.sin(a) * r); a ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); };
  const kid = (x, y, s, coat) => {
    crayon('#333', 4); circle(x, y, 22 * s); line([[x, y + 22 * s], [x, y + 80 * s]]); line([[x - 30 * s, y + 45 * s], [x + 30 * s, y + 45 * s]]); line([[x, y + 80 * s], [x - 20 * s, y + 120 * s]]); line([[x, y + 80 * s], [x + 20 * s, y + 120 * s]]);
    if (coat) { crayon(coat, 10); line([[x - 18 * s, y + 30 * s], [x - 25 * s, y + 90 * s], [x + 25 * s, y + 90 * s], [x + 18 * s, y + 30 * s], [x - 18 * s, y + 30 * s]]); }
    crayon('#333', 3); g.beginPath(); g.arc(x - 7 * s, y - 4 * s, 2.5, 0, 7); g.arc(x + 7 * s, y - 4 * s, 2.5, 0, 7); g.fill(); g.beginPath(); g.arc(x, y + 6 * s, 9 * s, .2, 2.9); g.stroke();
  };
  if (id === 'dessin') {
    crayon('#e0b030', 5); circle(420, 70, 34); for (let a = 0; a < 6.3; a += .6) line([[420 + Math.cos(a) * 44, 70 + Math.sin(a) * 44], [420 + Math.cos(a) * 62, 70 + Math.sin(a) * 62]]);
    crayon('#6a8a4a', 5); line([[0, 330], [W, 320]]);
    kid(170, 160, 1, '#2a2a3a'); kid(280, 190, .8, '#c42a20');
    crayon('#333', 3); line([[200, 205], [255, 225]]);
    crayon('#c42a20', 3); g.font = '28px cursive'; g.fillText('moi', 150, 320); g.fillText('ma sœur', 245, 340);
  } else if (id === 'boite') {
    crayon('#7a5030', 6); line([[150, 220], [360, 220], [360, 320], [150, 320], [150, 220]]); line([[150, 220], [190, 130], [400, 130], [360, 220]]);
    crayon('#333', 3); for (let i = 0; i < 6; i++) { const x = 200 + i * 30, y = 90 - Math.sin(i) * 30; g.beginPath(); g.ellipse(x, y, 8, 6, -.3, 0, 7); g.fill(); line([[x + 7, y], [x + 7, y - 35]]); }
    kid(90, 180, .7, '#c42a20');
  } else if (id === 'lapin') {
    crayon('#9a948a', 5); circle(256, 220, 70); circle(256, 120, 45); line([[230, 85], [215, 10], [245, 80]]); line([[280, 85], [295, 10], [268, 80]]);
    crayon('#333', 3); g.beginPath(); g.arc(240, 115, 4, 0, 7); g.arc(272, 115, 4, 0, 7); g.fill();
    crayon('#c42a20', 4); line([[160, 330], [350, 330]]); g.font = '26px cursive'; g.fillText('Pompon', 205, 365);
  } else if (id === 'moufle') {
    crayon('#c42a20', 8); line([[180, 300], [180, 160], [230, 120], [280, 160], [280, 300], [180, 300]]); line([[280, 220], [330, 190], [330, 240], [280, 260]]);
    crayon('#fff', 6); line([[180, 290], [280, 290]]);
    crayon('#a0c0e0', 3); for (let i = 0; i < 30; i++) { const x = Math.random() * W, y = Math.random() * H; line([[x - 5, y], [x + 5, y]]); line([[x, y - 5], [x, y + 5]]); }
  } else {
    crayon('#5a4030', 8); line([[110, 50], [400, 50], [400, 340], [110, 340], [110, 50]]);
    kid(200, 120, 1, '#2a2a3a'); kid(310, 140, .85, '#c42a20');
    crayon('#e0b030', 4); line([[130, 320], [380, 320]]);
  }
}
