/* The fate of the universe: how the expansion runs depends on how much matter
   (which slows it) and dark energy (which speeds it up) there is. Change the
   mix and watch the universe's size over time, its age, and its future. */
OrrerySims.register("cosmic-fate", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 640 ? 1.35 : 0.5), max: 760, label: "The size of the universe over time for a chosen mix of matter and dark energy, beside a map of possible universes" });
  const p = kit.panel();
  const s = { Om: 0.31, OL: 0.69, H0: 67.7, key: "", curve: null, grid: null };

  kit.select(p, {
    label: "Try a universe",
    options: [["std", "Ours: 31% matter, 69% dark energy"], ["eds", "Matter only, flat (the old favourite)"], ["closed", "Lots of matter: recollapse"], ["empty", "Nearly empty"], ["lambda", "Dark energy only"]],
    value: "std",
    onChange: (k) => {
      const m = { std: [0.31, 0.69], eds: [1, 0], closed: [2.5, 0], empty: [0.02, 0], lambda: [0.02, 0.98] }[k];
      omS.set(m[0]); olS.set(m[1]);
    },
  });
  const omS = kit.slider(p, { label: "Matter (ordinary and dark)", min: 0, max: 3, step: 0.01, value: s.Om, format: (v) => Math.round(v * 100) + "% of critical", onInput: (v) => (s.Om = v) });
  const olS = kit.slider(p, { label: "Dark energy", min: -0.5, max: 1.5, step: 0.01, value: s.OL, format: (v) => Math.round(v * 100) + "% of critical", onInput: (v) => (s.OL = v) });
  kit.slider(p, { label: "Hubble constant today", min: 50, max: 80, step: 0.1, value: s.H0, format: (v) => v.toFixed(1) + " km/s per Mpc", onInput: (v) => (s.H0 = v) });
  const out = kit.readouts(kit.root, [["age", "Age of the universe"], ["shape", "Geometry"], ["now", "Expansion now"], ["fate", "Future"]]);

  const E2 = (a, Om, OL) => Om / a + (1 - Om - OL) + OL * a * a;       // (da/dt / H0)^2, radiation ignored
  // integrate a(t) forward and back from today, in Gyr
  function model(Om, OL, H0) {
    const HG = H0 / 977.8;                                              // per Gyr
    const step = 0.01;
    const back = [], fwd = [];
    let a = 1, age = null, bounce = false;
    for (let t = 0; t > -60; t -= step) {
      back.push([t, a]);
      const e = E2(a, Om, OL);
      if (e <= 0) { bounce = true; break; }
      a -= HG * Math.sqrt(e) * step;               // da/dt = H0 * sqrt(E2)
      if (a <= 0.002) { age = -t + step; back.push([t - step, 0]); break; }
    }
    a = 1;
    let sign = 1, crunch = null;
    for (let t = 0; t < 80; t += step) {
      fwd.push([t, a]);
      let e = E2(a, Om, OL);
      if (e <= 0) { sign = -1; e = 0; }
      a += sign * HG * Math.sqrt(Math.max(e, 1e-9)) * step;
      if (a <= 0.002) { crunch = t; fwd.push([t + step, 0]); break; }
      if (a > 60) break;
    }
    return { pts: back.reverse().concat(fwd), age, bounce, crunch };
  }
  // classify every point of the Omega-m / Omega-lambda map once
  function fateOf(Om, OL) {
    let noBang = false, recollapse = false;
    for (let k = 0; k <= 60; k++) { const a = Math.pow(10, -3 + (3 * k) / 60); if (E2(a, Om, OL) < 0) noBang = true; }
    for (let k = 0; k <= 60; k++) { const a = Math.pow(10, (3 * k) / 60); if (E2(a, Om, OL) < 0) recollapse = true; }
    return noBang ? 2 : recollapse ? 1 : 0;
  }
  const GRID = 60;
  s.grid = [];
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) s.grid.push(fateOf((3 * (i + 0.5)) / GRID, -0.5 + (2 * (j + 0.5)) / GRID));
  const ref = model(0.31, 0.69, 67.7), eds = model(1, 0, 67.7);

  kit.loop(() => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    const key = [s.Om, s.OL, s.H0].join();
    if (key !== s.key) { s.key = key; s.curve = model(s.Om, s.OL, s.H0); }
    const m = s.curve;

    const wide = w >= 640;
    const plot = wide ? { x: 60, y: 24, w: w * 0.6 - 80, h: h - 72 } : { x: 56, y: 22, w: w - 72, h: h * 0.55 - 66 };
    const map = wide ? { x: w * 0.6 + 56, y: 24, w: w * 0.4 - 72, h: h - 72 } : { x: 56, y: h * 0.55 + 24, w: w - 72, h: h * 0.45 - 70 };
    ctx.fillStyle = t.paper;
    ctx.fillRect(0, 0, w, h);

    const P = kit.axes(ctx, plot, {
      xmin: -20, xmax: 40, ymin: 0, ymax: 4,
      xticks: [-20, -10, 0, 10, 20, 30, 40], yticks: [0, 1, 2, 3, 4],
      xfmt: (v) => (v === 0 ? "now" : (v > 0 ? "+" : "") + v), yfmt: (v) => v + "×",
      xlabel: "billions of years from now", ylabel: "size of the universe (today = 1)",
    });
    const line = (pts, color, width, dash) => {
      ctx.save();
      ctx.beginPath(); ctx.rect(plot.x, plot.y, plot.w, plot.h); ctx.clip();
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(P.X(x), P.Y(y)) : ctx.moveTo(P.X(x), P.Y(y))));
      ctx.stroke();
      ctx.restore();
    };
    line(eds.pts, t.muted, 1, [2, 3]);
    line(ref.pts, t.muted, 1, [6, 4]);
    line(m.pts, t.accent, 2.4);
    ctx.fillStyle = t.mark;
    ctx.beginPath(); ctx.arc(P.X(0), P.Y(1), 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.font = t.small; ctx.fillStyle = t.muted; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("dashed: our universe   dotted: matter only", plot.x + 6, plot.y + 6);

    // map of possible universes
    const M = kit.axes(ctx, map, {
      xmin: 0, xmax: 3, ymin: -0.5, ymax: 1.5,
      xticks: [0, 1, 2, 3], yticks: [-0.5, 0, 0.5, 1, 1.5],
      xfmt: (v) => v * 100 + "%", yfmt: (v) => Math.round(v * 100) + "%",
      xlabel: "matter", ylabel: "dark energy",
    });
    const cw = map.w / GRID, ch = map.h / GRID;
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
      const f = s.grid[j * GRID + i];
      if (!f) continue;
      ctx.fillStyle = f === 1 ? "rgba(228,96,122,0.22)" : "rgba(120,130,150,0.35)";
      ctx.fillRect(map.x + i * cw, map.y + map.h - (j + 1) * ch, cw + 0.5, ch + 0.5);
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(map.x, map.y, map.w, map.h); ctx.clip();
    ctx.strokeStyle = t.ink; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(M.X(0), M.Y(1)); ctx.lineTo(M.X(2), M.Y(-1)); ctx.stroke();                // flat: OL = 1 - Om
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(M.X(0), M.Y(0)); ctx.lineTo(M.X(3), M.Y(1.5)); ctx.stroke();               // q0 = 0: OL = Om / 2
    ctx.setLineDash([]);
    ctx.restore();
    ctx.font = t.small; ctx.fillStyle = t.muted; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText("flat", M.X(0.08), M.Y(0.94));
    ctx.fillText("speeding up", M.X(1.25), M.Y(1.3));
    ctx.fillText("no Big Bang", M.X(0.05), M.Y(1.16));
    ctx.fillText("recollapses", M.X(1.9), M.Y(-0.28));
    ctx.fillStyle = t.mark; ctx.strokeStyle = t.ink;
    ctx.beginPath(); ctx.arc(M.X(Math.min(3, s.Om)), M.Y(Math.max(-0.5, Math.min(1.5, s.OL))), 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    const Ok = 1 - s.Om - s.OL;
    const q0 = s.Om / 2 - s.OL;
    out.set("age", m.bounce ? "no beginning: it bounced" : m.age ? m.age.toFixed(1) + " billion years" : "more than 60 billion years");
    out.set("shape", Math.abs(Ok) < 0.02 ? "flat" : Ok < 0 ? "closed, like a sphere" : "open, like a saddle");
    out.set("now", q0 < 0 ? "speeding up" : "slowing down");
    out.set("fate", m.crunch !== null ? "Big Crunch in " + m.crunch.toFixed(0) + " billion years" : s.OL > 0.001 ? "expands forever, ever faster" : "expands forever, ever slower");
  });
});
