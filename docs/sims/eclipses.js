/* Solar eclipses: the Moon is 400 times smaller than the Sun and about 400
   times closer, so the two look almost the same size. Whether an eclipse is
   total or annular depends on whether the tip of the Moon's shadow cone
   reaches the ground, which changes with the Moon's distance. */
OrrerySims.register("eclipses", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 640 ? 1.25 : 0.5), max: 720, label: "The Moon's shadow cones reaching towards Earth, beside the Sun and Moon as seen from the ground" });
  const p = kit.panel();
  const RS = 696000, RM = 1737.4, RE = 6371;
  const s = { dm: 363000, ds: 151.5e6, off: 0, drift: true, clock: 0 };

  kit.select(p, {
    label: "Try an eclipse",
    options: [["", "Choose…"], ["total", "Moon near its closest: total"], ["annular", "Moon near its farthest: annular"], ["hybrid", "Right on the edge"]],
    value: "",
    onChange: (k) => {
      if (k === "total") { dmS.set(357000); dsS.set(151.8e6); }
      if (k === "annular") { dmS.set(405000); dsS.set(147.3e6); }
      if (k === "hybrid") { dmS.set(379000); dsS.set(149.6e6); }
    },
  });
  const dmS = kit.slider(p, { label: "Moon's distance from Earth", min: 356500, max: 406700, step: 100, value: s.dm, format: (v) => Math.round(v).toLocaleString("en-US") + " km", onInput: (v) => (s.dm = v) });
  const dsS = kit.slider(p, { label: "Earth's distance from the Sun", min: 147.1e6, max: 152.1e6, step: 0.05e6, value: s.ds, format: (v) => (v / 1e6).toFixed(1) + " million km", onInput: (v) => (s.ds = v) });
  const offS = kit.slider(p, { label: "Your distance from the centre of the path", min: 0, max: 3000, step: 10, value: s.off, format: (v) => Math.round(v) + " km", onInput: (v) => { s.off = v; s.drift = false; playBtn.textContent = "Let the Moon pass"; } });
  const playBtn = kit.button(p, "Pause", () => { s.drift = !s.drift; playBtn.textContent = s.drift ? "Pause" : "Let the Moon pass"; });
  const out = kit.readouts(kit.root, [["type", "What you see"], ["size", "Moon's size / Sun's size"], ["path", "Width of the central path"], ["cover", "Sun covered"]]);

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    const D = s.dm - RE;                               // Moon to observer at the sub-lunar point
    const angS = RS / s.ds, angM = RM / D;             // angular radii, radians
    const umbraLen = (s.ds - s.dm) * RM / (RS - RM);   // Moon to umbra tip
    const shadowR = RM - (RS - RM) * D / (s.ds - s.dm); // umbra radius at the ground (negative: antumbra)

    // Moon slides across the Sun: offset in the sky, in Sun radii
    let sky;
    if (s.drift) {
      s.clock += dt * 0.12;
      sky = ((s.clock % 3) - 1.5) * 2.4 * angS;
    } else sky = s.off / D;              // standing off the centre line shifts the Moon by parallax

    const wide = w >= 640;
    const side = wide ? { x: 0, y: 0, w: w * 0.58, h } : { x: 0, y: 0, w, h: h * 0.5 };
    const view = wide ? { x: w * 0.58, y: 0, w: w * 0.42, h } : { x: 0, y: h * 0.5, w, h: h * 0.5 };
    ctx.fillStyle = t.sky;
    ctx.fillRect(0, 0, w, h);

    // ---- side view: not to scale, but the umbra tip lands in the right place
    ctx.save();
    ctx.beginPath(); ctx.rect(side.x, side.y, side.w, side.h); ctx.clip();
    const my = side.y + side.h / 2;
    const moonX = side.x + side.w * 0.3, earthX = side.x + side.w * 0.82;
    const pxPerKm = (earthX - moonX) / (s.dm - RE);      // Earth's surface sits at earthX
    const mr = Math.min(16, side.h * 0.07);
    const tipX = moonX + umbraLen * pxPerKm;
    // penumbra
    ctx.fillStyle = "rgba(143,179,238,0.10)";
    const spread = mr + (earthX - moonX + 60) * 0.16;
    ctx.beginPath();
    ctx.moveTo(moonX, my - mr); ctx.lineTo(side.x + side.w, my - spread - mr);
    ctx.lineTo(side.x + side.w, my + spread + mr); ctx.lineTo(moonX, my + mr); ctx.closePath();
    ctx.fill();
    // umbra, and the antumbra past its tip
    ctx.fillStyle = "rgba(4,5,8,0.95)";
    ctx.beginPath(); ctx.moveTo(moonX, my - mr); ctx.lineTo(tipX, my); ctx.lineTo(moonX, my + mr); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(143,179,238,0.55)";
    ctx.beginPath(); ctx.moveTo(moonX, my - mr); ctx.lineTo(tipX, my); ctx.lineTo(moonX, my + mr); ctx.stroke();
    if (tipX < side.x + side.w) {
      const far = side.x + side.w, grow = ((far - tipX) / (tipX - moonX)) * mr;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(tipX, my); ctx.lineTo(far, my - grow); ctx.moveTo(tipX, my); ctx.lineTo(far, my + grow); ctx.stroke();
      ctx.setLineDash([]);
    }
    // rays from the Sun, off to the left
    ctx.strokeStyle = "rgba(255,231,168,0.35)";
    ctx.beginPath(); ctx.moveTo(side.x, my - mr * 3.2); ctx.lineTo(moonX, my - mr); ctx.moveTo(side.x, my + mr * 3.2); ctx.lineTo(moonX, my + mr); ctx.stroke();
    // Moon and Earth's curved surface
    ctx.fillStyle = "#9a978e";
    ctx.beginPath(); ctx.arc(moonX, my, mr, 0, Math.PI * 2); ctx.fill();
    const er = side.h * 1.4;
    ctx.fillStyle = "#2c4f7c";
    ctx.beginPath(); ctx.arc(earthX + er, my, er, 0, Math.PI * 2); ctx.fill();
    ctx.font = t.small;
    ctx.fillStyle = t.sun; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("← sunlight", side.x + 10, side.y + 8);
    ctx.fillStyle = t.skyMuted;
    ctx.textAlign = "center";
    ctx.fillText("Moon", moonX, my + mr + 6);
    ctx.fillText("Earth", earthX + 26, my + side.h * 0.3);
    ctx.textBaseline = "bottom";
    ctx.fillText(tipX >= earthX ? "shadow tip reaches the ground" : "shadow tip falls short", side.x + side.w / 2, side.y + side.h - 8);
    ctx.restore();

    // ---- the view from the ground
    ctx.save();
    ctx.beginPath(); ctx.rect(view.x, view.y, view.w, view.h); ctx.clip();
    ctx.fillStyle = "#0b0f18";
    ctx.fillRect(view.x, view.y, view.w, view.h);
    const vr = Math.min(view.w, view.h) * 0.3;
    const k = vr / angS;
    const vx = view.x + view.w / 2, vy = view.y + view.h / 2;
    const overlapFrac = kit.overlap(Math.abs(sky), angS, angM) / (Math.PI * angS * angS);
    const total = Math.abs(sky) + angS <= angM;
    if (total) {
      const cg = ctx.createRadialGradient(vx, vy, vr, vx, vy, vr * 3);
      cg.addColorStop(0, "rgba(235,240,255,0.75)"); cg.addColorStop(1, "rgba(235,240,255,0)");
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(vx, vy, vr * 3, 0, Math.PI * 2); ctx.fill();
    }
    const sg = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr);
    sg.addColorStop(0, "#fff8e2"); sg.addColorStop(0.8, "#ffd98a"); sg.addColorStop(1, "#f2b45c");
    ctx.fillStyle = total ? "rgba(0,0,0,0)" : sg;
    ctx.beginPath(); ctx.arc(vx, vy, vr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#06080c";
    ctx.beginPath(); ctx.arc(vx + sky * k, vy, angM * k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.skyMuted;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText("the Sun from the ground", vx, view.y + 8);
    ctx.restore();
    ctx.strokeStyle = t.skyRule;
    ctx.beginPath(); ctx.moveTo(view.x + 0.5, view.y); ctx.lineTo(view.x + 0.5, view.y + view.h); ctx.stroke();

    const ratio = angM / angS;
    const annular = ratio < 1 && Math.abs(sky) + angM <= angS;
    out.set("type", total ? "total eclipse, corona visible" : annular ? "annular eclipse, a ring of fire" : overlapFrac > 0 ? "partial eclipse" : "no eclipse");
    out.set("size", ratio.toFixed(3));
    out.set("path", shadowR > 0 ? "total, about " + Math.round(2 * shadowR) + " km wide" : "annular, about " + Math.round(-2 * shadowR) + " km wide");
    out.set("cover", Math.round(Math.min(1, overlapFrac) * 100) + "%");
    void dsS; void offS;
  });
});
