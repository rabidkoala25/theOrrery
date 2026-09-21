/* Orrery simulation toolkit.
   Each simulation script calls OrrerySims.register(id, mount). The app calls
   mount(kit) with a kit bound to the page area the simulation lives in, and
   calls kit.dispose() when the reader navigates away. Everything a simulation
   creates through the kit (canvases, controls, animation loops, listeners) is
   cleaned up by that one call. */

window.OrrerySims = (() => {
  "use strict";

  const defs = new Map();
  const SKY = "#070a10";

  function register(id, mount) {
    defs.set(id, mount);
  }

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;

  function createKit(root) {
    const disposers = [];
    let themeCache = null;
    const themeListeners = [];

    const mo = new MutationObserver(() => {
      themeCache = null;
      themeListeners.forEach((fn) => fn());
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    disposers.push(() => mo.disconnect());

    const kit = {
      root,
      clamp,
      lerp,

      onDispose(fn) {
        disposers.push(fn);
      },

      dispose() {
        disposers.splice(0).reverse().forEach((fn) => {
          try { fn(); } catch (e) { /* keep going */ }
        });
        root.innerHTML = "";
      },

      /** colours from the page's CSS variables, so plots follow light/dark */
      theme() {
        if (themeCache) return themeCache;
        const cs = getComputedStyle(document.documentElement);
        const dark = document.documentElement.dataset.theme === "dark";
        // fallbacks keep the drawings legible if the stylesheet is missing
        const FALLBACK = dark
          ? { "--paper": "#0e1116", "--paper-2": "#151a21", "--ink": "#dce1e8", "--muted": "#8a94a3", "--rule": "#262e3a", "--accent": "#8fb3ee", "--accent-soft": "#1b2634", "--mark": "#e4607a" }
          : { "--paper": "#e8eaee", "--paper-2": "#dfe2e8", "--ink": "#14171d", "--muted": "#5d6673", "--rule": "#c7cdd7", "--accent": "#2a4b8d", "--accent-soft": "#d6def0", "--mark": "#b5243c" };
        const v = (n) => cs.getPropertyValue(n).trim() || FALLBACK[n];
        themeCache = {
          paper: v("--paper"), paper2: v("--paper-2"), ink: v("--ink"),
          muted: v("--muted"), rule: v("--rule"), accent: v("--accent"),
          accentSoft: v("--accent-soft"), mark: v("--mark"),
          sky: SKY, dark: document.documentElement.dataset.theme === "dark",
          // space views are always drawn on a dark sky, whatever the page theme
          skyInk: "#d3dae6", skyMuted: "#7d8798", skyRule: "rgba(160,175,200,0.22)",
          skyAccent: "#8fb3ee", skyMark: "#e4607a", sun: "#ffe7a8",
          font: '13px Archivo, system-ui, sans-serif',
          small: '11px Archivo, system-ui, sans-serif',
        };
        return themeCache;
      },

      onTheme(fn) {
        themeListeners.push(fn);
      },

      /** a HiDPI canvas that tracks its container's width.
          ratio: height/width, a number or a function of width. */
      canvas({ ratio = 0.56, min = 220, max = 620, label = "", parent = root } = {}) {
        const stage = document.createElement("div");
        stage.className = "sim-stage";
        const el = document.createElement("canvas");
        el.setAttribute("role", "img");
        if (label) el.setAttribute("aria-label", label);
        stage.appendChild(el);
        parent.appendChild(stage);
        const ctx = el.getContext("2d");
        const c = { el, ctx, w: 0, h: 0, dpr: 1, resizeFns: [] };
        const fit = () => {
          const w = Math.max(200, Math.floor(stage.clientWidth));
          const r = typeof ratio === "function" ? ratio(w) : ratio;
          const h = Math.round(clamp(w * r, min, max));
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          if (w === c.w && h === c.h && dpr === c.dpr) return;
          c.w = w; c.h = h; c.dpr = dpr;
          el.width = Math.round(w * dpr);
          el.height = Math.round(h * dpr);
          el.style.width = w + "px";
          el.style.height = h + "px";
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          c.resizeFns.forEach((fn) => fn(w, h));
        };
        c.onResize = (fn) => c.resizeFns.push(fn);
        const ro = new ResizeObserver(fit);
        ro.observe(stage);
        disposers.push(() => ro.disconnect());
        fit();
        return c;
      },

      /** a row of controls under the canvas */
      panel(parent = root) {
        const div = document.createElement("div");
        div.className = "sim-controls";
        parent.appendChild(div);
        return div;
      },

      slider(parent, { label, min, max, step = 0.01, value, log = false, format = (v) => v, onInput }) {
        const wrap = document.createElement("label");
        wrap.className = "sim-slider";
        const top = document.createElement("span");
        const name = document.createElement("span");
        name.textContent = label;
        const out = document.createElement("output");
        top.append(name, out);
        const input = document.createElement("input");
        input.type = "range";
        let toReal, toInput;
        if (log) {
          const a = Math.log(min), b = Math.log(max);
          input.min = 0; input.max = 1000; input.step = 1;
          toReal = (x) => Math.exp(lerp(a, b, x / 1000));
          toInput = (v) => ((Math.log(v) - a) / (b - a)) * 1000;
        } else {
          input.min = min; input.max = max; input.step = step;
          toReal = (x) => +x;
          toInput = (v) => v;
        }
        input.value = toInput(value);
        wrap.append(top, input);
        parent.appendChild(wrap);
        const api = {
          get value() { return toReal(input.value); },
          set(v, fire = true) {
            input.value = toInput(v);
            out.textContent = format(api.value);
            if (fire && onInput) onInput(api.value);
          },
        };
        out.textContent = format(api.value);
        input.addEventListener("input", () => {
          out.textContent = format(api.value);
          if (onInput) onInput(api.value);
        });
        return api;
      },

      select(parent, { label, options, value, onChange }) {
        const wrap = document.createElement("label");
        wrap.className = "sim-select";
        const name = document.createElement("span");
        name.textContent = label;
        const sel = document.createElement("select");
        for (const [v, text] of options) {
          const o = document.createElement("option");
          o.value = v; o.textContent = text;
          sel.appendChild(o);
        }
        sel.value = value;
        sel.addEventListener("change", () => onChange && onChange(sel.value));
        wrap.append(name, sel);
        parent.appendChild(wrap);
        return { get value() { return sel.value; }, set(v) { sel.value = v; } };
      },

      toggle(parent, { label, value = false, onChange }) {
        const wrap = document.createElement("label");
        wrap.className = "sim-toggle";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = value;
        const name = document.createElement("span");
        name.textContent = label;
        input.addEventListener("change", () => onChange && onChange(input.checked));
        wrap.append(input, name);
        parent.appendChild(wrap);
        return { get value() { return input.checked; } };
      },

      button(parent, label, onClick) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "iconbtn";
        b.textContent = label;
        b.addEventListener("click", onClick);
        parent.appendChild(b);
        return b;
      },

      /** a strip of labelled numbers; set(key, text) updates one */
      readouts(parent, pairs) {
        const dl = document.createElement("dl");
        dl.className = "sim-readouts";
        const cells = {};
        for (const [key, label] of pairs) {
          const d = document.createElement("div");
          const dt = document.createElement("dt");
          dt.textContent = label;
          const dd = document.createElement("dd");
          dd.textContent = "—";
          d.append(dt, dd);
          dl.appendChild(d);
          cells[key] = dd;
        }
        parent.appendChild(dl);
        return { set(key, text) { if (cells[key] && cells[key].textContent !== text) cells[key].textContent = text; } };
      },

      /** requestAnimationFrame loop with dt in seconds; stops on dispose */
      loop(fn) {
        let id = 0, last = performance.now(), running = true;
        const tick = (now) => {
          if (!running) return;
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          fn(dt);
          id = requestAnimationFrame(tick);
        };
        id = requestAnimationFrame(tick);
        const stop = () => { running = false; cancelAnimationFrame(id); };
        disposers.push(stop);
        return stop;
      },

      /** pointer events on a canvas in CSS pixel coordinates */
      pointer(c, { down, move, up }) {
        const pos = (e) => {
          const r = c.el.getBoundingClientRect();
          return { x: e.clientX - r.left, y: e.clientY - r.top };
        };
        let dragging = false;
        const onDown = (e) => {
          dragging = true;
          c.el.setPointerCapture(e.pointerId);
          if (down) down(pos(e), e);
        };
        const onMove = (e) => { if (move) move(pos(e), dragging, e); };
        const onUp = (e) => { dragging = false; if (up) up(pos(e), e); };
        c.el.addEventListener("pointerdown", onDown);
        c.el.addEventListener("pointermove", onMove);
        c.el.addEventListener("pointerup", onUp);
        c.el.addEventListener("pointercancel", onUp);
        c.el.style.touchAction = "none";
        disposers.push(() => {
          c.el.removeEventListener("pointerdown", onDown);
          c.el.removeEventListener("pointermove", onMove);
          c.el.removeEventListener("pointerup", onUp);
          c.el.removeEventListener("pointercancel", onUp);
        });
      },

      /** draw axes + frame for a plot inside rect {x,y,w,h}; returns mappers */
      axes(ctx, rect, { xmin, xmax, ymin, ymax, xlabel = "", ylabel = "", xticks = [], yticks = [], xfmt = String, yfmt = String, logx = false, logy = false }) {
        const t = kit.theme();
        const fx = logx ? (v) => Math.log10(v) : (v) => v;
        const fy = logy ? (v) => Math.log10(v) : (v) => v;
        const X = (v) => rect.x + ((fx(v) - fx(xmin)) / (fx(xmax) - fx(xmin))) * rect.w;
        const Y = (v) => rect.y + rect.h - ((fy(v) - fy(ymin)) / (fy(ymax) - fy(ymin))) * rect.h;
        ctx.save();
        ctx.strokeStyle = t.rule;
        ctx.lineWidth = 1;
        ctx.font = t.small;
        ctx.fillStyle = t.muted;
        for (const v of xticks) {
          const x = Math.round(X(v)) + 0.5;
          ctx.beginPath(); ctx.moveTo(x, rect.y); ctx.lineTo(x, rect.y + rect.h); ctx.stroke();
          ctx.textAlign = "center"; ctx.textBaseline = "top";
          ctx.fillText(xfmt(v), x, rect.y + rect.h + 4);
        }
        for (const v of yticks) {
          const y = Math.round(Y(v)) + 0.5;
          ctx.beginPath(); ctx.moveTo(rect.x, y); ctx.lineTo(rect.x + rect.w, y); ctx.stroke();
          ctx.textAlign = "right"; ctx.textBaseline = "middle";
          ctx.fillText(yfmt(v), rect.x - 5, y);
        }
        ctx.strokeStyle = t.muted;
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w, rect.h);
        if (xlabel) {
          ctx.textAlign = "center"; ctx.textBaseline = "top";
          ctx.fillText(xlabel, rect.x + rect.w / 2, rect.y + rect.h + 18);
        }
        if (ylabel) {
          ctx.translate(rect.x - 38, rect.y + rect.h / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.textAlign = "center"; ctx.textBaseline = "bottom";
          ctx.fillText(ylabel, 0, 0);
        }
        ctx.restore();
        return { X, Y };
      },

      /** approximate sRGB colour of a black body at temperature T (kelvin) */
      starColor(T) {
        const t = T / 100;
        let r, g, b;
        if (t <= 66) {
          r = 255;
          g = 99.47 * Math.log(t) - 161.12;
          b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
        } else {
          r = 329.7 * Math.pow(t - 60, -0.1332);
          g = 288.12 * Math.pow(t - 60, -0.0755);
          b = 255;
        }
        const f = (x) => Math.round(clamp(x, 0, 255));
        return `rgb(${f(r)},${f(g)},${f(b)})`;
      },

      /** area where two circles overlap: centres d apart, radii r1 and r2 */
      overlap(d, r1, r2) {
        if (d >= r1 + r2) return 0;
        if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
        const a = Math.acos(clamp((d * d + r1 * r1 - r2 * r2) / (2 * d * r1), -1, 1));
        const b = Math.acos(clamp((d * d + r2 * r2 - r1 * r1) / (2 * d * r2), -1, 1));
        return r1 * r1 * (a - Math.sin(2 * a) / 2) + r2 * r2 * (b - Math.sin(2 * b) / 2);
      },

      /** deterministic random numbers so a simulation looks the same each visit */
      rng(seed = 1) {
        let s = seed >>> 0 || 1;
        return () => {
          s ^= s << 13; s >>>= 0;
          s ^= s >> 17;
          s ^= s << 5; s >>>= 0;
          return s / 4294967296;
        };
      },
    };
    return kit;
  }

  return { register, createKit, has: (id) => defs.has(id), get: (id) => defs.get(id), clamp, lerp };
})();
