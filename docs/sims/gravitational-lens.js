/* Gravitational lensing by a point mass, ray-traced. Every pixel of the image
   is traced back through the lens equation, beta = theta - theta/|theta|^2,
   to the spot on the background galaxy it shows. Drag the background galaxy;
   line it up behind the lens and it becomes an Einstein ring. */
OrrerySims.register("gravitational-lens", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 640 ? 1.45 : 0.5), max: 820, label: "A lensed background galaxy seen around a foreground mass, beside a microlensing light curve" });
  const p = kit.panel();
  const FIELD = 2.4;                  // half-width of the view, in Einstein radii
  const RES = 240;
  const s = { sx: 0.55, sy: 0.3, size: 0.22, play: false, showSource: true, dirty: true };

  const buf = document.createElement("canvas");
  buf.width = RES; buf.height = RES;
  const bctx = buf.getContext("2d");
  const img = bctx.createImageData(RES, RES);

  const sizeS = kit.slider(p, { label: "Size of the background galaxy", min: 0.05, max: 0.7, step: 0.01, value: s.size, format: (v) => v.toFixed(2) + " Einstein radii", onInput: (v) => { s.size = v; s.dirty = true; } });
  const u0S = kit.slider(p, { label: "How close it passes behind the lens", min: 0, max: 1.5, step: 0.01, value: Math.abs(s.sy), format: (v) => v.toFixed(2) + " Einstein radii", onInput: (v) => { s.sy = v; s.dirty = true; } });
  const playBtn = kit.button(p, "Play a passage", () => {
    s.play = !s.play;
    if (s.play && s.sx > 1.9) s.sx = -2.2;
    playBtn.textContent = s.play ? "Pause" : "Play a passage";
  });
  kit.toggle(p, { label: "Show the galaxy's true position", value: true, onChange: (v) => (s.showSource = v) });
  const out = kit.readouts(kit.root, [["u", "Offset from the lens"], ["mu", "Brightening"], ["sep", "Image separation"]]);
  void sizeS;

  const layout = () => {
    const { w, h } = c;
    if (w < 640) {
      const side = Math.min(w, h * 0.62);
      return { lens: { x: (w - side) / 2, y: 0, w: side, h: side }, plot: { x: 58, y: side + 26, w: w - 76, h: h - side - 72 } };
    }
    const side = Math.min(h, w * 0.5);
    return { lens: { x: 0, y: (h - side) / 2, w: side, h: side }, plot: { x: side + 70, y: 24, w: w - side - 88, h: h - 72 } };
  };

  function brightness(bx, by) {
    const dx = bx - s.sx, dy = by - s.sy;
    const r2 = (dx * dx + dy * dy) / (s.size * s.size);
    if (r2 > 30) return [0, 0];
    const r = Math.sqrt(r2);
    const core = Math.exp(-r2 * 1.6);
    const arms = Math.exp(-r2 / 5) * (0.5 + 0.5 * Math.cos(2 * Math.atan2(dy, dx) - 2.4 * r));
    return [core, arms * 0.75];
  }

  function trace() {
    const d = img.data;
    for (let j = 0; j < RES; j++) {
      const ty = FIELD - (2 * FIELD * (j + 0.5)) / RES;
      for (let i = 0; i < RES; i++) {
        const tx = -FIELD + (2 * FIELD * (i + 0.5)) / RES;
        const r2 = tx * tx + ty * ty;
        let core = 0, arms = 0;
        if (r2 > 1e-4) {
          [core, arms] = brightness(tx - tx / r2, ty - ty / r2);
        }
        const k = (j * RES + i) * 4;
        d[k] = Math.min(255, 7 + core * 255 + arms * 120);
        d[k + 1] = Math.min(255, 10 + core * 230 + arms * 150);
        d[k + 2] = Math.min(255, 16 + core * 190 + arms * 255);
        d[k + 3] = 255;
      }
    }
    bctx.putImageData(img, 0, 0);
  }

  const mag = (u) => (u < 1e-3 ? 1000 : (u * u + 2) / (u * Math.sqrt(u * u + 4)));

  kit.pointer(c, {
    down: (pt) => drag(pt, true),
    move: (pt, dragging) => { if (dragging) drag(pt, false); },
  });
  function drag(pt, first) {
    const { lens } = layout();
    if (pt.x < lens.x || pt.x > lens.x + lens.w || pt.y < lens.y || pt.y > lens.y + lens.h) return;
    if (first && s.play) { s.play = false; playBtn.textContent = "Play a passage"; }
    s.sx = -FIELD + ((pt.x - lens.x) / lens.w) * 2 * FIELD;
    s.sy = FIELD - ((pt.y - lens.y) / lens.h) * 2 * FIELD;
    u0S.set(Math.min(1.5, Math.abs(s.sy)), false);
    s.dirty = true;
  }

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    if (s.play) {
      s.sx += dt * 0.55;
      s.dirty = true;
      if (s.sx > 2.2) { s.play = false; playBtn.textContent = "Play a passage"; }
    }
    if (s.dirty) { trace(); s.dirty = false; }

    const L = layout();
    ctx.fillStyle = t.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buf, L.lens.x, L.lens.y, L.lens.w, L.lens.h);

    const S = L.lens.w / (2 * FIELD);
    const cx = L.lens.x + L.lens.w / 2, cy = L.lens.y + L.lens.h / 2;
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = "rgba(211,218,230,0.35)";
    ctx.beginPath();
    ctx.arc(cx, cy, S, 0, Math.PI * 2);
    ctx.stroke();
    if (s.showSource) {
      ctx.strokeStyle = "rgba(228,96,122,0.85)";
      ctx.beginPath();
      ctx.arc(cx + s.sx * S, cy - s.sy * S, Math.max(4, s.size * S * 1.3), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = t.sun;
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = t.small;
    ctx.fillStyle = t.skyMuted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("drag to move the background galaxy", L.lens.x + 8, L.lens.y + 8);
    ctx.textBaseline = "bottom";
    ctx.fillText("dashed: Einstein ring", L.lens.x + 8, L.lens.y + L.lens.h - 8);

    // microlensing light curve for a straight pass at the current offset
    const u0 = Math.abs(s.sy);
    const ymax = Math.min(12, Math.max(3, Math.ceil(mag(Math.max(u0, 0.08)) + 0.5)));
    const { X, Y } = kit.axes(ctx, L.plot, {
      xmin: -2.2, xmax: 2.2, ymin: 1, ymax,
      xticks: [-2, -1, 0, 1, 2], yticks: Array.from({ length: Math.floor(ymax) }, (_, i) => i + 1),
      xfmt: (v) => String(v), yfmt: (v) => v + "×",
      xlabel: "position along the passage (Einstein radii)", ylabel: "brightening",
    });
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k <= 300; k++) {
      const x = -2.2 + (4.4 * k) / 300;
      const y = Math.min(ymax, mag(Math.hypot(x, u0)));
      k ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y));
    }
    ctx.stroke();
    const u = Math.hypot(s.sx, s.sy);
    if (s.sx >= -2.2 && s.sx <= 2.2) {
      ctx.fillStyle = t.mark;
      ctx.beginPath();
      ctx.arc(X(s.sx), Y(Math.min(ymax, mag(u))), 5, 0, Math.PI * 2);
      ctx.fill();
    }

    out.set("u", u.toFixed(2) + " Einstein radii");
    out.set("mu", mag(u) > 99 ? "more than 100×" : mag(u).toFixed(2) + "×");
    out.set("sep", Math.sqrt(u * u + 4).toFixed(2) + " Einstein radii");
  });
});
