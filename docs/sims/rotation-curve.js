/* Galaxy rotation curves: stars and gas alone predict orbital speeds that
   fall off in the outskirts; measured speeds stay flat. Add a dark-matter
   halo until the model runs through the measurements. */
OrrerySims.register("rotation-curve", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 640 ? 1.4 : 0.52), max: 800, label: "A spiral galaxy rotating, beside its rotation curve with measured speeds and model components" });
  const p = kit.panel();
  const G = 4.3009e-6;                 // kpc (km/s)^2 per solar mass
  const RMAX = 30;
  const s = { Md: 5e10, Rd: 3, Mb: 1e10, ab: 0.6, vh: 0, rc: 4.5, parts: true, table: null };

  // --- Bessel functions (Abramowitz & Stegun polynomial fits)
  const I0 = (x) => {
    if (x <= 3.75) { const t = (x / 3.75) ** 2; return 1 + t * (3.5156229 + t * (3.0899424 + t * (1.2067492 + t * (0.2659732 + t * (0.0360768 + t * 0.0045813))))); }
    const t = 3.75 / x;
    return (Math.exp(x) / Math.sqrt(x)) * (0.39894228 + t * (0.01328592 + t * (0.00225319 + t * (-0.00157565 + t * (0.00916281 + t * (-0.02057706 + t * (0.02635537 + t * (-0.01647633 + t * 0.00392377))))))));
  };
  const I1 = (x) => {
    if (x <= 3.75) { const t = (x / 3.75) ** 2; return x * (0.5 + t * (0.87890594 + t * (0.51498869 + t * (0.15084934 + t * (0.02658733 + t * (0.00301532 + t * 0.00032411)))))); }
    const t = 3.75 / x;
    return (Math.exp(x) / Math.sqrt(x)) * (0.39894228 + t * (-0.03988024 + t * (-0.00362018 + t * (0.00163801 + t * (-0.01031555 + t * (0.02282967 + t * (-0.02895312 + t * (0.01787654 - t * 0.00420059))))))));
  };
  const K0 = (x) => {
    if (x <= 2) { const t = (x * x) / 4; return -Math.log(x / 2) * I0(x) + (-0.57721566 + t * (0.4227842 + t * (0.23069756 + t * (0.0348859 + t * (0.00262698 + t * (0.0001075 + t * 0.0000074)))))); }
    const t = 2 / x;
    return (Math.exp(-x) / Math.sqrt(x)) * (1.25331414 + t * (-0.07832358 + t * (0.02189568 + t * (-0.01062446 + t * (0.00587872 + t * (-0.0025154 + t * 0.00053208))))));
  };
  const K1 = (x) => {
    if (x <= 2) { const t = (x * x) / 4; return Math.log(x / 2) * I1(x) + (1 / x) * (1 + t * (0.15443144 + t * (-0.67278579 + t * (-0.18156897 + t * (-0.01919402 + t * (-0.00110404 - t * 0.00004686)))))); }
    const t = 2 / x;
    return (Math.exp(-x) / Math.sqrt(x)) * (1.25331414 + t * (0.23498619 + t * (-0.0365562 + t * (0.01504268 + t * (-0.00780353 + t * (0.00325614 - t * 0.00068245))))));
  };

  const v2disk = (r, m = s) => {
    const y = Math.max(r, 1e-3) / (2 * m.Rd);
    return ((2 * G * m.Md) / m.Rd) * y * y * (I0(y) * K0(y) - I1(y) * K1(y));
  };
  const v2bulge = (r, m = s) => (G * m.Mb * r) / (r + m.ab) ** 2;
  const v2halo = (r, m = s) => (r < 1e-3 ? 0 : m.vh * m.vh * (1 - (m.rc / r) * Math.atan(r / m.rc)));
  const vtot = (r, m = s) => Math.sqrt(Math.max(0, v2disk(r, m) + v2bulge(r, m) + v2halo(r, m)));

  // "measured" speeds: a hidden model with a halo, plus measurement scatter
  const truth = { Md: 5e10, Rd: 3, Mb: 1e10, ab: 0.6, vh: 178, rc: 4.5 };
  const rand = kit.rng(4242);
  const data = [];
  for (let r = 1.5; r <= 29; r += 1.75) {
    const err = 5 + r * 0.25;
    data.push([r, vtot(r, truth) + (rand() - 0.5) * 2 * err, err]);
  }

  kit.slider(p, { label: "Mass of the stellar disc", min: 1e10, max: 1.5e11, log: true, value: s.Md, format: (v) => (v / 1e10).toFixed(1) + " × 10¹⁰ Suns", onInput: (v) => { s.Md = v; rebuild(); } });
  const vhS = kit.slider(p, { label: "Dark-matter halo (speed it supports far out)", min: 0, max: 280, step: 1, value: s.vh, format: (v) => v + " km/s", onInput: (v) => { s.vh = v; rebuild(); } });
  kit.slider(p, { label: "Halo core radius", min: 1, max: 15, step: 0.1, value: s.rc, format: (v) => v.toFixed(1) + " kpc", onInput: (v) => { s.rc = v; rebuild(); } });
  kit.toggle(p, { label: "Show each component", value: true, onChange: (v) => (s.parts = v) });
  kit.button(p, "Rewind the galaxy", () => resetStars());
  const out = kit.readouts(kit.root, [["fit", "Mismatch with measurements"], ["v20", "Speed at 20 kpc"], ["m20", "Mass inside 20 kpc"], ["dm", "Dark matter inside 20 kpc"]]);
  void vhS;

  // --- stars of the galaxy
  const stars = [];
  function resetStars() {
    stars.length = 0;
    const rr = kit.rng(99);
    for (let i = 0; i < 2600; i++) {
      let r = rr() < 0.72 ? -4 * Math.log(1 - rr() * 0.99) : 2 + rr() * 19;
      r = kit.clamp(r, 0.25, 22);
      const bulge = i < 260;
      if (bulge) r = Math.abs(rr() - rr()) * 2.2 + 0.1;
      let th;
      if (!bulge && rr() < 0.7) {
        const arm = rr() < 0.5 ? 0 : Math.PI;
        th = arm + Math.log(r / 0.8) / Math.tan(0.28) + (rr() - 0.5) * 0.55;
      } else th = rr() * Math.PI * 2;
      stars.push({ r, th, b: 0.35 + rr() * 0.65, warm: bulge || r < 2.5 });
    }
  }
  resetStars();

  function rebuild() {
    const n = 301;
    s.table = new Float64Array(n);
    for (let i = 0; i < n; i++) s.table[i] = vtot((i / (n - 1)) * RMAX);
  }
  const vAt = (r) => {
    const f = (kit.clamp(r, 0, RMAX) / RMAX) * (s.table.length - 1);
    const i = Math.floor(f), j = Math.min(i + 1, s.table.length - 1);
    return s.table[i] + (s.table[j] - s.table[i]) * (f - i);
  };
  rebuild();

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    const wide = w >= 640;
    const gal = wide ? { x: 0, y: 0, w: h, h } : { x: 0, y: 0, w, h: h * 0.5 };
    const plot = wide ? { x: h + 62, y: 24, w: w - h - 80, h: h - 72 } : { x: 58, y: h * 0.5 + 24, w: w - 76, h: h * 0.5 - 72 };

    ctx.fillStyle = t.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = t.sky;
    ctx.fillRect(gal.x, gal.y, gal.w, gal.h);

    // advance: 1 second on screen = 30 million years
    const myr = dt * 30;
    const cx = gal.x + gal.w / 2, cy = gal.y + gal.h / 2;
    const S = (Math.min(gal.w, gal.h) / 2 - 10) / 21;
    for (const st of stars) {
      st.th += (vAt(st.r) / st.r) * 1.0227e-3 * myr;
      const x = cx + st.r * Math.cos(st.th) * S, y = cy + st.r * Math.sin(st.th) * S * 0.92;
      if (x < gal.x || x > gal.x + gal.w) continue;
      ctx.fillStyle = st.warm ? `rgba(255,222,170,${st.b})` : `rgba(180,205,255,${st.b})`;
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.strokeStyle = "rgba(228,96,122,0.5)";
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, 20 * S, 20 * S * 0.92, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = t.small;
    ctx.fillStyle = t.skyMuted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("dashed circle: 20 kpc", gal.x + 10, gal.y + 8);

    // rotation curve
    const { X, Y } = kit.axes(ctx, plot, {
      xmin: 0, xmax: RMAX, ymin: 0, ymax: 300,
      xticks: [0, 5, 10, 15, 20, 25, 30], yticks: [0, 100, 200, 300],
      xlabel: "distance from the centre (kpc)", ylabel: "orbital speed (km/s)",
    });
    const curve = (fn, color, width, dash) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash || []);
      ctx.beginPath();
      for (let i = 0; i <= 150; i++) {
        const r = 0.05 + (i / 150) * (RMAX - 0.05);
        const y = Y(Math.min(300, fn(r)));
        i ? ctx.lineTo(X(r), y) : ctx.moveTo(X(r), y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };
    if (s.parts) {
      curve((r) => Math.sqrt(v2disk(r)), t.muted, 1.2, [5, 4]);
      curve((r) => Math.sqrt(v2bulge(r)), t.muted, 1.2, [1, 3]);
      if (s.vh > 0) curve((r) => Math.sqrt(v2halo(r)), t.mark, 1.2, [5, 4]);
    }
    curve((r) => vtot(r), t.accent, 2.2);
    ctx.strokeStyle = t.ink;
    ctx.fillStyle = t.ink;
    ctx.lineWidth = 1;
    for (const [r, v, e] of data) {
      ctx.beginPath();
      ctx.moveTo(X(r), Y(v - e)); ctx.lineTo(X(r), Y(v + e));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(X(r), Y(v), 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (s.parts) {
      ctx.font = t.small;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = t.muted;
      ctx.fillText("stars in the disc", X(RMAX) - 4, Y(Math.sqrt(v2disk(RMAX - 1))) - 4);
      if (s.vh > 0) { ctx.fillStyle = t.mark; ctx.fillText("dark matter", X(RMAX) - 4, Y(Math.sqrt(v2halo(RMAX - 1))) - 4); }
    }

    const rms = Math.sqrt(data.reduce((a, [r, v]) => a + (vtot(r) - v) ** 2, 0) / data.length);
    const v20 = vtot(20);
    out.set("fit", Math.round(rms) + " km/s" + (rms < 12 ? " (a good fit)" : ""));
    out.set("v20", Math.round(v20) + " km/s");
    out.set("m20", ((v20 * v20 * 20) / G / 1e11).toFixed(1) + " × 10¹¹ Suns");
    out.set("dm", Math.round((v2halo(20) / (v20 * v20 || 1)) * 100) + "%");
  });
});
