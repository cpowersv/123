/* ============================================================
   Audivue — Cinematic command parser
   Turns a free-text mood ("midnight neon city") into visual
   direction: palette hue, saturation, intensity, preferred
   scene, and how aggressively the director cuts.
   ============================================================ */
(function (global) {
  'use strict';

  // Scene indices must match visualizer.js SCENES order.
  const SCENE = { TUNNEL: 0, NEBULA: 1, KALEIDO: 2, GRID: 3, STARS: 4 };

  // Each rule: keywords -> partial params to merge.
  // hue is 0..1 (0=red, .33=green, .55=cyan, .66=blue, .75=purple, .9=pink).
  const RULES = [
    // ---- palettes / moods ----
    { keys: ['neon', 'cyber', 'cyberpunk', 'city', 'night', 'midnight', 'noir'],
      p: { hue: 0.78, saturation: 1.0, intensity: 0.85 } },
    { keys: ['ocean', 'water', 'sea', 'deep', 'underwater', 'aqua', 'wave'],
      p: { hue: 0.54, saturation: 0.8, intensity: 0.55, scene: SCENE.NEBULA } },
    { keys: ['sunset', 'sunrise', 'dawn', 'dusk', 'warm', 'gold', 'golden', 'amber', 'desert'],
      p: { hue: 0.07, saturation: 0.9, intensity: 0.65 } },
    { keys: ['forest', 'nature', 'green', 'jungle', 'earth', 'moss'],
      p: { hue: 0.33, saturation: 0.75, intensity: 0.6 } },
    { keys: ['fire', 'lava', 'red', 'blood', 'hot', 'ember', 'inferno'],
      p: { hue: 0.02, saturation: 1.0, intensity: 0.9 } },
    { keys: ['ice', 'winter', 'snow', 'frost', 'cold', 'arctic', 'mono', 'white', 'grey', 'gray'],
      p: { hue: 0.55, saturation: 0.18, intensity: 0.5 } },
    { keys: ['space', 'cosmic', 'galaxy', 'star', 'stars', 'nebula', 'cosmos', 'interstellar', 'void'],
      p: { hue: 0.66, saturation: 0.7, intensity: 0.7, scene: SCENE.STARS } },
    { keys: ['dream', 'dreamy', 'cloud', 'ethereal', 'soft', 'pastel', 'floaty'],
      p: { hue: 0.83, saturation: 0.5, intensity: 0.5, scene: SCENE.NEBULA } },
    { keys: ['retro', 'synthwave', 'synth', '80s', 'eighties', 'vaporwave', 'outrun'],
      p: { hue: 0.86, saturation: 0.95, intensity: 0.75, scene: SCENE.GRID } },
    { keys: ['pink', 'magenta', 'candy', 'bubblegum'], p: { hue: 0.9, saturation: 0.9 } },
    { keys: ['purple', 'violet', 'royal'], p: { hue: 0.75, saturation: 0.9 } },
    { keys: ['blue', 'sky', 'azure'], p: { hue: 0.62, saturation: 0.85 } },
    { keys: ['yellow', 'sun', 'lemon'], p: { hue: 0.15, saturation: 0.95 } },

    // ---- energy / pace ----
    { keys: ['rave', 'party', 'strobe', 'club', 'edm', 'hype', 'wild', 'crazy', 'insane'],
      p: { intensity: 1.0, saturation: 1.0, cutSpeed: 3.5, autoDirect: true } },
    { keys: ['aggressive', 'intense', 'hard', 'heavy', 'rage', 'brutal', 'metal', 'fast', 'energetic'],
      p: { intensity: 1.0, cutSpeed: 4.5, autoDirect: true } },
    { keys: ['chill', 'calm', 'relax', 'ambient', 'slow', 'mellow', 'lofi', 'lo-fi', 'peaceful', 'gentle', 'zen', 'smooth'],
      p: { intensity: 0.42, cutSpeed: 16, saturation: 0.7 } },
    { keys: ['epic', 'cinematic', 'grand', 'orchestral', 'movie', 'film'],
      p: { intensity: 0.8, cutSpeed: 9 } },

    // ---- explicit scene names ----
    { keys: ['tunnel', 'wormhole', 'warp', 'vortex'], p: { scene: SCENE.TUNNEL } },
    { keys: ['kaleidoscope', 'kaleido', 'mandala', 'mirror', 'symmetry', 'geometric'],
      p: { scene: SCENE.KALEIDO } },
    { keys: ['grid', 'horizon', 'road'], p: { scene: SCENE.GRID } },
  ];

  function parseCommand(text) {
    const t = (' ' + text.toLowerCase() + ' ').replace(/[^a-z0-9\-\s]/g, ' ');
    const out = {};
    let matched = 0;

    for (const rule of RULES) {
      for (const k of rule.keys) {
        if (t.includes(' ' + k + ' ') || t.includes(' ' + k + 's ')) {
          Object.assign(out, rule.p);
          matched++;
          break;
        }
      }
    }

    // Modifier words nudge intensity/pace even without a full match.
    if (/\bmore\b|\bmega\b|\bultra\b|\bmax\b/.test(t)) out.intensity = Math.min(1, (out.intensity ?? 0.8) + 0.15);
    if (/\bless\b|\bsofter\b|\bsubtle\b/.test(t)) out.intensity = Math.max(0.2, (out.intensity ?? 0.6) - 0.2);

    return { params: out, matched };
  }

  global.Commands = { parseCommand, SCENE };
})(window);
