/* Light near a black hole: rays passing a Schwarzschild black hole bend, a
   narrow band of them loops round the photon sphere at 1.5 Schwarzschild
   radii, and any ray aimed closer than about 2.6 radii falls in. The
   diagram is in units of the Schwarzschild radius, so it looks the same for
   every mass; the readouts show what the sizes are for real objects. */
OrrerySims.register("black-hole", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 560 ? 1 : 0.6), max: 720, label: "Paths of light rays bending around a black hole, some captured and some escaping" });
  const p = kit.panel();
  const BCRIT = (3 * Math.sqrt(3)) / 2;          // capture impact parameter, in rs
  const s = { M: 4.3e6, b: 3.0, clock: 0, rays: null, key: "" };
  const presets = {
    earth: ["Earth, crushed", 3.0e-6], sun: ["The Sun, crushed", 1], cyg: ["Cygnus X-1", 21.2],
    sgr: ["Sagittarius A*, our galaxy's centre", 4.3e6], m87: ["M87*, the first one imaged", 6.5e9],
  };
  kit.select(p, {
    label: "Mass",
    options: Object.entries(presets).map(([k, v]) => [k, v[0]]),
    value: "sgr",
    onChange: (k) => (s.M = presets[k][1]),
  });
  kit.slider(p, { label: "Follow one ray, aimed this far off-centre", min: 0.5, max: 8, step: 0.005, value: s.b, format: (v) => v.toFixed(3) + " rs", onInput: (v) => { s.b = v; s.key = ""; } });
  const out = kit.readouts(kit.root, [["rs", "Event horizon radius"], ["shadow", "Dark shadow radius"], ["ray", "The followed ray"], ["dens", "Average density inside"]]);

  // photon paths: r'' = -1.5 h^2 r / |r|^5 reproduces Schwarzschild null geodesics (rs = 1)
  function trace(b) {
    let x = -14, y = b, vx = 1, vy = 0;
    const hh = b * b;
    const pts = [[x, y]];
    let minR = 99, fate = "escapes";
    let bend = 0, vang = 0;                      // total turn of the ray's direction
    for (let i = 0; i < 20000; i++) {
      const r = Math.hypot(x, y);
      minR = Math.min(minR, r);
      if (r < 1) { fate = "falls in"; break; }
      if (r > 16 && x * vx + y * vy > 0) break;
      const ds = Math.min(0.08, Math.max(0.002, 0.02 * (r - 0.9)));
      const acc = (px, py) => { const rr = Math.hypot(px, py), f = (-1.5 * hh) / rr ** 5; return [f * px, f * py]; };
      // RK4
      const k1 = [vx, vy, ...acc(x, y)];
      const k2 = [vx + (ds / 2) * k1[2], vy + (ds / 2) * k1[3], ...acc(x + (ds / 2) * k1[0], y + (ds / 2) * k1[1])];
      const k3 = [vx + (ds / 2) * k2[2], vy + (ds / 2) * k2[3], ...acc(x + (ds / 2) * k2[0], y + (ds / 2) * k2[1])];
      const k4 = [vx + ds * k3[2], vy + ds * k3[3], ...acc(x + ds * k3[0], y + ds * k3[1])];
      x += (ds / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      y += (ds / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      vx += (ds / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
      vy += (ds / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
      const na = Math.atan2(vy, vx);
      let d = na - vang;
      if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
      bend += d; vang = na;
      if (i % 3 === 0) pts.push([x, y]);
    }
    pts.push([x, y]);
    // count turns around the hole
    let turn = 0;
    for (let i = 1; i < pts.length; i++) {
      let d = Math.atan2(pts[i][1], pts[i][0]) - Math.atan2(pts[i - 1][1], pts[i - 1][0]);
      if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
      turn += d;
    }
    return { pts, fate, minR, bend, turn };
  }

  function build() {
    const list = [];
    for (let k = -18; k <= 18; k++) if (k) list.push(trace(k * 0.4));
    s.rays = list;
  }
  build();

  const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  const fmtSci = (v) => {
    if (v >= 0.01 && v < 1e5) return Number(v.toPrecision(3)).toLocaleString("en-US");
    const e = Math.floor(Math.log10(v));
    return (v / 10 ** e).toFixed(1) + " × 10" + String(e).split("").map((ch) => SUP[ch]).join("");
  };
  const fmtLen = (km) => km < 1e-3 ? (km * 1e6).toFixed(1) + " mm" : km < 1 ? (km * 1000).toFixed(1) + " m" : km < 1e6 ? Math.round(km).toLocaleString("en-US") + " km" : km < 1.5e8 * 3 ? (km / 1e6).toFixed(1) + " million km" : (km / 1.496e8).toFixed(0) + " AU";

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    s.clock = (s.clock + dt * 0.25) % 1.4;
    if (s.key !== String(s.b)) { s.key = String(s.b); s.one = trace(s.b); }

    ctx.fillStyle = t.sky;
    ctx.fillRect(0, 0, w, h);
    const S = Math.min(w / 30, h / 19);
    const cx = w * 0.55, cy = h / 2;
    const X = (x) => cx + x * S, Y = (y) => cy - y * S;

    // all the rays, faint, with a pulse of light travelling along each
    for (const ray of s.rays) {
      ctx.strokeStyle = ray.fate === "falls in" ? "rgba(228,96,122,0.35)" : "rgba(143,179,238,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ray.pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      ctx.stroke();
      const idx = Math.floor(Math.min(1, s.clock) * (ray.pts.length - 1));
      const [qx, qy] = ray.pts[idx];
      if (s.clock <= 1) {
        ctx.fillStyle = ray.fate === "falls in" ? "#e4607a" : "#ffe7a8";
        ctx.beginPath(); ctx.arc(X(qx), Y(qy), 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    // the followed ray
    ctx.strokeStyle = t.sun;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    s.one.pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.stroke();
    ctx.lineWidth = 1;

    // horizon, photon sphere, capture radius
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.arc(cx, cy, S, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,231,168,0.6)";
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.arc(cx, cy, 1.5 * S, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = t.skyRule;
    ctx.beginPath(); ctx.arc(cx, cy, BCRIT * S, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = t.small; ctx.fillStyle = t.skyMuted; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("light arrives from the left; yellow dashes: photon sphere", 10, 8);
    ctx.fillText("rays inside the faint circle's width fall in", 10, 24);

    const rsKm = 2.953 * s.M;
    const vol = (4 / 3) * Math.PI * (rsKm * 1e5) ** 3;          // cm^3
    const rho = (s.M * 1.989e33) / vol;
    const o = s.one;
    out.set("rs", fmtLen(rsKm));
    out.set("shadow", fmtLen(rsKm * BCRIT));
    const bendDeg = Math.abs((o.bend * 180) / Math.PI);
    out.set("ray", o.fate === "falls in" ? "falls in" : "bent by " + (bendDeg < 10 ? bendDeg.toFixed(1) : Math.round(bendDeg)) + "°" + (bendDeg > 360 ? ", looping round the hole first" : ""));
    out.set("dens", fmtSci(rho) + " g/cm³" + (rho < 1.2e-3 ? ", thinner than air" : rho < 1.5 && rho > 0.7 ? ", about water" : ""));
  });
});
