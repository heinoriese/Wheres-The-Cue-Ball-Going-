// Screen manager + title/char-select logic

const PLAYER_COLORS = [
  { hex: '#f5c518', glow: '#f5c51866', label: 'P1', name: 'PLAYER 1' },
  { hex: '#e63946', glow: '#e6394666', label: 'P2', name: 'PLAYER 2' },
  { hex: '#06d6a0', glow: '#06d6a066', label: 'P3', name: 'PLAYER 3' },
  { hex: '#9b30d0', glow: '#9b30d066', label: 'P4', name: 'PLAYER 4' },
];

const Screens = (() => {
  let playerCount = 2;

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + id).classList.add('active');
  }

  function initTitle() {
    const btn = document.getElementById('pressStartBtn');
    const activate = () => {
      Audio.playVirgo();
      show('playercount');
      initPlayerCount();
    };
    btn.addEventListener('click', activate);
    document.addEventListener('keydown', e => {
      if (document.getElementById('screen-title').classList.contains('active')) {
        if (['Enter', ' ', 'Return'].includes(e.key)) activate();
      }
    });
  }

  function initPlayerCount() {
    document.querySelectorAll('.count-btn').forEach(btn => {
      btn.classList.remove('selected');
      btn.addEventListener('click', () => {
        playerCount = parseInt(btn.dataset.count);
        show('charselect');
        buildCharSelect(playerCount);
      });
    });
  }

  function buildCharSelect(count) {
    const container = document.getElementById('player-cards-container');
    container.innerHTML = '';

    for (let i = 0; i < count; i++) {
      const c = PLAYER_COLORS[i];
      const card = document.createElement('div');
      card.className = 'player-card';
      card.style.setProperty('--player-color', c.hex);
      card.style.setProperty('--player-glow', c.glow);
      card.innerHTML = `
        <div class="player-card-title">${c.label}</div>
        <div class="player-avatar" style="background:${c.hex}">${c.label}</div>
        <input
          class="player-name-input"
          type="text"
          maxlength="12"
          placeholder="${c.name}"
          value="${c.name}"
          data-player="${i}"
        >
        <div class="player-lives-display">
          ${Array(5).fill('<div class="life-dot"></div>').join('')}
        </div>
      `;
      container.appendChild(card);
    }

    document.getElementById('startGameBtn').onclick = () => {
      const players = [];
      document.querySelectorAll('.player-name-input').forEach((inp, i) => {
        players.push({
          name: inp.value.trim() || PLAYER_COLORS[i].name,
          color: PLAYER_COLORS[i].hex,
          glow: PLAYER_COLORS[i].glow,
          label: PLAYER_COLORS[i].label,
          lives: 5,
          score: 0,
        });
      });
      show('game');
      Game.start(players);
    };
  }

  function showGameOver(players) {
    show('gameover');
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const board = document.getElementById('final-scoreboard');
    board.innerHTML = sorted.map((p, i) => `
      <div class="final-row ${i === 0 ? 'winner' : ''}" style="--player-color:${p.color}">
        <div class="final-rank">${['1ST','2ND','3RD','4TH'][i]}</div>
        <div class="final-name">${p.name}</div>
        <div class="final-score">${p.score} pts</div>
      </div>
    `).join('');

    document.getElementById('playAgainBtn').onclick = () => {
      show('title');
    };
  }

  return { show, initTitle, showGameOver };
})();

document.addEventListener('DOMContentLoaded', () => {
  Screens.initTitle();
});
