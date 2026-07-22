/* ============================================================
   Audivue — WebGL visual engine
   Full-screen fragment shader with 5 audio-reactive scenes and
   cinematic post-processing (bloom-ish glow, vignette, grain,
   beat flash). Scene crossfades are driven by the director.
   ============================================================ */
(function (global) {
  'use strict';

  const SCENES = ['Tunnel', 'Nebula', 'Kaleidoscope', 'Synthwave', 'Star Warp',
                  'Aurora', 'Ridges', 'Chrome', 'Cells', 'Plasma', 'Fractal', 'Spectrum',
                  'Waveform', 'Hex', 'Rings', 'Fireflies',
                  'Vortex', 'Matrix', 'Sunburst', 'Warp'];

  const VERT = `
    attribute vec2 aPos;
    void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const FRAG = `
  precision highp float;

  uniform vec2  uRes;
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uLevel;
  uniform float uBeat;        // decaying pulse 0..1
  uniform float uHue;         // base hue 0..1
  uniform float uSat;         // saturation 0..1
  uniform float uIntensity;   // 0..1
  uniform float uScene;       // current scene index
  uniform float uSceneNext;   // next scene index (during transition)
  uniform float uTrans;       // 0..1 crossfade
  uniform float uWarp;        // camera kick 0..1
  uniform float uLook;        // film/aesthetic grade index
  uniform sampler2D uFFT;     // 1D frequency spectrum (0..1 across bins)
  uniform sampler2D uWave;    // 1D time-domain waveform (0..1, centered at 0.5)

  #define PI 3.14159265

  float fftAt(float x){ return texture2D(uFFT, vec2(clamp(x, 0.0, 1.0), 0.5)).r; }
  float waveAt(float x){ return texture2D(uWave, vec2(clamp(x, 0.0, 1.0), 0.5)).r; }

  vec3 hsv2rgb(vec3 c){
    vec3 p = abs(fract(c.xxx + vec3(0.0,2.0/3.0,1.0/3.0))*6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p-1.0,0.0,1.0), c.y);
  }
  mat2 rot(float a){ float s=sin(a), c=cos(a); return mat2(c,-s,s,c); }
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  vec2 hash2(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
  }
  float fbm(vec2 p){
    float v=0.0, a=0.5;
    for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.02; a*=0.5; }
    return v;
  }

  // ---- Scene 0: wormhole tunnel ----
  vec3 sceneTunnel(vec2 uv){
    uv *= rot(uTime*0.05);
    float r = length(uv) + 0.001;
    float a = atan(uv.y, uv.x);
    float depth = 0.35/r + uTime*0.5 + uBass*1.2;
    float rings  = 0.5 + 0.5*sin(depth*12.0);
    float spokes = 0.5 + 0.5*sin(a*(12.0 + floor(uMid*10.0)) + uTime);
    float pat = pow(rings*spokes, 1.5);
    float glow = pat*(0.5 + uLevel*1.4);
    float hue = uHue + depth*0.015 + uMid*0.08;
    vec3 col = hsv2rgb(vec3(fract(hue), uSat, glow));
    col += vec3(1.0)*pow(rings,6.0)*uTreble*0.6;      // sparkle on highs
    col *= smoothstep(0.0, 0.35, r);                   // dark core
    return col * (1.0/(r*1.4+0.35));
  }

  // ---- Scene 1: nebula flow ----
  vec3 sceneNebula(vec2 uv){
    vec2 p = uv*1.4;
    float t = uTime*0.08;
    p += 0.6*vec2(fbm(p + t + uBass), fbm(p - t + uMid));
    float f = fbm(p*1.8 + uBass*1.5);
    float f2 = fbm(p*4.0 - uTime*0.1);
    float bright = pow(f, 2.2)*(0.6 + uLevel*1.6);
    float hue = uHue + f*0.28 + f2*0.1 + uMid*0.12;
    vec3 col = hsv2rgb(vec3(fract(hue), uSat*0.95, bright));
    col += vec3(0.5,0.6,1.0)*pow(f2, 3.0)*uTreble*0.8;  // bright wisps
    return col;
  }

  // ---- Scene 2: kaleidoscope ----
  vec3 sceneKaleido(vec2 uv){
    uv *= rot(uTime*0.08 + uBass*0.5);
    float r = length(uv);
    float a = atan(uv.y, uv.x);
    float seg = 5.0 + floor(uMid*7.0);
    a = mod(a, 2.0*PI/seg);
    a = abs(a - PI/seg);
    vec2 p = vec2(cos(a), sin(a))*r;
    float pat = sin(p.x*11.0 + uTime)
              + cos(p.y*11.0 - uTime*0.7)
              + sin(r*18.0 - uTime*2.0 - uBass*5.0);
    float hue = uHue + pat*0.09 + r*0.1;
    float bright = (0.4 + 0.6*abs(sin(pat*2.0)))*(0.5 + uLevel*1.2);
    vec3 col = hsv2rgb(vec3(fract(hue), uSat, bright));
    col *= smoothstep(1.4, 0.1, r);
    return col;
  }

  // ---- Scene 3: synthwave horizon ----
  vec3 sceneGrid(vec2 uv){
    vec3 col;
    vec3 skyTop = hsv2rgb(vec3(fract(uHue+0.58), uSat, 0.35));
    vec3 skyBot = hsv2rgb(vec3(fract(uHue+0.02), uSat, 0.12));
    vec3 sky = mix(skyBot, skyTop, clamp(uv.y*0.9+0.3, 0.0, 1.0));

    if(uv.y > -0.02){
      col = sky;
      // sun with scanline slices
      float d = length((uv - vec2(0.0, 0.28)) * vec2(1.0, 1.2));
      float sun = smoothstep(0.34, 0.32, d);
      float slice = step(0.0, sin((uv.y-0.28)*70.0 + 1.0));
      float sunMask = sun * max(slice, step(0.18, uv.y-0.28));
      vec3 sunCol = mix(hsv2rgb(vec3(fract(uHue+0.02),1.0,1.0)),
                        hsv2rgb(vec3(fract(uHue+0.1),1.0,1.0)), clamp((uv.y-0.02)*2.0,0.0,1.0));
      col = mix(col, sunCol, sunMask);
      col += vec3(0.3,0.05,0.3)*uBeat*0.5;
    } else {
      float persp = 0.16/(-uv.y + 0.02);
      float gx = abs(fract(uv.x*persp*3.0) - 0.5);
      float speed = uTime*1.5 + uBass*3.0;
      float gy = abs(fract(persp*1.2 - speed) - 0.5);
      float line = smoothstep(0.06, 0.0, min(gx, gy));
      vec3 grid = hsv2rgb(vec3(fract(uHue+0.5), uSat, 1.0));
      col = mix(sky*0.15, grid, line*(0.6 + uLevel*0.9));
      col += grid*0.15*(1.0-abs(uv.x));
    }
    return col;
  }

  // ---- Scene 4: star warp ----
  vec3 sceneStars(vec2 uv){
    vec3 col = vec3(0.0);
    float warp = uTime*0.5 + uBass*1.4;
    for(int i=0;i<42;i++){
      float fi = float(i);
      float ang = hash(vec2(fi, 1.0))*2.0*PI;
      float spd = 0.5 + hash(vec2(fi, 2.0));
      float z = fract(warp*spd*0.25 + hash(vec2(fi, 3.0)));
      vec2 dir = vec2(cos(ang), sin(ang));
      vec2 sp = dir * z * z * 1.9;                 // accelerate outward from center
      vec2 d = uv - sp;
      float along = dot(d, dir);
      vec2 perp = d - dir * clamp(along, -0.18*z*(0.4+uBass), 0.0); // motion trail behind
      float dist = length(perp);
      float b = smoothstep(0.018 + 0.02*z, 0.0, dist) * (0.3 + z);
      vec3 sc = hsv2rgb(vec3(fract(uHue + hash(vec2(fi,4.0))*0.16 - 0.05), uSat*0.45, 1.0));
      col += sc * b;
    }
    // deep-space glow (kept in the blue/violet family, never muddy).
    float r = length(uv);
    col += hsv2rgb(vec3(fract(uHue+0.02), uSat*0.7, 0.07)) * (1.0 - r*0.45);
    col += vec3(1.0)*uBeat*0.15;
    return col * (0.75 + uLevel*1.1);
  }

  // ---- Scene 5: aurora (flowing domain-warped ribbons) ----
  vec3 sceneAurora(vec2 uv){
    vec2 p = uv * 1.25;
    float t = uTime * 0.12;
    // layered domain warp -> liquid, flowing motion
    vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
    vec2 r = vec2(fbm(p + 2.0*q + vec2(1.7, 9.2) + 0.15*t + uBass*0.6),
                  fbm(p + 2.0*q + vec2(8.3, 2.8) - 0.12*t));
    float f = fbm(p + 3.0*r);
    float band = 0.5 + 0.5*sin((r.x*3.0 + f*4.0 + uTime*0.5) * PI);
    float hue = uHue + f*0.25 + r.y*0.15 + uMid*0.1;
    float bright = pow(band, 1.6) * (0.5 + uLevel*1.5);
    vec3 col = hsv2rgb(vec3(fract(hue), uSat*0.9, bright));
    col += hsv2rgb(vec3(fract(hue+0.12), uSat, 1.0)) * pow(band, 6.0) * uTreble * 0.7;
    col *= 0.65 + 0.35*smoothstep(-1.0, 1.0, sin(uv.x*3.0 + r.x*4.0)); // curtain sway
    return col;
  }

  // ---- Scene 6: audio terrain (scrolling ridges) ----
  vec3 sceneRidges(vec2 uv){
    vec3 sky = mix(hsv2rgb(vec3(fract(uHue+0.5), uSat*0.7, 0.28)),
                   hsv2rgb(vec3(fract(uHue), uSat, 0.05)), clamp(uv.y*0.6+0.5, 0.0, 1.0));
    vec3 col = sky;
    for(int i=0;i<6;i++){
      float fi = float(i);
      float depth = fi / 5.0;                       // 0 = far, 1 = near
      float scroll = uTime*(0.15 + depth*0.5);
      float h = fbm(vec2(uv.x*(1.5+depth*3.0) + scroll, fi*10.0))*0.45;
      h += (uBass*0.18 + uMid*0.1)*(0.3 + depth);
      float line = (0.4 - depth*0.85) + h;          // near ridges sit lower
      float d = uv.y - line;
      float fill = smoothstep(0.012, -0.012, d);
      float shade = 0.12 + 0.55*depth;
      vec3 rc = hsv2rgb(vec3(fract(uHue + depth*0.12), uSat, shade));
      float edge = smoothstep(0.035, 0.0, abs(d))*(0.5 + uLevel*1.1);
      col = mix(col, rc, fill);
      col += hsv2rgb(vec3(fract(uHue + depth*0.12 + 0.06), uSat, 1.0))*edge*0.6;
    }
    col += vec3(1.0)*uBeat*0.05;
    return col;
  }

  // ---- Scene 7: liquid metal (flowing height-field with moving highlights) ----
  float chromeH(vec2 p, vec2 w){ return fbm(p*1.5 + 2.0*w); }
  vec3 sceneChrome(vec2 uv){
    vec2 p = uv*1.6;
    float t = uTime*0.15;
    vec2 w = vec2(fbm(p + t), fbm(p - t + 3.1)) + uBass*0.3;
    float h = chromeH(p, w);
    // surface normal from the height gradient -> lets light "roll" across it
    float e = 0.015;
    float hx = chromeH(p + vec2(e, 0.0), w) - chromeH(p - vec2(e, 0.0), w);
    float hy = chromeH(p + vec2(0.0, e), w) - chromeH(p - vec2(0.0, e), w);
    vec3 n = normalize(vec3(-hx, -hy, 0.12));
    vec3 lightDir = normalize(vec3(sin(uTime*0.3), cos(uTime*0.3), 0.85));
    float diff = clamp(dot(n, lightDir), 0.0, 1.0);
    float spec = pow(diff, 18.0);
    float hue = uHue + (0.5 + 0.5*sin(h*7.0 + uTime))*0.08 + h*0.1;
    vec3 col = hsv2rgb(vec3(fract(hue), uSat*0.55, 0.14 + 0.55*diff));
    col += vec3(1.0)*spec*(0.7 + uTreble);          // rolling chrome highlight
    return col * (0.7 + uLevel*0.7);
  }

  // ---- Scene 8: pulsing cells (voronoi) ----
  vec3 sceneCells(vec2 uv){
    vec2 p = uv*2.5 + vec2(uTime*0.1, uTime*0.07);
    vec2 g = floor(p), f = fract(p);
    float d1 = 8.0; vec2 cellId = vec2(0.0);
    for(int j=-1;j<=1;j++){
      for(int i=-1;i<=1;i++){
        vec2 o = vec2(float(i), float(j));
        vec2 pos = o + 0.5 + 0.5*sin(uTime*0.6 + 6.2831*hash2(g+o));
        float d = length(pos - f);
        if(d < d1){ d1 = d; cellId = g+o; }
      }
    }
    float rnd = hash(cellId);
    float pulse = 0.5 + 0.5*sin(uTime*2.0 + rnd*6.2831 + uBass*4.0);
    float edge = smoothstep(0.0, 0.06, d1);
    float bright = (0.2 + 0.8*pulse)*(0.4 + uLevel*1.1);
    vec3 col = hsv2rgb(vec3(fract(uHue + rnd*0.3), uSat, bright))*edge;
    col += vec3(1.0)*pow(1.0-edge, 2.0)*uTreble*0.35;   // bright cell borders on highs
    return col;
  }

  // ---- Scene 9: plasma (classic flowing color field) ----
  vec3 scenePlasma(vec2 uv){
    float t = uTime*0.5;
    vec2 p = uv*3.0;
    float v = sin(p.x + t) + sin(p.y + t*1.3)
            + sin((p.x + p.y)*0.7 + t) + sin(length(p)*1.5 - t*2.0 - uBass*3.0);
    v += uMid*2.0*sin(p.x*2.0 - t);
    float hue = uHue + v*0.08 + uTreble*0.05;
    float bright = (0.5 + 0.5*sin(v*1.5)) * (0.55 + uLevel*0.95);
    return hsv2rgb(vec3(fract(hue), uSat, bright));
  }

  // ---- Scene 10: animated Julia fractal ----
  vec3 sceneFractal(vec2 uv){
    vec2 z = uv*1.5;
    z *= rot(uTime*0.04);
    vec2 c = 0.7885*vec2(cos(uTime*0.18), sin(uTime*0.18*1.3)) * (0.92 + 0.08*uBass);
    float it = 0.0;
    for(int i=0;i<48;i++){
      z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
      if(dot(z, z) > 4.0) break;
      it += 1.0;
    }
    float m = it/48.0;
    float band = 0.5 + 0.5*sin(m*30.0 - uTime*2.0 - uBass*3.0);
    float hue = uHue + m*0.5 + uMid*0.1;
    float bright = (it >= 47.5) ? 0.0 : band*(0.5 + uLevel*1.1);
    vec3 col = hsv2rgb(vec3(fract(hue), uSat, bright));
    col += vec3(1.0)*pow(band, 8.0)*uTreble*0.4;
    return col;
  }

  // ---- Scene 11: spectrum analyzer (real FFT, mirrored bars) ----
  vec3 sceneSpectrum(vec2 uv){
    float cols = 72.0;
    float x = uv.x*0.5 + 0.5;
    float xi = floor(x*cols)/cols;
    float fx = pow(xi, 1.7)*0.42;                 // emphasize low/mid, use lower bins
    float amp = clamp(pow(fftAt(fx), 1.25)*1.25, 0.0, 1.0);
    float barH = 0.04 + amp*0.44;
    float d = abs(uv.y);
    float gap = 1.0 - smoothstep(0.30, 0.46, abs(fract(x*cols) - 0.5));
    float inside = step(d, barH)*gap;
    float edge = smoothstep(0.02, 0.0, abs(d - barH))*gap;
    float hue = uHue + xi*0.42 + amp*0.1;
    vec3 col = hsv2rgb(vec3(fract(hue), uSat, 0.45 + 0.55*amp)) * inside;
    col *= 0.55 + 0.45*(1.0 - d/(barH + 0.001));  // brighter toward center line
    col += hsv2rgb(vec3(fract(hue + 0.05), uSat, 1.0))*edge*1.3;  // glowing cap
    col += vec3(0.015, 0.015, 0.04);              // faint background
    return col;
  }

  // ---- Scene 12: waveform oscilloscope ----
  vec3 sceneWave(vec2 uv){
    float x = uv.x*0.5 + 0.5;
    float amp = (waveAt(x) - 0.5) * 1.7;
    float line = smoothstep(0.02, 0.0, abs(uv.y - amp));
    float glow = smoothstep(0.18, 0.0, abs(uv.y - amp));
    float hue = uHue + x*0.2 + abs(amp)*0.35;
    vec3 col = hsv2rgb(vec3(fract(hue), uSat, 1.0))*line;
    col += hsv2rgb(vec3(fract(hue), uSat, 1.0))*glow*0.4*(0.5 + uLevel);
    float mirror = smoothstep(0.02, 0.0, abs(uv.y + amp));   // faint reflection
    col += hsv2rgb(vec3(fract(hue+0.5), uSat, 1.0))*mirror*0.3;
    return col + vec3(0.01, 0.01, 0.03);
  }

  // ---- Scene 13: honeycomb / hex pulse ----
  vec3 sceneHex(vec2 uv){
    vec2 p = uv*5.0 + vec2(0.0, uTime*0.3);
    vec2 s = vec2(1.0, 1.7320508), h = s*0.5;
    vec2 a = mod(p, s) - h, b = mod(p - h, s) - h;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    vec2 id = p - gv;
    float r = length(gv);
    float rnd = hash(id);
    float pulse = 0.5 + 0.5*sin(uTime*3.0 + rnd*6.2831 + uBass*5.0);
    float cell = smoothstep(0.5, 0.34, r);
    float edge = smoothstep(0.5, 0.46, r)*(0.5 + uLevel*1.1);
    float hue = uHue + rnd*0.3 + pulse*0.05;
    vec3 col = hsv2rgb(vec3(fract(hue), uSat, 0.12 + 0.6*pulse))*cell;
    col += hsv2rgb(vec3(fract(hue+0.1), uSat, 1.0))*edge;
    return col;
  }

  // ---- Scene 14: radial rings / beat shockwaves ----
  vec3 sceneRings(vec2 uv){
    float r = length(uv);
    float rings = sin(r*22.0 - uTime*3.0 - uBass*10.0);
    float ring = smoothstep(0.6, 1.0, rings);
    float hue = uHue + r*0.3 + uMid*0.1;
    vec3 col = hsv2rgb(vec3(fract(hue), uSat, ring*(0.5 + uLevel*1.2)));
    float shock = smoothstep(0.06, 0.0, abs(r - uBeat*1.3))*uBeat;
    col += hsv2rgb(vec3(fract(uHue+0.1), uSat, 1.0))*shock;   // expanding beat wave
    col *= smoothstep(1.6, 0.15, r) + 0.08;
    return col;
  }

  // ---- Scene 15: fireflies (floating glow particles) ----
  vec3 sceneFireflies(vec2 uv){
    vec3 col = vec3(0.0);
    for(int i=0;i<40;i++){
      float fi = float(i);
      float sp = 0.2 + hash(vec2(fi, 1.0))*0.4;
      vec2 pos = vec2(sin(uTime*sp + fi*1.7 + hash(vec2(fi,2.0))*6.2831),
                      cos(uTime*sp*0.9 + fi*2.3 + hash(vec2(fi,3.0))*6.2831)) * 0.8;
      pos.x *= 1.6;
      float d = length(uv - pos);
      float tw = 0.5 + 0.5*sin(uTime*3.0 + fi + uBass*3.0);
      float b = smoothstep(0.055, 0.0, d)*(0.4 + 0.6*tw)*(0.5 + uLevel);
      vec3 sc = hsv2rgb(vec3(fract(uHue + hash(vec2(fi,4.0))*0.2), uSat*0.7, 1.0));
      col += sc*b + sc*smoothstep(0.16, 0.0, d)*0.12*uTreble;
    }
    col += hsv2rgb(vec3(fract(uHue+0.6), uSat*0.5, 0.05));
    return col;
  }

  // ---- Scene 16: vortex / spiral galaxy ----
  vec3 sceneVortex(vec2 uv){
    float r = length(uv) + 0.001;
    float a = atan(uv.y, uv.x);
    float arms = 2.0 + floor(uMid*4.0);
    float spiral = sin(a*arms + log(r)*6.0 - uTime*2.0 - uBass*4.0);
    float s = pow(smoothstep(0.0, 0.85, spiral), 1.5);
    float hue = uHue + r*0.2 + a*0.04;
    float bright = s*(0.45 + uLevel*1.2)*smoothstep(1.5, 0.05, r);
    vec3 col = hsv2rgb(vec3(fract(hue), uSat, bright));
    col += hsv2rgb(vec3(fract(uHue+0.1), uSat, 1.0))*smoothstep(0.14, 0.0, r)*(0.5 + uBeat);
    return col;
  }

  // ---- Scene 17: digital rain (Matrix) ----
  vec3 sceneMatrix(vec2 uv){
    float cols = 40.0;
    float x = uv.x*0.5 + 0.5;
    float colId = floor(x*cols);
    float fx = fract(x*cols);
    float speed = 0.4 + hash(vec2(colId, 1.0))*1.2;
    float t = uTime*speed + hash(vec2(colId, 2.0))*10.0;
    float yy = uv.y*0.5 + 0.5;
    float headY = 1.0 - fract(t*0.5);                 // head falls downward
    float d = yy - headY;                             // >0 = trail above head
    float trail = d > 0.0 ? exp(-d*6.0) : 0.0;
    float cellY = floor(yy*30.0);
    float flick = step(0.35, hash(vec2(colId, cellY + floor(t*8.0))));
    float bar = smoothstep(0.5, 0.16, abs(fx - 0.5));
    float v = trail*flick*bar;
    vec3 col = hsv2rgb(vec3(fract(uHue + 0.33), uSat, 1.0))*v*(0.6 + uLevel);
    col += vec3(1.0)*smoothstep(0.05, 0.0, abs(d))*flick*bar*0.85; // bright head
    return col + vec3(0.0, 0.012, 0.0);
  }

  // ---- Scene 18: sunburst rays ----
  vec3 sceneSunburst(vec2 uv){
    float r = length(uv);
    float a = atan(uv.y, uv.x);
    float rays = 12.0 + floor(uMid*14.0);
    float ray = pow(0.5 + 0.5*sin(a*rays + uTime + uBass*3.0), 2.0);
    float hue = uHue + a*0.06 + r*0.1;
    float core = smoothstep(0.45, 0.0, r);
    float bright = ray*(0.4 + uLevel)*smoothstep(1.4, 0.1, r) + core;
    vec3 col = hsv2rgb(vec3(fract(hue), uSat, bright));
    col += vec3(1.0)*core*(0.5 + uBeat*0.6);
    return col;
  }

  // ---- Scene 19: square tunnel warp ----
  vec3 sceneWarp(vec2 uv){
    uv *= rot(sin(uTime*0.1)*0.2);
    float sq = max(abs(uv.x), abs(uv.y)) + 0.001;
    float depth = 0.4/sq + uTime*0.8 + uBass*1.6;
    float rings = smoothstep(0.8, 1.0, sin(depth*8.0));
    float a = atan(uv.y, uv.x);
    float edges = 0.5 + 0.5*sin(a*8.0 + uTime);
    float hue = uHue + depth*0.02 + edges*0.05;
    float glow = rings*(0.5 + uLevel*1.2);
    vec3 col = hsv2rgb(vec3(fract(hue), uSat, glow));
    col *= smoothstep(0.0, 0.3, sq);
    return col / (sq*1.5 + 0.3);
  }

  vec3 renderScene(int idx, vec2 uv){
    if(idx==0) return sceneTunnel(uv);
    if(idx==1) return sceneNebula(uv);
    if(idx==2) return sceneKaleido(uv);
    if(idx==3) return sceneGrid(uv);
    if(idx==4) return sceneStars(uv);
    if(idx==5) return sceneAurora(uv);
    if(idx==6) return sceneRidges(uv);
    if(idx==7) return sceneChrome(uv);
    if(idx==8) return sceneCells(uv);
    if(idx==9) return scenePlasma(uv);
    if(idx==10) return sceneFractal(uv);
    if(idx==11) return sceneSpectrum(uv);
    if(idx==12) return sceneWave(uv);
    if(idx==13) return sceneHex(uv);
    if(idx==14) return sceneRings(uv);
    if(idx==15) return sceneFireflies(uv);
    if(idx==16) return sceneVortex(uv);
    if(idx==17) return sceneMatrix(uv);
    if(idx==18) return sceneSunburst(uv);
    return sceneWarp(uv);
  }

  // ---- Film / aesthetic grades applied over any scene ----
  vec3 applyLook(vec3 col, vec2 uv){
    int L = int(uLook + 0.5);
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    if(L == 1){                      // Noir — black & white photography
      float c = clamp((lum - 0.5)*1.6 + 0.5, 0.0, 1.0);
      col = vec3(c);
      col *= 1.0 - dot(uv, uv)*0.7;                 // heavy vignette
    } else if(L == 2){               // Vintage — faded sepia
      vec3 sep = vec3(dot(col, vec3(0.393,0.769,0.189)),
                      dot(col, vec3(0.349,0.686,0.168)),
                      dot(col, vec3(0.272,0.534,0.131)));
      col = mix(col, sep, 0.8);
      col = col*0.82 + 0.07;                        // lifted, milky blacks
      col *= 1.0 - dot(uv, uv)*0.4;
    } else if(L == 3){               // VHS — retro tape
      col *= 0.88 + 0.12*sin(gl_FragCoord.y*2.0);   // scanlines
      float s = 0.012 + 0.01*sin(uTime*3.0);
      float wob = sin(uv.y*22.0 + uTime*5.0);
      col.r += s*2.0*wob; col.b -= s*2.0*wob;       // chroma bleed
      float nz = hash(vec2(floor(gl_FragCoord.y*0.5), floor(uTime*30.0)));
      col += (nz - 0.5)*0.09;                       // tape noise
    } else if(L == 4){               // Pop art — saturated & posterized
      col = mix(vec3(lum), col, 1.7);
      col = floor(col*5.0 + 0.5)/5.0;
      col = clamp((col - 0.5)*1.3 + 0.5, 0.0, 1.0);
    } else if(L == 5){               // Cinematic — teal/orange + letterbox
      vec3 teal = vec3(0.10, 0.50, 0.55);
      vec3 orange = vec3(1.0, 0.66, 0.32);
      vec3 grade = mix(teal, orange, smoothstep(0.15, 0.85, lum));
      col = mix(col, col*grade*1.5, 0.6);
      if(abs(uv.y) > 0.43) col = vec3(0.0);         // widescreen bars
    }
    return col;
  }

  void main(){
    vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;

    // camera kick on beat
    float kick = 1.0 - uWarp*0.12;
    uv *= kick;
    uv += 0.006 * uWarp * vec2(sin(uTime*40.0), cos(uTime*37.0));

    vec3 col = renderScene(int(uScene + 0.5), uv);
    if(uTrans > 0.001){
      vec3 nxt = renderScene(int(uSceneNext + 0.5), uv);
      float m = smoothstep(0.0, 1.0, uTrans);
      col = mix(col, nxt, m);
      col += vec3(1.0) * (1.0 - abs(uTrans*2.0 - 1.0)) * 0.06; // flash through the cut
    }

    // ---- post ----
    col *= (0.55 + uIntensity*0.9);
    col += col*col*0.5*uIntensity;                 // cheap bloom lift
    col += vec3(1.0)*uBeat*0.05;                    // beat brightening

    // vignette
    float vig = 1.0 - dot(uv,uv)*0.35;
    col *= clamp(vig, 0.15, 1.0);

    // film grain
    float g = hash(gl_FragCoord.xy + fract(uTime)*vec2(13.0,7.0));
    col += (g - 0.5) * 0.035;

    col = applyLook(col, uv);
    col = pow(clamp(col, 0.0, 1.0), vec3(0.85)); // gentle gamma / contrast
    gl_FragColor = vec4(col, 1.0);
  }
  `;

  class Visualizer {
    constructor(canvas) {
      this.canvas = canvas;
      const opts = { antialias: false, alpha: false, powerPreference: 'high-performance' };
      this.gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
      if (!this.gl) throw new Error('WebGL is not available in this browser.');
      this._build();
      this.dpr = Math.min(global.devicePixelRatio || 1, 1.5);
      this.resize();
      global.addEventListener('resize', () => this.resize());
    }

    _compile(type, src) {
      const gl = this.gl, sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error('Shader compile error: ' + gl.getShaderInfoLog(sh));
      }
      return sh;
    }

    _build() {
      const gl = this.gl;
      const prog = gl.createProgram();
      gl.attachShader(prog, this._compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, this._compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error('Program link error: ' + gl.getProgramInfoLog(prog));
      }
      gl.useProgram(prog);
      this.prog = prog;

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const names = ['uRes','uTime','uBass','uMid','uTreble','uLevel','uBeat',
                     'uHue','uSat','uIntensity','uScene','uSceneNext','uTrans','uWarp','uLook','uFFT','uWave'];
      this.u = {};
      names.forEach(n => this.u[n] = gl.getUniformLocation(prog, n));

      // 1D data textures (updated per frame from the analyser).
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      const makeDataTex = () => {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 4, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
        return tex;
      };
      this.fftTex = makeDataTex();   // frequency spectrum
      this.waveTex = makeDataTex();  // time-domain waveform
    }

    resize() {
      const w = Math.floor(this.canvas.clientWidth * this.dpr);
      const h = Math.floor(this.canvas.clientHeight * this.dpr);
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w; this.canvas.height = h;
        this.gl.viewport(0, 0, w, h);
      }
    }

    /* Render one frame from an audio snapshot + director params. */
    render(t, audio, p) {
      const gl = this.gl, u = this.u;
      this.resize();
      gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
      gl.uniform1f(u.uTime, t);
      gl.uniform1f(u.uBass, audio.bass);
      gl.uniform1f(u.uMid, audio.mid);
      gl.uniform1f(u.uTreble, audio.treble);
      gl.uniform1f(u.uLevel, audio.level);
      const kick = p.beatKick == null ? 1 : p.beatKick;
      gl.uniform1f(u.uBeat, audio.beat * (0.5 + 0.5 * Math.min(1, kick)));
      gl.uniform1f(u.uHue, p.hue);
      gl.uniform1f(u.uSat, p.saturation);
      gl.uniform1f(u.uIntensity, p.intensity);
      gl.uniform1f(u.uScene, p.scene);
      gl.uniform1f(u.uSceneNext, p.sceneNext);
      gl.uniform1f(u.uTrans, p.transition);
      gl.uniform1f(u.uWarp, audio.beat * kick);
      gl.uniform1f(u.uLook, p.look == null ? 0 : p.look);
      // Upload the current spectrum + waveform for data-driven scenes.
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.fftTex);
      if (audio.freq && audio.freq.length) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, audio.freq.length, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, audio.freq);
      }
      gl.uniform1i(u.uFFT, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.waveTex);
      if (audio.wave && audio.wave.length) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, audio.wave.length, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, audio.wave);
      }
      gl.uniform1i(u.uWave, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  global.Visualizer = Visualizer;
  global.SCENE_NAMES = SCENES;
})(window);
