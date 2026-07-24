/* ============================================================
   Audivue — Audio engine
   Real-time FFT analysis: bass / mid / treble / level + beat.
   Sources: microphone, music file, shared tab/system audio.
   ============================================================ */
(function (global) {
  'use strict';

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.analyser = null;
      this.freq = null;
      this.sourceNode = null;   // MediaStreamSource or MediaElementSource
      this.mediaEl = null;      // <audio> element when playing a file
      this.stream = null;       // active MediaStream (mic / display)
      this.sourceType = null;   // 'mic' | 'file' | 'display'

      // Smoothed, normalized 0..1 values consumed by the visualizer.
      this.bass = 0;
      this.mid = 0;
      this.treble = 0;
      this.level = 0;

      // Beat detection + auto-gain.
      this.beat = 0;            // decaying pulse 0..1
      this._peak = 0.15;        // running level peak (auto-gain for quiet input)
      this._prevBass = 0;
      this._fluxHist = [];      // spectral-flux history for onset detection
      this._lastBeat = 0;

      this.playing = false;
    }

    _ensureContext() {
      if (!this.ctx) {
        const AC = global.AudioContext || global.webkitAudioContext;
        this.ctx = new AC();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.6; // sharper transients for beat detection
        this.freq = new Uint8Array(this.analyser.frequencyBinCount);
        this.wave = new Uint8Array(this.analyser.fftSize); // time-domain (oscilloscope)
        this.streamDest = this.ctx.createMediaStreamDestination(); // for AirPlay audio (file only)
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    _teardownSource() {
      try { if (this.sourceNode) this.sourceNode.disconnect(); } catch (e) {}
      if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
      if (this.mediaEl) { this.mediaEl.pause(); this.mediaEl.src = ''; this.mediaEl = null; }
      this.sourceNode = null;
    }

    /* ---- Source: microphone -------------------------------- */
    async useMic() {
      this._ensureContext();
      this._teardownSource();
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      this.sourceNode = this.ctx.createMediaStreamSource(this.stream);
      this.sourceNode.connect(this.analyser);   // do NOT route mic to speakers (feedback)
      this.sourceType = 'mic';
      this.playing = true;
      return true;
    }

    /* ---- Source: shared tab / system audio ----------------- */
    async useDisplay() {
      this._ensureContext();
      this._teardownSource();
      this.stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const hasAudio = this.stream.getAudioTracks().length > 0;
      if (!hasAudio) {
        this._teardownSource();
        throw new Error('No audio was shared. Re-share and tick "Share tab audio".');
      }
      // We only need the audio; stop the video track to save resources.
      this.stream.getVideoTracks().forEach(t => t.stop());
      this.sourceNode = this.ctx.createMediaStreamSource(this.stream);
      this.sourceNode.connect(this.analyser);
      this.sourceType = 'display';
      this.playing = true;
      return true;
    }

    /* ---- Source: local music file -------------------------- */
    async useFile(file) {
      this._ensureContext();
      this._teardownSource();
      const url = URL.createObjectURL(file);
      const el = new Audio();
      el.src = url;
      el.crossOrigin = 'anonymous';
      el.loop = true;
      this.mediaEl = el;
      this.sourceNode = this.ctx.createMediaElementSource(el);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.ctx.destination); // file audio should be audible
      this.sourceNode.connect(this.streamDest);    // and available to the AirPlay stream
      this.sourceType = 'file';
      await el.play();
      this.playing = true;
      return true;
    }

    togglePlay() {
      if (this.sourceType === 'file' && this.mediaEl) {
        if (this.mediaEl.paused) { this.mediaEl.play(); this.playing = true; }
        else { this.mediaEl.pause(); this.playing = false; }
      } else if (this.ctx) {
        // For live streams we suspend/resume the context.
        if (this.ctx.state === 'running') { this.ctx.suspend(); this.playing = false; }
        else { this.ctx.resume(); this.playing = true; }
      }
      return this.playing;
    }

    // Audio track for the AirPlay/cast stream — only for the file source
    // (never the mic, to avoid casting the room / feedback).
    getAudioTrack() {
      if (this.sourceType === 'file' && this.streamDest) {
        const tr = this.streamDest.stream.getAudioTracks();
        return tr.length ? tr[0] : null;
      }
      return null;
    }

    _binForHz(hz) {
      if (!this.ctx) return 0;
      const binHz = this.ctx.sampleRate / this.analyser.fftSize;
      return Math.max(0, Math.min(this.freq.length - 1, Math.round(hz / binHz)));
    }

    _avg(fromHz, toHz) {
      const a = this._binForHz(fromHz), b = this._binForHz(toHz);
      let sum = 0, n = 0;
      for (let i = a; i <= b; i++) { sum += this.freq[i]; n++; }
      return n ? (sum / n) / 255 : 0;
    }

    /* ---- Per-frame update ---------------------------------- */
    update() {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(this.freq);
      this.analyser.getByteTimeDomainData(this.wave);

      const bassRaw   = this._avg(20, 250);
      const midRaw    = this._avg(250, 2000);
      const trebleRaw = this._avg(2000, 9000);
      const levelRaw  = this._avg(30, 12000);

      // Auto-gain: a slowly decaying peak lets quiet input (esp. mic) fill the
      // full range, so both the visuals and beat detection stay responsive.
      this._peak = Math.max(this._peak * 0.995, levelRaw, 0.04);
      const gain = Math.min(6, 0.5 / this._peak);
      const bg = Math.min(1, bassRaw * gain);
      const mg = Math.min(1, midRaw * gain);
      const tg = Math.min(1, trebleRaw * gain);
      const lg = Math.min(1, levelRaw * gain);

      // Asymmetric smoothing: fast attack, slow release feels musical.
      const smooth = (cur, target, atk, rel) =>
        cur + (target - cur) * (target > cur ? atk : rel);
      this.bass   = smooth(this.bass,   bg, 0.6,  0.14);
      this.mid    = smooth(this.mid,    mg, 0.55, 0.16);
      this.treble = smooth(this.treble, tg, 0.65, 0.22);
      this.level  = smooth(this.level,  lg, 0.55, 0.12);

      // ---- Beat detection: spectral flux (onset) on bass energy ----
      // A beat is a sharp RISE in bass, not just loud bass — this tracks the
      // music even when the bass is sustained.
      const flux = Math.max(0, bg - this._prevBass);
      this._prevBass = bg;
      const fh = this._fluxHist;
      fh.push(flux);
      if (fh.length > 43) fh.shift();
      const avg = fh.reduce((s, v) => s + v, 0) / fh.length;
      const std = Math.sqrt(fh.reduce((s, v) => s + (v - avg) ** 2, 0) / fh.length);

      const now = performance.now();
      let fresh = false;
      if (flux > avg + std * 1.4 + 0.006 && bg > 0.12 && now - this._lastBeat > 100) {
        this._lastBeat = now;
        this.beat = 1;
        fresh = true;
      } else {
        this.beat *= 0.86; // decay to a visible pulse
      }
      return fresh; // true only on the beat's onset frame
    }
  }

  global.AudioEngine = AudioEngine;
})(window);
