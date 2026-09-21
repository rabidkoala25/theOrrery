/* Phases of the Moon: half the Moon is always lit by the Sun. How much of
   that lit half faces Earth depends on the angle between Sun and Moon as
   seen from Earth, which is what the phase is. */
OrrerySims.register("moon-phases", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 640 ? 1.3 : 0.5), max: 720, label: "The Moon orbiting Earth with sunlight from the left, beside the Moon's appearance from Earth" });
  const p = kit.panel();
  const MONTH = 29.53;
  const s = { age: 4, rate: 1.5, play: true };

  const ageS = kit.slider(p, { label: "Days since new Moon", min: 0, max: MONTH, step: 0.01, value: s.age, format: (v) => v.toFixed(1) + " days", onInput: (v) => { s.age = v; } });
  kit.slider(p, { label: "Speed", min: 0.2, max: 6, step: 0.1, value: s.rate, format: (v) => v.toFixed(1) + " days per second", onInput: (v) => (s.rate = v) });
  const playBtn = kit.button(p, "Pause", () => { s.play = !s.play; playBtn.textContent = s.play ? "Pause" : "Play"; });
  const out = kit.readouts(kit.root, [["name", "Phase"], ["lit", "Disc lit"], ["rise", "Rises around"], ["sky", "Best seen"]]);

  const phaseName = (E) => {
    const d = ((E % 360) + 360) % 360;
    if (d < 6 || d > 354) return "new Moon";
    if (d < 84) return "waxing crescent";
    if (d < 96) return "first quarter";
    if (d < 174) return "waxing gibbous";
    if (d < 186) return "full Moon";
    if (d < 264) return "waning gibbous";
    if (d < 276) return "last quarter";
    return "waning crescent";
  };
  const clock = (h) => {
    h = ((h % 24) + 24) % 24;
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60 / 15) * 15;
    return String(mm === 60 ? hh + 1 : hh).padStart(2, "0") + ":" + String(mm === 60 ? 0 : mm).padStart(2, "0");
  };

  // the Moon as seen from the northern hemisphere, drawn scanline by scanline
  function drawPhase(ctx, cx, cy, r, E) {
    const cosE = Math.cos(E);
    const waxing = Math.sin(E) >= 0;
    // the whole face lit, with a few maria so it reads as the Moon...
    ctx.fillStyle = "#e9e4d6";
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(120,118,112,0.35)";
    for (const [mx, my, mr] of [[-0.3, -0.3, 0.22], [0.15, -0.35, 0.16], [0.3, 0.05, 0.2], [-0.1, 0.15, 0.13], [-0.45, 0.25, 0.12]]) {
      ctx.beginPath(); ctx.arc(cx + mx * r, cy + my * r, mr * r, 0, Math.PI * 2); ctx.fill();
    }
    // ...then the night side over it: one limb plus the curved terminator
    ctx.fillStyle = "#15181f";
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, waxing);   // left limb when waxing
    const sign = waxing ? 1 : -1;
    for (let k = 0; k <= 64; k++) {
      const y = r - (2 * r * k) / 64;
      const hw = Math.sqrt(Math.max(0, r * r - y * y));
      ctx.lineTo(cx + sign * hw * cosE, cy + y);
    }
    ctx.closePath();
    ctx.fill();
  }

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    if (s.play) { s.age = (s.age + s.rate * dt) % MONTH; ageS.set(s.age, false); }
    const E = (s.age / MONTH) * Math.PI * 2;        // elongation from the Sun

    const wide = w >= 640;
    const orb = wide ? { x: 0, y: 0, w: w * 0.6, h } : { x: 0, y: 0, w, h: h * 0.6 };
    const view = wide ? { x: w * 0.6, y: 0, w: w * 0.4, h } : { x: 0, y: h * 0.6, w, h: h * 0.4 };
    ctx.fillStyle = t.sky;
    ctx.fillRect(0, 0, w, h);

    // ---- top-down view, Sun far off to the left
    const cx = orb.x + orb.w / 2 + orb.w * 0.06, cy = orb.y + orb.h / 2;
    const R = Math.min(orb.w, orb.h) * 0.36;
    ctx.strokeStyle = "rgba(255,231,168,0.12)";
    for (let k = -4; k <= 4; k++) {
      const y = cy + (k * orb.h) / 10;
      ctx.beginPath(); ctx.moveTo(orb.x + 8, y); ctx.lineTo(orb.x + orb.w - 8, y); ctx.stroke();
    }
    ctx.font = t.small;
    ctx.fillStyle = t.sun;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("sunlight", orb.x + 10, orb.y + 8);
    ctx.strokeStyle = t.skyRule;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    // Earth, lit on the sunward side
    const er = Math.max(10, R * 0.16);
    const eg = ctx.createLinearGradient(cx - er, cy, cx + er, cy);
    eg.addColorStop(0, "#6f9be0"); eg.addColorStop(0.5, "#3f6aa8"); eg.addColorStop(0.52, "#152033"); eg.addColorStop(1, "#101826");
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(cx, cy, er, 0, Math.PI * 2); ctx.fill();
    // Moon: lit half faces the Sun, dashed arc marks the half facing Earth
    const mx = cx - R * Math.cos(E), my = cy + R * Math.sin(E);
    const mr = Math.max(6, er * 0.45);
    ctx.fillStyle = "#1b1f27";
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e9e4d6";
    ctx.beginPath(); ctx.arc(mx, my, mr, Math.PI / 2, Math.PI * 1.5); ctx.fill();
    const toEarth = Math.atan2(cy - my, cx - mx);
    ctx.strokeStyle = t.skyMark;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx, my, mr + 4, toEarth - Math.PI / 2, toEarth + Math.PI / 2); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = t.skyMuted;
    ctx.textBaseline = "bottom";
    ctx.fillText("red arc: the half of the Moon that faces Earth", orb.x + 10, orb.y + orb.h - 8);

    // ---- what you see
    const vr = Math.min(view.w, view.h) * 0.32;
    drawPhase(ctx, view.x + view.w / 2, view.y + view.h / 2, vr, E);
    ctx.fillStyle = t.skyMuted;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("from the northern hemisphere", view.x + view.w / 2, view.y + 8);

    const lit = (1 - Math.cos(E)) / 2;
    const elongDeg = (E * 180) / Math.PI;
    out.set("name", phaseName(elongDeg));
    out.set("lit", Math.round(lit * 100) + "%");
    out.set("rise", clock(6 + elongDeg / 15));
    out.set("sky", elongDeg < 20 || elongDeg > 340 ? "not visible, lost in the Sun's glare"
      : elongDeg < 180 ? "evening, setting around " + clock(18 + elongDeg / 15)
      : "morning, setting around " + clock(elongDeg / 15 - 6));
  });
});
