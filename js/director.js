/* ============================================================
   Audivue — Cinematic director
   Owns the live visual params, eases toward command targets,
   and (in auto mode) cuts between scenes on beats — like a
   VJ / editor watching the music.
   ============================================================ */
(function (global) {
  'use strict';

  const SCENE_COUNT = 29;

  class Director {
    constructor() {
      // Live params consumed by the visualizer each frame.
      this.p = {
        hue: 0.6, saturation: 0.9, intensity: 0.8, beatKick: 1.0, look: 0,
        scene: 0, sceneNext: 0, transition: 0,
      };
      // Targets the params ease toward (set by commands / sliders).
      this.target = { hue: 0.6, saturation: 0.9, intensity: 0.8 };

      this.autoDirect = true;
      this.cutSpeed = 8;          // avg seconds between auto cuts
      this._sinceCut = 0;
      this._minCut = 3;           // never cut faster than this
      this._transitioning = false;
      this._transDur = 1.1;       // seconds
      this._transT = 0;
    }

    /* Apply parsed command params. */
    applyCommand(params) {
      if (params.hue !== undefined) this.target.hue = params.hue;
      if (params.saturation !== undefined) this.target.saturation = params.saturation;
      if (params.intensity !== undefined) this.target.intensity = params.intensity;
      if (params.cutSpeed !== undefined) this.cutSpeed = params.cutSpeed;
      if (params.beatKick !== undefined) this.p.beatKick = params.beatKick;
      if (params.look !== undefined) this.p.look = params.look;
      if (params.transDur !== undefined) this._transDur = params.transDur;
      if (params.autoDirect !== undefined) this.autoDirect = params.autoDirect;
      if (params.scene !== undefined) this.cutTo(params.scene);
    }

    setHue(h) { this.target.hue = h; }
    setIntensity(i) { this.target.intensity = i; }
    setSaturation(s) { this.target.saturation = s; }

    /* Snapshot the current look for share/embed links. */
    snapshot() {
      return {
        scene: Math.round(this.p.transition > 0 ? this.p.sceneNext : this.p.scene),
        hue: +this.target.hue.toFixed(3),
        sat: +this.target.saturation.toFixed(3),
        int: +this.target.intensity.toFixed(3),
        cut: +this.cutSpeed.toFixed(1),
        kick: +this.p.beatKick.toFixed(2),
        look: this.p.look,
        auto: this.autoDirect ? 1 : 0,
      };
    }

    /* Apply a look immediately (no easing) — used for URL config. */
    applyConfig(c) {
      if (c.hue != null) { this.target.hue = c.hue; this.p.hue = c.hue; }
      if (c.sat != null) { this.target.saturation = c.sat; this.p.saturation = c.sat; }
      if (c.int != null) { this.target.intensity = c.int; this.p.intensity = c.int; }
      if (c.cut != null) this.cutSpeed = c.cut;
      if (c.kick != null) this.p.beatKick = c.kick;
      if (c.look != null) this.p.look = c.look;
      if (c.auto != null) this.autoDirect = !!c.auto;
      if (c.scene != null) { this.p.scene = c.scene; this.p.sceneNext = c.scene; this.p.transition = 0; }
    }

    toggleAuto() { this.autoDirect = !this.autoDirect; return this.autoDirect; }

    /* Start a crossfade to a specific scene. */
    cutTo(idx) {
      idx = ((idx % SCENE_COUNT) + SCENE_COUNT) % SCENE_COUNT;
      if (idx === this.p.scene && !this._transitioning) return;
      this.p.sceneNext = idx;
      this._transitioning = true;
      this._transT = 0;
      this._sinceCut = 0;
    }

    cutToRandom() {
      let n = this.p.scene;
      while (n === this.p.scene) n = Math.floor(Math.random() * SCENE_COUNT);
      // A cut sometimes also nudges the hue for variety.
      if (Math.random() < 0.4) this.target.hue = (this.target.hue + 0.12 + Math.random() * 0.2) % 1;
      this.cutTo(n);
    }

    /* Per-frame update. dt in seconds, freshBeat=true on new beat. */
    update(dt, freshBeat, audio) {
      const p = this.p, t = this.target;
      // Ease params toward targets (hue wraps the short way).
      let dh = t.hue - p.hue;
      if (dh > 0.5) dh -= 1; if (dh < -0.5) dh += 1;
      p.hue = (p.hue + dh * Math.min(1, dt * 3) + 1) % 1;
      p.saturation += (t.saturation - p.saturation) * Math.min(1, dt * 3);
      p.intensity += (t.intensity - p.intensity) * Math.min(1, dt * 3);

      // Handle an active transition.
      if (this._transitioning) {
        this._transT += dt / this._transDur;
        p.transition = Math.min(1, this._transT);
        if (this._transT >= 1) {
          p.scene = p.sceneNext;
          p.transition = 0;
          this._transitioning = false;
        }
        return p;
      }

      // Auto-direct: schedule cuts, biased to land on beats.
      if (this.autoDirect) {
        this._sinceCut += dt;
        const ready = this._sinceCut > this._minCut;
        const dueSoft = this._sinceCut > this.cutSpeed * 0.7 && freshBeat && audio.bass > 0.35;
        const dueHard = this._sinceCut > this.cutSpeed * 1.6;
        if (ready && (dueSoft || dueHard)) this.cutToRandom();
      }
      return p;
    }
  }

  global.Director = Director;
})(window);
