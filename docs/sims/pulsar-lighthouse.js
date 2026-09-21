/* Pulsars: a neutron star's radio beams come out along its magnetic axis,
   which is tilted from its spin axis. Each turn, a beam may sweep across
   Earth and we see a pulse. Whether we see one pulse, two, or none depends on
   the two angles. */
OrrerySims.register("pulsar-lighthouse", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 560 ? 1.2 : 0.56), max: 720, label: "A spinning neutron star with two sweeping beams, above the pulses they produce at Earth" });
  const p = kit.panel();
  const D2R = Math.PI / 180;
  const s = { alpha: 45, zeta: 55, width: 12, P: 0.0334, phase: 0, hist: [] };
  const presets = {
    crab: ["Crab Pulsar (33 ms)", 0.0334, 45, 55],
    vela: ["Vela Pulsar (89 ms)", 0.0893, 43, 50],
    cp1919: ["PSR B1919+21, the first found (1.34 s)", 1.3373, 30, 36],
    msp: ["A millisecond pulsar (1.56 ms)", 0.00156, 80, 88],
    ortho: ["An orthogonal rotator, two pulses", 0.25, 88, 90],
  };
  kit.select(p, {
    label: "Pick a pulsar",
    options: Object.entries(presets).map(([k, v]) => [k, v[0]]),
    value: "crab",
    onChange: (k) => { const [, P, a, z] = presets[k]; pS.set(P); aS.set(a); zS.set(z); },
  });
  const pS = kit.slider(p, { label: "Spin period", min: 0.0014, max: 8, log: true, value: s.P, format: (v) => (v < 1 ? (v * 1000).toFixed(v < 0.01 ? 2 : 1) + " ms" : v.toFixed(2) + " s"), onInput: (v) => (s.P = v) });
  const aS = kit.slider(p, { label: "Tilt of the magnetic axis", min: 0, max: 90, step: 1, value: s.alpha, format: (v) => v + "°", onInput: (v) => { s.alpha = v; s.hist = []; } });
  const zS = kit.slider(p, { label: "Our line of sight, from the spin axis", min: 0, max: 90, step: 1, value: s.zeta, format: (v) => v + "°", onInput: (v) => { s.zeta = v; s.hist = []; } });
  kit.slider(p, { label: "Beam width", min: 4, max: 30, step: 1, value: s.width, format: (v) => v + "°", onInput: (v) => { s.width = v; s.hist = []; } });
  const out = kit.readouts(kit.root, [["spin", "Real spin rate"], ["surf", "Equator speed"], ["pulses", "Pulses per turn"], ["slow", "Shown slowed by"]]);

  // intensity seen from direction zeta when the magnetic poles point along m and -m
  const beamAt = (phase) => {
    const a = s.alpha * D2R, z = s.zeta * D2R;
    const m = [Math.sin(a) * Math.cos(phase), Math.sin(a) * Math.sin(phase), Math.cos(a)];
    const o = [Math.sin(z), 0, Math.cos(z)];
    const dot = m[0] * o[0] + m[1] * o[1] + m[2] * o[2];
    const sig = (s.width * D2R) / 2;
    const one = (d) => Math.exp(-((Math.acos(Math.max(-1, Math.min(1, d))) / sig) ** 2) / 2);
    return { m, main: one(dot), inter: one(-dot) };
  };

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    const shownRate = 0.45;                      // turns per second on screen
    s.phase += 2 * Math.PI * shownRate * dt;
    const b = beamAt(s.phase);
    s.hist.push(b.main + b.inter * 0.6);
    const keep = Math.round(3 / Math.max(dt, 1 / 120) / shownRate);
    if (s.hist.length > keep) s.hist.splice(0, s.hist.length - keep);

    const topH = Math.round(h * 0.62);
    ctx.fillStyle = t.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = t.sky;
    ctx.fillRect(0, 0, w, topH);

    // ---- projected 3D view: spin axis up, Earth off to the right
    const cx = w * 0.42, cy = topH / 2, L = Math.min(w * 0.36, topH * 0.44);
    const tilt = 0.35;                                      // look slightly from above
    const proj = (v) => [cx + v[0] * L, cy - (v[2] * Math.cos(tilt) - v[1] * Math.sin(tilt)) * L];
    const depth = (v) => v[1] * Math.cos(tilt) + v[2] * Math.sin(tilt);
    // spin axis
    ctx.strokeStyle = t.skyRule;
    ctx.setLineDash([3, 4]);
    const [ax0, ay0] = proj([0, 0, -1.1]), [ax1, ay1] = proj([0, 0, 1.1]);
    ctx.beginPath(); ctx.moveTo(ax0, ay0); ctx.lineTo(ax1, ay1); ctx.stroke();
    // line of sight to Earth
    const o = [Math.sin(s.zeta * D2R), 0, Math.cos(s.zeta * D2R)];
    const [ox, oy] = proj(o.map((v) => v * 1.25));
    ctx.strokeStyle = "rgba(143,179,238,0.6)";
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ox, oy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = t.skyAccent;
    ctx.beginPath(); ctx.arc(ox, oy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.font = t.small; ctx.fillStyle = t.skyMuted; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("to Earth", ox + 8, oy);
    // beams: back one first, then the star, then the front one
    const cone = (dir, strength) => {
      const [bx, by] = proj(dir.map((v) => v * 1.05));
      const [bxS, byS] = proj(dir.map((v) => v * 0.12));
      const nx = -(by - byS), ny = bx - bxS, nn = Math.hypot(nx, ny) || 1;
      const spread = Math.tan((s.width * D2R) / 2) * L * 1.05;
      const g = ctx.createLinearGradient(bxS, byS, bx, by);
      g.addColorStop(0, `rgba(255,236,190,${0.55 + strength * 0.4})`);
      g.addColorStop(1, "rgba(255,236,190,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bxS, byS);
      ctx.lineTo(bx + (nx / nn) * spread, by + (ny / nn) * spread);
      ctx.lineTo(bx - (nx / nn) * spread, by - (ny / nn) * spread);
      ctx.closePath(); ctx.fill();
    };
    const mNeg = b.m.map((v) => -v);
    const [front, back] = depth(b.m) < depth(mNeg) ? [b.m, mNeg] : [mNeg, b.m];
    cone(back, back === b.m ? b.main : b.inter);
    const sr = Math.max(8, L * 0.1);
    const sg = ctx.createRadialGradient(cx - sr * 0.3, cy - sr * 0.3, 1, cx, cy, sr);
    sg.addColorStop(0, "#ffffff"); sg.addColorStop(1, "#8fb3ee");
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(cx, cy, sr, 0, Math.PI * 2); ctx.fill();
    cone(front, front === b.m ? b.main : b.inter);
    ctx.fillStyle = t.skyMuted; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("dashed: spin axis", 10, 8);

    // ---- pulses received
    const rect = { x: 16, y: topH + 20, w: w - 32, h: h - topH - 40 };
    ctx.strokeStyle = t.rule;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w, rect.h);
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    s.hist.forEach((v, i) => {
      const x = rect.x + (i / Math.max(1, keep - 1)) * rect.w;
      const y = rect.y + rect.h - 4 - Math.min(1.1, v) * (rect.h - 10);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.font = t.small; ctx.fillStyle = t.muted; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText("radio signal at Earth, last three turns", rect.x, rect.y - 3);

    // count pulses per turn from the geometry
    let pulses = 0;
    const sampleTurn = (fn) => { let peak = 0; for (let k = 0; k < 360; k++) peak = Math.max(peak, fn(beamAt((k / 360) * 2 * Math.PI))); return peak; };
    if (sampleTurn((q) => q.main) > 0.2) pulses++;
    if (sampleTurn((q) => q.inter) > 0.2) pulses++;
    const hz = 1 / s.P;
    const v = (2 * Math.PI * 10) / s.P;                     // km/s for a 10 km radius
    out.set("spin", (hz >= 10 ? Math.round(hz) : hz.toFixed(2)) + " turns per second");
    out.set("surf", Math.round(v).toLocaleString("en-US") + " km/s (" + ((v / 299792) * 100).toFixed(1) + "% of light)");
    out.set("pulses", pulses === 0 ? "none: the beams miss us" : pulses === 1 ? "one" : "two: a main pulse and an interpulse");
    out.set("slow", Math.round(hz / shownRate).toLocaleString("en-US") + "×");
  });
});
