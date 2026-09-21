/* Radial velocity: a planet and its star both orbit their common centre of
   mass. The star's small wobble towards and away from us Doppler-shifts its
   spectrum by a few metres per second, and the shape of that velocity curve
   gives the planet's minimum mass, period and orbital eccentricity. */
OrrerySims.register("radial-velocity", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 640 ? 1.3 : 0.52), max: 740, label: "A star and planet orbiting their centre of mass, beside the star's radial velocity curve" });
  const p = kit.panel();
  const MJ_IN_ME = 317.8;
  const s = { mp: 0.47, P: 4.23, e: 0.0, w: 90, Ms: 1.06, phase: 0, noise: true, pts: null, key: "" };
  const presets = {
    peg: ["51 Pegasi b, the first around a Sun-like star", 0.47, 4.23, 0.0, 90, 1.06],
    jup: ["Jupiter, as aliens would see the Sun", 1.0, 4332.6, 0.049, 275, 1.0],
    earth: ["Earth, as aliens would see the Sun", 1 / MJ_IN_ME, 365.25, 0.017, 103, 1.0],
    ecc: ["A very eccentric giant", 4.0, 111.4, 0.8, 300, 1.0],
    prox: ["Proxima Centauri b, a red dwarf's planet", 1.07 / MJ_IN_ME, 11.19, 0.02, 90, 0.12],
  };
  kit.select(p, {
    label: "Try a planet",
    options: Object.entries(presets).map(([k, v]) => [k, v[0]]),
    value: "peg",
    onChange: (k) => { const [, mp, P, e, om, Ms] = presets[k]; mS.set(mp * MJ_IN_ME); PS.set(P); eS.set(e); wS.set(om); MsS.set(Ms); },
  });
  const mS = kit.slider(p, { label: "Planet mass", min: 0.5, max: 4000, log: true, value: s.mp * MJ_IN_ME, format: (v) => (v >= 60 ? (v / MJ_IN_ME).toFixed(2) + " × Jupiter" : v.toFixed(1) + " × Earth"), onInput: (v) => (s.mp = v / MJ_IN_ME) });
  const PS = kit.slider(p, { label: "Orbital period", min: 1, max: 5000, log: true, value: s.P, format: (v) => (v < 1000 ? v.toFixed(v < 10 ? 2 : 0) + " days" : (v / 365.25).toFixed(1) + " years"), onInput: (v) => (s.P = v) });
  const eS = kit.slider(p, { label: "Eccentricity", min: 0, max: 0.85, step: 0.01, value: s.e, format: (v) => v.toFixed(2), onInput: (v) => (s.e = v) });
  const wS = kit.slider(p, { label: "Orientation of the orbit", min: 0, max: 359, step: 1, value: s.w, format: (v) => v + "°", onInput: (v) => (s.w = v) });
  const MsS = kit.slider(p, { label: "Star mass", min: 0.1, max: 2, step: 0.01, value: s.Ms, format: (v) => v.toFixed(2) + " × the Sun", onInput: (v) => (s.Ms = v) });
  kit.toggle(p, { label: "Show measurements with 1 m/s scatter", value: true, onChange: (v) => (s.noise = v) });
  const out = kit.readouts(kit.root, [["K", "Star's wobble speed"], ["a", "Planet's orbit"], ["det", "Detectable today?"]]);

  const solveE = (M, e) => { let E = e < 0.8 ? M : Math.PI; for (let i = 0; i < 20; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; };
  const trueAnom = (M, e) => { const E = solveE(M, e); return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2)); };
  const Kms = () => 28.43 * s.mp * Math.pow(s.P / 365.25, -1 / 3) * Math.pow(s.Ms, -2 / 3) / Math.sqrt(1 - s.e * s.e);
  const rv = (M) => { const nu = trueAnom(M, s.e), om = (s.w * Math.PI) / 180; return Kms() * (Math.cos(nu + om) + s.e * Math.cos(om)); };

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    s.phase = (s.phase + dt * 0.18) % 1;
    const M = 2 * Math.PI * s.phase;
    const K = Kms();

    const wide = w >= 640;
    const orb = wide ? { x: 0, y: 0, w: h, h } : { x: 0, y: 0, w, h: h * 0.5 };
    const plot = wide ? { x: h + 76, y: 24, w: w - h - 94, h: h - 72 } : { x: 78, y: h * 0.5 + 24, w: w - 94, h: h * 0.5 - 70 };
    ctx.fillStyle = t.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = t.sky;
    ctx.fillRect(orb.x, orb.y, orb.w, orb.h);

    // ---- the orbit seen from above; we look up from the bottom edge
    const cx = orb.x + orb.w / 2, cy = orb.y + orb.h * 0.46;
    const A = Math.min(orb.w, orb.h) * 0.3;
    const om = (s.w * Math.PI) / 180;
    const posAt = (MM) => {
      const nu = trueAnom(MM, s.e);
      const r = (1 - s.e * s.e) / (1 + s.e * Math.cos(nu));
      // the planet sits opposite the star; with this angle the star's motion
      // up the screen (away from Earth) matches the sign of rv() below
      const ang = nu + om + Math.PI;
      return [r * Math.cos(ang), r * Math.sin(ang)];
    };
    ctx.strokeStyle = t.skyRule;
    ctx.beginPath();
    for (let k = 0; k <= 120; k++) { const [x, y] = posAt((k / 120) * 2 * Math.PI); k ? ctx.lineTo(cx + x * A, cy - y * A) : ctx.moveTo(cx + x * A, cy - y * A); }
    ctx.stroke();
    const [px, py] = posAt(M);
    ctx.fillStyle = "#9fd3ff";
    ctx.beginPath(); ctx.arc(cx + px * A, cy - py * A, 4 + Math.min(5, Math.cbrt(s.mp) * 3), 0, Math.PI * 2); ctx.fill();
    // the star wobbles opposite the planet, exaggerated to be visible
    const wob = A * 0.12;
    const sx = cx - px * wob, sy = cy + py * wob;
    const vNow = rv(M);
    const shift = Math.max(-1, Math.min(1, vNow / Math.max(K, 1e-9)));
    const col = shift > 0 ? `rgb(255,${Math.round(230 - 70 * shift)},${Math.round(200 - 110 * shift)})` : `rgb(${Math.round(255 + 110 * shift)},${Math.round(230 + 10 * shift)},255)`;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 16);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.45, col); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = t.skyMuted;
    ctx.beginPath(); ctx.moveTo(cx - 4, cy); ctx.lineTo(cx + 4, cy); ctx.moveTo(cx, cy - 4); ctx.lineTo(cx, cy + 4); ctx.stroke();
    ctx.font = t.small; ctx.fillStyle = t.skyMuted; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("↓ towards Earth", cx, orb.y + orb.h - 8);
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("star's wobble exaggerated; its colour shows the shift", orb.x + 10, orb.y + 8);

    // ---- velocity curve, two orbits
    const ymax = Math.max(0.2, K * (1 + s.e) * 1.25 + (s.noise ? 2 : 0));
    const nice = (v) => { const e10 = Math.pow(10, Math.floor(Math.log10(v))); return [1, 2, 5, 10].map((m) => m * e10).find((m) => m >= v / 2) || e10 * 10; };
    const tk = nice(ymax);
    const ticks = [-2 * tk, -tk, 0, tk, 2 * tk].filter((v) => Math.abs(v) <= ymax);
    const fmtV = (v) => (Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + " km/s" : (Math.abs(v) < 1 && v !== 0 ? v.toFixed(2) : Math.round(v)) + " m/s");
    const { X, Y } = kit.axes(ctx, plot, {
      xmin: 0, xmax: 2, ymin: -ymax, ymax,
      xticks: [0, 0.5, 1, 1.5, 2], yticks: ticks,
      xfmt: (v) => v + "", yfmt: fmtV,
      xlabel: "time, in orbits", ylabel: "star's speed away from us",
    });
    const key = [s.mp, s.P, s.e, s.w, s.Ms].join();
    if (key !== s.key) {
      s.key = key;
      const rr = kit.rng(7);
      s.pts = Array.from({ length: 34 }, () => { const x = rr() * 2; const n = (rr() + rr() + rr() - 1.5) * 1.4; return [x, n]; });
    }
    if (s.noise) {
      ctx.fillStyle = t.ink;
      for (const [x, n] of s.pts) {
        const v = rv(2 * Math.PI * (x % 1)) + n;
        if (Math.abs(v) > ymax) continue;
        ctx.beginPath(); ctx.arc(X(x), Y(v), 2.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k <= 400; k++) { const x = (2 * k) / 400; const y = Y(rv(2 * Math.PI * (x % 1))); k ? ctx.lineTo(X(x), y) : ctx.moveTo(X(x), y); }
    ctx.stroke();
    ctx.fillStyle = t.mark;
    ctx.beginPath(); ctx.arc(X(s.phase), Y(vNow), 5, 0, Math.PI * 2); ctx.fill();

    const aAU = Math.cbrt(s.Ms * (s.P / 365.25) ** 2);
    out.set("K", fmtV(K));
    out.set("a", aAU.toFixed(aAU < 1 ? 3 : 2) + " AU from its star");
    out.set("det", K > 3 ? "yes, easily" : K > 0.5 ? "yes, with the best instruments" : K > 0.08 ? "at the very edge of what is possible" : "not yet");
  });
});
