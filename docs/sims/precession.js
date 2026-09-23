/* Precession: Earth's spin axis wobbles like a top's, tracing a circle on the
   sky every 25,800 years. Polaris is only today's pole star; the Egyptians of
   the pyramid age used Thuban, and in 12,000 years it will be Vega. */
OrrerySims.register("precession", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 640 ? 1.15 : 0.62), max: 760, label: "A chart of the northern sky showing the celestial pole moving in a circle among the stars over thousands of years" });
  const p = kit.panel();
  const D2R = Math.PI / 180, EPS = 23.44 * D2R, PERIOD = 25772;
  const s = { year: 2026, rate: 0, play: true };

  // bright northern stars, J2000: [name, RA hours, Dec degrees, magnitude]
  const STARS = [
    ["Polaris", 2.530, 89.264, 2.0], ["Yildun", 17.537, 86.586, 4.4], ["ε UMi", 16.766, 82.037, 4.2], ["ζ UMi", 15.734, 77.795, 4.3],
    ["η UMi", 16.292, 75.755, 5.0], ["Kochab", 14.845, 74.156, 2.1], ["Pherkad", 15.345, 71.834, 3.0], ["Thuban", 14.073, 64.376, 3.7],
    ["Vega", 18.616, 38.784, 0.0], ["Deneb", 20.690, 45.280, 1.3], ["Sadr", 20.370, 40.257, 2.2], ["Albireo", 19.512, 27.960, 3.1],
    ["Alderamin", 21.310, 62.585, 2.5], ["Errai", 23.655, 77.632, 3.2], ["ι Her", 17.657, 46.006, 3.8], ["Eltanin", 17.943, 51.489, 2.2],
    ["Rastaban", 17.507, 52.301, 2.8], ["Dubhe", 11.062, 61.751, 1.8], ["Merak", 11.031, 56.382, 2.4], ["Phecda", 11.897, 53.695, 2.4],
    ["Megrez", 12.257, 57.033, 3.3], ["Alioth", 12.900, 55.960, 1.8], ["Mizar", 13.399, 54.925, 2.2], ["Alkaid", 13.792, 49.313, 1.9],
    ["Caph", 0.153, 59.150, 2.3], ["Schedar", 0.675, 56.537, 2.2], ["Navi", 0.945, 60.717, 2.2], ["Ruchbah", 1.430, 60.235, 2.7],
    ["Segin", 1.906, 63.670, 3.4], ["Capella", 5.278, 45.998, 0.1], ["Mirfak", 3.405, 49.861, 1.8], ["Menkalinan", 5.992, 44.947, 1.9],
  ].map(([name, ra, dec, mag]) => {
    const a = ra * 15 * D2R, d = dec * D2R;
    const sb = Math.sin(d) * Math.cos(EPS) - Math.cos(d) * Math.sin(EPS) * Math.sin(a);
    const lon = Math.atan2(Math.sin(a) * Math.cos(EPS) + Math.tan(d) * Math.sin(EPS), Math.cos(a));
    return { name, mag, lon, lat: Math.asin(sb) };
  });
  const byName = Object.fromEntries(STARS.map((x) => [x.name, x]));
  const LINES = [
    ["Alkaid", "Mizar", "Alioth", "Megrez", "Phecda", "Merak", "Dubhe", "Megrez"],
    ["Polaris", "Yildun", "ε UMi", "ζ UMi", "Kochab", "Pherkad", "η UMi", "ζ UMi"],
    ["Caph", "Schedar", "Navi", "Ruchbah", "Segin"],
    ["Deneb", "Sadr", "Albireo"],
  ];
  const LABELS = ["Polaris", "Thuban", "Vega", "Deneb", "Kochab", "Alderamin", "Capella", "ι Her", "Errai"];

  const yS = kit.slider(p, { label: "Year", min: -12000, max: 16000, step: 10, value: s.year, format: (v) => (v < 0 ? Math.round(-v) + " BC" : "AD " + Math.round(v)), onInput: (v) => { s.year = v; } });
  const playBtn = kit.button(p, "Pause", () => { s.play = !s.play; playBtn.textContent = s.play ? "Pause" : "Play"; });
  kit.button(p, "Back to today", () => { s.year = 2026; yS.set(2026, false); });
  const out = kit.readouts(kit.root, [["pole", "Nearest bright star to the pole"], ["off", "Its distance from the pole"], ["cycle", "Through the cycle"]]);

  const poleAt = (year) => ({ lon: (90 - (360 * (year - 2000)) / PERIOD) * D2R, lat: (90 - 23.44) * D2R });
  const sep = (a, b) => Math.acos(Math.min(1, Math.sin(a.lat) * Math.sin(b.lat) + Math.cos(a.lat) * Math.cos(b.lat) * Math.cos(a.lon - b.lon)));

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    if (s.play) {
      s.year += dt * 900;
      if (s.year > 16000) s.year = -12000;
      yS.set(s.year, false);
    }
    ctx.fillStyle = t.sky;
    ctx.fillRect(0, 0, w, h);

    // stereographic chart centred on the pole of the ecliptic, which does not move
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.47;
    const rMax = 2 * Math.tan((58 * D2R) / 2);           // show ecliptic latitudes above 32°
    const proj = (o) => {
      const r = (2 * Math.tan((Math.PI / 2 - o.lat) / 2) / rMax) * R;
      return [cx + r * Math.cos(o.lon), cy - r * Math.sin(o.lon)];
    };
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "#04060b";
    ctx.fillRect(0, 0, w, h);

    // the pole's circle, with past and future pole stars on it
    ctx.strokeStyle = "rgba(228,96,122,0.35)";
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    for (let k = 0; k <= 180; k++) { const [x, y] = proj({ lon: (k / 180) * 2 * Math.PI, lat: (90 - 23.44) * D2R }); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    ctx.setLineDash([]);
    // the pole's recent track
    ctx.strokeStyle = t.skyMark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k <= 40; k++) { const [x, y] = proj(poleAt(s.year - 2500 + (2500 * k) / 40)); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    ctx.lineWidth = 1;

    // constellation lines, then stars
    ctx.strokeStyle = "rgba(143,179,238,0.35)";
    for (const line of LINES) {
      ctx.beginPath();
      line.forEach((n, i) => { const [x, y] = proj(byName[n]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    }
    for (const st of STARS) {
      const [x, y] = proj(st);
      const r = Math.max(1, 3.6 - st.mag * 0.6);
      ctx.fillStyle = "#e8edf6";
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.font = t.small; ctx.fillStyle = t.skyMuted; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    for (const n of LABELS) { const [x, y] = proj(byName[n]); ctx.fillText(n, x + 6, y); }

    // the north celestial pole now
    const pole = poleAt(s.year);
    const [px, py] = proj(pole);
    ctx.strokeStyle = t.skyMark; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.moveTo(px - 14, py); ctx.lineTo(px + 14, py); ctx.moveTo(px, py - 14); ctx.lineTo(px, py + 14); ctx.stroke();
    ctx.lineWidth = 1;
    // the fixed ecliptic pole
    ctx.fillStyle = t.skyMuted;
    ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = t.skyRule;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.font = t.small; ctx.fillStyle = t.skyMuted; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("red cross: where Earth's axis points", 10, 8);
    ctx.fillText("dashed: its 25,800-year circle", 10, 24);

    // which bright star is closest to the pole?
    let best = null, bd = 9;
    for (const st of STARS) { if (st.mag > 4) continue; const d = sep(st, pole); if (d < bd) { bd = d; best = st; } }
    const deg = bd / D2R;
    out.set("pole", deg < 5 ? best.name : "none close: no good pole star (nearest is " + best.name + ")");
    out.set("off", deg.toFixed(1) + "°" + (deg < 1 ? ", as good as it gets" : ""));
    out.set("cycle", Math.round(((((s.year - 2000) / PERIOD) % 1 + 1) % 1) * 100) + "% of the way round since AD 2000");
  });
});
