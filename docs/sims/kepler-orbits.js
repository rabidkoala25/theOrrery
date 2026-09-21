/* Kepler's laws: an ellipse with the Sun at one focus, equal areas in equal
   times, and a period that grows as the 3/2 power of the orbit's size. */
OrrerySims.register("kepler-orbits", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 560 ? 0.9 : 0.56), label: "A planet on an elliptical orbit around the Sun, with the orbit divided into twelve sectors of equal area" });
  const p = kit.panel();
  const s = { a: 1.52, e: 0.45, rate: 0.6, areas: true, M: 0 };

  kit.slider(p, { label: "Orbit size (semi-major axis)", min: 0.4, max: 5.2, step: 0.01, value: s.a, format: (v) => v.toFixed(2) + " AU", onInput: (v) => (s.a = v) });
  kit.slider(p, { label: "Eccentricity", min: 0, max: 0.9, step: 0.01, value: s.e, format: (v) => v.toFixed(2), onInput: (v) => (s.e = v) });
  kit.slider(p, { label: "Time", min: 0.1, max: 3, step: 0.05, value: s.rate, format: (v) => v.toFixed(2) + " years per second", onInput: (v) => (s.rate = v) });
  kit.toggle(p, { label: "Show equal-area sectors", value: true, onChange: (v) => (s.areas = v) });
  const out = kit.readouts(kit.root, [["P", "Period"], ["r", "Distance from Sun"], ["v", "Orbital speed"], ["q", "Closest / farthest"]]);

  const solveE = (M, e) => {
    let E = e < 0.8 ? M : Math.PI;
    for (let i = 0; i < 12; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    return E;
  };
  const posAt = (M) => {
    const E = solveE(M, s.e);
    const b = s.a * Math.sqrt(1 - s.e * s.e);
    return [s.a * (Math.cos(E) - s.e), b * Math.sin(E)];
  };

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    const P = Math.pow(s.a, 1.5);
    s.M = (s.M + (2 * Math.PI * s.rate * dt) / P) % (2 * Math.PI);

    const b = s.a * Math.sqrt(1 - s.e * s.e);
    const scale = Math.min((w * 0.86) / (2 * s.a), (h * 0.8) / (2 * b));
    const fx = w / 2 + s.a * s.e * scale, fy = h / 2;
    const X = (x) => fx + x * scale, Y = (y) => fy - y * scale;

    ctx.fillStyle = t.sky;
    ctx.fillRect(0, 0, w, h);

    // equal-area sectors: each spans one twelfth of the period
    const n = 12;
    const current = Math.floor((s.M / (2 * Math.PI)) * n);
    if (s.areas) {
      for (let k = 0; k < n; k++) {
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        for (let j = 0; j <= 16; j++) {
          const [x, y] = posAt(((k + j / 16) / n) * 2 * Math.PI);
          ctx.lineTo(X(x), Y(y));
        }
        ctx.closePath();
        ctx.fillStyle = k === current ? "rgba(143,179,238,0.42)" : k % 2 ? "rgba(143,179,238,0.16)" : "rgba(143,179,238,0.07)";
        ctx.fill();
      }
    }

    // the orbit
    ctx.strokeStyle = "rgba(211,218,230,0.55)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(w / 2, fy, s.a * scale, b * scale, 0, 0, Math.PI * 2);
    ctx.stroke();

    // the empty focus, faintly
    ctx.fillStyle = t.skyMuted;
    ctx.beginPath();
    ctx.arc(w / 2 - s.a * s.e * scale, fy, 2, 0, Math.PI * 2);
    ctx.fill();

    // the Sun
    const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 16);
    g.addColorStop(0, "#fff6d8");
    g.addColorStop(0.35, t.sun);
    g.addColorStop(1, "rgba(255,231,168,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(fx, fy, 16, 0, Math.PI * 2);
    ctx.fill();

    // the planet and the line that sweeps the area
    const [px, py] = posAt(s.M);
    ctx.strokeStyle = "rgba(143,179,238,0.8)";
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(X(px), Y(py));
    ctx.stroke();
    ctx.fillStyle = t.skyAccent;
    ctx.beginPath();
    ctx.arc(X(px), Y(py), 5.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = t.small;
    ctx.fillStyle = t.skyMuted;
    ctx.textBaseline = "top";
    ctx.textAlign = "right";
    ctx.fillText("closest", X(s.a * (1 - s.e)) - 6, fy + 6);
    ctx.textAlign = "left";
    ctx.fillText("farthest", X(-s.a * (1 + s.e)) + 6, fy + 6);

    const r = Math.hypot(px, py);
    const v = 29.78 * Math.sqrt(2 / r - 1 / s.a);
    out.set("P", P.toFixed(2) + " years");
    out.set("r", r.toFixed(2) + " AU");
    out.set("v", v.toFixed(1) + " km/s");
    out.set("q", (s.a * (1 - s.e)).toFixed(2) + " / " + (s.a * (1 + s.e)).toFixed(2) + " AU");
  });
});
