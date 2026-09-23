/* The Roche limit: close to a planet, the difference in the planet's pull
   across a moon outweighs the moon's own gravity holding it together. A loose
   moon that drifts inside is pulled apart, and its pieces, each now on its
   own orbit, shear out into a ring. Saturn's rings lie inside its Roche limit. */
OrrerySims.register("roche-rings", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 560 ? 1 : 0.62), max: 720, label: "A rubble-pile moon approaching a ringed planet, breaking up inside the Roche limit and spreading into a ring" });
  const p = kit.panel();
  const s = { rhoM: 0.9, rhoP: 0.687, d: 3.0, drift: false, broken: false, phase: 0, parts: [] };

  kit.slider(p, { label: "Moon's density", min: 0.5, max: 5.5, step: 0.05, value: s.rhoM, format: (v) => v.toFixed(2) + " g/cm³" + (v < 1.2 ? " (ice)" : v > 2.8 ? " (rock/iron)" : " (ice and rock)"), onInput: (v) => { s.rhoM = v; } });
  kit.slider(p, { label: "Planet's density", min: 0.5, max: 5.5, step: 0.05, value: s.rhoP, format: (v) => v.toFixed(2) + " g/cm³" + (Math.abs(v - 0.687) < 0.03 ? " (Saturn)" : Math.abs(v - 5.51) < 0.05 ? " (Earth)" : ""), onInput: (v) => { s.rhoP = v; } });
  const dS = kit.slider(p, { label: "Moon's distance", min: 1.3, max: 4, step: 0.01, value: s.d, format: (v) => v.toFixed(2) + " planet radii", onInput: (v) => { if (!s.broken) s.d = v; } });
  const driftBtn = kit.button(p, "Let tides pull it in", () => { s.drift = !s.drift; driftBtn.textContent = s.drift ? "Stop" : "Let tides pull it in"; });
  kit.button(p, "New moon", () => reset());
  const out = kit.readouts(kit.root, [["lim", "Roche limit"], ["where", "The moon"], ["sat", "Saturn's main rings"]]);

  const rand = kit.rng(5);
  function reset() {
    s.broken = false; s.drift = false; s.d = 3.0; driftBtn.textContent = "Let tides pull it in";
    dS.set(3.0, false);
    s.parts = [];
    for (let i = 0; i < 360; i++) {
      const r = 0.16 * Math.cbrt(rand()), a = rand() * Math.PI * 2;      // moon drawn oversized
      s.parts.push({ ox: r * Math.cos(a), oy: r * Math.sin(a), r: 0, th: 0 });
    }
  }
  reset();
  const roche = () => 2.44 * Math.cbrt(s.rhoP / s.rhoM);        // fluid-body Roche limit, planet radii
  const omega = (r) => 2.2 * Math.pow(r / 2, -1.5);              // screen time: an orbit at 2 R takes ~3 s

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    const L = roche();
    if (!s.broken) {
      if (s.drift) { s.d = Math.max(1.3, s.d - dt * 0.12); dS.set(s.d, false); }
      s.phase += omega(s.d) * dt;
      if (s.d < L) {
        // break up: every piece continues on its own circular orbit
        s.broken = true;
        s.drift = false; driftBtn.textContent = "Let tides pull it in";
        const ca = Math.cos(s.phase), sa = Math.sin(s.phase);
        for (const q of s.parts) {
          const x = s.d * ca + q.ox * ca - q.oy * sa, y = s.d * sa + q.ox * sa + q.oy * ca;
          q.r = Math.hypot(x, y); q.th = Math.atan2(y, x);
        }
      }
    } else {
      for (const q of s.parts) q.th += omega(q.r) * dt;
    }

    ctx.fillStyle = t.sky;
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, S = Math.min(w / 2 / 4.2, h / 2 / 1.9);
    const flat = 0.42;                                           // seen at a slant
    // Saturn's real main rings, faintly, for comparison
    ctx.strokeStyle = "rgba(233,201,154,0.12)";
    ctx.lineWidth = (2.27 - 1.24) * S * flat;
    ctx.beginPath(); ctx.ellipse(cx, cy, ((1.24 + 2.27) / 2) * S, ((1.24 + 2.27) / 2) * S * flat, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
    // Roche limit
    ctx.strokeStyle = "rgba(228,96,122,0.7)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.ellipse(cx, cy, L * S, L * S * flat, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // pieces behind the planet first, then the planet, then those in front
    const pts = s.parts.map((q) => {
      if (s.broken) return [q.r * Math.cos(q.th), q.r * Math.sin(q.th)];
      const ca = Math.cos(s.phase), sa = Math.sin(s.phase);
      return [s.d * ca + q.ox * ca - q.oy * sa, s.d * sa + q.ox * sa + q.oy * ca];
    });
    const dot = (x, y) => { ctx.fillRect(cx + x * S - 1, cy - y * S * flat - 1, 2.2, 2.2); };
    ctx.fillStyle = "#d8cdb8";
    for (const [x, y] of pts) if (y > 0) dot(x, y);
    const pg = ctx.createRadialGradient(cx - S * 0.3, cy - S * 0.3, S * 0.1, cx, cy, S);
    pg.addColorStop(0, "#f1dcb0"); pg.addColorStop(1, "#b08b52");
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(cx, cy, S, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e9dcc4";
    for (const [x, y] of pts) if (y <= 0) dot(x, y);
    ctx.font = t.small; ctx.fillStyle = t.skyMuted; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("red dashes: Roche limit. Faint band: where Saturn's rings are.", 10, 8);

    out.set("lim", L.toFixed(2) + " planet radii");
    out.set("where", s.broken ? "torn apart, spreading into a ring" : s.d < L * 1.1 ? "close to breaking up" : "holding together");
    out.set("sat", "1.24 to 2.27 Saturn radii");
  });
});
