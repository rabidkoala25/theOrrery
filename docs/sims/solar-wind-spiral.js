/* The Parker spiral: the solar wind flows straight out from the Sun, but the
   Sun turns underneath it. Wind released from one spot on the Sun therefore
   lies along a spiral, like water from a spinning garden sprinkler, and the
   Sun's magnetic field is drawn out along the same spiral. */
OrrerySims.register("solar-wind-spiral", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 560 ? 1 : 0.62), max: 720, label: "Solar wind streaming out of the rotating Sun, tracing spiral field lines past Earth and Mars" });
  const p = kit.panel();
  const AU_KM = 1.496e8;
  const s = { v: 400, rot: 25.4, rate: 2, t: 0, parcels: [], lastEmit: -16 };   // start with 16 days of wind already out
  const SOURCES = 8;

  kit.slider(p, { label: "Wind speed", min: 250, max: 900, step: 10, value: s.v, format: (v) => v + " km/s", onInput: (v) => { s.v = v; } });
  kit.slider(p, { label: "Sun's rotation period", min: 5, max: 60, step: 0.5, value: s.rot, format: (v) => v.toFixed(1) + " days", onInput: (v) => { s.rot = v; } });
  kit.slider(p, { label: "Speed", min: 0.5, max: 6, step: 0.5, value: s.rate, format: (v) => v + " days per second", onInput: (v) => (s.rate = v) });
  kit.button(p, "Clear the wind", () => { s.parcels = []; s.lastEmit = s.t; });
  const out = kit.readouts(kit.root, [["trip", "Wind takes to reach Earth"], ["angle", "Spiral angle at Earth"], ["turn", "Sun turns meanwhile"]]);

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    s.t += s.rate * dt;
    const omega = (2 * Math.PI) / s.rot;                  // radians per day
    const vAU = (s.v * 86400) / AU_KM;                    // AU per day
    // release a parcel from each source every quarter day
    while (s.t - s.lastEmit > 0.25) {
      s.lastEmit += 0.25;
      for (let k = 0; k < SOURCES; k++) s.parcels.push({ k, lon: omega * s.lastEmit + (k * 2 * Math.PI) / SOURCES, t0: s.lastEmit, v: vAU });
    }
    s.parcels = s.parcels.filter((q) => (s.t - q.t0) * q.v < 2.3);

    ctx.fillStyle = t.sky;
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, S = Math.min(w, h) / 2 / 2.15;

    // planet orbits
    ctx.strokeStyle = t.skyRule;
    for (const r of [1, 1.524]) { ctx.beginPath(); ctx.arc(cx, cy, r * S, 0, Math.PI * 2); ctx.stroke(); }

    // field lines: connect each source's parcels in order of release
    const bySource = Array.from({ length: SOURCES }, () => []);
    for (const q of s.parcels) bySource[q.k].push(q);
    ctx.lineWidth = 1.2;
    bySource.forEach((list, k) => {
      ctx.strokeStyle = k % 2 ? "rgba(228,96,122,0.55)" : "rgba(143,179,238,0.6)";
      ctx.beginPath();
      list.sort((a, b) => b.t0 - a.t0).forEach((q, i) => {
        const r = (s.t - q.t0) * q.v + 0.05;
        const x = cx + r * S * Math.cos(q.lon), y = cy - r * S * Math.sin(q.lon);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    });
    // wind parcels as specks
    ctx.fillStyle = "rgba(255,231,168,0.55)";
    for (const q of s.parcels) {
      const r = (s.t - q.t0) * q.v + 0.05;
      ctx.fillRect(cx + r * S * Math.cos(q.lon) - 0.8, cy - r * S * Math.sin(q.lon) - 0.8, 1.6, 1.6);
    }
    // the Sun with a marker showing its rotation
    const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
    sg.addColorStop(0, "#fff6d8"); sg.addColorStop(0.5, t.sun); sg.addColorStop(1, "rgba(255,231,168,0)");
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#8a5a1a";
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 7 * Math.cos(omega * s.t), cy - 7 * Math.sin(omega * s.t)); ctx.stroke();
    // Earth and Mars on their orbits
    const earthA = (2 * Math.PI * s.t) / 365.25, marsA = (2 * Math.PI * s.t) / 687 + 1.2;
    ctx.fillStyle = t.skyAccent;
    ctx.beginPath(); ctx.arc(cx + S * Math.cos(earthA), cy - S * Math.sin(earthA), 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e8826a";
    ctx.beginPath(); ctx.arc(cx + 1.524 * S * Math.cos(marsA), cy - 1.524 * S * Math.sin(marsA), 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = t.small; ctx.fillStyle = t.skyMuted; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("seen from above the Sun's north pole; orbits of Earth and Mars", 10, 8);

    const trip = 1 / vAU;
    out.set("trip", trip.toFixed(1) + " days");
    out.set("angle", Math.round((Math.atan(omega * 1 / vAU) * 180) / Math.PI) + "° from straight out");
    out.set("turn", Math.round((trip / s.rot) * 360) + "°");
  });
});
