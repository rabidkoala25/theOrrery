/* Stellar parallax: as Earth circles the Sun, a nearby star appears to trace
   a small ellipse against much more distant stars. The size of that ellipse,
   in arcseconds, is one over the distance in parsecs. */
OrrerySims.register("stellar-parallax", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 640 ? 1.3 : 0.52), max: 740, label: "Earth's orbit and the sight line to a nearby star, beside a telescope view of the star shifting against background stars" });
  const p = kit.panel();
  const s = { d: 1.3, beta: 60, t: 0, rate: 0.25, trail: [] };
  const presets = {
    proxima: ["Proxima Centauri", 1.301, 44],
    sirius: ["Sirius", 2.64, -39],
    vega: ["Vega", 7.68, 62],
    polaris: ["Polaris", 133, 66],
    betelgeuse: ["Betelgeuse", 168, -16],
  };
  kit.select(p, {
    label: "Pick a star",
    options: Object.entries(presets).map(([k, v]) => [k, v[0]]),
    value: "proxima",
    onChange: (k) => { dS.set(presets[k][1]); bS.set(Math.abs(presets[k][2])); },
  });
  const dS = kit.slider(p, { label: "Distance", min: 1.3, max: 1000, log: true, value: s.d, format: (v) => (v < 10 ? v.toFixed(2) : Math.round(v)) + " parsecs (" + (v * 3.2616 < 100 ? (v * 3.2616).toFixed(1) : Math.round(v * 3.2616)) + " light years)", onInput: (v) => { s.d = v; s.trail = []; } });
  const bS = kit.slider(p, { label: "Height above the plane of Earth's orbit", min: 0, max: 90, step: 1, value: s.beta, format: (v) => v + "°", onInput: (v) => { s.beta = v; s.trail = []; } });
  kit.slider(p, { label: "Speed", min: 0.05, max: 1, step: 0.05, value: s.rate, format: (v) => v.toFixed(2) + " years per second", onInput: (v) => (s.rate = v) });
  const out = kit.readouts(kit.root, [["p", "Parallax angle"], ["like", "That is the width of"], ["gaia", "Gaia measures to about"]]);

  const rand = kit.rng(314);
  const bg = Array.from({ length: 90 }, () => [rand() * 2 - 1, rand() * 2 - 1, 0.25 + rand() * 0.6]);

  const likeness = (mas) => {
    // what an angle that size looks like: a coin of 23 mm seen from afar
    const km = 0.023 / Math.tan((mas / 3.6e6) * (Math.PI / 180)) / 1000;
    return "a 1-euro coin seen from " + (km > 1000 ? Math.round(km / 1000).toLocaleString("en-US") + " thousand km" : Math.round(km).toLocaleString("en-US") + " km");
  };

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    s.t += s.rate * dt;
    const ang = 2 * Math.PI * s.t;
    const pmas = 1000 / s.d;                          // parallax in milliarcseconds

    const wide = w >= 640;
    const orb = wide ? { x: 0, y: 0, w: w * 0.5, h } : { x: 0, y: 0, w, h: h * 0.5 };
    const tel = wide ? { x: w * 0.5, y: 0, w: w * 0.5, h } : { x: 0, y: h * 0.5, w, h: h * 0.5 };
    ctx.fillStyle = t.sky;
    ctx.fillRect(0, 0, w, h);

    // ---- top-down: Earth's orbit, and the star far above (not to scale)
    const cx = orb.x + orb.w / 2, cy = orb.y + orb.h * 0.72;
    const R = Math.min(orb.w * 0.22, orb.h * 0.2);
    const sx = cx, sy = orb.y + orb.h * 0.12;
    ctx.strokeStyle = t.skyRule;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = t.sun;
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
    const ex = cx + R * Math.cos(ang), ey = cy - R * Math.sin(ang) * 0.9;
    // sight line through the star, carried on to the background
    const dx = sx - ex, dy = sy - ey, dn = Math.hypot(dx, dy);
    ctx.strokeStyle = "rgba(228,96,122,0.75)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + (dx / dn) * orb.h * 1.2, ey + (dy / dn) * orb.h * 1.2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = t.skyAccent;
    ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff4dc";
    ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = t.small; ctx.fillStyle = t.skyMuted; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("nearby star, really " + Math.round(206265 * s.d).toLocaleString("en-US") + "× farther than the Sun", orb.x + 10, orb.y + 8);
    ctx.textBaseline = "bottom";
    ctx.fillText("Earth's orbit", cx + R + 6, cy);

    // ---- telescope view, zoomed so the ellipse is always visible
    const tx = tel.x + tel.w / 2, ty = tel.y + tel.h / 2;
    const rad = Math.min(tel.w, tel.h) * 0.42;
    ctx.save();
    ctx.beginPath(); ctx.arc(tx, ty, rad, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "#03050a";
    ctx.fillRect(tel.x, tel.y, tel.w, tel.h);
    for (const [bx, by, b] of bg) {
      ctx.fillStyle = `rgba(210,218,235,${b})`;
      ctx.fillRect(tx + bx * rad, ty + by * rad, 1.6, 1.6);
    }
    const pxPerMas = (rad * 0.5) / pmas;
    const ox = -pmas * Math.sin(ang), oy = pmas * Math.cos(ang) * Math.sin((s.beta * Math.PI) / 180);
    s.trail.push([ox, oy]);
    if (s.trail.length > 600) s.trail.shift();
    ctx.strokeStyle = "rgba(228,96,122,0.6)";
    ctx.beginPath();
    s.trail.forEach(([x, y], i) => (i ? ctx.lineTo(tx + x * pxPerMas, ty - y * pxPerMas) : ctx.moveTo(tx + x * pxPerMas, ty - y * pxPerMas)));
    ctx.stroke();
    const glow = ctx.createRadialGradient(tx + ox * pxPerMas, ty - oy * pxPerMas, 0, tx + ox * pxPerMas, ty - oy * pxPerMas, 9);
    glow.addColorStop(0, "#ffffff"); glow.addColorStop(0.4, "#fff0cf"); glow.addColorStop(1, "rgba(255,240,207,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(tx + ox * pxPerMas, ty - oy * pxPerMas, 9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = t.skyRule;
    ctx.beginPath(); ctx.arc(tx, ty, rad, 0, Math.PI * 2); ctx.stroke();
    // scale bar: the parallax angle itself
    ctx.strokeStyle = t.skyInk;
    ctx.beginPath(); ctx.moveTo(tx - pmas * pxPerMas / 2, ty + rad * 0.82); ctx.lineTo(tx + pmas * pxPerMas / 2, ty + rad * 0.82); ctx.stroke();
    ctx.font = t.small; ctx.fillStyle = t.skyInk; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText(pmas >= 1000 ? (pmas / 1000).toFixed(2) + " arcsec" : pmas.toFixed(pmas < 10 ? 2 : 0) + " milliarcsec", tx, ty + rad * 0.82 - 3);
    ctx.fillStyle = t.skyMuted; ctx.textBaseline = "top";
    ctx.fillText("telescope view, magnified to fit", tx, tel.y + 8);

    out.set("p", pmas >= 1000 ? (pmas / 1000).toFixed(3) + " arcsec" : pmas.toFixed(pmas < 10 ? 2 : 1) + " milliarcsec");
    out.set("like", likeness(pmas));
    const pct = (0.02 / pmas) * 100;
    out.set("gaia", "0.02 milliarcsec, so this distance to " + (pct < 0.01 ? "better than 0.01%" : pct < 1 ? pct.toFixed(2) + "%" : pct.toFixed(1) + "%"));
    void bS;
  });
});
