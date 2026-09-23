/* Kirkwood gaps: an asteroid whose period is a simple fraction of Jupiter's
   meets Jupiter at the same few places, orbit after orbit, and the repeated
   tugs add up. At most such resonances the asteroid belt has emptied out. */
OrrerySims.register("kirkwood-gaps", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 640 ? 1.3 : 0.52), max: 740, label: "An asteroid and Jupiter orbiting the Sun, with their meeting points marked, beside a histogram of asteroid orbits showing gaps" });
  const p = kit.panel();
  const AJ = 5.203, PJ = 11.862;
  const s = { a: 2.5, rate: 6, t: 0, meets: [], lastRel: null };
  const RES = [
    [3.28, "2:1", true], [2.50, "3:1", true], [2.82, "5:2", true], [2.95, "7:3", true], [2.065, "4:1", true], [3.97, "3:2", false],
  ];

  kit.select(p, {
    label: "Jump to",
    options: [["", "Choose…"], ["2.502", "3:1 resonance (a gap)"], ["3.279", "2:1 resonance (a gap)"], ["3.972", "3:2 resonance (the Hildas)"], ["2.7", "No resonance"]],
    value: "",
    onChange: (v) => { if (v) aS.set(+v); },
  });
  const aS = kit.slider(p, { label: "Asteroid's orbit size", min: 2.0, max: 4.2, step: 0.001, value: s.a, format: (v) => v.toFixed(3) + " AU", onInput: (v) => { s.a = v; s.meets = []; s.lastRel = null; } });
  kit.slider(p, { label: "Speed", min: 1, max: 30, step: 1, value: s.rate, format: (v) => v + " years per second", onInput: (v) => (s.rate = v) });
  const out = kit.readouts(kit.root, [["ratio", "Jupiter's period / asteroid's"], ["near", "Nearest resonance"], ["meet", "Where they meet"]]);

  // a smooth stand-in for the observed belt: dense between 2.1 and 3.3 AU,
  // notched at the strong Jupiter resonances, a small bump for the Hildas
  const density = (a) => {
    let d = Math.exp(-((a - 2.7) ** 2) / (2 * 0.33 ** 2));
    if (a < 2.1) d *= Math.exp(-((2.1 - a) ** 2) / 0.004);
    if (a > 3.3) d *= Math.exp(-((a - 3.3) ** 2) / 0.006);
    for (const [ar, , gap] of RES) if (gap) d *= 1 - 0.93 * Math.exp(-((a - ar) ** 2) / (2 * 0.012 ** 2));
    d += 0.12 * Math.exp(-((a - 3.97) ** 2) / (2 * 0.035 ** 2));
    return d;
  };

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    const P = Math.pow(s.a, 1.5);
    s.t += s.rate * dt;
    const angA = (2 * Math.PI * s.t) / P, angJ = (2 * Math.PI * s.t) / PJ;
    // record each conjunction, in the asteroid's own orbit
    const rel = (((angA - angJ) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (s.lastRel !== null && rel < s.lastRel - Math.PI) {
      s.meets.push(angJ);
      if (s.meets.length > 40) s.meets.shift();
    }
    s.lastRel = rel;

    const wide = w >= 640;
    const orb = wide ? { x: 0, y: 0, w: h, h } : { x: 0, y: 0, w, h: h * 0.55 };
    const hist = wide ? { x: h + 54, y: 24, w: w - h - 70, h: h - 72 } : { x: 50, y: h * 0.55 + 24, w: w - 66, h: h * 0.45 - 70 };
    ctx.fillStyle = t.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = t.sky;
    ctx.fillRect(orb.x, orb.y, orb.w, orb.h);

    const cx = orb.x + orb.w / 2, cy = orb.y + orb.h / 2, S = (Math.min(orb.w, orb.h) / 2 - 14) / AJ;
    ctx.strokeStyle = t.skyRule;
    for (const r of [s.a, AJ]) { ctx.beginPath(); ctx.arc(cx, cy, r * S, 0, Math.PI * 2); ctx.stroke(); }
    // meeting points: few, fixed spots at a resonance; everywhere otherwise
    s.meets.forEach((a, i) => {
      ctx.fillStyle = `rgba(228,96,122,${0.25 + (0.75 * (i + 1)) / s.meets.length})`;
      ctx.beginPath(); ctx.arc(cx + s.a * S * Math.cos(a), cy - s.a * S * Math.sin(a), 4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = t.sun;
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
    const jx = cx + AJ * S * Math.cos(angJ), jy = cy - AJ * S * Math.sin(angJ);
    const ax = cx + s.a * S * Math.cos(angA), ay = cy - s.a * S * Math.sin(angA);
    ctx.strokeStyle = "rgba(228,96,122,0.35)";
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(jx, jy); ctx.stroke();
    ctx.fillStyle = "#e9c99a";
    ctx.beginPath(); ctx.arc(jx, jy, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.skyInk;
    ctx.beginPath(); ctx.arc(ax, ay, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.font = t.small; ctx.fillStyle = t.skyMuted; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("red dots: where the asteroid has met Jupiter", orb.x + 10, orb.y + 8);

    // histogram of the belt
    const H = kit.axes(ctx, hist, {
      xmin: 2, xmax: 4.2, ymin: 0, ymax: 1.1,
      xticks: [2, 2.5, 3, 3.5, 4], yticks: [],
      xfmt: (v) => v.toFixed(1), xlabel: "orbit size (AU)", ylabel: "number of asteroids",
    });
    const bins = 110;
    ctx.fillStyle = t.accent;
    for (let k = 0; k < bins; k++) {
      const a0 = 2 + (2.2 * k) / bins, a1 = a0 + 2.2 / bins;
      const v = density((a0 + a1) / 2);
      ctx.fillRect(H.X(a0), H.Y(v), H.X(a1) - H.X(a0) - 0.5, H.Y(0) - H.Y(v));
    }
    ctx.font = t.small; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    for (const [ar, label] of RES) { ctx.fillStyle = t.muted; ctx.fillText(label, H.X(ar), hist.y + 14); }
    ctx.strokeStyle = t.mark; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(H.X(s.a), hist.y); ctx.lineTo(H.X(s.a), hist.y + hist.h); ctx.stroke();
    ctx.lineWidth = 1;

    const ratio = PJ / P;
    let near = RES[0];
    for (const r of RES) if (Math.abs(r[0] - s.a) < Math.abs(near[0] - s.a)) near = r;
    const onIt = Math.abs(near[0] - s.a) < 0.02;
    out.set("ratio", ratio.toFixed(3));
    out.set("near", near[1] + " at " + near[0].toFixed(2) + " AU" + (onIt ? (near[2] ? ": cleared out" : ": a stable home") : ""));
    const [pp, qq] = near[1].split(":").map(Number);
    const spots = pp - qq;              // a p:q resonance meets Jupiter at p − q places
    out.set("meet", onIt ? (spots === 1 ? "the same place" : "the same " + spots + " places") + ", over and over" : "all round the orbit, so the tugs cancel out");
  });
});
