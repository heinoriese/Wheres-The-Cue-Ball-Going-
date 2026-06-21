// 2D ball physics: movement, friction, ball-ball & ball-cushion collisions

const Physics = (() => {
  const FRICTION = 0.982;
  const MIN_SPEED = 0.08;
  const RESTITUTION = 0.92;

  function step(balls, tableRect, pockets, onPocketed) {
    // Move all balls
    for (const b of balls) {
      if (!b.active) continue;
      b.x += b.vx;
      b.y += b.vy;
      b.vx *= FRICTION;
      b.vy *= FRICTION;
      if (Math.abs(b.vx) < MIN_SPEED) b.vx = 0;
      if (Math.abs(b.vy) < MIN_SPEED) b.vy = 0;
    }

    // Ball-cushion
    for (const b of balls) {
      if (!b.active) continue;
      wallBounce(b, tableRect);
    }

    // Ball-ball
    const active = balls.filter(b => b.active);
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        collideBalls(active[i], active[j]);
      }
    }

    // Pocket check
    for (const b of balls) {
      if (!b.active) continue;
      for (const p of pockets) {
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        if (dx * dx + dy * dy <= p.r * p.r) {
          b.active = false;
          b.vx = 0; b.vy = 0;
          if (onPocketed) onPocketed(b);
        }
      }
    }
  }

  function wallBounce(b, rect) {
    const { x, y, w, h } = rect;
    if (b.x - b.r < x) { b.x = x + b.r; b.vx = Math.abs(b.vx) * RESTITUTION; }
    if (b.x + b.r > x + w) { b.x = x + w - b.r; b.vx = -Math.abs(b.vx) * RESTITUTION; }
    if (b.y - b.r < y) { b.y = y + b.r; b.vy = Math.abs(b.vy) * RESTITUTION; }
    if (b.y + b.r > y + h) { b.y = y + h - b.r; b.vy = -Math.abs(b.vy) * RESTITUTION; }
  }

  function collideBalls(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distSq = dx * dx + dy * dy;
    const minDist = a.r + b.r;
    if (distSq >= minDist * minDist) return;

    const dist = Math.sqrt(distSq);
    if (dist === 0) return;

    const nx = dx / dist;
    const ny = dy / dist;

    // Separate
    const overlap = (minDist - dist) / 2;
    a.x -= nx * overlap;
    a.y -= ny * overlap;
    b.x += nx * overlap;
    b.y += ny * overlap;

    // Exchange velocity along normal
    const dvx = a.vx - b.vx;
    const dvy = a.vy - b.vy;
    const dot = dvx * nx + dvy * ny;
    if (dot <= 0) return;

    const impulse = dot * RESTITUTION;
    a.vx -= impulse * nx;
    a.vy -= impulse * ny;
    b.vx += impulse * nx;
    b.vy += impulse * ny;
  }

  function areAllStopped(balls) {
    return balls.every(b => !b.active || (b.vx === 0 && b.vy === 0));
  }

  function shoot(ball, angle, power, maxSpeed) {
    const speed = power * maxSpeed;
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
  }

  return { step, shoot, areAllStopped };
})();
