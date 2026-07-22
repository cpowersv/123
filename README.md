# 🎛️ Audivue

**Real-time music-video engine for your TV.** Turn on the TV, play music, type a
mood, and Audivue auto-directs a cinematic, audio-reactive visual — no rendering,
no export, just live optics driven by the sound in the room.

It's a single self-contained web app (no build step, no dependencies, no server
required). Open `index.html` and go.

---

## ✨ What it does

- **Reacts to real audio in real time.** A Web Audio FFT splits the sound into
  **bass / mid / treble / level** and detects **beats**, which drive everything
  on screen.
- **Five GPU shader scenes:** Wormhole Tunnel · Nebula · Kaleidoscope ·
  Synthwave Horizon · Star Warp — each with cinematic post (glow/bloom,
  vignette, film grain, beat-flash).
- **Cinematic Director.** In Auto mode it kicks the camera on beats and *cuts*
  between scenes in time with the music, like a VJ editing live.
- **Cinematic commands.** Type a vibe and it re-directs the whole look:
  - `midnight neon city` · `calm ocean sunrise` · `aggressive neon rave`
  - `chill deep space` · `retro synthwave` · `fire rage` · `dreamy pastel clouds`
  - Words map to **palette + scene + intensity + cut speed**.
- **TV mode.** Fullscreen, auto-hiding controls and cursor, keyboard-driven.

## 🔊 Audio sources

| Source | Best for |
| --- | --- |
| 🎙️ **Microphone** | A room with speakers — point the mic at them. Zero setup. |
| 🎵 **Music file** | Play a local audio file directly through the app. |
| 🖥️ **Tab / system audio** | Share a browser tab (Spotify/YouTube) *with audio*. |

> The mic is never routed back to your speakers, so there's no feedback.

## 🚀 Run it

Just open the app — no install:

```bash
# easiest: double-click index.html, or serve it locally
python3 -m http.server 8000
# then visit http://localhost:8000
```

Pick an audio source on the welcome screen, then type a mood and hit **Go**.

## ⌨️ Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `1`–`5` | Jump to a scene |
| `A` | Toggle Auto-Direct |
| `←` / `→` | Shift color |
| `/` | Focus the command bar |
| `F` | Fullscreen (TV mode) |
| `H` | Hide / show the interface |

## 🧩 How it's built

Vanilla JS + a single WebGL fragment shader — no frameworks, no CDNs.

```
index.html          UI shell
styles.css          cinematic UI styling
js/audio.js         Web Audio FFT + beat detection (sources: mic/file/display)
js/commands.js      mood-phrase → visual-direction parser
js/visualizer.js    WebGL engine + the 5 scene shaders + post-processing
js/director.js      live params, easing, and beat-synced scene cutting
js/app.js           wiring, render loop, keyboard, fullscreen, idle-hide
```

## Browser support

Any recent Chrome, Edge, Firefox, or Safari with WebGL and the Web Audio API.
For the smoothest optics on a TV, use a browser with hardware acceleration on.
