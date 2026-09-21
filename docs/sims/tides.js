/* Tides: the Moon stretches the oceans into two bulges, one facing it and one
   opposite. The Sun adds a smaller pair. When the two line up (new and full
   Moon) the tides are large, spring tides; at quarter Moon they partly
   cancel, neap tides. A coastal town rotates through the bulges twice a day. */
OrrerySims.register("tides", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 640 ? 1.35 : 0.52), max: 760, label: "Earth with exaggerated tidal bulges from the Moon and Sun, beside a tide-gauge record" });
  const p = kit.panel();
  const MONTH = 29.53;
  const AM = 27, AS = 12.5;           // equilibrium tide amplitudes, cm
  const s = { t: 2, rate: 0.35, sun: true, moon: true };

  kit.slider(p, { label: "Speed", min: 0.05, max: 2, step: 0.05, value: s.rate, format: (v) => v.toFixed(2) + " days per second", onInput: (v) => (s.rate = v) });
  kit.toggle(p, { label: "Moon's pull", value: true, onChange: (v) => (s.moon = v) });
  kit.toggle(p, { label: "Sun's pull", value: true, onChange: (v) => (s.sun = v) });
  const out = kit.readouts(kit.root, [["kind", "Tides this week"], ["range", "Range today"], ["moon", "Moon"], ["next", "Next high tide"]]);

  // angles in the frame where the Sun is fixed on the left
  const moonAng = (t) => Math.PI + (2 * Math.PI * t) / MONTH;
  const townAng = (t) => Math.PI + 2 * Math.PI * t;        // noon when facing the Sun
  const SUN = Math.PI;
  const height = (t, ang = townAng(t)) =>
    (s.moon ? AM * Math.cos(2 * (ang - moonAng(t))) : 0) + (s.sun ? AS * Math.cos(2 * (ang - SUN)) : 0);

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const th = kit.theme();
    s.t += s.rate * dt;

    const wide = w >= 640;
    const earthBox = wide ? { x: 0, y: 0, w: h, h } : { x: 0, y: 0, w, h: h * 0.55 };
    const plot = wide ? { x: h + 72, y: 24, w: w - h - 90, h: h - 72 } : { x: 74, y: h * 0.55 + 22, w: w - 90, h: h * 0.45 - 66 };
    ctx.fillStyle = th.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = th.sky;
    ctx.fillRect(earthBox.x, earthBox.y, earthBox.w, earthBox.h);

    const cx = earthBox.x + earthBox.w / 2, cy = earthBox.y + earthBox.h / 2;
    const R = Math.min(earthBox.w, earthBox.h) * 0.26;
    const EXAG = R * 0.007;             // px per cm: hugely exaggerated

    // ocean shell
    ctx.fillStyle = "rgba(76,128,204,0.55)";
    ctx.beginPath();
    for (let k = 0; k <= 180; k++) {
      const a = (k / 180) * Math.PI * 2;
      const r = R + 10 + height(s.t, a) * EXAG;
      const x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    // Earth, day side facing the Sun
    const g = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
    g.addColorStop(0, "#5d7f4f"); g.addColorStop(0.5, "#3e5a36"); g.addColorStop(0.52, "#1a2418"); g.addColorStop(1, "#141c13");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    // the town
    const ta = townAng(s.t);
    const tr = R + 10 + height(s.t) * EXAG;
    ctx.fillStyle = th.skyMark;
    ctx.beginPath(); ctx.arc(cx + R * Math.cos(ta), cy - R * Math.sin(ta), 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = th.skyMark;
    ctx.beginPath(); ctx.moveTo(cx + R * Math.cos(ta), cy - R * Math.sin(ta)); ctx.lineTo(cx + tr * Math.cos(ta), cy - tr * Math.sin(ta)); ctx.stroke();
    // Moon, not to scale, on its orbit
    const ma = moonAng(s.t), mR = Math.min(earthBox.w, earthBox.h) * 0.44;
    ctx.fillStyle = "#e9e4d6";
    ctx.beginPath(); ctx.arc(cx + mR * Math.cos(ma), cy - mR * Math.sin(ma), 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = th.skyRule;
    ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.arc(cx, cy, mR, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = th.small;
    ctx.fillStyle = th.sun;
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("← to the Sun", earthBox.x + 10, earthBox.y + 8);
    ctx.fillStyle = th.skyMuted;
    ctx.textBaseline = "bottom";
    ctx.fillText("red: a coastal town. Bulges exaggerated.", earthBox.x + 10, earthBox.y + earthBox.h - 8);

    // tide gauge, last 15 days
    const span = 15, ymax = 45;
    const { X, Y } = kit.axes(ctx, plot, {
      xmin: -span, xmax: 0, ymin: -ymax, ymax,
      xticks: [-15, -10, -5, 0], yticks: [-40, -20, 0, 20, 40],
      xfmt: (v) => (v === 0 ? "now" : v + " d"), yfmt: (v) => v + " cm",
      xlabel: "days", ylabel: "sea level at the town",
    });
    ctx.strokeStyle = th.accent;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const N = 900;
    for (let k = 0; k <= N; k++) {
      const tt = s.t - span + (span * k) / N;
      const y = Y(height(tt));
      k ? ctx.lineTo(X(tt - s.t), y) : ctx.moveTo(X(tt - s.t), y);
    }
    ctx.stroke();
    ctx.fillStyle = th.mark;
    ctx.beginPath(); ctx.arc(X(0), Y(height(s.t)), 4.5, 0, Math.PI * 2); ctx.fill();

    // readouts
    let hi = -1e9, lo = 1e9;
    for (let k = 0; k <= 96; k++) { const v = height(s.t - 0.5 + k / 96); hi = Math.max(hi, v); lo = Math.min(lo, v); }
    const sep = Math.abs(Math.cos(2 * (moonAng(s.t) - SUN)));
    let next = null;
    for (let k = 1; k <= 300 && next === null; k++) {
      const a = height(s.t + (k - 1) / 288), b = height(s.t + k / 288), c2 = height(s.t + (k + 1) / 288);
      if (b > a && b >= c2) next = k / 288;
    }
    const age = ((s.t % MONTH) + MONTH) % MONTH;
    out.set("kind", !s.moon || !s.sun ? "one body only" : sep > 0.7 ? "spring tides (large)" : sep < 0.3 ? "neap tides (small)" : "in between");
    out.set("range", Math.round(hi - lo) + " cm, open ocean");
    out.set("moon", age < 1.5 || age > 28 ? "new" : Math.abs(age - 14.77) < 1.5 ? "full" : Math.abs(age - 7.4) < 1.5 ? "first quarter" : Math.abs(age - 22.1) < 1.5 ? "last quarter" : age < 14.77 ? "waxing" : "waning");
    const mins = next === null ? 0 : Math.round(next * 1440);
    out.set("next", next === null ? "—" : "in " + Math.floor(mins / 60) + " h " + String(mins % 60).padStart(2, "0") + " min");
  });
});
