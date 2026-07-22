/* ============================================================
   Audivue — App glue
   Wires audio + director + visualizer to the UI, the render
   loop, keyboard shortcuts, TV/fullscreen mode and idle-hide.
   ============================================================ */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('stage');

  const audio = new AudioEngine();
  const director = new Director();
  let viz;
  try {
    viz = new Visualizer(canvas);
  } catch (e) {
    document.body.innerHTML =
      '<div style="color:#fff;font-family:sans-serif;padding:40px;max-width:600px">' +
      '<h2>Audivue can\'t start</h2><p>' + e.message +
      '</p><p>Try a recent version of Chrome, Edge, Firefox or Safari with hardware acceleration enabled.</p></div>';
    return;
  }

  let started = false;
  let last = performance.now();
  const t0 = last;

  /* ---------------- Toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ---------------- Scene dots ---------------- */
  const dotsWrap = $('sceneDots');
  SCENE_NAMES.forEach((name, i) => {
    const d = document.createElement('div');
    d.className = 'dot' + (i === 0 ? ' on' : '');
    d.title = name;
    d.addEventListener('click', () => { director.cutTo(i); toast('Scene · ' + name); });
    dotsWrap.appendChild(d);
  });
  function syncDots() {
    const cur = director.p.transition > 0 ? director.p.sceneNext : director.p.scene;
    [...dotsWrap.children].forEach((d, i) => d.classList.toggle('on', i === cur));
    $('hudScene').textContent = SCENE_NAMES[cur];
  }

  /* ---------------- Genre / mood picker ---------------- */
  function buildChips(wrapId, list, group) {
    const wrap = $(wrapId);
    list.forEach((entry) => {
      const c = document.createElement('button');
      c.className = 'chip';
      c.type = 'button';
      c.textContent = entry.name;
      c.addEventListener('click', () => {
        director.applyCommand(entry.p);
        // reflect on sliders + highlight the active chip within its group
        if (entry.p.intensity !== undefined) $('intensity').value = Math.round(entry.p.intensity * 100);
        if (entry.p.hue !== undefined) $('hue').value = Math.round(entry.p.hue * 100);
        [...wrap.children].forEach((x) => x.classList.remove('on'));
        c.classList.add('on');
        toast((group === 'genre' ? '🎵 ' : '🎬 ') + entry.name);
        kickIdle();
      });
      wrap.appendChild(c);
    });
  }
  buildChips('genreChips', Commands.GENRES, 'genre');
  buildChips('moodChips', Commands.CINEMATIC, 'mood');

  function toggleStyle(force) {
    const panel = $('stylePanel');
    const show = force !== undefined ? force : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !show);
    $('btnStyle').classList.toggle('on', show);
  }
  $('btnStyle').addEventListener('click', () => toggleStyle());

  /* ---------------- Sources ---------------- */
  async function startSource(type) {
    try {
      if (type === 'mic') { await audio.useMic(); toast('Listening on microphone'); }
      else if (type === 'display') { await audio.useDisplay(); toast('Listening to shared audio'); }
      else if (type === 'file') {
        return new Promise((resolve) => {
          const inp = $('fileInput');
          inp.onchange = async () => {
            if (!inp.files[0]) return resolve(false);
            try { await audio.useFile(inp.files[0]); toast('Playing · ' + inp.files[0].name); resolve(true); }
            catch (e) { toast('Could not play that file.'); resolve(false); }
          };
          inp.click();
        });
      }
      return true;
    } catch (e) {
      toast(e.message || 'Could not access that audio source.');
      return false;
    }
  }

  async function begin(type) {
    const ok = await startSource(type);
    if (!ok) return;
    started = true;
    $('welcome').classList.add('hidden');
    $('commandBar').classList.remove('hidden');
    $('dock').classList.remove('hidden');
    updatePlayBtn();
    kickIdle();
  }

  document.querySelectorAll('.src-btn').forEach((b) =>
    b.addEventListener('click', () => begin(b.dataset.source)));

  /* ---------------- Command bar ---------------- */
  $('commandBar').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('commandInput').value.trim();
    if (!text) return;
    const { params, matched } = Commands.parseCommand(text);
    director.applyCommand(params);
    // reflect on sliders
    if (params.intensity !== undefined) $('intensity').value = Math.round(params.intensity * 100);
    if (params.hue !== undefined) $('hue').value = Math.round(params.hue * 100);
    toast(matched ? '🎬 Directing · "' + text + '"' : 'Hmm, try moods like "neon", "ocean", "rave", "chill".');
    $('commandInput').blur();
  });

  /* ---------------- Dock controls ---------------- */
  $('btnPlay').addEventListener('click', () => { audio.togglePlay(); updatePlayBtn(); });
  function updatePlayBtn() { $('btnPlay').textContent = audio.playing ? '⏸' : '▶'; }

  $('btnAuto').addEventListener('click', () => {
    const on = director.toggleAuto();
    $('btnAuto').classList.toggle('on', on);
    toast(on ? '🎬 Auto-Direct on' : 'Auto-Direct off — you\'re driving');
  });
  $('btnAuto').classList.toggle('on', director.autoDirect);

  $('intensity').addEventListener('input', (e) => director.setIntensity(e.target.value / 100));
  $('hue').addEventListener('input', (e) => director.setHue(e.target.value / 100));

  $('btnSource').addEventListener('click', () => $('welcome').classList.remove('hidden'));
  $('btnFullscreen').addEventListener('click', toggleFullscreen);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      (document.documentElement.requestFullscreen || (() => {})).call(document.documentElement);
    } else {
      (document.exitFullscreen || (() => {})).call(document);
    }
  }

  /* ---------------- Keyboard ---------------- */
  document.addEventListener('keydown', (e) => {
    if (document.activeElement === $('commandInput')) {
      if (e.key === 'Escape') $('commandInput').blur();
      return;
    }
    switch (e.key.toLowerCase()) {
      case ' ': e.preventDefault(); audio.togglePlay(); updatePlayBtn(); break;
      case 'f': toggleFullscreen(); break;
      case 'a': $('btnAuto').click(); break;
      case 'g': toggleStyle(); break;
      case 'h': document.body.classList.toggle('idle'); break;
      case 'arrowleft': director.setHue((director.target.hue + 0.95) % 1); $('hue').value = Math.round(director.target.hue*100); break;
      case 'arrowright': director.setHue((director.target.hue + 0.05) % 1); $('hue').value = Math.round(director.target.hue*100); break;
      case '/': e.preventDefault(); $('commandInput').focus(); break;
      default:
        if (e.key >= '1' && e.key <= '5') director.cutTo(parseInt(e.key, 10) - 1);
    }
    kickIdle();
  });

  /* ---------------- Idle hide ---------------- */
  let idleTimer;
  function kickIdle() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (started) document.body.classList.add('idle'); }, 3500);
  }
  ['mousemove', 'touchstart', 'click'].forEach((ev) =>
    document.addEventListener(ev, kickIdle, { passive: true }));

  /* ---------------- Meters ---------------- */
  function setMeters() {
    $('mBass').style.setProperty('--v', Math.min(100, audio.bass * 140) + '%');
    $('mMid').style.setProperty('--v', Math.min(100, audio.mid * 140) + '%');
    $('mTreble').style.setProperty('--v', Math.min(100, audio.treble * 160) + '%');
  }

  /* ---------------- Render loop ---------------- */
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;

    let freshBeat = false;
    if (started) freshBeat = audio.update() || false;

    director.update(dt, freshBeat, audio);
    viz.render(t, audio, director.p);

    if (started) { setMeters(); syncDots(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Small idle demo motion before the user starts (so it isn't black).
  audio.bass = audio.mid = audio.treble = audio.level = 0.12;
})();
