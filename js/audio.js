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

      // Beat detection.
      this.beat = 0;            // decaying pulse 0..1
      this._bassHistory = [];
      this._lastBeat = 0;

      this.playing = false;
    }

    _ensureContext() {
      if (!this.ctx) {
        const AC = global.AudioContext || global.webkitAudioContext;
        this.ctx = new AC();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.75;
        this.freq = new Uint8Array(this.analyser.frequencyBinCount);
        this.wave = new Uint8Array(this.analyser.fftSize); // time-domain (oscilloscope)
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

      // Asymmetric smoothing: fast attack, slow release feels musical.
      const smooth = (cur, target, atk, rel) =>
        cur + (target - cur) * (target > cur ? atk : rel);

      this.bass   = smooth(this.bass,   bassRaw,   0.55, 0.12);
      this.mid    = smooth(this.mid,    midRaw,    0.5,  0.14);
      this.treble = smooth(this.treble, trebleRaw, 0.6,  0.2);
      this.level  = smooth(this.level,  levelRaw,  0.5,  0.1);

      // ---- Beat detection on bass energy ----
      const hist = this._bassHistory;
      hist.push(bassRaw);
      if (hist.length > 43) hist.shift();
      const localAvg = hist.reduce((s, v) => s + v, 0) / hist.length;
      const variance = hist.reduce((s, v) => s + (v - localAvg) ** 2, 0) / hist.length;
      const thresh = localAvg * (1.25 + variance * 6);

      const now = performance.now();
      if (bassRaw > thresh && bassRaw > 0.12 && now - this._lastBeat > 120) {
        this._lastBeat = now;
        this.beat = 1;
      } else {
        this.beat *= 0.90; // decay
      }
      return this.beat > 0.7 && (now - this._lastBeat) < 20; // true on fresh beat
    }
  }

  global.AudioEngine = AudioEngine;
})(window);
