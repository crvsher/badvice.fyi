// badvice: one piece at a time, as big as the window allows, in a new face and colours each time.
// Tap, click, space or → for the next piece; ← goes back. Every piece shows once before any repeats.
// The address ends in the piece's id (#r173), so any piece can be linked to.
(() => {
  "use strict";
  const PIECES = JSON.parse(document.getElementById("pieces").textContent);
  if (!PIECES.length) return;
  const main = document.getElementById("piece");
  const faceLabel = document.getElementById("face");
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const params = new URLSearchParams(location.search);

  // a shuffled deck; refilled (without repeating the last piece) once every piece has shown
  let deck = [];
  const shown = [];          // history, for ←
  let at = -1;
  function draw(avoid) {
    if (!deck.length) {
      deck = PIECES.map((_, i) => i).filter(i => i !== avoid);
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }
    return deck.pop();
  }

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
    const h = main.clientHeight - parseFloat(getComputedStyle(main).paddingTop) * 2;
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

  async function show(i, push) {
    const p = main.querySelector("p");
    p.classList.add("out");
    font = (font === null && params.get("font")) || pick(FONTS.filter(f => f !== font));
    paper = pick(PAPERS.filter(x => x !== paper));
    await Promise.all([loadFont(font), new Promise(r => setTimeout(r, 150))]);
    document.body.style.background = paper[0];
    document.body.style.color = paper[1];
    document.body.style.fontFamily = `"${font}", Georgia, serif`;
    p.textContent = PIECES[i].text;          // casing and wording exactly as written
    p.style.fontStyle = Math.random() < .15 ? "italic" : "normal";
    p.style.letterSpacing = rand(-.02, .04).toFixed(3) + "em";
    p.style.lineHeight = rand(1, 1.3).toFixed(2);
    p.style.textAlign = "left";   // always left (user, 2026-10-14)
    faceLabel.textContent = font;
    fit();
    p.classList.remove("out");
    // a face that finishes loading after the first fit has different widths: fit again once it's in
    const f = font;
    document.fonts.ready.then(() => { if (f === font) fit(); });
    setTimeout(() => { if (f === font) fit(); }, 600);
    const hash = "#" + PIECES[i].id;
    if (location.hash !== hash) history[push ? "pushState" : "replaceState"](null, "", hash);
  }

  function next() {
    if (at < shown.length - 1) { at++; return show(shown[at], true); }
    const i = draw(shown[at]);
    shown.push(i); at = shown.length - 1;
    return show(i, true);
  }
  function back() {
    if (at > 0) { at--; show(shown[at], true); }
  }

  // start on the linked piece, else a random one
  const linked = PIECES.findIndex(x => "#" + x.id === location.hash);
  const first = linked >= 0 ? linked : draw();
  if (linked >= 0) deck = deck.filter(i => i !== linked);
  shown.push(first); at = 0;
  show(first, false);

  document.addEventListener("click", e => { if (!e.target.closest("a")) next(); });   // the site link just opens
  document.addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
  });
  window.addEventListener("popstate", () => {
    const i = PIECES.findIndex(x => "#" + x.id === location.hash);
    if (i >= 0) show(i, false);
  });
  let t;
  window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(fit, 120); });
})();
