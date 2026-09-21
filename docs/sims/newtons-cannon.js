/* Newton's cannon: fire a shell sideways from high above the ground. Too slow
   and it falls back; fast enough and the ground curves away as fast as it
   falls, which is an orbit; faster still and it escapes. */
OrrerySims.register("newtons-cannon", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 560 ? 1 : 0.62), max: 700, label: "Earth with a cannon high above it, and the paths of shells fired at different speeds" });
  const p = kit.panel();
  const GM = 398600.4, RE = 6371;
  const s = { v: 7.7, angle: 0, alt: 400, shots: [], clock: 0, speedUp: 900 };
  const COLORS = ["#e4607a", "#ffe7a8", "#8fe0c0", "#c9a4ff", "#ffb38a", "#9fd3ff"];
  let colorAt = 0;

  const vS = kit.slider(p, { label: "Launch speed", min: 1, max: 13, step: 0.05, value: s.v, format: (v) => v.toFixed(2) + " km/s", onInput: (v) => (s.v = v) });
  kit.slider(p, { label: "Launch angle above horizontal", min: -10, max: 60, step: 1, value: s.angle, format: (v) => v + "°", onInput: (v) => (s.angle = v) });
  kit.slider(p, { label: "Height of the cannon", min: 100, max: 3000, step: 50, value: s.alt, format: (v) => v + " km", onInput: (v) => (s.alt = v) });
  kit.button(p, "Fire", () => fire());
  kit.button(p, "Clear", () => (s.shots = []));
  const out = kit.readouts(kit.root, [["orbit", "Speed for a circular orbit"], ["esc", "Escape speed"], ["fate", "Last shell"]]);
  let fate = "—";
  void vS;

  function fire() {
    const r0 = RE + s.alt, a = (s.angle * Math.PI) / 180;
    const shot = { x: 0, y: r0, vx: s.v * Math.cos(a), vy: s.v * Math.sin(a), trail: [[0, r0]], done: false, col: COLORS[colorAt++ % COLORS.length], t: 0 };
    s.shots.push(shot);
    if (s.shots.length > 6) s.shots.shift();
    // what will happen, from the energy and angular momentum
    const E = (s.v * s.v) / 2 - GM / r0;
    const hmom = r0 * s.v * Math.cos(a);
    if (E >= 0) fate = "escapes Earth for good";
    else {
      const sma = -GM / (2 * E);
      const e = Math.sqrt(Math.max(0, 1 + (2 * E * hmom * hmom) / (GM * GM)));
      const peri = sma * (1 - e), apo = sma * (1 + e);
      if (peri < RE) fate = "falls back to Earth";
      else fate = "orbits every " + Math.round((2 * Math.PI * Math.sqrt(sma ** 3 / GM)) / 60) + " min, between " +
        Math.round(peri - RE).toLocaleString("en-US") + " and " + Math.round(apo - RE).toLocaleString("en-US") + " km up";
    }
  }
  fire();

  const accel = (x, y) => { const r = Math.hypot(x, y), f = -GM / (r * r * r); return [f * x, f * y]; };

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    // advance every shell: velocity Verlet with 2-second steps
    const simT = dt * s.speedUp, step = 2;
    for (const q of s.shots) {
      if (q.done) continue;
      for (let k = 0; k < simT / step; k++) {
        let [ax, ay] = accel(q.x, q.y);
        q.vx += ax * step / 2; q.vy += ay * step / 2;
        q.x += q.vx * step; q.y += q.vy * step;
        [ax, ay] = accel(q.x, q.y);
        q.vx += ax * step / 2; q.vy += ay * step / 2;
        q.t += step;
        const r = Math.hypot(q.x, q.y);
        if (r < RE) {
          q.done = true;
          const arc = Math.atan2(q.x, q.y) * RE;
          q.note = "landed " + Math.round(Math.abs(arc)).toLocaleString("en-US") + " km away";
          if (q === s.shots[s.shots.length - 1]) fate = "falls back, landing " + Math.round(Math.abs(arc)).toLocaleString("en-US") + " km away";
          break;
        }
        if (r > RE * 12) { q.done = true; break; }
        // one full lap closes the path: stop drawing it again and again
        if (q.t > 600 && Math.hypot(q.x, q.y - q.trail[0][1]) < 60 && q.trail.length > 50) { q.done = true; q.closed = true; break; }
      }
      q.trail.push([q.x, q.y]);
    }

    ctx.fillStyle = t.sky;
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2 + h * 0.06;
    const S = Math.min(w, h) / 2 / (RE * 2.4);
    ctx.save();
    // atmosphere glow and the Earth
    const eg = ctx.createRadialGradient(cx, cy, RE * S * 0.2, cx, cy, RE * S * 1.06);
    eg.addColorStop(0, "#3f6aa8"); eg.addColorStop(0.9, "#2c4f7c"); eg.addColorStop(0.95, "#6f9be0"); eg.addColorStop(1, "rgba(111,155,224,0)");
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(cx, cy, RE * S * 1.06, 0, Math.PI * 2); ctx.fill();
    // the cannon's mountain
    const topY = cy - (RE + s.alt) * S;
    ctx.fillStyle = "#6b5b4a";
    ctx.beginPath(); ctx.moveTo(cx - 18, cy - RE * S + 2); ctx.lineTo(cx, topY); ctx.lineTo(cx + 18, cy - RE * S + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = t.skyInk;
    ctx.fillRect(cx - 4, topY - 4, 12, 5);
    for (const q of s.shots) {
      ctx.strokeStyle = q.col;
      ctx.globalAlpha = q === s.shots[s.shots.length - 1] ? 1 : 0.5;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      q.trail.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * S, cy - y * S) : ctx.moveTo(cx + x * S, cy - y * S)));
      if (q.closed) ctx.closePath();
      ctx.stroke();
      if (!q.done) {
        ctx.fillStyle = q.col;
        ctx.beginPath(); ctx.arc(cx + q.x * S, cy - q.y * S, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.font = t.small; ctx.fillStyle = t.skyMuted; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("mountain height to scale; time sped up " + s.speedUp + "×", 10, 8);

    const r0 = RE + s.alt;
    out.set("orbit", Math.sqrt(GM / r0).toFixed(2) + " km/s");
    out.set("esc", Math.sqrt((2 * GM) / r0).toFixed(2) + " km/s");
    out.set("fate", fate);
  });
});
