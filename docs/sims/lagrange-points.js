/* The restricted three-body problem in the frame that rotates with two
   massive bodies. Contours show the effective potential; the five Lagrange
   points are where gravity and the rotating frame's centrifugal pull balance.
   Drop test particles and watch them: near L4 or L5 they loop in tadpole
   orbits when the smaller body is light enough, near L1 they drift away. */
OrrerySims.register("lagrange-points", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 560 ? 1 : 0.62), max: 700, label: "Contours of effective potential around two orbiting bodies, with the five Lagrange points marked" });
  const p = kit.panel();
  const s = { mu: 0.0122, parts: [], field: null, fieldKey: "", L: [] };
  const COLORS = ["#e4607a", "#ffe7a8", "#8fe0c0", "#c9a4ff", "#ffb38a", "#9fd3ff"];
  let colorAt = 0;

  const presets = {
    earthmoon: ["Earth and Moon", 0.01215],
    sunjupiter: ["Sun and Jupiter", 0.000954],
    plutocharon: ["Pluto and Charon", 0.108],
    equal: ["Two equal stars", 0.5],
  };
  kit.select(p, {
    label: "Pair of bodies",
    options: Object.entries(presets).map(([k, v]) => [k, v[0]]),
    value: "earthmoon",
    onChange: (k) => muS.set(presets[k][1]),
  });
  const muS = kit.slider(p, {
    label: "Mass of the smaller body (share of the total)", min: 0.0005, max: 0.5, log: true, value: s.mu,
    format: (v) => (v * 100).toFixed(v < 0.01 ? 3 : 1) + "%",
    onInput: (v) => { s.mu = v; s.parts = []; },
  });
  kit.button(p, "Drop near L4", () => drop(s.L[3][0] + 0.012, s.L[3][1] + 0.01));
  kit.button(p, "Drop near L1", () => drop(s.L[0][0] - 0.004, 0.002));
  kit.button(p, "Clear", () => (s.parts = []));
  const out = kit.readouts(kit.root, [["L4", "L4 and L5"], ["L1", "L1 distance from smaller body"], ["n", "Test particles"]]);

  const omega = (x, y) => {
    const r1 = Math.hypot(x + s.mu, y), r2 = Math.hypot(x - 1 + s.mu, y);
    return (1 - s.mu) / r1 + s.mu / r2 + 0.5 * (x * x + y * y);
  };
  const dOdx = (x) => {
    const a = x + s.mu, b = x - 1 + s.mu;
    return x - ((1 - s.mu) * a) / Math.abs(a) ** 3 - (s.mu * b) / Math.abs(b) ** 3;
  };
  const root = (lo, hi) => {
    let flo = dOdx(lo);
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2, fm = dOdx(mid);
      if (Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm; } else hi = mid;
    }
    return (lo + hi) / 2;
  };
  function lagrange() {
    const e = 1e-6;
    return [
      [root(-s.mu + e, 1 - s.mu - e), 0],
      [root(1 - s.mu + e, 2.5), 0],
      [root(-2.5, -s.mu - e), 0],
      [0.5 - s.mu, Math.sqrt(3) / 2],
      [0.5 - s.mu, -Math.sqrt(3) / 2],
    ];
  }

  function accel(x, y, vx, vy) {
    const r1 = Math.hypot(x + s.mu, y), r2 = Math.hypot(x - 1 + s.mu, y);
    const r13 = r1 * r1 * r1, r23 = r2 * r2 * r2;
    const ax = 2 * vy + x - ((1 - s.mu) * (x + s.mu)) / r13 - (s.mu * (x - 1 + s.mu)) / r23;
    const ay = -2 * vx + y - ((1 - s.mu) * y) / r13 - (s.mu * y) / r23;
    return [ax, ay];
  }
  function step(q, h) {
    const f = (st) => { const [ax, ay] = accel(st[0], st[1], st[2], st[3]); return [st[2], st[3], ax, ay]; };
    const y0 = [q.x, q.y, q.vx, q.vy];
    const k1 = f(y0);
    const k2 = f(y0.map((v, i) => v + (h / 2) * k1[i]));
    const k3 = f(y0.map((v, i) => v + (h / 2) * k2[i]));
    const k4 = f(y0.map((v, i) => v + h * k3[i]));
    const n = y0.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    q.x = n[0]; q.y = n[1]; q.vx = n[2]; q.vy = n[3];
  }
  function drop(x, y) {
    s.parts.push({ x, y, vx: 0, vy: 0, trail: [], col: COLORS[colorAt++ % COLORS.length], dead: false });
    if (s.parts.length > 8) s.parts.shift();
  }

  s.L = lagrange();

  const view = () => {
    const { w, h } = c;
    const S = Math.min(w / 3.3, h / 2.7);
    return { S, cx: w / 2, cy: h / 2 };
  };
  kit.pointer(c, {
    down: (pt) => {
      const { S, cx, cy } = view();
      drop((pt.x - cx) / S, -(pt.y - cy) / S);
    },
  });

  // Contour map of the effective potential, cached until mu or size changes.
  // Shading is smooth; contour lines come from marching squares so they stay
  // thin and clean however steep the potential gets near the two bodies.
  function buildField() {
    const { w, h } = c;
    const key = [w, h, s.mu, c.dpr].join();
    if (key === s.fieldKey) return;
    s.fieldKey = key;
    s.L = lagrange();
    const { S, cx, cy } = view();
    const CAP = 6;
    const om = (x, y) => Math.min(CAP, omega(x, y));
    const c4 = om(s.L[3][0], s.L[3][1]);
    const c1 = om(s.L[0][0], 0), c2 = om(s.L[1][0], 0), c3 = om(s.L[2][0], 0);

    const buf = document.createElement("canvas");
    buf.width = Math.round(w * c.dpr);
    buf.height = Math.round(h * c.dpr);
    const b = buf.getContext("2d");
    b.setTransform(c.dpr, 0, 0, c.dpr, 0, 0);

    // smooth shading on a coarse grid, scaled up
    const step = 4;
    const gw = Math.ceil(w / step) + 1, gh = Math.ceil(h / step) + 1;
    const grid = new Float64Array(gw * gh);
    for (let j = 0; j < gh; j++)
      for (let i = 0; i < gw; i++) grid[j * gw + i] = om((i * step - cx) / S, -(j * step - cy) / S);
    const shade = document.createElement("canvas");
    shade.width = gw; shade.height = gh;
    const sctx = shade.getContext("2d");
    const img = sctx.createImageData(gw, gh);
    const hi = c1 + 0.9;
    for (let k = 0; k < gw * gh; k++) {
      const tt = kit.clamp((grid[k] - c4) / (hi - c4), 0, 1);
      const e = Math.sqrt(tt);
      img.data[k * 4] = 7 + e * 20;
      img.data[k * 4 + 1] = 10 + e * 28;
      img.data[k * 4 + 2] = 16 + e * 48;
      img.data[k * 4 + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
    b.imageSmoothingEnabled = true;
    b.drawImage(shade, 0, 0, gw * step, gh * step);

    // marching squares for one level
    const contour = (level) => {
      b.beginPath();
      for (let j = 0; j < gh - 1; j++) {
        for (let i = 0; i < gw - 1; i++) {
          const v0 = grid[j * gw + i], v1 = grid[j * gw + i + 1];
          const v2 = grid[(j + 1) * gw + i + 1], v3 = grid[(j + 1) * gw + i];
          const idx = (v0 > level) | ((v1 > level) << 1) | ((v2 > level) << 2) | ((v3 > level) << 3);
          if (idx === 0 || idx === 15) continue;
          const x = i * step, y = j * step;
          const f = (a, bb) => (level - a) / (bb - a);
          const top = [x + f(v0, v1) * step, y];
          const right = [x + step, y + f(v1, v2) * step];
          const bottom = [x + f(v3, v2) * step, y + step];
          const left = [x, y + f(v0, v3) * step];
          const seg = (p1, p2) => { b.moveTo(p1[0], p1[1]); b.lineTo(p2[0], p2[1]); };
          switch (idx) {
            case 1: case 14: seg(left, top); break;
            case 2: case 13: seg(top, right); break;
            case 3: case 12: seg(left, right); break;
            case 4: case 11: seg(right, bottom); break;
            case 5: seg(left, top); seg(right, bottom); break;
            case 6: case 9: seg(top, bottom); break;
            case 7: case 8: seg(left, bottom); break;
            case 10: seg(top, right); seg(left, bottom); break;
          }
        }
      }
      b.stroke();
    };

    b.lineWidth = 1;
    b.strokeStyle = "rgba(160,175,200,0.28)";
    for (let k = 1; k <= 14; k++) {
      const level = c4 + ((hi - c4) * k * k) / 196;
      if ([c1, c2, c3].some((cc) => Math.abs(cc - level) < 0.01)) continue;
      contour(level);
    }
    b.strokeStyle = "rgba(228,96,122,0.9)";
    b.lineWidth = 1.6;
    contour(c1);
    b.lineWidth = 1.1;
    b.strokeStyle = "rgba(228,96,122,0.6)";
    contour(c2);
    contour(c3);
    s.field = buf;
  }

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    buildField();
    ctx.drawImage(s.field, 0, 0, w, h);
    const { S, cx, cy } = view();
    const X = (x) => cx + x * S, Y = (y) => cy - y * S;

    // integrate: about one orbit of the pair every 4 seconds
    const T = dt * (2 * Math.PI / 4);
    const sub = 24;
    for (const q of s.parts) {
      if (q.dead) continue;
      for (let i = 0; i < sub; i++) {
        step(q, T / sub);
        const r1 = Math.hypot(q.x + s.mu, q.y), r2 = Math.hypot(q.x - 1 + s.mu, q.y);
        if (r1 < 0.02 || r2 < 0.01 || Math.hypot(q.x, q.y) > 3) { q.dead = true; break; }
      }
      q.trail.push([q.x, q.y]);
      if (q.trail.length > 900) q.trail.shift();
    }
    for (const q of s.parts) {
      ctx.strokeStyle = q.col;
      ctx.globalAlpha = q.dead ? 0.35 : 0.85;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      q.trail.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      ctx.stroke();
      if (!q.dead) {
        ctx.fillStyle = q.col;
        ctx.beginPath();
        ctx.arc(X(q.x), Y(q.y), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // the two bodies
    const r1 = 4 + 10 * Math.cbrt(1 - s.mu), r2 = 2 + 10 * Math.cbrt(s.mu);
    ctx.fillStyle = t.sun;
    ctx.beginPath(); ctx.arc(X(-s.mu), Y(0), r1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.skyAccent;
    ctx.beginPath(); ctx.arc(X(1 - s.mu), Y(0), r2, 0, Math.PI * 2); ctx.fill();

    // Lagrange points
    ctx.font = t.font;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    s.L.forEach(([x, y], i) => {
      ctx.strokeStyle = t.skyInk;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(X(x) - 5, Y(y)); ctx.lineTo(X(x) + 5, Y(y));
      ctx.moveTo(X(x), Y(y) - 5); ctx.lineTo(X(x), Y(y) + 5);
      ctx.stroke();
      ctx.fillStyle = t.skyInk;
      ctx.fillText("L" + (i + 1), X(x) + 6, Y(y) - 4);
    });
    ctx.font = t.small;
    ctx.fillStyle = t.skyMuted;
    ctx.textBaseline = "top";
    ctx.fillText(w < 560 ? "Click to release a particle." : "Click to release a particle. Red contours pass through L1, L2 and L3.", 10, 8);

    out.set("L4", s.mu < 0.0385 ? "stable (particles orbit them)" : "unstable (above 3.85%)");
    out.set("L1", (1 - s.mu - s.L[0][0]).toFixed(3) + " × separation");
    out.set("n", String(s.parts.filter((q) => !q.dead).length));
  });
});
