/* "Transmitter" CRT rendering of the hero portrait (WebGL): chunky Bayer-dithered phosphor blocks with continuous liquid waves,
   per-scanline drift, slow surges that tear, stretch, tilt, and dissolve the picture, phosphor bloom, color fringes, and grain. */
(() => {
  'use strict';
  const PALETTES = { yellow: '#ffd400', orange: '#ff5a00', cyan: '#00e5ff', lime: '#39ff14', blue: '#004cff' };
  const SIGNAL_KEY = 'sa-wave-signal';
  const FRAME_MS = 1000 / 60;
  const PUSH_IN_S = 9;
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const STILL = { time: 0, surge: 0, amp: 0, tear: 0, stretch: 1, anchor: .5, rot: 0, skew: 0, dissolve: 0, ca: 2, roll: -9, grain: 0 };
  const REST = { zoom: 1, x: 0, y: 0, rot: 0 };
  const UNIFORMS = ['uImage', 'uRes', 'uFit', 'uRatio', 'uCell', 'uTime', 'uAmp', 'uTear', 'uStretch', 'uAnchor', 'uRot', 'uSkew', 'uDissolve', 'uCa', 'uRoll', 'uGrain', 'uCam', 'uInk', 'uSwitch'];

  const VERTEX = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}';
  const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uImage;
uniform vec2 uRes, uFit;
uniform float uRatio, uCell, uTime, uAmp, uTear, uStretch, uAnchor, uRot, uSkew, uDissolve, uCa, uRoll, uGrain;
uniform vec4 uCam;
uniform vec3 uInk;
uniform float uSwitch;

float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(float x) { float i = floor(x), f = fract(x); return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f)) * 2.0 - 1.0; }
float bayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
mat2 turn(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

// Screen position (0..1, y down) to portrait image coordinates: tube bulge, then the signal, then the camera.
vec2 trace(vec2 uv, out float lit) {
  vec2 c = uv - 0.5;
  c *= 1.0 + 0.16 * dot(c, c);
  uv = c + 0.5;
  lit = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  float aspect = uRes.x / uRes.y;
  // Each 3 CSS px raster line drifts sideways; a few bands tear far and slide back.
  float row = floor(uv.y * uRes.y / uRatio / 3.0);
  float flow = sin(uv.y * 15.0 - uTime * 0.95) + 0.45 * sin(uv.y * 31.0 + uTime * 0.65);
  float dx = (flow * 1.35 + noise(row * 0.045 + uTime * 0.32) * 0.45 + noise(row * 0.55 + uTime * 1.3) * 0.15) * uAmp;
  float beat = uTime * 0.55;
  float band = floor(row / 8.0) + floor(beat) * 31.0;
  dx += step(1.0 - 0.22 * uTear, hash(band)) * (hash(band + 7.1) * 2.0 - 1.0) * 70.0 * sin(3.14159 * fract(beat)) * uTear;
  vec2 q = vec2((uv.x + dx * uRatio / uRes.x) * aspect, uv.y);
  // Dissolve: diagonal strips slide along their length and some drop out.
  float strip = floor((q.x - q.y) * 38.0);
  q += vec2(0.7071) * (hash(strip) * 2.0 - 1.0 + 0.6 * noise(strip * 0.3 + uTime * 0.8)) * 0.22 * uDissolve;
  lit *= 1.0 - uDissolve * smoothstep(0.1, 0.65, noise(strip * 0.24 + uTime * 0.3));
  q.y += sin(q.x * 9.0 + uTime * 0.65) * uAmp * 0.00055;
  q -= vec2(0.5 * aspect, 0.5);
  q = turn(uRot) * q;
  q.x += q.y * uSkew;
  q.y = (q.y - (uAnchor - 0.5)) / uStretch + (uAnchor - 0.5);
  q = turn(uCam.w) * q;
  q = (q - uCam.yz * vec2(aspect, 1.0)) / uCam.x;
  q.x /= aspect;
  return q * uFit + 0.5;
}

// One dithered phosphor dot: posterize to four levels with a 4x4 Bayer threshold, on a fixed cell grid.
float level(vec2 frag, out float glow) {
  vec2 cell = floor(frag / uCell);
  vec2 local = frag / uCell - cell;
  float lit;
  vec2 st = trace((cell + 0.5) * uCell / uRes, lit);
  lit *= step(0.0, st.x) * step(st.x, 1.0) * step(0.0, st.y) * step(st.y, 1.0);
  vec4 texel = texture2D(uImage, st);
  glow = texel.a * lit;
  float tone = pow(mix(texel.r, texel.a, uDissolve * 0.7), 1.1) * 1.12 * lit;
  float q = clamp(floor(tone * 3.0 + bayer4(cell)) / 3.0, 0.0, 1.0);
  return q * mix(1.0, 0.5, step(0.78, local.x));
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 uv = frag / uRes;
  float glow, spare;
  float g = level(frag, glow);
  float r = level(frag - vec2(uCa, 0.0), spare);
  float b = level(frag + vec2(uCa, 0.0), spare);
  // Electric-blue shadows rise through cyan into white-hot cores. The other inks keep their hue.
  float blue = step(uInk.g * 1.5, uInk.b);
  vec3 hot = mix(min(vec3(1.0), uInk + 0.12), vec3(0.13, 1.0, 1.0), blue);
  vec3 col = mix(uInk * uInk * 0.28, uInk, smoothstep(0.0, 0.55, g));
  col = mix(col, hot, smoothstep(0.45, 0.85, g));
  col = mix(col, vec3(1.0), smoothstep(0.82, 1.0, g) * 0.65) * smoothstep(0.0, 0.18, g);
  col += vec3(1.0, 0.15, 0.35) * max(r - g, 0.0) * 0.6 + vec3(0.25, 0.4, 1.0) * max(b - g, 0.0) * 0.6;
  float bloom = smoothstep(0.2, 0.8, glow);
  col += uInk * bloom * 0.55 + hot * bloom * bloom * 0.28;
  // Background grid; it pushes in more slowly than the portrait, so the two separate in depth.
  vec2 cssPos = (uv - 0.5) / mix(1.0, uCam.x, 0.4) * uRes / uRatio;
  vec2 dist = abs(fract(cssPos / 24.0 + 0.5) - 0.5) * 24.0;
  float line = 1.0 - smoothstep(0.0, 0.9, min(dist.x, dist.y));
  col += uInk * line * 0.08 * (1.0 - g);
  float roll = (uv.y - uRoll) / 0.07;
  col += uInk * exp(-roll * roll) * (0.035 + 0.18 * g);
  vec2 v = uv - 0.5;
  col *= clamp(1.0 - dot(v, v) * 1.25, 0.0, 1.0);
  col += (hash2(frag + fract(uTime * 7.31) * 97.0) - 0.5) * uGrain;
  col = col * (1.0 - uSwitch * 0.75) + uInk * hash2(floor(frag / uRatio) + fract(uTime) * 57.0) * uSwitch * 0.28;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

  function generator(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  async function decodePortrait(source) {
    const bytes = Uint8Array.from(atob(source.data), c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
    const values = new Uint8Array(await new Response(stream).arrayBuffer());
    if (values.length !== source.width * source.height) throw new Error('Portrait grid has the wrong size');
    return { width: source.width, height: source.height, values };
  }

  function blur(values, width, height, radius) {
    const pass = (input, horizontal) => {
      const output = new Float32Array(input.length);
      const span = horizontal ? width : height, lines = horizontal ? height : width;
      for (let line = 0; line < lines; line++) {
        let sum = 0;
        const at = i => input[horizontal ? line * width + i : i * width + line];
        for (let i = -radius; i <= radius; i++) sum += at(Math.min(span - 1, Math.max(0, i)));
        for (let i = 0; i < span; i++) {
          output[horizontal ? line * width + i : i * width + line] = sum / (radius * 2 + 1);
          sum += at(Math.min(span - 1, i + radius + 1)) - at(Math.max(0, i - radius));
        }
      }
      return output;
    };
    return pass(pass(values, true), false);
  }

  // Luminance holds the photo, alpha a blurred copy that feeds the bloom and the dissolve smear.
  function texels({ width, height, values }) {
    const soft = blur(blur(values, width, height, 4), width, height, 4);
    const out = new Uint8Array(values.length * 2);
    for (let i = 0; i < values.length; i++) { out[i * 2] = values[i]; out[i * 2 + 1] = Math.min(255, soft[i]); }
    return out;
  }

  const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

  // Surges start every 6-10 s from a fixed seed, so a given running time always yields the same signal.
  class Signal {
    constructor(seed) { this.random = generator(seed); this.surges = []; this.next = 6 + this.random() * 4; }

    plan(until) {
      const r = this.random;
      while (this.next <= until) {
        const attack = 1.4 + r() * .6, hold = .4 + r() * .8, release = 2 + r() * .6;
        this.surges.push({
          start: this.next, attack, hold, release, end: this.next + attack + hold + release,
          stretch: 1.5 + r() * .4, anchor: .3 + r() * .4,
          tilt: (r() < .5 ? -1 : 1) * (.8 + r() * 1.1), skew: (r() < .5 ? -1 : 1) * (.5 + r() * .9),
          dissolve: this.surges.length % 3 === 1
        });
        this.next += 6 + r() * 4;
      }
    }

    envelope(surge, t) {
      if (!surge || t <= surge.start) return 0;
      const s = t - surge.start;
      if (s < surge.attack) return smooth(s / surge.attack);
      if (s < surge.attack + surge.hold) return 1;
      return smooth(1 - (s - surge.attack - surge.hold) / surge.release);
    }

    at(t) {
      this.plan(t);
      let lo = 0, hi = this.surges.length - 1, found = null;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (this.surges[mid].start <= t) { found = this.surges[mid]; lo = mid + 1; } else hi = mid - 1;
      }
      const e = this.envelope(found, t), lag = this.envelope(found, t - .5);
      const lfo = .5 + .5 * Math.sin(t * TAU / 17) * Math.cos(t * TAU / 43);
      return {
        time: t % 600, surge: e,
        amp: 18 + 8 * lfo + 20 * e,
        tear: .12 + .88 * e,
        stretch: 1 + (found ? found.stretch - 1 : 0) * lag,
        anchor: found ? found.anchor : .5,
        rot: (Math.sin(t * TAU / 29) + (found ? found.tilt : 0) * e) * DEG,
        skew: Math.tan((.8 * Math.sin(t * TAU / 37 + 1) + (found ? found.skew : 0) * e) * DEG),
        dissolve: found && found.dissolve ? e * e : 0,
        ca: 2 + 2 * e,
        roll: (t / 8.5) % 1 * 1.5 - .25,
        grain: .05
      };
    }
  }

  // First-view push-in: drifts in from slightly zoomed out with a little handheld wobble, then settles.
  function camera(t) {
    const p = Math.min(1, t / PUSH_IN_S), e = 1 - (1 - p) ** 3, shake = (1 - e) ** 1.5;
    const wobble = (a, b, c) => Math.sin(t * a) * .6 + Math.sin(t * b + 1.3) * .3 + Math.sin(t * c + 2.1) * .1;
    return {
      zoom: .82 + .18 * e,
      x: (1 - e) * .025 + shake * .012 * wobble(1.1, 2.7, 5.3),
      y: (1 - e) * .03 + shake * .01 * wobble(.9, 2.3, 4.7),
      rot: shake * .8 * DEG * wobble(.7, 1.9, 3.1)
    };
  }

  // options.palette and options.motion ('on' | 'off') restore saved choices; options.persist saves new ones.
  class CrtPortrait {
    constructor(canvas, source, media, options = {}) {
      this.canvas = canvas;
      this.media = media;
      this.persist = !!options.persist;
      this.motion = options.motion === 'on' || options.motion === 'off' ? options.motion : null;
      this.figure = canvas.closest('[data-crt-portrait]');
      this.timeline = new Signal(20261107);
      this.palette = options.palette === 'custom' && window.PortfolioColor ? 'custom' : Object.hasOwn(PALETTES, options.palette) ? options.palette : 'blue';
      this.ink = rgb(this.palette === 'custom' ? PortfolioColor.current.ink : PALETTES[this.palette]);
      this.gl = null; this.gpu = null; this.drawn = false; this.linking = false; this.links = 0;
      this.raf = 0; this.idle = 0; this.last = 0; this.clock = 0; this.visible = false;
      this.width = this.height = 0; this.ratio = 1;
      this.tick = time => {
        this.raf = 0;
        if (!this.running()) { this.update(); return; }
        // Cap near 60 fps on high-refresh displays; the clock only advances while frames are drawn.
        if (time - this.last >= FRAME_MS * .8) {
          if (this.last) this.clock += Math.min(.1, (time - this.last) / 1000);
          this.last = time;
          this.draw();
        }
        this.raf = requestAnimationFrame(this.tick);
      };
      if (!source || typeof DecompressionStream === 'undefined') { canvas.dataset.crt = 'unavailable'; return; }
      canvas.dataset.crt = 'loading';
      const extras = options.channels ? window.PORTFOLIO_CHANNELS || [] : [];
      this.ready = Promise.all([source, ...extras].map(decodePortrait)).then(grids => {
        this.grid = grids[0]; this.texels = texels(this.grid);
        this.channels = grids.map((grid,i) => ({ grid, texels: i ? texels(grid) : this.texels, name: ['SHUAIB AHMED','ROUTER // L3','SWITCH // L2'][i] }));
        this.channelIndex = -1;
        this.resize();
      }).catch(() => this.fail());
      if (typeof ResizeObserver === 'function') new ResizeObserver(() => this.resize()).observe(canvas);
      if (typeof IntersectionObserver === 'function') {
        new IntersectionObserver(entries => {
          this.visible = entries[entries.length - 1].isIntersecting;
          if (this.visible) this.resize();
          this.update();
        }).observe(canvas);
      } else this.visible = true;
      document.addEventListener('visibilitychange', () => this.update());
      document.addEventListener('crt-signal-change', event => {
        if (this.persist && this.motion !== event.detail) this.setMotion(event.detail);
      });
      document.addEventListener('crt-color-change', event => {
        if (!this.persist) return;
        this.palette=event.detail.name; this.ink=rgb(event.detail.ink); this.label();
        if (this.gpu && !this.raf) this.draw();
      });
      media.addEventListener?.('change', () => { if (this.gpu) this.draw(); this.update(); this.label(); });
      if (typeof MutationObserver === 'function') {
        new MutationObserver(() => this.update()).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['inert'] });
      }
      canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        this.gpu = null; this.drawn = false; this.linking = false; this.links++;
        this.figure?.classList.remove('is-live');
        this.update();
        canvas.dataset.crt = 'loading';
      });
      canvas.addEventListener('webglcontextrestored', () => { this.width = 0; this.rebuild(); });
      this.figure?.querySelector('[data-crt-palette]')?.addEventListener('click', event => {
        const button = event.target.closest('[data-palette]');
        if (button) this.setPalette(button.dataset.palette);
      });
      this.figure?.querySelector('[data-crt-signal]')?.addEventListener('click', () => this.setMotion(this.still() ? 'on' : 'off'));
      this.label();
    }

    // This artwork animates by default; the visitor's explicit Signal choice always wins.
    still() { return this.motion === 'off'; }
    running() { return !!this.gpu && this.visible && !document.hidden && !this.still() && !this.canvas.closest('[inert]'); }

    update() {
      if (!this.gpu) return;
      if (this.running()) {
        this.canvas.dataset.crt = 'running';
        if (!this.raf) this.raf = requestAnimationFrame(this.tick);
        return;
      }
      if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
      this.last = 0;
      this.canvas.dataset.crt = this.still() ? 'still' : 'paused';
    }

    fail() {
      this.gpu = null;
      this.canvas.dataset.crt = 'unavailable';
      this.figure?.classList.remove('is-live');
    }

    resize() {
      if (!this.grid || !this.visible) return;
      // The first build waits for idle time and re-checks visibility: a #field-work load briefly reports
      // the hero as visible before the fragment scroll, and building then would compete with network entry.
      if (!this.gpu) {
        if (this.idle) return;
        const run = () => { this.idle = 0; this.rebuild(); };
        this.idle = typeof requestIdleCallback === 'function' ? requestIdleCallback(run, { timeout: 700 }) : setTimeout(run, 150);
        return;
      }
      this.rebuild();
    }

    rebuild() {
      if (!this.grid || !this.visible || this.canvas.dataset.crt === 'unavailable') return;
      const rect = this.canvas.getBoundingClientRect();
      const width = Math.round(rect.width), height = Math.round(rect.height);
      const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
      if (!width || !height) return;
      if (!this.gpu) { if (!this.linking) this.link(); return; }
      if (width === this.width && height === this.height && ratio === this.ratio) return;
      this.width = width; this.height = height; this.ratio = ratio;
      this.canvas.width = Math.round(width * ratio); this.canvas.height = Math.round(height * ratio);
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      this.draw();
      this.update();
    }

    // Asking for LINK_STATUS blocks until the driver finishes compiling (about 70 ms cold on Windows/ANGLE).
    // With KHR_parallel_shader_compile the link runs in the GPU process, so poll it once a frame instead.
    link() {
      let gl, program, parallel;
      try {
        gl = this.gl || (this.gl = this.canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' }));
        if (!gl || gl.isContextLost()) throw new Error('WebGL is unavailable');
        parallel = gl.getExtension('KHR_parallel_shader_compile');
        program = gl.createProgram();
        for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]]) {
          const shader = gl.createShader(type);
          gl.shaderSource(shader, source); gl.compileShader(shader);
          gl.attachShader(program, shader);
        }
        gl.linkProgram(program);
      } catch { if (!gl?.isContextLost()) this.fail(); return; }
      this.linking = true;
      const token = ++this.links;
      const finish = () => {
        // A lost context drops the program; webglcontextrestored links a fresh one.
        if (token !== this.links) return;
        if (gl.isContextLost()) { this.linking = false; return; }
        if (parallel && !gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) { requestAnimationFrame(finish); return; }
        this.linking = false;
        try { this.gpu = this.setup(program); } catch { if (!gl.isContextLost()) this.fail(); return; }
        this.width = 0;
        this.rebuild();
      };
      if (parallel) requestAnimationFrame(finish); else finish();
    }

    setup(program) {
      const { gl } = this;
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Shader link failed');
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'aPos');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE_ALPHA, this.grid.width, this.grid.height, 0, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, this.texels);
      for (const [key, value] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) {
        gl.texParameteri(gl.TEXTURE_2D, key, value);
      }
      const uniforms = Object.fromEntries(UNIFORMS.map(name => [name, gl.getUniformLocation(program, name)]));
      gl.uniform1i(uniforms.uImage, 0);
      this.channelIndex = -1;
      return { program, uniforms };
    }

    // The palette recolors the whole site's accents (html[data-palette]); other pages read the saved choice.
    setPalette(name) {
      if (!Object.hasOwn(PALETTES, name)) return;
      this.palette = name; this.ink = rgb(PALETTES[name]);
      if (this.persist) {
        if (window.PortfolioColor) PortfolioColor.preset(name);
        else { document.documentElement.dataset.palette=name; try { localStorage.setItem('sa-palette',name); } catch {} }
      }
      this.label();
      if (this.gpu && !this.raf) this.draw();
    }

    setMotion(value) {
      this.motion = value === 'on' || value === 'off' ? value : null;
      if (this.persist) {
        try { this.motion ? localStorage.setItem(SIGNAL_KEY, this.motion) : localStorage.removeItem(SIGNAL_KEY); } catch { /* storage blocked */ }
      }
      if (this.gpu) { this.update(); if (!this.raf) this.draw(); }
      this.label();
      if (this.persist) document.dispatchEvent(new CustomEvent('crt-signal-change', { detail: this.motion }));
    }

    label() {
      if (!this.figure) return;
      for (const button of this.figure.querySelectorAll('[data-palette]')) button.setAttribute('aria-pressed', String(button.dataset.palette === this.palette));
      this.figure.querySelector('[data-crt-signal]')?.setAttribute('aria-pressed', String(!this.still()));
    }

    draw() {
      const { gl, gpu } = this;
      if (!gpu || gl.isContextLost()) return;
      const still = this.still();
      const index = still || this.channels.length < 2 ? 0 : Math.floor(this.clock / 7) % this.channels.length;
      if (index !== this.channelIndex) {
        const channel = this.channels[index];
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE_ALPHA, channel.grid.width, channel.grid.height, 0, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, channel.texels);
        this.channelIndex = index;
        const label = this.figure?.querySelector('.crt-hud-bottom');
        if (label && this.channels.length > 1) label.textContent = `${String(index + 1).padStart(2,'0')} // ${channel.name}`;
      }
      const tuning = !still && this.channels.length > 1 ? Math.max(0, 1 - (this.clock % 7) / .38) ** 2 : 0;
      const s = still ? STILL : this.timeline.at(this.clock), cam = still ? REST : camera(this.clock);
      const u = gpu.uniforms, W = this.canvas.width, H = this.canvas.height, ratio = this.ratio;
      const image = this.grid.width / this.grid.height, screen = W / H;
      gl.uniform2f(u.uRes, W, H);
      // The wider physical tube shows the complete portrait between channel changes.
      if (this.channels.length > 1) gl.uniform2f(u.uFit, screen > image ? screen / image : 1, screen > image ? 1 : image / screen);
      else gl.uniform2f(u.uFit, screen > image ? 1 : screen / image, screen > image ? image / screen : 1);
      gl.uniform1f(u.uRatio, ratio);
      gl.uniform1f(u.uCell, (this.width >= 220 ? 4 : 3) * ratio);
      gl.uniform1f(u.uTime, s.time);
      gl.uniform1f(u.uAmp, (still ? 0 : this.channels.length > 1 ? 5 + 2 * Math.sin(this.clock * .4) : s.amp) + tuning * 45);
      gl.uniform1f(u.uTear, s.tear);
      gl.uniform1f(u.uStretch, this.channels.length > 1 && !still ? 1 + .025 * Math.sin(this.clock * .3) : s.stretch);
      gl.uniform1f(u.uAnchor, s.anchor);
      gl.uniform1f(u.uRot, s.rot);
      gl.uniform1f(u.uSkew, s.skew);
      gl.uniform1f(u.uDissolve, this.channels.length > 1 ? 0 : s.dissolve);
      gl.uniform1f(u.uCa, (s.ca + tuning * 6) * ratio);
      gl.uniform1f(u.uRoll, s.roll);
      gl.uniform1f(u.uGrain, s.grain + tuning * .35);
      gl.uniform1f(u.uSwitch, tuning);
      gl.uniform4f(u.uCam, cam.zoom, cam.x, cam.y, cam.rot);
      gl.uniform3f(u.uInk, this.ink[0], this.ink[1], this.ink[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!this.drawn) {
        this.drawn = true;
        this.figure?.classList.add('is-live');
        for (const control of this.figure?.querySelectorAll('[data-crt-palette], [data-crt-signal]') || []) control.hidden = false;
      }
    }

    // Draws and reads back in the same task: the WebGL buffer is not preserved after compositing.
    pixels() {
      this.draw();
      const { gl } = this, W = this.canvas.width, H = this.canvas.height, row = W * 4;
      const raw = new Uint8Array(W * H * 4), out = new Uint8Array(raw.length);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, raw);
      for (let y = 0; y < H; y++) out.set(raw.subarray((H - 1 - y) * row, (H - y) * row), y * row);
      return out;
    }

    snapshot(type = 'image/png') { this.draw(); return this.canvas.toDataURL(type); }
  }

  CrtPortrait.Signal = Signal;
  CrtPortrait.camera = camera;
  CrtPortrait.palettes = PALETTES;
  window.CrtPortrait = CrtPortrait;
  const canvas = document.querySelector('[data-crt-canvas]');
  if (canvas && window.PORTFOLIO_PORTRAIT) {
    let motion = null;
    try { motion = localStorage.getItem(SIGNAL_KEY); } catch { /* storage blocked */ }
    window.crtPortrait = new CrtPortrait(canvas, window.PORTFOLIO_PORTRAIT, matchMedia('(prefers-reduced-motion: reduce)'),
      { palette: document.documentElement.dataset.palette, motion, persist: true, channels: true });
  }
})();
