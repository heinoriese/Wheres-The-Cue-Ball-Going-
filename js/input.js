// Mouse + Gamepad input handler

const Input = (() => {
  let canvas = null;
  let mouse = { x: 0, y: 0, down: false };
  let gamepadIndex = null;

  // Callbacks set by game
  let onAim = null;
  let onPowerStart = null;
  let onPowerEnd = null;   // (power 0-1)
  let onCancel = null;

  // Power charging state
  let charging = false;
  let chargeStart = 0;
  const MAX_CHARGE_MS = 1800;

  function init(cvs) {
    canvas = cvs;

    canvas.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      const scaleX = canvas.width / r.width;
      const scaleY = canvas.height / r.height;
      mouse.x = (e.clientX - r.left) * scaleX;
      mouse.y = (e.clientY - r.top) * scaleY;
      if (onAim) onAim(mouse.x, mouse.y);
    });

    canvas.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      mouse.down = true;
      charging = true;
      chargeStart = performance.now();
      if (onPowerStart) onPowerStart();
    });

    canvas.addEventListener('mouseup', e => {
      if (e.button !== 0) return;
      if (!charging) return;
      const power = Math.min((performance.now() - chargeStart) / MAX_CHARGE_MS, 1);
      charging = false;
      mouse.down = false;
      if (onPowerEnd) onPowerEnd(power);
    });

    canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (onCancel) onCancel();
    });

    // Touch support
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      const r = canvas.getBoundingClientRect();
      const scaleX = canvas.width / r.width;
      const scaleY = canvas.height / r.height;
      mouse.x = (t.clientX - r.left) * scaleX;
      mouse.y = (t.clientY - r.top) * scaleY;
      charging = true;
      chargeStart = performance.now();
      if (onPowerStart) onPowerStart();
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      const r = canvas.getBoundingClientRect();
      const scaleX = canvas.width / r.width;
      const scaleY = canvas.height / r.height;
      mouse.x = (t.clientX - r.left) * scaleX;
      mouse.y = (t.clientY - r.top) * scaleY;
      if (onAim) onAim(mouse.x, mouse.y);
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      if (!charging) return;
      const power = Math.min((performance.now() - chargeStart) / MAX_CHARGE_MS, 1);
      charging = false;
      if (onPowerEnd) onPowerEnd(power);
    }, { passive: false });

    window.addEventListener('gamepadconnected', e => {
      gamepadIndex = e.gamepad.index;
    });

    window.addEventListener('gamepaddisconnected', e => {
      if (e.gamepad.index === gamepadIndex) gamepadIndex = null;
    });
  }

  // Returns current power charge fraction (0-1), call each frame while charging
  function getChargeFraction() {
    if (!charging) return 0;
    return Math.min((performance.now() - chargeStart) / MAX_CHARGE_MS, 1);
  }

  // Poll gamepad, returns { ax, ay, fire, cancel } or null
  function pollGamepad() {
    if (gamepadIndex === null) return null;
    const gp = navigator.getGamepads()[gamepadIndex];
    if (!gp) return null;
    return {
      ax: gp.axes[0],
      ay: gp.axes[1],
      fire: gp.buttons[0]?.pressed,
      cancel: gp.buttons[1]?.pressed,
    };
  }

  function setCallbacks({ aim, powerStart, powerEnd, cancel }) {
    onAim = aim;
    onPowerStart = powerStart;
    onPowerEnd = powerEnd;
    onCancel = cancel;
  }

  function getMouse() { return { ...mouse }; }
  function isCharging() { return charging; }

  return { init, setCallbacks, getMouse, isCharging, getChargeFraction, pollGamepad };
})();
