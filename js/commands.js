/* ============================================================
   Audivue — Cinematic command parser + preset library
   Turns free text ("techno", "epic neon build") OR a picked
   chip into visual direction: palette, scene, intensity, beat
   response and how the director cuts.

   Param vocabulary (all optional in a preset):
     hue          0..1  base color (0=red .33=green .55=cyan .66=blue .75=purple .9=pink)
     saturation   0..1
     intensity    0..1  overall brightness / energy
     scene        0..4  preferred scene (see SCENE)
     cutSpeed     sec   avg seconds between auto scene cuts (lower = faster)
     beatKick     0..1.6 how hard the camera reacts to each beat
     transDur     sec   crossfade length (low = hard cut, high = dreamy dissolve)
     autoDirect   bool
   ============================================================ */
(function (global) {
  'use strict';

  const SCENE = { TUNNEL: 0, NEBULA: 1, KALEIDO: 2, GRID: 3, STARS: 4 };

  /* ---- Genres: each maps the "feel" of a style to visuals ---- */
  const GENRES = [
    { name: 'House',       keys: ['house', 'deep house'],
      p: { scene: SCENE.KALEIDO, hue: 0.78, saturation: 0.95, intensity: 0.8, cutSpeed: 6, beatKick: 1.0, transDur: 1.0 } },
    { name: 'Techno',      keys: ['techno', 'minimal'],
      p: { scene: SCENE.TUNNEL, hue: 0.62, saturation: 0.55, intensity: 0.9, cutSpeed: 5, beatKick: 1.1, transDur: 0.7 } },
    { name: 'Trance',      keys: ['trance', 'progressive'],
      p: { scene: SCENE.NEBULA, hue: 0.66, saturation: 0.9, intensity: 0.8, cutSpeed: 10, beatKick: 0.9, transDur: 1.6 } },
    { name: 'EDM / Festival', keys: ['edm', 'festival', 'big room', 'mainstage'],
      p: { scene: SCENE.TUNNEL, hue: 0.75, saturation: 1.0, intensity: 1.0, cutSpeed: 4, beatKick: 1.4, transDur: 0.8 } },
    { name: 'Dubstep / Bass', keys: ['dubstep', 'bass', 'riddim', 'brostep'],
      p: { scene: SCENE.TUNNEL, hue: 0.75, saturation: 1.0, intensity: 1.0, cutSpeed: 4, beatKick: 1.6, transDur: 0.6 } },
    { name: 'Drum & Bass', keys: ['dnb', 'drum and bass', 'drum n bass', 'jungle', 'breakbeat', 'neurofunk'],
      p: { scene: SCENE.STARS, hue: 0.4, saturation: 0.9, intensity: 0.95, cutSpeed: 3.5, beatKick: 1.5, transDur: 0.6 } },
    { name: 'Trap',        keys: ['trap', 'phonk'],
      p: { scene: SCENE.KALEIDO, hue: 0.8, saturation: 1.0, intensity: 0.9, cutSpeed: 5, beatKick: 1.4, transDur: 0.7 } },
    { name: 'Hip-Hop',     keys: ['hip hop', 'hiphop', 'rap', 'boom bap'],
      p: { scene: SCENE.GRID, hue: 0.09, saturation: 0.9, intensity: 0.75, cutSpeed: 6, beatKick: 1.2, transDur: 0.9 } },
    { name: 'Lo-fi',       keys: ['lofi', 'lo-fi', 'chillhop', 'chill hop'],
      p: { scene: SCENE.NEBULA, hue: 0.08, saturation: 0.55, intensity: 0.42, cutSpeed: 16, beatKick: 0.4, transDur: 2.0 } },
    { name: 'Ambient',     keys: ['ambient', 'drone'],
      p: { scene: SCENE.NEBULA, hue: 0.6, saturation: 0.5, intensity: 0.35, cutSpeed: 22, beatKick: 0.25, transDur: 2.2 } },
    { name: 'Pop',         keys: ['pop', 'dance pop'],
      p: { scene: SCENE.KALEIDO, hue: 0.9, saturation: 0.9, intensity: 0.8, cutSpeed: 6, beatKick: 1.1, transDur: 1.0 } },
    { name: 'Rock',        keys: ['rock', 'punk', 'indie', 'alt'],
      p: { scene: SCENE.GRID, hue: 0.03, saturation: 0.85, intensity: 0.85, cutSpeed: 6, beatKick: 1.2, transDur: 0.8 } },
    { name: 'Metal',       keys: ['metal', 'hardcore', 'thrash', 'djent'],
      p: { scene: SCENE.TUNNEL, hue: 0.0, saturation: 0.9, intensity: 1.0, cutSpeed: 4, beatKick: 1.6, transDur: 0.6 } },
    { name: 'Jazz / Soul', keys: ['jazz', 'blues', 'soul', 'funk soul'],
      p: { scene: SCENE.NEBULA, hue: 0.07, saturation: 0.7, intensity: 0.5, cutSpeed: 12, beatKick: 0.7, transDur: 1.6 } },
    { name: 'Classical',   keys: ['classical', 'orchestral', 'orchestra', 'score', 'soundtrack', 'piano'],
      p: { scene: SCENE.STARS, hue: 0.62, saturation: 0.7, intensity: 0.7, cutSpeed: 12, beatKick: 0.7, transDur: 2.0 } },
    { name: 'Funk / Disco', keys: ['funk', 'disco', 'groove', 'nu-disco'],
      p: { scene: SCENE.KALEIDO, hue: 0.12, saturation: 1.0, intensity: 0.85, cutSpeed: 5, beatKick: 1.2, transDur: 0.9 } },
    { name: 'Reggae / Dub', keys: ['reggae', 'dub', 'dancehall', 'ska'],
      p: { scene: SCENE.GRID, hue: 0.3, saturation: 0.85, intensity: 0.7, cutSpeed: 8, beatKick: 1.0, transDur: 1.1 } },
    { name: 'Synthwave',   keys: ['synthwave', 'retrowave', 'outrun', 'vaporwave'],
      p: { scene: SCENE.GRID, hue: 0.86, saturation: 0.95, intensity: 0.8, cutSpeed: 8, beatKick: 1.0, transDur: 1.0 } },
    { name: 'R&B',         keys: ['r&b', 'rnb', 'r and b'],
      p: { scene: SCENE.NEBULA, hue: 0.83, saturation: 0.75, intensity: 0.6, cutSpeed: 10, beatKick: 0.9, transDur: 1.4 } },
  ];

  /* ---- Cinematic desires: overlay the "director's intent" ---- */
  const CINEMATIC = [
    { name: 'Epic Build',  keys: ['epic', 'build', 'buildup', 'grand', 'anthemic', 'cinematic'],
      p: { intensity: 0.85, cutSpeed: 11, beatKick: 1.1, transDur: 1.8 } },
    { name: 'Euphoric',    keys: ['euphoric', 'uplifting', 'happy', 'joy', 'joyful'],
      p: { intensity: 1.0, saturation: 1.0, cutSpeed: 5, beatKick: 1.3, transDur: 0.9 } },
    { name: 'Moody Noir',  keys: ['moody', 'noir', 'dark', 'brooding', 'melancholy', 'sad', 'somber'],
      p: { intensity: 0.45, saturation: 0.4, cutSpeed: 14, beatKick: 0.6, transDur: 1.6 } },
    { name: 'Dreamy',      keys: ['dreamy', 'hypnotic', 'trippy', 'psychedelic', 'floaty'],
      p: { scene: SCENE.KALEIDO, intensity: 0.7, saturation: 0.9, cutSpeed: 12, beatKick: 0.6, transDur: 2.0 } },
    { name: 'Aggressive',  keys: ['aggressive', 'strobe', 'brutal', 'mosh', 'rave', 'hype', 'wild'],
      p: { intensity: 1.0, saturation: 1.0, cutSpeed: 3, beatKick: 1.6, transDur: 0.5 } },
    { name: 'Meditative',  keys: ['meditative', 'calm', 'serene', 'peaceful', 'zen', 'spa', 'relax', 'chill'],
      p: { intensity: 0.35, saturation: 0.7, cutSpeed: 20, beatKick: 0.25, transDur: 2.2 } },
    { name: 'Nostalgic',   keys: ['nostalgic', 'retro', 'vintage', '80s', 'eighties'],
      p: { scene: SCENE.GRID, hue: 0.86, intensity: 0.7, cutSpeed: 9, beatKick: 0.9, transDur: 1.1 } },
    { name: 'Romantic',    keys: ['romantic', 'love', 'intimate', 'tender'],
      p: { hue: 0.95, saturation: 0.7, intensity: 0.55, cutSpeed: 12, beatKick: 0.7, transDur: 1.6 } },
  ];

  /* ---- General palette / color moods (lightweight modifiers) ---- */
  const MOODS = [
    { keys: ['neon', 'cyber', 'cyberpunk', 'city', 'night', 'midnight'], p: { hue: 0.78, saturation: 1.0 } },
    { keys: ['ocean', 'water', 'sea', 'deep', 'aqua', 'wave'], p: { hue: 0.54, saturation: 0.8 } },
    { keys: ['sunset', 'sunrise', 'dawn', 'dusk', 'warm', 'gold', 'golden', 'amber', 'desert'], p: { hue: 0.07, saturation: 0.9 } },
    { keys: ['forest', 'nature', 'green', 'jungle', 'moss'], p: { hue: 0.33, saturation: 0.75 } },
    { keys: ['fire', 'lava', 'red', 'blood', 'ember', 'inferno'], p: { hue: 0.02, saturation: 1.0 } },
    { keys: ['ice', 'winter', 'snow', 'frost', 'cold', 'arctic', 'mono', 'white', 'grey', 'gray'], p: { hue: 0.55, saturation: 0.18 } },
    { keys: ['space', 'cosmic', 'galaxy', 'star', 'stars', 'cosmos', 'interstellar', 'void'], p: { hue: 0.66, saturation: 0.7, scene: SCENE.STARS } },
    { keys: ['pink', 'magenta', 'candy'], p: { hue: 0.9, saturation: 0.9 } },
    { keys: ['purple', 'violet'], p: { hue: 0.75, saturation: 0.9 } },
    { keys: ['blue', 'sky', 'azure'], p: { hue: 0.62, saturation: 0.85 } },
    { keys: ['yellow', 'sun', 'lemon'], p: { hue: 0.15, saturation: 0.95 } },
    { keys: ['tunnel', 'wormhole', 'warp', 'vortex'], p: { scene: SCENE.TUNNEL } },
    { keys: ['nebula', 'cloud', 'smoke'], p: { scene: SCENE.NEBULA } },
    { keys: ['kaleidoscope', 'kaleido', 'mandala', 'mirror', 'symmetry', 'geometric'], p: { scene: SCENE.KALEIDO } },
    { keys: ['grid', 'horizon', 'road'], p: { scene: SCENE.GRID } },
  ];

  // Longer keys first so "drum and bass" wins over "bass".
  function sortByKeyLen(list) {
    return list.slice().sort((a, b) => Math.max(...b.keys.map(k => k.length)) - Math.max(...a.keys.map(k => k.length)));
  }
  const ALL = sortByKeyLen([...GENRES, ...CINEMATIC, ...MOODS]);

  function parseCommand(text) {
    // Normalize, then match longest phrases first, consuming each match so a
    // substring (e.g. "bass" inside "drum and bass") can't re-trigger a rule.
    let t = (' ' + text.toLowerCase() + ' ').replace(/[^a-z0-9&\-\s]/g, ' ').replace(/\s+/g, ' ');
    const out = {};
    let matched = 0;
    for (const rule of ALL) {
      for (const k of rule.keys) {
        if (t.includes(' ' + k + ' ') || t.includes(' ' + k + 's ')) {
          Object.assign(out, rule.p);
          matched++;
          t = t.split(' ' + k + 's ').join('  ').split(' ' + k + ' ').join('  ');
          break;
        }
      }
    }
    if (/\b(more|mega|ultra|max|harder)\b/.test(t)) out.intensity = Math.min(1, (out.intensity ?? 0.8) + 0.15);
    if (/\b(less|softer|subtle|gentle)\b/.test(t)) out.intensity = Math.max(0.2, (out.intensity ?? 0.6) - 0.2);
    if (/\b(fast|faster|quick)\b/.test(t)) out.cutSpeed = Math.max(3, (out.cutSpeed ?? 8) * 0.6);
    if (/\b(slow|slower|smooth)\b/.test(t)) out.cutSpeed = (out.cutSpeed ?? 8) * 1.6;
    return { params: out, matched };
  }

  global.Commands = { parseCommand, SCENE, GENRES, CINEMATIC };
})(window);
