// In-game HUD: player scores, lives, current turn, power bar

const HUD = (() => {
  let _players = [];
  let _current = 0;

  function init(players, currentIdx) {
    _players = players;
    _current = currentIdx;
    render();
  }

  function update(players, currentIdx) {
    _players = players;
    _current = currentIdx;
    render();
  }

  function setPower(fraction) {
    const fill = document.getElementById('power-bar-fill');
    if (fill) fill.style.width = (fraction * 100) + '%';
  }

  function render() {
    const container = document.getElementById('hud-players');
    if (!container) return;

    container.innerHTML = _players.map((p, i) => `
      <div class="hud-player ${i === _current ? 'active-player' : ''}"
           style="--player-color:${p.color}; --player-glow:${p.glow}">
        <div class="hud-player-name">${p.name}</div>
        <div class="hud-player-score">${p.score}</div>
        <div class="hud-player-lives">
          ${Array(5).fill(0).map((_, li) =>
            `<div class="hud-life ${li >= p.lives ? 'lost' : ''}"></div>`
          ).join('')}
        </div>
      </div>
    `).join('');

    const turnEl = document.getElementById('hud-turn-name');
    if (turnEl) {
      const p = _players[_current];
      turnEl.textContent = p ? p.name : '';
    }
  }

  return { init, update, setPower };
})();
