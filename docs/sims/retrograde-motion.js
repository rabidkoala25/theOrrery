/* Retrograde motion: Earth overtakes an outer planet (or an inner planet
   overtakes Earth), and for a few weeks the planet appears to drift backwards
   against the stars. The loop's shape comes from the small tilt of its orbit. */
OrrerySims.register("retrograde-motion", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 640 ? 1.35 : 0.56), max: 780, label: "Earth and another planet orbiting the Sun, above a strip of sky showing the planet's apparent path" });
  const p = kit.panel();
  const D2R = Math.PI / 180;
  const PLANETS = {
    mars: { name: "Mars", a: 1.524, P: 1.8809, L0: 355.45, i: 1.85, node: 49.56, color: "#e8826a" },
    jupiter: { name: "Jupiter", a: 5.203, P: 11.862, L0: 34.40, i: 1.30, node: 100.46, color: "#e9c99a" },
    saturn: { name: "Saturn", a: 9.537, P: 29.457, L0: 49.94, i: 2.49, node: 113.66, color: "#e6d8a4" },
    venus: { name: "Venus", a: 0.723, P: 0.6152, L0: 181.98, i: 3.39, node: 76.68, color: "#f4efe0" },
  };
  const EARTH = { a: 1, P: 1, L0: 100.46 };
  const EXAG = 5;
  const s = { key: "mars", t: 26.72, rate: 30, trail: [], center: null, lastLam: null, dir: 0, stars: [] };

  const rand = kit.rng(77);
  for (let i = 0; i < 420; i++) s.stars.push([rand() * 360, rand() * 2 - 1, 0.3 + rand() * 0.7]);

  kit.select(p, {
    label: "Planet",
    options: Object.entries(PLANETS).map(([k, v]) => [k, v.name]),
    value: s.key,
    onChange: (k) => { s.key = k; s.trail = []; s.center = null; s.lastLam = null; },
  });
  kit.slider(p, { label: "Time", min: 2, max: 120, step: 1, value: s.rate, format: (v) => v + " days per second", onInput: (v) => (s.rate = v) });
  kit.button(p, "Back to today", () => { s.t = 26.72; s.trail = []; s.center = null; s.lastLam = null; });
  const out = kit.readouts(kit.root, [["date", "Date"], ["motion", "Apparent motion"], ["dist", "Distance from Earth"]]);

  const helio = (pl, t) => {
    const L = (pl.L0 + (360 * t) / pl.P) * D2R;
    if (pl.i === undefined) return [pl.a * Math.cos(L), pl.a * Math.sin(L), 0];
    const node = pl.node * D2R, inc = pl.i * D2R, u = L - node;
    return [
      pl.a * (Math.cos(node) * Math.cos(u) - Math.sin(node) * Math.sin(u) * Math.cos(inc)),
      pl.a * (Math.sin(node) * Math.cos(u) + Math.cos(node) * Math.sin(u) * Math.cos(inc)),
      pl.a * Math.sin(u) * Math.sin(inc),
    ];
  };
  const wrap = (d) => ((d + 540) % 360) - 180;

  const decimalToDate = (y) => {
    const year = Math.floor(y);
    const d = new Date(Date.UTC(year, 0, 1) + (y - year) * 365.25 * 86400000);
    return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  };

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    const pl = PLANETS[s.key];
    s.t += (s.rate * dt) / 365.25;

    const E = helio(EARTH, s.t), P = helio(pl, s.t);
    const g = [P[0] - E[0], P[1] - E[1], P[2] - E[2]];
    const lam = Math.atan2(g[1], g[0]) / D2R;
    const beta = Math.atan2(g[2], Math.hypot(g[0], g[1])) / D2R;
    // unwrap longitude so the trail is continuous
    let lamU = lam;
    if (s.lastLam !== null) {
      lamU = s.lastLam + wrap(lam - (((s.lastLam % 360) + 360) % 360));
      const d = lamU - s.lastLam;
      if (Math.abs(d) > 1e-6) s.dir = Math.sign(d);
    }
    s.lastLam = lamU;
    s.trail.push([lamU, beta]);
    const keep = Math.round((pl.P > 2 ? 420 : 700) / Math.max(1, s.rate * dt));
    if (s.trail.length > Math.max(200, keep)) s.trail.splice(0, s.trail.length - Math.max(200, keep));
    if (s.center === null) s.center = lamU;
    s.center += (lamU - s.center) * Math.min(1, dt * 0.35);

    // ---- layout
    const wide = w >= 640;
    const orbit = wide ? { x: 0, y: 0, w: h, h } : { x: 0, y: 0, w, h: h * 0.58 };
    const sky = wide ? { x: h, y: 0, w: w - h, h } : { x: 0, y: h * 0.58, w, h: h * 0.42 };
    ctx.fillStyle = t.sky;
    ctx.fillRect(0, 0, w, h);

    // ---- top-down view of the orbits
    const R = Math.max(pl.a, 1);
    const S = (Math.min(orbit.w, orbit.h) / 2 - 16) / R;
    const ox = orbit.x + orbit.w / 2, oy = orbit.y + orbit.h / 2;
    ctx.strokeStyle = t.skyRule;
    ctx.lineWidth = 1;
    for (const a of [1, pl.a]) {
      ctx.beginPath();
      ctx.arc(ox, oy, a * S, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = t.sun;
    ctx.beginPath(); ctx.arc(ox, oy, 6, 0, Math.PI * 2); ctx.fill();
    const ex = ox + E[0] * S, ey = oy - E[1] * S, px = ox + P[0] * S, py = oy - P[1] * S;
    // line of sight, extended to the edge of the view
    const dx = px - ex, dy = py - ey, dn = Math.hypot(dx, dy) || 1;
    ctx.strokeStyle = "rgba(228,96,122,0.7)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + (dx / dn) * orbit.w * 1.5, ey + (dy / dn) * orbit.w * 1.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = t.skyAccent;
    ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pl.color;
    ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
    ctx.font = t.small;
    ctx.fillStyle = t.skyMuted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Earth", ex + 8, ey + 4);
    ctx.fillText(pl.name, px + 8, py + 4);
    ctx.fillText("seen from above the Solar System", orbit.x + 10, orbit.y + 8);

    // ---- the sky strip seen from Earth, following the planet slowly
    ctx.save();
    ctx.beginPath();
    ctx.rect(sky.x, sky.y, sky.w, sky.h);
    ctx.clip();
    ctx.fillStyle = "#04060a";
    ctx.fillRect(sky.x, sky.y, sky.w, sky.h);
    const span = 70;                      // degrees of sky shown across
    const degPx = sky.w / span;
    const midY = sky.y + sky.h / 2;
    const SX = (l) => sky.x + sky.w / 2 - (l - s.center) * degPx;   // east is to the left, as on a sky chart
    const SY = (b) => midY - b * EXAG * degPx * 0.5;
    for (const [sl, sb, br] of s.stars) {
      // place each star at the copy of its longitude nearest the view centre
      const l = sl + 360 * Math.round((s.center - sl) / 360);
      const x = SX(l), y = midY - sb * sky.h * 0.47;
      if (x < sky.x || x > sky.x + sky.w) continue;
      ctx.fillStyle = `rgba(220,226,238,${br})`;
      ctx.fillRect(x, y, br > 0.8 ? 2 : 1.2, br > 0.8 ? 2 : 1.2);
    }
    ctx.strokeStyle = "rgba(160,175,200,0.25)";
    ctx.beginPath(); ctx.moveTo(sky.x, midY); ctx.lineTo(sky.x + sky.w, midY); ctx.stroke();
    ctx.strokeStyle = pl.color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    s.trail.forEach(([l, b], i) => (i ? ctx.lineTo(SX(l), SY(b)) : ctx.moveTo(SX(l), SY(b))));
    ctx.stroke();
    ctx.fillStyle = pl.color;
    ctx.beginPath(); ctx.arc(SX(lamU), SY(beta), 5, 0, Math.PI * 2); ctx.fill();
    ctx.font = t.small;
    ctx.fillStyle = t.skyMuted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("sky from Earth: east to the left, height ×" + EXAG, sky.x + 10, sky.y + 8);
    ctx.textBaseline = "bottom";
    ctx.fillText("ecliptic", sky.x + 10, midY - 3);
    ctx.restore();

    out.set("date", decimalToDate(2000 + s.t));
    out.set("motion", s.dir < 0 ? "westward: retrograde" : "eastward: normal");
    out.set("dist", Math.hypot(...g).toFixed(2) + " AU");
  });
});
