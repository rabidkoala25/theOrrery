/* Orrery — a static reading room for scanned space reference books.
   Everything is fetched from docs/data/, which tools/build.py generates. */

(() => {
  "use strict";

  const DATA = "data/";
  const SHARD_COUNT_FALLBACK = 96;
  const STOPWORDS = new Set(`a an and are as at be but by for from has have he her his if in into is it its
of on or our she such that the their then there these they this to was were which while who will
with you your not no can may more most been also than them we us i`.split(/\s+/));

  const dom = {
    view: document.getElementById("view"),
    entries: document.getElementById("entries"),
    filter: document.getElementById("filter"),
    alphabet: document.getElementById("alphabet"),
    railCount: document.getElementById("railCount"),
    bookSelect: document.getElementById("bookSelect"),
    rail: document.getElementById("rail"),
    railToggle: document.getElementById("railToggle"),
    q: document.getElementById("q"),
    findForm: document.getElementById("findForm"),
    themeBtn: document.getElementById("themeBtn"),
    reader: document.getElementById("reader"),
  };

  const state = {
    manifest: null,
    indexes: new Map(),   // bookId -> index.json
    chunks: new Map(),    // `${bookId}/${n}` -> chunk object
    shards: new Map(),    // `${bookId}/${n}` -> shard object
    bookId: null,
    filtered: [],
    rendered: 0,
    terms: [],
    resultSel: -1,
    results: [],
    sims: null,           // sims/sims.json
    simScripts: new Map(),
    simKit: null,         // the running simulation, disposed on navigation
  };

  /* ------------------------------------------------------------ utilities */

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fold = (s) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const num = (n) => n.toLocaleString("en-US");

  function tokenize(text) {
    const out = [];
    const re = /[a-z][a-z0-9]{1,24}/g;
    let m;
    const folded = fold(text);
    while ((m = re.exec(folded))) if (!STOPWORDS.has(m[0])) out.push(m[0]);
    return out;
  }

  // FNV-1a over UTF-8 bytes — must match shard_of() in tools/build.py
  const encoder = new TextEncoder();
  function shardOf(term, shards) {
    let h = 0x811c9dc5;
    for (const b of encoder.encode(term)) {
      h ^= b;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h % shards;
  }

  async function getJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return res.json();
  }

  function pad(n, width) {
    return String(n).padStart(width, "0");
  }

  /* --------------------------------------------------------------- loading */

  async function loadIndex(bookId) {
    if (state.indexes.has(bookId)) return state.indexes.get(bookId);
    const idx = await getJSON(`${DATA}${bookId}/index.json`);
    idx.byId = new Map(idx.entries.map((row, i) => [row[0], i]));
    state.indexes.set(bookId, idx);
    return idx;
  }

  async function loadChunk(bookId, n) {
    const key = `${bookId}/${n}`;
    if (!state.chunks.has(key)) {
      state.chunks.set(key, await getJSON(`${DATA}${bookId}/chunks/${pad(n, 3)}.json`));
    }
    return state.chunks.get(key);
  }

  async function loadShard(bookId, n) {
    const key = `${bookId}/${n}`;
    if (!state.shards.has(key)) {
      state.shards.set(key, await getJSON(`${DATA}${bookId}/search/${pad(n, 2)}.json`));
    }
    return state.shards.get(key);
  }

  async function getEntry(bookId, entryId) {
    const idx = await loadIndex(bookId);
    const at = idx.byId.get(entryId);
    if (at === undefined) return null;
    const row = idx.entries[at];
    const chunk = await loadChunk(bookId, row[2]);
    return { row, at, body: chunk[entryId], index: idx };
  }

  /* ------------------------------------------------------------------ rail */

  function railRows() {
    const idx = state.indexes.get(state.bookId);
    if (!idx) return [];
    const q = fold(dom.filter.value.trim());
    if (!q) return idx.entries;
    const starts = [], contains = [];
    for (const row of idx.entries) {
      const t = fold(row[1]);
      if (t.startsWith(q)) starts.push(row);
      else if (t.includes(q)) contains.push(row);
    }
    return starts.concat(contains);
  }

  function renderRail(reset = true) {
    if (reset) {
      state.filtered = railRows();
      state.rendered = 0;
      dom.entries.innerHTML = "";
      dom.railCount.textContent = state.filtered.length
        ? `${num(state.filtered.length)} entries`
        : "No entry title matches that.";
    }
    const slice = state.filtered.slice(state.rendered, state.rendered + 250);
    const frag = document.createDocumentFragment();
    let lastLetter = state.rendered
      ? state.filtered[state.rendered - 1][4]
      : null;
    const showBreaks = !dom.filter.value.trim();
    for (const row of slice) {
      if (showBreaks && row[4] !== lastLetter) {
        const li = document.createElement("li");
        li.className = "letter-break";
        li.id = `letter-${row[4]}`;
        li.textContent = row[4] === "#" ? "Numerals" : row[4];
        frag.appendChild(li);
        lastLetter = row[4];
      }
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `#/${state.bookId}/${row[0]}`;
      a.textContent = row[1];
      a.dataset.id = row[0];
      li.appendChild(a);
      frag.appendChild(li);
    }
    state.rendered += slice.length;
    dom.entries.appendChild(frag);
    markCurrent();
  }

  function markCurrent() {
    const { bookId, entryId } = parseRoute();
    dom.entries.querySelectorAll("a[aria-current]").forEach((a) => a.removeAttribute("aria-current"));
    if (!entryId || bookId !== state.bookId) return;
    const a = dom.entries.querySelector(`a[data-id="${CSS.escape(entryId)}"]`);
    if (a) a.setAttribute("aria-current", "page");
  }

  function renderAlphabet() {
    const idx = state.indexes.get(state.bookId);
    dom.alphabet.innerHTML = "";
    if (!idx) return;
    const letters = ["#", ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))];
    for (const L of letters) {
      const count = idx.letters[L] || 0;
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = L;
      b.dataset.has = count ? "1" : "0";
      b.disabled = !count;
      b.title = count ? `${num(count)} entries` : "no entries";
      b.addEventListener("click", () => jumpToLetter(L));
      dom.alphabet.appendChild(b);
    }
  }

  function jumpToLetter(letter) {
    dom.filter.value = "";
    const idx = state.indexes.get(state.bookId);
    const at = idx.entries.findIndex((r) => r[4] === letter);
    if (at < 0) return;
    state.filtered = idx.entries;
    state.rendered = 0;
    dom.entries.innerHTML = "";
    dom.railCount.textContent = `${num(idx.entries.length)} entries`;
    // render enough rows to reach the letter, then scroll it into view
    while (state.rendered <= at + 40 && state.rendered < state.filtered.length) renderRail(false);
    const target = document.getElementById(`letter-${letter}`);
    if (target) target.scrollIntoView({ block: "start" });
    openRail(true);
  }

  function openRail(open) {
    if (window.matchMedia("(max-width: 62rem)").matches) {
      dom.rail.dataset.open = open ? "1" : "0";
      dom.railToggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
  }

  dom.entries.addEventListener("scroll", () => {
    if (state.rendered >= state.filtered.length) return;
    const { scrollTop, scrollHeight, clientHeight } = dom.entries;
    if (scrollTop + clientHeight > scrollHeight - 600) renderRail(false);
  });

  dom.filter.addEventListener("input", () => renderRail(true));
  dom.railToggle.addEventListener("click", () =>
    openRail(dom.rail.dataset.open !== "1")
  );
  dom.entries.addEventListener("click", (e) => {
    if (!e.target.closest("a")) return;
    state.terms = [];          // browsing, not following a search
    openRail(false);
  });

  /* ---------------------------------------------------------------- search */

  async function runSearch(query, scope) {
    const terms = [...new Set(tokenize(query))].slice(0, 8);
    state.terms = terms;
    const books = scope === "all" ? state.manifest.books.map((b) => b.id) : [scope];
    const hits = [];

    for (const bookId of books) {
      const idx = await loadIndex(bookId);
      const shards = idx.shards || SHARD_COUNT_FALLBACK;
      const scores = new Map();   // entry position -> {score, matched}
      const N = idx.entries.length;

      for (const term of terms) {
        const shard = await loadShard(bookId, shardOf(term, shards));
        const postings = shard[term];
        if (!postings) continue;
        const df = postings.length / 2;
        const idf = Math.log(1 + N / (1 + df));
        for (let i = 0; i < postings.length; i += 2) {
          const doc = postings[i], tf = postings[i + 1];
          const cur = scores.get(doc) || { score: 0, matched: 0 };
          cur.score += Math.sqrt(tf) * idf;
          cur.matched += 1;
          scores.set(doc, cur);
        }
      }

      // a title that literally contains the query is what people usually want
      const phrase = fold(query.trim());
      for (let i = 0; i < idx.entries.length; i++) {
        const t = fold(idx.entries[i][1]);
        if (phrase && t.includes(phrase)) {
          const cur = scores.get(i) || { score: 0, matched: terms.length };
          cur.score += t === phrase ? 60 : t.startsWith(phrase) ? 34 : 18;
          cur.matched = Math.max(cur.matched, terms.length);
          scores.set(i, cur);
        }
      }

      let best = 0;
      for (const v of scores.values()) if (v.matched > best) best = v.matched;
      for (const [doc, v] of scores) {
        if (terms.length && v.matched < Math.min(terms.length, best)) continue;
        hits.push({ bookId, row: idx.entries[doc], score: v.score, matched: v.matched });
      }
    }

    hits.sort((a, b) => b.matched - a.matched || b.score - a.score);
    return hits.slice(0, 100);
  }

  function highlight(text, terms) {
    if (!terms.length) return esc(text);
    const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    let folded = fold(text);
    // folding keeps character positions in almost every case; if it does not,
    // match against the original text instead of shifting the highlights
    if (folded.length !== text.length) folded = text;
    let out = "", last = 0, m;
    while ((m = re.exec(folded))) {
      if (m.index < last) continue;
      out += esc(text.slice(last, m.index)) + "<mark>" + esc(text.slice(m.index, m.index + m[0].length)) + "</mark>";
      last = m.index + m[0].length;
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    return out + esc(text.slice(last));
  }

  /* ----------------------------------------------------------------- views */

  function setTitle(parts) {
    document.title = [...parts, "Orrery"].filter(Boolean).join(" — ");
  }

  function showLoading(label) {
    dom.view.innerHTML = `<p class="status loading">${esc(label)}</p>`;
  }

  async function viewHome() {
    const books = state.manifest.books;
    const totalEntries = books.reduce((n, b) => n + b.entries, 0);
    const totalWords = books.reduce((n, b) => n + (b.words || 0), 0);
    const site = state.manifest.site || {};
    dom.view.innerHTML = `
      <div class="home">
        <h1>${esc(site.title || "Orrery")}</h1>
        <p class="lede">${esc(site.tagline || "A reading room for space reference books.")}
        ${num(totalEntries)} entries, ${num(totalWords)} words, searchable in full.</p>
        <div class="shelf">
          ${books.map((b, i) => `
            <a class="book" href="#/${esc(b.id)}">
              <span class="n">${pad(i + 1, 2)}</span>
              <span>
                <h2>${esc(b.title)}</h2>
                <p>${esc([b.author, b.year].filter(Boolean).join(", "))}</p>
                <p>${num(b.entries)} entries</p>
              </span>
            </a>`).join("")}
        </div>
        ${state.sims && state.sims.length ? `
        <a class="sim-callout" href="#/sims">
          <strong>${num(state.sims.length)} interactive simulations</strong>
          <span>${state.sims.slice(0, 4).map((x) => esc(x.title)).join(", ")}, and more, each linked to the entries that explain them.</span>
        </a>` : ""}
        <p class="note">Add another scanned book by dropping its text file in
        <code>sources/</code> and running <code>python3 tools/build.py --add</code>.
        The shelf, the index and the search take it from there.</p>
      </div>`;
    setTitle([]);
  }

  async function viewBook(bookId) {
    const idx = await loadIndex(bookId);
    const letters = ["#", ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))];
    const counts = letters.map((L) => idx.letters[L] || 0);
    const max = Math.max(...counts, 1);
    dom.view.innerHTML = `
      <div class="home">
        <h1>${esc(idx.title)}</h1>
        <p class="lede">${esc([idx.author, idx.year].filter(Boolean).join(", "))}</p>
        <div class="spectrum">
          ${letters.map((L, i) => `
            <button type="button" data-letter="${L}" ${counts[i] ? "" : "disabled"}
              style="height:${counts[i] ? Math.max(3, Math.round((Math.sqrt(counts[i]) / Math.sqrt(max)) * 100)) : 1}%"
              title="${L}: ${num(counts[i])} entries"
              aria-label="${counts[i] ? `${num(counts[i])} entries under ${L}` : `no entries under ${L}`}"></button>`).join("")}
        </div>
        <div class="spectrum-axis">${letters.map((L) => `<span>${L === "#" ? "#" : L}</span>`).join("")}</div>
        <div class="actions">
          <button type="button" class="iconbtn" id="randomBtn">Open a random entry</button>
          <button type="button" class="iconbtn" id="firstBtn">Start at the beginning</button>
          ${state.sims && state.sims.length ? `<a class="iconbtn" href="#/sims">Interactive simulations</a>` : ""}
        </div>
        <p class="note">${num(idx.entries.length)} entries, ${num(idx.words)} words.
        Each entry is fetched only when you open it, so the site stays quick on a phone.</p>
      </div>`;
    dom.view.querySelectorAll(".spectrum button").forEach((b) =>
      b.addEventListener("click", () => jumpToLetter(b.dataset.letter))
    );
    document.getElementById("randomBtn").addEventListener("click", () => {
      const row = idx.entries[Math.floor(Math.random() * idx.entries.length)];
      location.hash = `#/${bookId}/${row[0]}`;
    });
    document.getElementById("firstBtn").addEventListener("click", () => {
      location.hash = `#/${bookId}/${idx.entries[0][0]}`;
    });
    setTitle([idx.title]);
  }

  async function viewEntry(bookId, entryId) {
    showLoading("Fetching the entry…");
    const found = await getEntry(bookId, entryId);
    if (!found || !found.body) {
      dom.view.innerHTML = `<p class="status">No entry with the id <code>${esc(entryId)}</code> in this book.
        <a href="#/${esc(bookId)}">Back to the index</a>.</p>`;
      return;
    }
    const { row, at, body, index } = found;
    const terms = state.terms;
    const html = body.b.map((p) => {
      const kind = p[0], text = p[1];
      if (kind === "h") return `<h2>${highlight(text, terms)}</h2>`;
      if (kind === "fig") return `<p class="fig">${highlight(text, terms)}</p>`;
      if (kind === "see") {
        const links = p[2];
        if (!links) return `<p class="see">${esc(text)}</p>`;
        const list = links.map(([label, target]) =>
          target ? `<a href="#/${esc(bookId)}/${esc(target)}">${esc(label)}</a>` : esc(label)
        ).join(", ");
        return `<p class="see">See also: ${list}.</p>`;
      }
      return `<p>${highlight(text, terms)}</p>`;
    }).join("");

    const prev = at > 0 ? index.entries[at - 1] : null;
    const next = at + 1 < index.entries.length ? index.entries[at + 1] : null;
    dom.view.innerHTML = `
      <article>
        <h1>${highlight(body.t, terms)}</h1>
        <p class="credit">${esc(index.title)}${index.year ? `, ${esc(index.year)}` : ""} —
          entry ${num(at + 1)} of ${num(index.entries.length)}, ${num(row[5])} words</p>
        ${simsFor(bookId, entryId).map((sim) => `
          <a class="sim-callout" href="#/sims/${esc(sim.id)}">
            <strong>Try the simulation: ${esc(sim.title)}</strong>
            <span>${esc(sim.summary)}</span>
          </a>`).join("")}
        ${html}
        <nav class="entry-foot">
          ${prev ? `<a href="#/${esc(bookId)}/${esc(prev[0])}">Previous: ${esc(prev[1])}</a>` : ""}
          ${next ? `<a href="#/${esc(bookId)}/${esc(next[0])}">Next: ${esc(next[1])}</a>` : ""}
        </nav>
      </article>`;

    const marks = dom.view.querySelectorAll("mark");
    if (marks.length) {
      const foot = dom.view.querySelector(".entry-foot");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "iconbtn";
      let at2 = -1;
      btn.textContent = `Jump through ${marks.length} match${marks.length > 1 ? "es" : ""}`;
      btn.addEventListener("click", () => {
        marks.forEach((m) => m.classList.remove("here"));
        at2 = (at2 + 1) % marks.length;
        marks[at2].classList.add("here");
        marks[at2].scrollIntoView({ block: "center", behavior: "smooth" });
        btn.textContent = `Match ${at2 + 1} of ${marks.length}`;
      });
      foot.prepend(btn);
    }

    dom.reader.scrollTop = 0;
    window.scrollTo(0, 0);
    setTitle([body.t, index.title]);
    markCurrent();
  }

  async function viewSearch(query, scope) {
    dom.q.value = query;
    showLoading(`Searching for “${query}”…`);
    const hits = await runSearch(query, scope);
    state.results = hits;
    state.resultSel = -1;
    const single = state.manifest.books.length === 1;
    const scopeLabel = scope === "all" && !single
      ? "every book"
      : (state.indexes.get(scope === "all" ? state.manifest.books[0].id : scope)?.title || "this book");
    if (!hits.length) {
      dom.view.innerHTML = `
        <div class="home">
          <h1>Nothing matched “${esc(query)}”</h1>
          <p class="note">Searched ${esc(scopeLabel)}. Try fewer words, or a name as it would be
          printed in the book — the text comes from a scan, so odd spellings do turn up.</p>
        </div>`;
      setTitle([`No results for ${query}`]);
      return;
    }
    const multi = state.manifest.books.length > 1;
    dom.view.innerHTML = `
      <div>
        <h1>${num(hits.length)}${hits.length === 100 ? "+" : ""} result${hits.length > 1 ? "s" : ""} for “${esc(query)}”</h1>
        <p class="credit">Searching ${esc(scopeLabel)}.
          ${multi ? `<a href="#/search?q=${encodeURIComponent(query)}&b=${scope === "all" ? state.bookId : "all"}">
            ${scope === "all" ? "Search only the current book" : "Search every book"}</a>` : ""}</p>
        <ol class="results">
          ${hits.map((h, i) => `
            <li data-i="${i}">
              <h2><a href="#/${esc(h.bookId)}/${esc(h.row[0])}">${highlight(h.row[1], state.terms)}</a></h2>
              <p>${highlight(h.row[3] || "", state.terms)}…</p>
              ${multi ? `<p class="where">${esc(state.indexes.get(h.bookId).title)}</p>` : ""}
            </li>`).join("")}
        </ol>
      </div>`;
    setTitle([`${query} — search`]);
  }

  /* ----------------------------------------------------------- simulations */

  async function loadSims() {
    if (state.sims) return state.sims;
    try {
      state.sims = (await getJSON("sims/sims.json")).sims || [];
    } catch (e) {
      state.sims = [];
    }
    return state.sims;
  }

  function loadSimScript(sim) {
    if (window.OrrerySims && OrrerySims.has(sim.id)) return Promise.resolve();
    if (state.simScripts.has(sim.id)) return state.simScripts.get(sim.id);
    const pr = new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = `sims/${sim.script}`;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`could not load sims/${sim.script}`));
      document.head.appendChild(el);
    });
    state.simScripts.set(sim.id, pr);
    return pr;
  }

  function disposeSim() {
    if (state.simKit) {
      state.simKit.dispose();
      state.simKit = null;
    }
  }

  function simsFor(bookId, entryId) {
    return (state.sims || []).filter((sim) =>
      (sim.articles || []).some((a) => a.book === bookId && a.entry === entryId)
    );
  }

  async function articleLinks(sim) {
    const links = [];
    for (const a of sim.articles || []) {
      let idx;
      try { idx = await loadIndex(a.book); } catch (e) { continue; }
      const at = idx.byId.get(a.entry);
      if (at === undefined) continue;
      links.push({ href: `#/${a.book}/${a.entry}`, title: idx.entries[at][1], book: idx.title });
    }
    return links;
  }

  async function viewSims() {
    const sims = await loadSims();
    if (!sims.length) {
      dom.view.innerHTML = `<div class="home"><h1>No simulations yet</h1>
        <p class="note">Add one to <code>docs/sims/</code> and list it in <code>docs/sims/sims.json</code>.</p></div>`;
      return;
    }
    const rows = [];
    for (const [i, sim] of sims.entries()) {
      const links = await articleLinks(sim);
      rows.push(`
        <li>
          <span class="n">${pad(i + 1, 2)}</span>
          <div>
            <h2><a href="#/sims/${esc(sim.id)}">${esc(sim.title)}</a></h2>
            <p>${esc(sim.summary)}</p>
            ${links.length ? `<p class="linked">Read about it: ${links
              .map((l) => `<a href="${esc(l.href)}">${esc(l.title)}</a>`)
              .join(", ")}</p>` : ""}
          </div>
        </li>`);
    }
    dom.view.innerHTML = `
      <div class="home sims-home">
        <h1>Simulations</h1>
        <p class="lede">${num(sims.length)} working models of ideas from the encyclopedia.
        Each one runs in the page, and each links to the entries that explain it.</p>
        <ol class="sim-list">${rows.join("")}</ol>
      </div>`;
    setTitle(["Simulations"]);
  }

  async function viewSim(id) {
    const sims = await loadSims();
    const at = sims.findIndex((sim) => sim.id === id);
    if (at < 0) {
      dom.view.innerHTML = `<p class="status">No simulation called <code>${esc(id)}</code>.
        <a href="#/sims">See them all</a>.</p>`;
      return;
    }
    const sim = sims[at];
    showLoading("Starting the simulation…");
    await loadSimScript(sim);
    const links = await articleLinks(sim);
    const prev = at > 0 ? sims[at - 1] : null;
    const next = at + 1 < sims.length ? sims[at + 1] : null;
    dom.view.innerHTML = `
      <div class="sim-page">
        <h1>${esc(sim.title)}</h1>
        <p class="credit">${esc(sim.summary)}</p>
        <div class="sim" id="simRoot"></div>
        <div class="sim-notes">
          <h2>How to read it</h2>
          <p>${esc(sim.explain || "")}</p>
          ${links.length ? `<h2>Read about it in the encyclopedia</h2>
          <ul class="sim-articles">${links
            .map((l) => `<li><a href="${esc(l.href)}">${esc(l.title)}</a></li>`)
            .join("")}</ul>` : ""}
        </div>
        <nav class="entry-foot">
          ${prev ? `<a href="#/sims/${esc(prev.id)}">Previous: ${esc(prev.title)}</a>` : ""}
          ${next ? `<a href="#/sims/${esc(next.id)}">Next: ${esc(next.title)}</a>` : ""}
          <a href="#/sims">All simulations</a>
        </nav>
      </div>`;
    const mount = OrrerySims.get(sim.id);
    if (!mount) throw new Error(`sims/${sim.script} did not register "${sim.id}"`);
    state.simKit = OrrerySims.createKit(document.getElementById("simRoot"));
    mount(state.simKit);
    window.scrollTo(0, 0);
    setTitle([sim.title, "Simulations"]);
  }

  /* ---------------------------------------------------------------- routing */

  function parseRoute() {
    const hash = location.hash.replace(/^#\/?/, "");
    if (hash === "sims" || hash.startsWith("sims/")) {
      const id = decodeURIComponent(hash.slice(5));
      return id ? { kind: "sim", id } : { kind: "sims" };
    }
    if (hash.startsWith("search")) {
      const params = new URLSearchParams(hash.split("?")[1] || "");
      return { kind: "search", q: params.get("q") || "", scope: params.get("b") || "all" };
    }
    const [bookId, entryId] = hash.split("/").filter(Boolean).map(decodeURIComponent);
    if (bookId && entryId) return { kind: "entry", bookId, entryId };
    if (bookId) return { kind: "book", bookId };
    return { kind: "home" };
  }

  async function syncBook(bookId) {
    if (!bookId || !state.manifest.books.some((b) => b.id === bookId)) return;
    if (state.bookId === bookId) return;
    state.bookId = bookId;
    dom.bookSelect.value = bookId;
    await loadIndex(bookId);
    renderAlphabet();
    renderRail(true);
  }

  async function route() {
    const r = parseRoute();
    disposeSim();
    document.querySelectorAll(".topbar .simlink").forEach((a) =>
      a.toggleAttribute("aria-current", r.kind === "sims" || r.kind === "sim")
    );
    try {
      await loadSims();
      if (r.kind === "sims") {
        state.terms = [];
        await viewSims();
      } else if (r.kind === "sim") {
        state.terms = [];
        await viewSim(r.id);
      } else if (r.kind === "search") {
        await syncBook(r.scope === "all" ? state.bookId : r.scope);
        if (r.scope === "all") for (const b of state.manifest.books) await loadIndex(b.id);
        await viewSearch(r.q, r.scope);
      } else if (r.kind === "entry") {
        await syncBook(r.bookId);
        await viewEntry(r.bookId, r.entryId);
      } else if (r.kind === "book") {
        await syncBook(r.bookId);
        await viewBook(r.bookId);
      } else {
        state.terms = [];
        await viewHome();
      }
    } catch (err) {
      dom.view.innerHTML = `<p class="status">That page could not be loaded: ${esc(String(err.message || err))}.
        If you are running the site locally, serve the folder with
        <code>python3 -m http.server</code> rather than opening the file directly.</p>`;
    }
  }

  /* ------------------------------------------------------------- chrome bits */

  dom.findForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = dom.q.value.trim();
    if (!q) return;
    const scope = state.manifest.books.length > 1 ? "all" : state.bookId;
    location.hash = `#/search?q=${encodeURIComponent(q)}&b=${scope}`;
  });

  dom.bookSelect.addEventListener("change", () => {
    location.hash = `#/${dom.bookSelect.value}`;
  });

  function applyTheme(mode) {
    document.documentElement.dataset.theme = mode;
    dom.themeBtn.textContent = mode === "dark" ? "Light" : "Dark";
    dom.themeBtn.setAttribute("aria-label", mode === "dark" ? "Switch to light reading" : "Switch to dark reading");
    try { localStorage.setItem("orrery-theme", mode); } catch (e) { /* private mode */ }
  }

  dom.themeBtn.addEventListener("click", () =>
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")
  );

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      e.preventDefault();
      dom.q.focus();
      dom.q.select();
      return;
    }
    if (e.key === "Escape" && document.activeElement === dom.q) dom.q.blur();
    if (!state.results.length || parseRoute().kind !== "search") return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = dom.view.querySelectorAll(".results li");
      if (!items.length) return;
      items.forEach((li) => (li.dataset.sel = "0"));
      state.resultSel = (state.resultSel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      const li = items[state.resultSel];
      li.dataset.sel = "1";
      li.scrollIntoView({ block: "nearest" });
    }
    if (e.key === "Enter" && state.resultSel >= 0) {
      const hit = state.results[state.resultSel];
      if (hit) location.hash = `#/${hit.bookId}/${hit.row[0]}`;
    }
  });

  /* -------------------------------------------------------------- start up */

  async function start() {
    let stored = null;
    try { stored = localStorage.getItem("orrery-theme"); } catch (e) { /* ignore */ }
    applyTheme(stored || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

    try {
      state.manifest = await getJSON(`${DATA}books.json`);
    } catch (err) {
      dom.view.innerHTML = `<div class="home"><h1>No books built yet</h1>
        <p class="note">Run <code>python3 tools/build.py</code> to turn the text files in
        <code>sources/</code> into the site data, then reload. If you opened
        <code>index.html</code> straight from disk, serve the folder instead:
        <code>python3 -m http.server</code> inside <code>docs/</code>.</p></div>`;
      return;
    }
    if (!state.manifest.books.length) {
      dom.view.innerHTML = `<div class="home"><h1>The shelf is empty</h1>
        <p class="note">Add a book with <code>python3 tools/build.py --add sources/yourbook.txt --title "Title"</code>.</p></div>`;
      return;
    }

    const site = state.manifest.site || {};
    if (site.title) {
      document.querySelector(".wordmark span").textContent = site.title;
      setTitle([]);
    }

    dom.bookSelect.innerHTML = state.manifest.books
      .map((b) => `<option value="${esc(b.id)}">${esc(b.title)}</option>`)
      .join("");
    const first = parseRoute().bookId || state.manifest.books[0].id;
    await syncBook(state.manifest.books.some((b) => b.id === first) ? first : state.manifest.books[0].id);

    window.addEventListener("hashchange", route);
    await route();
  }

  start();
})();
