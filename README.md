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
- **Twenty-four GPU shader scenes:** Tunnel · Nebula · Kaleidoscope ·
  Synthwave · Star Warp · Aurora · Ridges · Chrome · Cells · Plasma ·
  Fractal · Spectrum (real FFT bars) · Waveform · Hex · Rings · Fireflies ·
  Vortex · Matrix · Sunburst · Warp — plus **art-movement scenes**:
  Van Gogh (Starry Night brushwork) · Pop Art (Warhol panels + halftone) ·
  Watercolor · Impressionist — each with cinematic post.
- **Art styles & film looks:** pick a movement (Van Gogh, Pop Art,
  Watercolor, Impressionist, Cyberpunk, Surreal, Renaissance, Photograph)
  or a grade (Noir, Vintage, VHS, Pop Art, Cinematic).
- **Film looks:** Noir B&W · Vintage · VHS Retro · Pop Art · Cinematic —
  an aesthetic grade layered over any scene.
- **Autopilot:** a self-running show that auto-cycles the whole look
  (genre + mood) over time — hands-free, no clicks.
- **AirPlay mode:** stream the visuals to an Apple TV. In Safari it opens
  the native AirPlay picker (canvas captured to a video); everywhere else
  it presents a clean, screen-mirror-ready fullscreen view and keeps the
  display awake (Wake Lock).
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

## 🎚️ Genres & cinematic moods

Open **🎚 Style** (or press `G`) to pick from **19 genres** (Techno, DnB, Lo-fi,
Metal, Classical, Trap, Synthwave…) and **8 cinematic moods** (Epic Build, Moody
Noir, Euphoric, Dreamy, Meditative…). Each preset changes the scene, palette,
energy, cut cadence, how hard the camera hits each beat, and whether cuts are
hard slams or dreamy dissolves. You can also just type them into the command bar
(`"epic neon techno"`, `"dreamy lofi sunset"`).

## 🔗 Embedding on your site (Webflow / Squarespace / WordPress / any builder)

Dial in a look, hit **🔗 Embed**, and copy the ready-made snippet. The current
scene, colors and energy are baked into the URL, so it renders exactly as you
set it:

```html
<iframe src="https://YOUR-DOMAIN/?scene=3&hue=86&int=80&kiosk=1"
  width="100%" height="480" style="border:0;border-radius:12px"
  allow="microphone; fullscreen; autoplay"></iframe>
```

Paste it into any site builder's **Embed / Custom HTML** block. With
`kiosk=1` the controls hide and it becomes a clean, animated hero background
(no audio needed). Add `source=mic` for a "tap for live audio" button.

**URL parameters**

| Param | Values | Purpose |
| --- | --- | --- |
| `genre` | `techno`, `drum-and-bass`, `lofi`… | Apply a genre preset |
| `mood` | `epic`, `moody`, `dreamy`… | Apply a cinematic mood |
| `scene` | `0`–`4` or name | Force a scene |
| `hue` `int` `sat` | `0`–`100` | Color / intensity / saturation |
| `cut` `kick` | number | Cut speed (s) / beat response |
| `kiosk` | `1` | Hide all controls (hero mode) |
| `autopilot` | `1` | Self-running show (auto-cycles looks) |
| `source` | `mic` `file` `display` | Preselect the audio source |

## ⌨️ Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `1`–`5` | Jump to a scene |
| `A` | Toggle Auto-Direct |
| `G` | Genre / cinematic-mood picker |
| `P` | Autopilot (self-running show) |
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
