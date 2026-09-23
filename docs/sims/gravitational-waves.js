/* Gravitational waves: two black holes or neutron stars in orbit radiate
   ripples in spacetime, lose energy, and spiral together faster and faster.
   The waves rise in both pitch and strength, a "chirp", ending at the merger.
   For stellar-mass pairs the chirp falls in the range of human hearing, so
   this one can be played as sound. */
OrrerySims.register("gravitational-waves", (kit) => {
  const c = kit.canvas({ ratio: (w) => (w < 560 ? 1.25 : 0.62), max: 760, label: "Two compact objects spiralling together and radiating spiral gravitational waves, above the chirp waveform" });
  const p = kit.panel();
  const TSUN = 4.925e-6;                         // G M_sun / c^3, seconds
  const s = { m1: 36, m2: 29, clock: 0, W: null, key: "", audio: null };
  const presets = {
    gw150914: ["GW150914, the first detection", 36, 29],
    gw170817: ["GW170817, two neutron stars", 1.46, 1.27],
    gw190521: ["GW190521, the heaviest pair", 85, 66],
    ten: ["Two 10-Sun black holes", 10, 10],
  };
  kit.select(p, { label: "Try an event", options: Object.entries(presets).map(([k, v]) => [k, v[0]]), value: "gw150914", onChange: (k) => { m1S.set(presets[k][1]); m2S.set(presets[k][2]); } });
  const m1S = kit.slider(p, { label: "First mass", min: 1, max: 100, log: true, value: s.m1, format: (v) => v.toFixed(v < 3 ? 2 : 0) + " Suns", onInput: (v) => (s.m1 = v) });
  const m2S = kit.slider(p, { label: "Second mass", min: 1, max: 100, log: true, value: s.m2, format: (v) => v.toFixed(v < 3 ? 2 : 0) + " Suns", onInput: (v) => (s.m2 = v) });
  const hearBtn = kit.button(p, "Hear the chirp", () => play());
  const out = kit.readouts(kit.root, [["mc", "Chirp mass"], ["band", "Audible in detectors for"], ["cyc", "Wave cycles shown"], ["fend", "Pitch at the end"]]);

  function build() {
    const M = s.m1 + s.m2;
    const Mc = Math.pow(s.m1 * s.m2, 0.6) / Math.pow(M, 0.2);
    const T = Mc * TSUN;
    const fIsco = 4397 / M, fRing = 17700 / M;
    const tauOf = (f) => (5 / 256) * Math.pow(Math.PI * f, -8 / 3) * Math.pow(T, -5 / 3);
    const fOf = (tau) => (1 / Math.PI) * Math.pow(5 / (256 * tau), 3 / 8) * Math.pow(T, -5 / 8);
    const phiOf = (tau) => -2 * Math.pow(tau / (5 * T), 5 / 8);
    const tauIsco = tauOf(fIsco);
    const fLow = Math.max(20, fIsco / 5);
    const tauLow = tauOf(fLow);
    const span = tauLow - tauIsco;               // inspiral shown, seconds
    const qn = 3.2 / (Math.PI * fRing);          // ringdown decay time
    const phiEnd = phiOf(tauIsco);
    // strain at time t (t = 0 at the end of the inspiral), unit peak amplitude
    const h = (t) => {
      if (t <= 0) {
        const tau = tauIsco - t;
        const f = fOf(tau), a = Math.pow(f / fIsco, 2 / 3), ph = phiOf(tau) - phiEnd;
        return { v: a * Math.cos(ph), f, a, ph };
      }
      // merger and ringdown: the pitch jumps to the final hole's ringing tone and fades
      const a = Math.exp(-t / qn) * (1 + 0.3 * Math.exp(-((t - qn * 0.3) ** 2) / (2 * (qn * 0.3) ** 2)));
      const ph = 2 * Math.PI * (fIsco * t + (fRing - fIsco) * qn * (1 - Math.exp(-t / qn)));
      return { v: a * Math.cos(ph), f: fRing, a, ph };
    };
    const cycles = (phiOf(tauIsco) - phiOf(tauLow)) / (2 * Math.PI);
    s.W = { M, Mc, fIsco, fRing, fLow, span, qn, h, cycles: Math.abs(cycles), tau20: tauOf(20) - tauIsco, fOf, tauIsco };
  }

  function play() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { hearBtn.textContent = "No sound in this browser"; return; }
    if (!s.audio) { s.audio = new AC(); kit.onDispose(() => s.audio && s.audio.close()); }
    const W = s.W, rate = s.audio.sampleRate;
    const start = -Math.min(W.tau20, 6), end = 6 * W.qn;
    const n = Math.floor((end - start) * rate);
    const buf = s.audio.createBuffer(1, n, rate);
    const d = buf.getChannelData(0);
    let peak = 1e-9;
    for (let i = 0; i < n; i++) { d[i] = W.h(start + i / rate).v; peak = Math.max(peak, Math.abs(d[i])); }
    const fade = Math.min(n, Math.floor(rate * 0.02));
    for (let i = 0; i < n; i++) d[i] = (0.8 * d[i]) / peak * Math.min(1, i / fade);
    const src = s.audio.createBufferSource();
    src.buffer = buf;
    src.connect(s.audio.destination);
    src.start();
  }

  kit.loop((dt) => {
    const { ctx, w, h } = c;
    const t = kit.theme();
    const key = [s.m1, s.m2].join();
    if (key !== s.key) { s.key = key; build(); s.clock = 0; }
    const W = s.W;
    // the whole window plays in about 7 seconds, then holds briefly and repeats
    const total = W.span + 6 * W.qn;
    s.clock += dt / 7;
    if (s.clock > 1.25) s.clock = 0;
    const tNow = -W.span + Math.min(1, s.clock) * total;
    const now = W.h(tNow);

    const topH = Math.round(h * 0.6);
    ctx.fillStyle = t.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = t.sky;
    ctx.fillRect(0, 0, w, topH);

    // spiral wave pattern, drawn coarse and scaled up
    const cx = w / 2, cy = topH / 2;
    const G = 4, gw = Math.ceil(w / G), gh = Math.ceil(topH / G);
    if (!s.buf || s.buf.width !== gw || s.buf.height !== gh) { s.buf = document.createElement("canvas"); s.buf.width = gw; s.buf.height = gh; s.img = s.buf.getContext("2d").createImageData(gw, gh); }
    const d = s.img.data;
    const R0 = Math.min(w, topH) * 0.5;
    const lag = total / 2.5;                     // seconds of delay per screen half-size
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const x = i * G - cx, y = j * G - cy, r = Math.hypot(x, y) / R0;
        const tr = tNow - r * lag;
        let v = 0;
        if (tr > -W.span - total) {
          const q = W.h(Math.max(-W.span * 3, tr));
          v = (q.a * Math.cos(2 * Math.atan2(y, x) - q.ph)) / (0.6 + 2 * r);
        }
        const k = (j * gw + i) * 4;
        d[k] = 7 + Math.max(0, v) * 290; d[k + 1] = 10 + Math.abs(v) * 90; d[k + 2] = 16 + Math.max(0, -v) * 320; d[k + 3] = 255;
      }
    }
    s.buf.getContext("2d").putImageData(s.img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(s.buf, 0, 0, gw * G, gh * G);

    // the two bodies: separation shrinks as frequency rises (Kepler's third law)
    if (tNow <= 0) {
      const sep = Math.pow(now.f / W.fLow, -2 / 3) * R0 * 0.34;
      const angle = now.ph / 2;                  // orbital phase is half the wave phase
      const q1 = s.m2 / W.M, q2 = s.m1 / W.M;
      const r1 = 4 + 5 * Math.cbrt(s.m1 / 30), r2 = 4 + 5 * Math.cbrt(s.m2 / 30);
      ctx.fillStyle = "#05070a";
      ctx.strokeStyle = t.sun;
      for (const [q, r, sgn] of [[q1, r1, 1], [q2, r2, -1]]) {
        ctx.beginPath(); ctx.arc(cx + sgn * sep * q * Math.cos(angle), cy + sgn * sep * q * Math.sin(angle), r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    } else {
      ctx.fillStyle = "#05070a"; ctx.strokeStyle = t.sun;
      ctx.beginPath(); ctx.arc(cx, cy, 7 + 6 * Math.cbrt(W.M / 60), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.font = t.small; ctx.fillStyle = t.skyMuted; ctx.textAlign = "left"; ctx.textBaseline = "top";
    const spanTxt = W.span < 1 ? Math.round(W.span * 1000) + " ms" : W.span.toFixed(1) + " s";
    ctx.fillText(w < 560 ? "last " + spanTxt + " before merger, slowed" : "wave pattern exaggerated; the last " + spanTxt + " before the merger, slowed", 10, 8);

    // the waveform
    const rect = { x: 16, y: topH + 22, w: w - 32, h: h - topH - 46 };
    ctx.strokeStyle = t.rule; ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w, rect.h);
    const X = (tt) => rect.x + ((tt + W.span) / total) * rect.w;
    const Y = (v) => rect.y + rect.h / 2 - v * (rect.h / 2 - 6);
    ctx.strokeStyle = t.muted; ctx.lineWidth = 1;
    ctx.beginPath();
    const N = Math.min(4000, Math.max(800, Math.round(W.cycles * 30)));
    for (let k = 0; k <= N; k++) { const tt = -W.span + (total * k) / N; const y = Y(W.h(tt).v); k ? ctx.lineTo(X(tt), y) : ctx.moveTo(X(tt), y); }
    ctx.stroke();
    ctx.strokeStyle = t.accent; ctx.lineWidth = 1.6;
    ctx.beginPath();
    const Nn = Math.round((N * (tNow + W.span)) / total);
    for (let k = 0; k <= Nn; k++) { const tt = -W.span + (total * k) / N; const y = Y(W.h(tt).v); k ? ctx.lineTo(X(tt), y) : ctx.moveTo(X(tt), y); }
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = t.muted; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText("strain at Earth", rect.x, rect.y - 3);
    ctx.textAlign = "right";
    ctx.fillText("merger", X(0), rect.y - 3);

    const fmtT = (sec) => (sec >= 60 ? (sec / 60).toFixed(1) + " minutes" : sec >= 1 ? sec.toFixed(1) + " s" : Math.round(sec * 1000) + " ms");
    out.set("mc", W.Mc.toFixed(W.Mc < 3 ? 2 : 1) + " Suns");
    out.set("band", fmtT(W.tau20) + " above 20 Hz");
    out.set("cyc", Math.round(W.cycles).toLocaleString("en-US"));
    out.set("fend", Math.round(W.fRing) + " Hz");
  });
});
