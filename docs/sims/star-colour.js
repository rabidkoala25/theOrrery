/* A star's colour and brightness: temperature sets the shape of the black-body
   spectrum (and so the colour), temperature and size together set the
   luminosity, and the pair places the star on the Hertzsprung–Russell diagram. */
OrrerySims.register("star-colour", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 720 ? 1.15 : 0.42), max: 720, label: "A star's disc, its black-body spectrum, and its place on the Hertzsprung–Russell diagram" });
  const p = kit.panel();
  const SUN_T = 5772;
  const s = { T: SUN_T, R: 1 };

  const presets = {
    sun: ["The Sun", 5772, 1],
    proxima: ["Proxima Centauri", 3042, 0.154],
    sirius: ["Sirius A", 9940, 1.71],
    rigel: ["Rigel", 12100, 79],
    betelgeuse: ["Betelgeuse", 3600, 760],
    siriusb: ["Sirius B (white dwarf)", 25000, 0.0084],
  };
  const pick = kit.select(p, {
    label: "Start from a real star",
    options: Object.entries(presets).map(([k, v]) => [k, v[0]]),
    value: "sun",
    onChange: (k) => {
      const [, T, R] = presets[k];
      tSlider.set(T, false);
      rSlider.set(R, false);
      s.T = T; s.R = R;
      draw();
    },
  });
  const tSlider = kit.slider(p, { label: "Surface temperature", min: 2400, max: 40000, log: true, value: s.T, format: (v) => Math.round(v / 10) * 10 + " K", onInput: (v) => { s.T = v; draw(); } });
  const rSlider = kit.slider(p, { label: "Radius", min: 0.005, max: 1000, log: true, value: s.R, format: (v) => fmt(v) + " × the Sun", onInput: (v) => { s.R = v; draw(); } });
  const out = kit.readouts(kit.root, [["L", "Luminosity"], ["peak", "Brightest wavelength"], ["cls", "Spectral class"], ["kind", "Where it sits"]]);

  function fmt(v) {
    if (v >= 100) return Math.round(v).toLocaleString("en-US");
    if (v >= 10) return v.toFixed(1);
    if (v >= 0.1) return v.toFixed(2);
    if (v >= 0.001) return v.toFixed(4);
    return v.toExponential(1);
  }

  // approximate main sequence, (log T, log L)
  const MS = [[4.65, 5.8], [4.5, 4.5], [4.3, 3.3], [4.1, 2.2], [3.98, 1.5], [3.9, 1.0], [3.84, 0.6], [3.78, 0.15], [3.761, 0], [3.72, -0.4], [3.66, -0.8], [3.58, -1.3], [3.52, -2.0], [3.45, -2.9]];
  const msL = (lt) => {
    for (let i = 0; i < MS.length - 1; i++) {
      const [t0, l0] = MS[i], [t1, l1] = MS[i + 1];
      if (lt <= t0 && lt >= t1) return l0 + ((lt - t0) / (t1 - t0)) * (l1 - l0);
    }
    return lt > MS[0][0] ? MS[0][1] : MS[MS.length - 1][1];
  };
  const spectralClass = (T) =>
    T >= 30000 ? "O" : T >= 10000 ? "B" : T >= 7500 ? "A" : T >= 6000 ? "F" : T >= 5200 ? "G" : T >= 3700 ? "K" : "M";

  const planck = (lam, T) => 1 / (Math.pow(lam, 5) * (Math.exp(1.4388e7 / (lam * T)) - 1));

  function waveColor(l) {
    let r = 0, g = 0, b = 0;
    if (l >= 380 && l < 440) { r = -(l - 440) / 60; b = 1; }
    else if (l < 490) { g = (l - 440) / 50; b = 1; }
    else if (l < 510) { g = 1; b = -(l - 510) / 20; }
    else if (l < 580) { r = (l - 510) / 70; g = 1; }
    else if (l < 645) { r = 1; g = -(l - 645) / 65; }
    else if (l <= 750) { r = 1; }
    const f = l < 420 ? 0.3 + (0.7 * (l - 380)) / 40 : l > 700 ? 0.3 + (0.7 * (750 - l)) / 50 : 1;
    const q = (x) => Math.round(255 * Math.pow(Math.max(0, x * f), 0.8));
    return `rgb(${q(r)},${q(g)},${q(b)})`;
  }

  function draw() {
    const { ctx, w, h } = c;
    const t = kit.theme();
    ctx.fillStyle = t.paper;
    ctx.fillRect(0, 0, w, h);

    const wide = w >= 720;
    const starBox = wide ? { x: 0, y: 0, w: w * 0.26, h } : { x: 0, y: 0, w: w * 0.38, h: h * 0.42 };
    const specBox = wide ? { x: w * 0.26, y: 0, w: w * 0.37, h } : { x: w * 0.38, y: 0, w: w * 0.62, h: h * 0.42 };
    const hrBox = wide ? { x: w * 0.63, y: 0, w: w * 0.37, h } : { x: 0, y: h * 0.42, w, h: h * 0.58 };

    // --- the star itself, radius on a log scale, Sun's size dashed for reference
    ctx.fillStyle = t.sky;
    ctx.fillRect(starBox.x, starBox.y, starBox.w, starBox.h);
    const maxR = Math.min(starBox.w, starBox.h) / 2 - 12;
    const rpx = (R) => 3 + (maxR - 3) * kit.clamp((Math.log10(R) + 2.4) / 5.4, 0, 1);
    const cx = starBox.x + starBox.w / 2, cy = starBox.y + starBox.h / 2;
    const col = kit.starColor(s.T);
    const r = rpx(s.R);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.35);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.3, col);
    g.addColorStop(0.74, col);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = t.skyMuted;
    ctx.beginPath();
    ctx.arc(cx, cy, rpx(1), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = t.small;
    ctx.fillStyle = t.skyMuted;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("dashed: the Sun's size", cx, starBox.y + starBox.h - 8);

    // --- black-body spectrum, log wavelength axis
    const sr = { x: specBox.x + 50, y: specBox.y + 22, w: specBox.w - 66, h: specBox.h - 64 };
    const lmin = 90, lmax = 3000;
    const { X, Y } = kit.axes(ctx, sr, {
      xmin: lmin, xmax: lmax, ymin: 0, ymax: 1.08, logx: true,
      xticks: [100, 300, 1000, 3000], yticks: [0, 0.5, 1],
      xfmt: (v) => String(v), yfmt: (v) => v.toFixed(1),
      xlabel: "wavelength (nm)",
    });
    const lpeak = 2.898e6 / s.T;
    const norm = planck(lpeak, s.T);
    // visible band as a strip under the curve
    for (let l = 380; l <= 750; l += 2) {
      ctx.fillStyle = waveColor(l);
      const x0 = X(l), x1 = X(l + 2);
      const y = Y(planck(l + 1, s.T) / norm);
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x0, y, x1 - x0 + 0.6, sr.y + sr.h - y);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = t.ink;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let k = 0; k <= 240; k++) {
      const l = lmin * Math.pow(lmax / lmin, k / 240);
      const y = Y(Math.min(1.08, planck(l, s.T) / norm));
      k ? ctx.lineTo(X(l), y) : ctx.moveTo(X(l), y);
    }
    ctx.stroke();
    if (lpeak >= lmin) {
      ctx.strokeStyle = t.mark;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(X(lpeak), sr.y);
      ctx.lineTo(X(lpeak), sr.y + sr.h);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.font = t.small;
    ctx.fillStyle = t.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("ultraviolet", sr.x + 4, sr.y + 4);
    ctx.textAlign = "right";
    ctx.fillText("infrared", sr.x + sr.w - 4, sr.y + 4);

    // --- Hertzsprung–Russell diagram: temperature runs right to left
    const hr = { x: hrBox.x + 54, y: hrBox.y + 22, w: hrBox.w - 70, h: hrBox.h - 64 };
    const logT = Math.log10(s.T);
    const logL = 2 * Math.log10(s.R) + 4 * Math.log10(s.T / SUN_T);
    const H = kit.axes(ctx, hr, {
      xmin: 4.72, xmax: 3.36, ymin: -5, ymax: 6.5,
      xticks: [Math.log10(40000), Math.log10(10000), Math.log10(5000), Math.log10(3000)],
      yticks: [-4, -2, 0, 2, 4, 6],
      xfmt: (v) => Math.round(Math.pow(10, v) / 100) * 100 + " K",
      yfmt: (v) => (v === 0 ? "1" : "10" + toSup(v)),
      xlabel: "surface temperature",
      ylabel: "luminosity (Sun = 1)",
    });
    ctx.strokeStyle = t.accentSoft;
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.beginPath();
    MS.forEach(([lt, ll], i) => (i ? ctx.lineTo(H.X(lt), H.Y(ll)) : ctx.moveTo(H.X(lt), H.Y(ll))));
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.font = t.small;
    ctx.fillStyle = t.muted;
    ctx.textAlign = "center";
    ctx.fillText("main sequence", H.X(4.25), H.Y(2.3));
    ctx.fillText("giants", H.X(3.62), H.Y(2.6));
    ctx.fillText("white dwarfs", H.X(4.2), H.Y(-3.4));
    // the Sun
    ctx.strokeStyle = t.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(H.X(Math.log10(SUN_T)), H.Y(0), 4, 0, Math.PI * 2);
    ctx.stroke();
    // our star
    const sx = H.X(kit.clamp(logT, 3.36, 4.72)), sy = H.Y(kit.clamp(logL, -5, 6.5));
    ctx.fillStyle = col;
    ctx.strokeStyle = t.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const L = Math.pow(10, logL);
    const d = logL - msL(logT);
    const kind = d < -1.8 ? "white dwarf region" : Math.abs(d) <= 0.8 ? "main sequence" : d > 0.8 ? (logL > 4 ? "supergiant region" : "giant region") : "below the main sequence";
    out.set("L", fmt(L) + " × the Sun");
    out.set("peak", Math.round(lpeak) + " nm" + (lpeak < 380 ? " (ultraviolet)" : lpeak > 750 ? " (infrared)" : ""));
    out.set("cls", spectralClass(s.T));
    out.set("kind", kind);
  }

  function toSup(n) {
    const map = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
    return String(n).split("").map((ch) => map[ch] || ch).join("");
  }

  c.onResize(draw);
  kit.onTheme(draw);
  draw();
  void pick;
});
