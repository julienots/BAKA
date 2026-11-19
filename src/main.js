// Point d'entrée
import { Game } from './game/game.js';

function boot() {
  try {
    const game = new Game(document.getElementById('app'));
    window.__game = game;
  } catch (e) {
    console.error(e);
    document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#ccc;font:16px serif;text-align:center;padding:20px">Impossible de démarrer le rendu 3D.<br>${e.message}</div>`);
  }
}
boot();
