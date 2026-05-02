// Snooker table layout, rendering, and ball definitions

const Table = (() => {
  // Snooker ball points & colours (reversed game: pot white off these)
  const BALL_DEFS = [
    { id: 'red',    color: '#cc1111', points: 1,  label: '1' },
    { id: 'yellow', color: '#e8d000', points: 2,  label: '2' },
    { id: 'green',  color: '#1db954', points: 3,  label: '3' },
    { id: 'brown',  color: '#7b4b2a', points: 4,  label: '4' },
    { id: 'blue',   color: '#1565c0', points: 5,  label: '5' },
    { id: 'pink',   color: '#e91e8c', points: 6,  label: '6' },
    { id: 'black',  color: '#111111', points: 7,  label: '7' },
  ];

  let W = 0, H = 0, BALL_R = 0;
  let tableRect = null;   // playable inner area
  let pockets = [];
  let balls = [];
  let cueBall = null;

  function resize(canvas) {
    // Landscape: table fills most of canvas below HUD
    const HUD_H = 60;
    const aspect = 1.83; // snooker table ~3.57m x 1.78m
    let tw = canvas.width * 0.94;
    let th = tw / aspect;
    if (th > canvas.height - HUD_H - 20) {
      th = canvas.height - HUD_H - 20;
      tw = th * aspect;
    }
    W = tw; H = th;

    const ox = (canvas.width - W) / 2;
    const oy = HUD_H + (canvas.height - HUD_H - H) / 2;

    BALL_R = W * 0.018;

    // Cushion thickness
    const cush = W * 0.042;
    tableRect = { x: ox + cush, y: oy + cush, w: W - cush * 2, h: H - cush * 2 };

    buildPockets(ox, oy, cush);
    return { ox, oy, cush };
  }

  function buildPockets(ox, oy, cush) {
    const pr = cush * 0.72;
    pockets = [
      { x: ox + cush,         y: oy + cush,         r: pr }, // top-left
      { x: ox + W / 2,        y: oy,                r: pr * 0.85 }, // top-mid
      { x: ox + W - cush,     y: oy + cush,         r: pr }, // top-right
      { x: ox + cush,         y: oy + H - cush,     r: pr }, // bot-left
      { x: ox + W / 2,        y: oy + H,            r: pr * 0.85 }, // bot-mid
      { x: ox + W - cush,     y: oy + H - cush,     r: pr }, // bot-right
    ];
  }

  function spawnBalls() {
    balls = [];
    const { x, y, w, h } = tableRect;

    // Cue ball - left quarter, middle height
    cueBall = {
      id: 'white', color: '#f5f0e8',
      x: x + w * 0.22, y: y + h / 2,
      vx: 0, vy: 0, r: BALL_R, active: true, points: 0,
    };
    balls.push(cueBall);

    // Place coloured balls in a scattered but seeded layout
    const positions = getColouredPositions(x, y, w, h);
    BALL_DEFS.forEach((def, i) => {
      // Place multiple reds
      if (def.id === 'red') {
        for (let r = 0; r < 6; r++) {
          balls.push({
            ...def,
            x: positions.reds[r].x, y: positions.reds[r].y,
            vx: 0, vy: 0, r: BALL_R, active: true,
          });
        }
      } else {
        const pos = positions.colours[def.id];
        balls.push({
          ...def,
          x: pos.x, y: pos.y,
          vx: 0, vy: 0, r: BALL_R, active: true,
        });
      }
    });
  }

  function getColouredPositions(x, y, w, h) {
    // Standard snooker-ish positions scaled to table
    return {
      colours: {
        yellow: { x: x + w * 0.28, y: y + h * 0.62 },
        green:  { x: x + w * 0.28, y: y + h * 0.38 },
        brown:  { x: x + w * 0.28, y: y + h * 0.50 },
        blue:   { x: x + w * 0.50, y: y + h * 0.50 },
        pink:   { x: x + w * 0.70, y: y + h * 0.50 },
        black:  { x: x + w * 0.83, y: y + h * 0.50 },
      },
      reds: [
        { x: x + w * 0.72, y: y + h * 0.40 },
        { x: x + w * 0.72, y: y + h * 0.60 },
        { x: x + w * 0.77, y: y + h * 0.35 },
        { x: x + w * 0.77, y: y + h * 0.50 },
        { x: x + w * 0.77, y: y + h * 0.65 },
        { x: x + w * 0.82, y: y + h * 0.43 },
      ],
    };
  }

  function resetCueBall() {
    // Put cue ball back on the baulk line
    const { x, y, w, h } = tableRect;
    cueBall.x = x + w * 0.22;
    cueBall.y = y + h / 2;
    cueBall.vx = 0; cueBall.vy = 0;
    cueBall.active = true;
  }

  function draw(ctx, canvas, aimAngle, isAiming) {
    const { ox, oy } = _dims(canvas);
    drawTable(ctx, ox, oy);
    drawPockets(ctx);
    drawBalls(ctx);
    if (isAiming && cueBall && cueBall.active) {
      drawAimLine(ctx, aimAngle);
      drawCue(ctx, aimAngle);
    }
  }

  function _dims(canvas) {
    const HUD_H = 60;
    const aspect = 1.83;
    let tw = canvas.width * 0.94;
    let th = tw / aspect;
    if (th > canvas.height - HUD_H - 20) {
      th = canvas.height - HUD_H - 20;
      tw = th * aspect;
    }
    return {
      ox: (canvas.width - tw) / 2,
      oy: HUD_H + (canvas.height - HUD_H - th) / 2,
    };
  }

  function drawTable(ctx, ox, oy) {
    const cush = W * 0.042;
    // Outer wood frame
    const grad = ctx.createLinearGradient(ox, oy, ox + W, oy + H);
    grad.addColorStop(0, '#5c3a1e');
    grad.addColorStop(0.5, '#8b5e3c');
    grad.addColorStop(1, '#5c3a1e');
    ctx.fillStyle = grad;
    ctx.beginPath();
    roundRect(ctx, ox - 8, oy - 8, W + 16, H + 16, 12);
    ctx.fill();

    // Cushion band
    ctx.fillStyle = '#1a6e3c';
    ctx.beginPath();
    roundRect(ctx, ox, oy, W, H, 8);
    ctx.fill();

    // Playing surface
    const feltGrad = ctx.createLinearGradient(tableRect.x, tableRect.y, tableRect.x + tableRect.w, tableRect.y + tableRect.h);
    feltGrad.addColorStop(0, '#1e8449');
    feltGrad.addColorStop(0.5, '#239b56');
    feltGrad.addColorStop(1, '#1e8449');
    ctx.fillStyle = feltGrad;
    ctx.fillRect(tableRect.x, tableRect.y, tableRect.w, tableRect.h);

    // Baulk line
    const baulkX = tableRect.x + tableRect.w * 0.28;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(baulkX, tableRect.y);
    ctx.lineTo(baulkX, tableRect.y + tableRect.h);
    ctx.stroke();

    // Baulk D semi-circle
    const dR = tableRect.h * 0.16;
    ctx.beginPath();
    ctx.arc(baulkX, tableRect.y + tableRect.h / 2, dR, -Math.PI / 2, Math.PI / 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.stroke();

    // Centre spot
    const cx = tableRect.x + tableRect.w * 0.5;
    const cy = tableRect.y + tableRect.h * 0.5;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPockets(ctx) {
    for (const p of pockets) {
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawBalls(ctx) {
    for (const b of balls) {
      if (!b.active) continue;
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(b.x + 2, b.y + 3, b.r * 0.9, b.r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ball
      const grad = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.05, b.x, b.y, b.r);
      grad.addColorStop(0, lighten(b.color, 60));
      grad.addColorStop(0.6, b.color);
      grad.addColorStop(1, darken(b.color, 40));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.28, b.r * 0.18, -0.5, 0, Math.PI * 2);
      ctx.fill();

      // Label for coloured balls
      if (b.id !== 'white') {
        ctx.fillStyle = b.id === 'black' ? '#fff' : 'rgba(0,0,0,0.7)';
        ctx.font = `bold ${b.r * 0.85}px Orbitron, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.label || b.points, b.x, b.y + 1);
      }
    }
  }

  function drawAimLine(ctx, angle) {
    if (!cueBall) return;
    const len = tableRect.w * 0.6;
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cueBall.x, cueBall.y);
    ctx.lineTo(cueBall.x + Math.cos(angle) * len, cueBall.y + Math.sin(angle) * len);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawCue(ctx, angle) {
    if (!cueBall) return;
    const cueLen = BALL_R * 18;
    const gap = BALL_R * 1.4;
    const sx = cueBall.x - Math.cos(angle) * (gap);
    const sy = cueBall.y - Math.sin(angle) * (gap);
    const ex = cueBall.x - Math.cos(angle) * (gap + cueLen);
    const ey = cueBall.y - Math.sin(angle) * (gap + cueLen);

    const cueGrad = ctx.createLinearGradient(sx, sy, ex, ey);
    cueGrad.addColorStop(0, '#f5deb3');
    cueGrad.addColorStop(0.15, '#c8a96e');
    cueGrad.addColorStop(1, '#5c3a1e');
    ctx.strokeStyle = cueGrad;
    ctx.lineWidth = BALL_R * 0.55;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Tip
    ctx.strokeStyle = '#a0c4ff';
    ctx.lineWidth = BALL_R * 0.55;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(cueBall.x - Math.cos(angle) * gap * 0.5, cueBall.y - Math.sin(angle) * gap * 0.5);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function lighten(hex, amt) {
    return adjustColor(hex, amt);
  }
  function darken(hex, amt) {
    return adjustColor(hex, -amt);
  }
  function adjustColor(hex, amt) {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (n >> 16) + amt));
    const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
    const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
    return `rgb(${r},${g},${b})`;
  }

  return {
    resize, spawnBalls, resetCueBall, draw,
    getBalls: () => balls,
    getCueBall: () => cueBall,
    getTableRect: () => tableRect,
    getPockets: () => pockets,
    getBallR: () => BALL_R,
  };
})();
