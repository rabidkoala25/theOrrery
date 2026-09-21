/* Hubble's law: space stretches uniformly, so every galaxy sees every other
   one receding at a speed proportional to its distance — whichever galaxy you
   stand on. Click any galaxy to move there. */
OrrerySims.register("hubble-expansion", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 640 ? 1.35 : 0.52), max: 760, label: "A field of galaxies moving apart, with a graph of their speed against distance" });
  const p = kit.panel();
  const MPC_PER_UNIT = 60;
  const rand = kit.rng(20010);
  const gal = [];
  for (let i = 0; i < 80; i++) {
    const r = Math.sqrt(rand()) * 1.25, th = rand() * Math.PI * 2;
    gal.push({ x: r * Math.cos(th), y: r * Math.sin(th), rot: rand() * Math.PI, e: 0.35 + rand() * 0.6, b: 0.55 + rand() * 0.45, s: 0.7 + rand() * 0.9 });
  }
  let obs = 0, best = 9;
  gal.forEach((g, i) => { const d = Math.hypot(g.x, g.y); if (d < best) { best = d; obs = i; } });

  const s = { H0: 70, a: 1, play: true };
  kit.slider(p, { label: "Hubble constant", min: 40, max: 100, step: 1, value: s.H0, format: (v) => v + " km/s per Mpc", onInput: (v) => (s.H0 = v) });
  const playBtn = kit.button(p, "Pause", () => {
    s.play = !s.play;
    playBtn.textContent = s.play ? "Pause" : "Play";
  });
  kit.button(p, "Back to the start", () => (s.a = 1));
  const out = kit.readouts(kit.root, [["you", "You are on"], ["age", "Hubble time, 1/H₀"], ["a", "Universe has grown by"], ["far", "Fastest galaxy in view"]]);

  kit.pointer(c, {
    down: (pt) => {
      const L = layout();
      if (pt.x > L.sky.x + L.sky.w || pt.y > L.sky.y + L.sky.h) return;
      let pick = obs, bd = 18;
      gal.forEach((g, i) => {
        const q = toScreen(g, L);
        const d = Math.hypot(q.x - pt.x, q.y - pt.y);
        if (d < bd) { bd = d; pick = i; }
      });
      obs = pick;
    },
  });

  function layout() {
    const { w, h } = c;
    if (w < 640) {
      const skyH = Math.round(h * 0.56);
      return { sky: { x: 0, y: 0, w, h: skyH }, plot: { x: 64, y: skyH + 24, w: w - 84, h: h - skyH - 70 } };
    }
    const skyW = Math.round(w * 0.56);
    return { sky: { x: 0, y: 0, w: skyW, h }, plot: { x: skyW + 70, y: 24, w: w - skyW - 90, h: h - 72 } };
  }
  function toScreen(g, L) {
    const o = gal[obs];
    const S = (Math.min(L.sky.w, L.sky.h) / 2) / 1.05;
    return { x: L.sky.x + L.sky.w / 2 + (g.x - o.x) * s.a * S, y: L.sky.y + L.sky.h / 2 - (g.y - o.y) * s.a * S };
  }

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    if (s.play) {
      s.a *= Math.exp(dt * 0.06 * (s.H0 / 70));
      if (s.a > 2.4) s.a = 1;
    }
    const L = layout();
    ctx.fillStyle = t.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = t.sky;
    ctx.fillRect(L.sky.x, L.sky.y, L.sky.w, L.sky.h);

    ctx.save();
    ctx.beginPath();
    ctx.rect(L.sky.x, L.sky.y, L.sky.w, L.sky.h);
    ctx.clip();
    const o = gal[obs];
    const oS = toScreen(o, L);
    const pts = [];
    let fastest = 0;
    gal.forEach((g, i) => {
      const q = toScreen(g, L);
      const d = Math.hypot(g.x - o.x, g.y - o.y) * s.a * MPC_PER_UNIT;
      const v = s.H0 * d;
      if (i !== obs) pts.push([d, v]);
      const visible = q.x > L.sky.x && q.x < L.sky.x + L.sky.w && q.y > L.sky.y && q.y < L.sky.y + L.sky.h;
      if (visible && i !== obs) fastest = Math.max(fastest, v);
      // velocity arrow, length proportional to recession speed
      if (i !== obs && visible) {
        const dx = q.x - oS.x, dy = q.y - oS.y, dn = Math.hypot(dx, dy) || 1;
        const len = (v / 12000) * 60;
        ctx.strokeStyle = "rgba(228,96,122,0.55)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.lineTo(q.x + (dx / dn) * len, q.y + (dy / dn) * len);
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(g.rot);
      ctx.fillStyle = i === obs ? t.sun : `rgba(211,218,230,${g.b})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.2 * g.s, 4.2 * g.s * g.e, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.strokeStyle = t.sun;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(oS.x, oS.y, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.font = t.small;
    ctx.fillStyle = t.skyMuted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("click any galaxy to stand on it", L.sky.x + 10, L.sky.y + 8);

    // speed against distance, as seen from the chosen galaxy
    const dmax = 160, vmax = 100 * dmax;
    const { X, Y } = kit.axes(ctx, L.plot, {
      xmin: 0, xmax: dmax, ymin: 0, ymax: vmax,
      xticks: [0, 40, 80, 120, 160], yticks: [0, 4000, 8000, 12000, 16000],
      yfmt: (v) => (v / 1000) + "k", xlabel: "distance from you (Mpc)", ylabel: "recession speed (km/s)",
    });
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    ctx.lineTo(X(dmax), Y(Math.min(vmax, s.H0 * dmax)));
    ctx.stroke();
    ctx.fillStyle = t.mark;
    for (const [d, v] of pts) {
      if (d > dmax || v > vmax) continue;
      ctx.beginPath();
      ctx.arc(X(d), Y(v), 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    out.set("you", "galaxy " + (obs + 1) + " of " + gal.length);
    out.set("age", (977.8 / s.H0).toFixed(1) + " billion years");
    out.set("a", Math.round((s.a - 1) * 100) + "%");
    out.set("far", Math.round(fastest).toLocaleString("en-US") + " km/s");
  });
});
