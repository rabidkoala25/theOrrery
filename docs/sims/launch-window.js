/* Launch windows: the cheapest route between two circular orbits is a
   Hohmann transfer, half an ellipse touching both. The target planet has to
   be in the right place when the spacecraft arrives, so launches only work
   when the planets line up, which for Mars is every 26 months. */
OrrerySims.register("launch-window", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 640 ? 1.05 : 0.62), max: 760, label: "Earth and a target planet orbiting the Sun, with a spacecraft on a transfer orbit between them" });
  const p = kit.panel();
  const D2R = Math.PI / 180;
  const TARGETS = {
    mars: { name: "Mars", a: 1.524, P: 1.8809, L0: 355.45, color: "#e8826a" },
    venus: { name: "Venus", a: 0.723, P: 0.6152, L0: 181.98, color: "#f4efe0" },
    jupiter: { name: "Jupiter", a: 5.203, P: 11.862, L0: 34.40, color: "#e9c99a" },
  };
  const EARTH = { a: 1, P: 1, L0: 100.46 };
  const s = { key: "mars", t: 26.72, rate: 90, craft: null, result: "" };

  kit.select(p, { label: "Destination", options: Object.entries(TARGETS).map(([k, v]) => [k, v.name]), value: s.key, onChange: (k) => { s.key = k; s.craft = null; s.result = ""; } });
  kit.slider(p, { label: "Time", min: 10, max: 400, step: 10, value: s.rate, format: (v) => v + " days per second", onInput: (v) => (s.rate = v) });
  kit.button(p, "Launch now", () => launch());
  kit.button(p, "Skip to the next window", () => { s.t += daysToWindow() / 365.25; s.craft = null; s.result = ""; });
  const out = kit.readouts(kit.root, [["date", "Date"], ["phase", "Planet ahead of Earth by"], ["next", "Next launch window"], ["trip", "Transfer time"], ["dv", "Speed change needed at departure"], ["dose", "Cruise radiation dose"], ["res", "Last launch"]]);

  const lonAt = (pl, t) => (((pl.L0 + (360 * t) / pl.P) % 360) + 360) % 360;
  const wrap = (d) => ((d + 540) % 360) - 180;
  const transfer = () => {
    const tg = TARGETS[s.key];
    const at = (1 + tg.a) / 2, T = 0.5 * Math.pow(at, 1.5);          // years
    const need = wrap(180 - (360 * T) / tg.P);                        // target's lead at launch
    return { tg, at, T, need, e: Math.abs(tg.a - 1) / (tg.a + 1) };
  };
  const phaseNow = () => wrap(lonAt(TARGETS[s.key], s.t) - lonAt(EARTH, s.t));
  function daysToWindow() {
    const { tg, need } = transfer();
    const rate = 360 * (1 / tg.P - 1);                                // deg per year
    let yrs = (need - phaseNow()) / rate;
    const syn = 360 / Math.abs(rate);
    yrs = ((yrs % syn) + syn) % syn;
    return yrs * 365.25;
  }
  function launch() {
    const { tg, at, T, e } = transfer();
    const outward = tg.a > 1;
    s.craft = { t0: s.t, lon0: lonAt(EARTH, s.t), at, e, T, outward, done: false };
    s.result = "on its way to " + tg.name;
  }
  const solveE = (M, e) => { let E = M; for (let i = 0; i < 15; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; };
  const craftPos = (cr, t) => {
    // Earth's orbit touches the transfer ellipse at perihelion (outward) or aphelion (inward)
    const M = Math.PI * Math.min(1, (t - cr.t0) / cr.T) + (cr.outward ? 0 : Math.PI);
    const E = solveE(M, cr.e);
    const nu = 2 * Math.atan2(Math.sqrt(1 + cr.e) * Math.sin(E / 2), Math.sqrt(1 - cr.e) * Math.cos(E / 2));
    const r = cr.at * (1 - cr.e * Math.cos(E));
    const periLon = cr.lon0 * D2R + (cr.outward ? 0 : Math.PI);
    return [r * Math.cos(nu + periLon), r * Math.sin(nu + periLon)];
  };
  const date = (y) => {
    const yr = 2000 + y, Y = Math.floor(yr);
    return new Date(Date.UTC(Y, 0, 1) + (yr - Y) * 365.25 * 86400000).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  };

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    s.t += (s.rate * dt) / 365.25;
    const tr = transfer();
    const tg = tr.tg;

    ctx.fillStyle = t.sky;
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const S = (Math.min(w, h) / 2 - 18) / Math.max(1, tg.a);
    ctx.strokeStyle = t.skyRule;
    for (const r of [1, tg.a]) { ctx.beginPath(); ctx.arc(cx, cy, r * S, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = t.sun;
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();

    const pos = (pl) => { const l = lonAt(pl, s.t) * D2R; return [cx + pl.a * S * Math.cos(l), cy - pl.a * S * Math.sin(l)]; };
    // where the target must be at launch: a ghost marker ahead of Earth
    const el = lonAt(EARTH, s.t) * D2R, gl = el + tr.need * D2R;
    ctx.strokeStyle = "rgba(228,96,122,0.6)";
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.arc(cx + tg.a * S * Math.cos(gl), cy - tg.a * S * Math.sin(gl), 8, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    if (s.craft) {
      const cr = s.craft;
      // the full half-ellipse, then the craft on it
      ctx.strokeStyle = "rgba(255,231,168,0.45)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let k = 0; k <= 60; k++) { const [x, y] = craftPos(cr, cr.t0 + (cr.T * k) / 60); k ? ctx.lineTo(cx + x * S, cy - y * S) : ctx.moveTo(cx + x * S, cy - y * S); }
      ctx.stroke();
      ctx.setLineDash([]);
      const [x, y] = craftPos(cr, s.t);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(cx + x * S, cy - y * S, 3.5, 0, Math.PI * 2); ctx.fill();
      if (!cr.done && s.t >= cr.t0 + cr.T) {
        cr.done = true;
        const tl = lonAt(tg, cr.t0 + cr.T) * D2R;
        const [ex, ey] = craftPos(cr, cr.t0 + cr.T);
        const miss = Math.hypot(ex - tg.a * Math.cos(tl), ey - tg.a * Math.sin(tl)) * 149.6;
        s.result = miss < 5 ? "arrived at " + tg.name + "!" : "missed " + tg.name + " by " + Math.round(miss) + " million km";
      }
    }
    const [ex, ey] = pos(EARTH), [px, py] = pos(tg);
    ctx.fillStyle = t.skyAccent;
    ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = tg.color;
    ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
    ctx.font = t.small; ctx.fillStyle = t.skyMuted; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("Earth", ex + 8, ey);
    ctx.fillText(tg.name, px + 8, py);
    ctx.textBaseline = "top";
    ctx.fillText("dashed circle: where " + tg.name + " must be when you launch", 10, 8);

    const days = daysToWindow();
    const v1 = 29.78, rA = 1, rB = tg.a;
    const dv = Math.abs(v1 * (Math.sqrt((2 * rB) / (rA + rB)) - 1));
    out.set("date", date(s.t));
    out.set("phase", Math.round(phaseNow()) + "° (needs " + Math.round(tr.need) + "°)");
    out.set("next", days < 12 ? "open now" : "in " + Math.round(days) + " days, " + date(s.t + days / 365.25));
    out.set("trip", Math.round(tr.T * 365.25) + " days");
    out.set("dv", dv.toFixed(2) + " km/s");
    out.set("dose", "about " + Math.round(tr.T * 365.25 * 1.8) + " mSv at 1.8 mSv/day");
    out.set("res", s.result || "none yet");
  });
});
