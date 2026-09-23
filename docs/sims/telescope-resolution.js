/* Telescope resolution: light through a round aperture spreads into an Airy
   pattern, a bright disc and faint rings. Two stars closer together than
   about 1.22 wavelength / aperture blur into one: the Rayleigh limit. */
OrrerySims.register("telescope-resolution", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 640 ? 1.2 : 0.5), max: 720, label: "Two stars imaged through a telescope as Airy patterns, beside a brightness profile across them" });
  const p = kit.panel();
  const RAD2AS = 206264.8;
  const s = { D: 0.2, lam: 550, sep: 0.8, key: "" };
  const presets = {
    eye: ["The human eye (5 mm pupil)", 0.005, 550],
    backyard: ["A 20 cm backyard telescope", 0.2, 550],
    hubble: ["Hubble (2.4 m)", 2.4, 550],
    jwst: ["JWST (6.5 m) in infrared", 6.5, 2000],
    elt: ["Extremely Large Telescope (39 m)", 39, 1650],
  };
  kit.select(p, {
    label: "Telescope",
    options: Object.entries(presets).map(([k, v]) => [k, v[0]]),
    value: "backyard",
    onChange: (k) => { dS.set(presets[k][1]); lS.set(presets[k][2]); },
  });
  const dS = kit.slider(p, { label: "Aperture", min: 0.005, max: 40, log: true, value: s.D, format: (v) => (v < 1 ? (v * 100).toFixed(v < 0.1 ? 1 : 0) + " cm" : v.toFixed(1) + " m"), onInput: (v) => (s.D = v) });
  const lS = kit.slider(p, { label: "Wavelength", min: 350, max: 2500, step: 10, value: s.lam, format: (v) => v + " nm" + (v < 400 ? " (ultraviolet)" : v > 750 ? " (infrared)" : ""), onInput: (v) => (s.lam = v) });
  kit.slider(p, { label: "Separation of the two stars", min: 0.001, max: 120, log: true, value: s.sep, format: (v) => fmtAng(v), onInput: (v) => (s.sep = v) });
  const out = kit.readouts(kit.root, [["lim", "Resolution limit"], ["res", "The pair is"], ["air", "From the ground"]]);

  function fmtAng(as) {
    if (as >= 60) return (as / 60).toFixed(1) + " arcmin";
    if (as >= 1) return as.toFixed(2) + " arcsec";
    return (as * 1000).toFixed(as < 0.01 ? 2 : 0) + " milliarcsec";
  }
  // Bessel J1 (Abramowitz & Stegun 9.4.4 and 9.4.6)
  function J1(x) {
    const ax = Math.abs(x);
    if (ax < 3) {
      const y = (x / 3) ** 2;
      return x * (0.5 - y * (0.56249985 - y * (0.21093573 - y * (0.03954289 - y * (0.00443319 - y * 0.00031761)))));
    }
    const y = 3 / ax;
    const f1 = 0.79788456 + y * (0.00000156 + y * (0.01659667 + y * (0.00017105 + y * (-0.00249511 + y * (0.00113653 - y * 0.00020033)))));
    const t1 = ax - 2.35619449 + y * (0.12499612 + y * (0.0000565 + y * (-0.00637879 + y * (0.00074348 + y * (0.00079824 - y * 0.00029166)))));
    const v = (f1 * Math.cos(t1)) / Math.sqrt(ax);
    return x < 0 ? -v : v;
  }
  const airy = (theta, lim) => {
    const x = (3.8317 * theta) / lim;                    // first dark ring at the Rayleigh limit
    if (Math.abs(x) < 1e-6) return 1;
    const a = (2 * J1(x)) / x;
    return a * a;
  };

  const RES = 200;
  const buf = document.createElement("canvas");
  buf.width = RES; buf.height = RES;
  const bctx = buf.getContext("2d");
  const img = bctx.createImageData(RES, RES);

  kit.loop(() => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    const lim = (1.22 * s.lam * 1e-9 / s.D) * RAD2AS;      // arcsec
    const field = Math.max(s.sep * 1.6, lim * 4.5);          // half-width of the view, arcsec
    const key = [s.D, s.lam, s.sep].join();
    if (key !== s.key) {
      s.key = key;
      const d = img.data;
      for (let j = 0; j < RES; j++) {
        const y = field * (1 - (2 * (j + 0.5)) / RES);
        for (let i = 0; i < RES; i++) {
          const x = field * ((2 * (i + 0.5)) / RES - 1);
          const I = airy(Math.hypot(x + s.sep / 2, y), lim) + airy(Math.hypot(x - s.sep / 2, y), lim);
          const v = Math.min(1, Math.sqrt(I / 1.05));        // square root shows the faint rings
          const k = (j * RES + i) * 4;
          d[k] = 8 + v * 247; d[k + 1] = 10 + v * 236; d[k + 2] = 16 + v * 214; d[k + 3] = 255;
        }
      }
      bctx.putImageData(img, 0, 0);
    }

    const wide = w >= 640;
    const side = wide ? Math.min(h, w * 0.5) : Math.min(w, h * 0.55);
    const box = wide ? { x: 0, y: (h - side) / 2, w: side, h: side } : { x: (w - side) / 2, y: 0, w: side, h: side };
    const plot = wide ? { x: side + 60, y: 24, w: w - side - 78, h: h - 72 } : { x: 56, y: side + 24, w: w - 72, h: h - side - 70 };
    ctx.fillStyle = t.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buf, box.x, box.y, box.w, box.h);
    ctx.font = t.small; ctx.fillStyle = t.skyMuted; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("what the telescope sees", box.x + 8, box.y + 8);
    // scale bar
    const pxPerAs = box.w / (2 * field);
    const bar = lim;
    ctx.strokeStyle = t.skyInk;
    ctx.beginPath(); ctx.moveTo(box.x + 12, box.y + box.h - 14); ctx.lineTo(box.x + 12 + bar * pxPerAs, box.y + box.h - 14); ctx.stroke();
    ctx.fillStyle = t.skyInk; ctx.textBaseline = "bottom";
    ctx.fillText("limit: " + fmtAng(lim), box.x + 12, box.y + box.h - 18);

    // brightness along the line through both stars
    const P = kit.axes(ctx, plot, {
      xmin: -field, xmax: field, ymin: 0, ymax: 1.25,
      xticks: [-field, -field / 2, 0, field / 2, field], yticks: [0, 0.5, 1],
      xfmt: (v) => (Math.abs(v) < 1e-12 ? "0" : (v < 0 ? "−" : "") + fmtAng(Math.abs(v)).replace(" arcsec", "″").replace(" milliarcsec", " mas").replace(" arcmin", "′")),
      yfmt: (v) => v.toFixed(1), xlabel: "position across the pair", ylabel: "brightness",
    });
    const prof = (x) => airy(Math.abs(x + s.sep / 2), lim) + airy(Math.abs(x - s.sep / 2), lim);
    ctx.strokeStyle = t.muted; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    for (const off of [-s.sep / 2, s.sep / 2]) {
      ctx.beginPath();
      for (let k = 0; k <= 300; k++) { const x = -field + (2 * field * k) / 300; const y = P.Y(Math.min(1.25, airy(Math.abs(x - off), lim))); k ? ctx.lineTo(P.X(x), y) : ctx.moveTo(P.X(x), y); }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = t.accent; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k <= 400; k++) { const x = -field + (2 * field * k) / 400; const y = P.Y(Math.min(1.25, prof(x))); k ? ctx.lineTo(P.X(x), y) : ctx.moveTo(P.X(x), y); }
    ctx.stroke();

    const ratio = s.sep / lim;
    const dip = prof(0) / Math.max(prof(s.sep / 2), 1e-9);
    out.set("lim", fmtAng(lim));
    out.set("res", ratio >= 1 ? "resolved: two stars, with a dip to " + Math.round(dip * 100) + "% between them" : ratio > 0.8 ? "only just separable" : "blurred into one");
    out.set("air", lim < 0.5 ? "the atmosphere blurs to ~0.5–1″ unless adaptive optics corrects it" : "the atmosphere is not the limit at this size");
  });
});
