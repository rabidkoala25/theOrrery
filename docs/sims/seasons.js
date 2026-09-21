/* Seasons: Earth's axis stays pointed the same way in space as it goes round
   the Sun, so for half the year each hemisphere leans sunward and gets a high
   Sun and long days. Distance from the Sun barely matters: Earth is closest
   in early January, in the northern winter. */
OrrerySims.register("seasons", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 640 ? 1.3 : 0.5), max: 740, label: "Earth on its orbit with a tilted axis, beside the Sun's path across the sky at a chosen latitude" });
  const p = kit.panel();
  const s = { day: 172, lat: 51.5, tilt: 23.44, play: false };
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dateOf = (d) => {
    const dt = new Date(Date.UTC(2026, 0, 1) + (Math.round(d) - 1) * 86400000);
    return dt.getUTCDate() + " " + MONTHS[dt.getUTCMonth()];
  };

  const dayS = kit.slider(p, { label: "Date", min: 1, max: 365, step: 1, value: s.day, format: dateOf, onInput: (v) => (s.day = v) });
  kit.slider(p, { label: "Your latitude", min: -80, max: 80, step: 0.5, value: s.lat, format: (v) => Math.abs(v).toFixed(1) + "° " + (v >= 0 ? "N" : "S"), onInput: (v) => (s.lat = v) });
  kit.slider(p, { label: "Tilt of Earth's axis", min: 0, max: 45, step: 0.1, value: s.tilt, format: (v) => v.toFixed(1) + "°", onInput: (v) => (s.tilt = v) });
  const playBtn = kit.button(p, "Play the year", () => { s.play = !s.play; playBtn.textContent = s.play ? "Pause" : "Play the year"; });
  const out = kit.readouts(kit.root, [["alt", "Sun at noon"], ["len", "Daylight"], ["ins", "Sunlight per day"], ["dist", "Distance from the Sun"]]);

  const D2R = Math.PI / 180;
  const solar = (day, lat, tilt) => {
    const lam = (2 * Math.PI * (day - 80)) / 365.25;          // Sun's ecliptic longitude
    const dec = Math.asin(Math.sin(tilt * D2R) * Math.sin(lam));
    const phi = lat * D2R;
    const cosH = -Math.tan(phi) * Math.tan(dec);
    const H0 = cosH <= -1 ? Math.PI : cosH >= 1 ? 0 : Math.acos(cosH);
    const dist = 1 - 0.0167 * Math.cos((2 * Math.PI * (day - 3)) / 365.25);
    const Q = (1361 / Math.PI) / (dist * dist) * (H0 * Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.sin(H0));
    return { lam, dec, H0, dist, Q: Math.max(0, Q), noon: 90 - Math.abs(lat - dec / D2R) };
  };
  const altAz = (H, dec, phi) => {
    const sinAlt = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H);
    const alt = Math.asin(sinAlt);
    const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(H));
    return [((az / D2R) + 360) % 360, alt / D2R];
  };

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    if (s.play) { s.day = s.day + dt * 30 > 365 ? 1 : s.day + dt * 30; dayS.set(s.day, false); }
    const now = solar(s.day, s.lat, s.tilt);

    const wide = w >= 640;
    const orb = wide ? { x: 0, y: 0, w: w * 0.5, h } : { x: 0, y: 0, w, h: h * 0.5 };
    const skyP = wide ? { x: w * 0.5 + 56, y: 22, w: w * 0.5 - 72, h: h - 70 } : { x: 52, y: h * 0.5 + 20, w: w - 68, h: h * 0.5 - 66 };
    ctx.fillStyle = t.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = t.sky;
    ctx.fillRect(orb.x, orb.y, orb.w, orb.h);

    // ---- the orbit, seen at a slant
    const cx = orb.x + orb.w / 2, cy = orb.y + orb.h / 2;
    const A = orb.w * 0.38, B = Math.min(orb.h * 0.3, A * 0.42);
    ctx.strokeStyle = t.skyRule;
    ctx.beginPath(); ctx.ellipse(cx, cy, A, B, 0, 0, Math.PI * 2); ctx.stroke();
    const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 22);
    sg.addColorStop(0, "#fff6d8"); sg.addColorStop(0.4, t.sun); sg.addColorStop(1, "rgba(255,231,168,0)");
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();
    // Earth's position: the Sun's longitude + 180°, with June on the right
    const drawEarth = (day, alpha, label) => {
      const lam = (2 * Math.PI * (day - 80)) / 365.25;
      const a = lam + Math.PI;
      const ex = cx - A * Math.sin(a), ey = cy + B * Math.cos(a);
      const r = Math.max(7, orb.w * 0.035);
      ctx.globalAlpha = alpha;
      const toSun = Math.atan2(cy - ey, cx - ex);
      const g = ctx.createLinearGradient(ex + Math.cos(toSun) * r, ey + Math.sin(toSun) * r, ex - Math.cos(toSun) * r, ey - Math.sin(toSun) * r);
      g.addColorStop(0, "#7fa6e6"); g.addColorStop(0.48, "#3e68a6"); g.addColorStop(0.52, "#141d2c"); g.addColorStop(1, "#0f1622");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
      // the axis always leans the same way. In June Earth is on the right,
      // so a north pole leaning left leans towards the Sun: northern summer
      const ax = -Math.sin(s.tilt * D2R), ay = Math.cos(s.tilt * D2R);
      ctx.strokeStyle = t.skyInk;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(ex - ax * r * 1.7, ey + ay * r * 1.7); ctx.lineTo(ex + ax * r * 1.7, ey - ay * r * 1.7); ctx.stroke();
      ctx.lineWidth = 1;
      if (label) {
        ctx.font = t.small; ctx.fillStyle = t.skyMuted; ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText(label, ex, ey + r * 1.9);
      }
      ctx.globalAlpha = 1;
    };
    [[172, "June"], [355, "December"], [80, "March"], [266, "September"]].forEach(([d, l]) => drawEarth(d, 0.28, l));
    drawEarth(s.day, 1, "");
    ctx.font = t.small; ctx.fillStyle = t.skyMuted; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("the axis keeps pointing the same way", orb.x + 10, orb.y + 8);

    // ---- the Sun's path across your sky
    const { X, Y } = kit.axes(ctx, skyP, {
      xmin: 0, xmax: 360, ymin: -20, ymax: 90,
      xticks: [0, 90, 180, 270, 360], yticks: [0, 30, 60, 90],
      xfmt: (v) => ({ 0: "N", 90: "E", 180: "S", 270: "W", 360: "N" }[v]), yfmt: (v) => v + "°",
      xlabel: "direction", ylabel: "height of the Sun",
    });
    ctx.fillStyle = t.accentSoft;
    ctx.fillRect(skyP.x + 1, Y(0), skyP.w - 1, skyP.y + skyP.h - Y(0));
    ctx.fillStyle = t.muted; ctx.font = t.small; ctx.textAlign = "right"; ctx.textBaseline = "top";
    ctx.fillText("below the horizon", skyP.x + skyP.w - 6, Y(0) + 4);
    const path = (day, color, width, dash) => {
      const sd = solar(day, s.lat, s.tilt);
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      ctx.beginPath();
      let last = null;
      for (let k = 0; k <= 288; k++) {
        const H = -Math.PI + (2 * Math.PI * k) / 288;
        const [az, alt] = altAz(H, sd.dec, s.lat * D2R);
        const x = X(az), y = Y(Math.max(-20, alt));
        if (last !== null && Math.abs(az - last) > 180) ctx.moveTo(x, y); else if (last === null) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        last = az;
      }
      ctx.stroke(); ctx.setLineDash([]);
    };
    path(172, t.muted, 1, [4, 4]);
    path(355, t.muted, 1, [4, 4]);
    path(s.day, t.mark, 2.2);

    const hours = (2 * now.H0) / (15 * D2R);
    out.set("alt", now.noon > 0 ? now.noon.toFixed(1) + "° above the horizon" : "never rises");
    out.set("len", hours >= 23.99 ? "24 h, midnight sun" : hours <= 0.01 ? "none, polar night" : Math.floor(hours) + " h " + String(Math.round((hours % 1) * 60)).padStart(2, "0") + " min");
    out.set("ins", Math.round(now.Q) + " W/m², averaged over the day");
    out.set("dist", (now.dist * 149.6).toFixed(1) + " million km");
  });
});
