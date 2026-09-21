/* Cepheids as standard candles: the longer a Cepheid takes to pulse, the more
   luminous it is (Leavitt's law). Time the pulses to get its true brightness,
   compare with how bright it looks, and the difference gives its distance. */
OrrerySims.register("cepheid-distance", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 720 ? 1.15 : 0.42), max: 720, label: "A pulsating Cepheid star, its light curve, and the period-luminosity relation" });
  const p = kit.panel();
  const s = { P: 5.366, d: 273, phase: 0 };
  const presets = {
    delcep: ["Delta Cephei, the prototype", 5.366, 273],
    lmc: ["A Cepheid in the Large Magellanic Cloud", 10, 49600],
    v1: ["Hubble's V1 in the Andromeda Galaxy", 31.4, 765000],
    m100: ["A Cepheid in M100, in the Virgo Cluster", 40, 16.1e6],
  };
  kit.select(p, {
    label: "Pick a Cepheid",
    options: Object.entries(presets).map(([k, v]) => [k, v[0]]),
    value: "delcep",
    onChange: (k) => { PS.set(presets[k][1]); dS.set(presets[k][2]); },
  });
  const PS = kit.slider(p, { label: "Pulsation period", min: 1, max: 100, log: true, value: s.P, format: (v) => v.toFixed(v < 10 ? 2 : 1) + " days", onInput: (v) => (s.P = v) });
  const dS = kit.slider(p, { label: "Distance", min: 10, max: 3e7, log: true, value: s.d, format: fmtDist, onInput: (v) => (s.d = v) });
  const out = kit.readouts(kit.root, [["L", "True luminosity"], ["M", "Absolute magnitude"], ["m", "Looks like magnitude"], ["see", "To see it you need"]]);

  function fmtDist(pc) {
    const ly = pc * 3.2616;
    if (pc < 1000) return Math.round(pc) + " pc (" + Math.round(ly).toLocaleString("en-US") + " light years)";
    if (pc < 1e6) return (pc / 1000).toFixed(pc < 1e4 ? 2 : 0) + " kpc (" + Math.round(ly / 1000).toLocaleString("en-US") + " thousand ly)";
    return (pc / 1e6).toFixed(1) + " Mpc (" + (ly / 1e6).toFixed(0) + " million ly)";
  }
  const absMag = (P) => -2.43 * (Math.log10(P) - 1) - 4.05;          // V band
  const amp = (P) => 0.35 + 0.35 * Math.min(1, Math.log10(P) / 1.5);   // brighter ones swing more
  const shape = (ph) => {                                              // fast rise, slow fade
    ph = ((ph % 1) + 1) % 1;
    return ph < 0.22 ? Math.sin((Math.PI / 2) * (ph / 0.22)) ** 2 : Math.pow(1 - (ph - 0.22) / 0.78, 1.4);
  };

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    s.phase = (s.phase + dt * 0.45) % 1;
    const M = absMag(s.P);
    const mu = 5 * Math.log10(s.d) - 5;
    const mMean = M + mu;
    const A = amp(s.P);
    const mag = (ph) => mMean + A / 2 - A * shape(ph);

    const wide = w >= 720;
    const star = wide ? { x: 0, y: 0, w: w * 0.24, h } : { x: 0, y: 0, w: w * 0.34, h: h * 0.45 };
    const lc = wide ? { x: w * 0.24 + 58, y: 24, w: w * 0.38 - 74, h: h - 72 } : { x: w * 0.34 + 56, y: 22, w: w * 0.66 - 70, h: h * 0.45 - 66 };
    const pl = wide ? { x: w * 0.62 + 58, y: 24, w: w * 0.38 - 74, h: h - 72 } : { x: 56, y: h * 0.45 + 24, w: w - 72, h: h * 0.55 - 72 };
    ctx.fillStyle = t.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = t.sky;
    ctx.fillRect(star.x, star.y, star.w, star.h);

    // the star, swelling and brightening
    const sh = shape(s.phase);
    const r = Math.min(star.w, star.h) * (0.2 + 0.03 * sh);
    const cx = star.x + star.w / 2, cy = star.y + star.h / 2;
    const col = kit.starColor(5400 + 900 * sh);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.8);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.3 + 0.1 * sh, col); g.addColorStop(0.55, col.replace("rgb", "rgba").replace(")", ",0.5)")); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.65 + 0.35 * sh;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = t.small; ctx.fillStyle = t.skyMuted; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText((star.w < 160 ? "every " : "one pulse every ") + s.P.toFixed(1) + " days", cx, star.y + star.h - 8);

    // light curve in apparent magnitude: brighter is up, so the axis runs downwards
    const top = Math.floor((mMean - A) * 2) / 2, bot = Math.ceil((mMean + A) * 2) / 2;
    const step = bot - top > 2 ? 1 : 0.5;
    const yt = []; for (let v = top; v <= bot + 1e-9; v += step) yt.push(v);
    const L1 = kit.axes(ctx, lc, {
      xmin: 0, xmax: 2, ymin: bot, ymax: top,
      xticks: [0, 0.5, 1, 1.5, 2], yticks: yt,
      xfmt: (v) => (v * s.P).toFixed(s.P < 10 ? 1 : 0), yfmt: (v) => v.toFixed(1),
      xlabel: "days", ylabel: "apparent magnitude",
    });
    ctx.strokeStyle = t.accent; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k <= 300; k++) { const x = (2 * k) / 300; const y = L1.Y(mag(x)); k ? ctx.lineTo(L1.X(x), y) : ctx.moveTo(L1.X(x), y); }
    ctx.stroke();
    ctx.setLineDash([4, 4]); ctx.strokeStyle = t.muted; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(lc.x, L1.Y(mMean)); ctx.lineTo(lc.x + lc.w, L1.Y(mMean)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = t.mark;
    ctx.beginPath(); ctx.arc(L1.X(s.phase), L1.Y(mag(s.phase)), 4.5, 0, Math.PI * 2); ctx.fill();

    // period-luminosity relation
    const L2 = kit.axes(ctx, pl, {
      xmin: 1, xmax: 100, ymin: -1.5, ymax: -8, logx: true,
      xticks: [1, 3, 10, 30, 100], yticks: [-2, -4, -6, -8],
      xfmt: (v) => v + " d", yfmt: (v) => String(v),
      xlabel: "pulsation period", ylabel: "absolute magnitude",
    });
    ctx.strokeStyle = t.accentSoft; ctx.lineWidth = 12; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(L2.X(1), L2.Y(absMag(1))); ctx.lineTo(L2.X(100), L2.Y(absMag(100))); ctx.stroke();
    ctx.lineCap = "butt";
    ctx.strokeStyle = t.accent; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(L2.X(1), L2.Y(absMag(1))); ctx.lineTo(L2.X(100), L2.Y(absMag(100))); ctx.stroke();
    ctx.fillStyle = t.mark; ctx.strokeStyle = t.ink; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(L2.X(s.P), L2.Y(M), 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = t.small; ctx.fillStyle = t.muted; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("Leavitt's law", pl.x + 8, pl.y + 6);

    const Lsun = Math.pow(10, (4.83 - M) / 2.5);
    out.set("L", Math.round(Lsun).toLocaleString("en-US") + " × the Sun");
    out.set("M", M.toFixed(2));
    out.set("m", mMean.toFixed(1) + " on average");
    out.set("see", mMean < 6 ? "nothing: it's a naked-eye star" : mMean < 9 ? "binoculars" : mMean < 14 ? "a backyard telescope" : mMean < 22 ? "a large observatory telescope" : "a space telescope like Hubble");
  });
});
