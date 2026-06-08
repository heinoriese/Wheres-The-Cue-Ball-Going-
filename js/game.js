// Core game loop, state machine, shot evaluation, scoring

const Game = (() => {
  const MAX_SPEED = 22;
  const VIRGO_INTERVAL_MS = 4000;

  let canvas, ctx;
  let players = [];
  let currentPlayerIdx = 0;
  let state = 'idle'; // idle | aiming | shooting | settling | gameover
  let aimAngle = 0;
  let shotBalls = [];       // balls that moved this shot
  let pottedThisShot = [];  // balls pocketed this shot
  let whitePottedThisShot = false;
  let lastVirgoTime = 0;
  let rafId = null;

  function start(playerList) {
    players = playerList.map(p => ({ ...p }));
    currentPlayerIdx = 0;
    state = 'idle';

    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    fitCanvas();
    window.addEventListener('resize', fitCanvas);

    Table.resize(canvas);
    Table.spawnBalls();

    Input.init(canvas);
    Input.setCallbacks({
      aim: onAim,
      powerStart: onPowerStart,
      powerEnd: onShoot,
      cancel: () => {},
    });

    HUD.init(players, currentPlayerIdx);
    loop();
  }

  function fitCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (Table) Table.resize(canvas);
  }

  function currentPlayer() { return players[currentPlayerIdx]; }

  function onAim(mx, my) {
    if (state !== 'idle' && state !== 'aiming') return;
    const cb = Table.getCueBall();
    if (!cb || !cb.active) return;
    aimAngle = Math.atan2(my - cb.y, mx - cb.x);
    state = 'aiming';
  }

  function onPowerStart() {
    if (state !== 'idle' && state !== 'aiming') return;
  }

  function onShoot(power) {
    if (state !== 'aiming') return;
    if (power < 0.02) return; // ignore accidental taps

    const cb = Table.getCueBall();
    if (!cb || !cb.active) return;

    pottedThisShot = [];
    whitePottedThisShot = false;
    shotBalls = [];
    state = 'shooting';

    Physics.shoot(cb, aimAngle, power, MAX_SPEED);
    Audio.playVirgo();
    lastVirgoTime = performance.now();
  }

  function onBallPocketed(ball) {
    if (ball.id === 'white') {
      whitePottedThisShot = true;
    } else {
      pottedThisShot.push(ball);
    }
  }

  function loop() {
    rafId = requestAnimationFrame(loop);
    update();
    render();
  }

  function update() {
    const balls = Table.getBalls();

    if (state === 'shooting' || state === 'settling') {
      Physics.step(balls, Table.getTableRect(), Table.getPockets(), onBallPocketed);

      // Periodic Virgo quip while balls roll
      const now = performance.now();
      if (now - lastVirgoTime > VIRGO_INTERVAL_MS) {
        Audio.playVirgo();
        lastVirgoTime = now;
      }

      if (Physics.areAllStopped(balls)) {
        state = 'settling';
        evaluateShot();
      }
    }

    // Gamepad aim support
    if (state === 'idle' || state === 'aiming') {
      const gp = Input.pollGamepad();
      if (gp && (Math.abs(gp.ax) > 0.15 || Math.abs(gp.ay) > 0.15)) {
        aimAngle = Math.atan2(gp.ay, gp.ax);
        state = 'aiming';
      }
    }

    // Update power bar
    if (Input.isCharging()) {
      HUD.setPower(Input.getChargeFraction());
    } else {
      HUD.setPower(0);
    }
  }

  function evaluateShot() {
    const player = currentPlayer();

    if (whitePottedThisShot && pottedThisShot.length > 0) {
      // Scored! White went in off a colour
      let pts = 0;
      for (const b of pottedThisShot) pts = Math.max(pts, b.points); // highest value colour pocketed with white
      player.score += pts;
      showResult(`+${pts}  IN OFF!`, 'pot');
      Audio.playVirgo();
      // Respawn cue ball & re-spot pocketed coloured balls
      Table.resetCueBall();
      respotColouredBalls(pottedThisShot);
      checkGameOver();
      nextPlayer();
    } else if (whitePottedThisShot && pottedThisShot.length === 0) {
      // Missed in-off (white went in but no colour)
      loseLife(player);
      showResult('IN THE JAWS!', 'miss');
      Table.resetCueBall();
      nextPlayer();
    } else if (!whitePottedThisShot && pottedThisShot.length > 0) {
      // Potted a colour without the white = foul
      loseLife(player);
      showResult('FOUL!', 'foul');
      respotColouredBalls(pottedThisShot);
      nextPlayer();
    } else {
      // Nothing potted = miss
      loseLife(player);
      showResult('MISS!', 'miss');
      nextPlayer();
    }

    HUD.update(players, currentPlayerIdx);
    state = 'idle';
  }

  function loseLife(player) {
    player.lives = Math.max(0, player.lives - 1);
  }

  function respotColouredBalls(bals) {
    // Put them back at their nominal positions (simplified: random spot on baulk half)
    for (const b of bals) {
      b.active = true;
      b.vx = 0; b.vy = 0;
      const tr = Table.getTableRect();
      // Each colour has a home spot; just put it near centre-right if home taken
      const home = getHomeSpot(b.id);
      b.x = home.x; b.y = home.y;
    }
  }

  function getHomeSpot(id) {
    const { x, y, w, h } = Table.getTableRect();
    const spots = {
      yellow: { x: x + w * 0.28, y: y + h * 0.62 },
      green:  { x: x + w * 0.28, y: y + h * 0.38 },
      brown:  { x: x + w * 0.28, y: y + h * 0.50 },
      blue:   { x: x + w * 0.50, y: y + h * 0.50 },
      pink:   { x: x + w * 0.70, y: y + h * 0.50 },
      black:  { x: x + w * 0.83, y: y + h * 0.50 },
      red:    { x: x + w * 0.75, y: y + h * 0.50 },
    };
    return spots[id] || { x: x + w * 0.6, y: y + h * 0.5 };
  }

  function nextPlayer() {
    // Skip players with no lives
    let checked = 0;
    do {
      currentPlayerIdx = (currentPlayerIdx + 1) % players.length;
      checked++;
    } while (players[currentPlayerIdx].lives <= 0 && checked < players.length);
    HUD.update(players, currentPlayerIdx);
  }

  function checkGameOver() {
    const alive = players.filter(p => p.lives > 0);
    if (alive.length <= 1) {
      setTimeout(() => {
        cancelAnimationFrame(rafId);
        Screens.showGameOver(players);
      }, 1800);
    }

    // Also: if no balls left on table except white = game over
    const remaining = Table.getBalls().filter(b => b.active && b.id !== 'white');
    if (remaining.length === 0) {
      setTimeout(() => {
        cancelAnimationFrame(rafId);
        Screens.showGameOver(players);
      }, 1800);
    }
  }

  function showResult(text, type) {
    const el = document.getElementById('shot-result');
    el.textContent = text;
    el.className = `shot-result ${type}`;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.add('hidden'), 2200);
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    Table.draw(ctx, canvas, aimAngle, state === 'aiming');
  }

  return { start };
})();
