/* A planet transiting its star. The dip depth is roughly (planet radius /
   star radius)^2; limb darkening rounds the bottom of the dip, and a grazing
   path makes it V-shaped. */
OrrerySims.register("exoplanet-transit", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 560 ? 1.05 : 0.6), label: "A planet crossing the face of its star, above the star's brightness over time" });
  const p = kit.panel();
  const EARTH_IN_SUN = 0.009168;
  const s = { Rs: 1, Rp: 11.2, b: 0.3, u: 0.6, x: -1.6, rate: 0.35 };

  const presets = {
    jupiter: ["Jupiter crossing the Sun", 1, 11.2],
    earth: ["Earth crossing the Sun", 1, 1],
    mdwarf: ["Earth-size planet, small red dwarf", 0.2, 1],
    hot: ["Inflated hot Jupiter", 1.2, 16],
  };
  kit.select(p, {
    label: "Try a system",
    options: Object.entries(presets).map(([k, v]) => [k, v[0]]),
    value: "jupiter",
    onChange: (k) => { const [, Rs, Rp] = presets[k]; rsS.set(Rs); rpS.set(Rp); },
  });
  const rpS = kit.slider(p, { label: "Planet radius", min: 0.5, max: 25, log: true, value: s.Rp, format: (v) => v.toFixed(1) + " × Earth", onInput: (v) => (s.Rp = v) });
  const rsS = kit.slider(p, { label: "Star radius", min: 0.1, max: 2, log: true, value: s.Rs, format: (v) => v.toFixed(2) + " × the Sun", onInput: (v) => (s.Rs = v) });
  kit.slider(p, { label: "Path across the disc (0 = through the centre)", min: 0, max: 1.2, step: 0.01, value: s.b, format: (v) => v.toFixed(2) + " star radii", onInput: (v) => (s.b = v) });
  kit.slider(p, { label: "Limb darkening", min: 0, max: 1, step: 0.01, value: s.u, format: (v) => v.toFixed(2), onInput: (v) => (s.u = v) });
  const out = kit.readouts(kit.root, [["depth", "Deepest dip"], ["k", "Planet / star size"], ["kind", "Transit"]]);

  const I = (r) => 1 - s.u * (1 - Math.sqrt(Math.max(0, 1 - r * r)));
  const deficit = (x, k) => {
    const z = Math.hypot(x, s.b);
    const area = kit.overlap(z, 1, k);
    if (!area) return 0;
    return (area * I(Math.min(z, 0.999))) / (Math.PI * (1 - s.u / 3));
  };

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    const k = (s.Rp * EARTH_IN_SUN) / s.Rs;
    const span = 1 + k + 0.35;
    s.x += s.rate * dt;
    if (s.x > span) s.x = -span;

    const topH = Math.round(h * 0.52);
    ctx.fillStyle = t.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = t.sky;
    ctx.fillRect(0, 0, w, topH);

    // star with limb darkening, colour loosely following its size
    const Rpx = Math.min(w * 0.28, topH * 0.4);
    const cx = w / 2, cy = topH / 2;
    const T = kit.clamp(5772 * Math.pow(s.Rs, 0.55), 3000, 8500);
    const col = kit.starColor(T);
    const m = col.match(/\d+/g).map(Number);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Rpx);
    for (let q = 0; q <= 10; q++) {
      const r = q / 10, f = I(Math.min(r, 0.999));
      g.addColorStop(r, `rgb(${Math.round(m[0] * f)},${Math.round(m[1] * f)},${Math.round(m[2] * f)})`);
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, Rpx, 0, Math.PI * 2);
    ctx.fill();

    // path and planet
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = "rgba(211,218,230,0.3)";
    ctx.beginPath();
    ctx.moveTo(cx - span * Rpx, cy - s.b * Rpx);
    ctx.lineTo(cx + span * Rpx, cy - s.b * Rpx);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#05070a";
    ctx.strokeStyle = "rgba(211,218,230,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx + s.x * Rpx, cy - s.b * Rpx, Math.max(1.5, k * Rpx), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (k * Rpx < 3) {
      ctx.strokeStyle = t.skyMark;
      ctx.beginPath();
      ctx.arc(cx + s.x * Rpx, cy - s.b * Rpx, 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // light curve
    const N = 300;
    let maxD = 0;
    const pts = [];
    for (let q = 0; q <= N; q++) {
      const x = -span + (2 * span * q) / N;
      const d = deficit(x, k);
      maxD = Math.max(maxD, d);
      pts.push([x, 1 - d]);
    }
    const useppm = maxD < 0.002;
    const top = Math.max(maxD, 1e-5);
    const rect = { x: 66, y: topH + 18, w: w - 84, h: h - topH - 58 };
    const yt = [1, 1 - top / 2, 1 - top];
    const { X, Y } = kit.axes(ctx, rect, {
      xmin: -span, xmax: span, ymin: 1 - top * 1.25, ymax: 1 + top * 0.2,
      xticks: [], yticks: yt,
      yfmt: (v) => (useppm ? "−" + Math.round((1 - v) * 1e6) + " ppm" : ((v * 100).toFixed(2) + "%")).replace("−0 ppm", "0"),
      xlabel: "time",
    });
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach(([x, f], q) => (q ? ctx.lineTo(X(x), Y(f)) : ctx.moveTo(X(x), Y(f))));
    ctx.stroke();
    ctx.fillStyle = t.mark;
    ctx.beginPath();
    ctx.arc(X(s.x), Y(1 - deficit(s.x, k)), 5, 0, Math.PI * 2);
    ctx.fill();

    out.set("depth", useppm ? Math.round(maxD * 1e6) + " parts per million" : (maxD * 100).toFixed(2) + "%");
    out.set("k", k.toFixed(4));
    out.set("kind", s.b >= 1 + k ? "misses the star" : s.b > 1 - k ? "grazing" : "full crossing");
  });
});
