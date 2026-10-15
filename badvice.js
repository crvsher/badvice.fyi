// badvice: one piece at a time, as big as the window allows, in a new face and colours each time.
// Tap, click, space or → (or swipe left) for the next piece; ← (or swipe right) goes back. Every piece shows
// once before any repeats, and the round carries on across visits (kept in this browser only).
// Each piece has its own address (/r173/), with a share preview made by build.py.
// ?still=1&font=Name&paper=N shows one piece in a fixed look, for those preview images.
(() => {
  "use strict";
  const PIECES = JSON.parse(document.getElementById("pieces").textContent);
  if (!PIECES.length) return;
  const main = document.getElementById("piece");
  const faceLabel = document.getElementById("face");
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const params = new URLSearchParams(location.search);
  const still = params.has("still");
  const idOf = loc => (loc.pathname.match(/^\/(r[0-9a-z]+|p\d+)\/?$/) || loc.hash.match(/^#(r[0-9a-z]+|p\d+)$/) || [])[1];
  const indexOf = id => PIECES.findIndex(x => x.id === id);

  // The round: ids already shown since every piece last came up. Kept in localStorage so a return visit
  // carries on where it stopped; pieces added since then simply haven't been shown yet.
  const KEY = "badvice-round";
  function loadRound() {
    try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch (e) { return new Set(); }
  }
  function saveRound() {
    try { localStorage.setItem(KEY, JSON.stringify([...round])); } catch (e) { /* private mode: this visit only */ }
  }
  let round = loadRound();
  function draw(avoid) {
    let left = PIECES.map((x, i) => i).filter(i => !round.has(PIECES[i].id));
    if (!left.length) {                      // everything shown: new round, never the same piece twice in a row
      round = new Set();
      left = PIECES.map((x, i) => i).filter(i => i !== avoid);
    }
    return pick(left);
  }
  function mark(i) { round.add(PIECES[i].id); saveRound(); }

  const shown = [];          // this visit's history, for ←
  let at = -1;

  let font = null, paper = null;
  const loaded = {};
  function loadFont(f) {
    if (!loaded[f]) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(f).replace(/%20/g, "+") +
        ":ital@0;1&display=block";
      document.head.appendChild(link);
      loaded[f] = new Promise(res => { link.onload = res; link.onerror = res; })
        .then(() => document.fonts.load(`400 48px "${f}"`)).catch(() => {});
    }
    return Promise.race([loaded[f], new Promise(res => setTimeout(res, 3000))]);
  }

  // largest size at which the piece fits the window without any word poking out the side
  function fit() {
    const p = main.querySelector("p");
    const cs = getComputedStyle(main);
    const h = main.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    let lo = 12, hi = 400;
    for (let i = 0; i < 20; i++) {
      const s = (lo + hi) / 2;
      p.style.fontSize = s + "px";
      p.style.overflowWrap = "normal";
      if (p.scrollHeight <= h && p.scrollWidth <= p.clientWidth + 1) lo = s; else hi = s;
    }
    p.style.fontSize = Math.floor(lo) + "px";
    // only a single word too long for the window even at the smallest size may break
    p.style.overflowWrap = p.scrollWidth > p.clientWidth + 1 ? "anywhere" : "normal";
  }

  function count(id) {
    if (!still && window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "/" + id + "/" });
  }

  async function show(i, push) {
    const p = main.querySelector("p");
    if (!still) p.classList.add("out");
    font = (font === null && params.get("font")) || pick(FONTS.filter(f => f !== font));
    paper = still && params.has("paper") ? PAPERS[+params.get("paper") % PAPERS.length]
                                         : pick(PAPERS.filter(x => x !== paper));
    await Promise.all([loadFont(font), new Promise(r => setTimeout(r, still ? 0 : 150))]);
    document.body.style.background = paper[0];
    document.body.style.color = paper[1];
    document.body.style.fontFamily = `"${font}", Georgia, serif`;
    p.textContent = PIECES[i].text;          // casing and wording exactly as written
    p.style.fontStyle = !still && Math.random() < .15 ? "italic" : "normal";
    p.style.letterSpacing = still ? "0" : rand(-.02, .04).toFixed(3) + "em";
    p.style.lineHeight = still ? "1.15" : rand(1, 1.3).toFixed(2);
    p.style.textAlign = "left";   // always left (user, 2026-10-14)
    faceLabel.textContent = font;
    document.title = PIECES[i].text + " · badvice";
    fit();
    p.classList.remove("out");
    // a face that finishes loading after the first fit has different widths: fit again once it's in
    const f = font;
    document.fonts.ready.then(() => { if (f === font) { fit(); if (still) document.body.dataset.ready = "1"; } });
    setTimeout(() => { if (f === font) fit(); }, 600);
    if (still) return;
    const path = "/" + PIECES[i].id + "/";
    if (location.pathname !== path || location.hash) history[push ? "pushState" : "replaceState"](null, "", path);
    count(PIECES[i].id);
  }

  function next() {
    if (at < shown.length - 1) { at++; return show(shown[at], true); }
    const i = draw(shown[at]);
    mark(i);
    shown.push(i); at = shown.length - 1;
    return show(i, true);
  }
  function back() {
    if (at > 0) { at--; show(shown[at], true); }
  }

  // start on the linked piece, else the next one in this browser's round
  const linked = indexOf(idOf(location));
  const first = linked >= 0 ? linked : draw();
  mark(first);
  shown.push(first); at = 0;
  show(first, false);
  if (still) return;

  // swipes: left = next, right = back; a swipe never also counts as a tap
  let x0 = null, y0 = 0, swiped = 0;
  document.addEventListener("touchstart", e => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
  document.addEventListener("touchend", e => {
    if (x0 === null) return;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped = Date.now();
      dx < 0 ? next() : back();
    }
  }, { passive: true });
  document.addEventListener("click", e => {
    if (e.target.closest("a") || Date.now() - swiped < 500) return;   // the site link just opens
    next();
  });
  document.addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
  });
  window.addEventListener("popstate", () => {
    const i = indexOf(idOf(location));
    if (i >= 0) show(i, false);
  });
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(fit, 120); });
})();
