/* ============================================================
   Audivue — WebGL visual engine
   Full-screen fragment shader with 5 audio-reactive scenes and
   cinematic post-processing (bloom-ish glow, vignette, grain,
   beat flash). Scene crossfades are driven by the director.
   ============================================================ */
(function (global) {
  'use strict';

  const SCENES = ['Tunnel', 'Nebula', 'Kaleidoscope', 'Synthwave', 'Star Warp'];

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

  #define PI 3.14159265

  vec3 hsv2rgb(vec3 c){
    vec3 p = abs(fract(c.xxx + vec3(0.0,2.0/3.0,1.0/3.0))*6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p-1.0,0.0,1.0), c.y);
  }
  mat2 rot(float a){ float s=sin(a), c=cos(a); return mat2(c,-s,s,c); }
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
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

  vec3 renderScene(int idx, vec2 uv){
    if(idx==0) return sceneTunnel(uv);
    if(idx==1) return sceneNebula(uv);
    if(idx==2) return sceneKaleido(uv);
    if(idx==3) return sceneGrid(uv);
    return sceneStars(uv);
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
                     'uHue','uSat','uIntensity','uScene','uSceneNext','uTrans','uWarp'];
      this.u = {};
      names.forEach(n => this.u[n] = gl.getUniformLocation(prog, n));
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
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  global.Visualizer = Visualizer;
  global.SCENE_NAMES = SCENES;
})(window);
