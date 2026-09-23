/* White dwarfs: held up by electron degeneracy pressure, not heat. Add mass
   and they get smaller, not bigger, until at about 1.44 solar masses the
   electrons can no longer hold and the star collapses: the Chandrasekhar
   limit. */
OrrerySims.register("white-dwarf", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 640 ? 1.2 : 0.5), max: 720, label: "A white dwarf drawn to scale beside Earth, next to a graph of white dwarf radius against mass" });
  const p = kit.panel();
  const MCH = 1.44, RSUN = 695700, REARTH = 6371;
  const s = { M: 0.6 };
  const KNOWN = [["Sirius B", 1.02, 5800], ["Procyon B", 0.59, 8600], ["40 Eridani B", 0.57, 9500]];

  kit.select(p, { label: "Try a real one", options: [["", "Choose…"], ...KNOWN.map(([n, m]) => [String(m), n]), ["1.43", "Right at the limit"]], value: "", onChange: (v) => { if (v) mS.set(+v); } });
  const mS = kit.slider(p, { label: "Mass", min: 0.2, max: 1.439, step: 0.001, value: s.M, format: (v) => v.toFixed(3) + " × the Sun", onInput: (v) => { s.M = v; draw(); } });
  const out = kit.readouts(kit.root, [["R", "Radius"], ["rho", "A teaspoon of it weighs"], ["g", "Surface gravity"], ["esc", "Escape speed"]]);

  // Nauenberg's (1972) fit to Chandrasekhar's mass–radius relation
  const radiusKm = (M) => 0.0112 * RSUN * Math.pow(M / MCH, -1 / 3) * Math.sqrt(Math.max(0, 1 - Math.pow(M / MCH, 4 / 3)));

  function draw() {
    const { ctx, w, h } = c;
    const t = kit.theme();
    const R = radiusKm(s.M);
    const wide = w >= 640;
    const box = wide ? { x: 0, y: 0, w: w * 0.44, h } : { x: 0, y: 0, w, h: h * 0.46 };
    const plot = wide ? { x: w * 0.44 + 70, y: 24, w: w * 0.56 - 88, h: h - 72 } : { x: 70, y: h * 0.46 + 24, w: w - 88, h: h * 0.54 - 70 };
    ctx.fillStyle = t.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = t.sky;
    ctx.fillRect(box.x, box.y, box.w, box.h);

    // to scale: the white dwarf beside Earth
    const k = (Math.min(box.w * 0.22, box.h * 0.36)) / 10000;   // px per km
    const ey = box.y + box.h / 2;
    const ex = box.x + box.w * 0.28, wx = box.x + box.w * 0.7;
    const eg = ctx.createRadialGradient(ex - REARTH * k * 0.3, ey - REARTH * k * 0.3, 1, ex, ey, REARTH * k);
    eg.addColorStop(0, "#7fa6e6"); eg.addColorStop(1, "#2c4f7c");
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(ex, ey, REARTH * k, 0, Math.PI * 2); ctx.fill();
    const wr = Math.max(1.5, R * k);
    const wg = ctx.createRadialGradient(wx, ey, 0, wx, ey, wr * 1.12);
    wg.addColorStop(0, "#ffffff"); wg.addColorStop(0.85, "#dfe8ff"); wg.addColorStop(1, "rgba(223,232,255,0)");
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.arc(wx, ey, wr * 1.12, 0, Math.PI * 2); ctx.fill();
    ctx.font = t.small; ctx.fillStyle = t.skyMuted; ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText("Earth", ex, ey + REARTH * k + 8);
    ctx.fillText("white dwarf", wx, ey + Math.max(wr * 1.12, 6) + 8);
    ctx.textAlign = "left";
    ctx.fillText("drawn to the same scale", box.x + 10, box.y + 8);

    // mass–radius relation
    const P = kit.axes(ctx, plot, {
      xmin: 0.2, xmax: 1.5, ymin: 0, ymax: 16000,
      xticks: [0.2, 0.6, 1.0, 1.44], yticks: [0, 4000, 8000, 12000, 16000],
      xfmt: (v) => v.toFixed(v === 1.44 ? 2 : 1), yfmt: (v) => (v / 1000) + "k",
      xlabel: "mass (Suns)", ylabel: "radius (km)",
    });
    ctx.fillStyle = t.mark; ctx.globalAlpha = 0.1;
    ctx.fillRect(P.X(MCH), plot.y, P.X(1.5) - P.X(MCH), plot.h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = t.mark; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(P.X(MCH), plot.y); ctx.lineTo(P.X(MCH), plot.y + plot.h); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = t.mark; ctx.font = t.small; ctx.textAlign = "right"; ctx.textBaseline = "top";
    ctx.fillText("collapse", P.X(1.5) - 4, plot.y + 6);
    ctx.strokeStyle = t.muted; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(plot.x, P.Y(REARTH)); ctx.lineTo(plot.x + plot.w, P.Y(REARTH)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = t.muted; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText("Earth's radius", plot.x + 6, P.Y(REARTH) - 2);
    ctx.strokeStyle = t.accent; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const m = 0.2 + ((MCH - 0.2) * i) / 200; const y = P.Y(Math.min(16000, radiusKm(m))); i ? ctx.lineTo(P.X(m), y) : ctx.moveTo(P.X(m), y); }
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = t.ink;
    for (const [n, m, r] of KNOWN) {
      ctx.beginPath(); ctx.arc(P.X(m), P.Y(r), 3, 0, Math.PI * 2); ctx.fill();
      ctx.textAlign = "left"; ctx.textBaseline = "bottom";
      ctx.fillText(n, P.X(m) + 5, P.Y(r) - 3);
    }
    ctx.fillStyle = t.mark;
    ctx.beginPath(); ctx.arc(P.X(s.M), P.Y(R), 6, 0, Math.PI * 2); ctx.fill();

    const Mg = s.M * 1.989e33, Rcm = R * 1e5;
    const rho = Mg / ((4 / 3) * Math.PI * Rcm ** 3);
    const g = (6.674e-8 * Mg) / Rcm ** 2 / 981;
    const esc = Math.sqrt((2 * 6.674e-8 * Mg) / Rcm) / 1e5;
    const tsp = (rho * 5) / 1e6;                                  // tonnes in 5 cm³
    out.set("R", Math.round(R).toLocaleString("en-US") + " km (" + (R / REARTH).toFixed(2) + " × Earth)");
    out.set("rho", tsp >= 1000 ? Math.round(tsp / 1000).toLocaleString("en-US") + " thousand tonnes" : Math.round(tsp).toLocaleString("en-US") + " tonnes");
    out.set("g", Math.round(g).toLocaleString("en-US") + " × Earth's");
    out.set("esc", Math.round(esc).toLocaleString("en-US") + " km/s");
  }
  c.onResize(draw);
  kit.onTheme(draw);
  draw();
});
