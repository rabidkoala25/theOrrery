/* Eclipsing binary: two stars seen almost edge-on. The light curve dips when
   one passes in front of the other; the depths tell you the stars' relative
   surface brightness, the shape tells you their sizes and the tilt. */
OrrerySims.register("eclipsing-binary", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 560 ? 1.1 : 0.62), label: "Two stars orbiting each other, above a graph of their combined brightness" });
  const p = kit.panel();
  const A = 3.4;              // separation, in units of the larger star's radius
  const T1 = 9500;
  const s = { inc: 86, k: 0.62, sb: 0.35, rate: 0.12, phase: -0.12, play: true };

  kit.slider(p, { label: "Tilt of the orbit (90° is edge-on)", min: 60, max: 90, step: 0.1, value: s.inc, format: (v) => v.toFixed(1) + "°", onInput: (v) => (s.inc = v) });
  kit.slider(p, { label: "Size of the second star", min: 0.2, max: 1, step: 0.01, value: s.k, format: (v) => Math.round(v * 100) + "% of the first", onInput: (v) => (s.k = v) });
  kit.slider(p, { label: "Surface brightness of the second star", min: 0.05, max: 1, step: 0.01, value: s.sb, format: (v) => Math.round(v * 100) + "% of the first", onInput: (v) => (s.sb = v) });
  kit.slider(p, { label: "Speed", min: 0.02, max: 0.4, step: 0.01, value: s.rate, format: (v) => v.toFixed(2) + " orbits per second", onInput: (v) => (s.rate = v) });
  const playBtn = kit.button(p, "Pause", () => {
    s.play = !s.play;
    playBtn.textContent = s.play ? "Pause" : "Play";
  });
  const out = kit.readouts(kit.root, [["d1", "Primary eclipse depth"], ["d2", "Secondary eclipse depth"], ["t2", "Second star's temperature"]]);

  const geom = (phase) => {
    const ph = phase * 2 * Math.PI, i = (s.inc * Math.PI) / 180;
    const x = A * Math.sin(ph), y = A * Math.cos(ph) * Math.cos(i), z = A * Math.cos(ph) * Math.sin(i);
    return { x, y, z };
  };
  const flux = (phase) => {
    const { x, y, z } = geom(phase);
    const area = kit.overlap(Math.hypot(x, y), 1, s.k);
    const f1 = Math.PI, f2 = Math.PI * s.k * s.k * s.sb;
    const blocked = z > 0 ? area : area * s.sb;   // z > 0: second star in front
    return (f1 + f2 - blocked) / (f1 + f2);
  };

  const drawStar = (ctx, x, y, r, color, dim = 1) => {
    const m = color.match(/\d+/g).map((n) => Math.round(n * dim));
    color = `rgb(${m[0]},${m[1]},${m[2]})`;
    const core = Math.round(255 * dim);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgb(${core},${core},${core})`);
    g.addColorStop(0.25, color);
    g.addColorStop(1, color.replace("rgb", "rgba").replace(")", ",0.55)"));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    if (s.play) s.phase = ((s.phase + s.rate * dt + 0.25) % 1) - 0.25;

    const skyH = Math.round(h * 0.46);
    ctx.fillStyle = t.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = t.sky;
    ctx.fillRect(0, 0, w, skyH);

    // the pair on the sky, circling their centre of mass
    const unit = Math.min(w / (2 * A + 3), skyH / 5.2);
    const q = s.k * s.k / (1 + s.k * s.k);      // rough mass share of star 2
    const { x, y, z } = geom(s.phase);
    const cx = w / 2, cy = skyH / 2;
    const s1 = { x: cx - x * q * unit, y: cy + y * q * unit, r: unit, col: kit.starColor(T1), dim: 1 };
    const T2 = T1 * Math.pow(s.sb, 0.25);
    const s2 = { x: cx + x * (1 - q) * unit, y: cy - y * (1 - q) * unit, r: s.k * unit, col: kit.starColor(T2), dim: 0.4 + 0.6 * Math.sqrt(s.sb) };
    const order = z > 0 ? [s1, s2] : [s2, s1];
    order.forEach((st) => drawStar(ctx, st.x, st.y, st.r, st.col, st.dim));

    ctx.font = t.small;
    ctx.fillStyle = t.skyMuted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("as seen from Earth", 10, 8);

    // the light curve over one orbit
    const rect = { x: 52, y: skyH + 16, w: w - 70, h: h - skyH - 52 };
    let lo = 1;
    const N = 360, pts = [];
    for (let k = 0; k <= N; k++) {
      const ph = -0.25 + k / N;
      const f = flux(ph);
      lo = Math.min(lo, f);
      pts.push([ph, f]);
    }
    const ymin = Math.max(0, Math.floor((lo - 0.05) * 10) / 10);
    const ticks = [];
    for (let v = ymin; v <= 1.0001; v += ymin < 0.5 ? 0.2 : 0.1) ticks.push(+v.toFixed(2));
    const { X, Y } = kit.axes(ctx, rect, {
      xmin: -0.25, xmax: 0.75, ymin, ymax: 1.03,
      xticks: [-0.25, 0, 0.25, 0.5, 0.75], yticks: ticks,
      xfmt: (v) => v.toFixed(2), yfmt: (v) => Math.round(v * 100) + "%",
      xlabel: "orbital phase (0 = second star in front)",
    });
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach(([ph, f], k) => (k ? ctx.lineTo(X(ph), Y(f)) : ctx.moveTo(X(ph), Y(f))));
    ctx.stroke();
    const f = flux(s.phase);
    ctx.fillStyle = t.mark;
    ctx.beginPath();
    ctx.arc(X(s.phase), Y(f), 5, 0, Math.PI * 2);
    ctx.fill();

    out.set("d1", ((1 - flux(0)) * 100).toFixed(1) + "%");
    out.set("d2", ((1 - flux(0.5)) * 100).toFixed(1) + "%");
    out.set("t2", Math.round(T2 / 10) * 10 + " K (first star " + T1 + " K)");
  });
});
