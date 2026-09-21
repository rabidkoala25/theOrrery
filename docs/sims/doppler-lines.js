/* Doppler shift: a moving source bunches its waves up ahead of it and
   stretches them out behind. In a spectrum, every absorption line moves
   by the same factor, 1 + z. */
OrrerySims.register("doppler-lines", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 560 ? 0.95 : 0.52), label: "A moving light source emitting waves, above two spectra: at rest and as observed" });
  const p = kit.panel();
  const C = 299792.458;
  const s = { beta: 0.05, x: 0.5, waves: [], clock: 0 };

  const LINES = [
    ["Ca K", 393.4], ["Ca H", 396.8], ["Hδ", 410.2], ["Hγ", 434.0],
    ["Hβ", 486.1], ["Mg", 517.3], ["Na D", 589.3], ["Hα", 656.3],
  ];
  const presets = {
    star: ["A nearby star, 30 km/s away", 30 / C],
    andromeda: ["Andromeda Galaxy, 300 km/s towards us", -300 / C],
    virgo: ["Virgo Cluster, 1,200 km/s away", 1200 / C],
    quasar: ["Quasar 3C 273, z = 0.158", 0.1457],
    far: ["A distant galaxy, z = 0.5", 0.3846],
  };
  kit.select(p, {
    label: "Try a real object",
    options: [["", "Choose…"], ...Object.entries(presets).map(([k, v]) => [k, v[0]])],
    value: "",
    onChange: (k) => { if (presets[k]) vSlider.set(presets[k][1]); },
  });
  const vSlider = kit.slider(p, {
    label: "Speed along the line of sight (positive: moving away)",
    min: -0.5, max: 0.5, step: 0.0001, value: s.beta,
    format: (b) => Math.round(b * C).toLocaleString("en-US") + " km/s",
    onInput: (b) => { s.beta = b; s.waves = []; },
  });
  const out = kit.readouts(kit.root, [["z", "Redshift z"], ["ha", "Hα observed at"], ["shift", "Hα moved by"], ["dir", "Direction"]]);

  const zOf = (b) => Math.sqrt((1 + b) / (1 - b)) - 1;

  function waveColor(l) {
    let r = 0, g = 0, b = 0;
    if (l >= 380 && l < 440) { r = -(l - 440) / 60; b = 1; }
    else if (l >= 440 && l < 490) { g = (l - 440) / 50; b = 1; }
    else if (l >= 490 && l < 510) { g = 1; b = -(l - 510) / 20; }
    else if (l >= 510 && l < 580) { r = (l - 510) / 70; g = 1; }
    else if (l >= 580 && l < 645) { r = 1; g = -(l - 645) / 65; }
    else if (l >= 645 && l <= 750) { r = 1; }
    else return null;
    const f = l < 420 ? 0.3 + (0.7 * (l - 380)) / 40 : l > 700 ? 0.3 + (0.7 * (750 - l)) / 50 : 1;
    const q = (x) => Math.round(255 * Math.pow(Math.max(0, x * f), 0.8));
    return `rgb(${q(r)},${q(g)},${q(b)})`;
  }

  function strip(ctx, rect, z, label, t) {
    const lmin = 300, lmax = 1000;
    const X = (l) => rect.x + ((l - lmin) / (lmax - lmin)) * rect.w;
    for (let l = lmin; l < lmax; l += 1) {
      ctx.fillStyle = waveColor(l) || (l < 380 ? "#2a2440" : "#3a1e1e");
      ctx.fillRect(X(l), rect.y, X(l + 1) - X(l) + 0.6, rect.h);
    }
    ctx.font = t.small;
    ctx.fillStyle = t.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(label, rect.x, rect.y - 4);
    const xs = [];
    for (const [name, l0] of LINES) {
      const l = l0 * (1 + z);
      const x = X(l);
      xs.push(x);
      if (l < lmin || l > lmax) continue;
      ctx.fillStyle = "rgba(8,8,12,0.88)";
      ctx.fillRect(x - 1.2, rect.y, 2.4, rect.h);
    }
    return { X, xs };
  }

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    const z = zOf(s.beta);

    // ---- the moving source and its wavefronts
    const topH = Math.round(h * 0.5);
    ctx.fillStyle = t.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = t.sky;
    ctx.fillRect(0, 0, w, topH);

    const cv = 150;                        // wave speed on screen, px/s
    const vs = -s.beta * cv;               // moving away from the observer (on the right) = leftward
    s.clock += dt;
    s.x += (vs * dt) / w;
    if (s.x < 0.12) s.x = 0.62;
    if (s.x > 0.62) s.x = 0.12;
    const srcX = s.x * w, srcY = topH / 2;
    if (s.clock > 0.22) {
      s.clock = 0;
      s.waves.push({ x: srcX, r: 0 });
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, topH);
    ctx.clip();
    ctx.lineWidth = 1.3;
    s.waves = s.waves.filter((wv) => (wv.r += cv * dt) < w * 1.2);
    for (const wv of s.waves) {
      ctx.strokeStyle = `rgba(143,179,238,${Math.max(0.12, 0.8 - wv.r / (w * 1.1))})`;
      ctx.beginPath();
      ctx.arc(wv.x, srcY, wv.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = t.sun;
    ctx.beginPath();
    ctx.arc(srcX, srcY, 7, 0, Math.PI * 2);
    ctx.fill();
    // arrow for direction of motion
    if (Math.abs(s.beta) > 0.002) {
      const dir = Math.sign(vs);
      ctx.strokeStyle = t.sun;
      ctx.beginPath();
      ctx.moveTo(srcX + dir * 14, srcY);
      ctx.lineTo(srcX + dir * 38, srcY);
      ctx.lineTo(srcX + dir * 32, srcY - 5);
      ctx.moveTo(srcX + dir * 38, srcY);
      ctx.lineTo(srcX + dir * 32, srcY + 5);
      ctx.stroke();
    }
    // the observer
    const ox = w - 34;
    ctx.fillStyle = t.skyInk;
    ctx.beginPath();
    ctx.moveTo(ox - 8, srcY - 12);
    ctx.lineTo(ox + 8, srcY);
    ctx.lineTo(ox - 8, srcY + 12);
    ctx.closePath();
    ctx.fill();
    ctx.font = t.small;
    ctx.fillStyle = t.skyMuted;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("observer", w - 12, srcY + 18);
    ctx.textAlign = "left";
    ctx.fillText("waves slowed for display, source speed to scale", 10, 8);

    // ---- spectra
    const pad = 16;
    const stripH = Math.max(22, (h - topH) * 0.2);
    const r1 = { x: pad, y: topH + 30, w: w - pad * 2, h: stripH };
    const r2 = { x: pad, y: h - stripH - 26, w: w - pad * 2, h: stripH };
    const a = strip(ctx, r1, 0, "At rest, as measured in a laboratory", t);
    const b = strip(ctx, r2, z, "Observed from the moving source", t);
    // connect each line to where it lands
    ctx.strokeStyle = t.muted;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    for (let k = 0; k < LINES.length; k++) {
      const x1 = a.xs[k], x2 = b.xs[k];
      if (x2 < r2.x || x2 > r2.x + r2.w) continue;
      ctx.beginPath();
      ctx.moveTo(x1, r1.y + r1.h);
      ctx.lineTo(x2, r2.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.font = t.small;
    ctx.fillStyle = t.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const lam of [400, 500, 600, 700, 800, 900]) ctx.fillText(w < 560 ? String(lam) : lam + " nm", a.X(lam), r2.y + r2.h + 4);
    if (w < 560) { ctx.textAlign = "right"; ctx.fillText("nm", r2.x + r2.w, r2.y + r2.h + 4); }
    for (let k = 0; k < LINES.length; k++) {
      const show = w < 560 ? [4, 6, 7] : [1, 3, 4, 6, 7];   // a readable subset
      if (!show.includes(k)) continue;
      ctx.fillText(LINES[k][0], a.xs[k], r1.y + r1.h + 3);
    }

    const ha = 656.3 * (1 + z);
    out.set("z", z.toFixed(z < 0.01 && z > -0.01 ? 5 : 3));
    out.set("ha", ha.toFixed(2) + " nm" + (ha > 750 ? " (infrared)" : ""));
    out.set("shift", (ha - 656.3 >= 0 ? "+" : "") + (ha - 656.3).toFixed(2) + " nm");
    out.set("dir", s.beta > 0.0001 ? "moving away: redshift" : s.beta < -0.0001 ? "approaching: blueshift" : "at rest");
  });
});
