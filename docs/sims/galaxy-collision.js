/* Interacting galaxies, after Toomre & Toomre (1972): two galaxy cores pass
   each other on a parabolic orbit, each carrying a disc of stars. The stars
   feel both cores' gravity. Discs that spin the same way as the encounter
   are torn into long tidal tails and bridges; discs spinning the other way
   survive almost untouched. */
OrrerySims.register("galaxy-collision", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 560 ? 1 : 0.6), max: 720, label: "Two disc galaxies passing each other and drawing out tidal tails" });
  const p = kit.panel();
  const EPS2 = 0.04;                       // softening, squared
  const TIME_UNIT_MYR = 47;                // with 10 kpc and 10^11 Suns as units
  const s = { q: 0.7, rp: 1.1, spin1: 1, spin2: 1, play: true, t: 0, tPeri: 0, cores: null, stars: null };

  kit.slider(p, { label: "Mass of the smaller galaxy", min: 0.2, max: 1, step: 0.05, value: s.q, format: (v) => Math.round(v * 100) + "% of the larger", onInput: (v) => { s.q = v; reset(); } });
  kit.slider(p, { label: "Closest approach", min: 0.8, max: 3, step: 0.05, value: s.rp, format: (v) => Math.round(v * 10) + " kpc", onInput: (v) => { s.rp = v; reset(); } });
  kit.select(p, { label: "Larger galaxy spins", options: [["1", "with the encounter"], ["-1", "against the encounter"]], value: "1", onChange: (v) => { s.spin1 = +v; reset(); } });
  kit.select(p, { label: "Smaller galaxy spins", options: [["1", "with the encounter"], ["-1", "against the encounter"]], value: "1", onChange: (v) => { s.spin2 = +v; reset(); } });
  const playBtn = kit.button(p, "Pause", () => { s.play = !s.play; playBtn.textContent = s.play ? "Pause" : "Play"; });
  kit.button(p, "Start again", () => reset());
  const out = kit.readouts(kit.root, [["t", "Time from closest approach"], ["sep", "Distance between cores"]]);

  function reset() {
    const M1 = 1, M2 = s.q, M = M1 + M2;
    // parabolic relative orbit: r = 2 rp / (1 + cos f), start well before pericentre
    const f0 = -2.0;
    const r0 = (2 * s.rp) / (1 + Math.cos(f0));
    const hh = Math.sqrt(2 * M * s.rp);
    const rel = [r0 * Math.cos(f0), r0 * Math.sin(f0)];
    const vr = (M / hh) * Math.sin(f0), vt = hh / r0;
    const relV = [vr * Math.cos(f0) - vt * Math.sin(f0), vr * Math.sin(f0) + vt * Math.cos(f0)];
    s.cores = [
      { m: M1, x: (-M2 / M) * rel[0], y: (-M2 / M) * rel[1], vx: (-M2 / M) * relV[0], vy: (-M2 / M) * relV[1] },
      { m: M2, x: (M1 / M) * rel[0], y: (M1 / M) * rel[1], vx: (M1 / M) * relV[0], vy: (M1 / M) * relV[1] },
    ];
    // time to pericentre on a parabola (Barker's equation), in model units
    const D = Math.tan(f0 / 2);
    s.tPeri = -Math.sqrt((2 * s.rp ** 3) / M) * (D + D ** 3 / 3);
    s.t = 0;
    s.zoom = 0;
    s.stars = [];
    const rr = kit.rng(11);
    s.cores.forEach((core, gi) => {
      const n = gi === 0 ? 1300 : Math.round(1300 * Math.max(0.5, s.q));
      const spin = gi === 0 ? s.spin1 : s.spin2;
      const rmax = gi === 0 ? 1.25 : 1.25 * Math.sqrt(s.q);
      for (let i = 0; i < n; i++) {
        // spread evenly over the disc's area, so its outskirts are well stocked
        const r = rmax * Math.sqrt(0.02 + rr() * 0.98), a = rr() * Math.PI * 2;
        const v = Math.sqrt((core.m * r * r) / Math.pow(r * r + EPS2, 1.5));
        s.stars.push({ g: gi, x: core.x + r * Math.cos(a), y: core.y + r * Math.sin(a), vx: core.vx - spin * v * Math.sin(a), vy: core.vy + spin * v * Math.cos(a) });
      }
    });
  }
  reset();

  function step(h) {
    const [A, B] = s.cores;
    const acc = (x, y, skip) => {
      let ax = 0, ay = 0;
      for (const core of s.cores) {
        if (core === skip) continue;
        const dx = core.x - x, dy = core.y - y, d2 = dx * dx + dy * dy + EPS2, f = core.m / (d2 * Math.sqrt(d2));
        ax += f * dx; ay += f * dy;
      }
      return [ax, ay];
    };
    // kick-drift-kick leapfrog for the cores and for every star
    const bodies = [A, B, ...s.stars];
    for (const b of bodies) { const [ax, ay] = acc(b.x, b.y, b.m ? b : null); b.vx += (ax * h) / 2; b.vy += (ay * h) / 2; }
    for (const b of bodies) { b.x += b.vx * h; b.y += b.vy * h; }
    for (const b of bodies) { const [ax, ay] = acc(b.x, b.y, b.m ? b : null); b.vx += (ax * h) / 2; b.vy += (ay * h) / 2; }
    s.t += h;
  }

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    if (s.play && s.t < s.tPeri + 28) for (let k = 0; k < 2; k++) step(0.01 + dt * 0.4);

    ctx.fillStyle = t.sky;
    ctx.fillRect(0, 0, w, h);
    // keep the pair's centre of mass in the middle
    const M = 1 + s.q;
    const mx = (s.cores[0].x + s.q * s.cores[1].x) / M, my = (s.cores[0].y + s.q * s.cores[1].y) / M;
    // zoom out smoothly as the pair separates, so the tails stay in view
    const sep = Math.hypot(s.cores[0].x - s.cores[1].x, s.cores[0].y - s.cores[1].y);
    const target = Math.max(9, sep * 2.2 + 3);
    s.zoom = s.zoom ? s.zoom + (target - s.zoom) * Math.min(1, dt * 1.5) : target;
    const S = Math.min(w, h) / s.zoom;
    const X = (x) => w / 2 + (x - mx) * S, Y = (y) => h / 2 - (y - my) * S;
    for (const st of s.stars) {
      ctx.fillStyle = st.g === 0 ? "rgba(180,205,255,0.85)" : "rgba(255,214,170,0.85)";
      ctx.fillRect(X(st.x), Y(st.y), 1.9, 1.9);
    }
    for (const [i, core] of s.cores.entries()) {
      const g = ctx.createRadialGradient(X(core.x), Y(core.y), 0, X(core.x), Y(core.y), 10);
      g.addColorStop(0, "#ffffff"); g.addColorStop(1, i ? "rgba(255,214,170,0)" : "rgba(180,205,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(X(core.x), Y(core.y), 10, 0, Math.PI * 2); ctx.fill();
    }
    ctx.font = t.small; ctx.fillStyle = t.skyMuted; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("stars feel the two cores only; the cores feel each other", 10, 8);

    const myr = Math.round((s.t - s.tPeri) * TIME_UNIT_MYR);
    out.set("t", (myr >= 0 ? "+" : "−") + Math.abs(myr).toLocaleString("en-US") + " million years");
    out.set("sep", Math.round(Math.hypot(s.cores[0].x - s.cores[1].x, s.cores[0].y - s.cores[1].y) * 10) + " kpc");
  });
});
