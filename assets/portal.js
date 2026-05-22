/* BomberMen-X — shared portal helpers.
   Loaded by every viewer page (.view.html) and by index.html.

   Provides:
     - theme toggle (dark / light) persisted in localStorage
     - optional UI sound cues (off by default), persisted in localStorage
     - scroll-reveal via IntersectionObserver
     - a small floating control widget anchored bottom-right
     - keyboard shortcuts:  t = toggle theme,  s = toggle sound,  ? = help

   Pure vanilla JS, no dependencies, safe under file://.
*/
(function () {
  "use strict";

  var LS_THEME = "bmx.theme";
  var LS_SOUND = "bmx.sound";
  var LS_MUSIC = "bmx.music";
  var DEFAULT_THEME = "dark";
  var DEFAULT_SOUND = "off";
  var DEFAULT_MUSIC = "off";

  // ---------- Theme ----------

  function readTheme() {
    try { return localStorage.getItem(LS_THEME) || DEFAULT_THEME; }
    catch (e) { return DEFAULT_THEME; }
  }
  function writeTheme(t) {
    try { localStorage.setItem(LS_THEME, t); } catch (e) {}
  }
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    var btn = document.getElementById("bmx-theme-btn");
    if (btn) {
      btn.setAttribute("aria-pressed", t === "light" ? "true" : "false");
      btn.querySelector(".bmx-icon").textContent = t === "light" ? "☀" : "☾";
      btn.setAttribute("title", "Theme: " + t + " (press T)");
    }
  }
  function toggleTheme() {
    var next = readTheme() === "dark" ? "light" : "dark";
    writeTheme(next);
    applyTheme(next);
    beep(next === "light" ? 660 : 440, 0.04);
  }

  // ---------- Sound ----------

  var audioCtx = null;
  function ensureAudio() {
    if (audioCtx) return audioCtx;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try { audioCtx = new Ctx(); } catch (e) { audioCtx = null; }
    return audioCtx;
  }
  function readSound() {
    try { return localStorage.getItem(LS_SOUND) || DEFAULT_SOUND; }
    catch (e) { return DEFAULT_SOUND; }
  }
  function writeSound(v) {
    try { localStorage.setItem(LS_SOUND, v); } catch (e) {}
  }
  function applySound(v) {
    var btn = document.getElementById("bmx-sound-btn");
    if (btn) {
      btn.setAttribute("aria-pressed", v === "on" ? "true" : "false");
      btn.querySelector(".bmx-icon").textContent = v === "on" ? "♪" : "○";
      btn.setAttribute("title", "Sound: " + v + " (press S)");
    }
  }
  function toggleSound() {
    var next = readSound() === "on" ? "off" : "on";
    writeSound(next);
    applySound(next);
    if (next === "on") beep(880, 0.05);
  }
  function beep(freq, dur) {
    if (readSound() !== "on") return;
    var ctx = ensureAudio();
    if (!ctx) return;
    try {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq || 660;
      var now = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + (dur || 0.06));
      o.connect(g); g.connect(ctx.destination);
      o.start(now);
      o.stop(now + (dur || 0.06) + 0.02);
    } catch (e) { /* ignore */ }
  }

  // ---------- Music (background ambient, Indian drone fallback) ----------

  var musicEl = null;          // HTMLAudioElement (if a real file loads)
  var musicCtxNodes = null;    // synthesised fallback nodes

  function readMusic() {
    try { return localStorage.getItem(LS_MUSIC) || DEFAULT_MUSIC; }
    catch (e) { return DEFAULT_MUSIC; }
  }
  function writeMusic(v) { try { localStorage.setItem(LS_MUSIC, v); } catch (e) {} }
  function applyMusicLabel(v) {
    var btn = document.getElementById("bmx-music-btn");
    if (btn) {
      btn.setAttribute("aria-pressed", v === "on" ? "true" : "false");
      btn.querySelector(".bmx-icon").textContent = v === "on" ? "♬" : "◌";
      btn.setAttribute("title", "Music: " + v + " (press M)");
    }
  }

  function stopMusic() {
    if (musicEl) { try { musicEl.pause(); } catch (e) {} musicEl = null; }
    if (musicCtxNodes) {
      try {
        musicCtxNodes.oscs.forEach(function (o) { try { o.stop(); } catch (e) {} });
        musicCtxNodes.master.disconnect();
      } catch (e) {}
      musicCtxNodes = null;
    }
  }

  function startMusicFile(url) {
    return new Promise(function (resolve, reject) {
      var a = new Audio();
      a.src = url;
      a.loop = true;
      a.volume = 0.32;
      a.preload = "auto";
      a.addEventListener("canplaythrough", function () {
        a.play().then(function () { musicEl = a; resolve(); }).catch(reject);
      }, { once: true });
      a.addEventListener("error", function () { reject(new Error("audio error")); }, { once: true });
      // Some browsers need the load triggered explicitly.
      a.load();
    });
  }

  function startMusicSynth() {
    var ctx = ensureAudio();
    if (!ctx) return false;
    var master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);
    var now = ctx.currentTime;
    master.gain.exponentialRampToValueAtTime(0.10, now + 1.4);

    // Two-note drone: tonic (C3 ≈ 130.81) + fifth (G3 ≈ 196).
    function makeDrone(freq, detune, gain) {
      var o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq;
      o.detune.value = detune || 0;
      var g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g); g.connect(master);
      o.start();
      return o;
    }
    var oscs = [];
    oscs.push(makeDrone(130.81, 0, 0.5));   // tonic
    oscs.push(makeDrone(130.81, 6, 0.30));  // tonic, slightly detuned for body
    oscs.push(makeDrone(196.00, 0, 0.32));  // fifth
    oscs.push(makeDrone(261.63, 0, 0.16));  // octave
    // A very slow LFO for tanpura-like shimmer.
    var lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    var lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.04;
    lfo.connect(lfoGain).connect(master.gain);
    lfo.start();
    oscs.push(lfo);

    musicCtxNodes = { master: master, oscs: oscs };
    return true;
  }

  function toggleMusic() {
    var next = readMusic() === "on" ? "off" : "on";
    writeMusic(next);
    applyMusicLabel(next);
    if (next === "on") {
      // Prefer a real file if dropped in by the team. Otherwise synthesise.
      var url = (window.BMX_MUSIC_URL || "assets/music/arena.mp3");
      // Resolve relative to the current page directory.
      startMusicFile(url).catch(function () {
        startMusicSynth();
      });
    } else {
      stopMusic();
    }
  }

  // Public API for pages that want to play cues.
  window.BMX = {
    beep: beep,
    chord: function () {
      if (readSound() !== "on") return;
      [523, 659, 784].forEach(function (f, i) {
        setTimeout(function () { beep(f, 0.05); }, i * 60);
      });
    },
    warn: function () { beep(220, 0.1); },
    success: function () { window.BMX.chord(); },
    toggleTheme: toggleTheme,
    toggleSound: toggleSound,
    toggleMusic: toggleMusic,
    getTheme: readTheme,
    getSound: readSound,
    getMusic: readMusic
  };

  // ---------- Widget ----------

  function buildWidget() {
    if (document.getElementById("bmx-controls")) return;
    var wrap = document.createElement("div");
    wrap.id = "bmx-controls";
    wrap.setAttribute("role", "toolbar");
    wrap.setAttribute("aria-label", "Site controls");
    wrap.innerHTML =
      '<button id="bmx-theme-btn" type="button" class="bmx-btn"' +
      ' aria-label="Toggle dark/light theme" aria-pressed="false">' +
      '<span class="bmx-icon">☾</span><span class="bmx-lbl">Theme</span></button>' +
      '<button id="bmx-sound-btn" type="button" class="bmx-btn"' +
      ' aria-label="Toggle UI sound" aria-pressed="false">' +
      '<span class="bmx-icon">○</span><span class="bmx-lbl">Sound</span></button>' +
      '<button id="bmx-music-btn" type="button" class="bmx-btn"' +
      ' aria-label="Toggle background music" aria-pressed="false">' +
      '<span class="bmx-icon">◌</span><span class="bmx-lbl">Music</span></button>' +
      '<button id="bmx-top-btn" type="button" class="bmx-btn"' +
      ' aria-label="Scroll to top" title="Scroll to top">' +
      '<span class="bmx-icon">↑</span><span class="bmx-lbl">Top</span></button>';
    document.body.appendChild(wrap);
    document.getElementById("bmx-theme-btn").addEventListener("click", function () { toggleTheme(); });
    document.getElementById("bmx-sound-btn").addEventListener("click", function () { toggleSound(); });
    document.getElementById("bmx-music-btn").addEventListener("click", function () { toggleMusic(); });
    document.getElementById("bmx-top-btn").addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
      beep(520, 0.04);
    });
  }

  // ---------- Scroll reveal ----------

  function setupReveal() {
    var prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !("IntersectionObserver" in window)) {
      document.querySelectorAll("[data-reveal]").forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });

    // Auto-tag common content blocks on viewer pages so they animate in.
    var auto = document.querySelectorAll(
      "article > h1, article > h2, article > h3, article > p, " +
      "article > ul, article > ol, article > pre, article > blockquote, " +
      "article > .table-wrap, article > hr"
    );
    auto.forEach(function (el) { el.setAttribute("data-reveal", ""); });

    document.querySelectorAll("[data-reveal]").forEach(function (el) { io.observe(el); });
  }

  // ---------- Scroll progress ----------

  function setupProgress() {
    if (document.getElementById("bmx-progress")) return;
    var bar = document.createElement("div");
    bar.id = "bmx-progress";
    document.body.appendChild(bar);
    function tick() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? (h.scrollTop / max) * 100 : 0;
      bar.style.width = p + "%";
    }
    document.addEventListener("scroll", tick, { passive: true });
    tick();
  }

  // ---------- Keyboard shortcuts ----------

  function setupShortcuts() {
    document.addEventListener("keydown", function (e) {
      // Ignore when typing in fields.
      var t = e.target;
      var tag = t && t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (t && t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "t" || e.key === "T") { toggleTheme(); e.preventDefault(); }
      else if (e.key === "s" || e.key === "S") { toggleSound(); e.preventDefault(); }
      else if (e.key === "m" || e.key === "M") { toggleMusic(); e.preventDefault(); }
      else if (e.key === "?") { window.BMX.help && window.BMX.help(); }
    });
  }

  // ---------- Sound on key UI ----------

  function setupCardSounds() {
    document.body.addEventListener("click", function (e) {
      var card = e.target.closest && e.target.closest("a.card, .bmx-btn, button");
      if (!card) return;
      if (card.id && card.id.indexOf("bmx-") === 0) return; // own buttons handle their own beep
      beep(560, 0.035);
    }, true);
  }

  // ---------- Init ----------

  function init() {
    applyTheme(readTheme());
    buildWidget();
    applyTheme(readTheme()); // re-apply now that the button exists
    applySound(readSound());
    applyMusicLabel(readMusic());
    setupProgress();
    setupReveal();
    setupShortcuts();
    setupCardSounds();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
