/* TopoDrawer on a CRT. The walkthrough plays through a WebGL tube (curvature, scanlines, shadow mask, bloom,
   rolling refresh). The video element stays in the page; "Clean picture", a missing GPU, or a file:// page
   shows it directly with native controls. */
(() => {
  'use strict';
  const box = document.querySelector('#projects .project-video'), video = box?.querySelector('video');
  if (!video || !window.TVFrame) return;
  const { make } = window.TVFrame;
  const root = document.documentElement, CLEAN_KEY = 'sa-video-clean', STEP = 10;
  const still = () => root.classList.contains('crt-motion-off');
  const VERTEX = 'attribute vec2 aPos;varying vec2 vUv;void main(){vUv=aPos*.5+.5;gl_Position=vec4(aPos,0.,1.);}';
  const FRAGMENT = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uFit, uTime, uMotion, uPower, uLine, uDpr;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 tap(vec2 t) { return texture2D(uTex, t).rgb; }
void main() {
  vec2 c = vUv * 2. - 1.;
  c *= 1. + vec2(c.y * c.y * .045, c.x * c.x * .06);
  vec2 uv = c * .5 + .5;
  float sx = clamp(uPower * 2.6, .003, 1.), sy = clamp(uPower * 1.7 - .7, .004, 1.);
  vec2 p = (uv - .5) / vec2(sx, sy) + .5;
  vec2 t = vec2(p.x, (p.y - .5) / uFit + .5);
  float inside = step(0., t.x) * step(t.x, 1.) * step(0., t.y) * step(t.y, 1.) * step(0., uv.x) * step(uv.x, 1.) * step(0., uv.y) * step(uv.y, 1.);
  vec2 px = 1. / uRes;
  vec3 col = vec3(tap(t + vec2(px.x * 1.2, 0.)).r, tap(t).g, tap(t - vec2(px.x * 1.2, 0.)).b);
  vec3 glow = (tap(t + vec2(px.x * 3., 0.)) + tap(t - vec2(px.x * 3., 0.)) + tap(t + vec2(0., px.y * 3.)) + tap(t - vec2(0., px.y * 3.))) * .25;
  col = (col + glow * .24) * inside;
  float line = .74 + .26 * cos(uv.y * uRes.y * 6.2832 / uLine);
  float m = mod(floor(gl_FragCoord.x / uDpr), 3.);
  vec3 mask = vec3(.88);
  if (m < 1.) mask.r = 1.1; else if (m < 2.) mask.g = 1.1; else mask.b = 1.1;
  float vig = pow(clamp(16. * uv.x * uv.y * (1. - uv.x) * (1. - uv.y), 0., 1.), .2);
  float band = fract(uv.y * .9 - uTime * .09);
  col *= 1. + uMotion * (.05 * exp(-band * 26.) + .012 * sin(uTime * 113.));
  col += uMotion * (hash(gl_FragCoord.xy + fract(uTime) * 97.) - .5) * .045 * inside;
  col *= 1. + (1. - sy) * 2.4;
  gl_FragColor = vec4(col * line * mask * vig * 1.2 * step(.002, uPower), 1.);
}`;

  // Channel 1 is the local walkthrough on the WebGL tube; the rest are uploads from youtube.com/@feather1x.
  const CHANNELS = [['', 'TopoDrawer walkthrough'], ['A5lFjh8e4vI', 'Informative Speech'], ['UuwtD0hKYK8', 'Fire'], ['Dz4zpVxZaL4', 'kip up then dies'],
    ['HOPbO4E6Fvc', 'Montage 1'], ['MMTv3Pi6Mn8', 'Take A Shot Every time I Say Efreet: Wizard101 Ep.1'], ['cokS5bUdwao', 'Wizard101 best legendary fire PvP deck setup'],
    ['G54wbkmmVWM', 'US History Project 1970s'], ['Oj_261eTFb0', 'Seis'], ['3PFYyM60zKQ', 'Cinco'], ['eVXr0UOw1dM', 'Cuatro'], ['BMYbplvt7KE', 'Tres'],
    ['N0o_36BfqpQ', 'Dos'], ['JIOAx-F0upk', 'Uno'], ['9al2FIKJikA', 'Varsity 1'], ['UTlOodhagSs', 'Another Wrestling Match'],
    ['n-105trHLHI', 'First Ever Wrestling Match In Oklahoma'], ['rTe8oruCngQ', '1v1ing JokeRKilleur And Zackaey']].map(([id, title]) => ({ id, title }));
  const YT = 'https://www.youtube-nocookie.com';
  let channel = 0, frameEl = null, yt = { time: 0, duration: 0, state: -1, volume: 100 };
  const tube = () => channel === 0;
  const bar = make('div', 'vtv-bar'), label = make('p', 'vtv-label', 'Channel 1 · TopoDrawer walkthrough');
  const cleanButton = make('button', 'rtv-view', 'Clean picture');
  cleanButton.type = 'button';
  bar.append(label, cleanButton);
  const tv = window.TVFrame.build({ className: 'vtv-tv', label: 'TopoDrawer TV', keys: [
    { key: 'stop', text: 'STOP', name: 'Stop: rewind the walkthrough to the start', action: stop },
    { key: 'rew', text: 'REW', name: 'Rew: back 10 seconds', action: () => seek(-STEP) },
    { key: 'play', text: 'PLAY', name: 'Play the walkthrough', action: toggle },
    { key: 'ff', text: 'FWD', name: 'Fwd: forward 10 seconds', action: () => seek(STEP) },
    { key: 'down', text: 'CH-', name: 'Channel down', action: () => tune(channel - 1) },
    { key: 'up', text: 'CH+', name: 'Channel up', action: () => tune(channel + 1) },
    { key: 'minus', text: 'VOL-', name: 'VOL- volume down', action: () => volume(-.2) },
    { key: 'plus', text: 'VOL+', name: 'VOL+ volume up', action: () => volume(.2) },
    { key: 'power', text: 'POWER', name: 'Power: turn the TV off', action: power }
  ] });
  const canvas = make('canvas', 'vtv-canvas');
  canvas.setAttribute('aria-hidden', 'true');
  box.classList.add('vtv-on');
  box.prepend(bar, tv.root);
  tv.show(video, canvas);
  const guide = make('ol', 'vtv-guide');
  guide.setAttribute('aria-label', 'Channel guide');
  const guideButtons = CHANNELS.map((c, i) => {
    const li = make('li'), b = make('button', 'vtv-ch');
    b.type = 'button';
    b.append(make('b', null, String(i + 1).padStart(2, '0')), make('span', null, c.title));
    b.addEventListener('click', () => tune(i));
    li.append(b);
    guide.append(li);
    return b;
  });
  box.append(guide);

  // Like the native player, the tube shows the poster until the walkthrough is first played or seeked.
  let gl = null, u = null, raf = 0, visible = false, on = true, level = 1, target = 1, lastFrame = 0, source = null, dirty = true, started = false;
  let clean = false;
  try { clean = localStorage.getItem(CLEAN_KEY) === 'clean'; } catch { /* session only */ }
  const poster = new Image();
  poster.decoding = 'async';

  function build() {
    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
      if (!gl) throw new Error('No WebGL');
      const program = gl.createProgram();
      for (const [type, code] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]]) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, code); gl.compileShader(shader); gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('CRT shader unavailable');
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'aPos');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array(3));
      u = Object.fromEntries(['uRes', 'uFit', 'uTime', 'uMotion', 'uPower', 'uLine', 'uDpr'].map(n => [n, gl.getUniformLocation(program, n)]));
      return true;
    } catch {
      gl = null;
      return false;
    }
  }
  const crt = () => !!gl && !clean;
  function upload(from) {
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, from);
      source = from;
    } catch {
      // A tainted frame (for example a file:// page) cannot reach the GPU; show the video directly instead.
      gl = null;
      setClean(true, false);
      cleanButton.hidden = true;
    }
  }
  function size() {
    const dpr = Math.min(1.5, devicePixelRatio || 1), w = Math.max(1, Math.round(tv.screen.clientWidth * dpr)), h = Math.max(1, Math.round(tv.screen.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return dpr;
  }
  function draw(now) {
    const dpr = size();
    gl.viewport(0, 0, canvas.width, canvas.height);
    const fresh = video.readyState >= 2;
    if (fresh && started && (!video.paused || dirty)) { upload(video); dirty = false; }
    else if (!source && poster.complete && poster.naturalWidth) upload(poster);
    if (!gl) return;
    const media = source === video ? [video.videoWidth, video.videoHeight] : [poster.naturalWidth || 16, poster.naturalHeight || 9];
    const fit = (canvas.width / canvas.height) / (media[0] / media[1] || 1.78);
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform1f(u.uFit, Math.min(1, fit));
    gl.uniform1f(u.uTime, still() ? 0 : now / 1000 % 1000);
    gl.uniform1f(u.uMotion, still() ? 0 : 1);
    gl.uniform1f(u.uPower, level);
    gl.uniform1f(u.uLine, 3 * dpr);
    gl.uniform1f(u.uDpr, dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    lastFrame = now;
  }
  function frame(now) {
    raf = 0;
    if (!crt() || !visible) return;
    if (level !== target) level = still() ? target : Math.max(0, Math.min(1, level + Math.sign(target - level) * Math.min(50, now - (lastFrame || now)) / 420));
    draw(now);
    if (!video.paused || level !== target) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && crt() && visible) raf = requestAnimationFrame(frame); };

  // ---- Deck ---------------------------------------------------------------------------------------------------
  const clock = s => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  let flash = '', flashTimer = 0;
  function status() {
    if (!tube()) return ytStatus();
    const playing = !video.paused;
    tv.relabel('play', playing ? 'PAUSE' : 'PLAY', playing ? 'Pause the walkthrough' : 'Play the walkthrough');
    tv.relabel('power', 'POWER', on ? 'Power: turn the TV off' : 'Power: turn the TV on');
    tv.buttons.power.setAttribute('aria-pressed', String(on));
    for (const key of ['stop', 'rew', 'play', 'ff', 'minus', 'plus']) tv.buttons[key].disabled = !on;
    tv.slot.textContent = !on ? 'POWER OFF' : flash || `${playing ? '▶ PLAY' : video.currentTime > 0 ? '❚❚ PAUSE' : '■ STOP'}  ${clock(video.currentTime)} / ${clock(video.duration)}`;
  }
  const say = text => { flash = text; clearTimeout(flashTimer); flashTimer = setTimeout(() => { flash = ''; status(); }, 1400); status(); };
  const send = (func, args = []) => frameEl?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), YT);
  function ytStatus() {
    const playing = yt.state === 1;
    tv.relabel('play', playing ? 'PAUSE' : 'PLAY', playing ? 'Pause the video' : 'Play the video');
    tv.relabel('power', 'POWER', on ? 'Power: turn the TV off' : 'Power: turn the TV on');
    tv.buttons.power.setAttribute('aria-pressed', String(on));
    for (const key of ['stop', 'rew', 'play', 'ff', 'down', 'up', 'minus', 'plus']) tv.buttons[key].disabled = !on;
    tv.slot.textContent = !on ? 'POWER OFF' : flash || `CH ${String(channel + 1).padStart(2, '0')}  ${playing ? '▶' : '❚❚'}  ${clock(yt.time)} / ${clock(yt.duration)}`;
  }
  function tune(next, autoplay = true) {
    if (!on) return;
    channel = (next + CHANNELS.length) % CHANNELS.length;
    const c = CHANNELS[channel];
    guideButtons.forEach((b, i) => b.setAttribute('aria-current', String(i === channel)));
    label.textContent = `Channel ${channel + 1} · ${c.title}`;
    tv.root.classList.toggle('is-yt', !tube());
    if (tube()) {
      frameEl?.remove(); frameEl = null;
      video.hidden = false;
    } else {
      video.pause();
      video.hidden = true;
      yt = { time: 0, duration: 0, state: -1, volume: yt.volume };
      if (!frameEl) {
        frameEl = make('iframe', 'vtv-yt');
        frameEl.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        frameEl.allowFullscreen = true;
        frameEl.referrerPolicy = 'strict-origin-when-cross-origin';
        frameEl.addEventListener('load', () => frameEl?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'vtv', channel: 'widget' }), YT));
        tv.show(frameEl);
      }
      frameEl.title = c.title + ' (YouTube video)';
      frameEl.src = `${YT}/embed/${c.id}?enablejsapi=1&playsinline=1&rel=0&origin=${encodeURIComponent(location.origin)}${autoplay ? '&autoplay=1' : ''}`;
    }
    say(`CH ${String(channel + 1).padStart(2, '0')}`);
    kick();
  }
  addEventListener('message', e => {
    if (e.origin !== YT || !frameEl || e.source !== frameEl.contentWindow) return;
    let data; try { data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
    const info = data?.info;
    if (!info || typeof info !== 'object') return;
    if (typeof info.currentTime === 'number') yt.time = info.currentTime;
    if (typeof info.duration === 'number') yt.duration = info.duration;
    if (typeof info.playerState === 'number') yt.state = info.playerState;
    if (typeof info.volume === 'number') yt.volume = info.volume;
    if (!tube()) status();
  });
  function toggle() {
    if (!tube()) return send(yt.state === 1 ? 'pauseVideo' : 'playVideo');
    if (video.paused) video.play().catch(() => {}); else video.pause(); }
  function stop() {
    if (!tube()) { send('seekTo', [0, true]); send('pauseVideo'); return; }
    video.pause(); video.currentTime = 0; status(); kick(); }
  function seek(by) {
    if (!tube()) return send('seekTo', [Math.max(0, yt.time + by), true]);
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + by)); kick(); }
  function volume(by) {
    const v = Math.round(Math.max(0, Math.min(1, (tube() ? (video.muted ? 0 : video.volume) : yt.volume / 100) + by)) * 10) / 10;
    if (!tube()) { yt.volume = v * 100; send('setVolume', [v * 100]); send(v ? 'unMute' : 'mute'); }
    video.volume = v;
    video.muted = v === 0;
    say('VOL ' + '▮'.repeat(Math.round(v * 5)) + '▯'.repeat(5 - Math.round(v * 5)));
  }
  function power() {
    on = !on;
    target = on ? 1 : 0;
    if (!on) { video.pause(); send('pauseVideo'); }
    tv.root.classList.toggle('is-off', !on);
    status();
    kick();
  }
  function setClean(value, save) {
    clean = value;
    tv.root.classList.toggle('is-crt', crt());
    video.controls = !crt();
    cleanButton.setAttribute('aria-pressed', String(clean));
    if (save) try { if (clean) localStorage.setItem(CLEAN_KEY, 'clean'); else localStorage.removeItem(CLEAN_KEY); } catch { /* session only */ }
    kick();
  }

  for (const type of ['play', 'seeked']) video.addEventListener(type, () => { started = true; });
  for (const type of ['play', 'pause', 'seeked', 'loadeddata', 'ended']) video.addEventListener(type, () => { dirty = true; status(); kick(); });
  video.addEventListener('timeupdate', status);
  video.addEventListener('durationchange', status);
  canvas.addEventListener('click', () => { if (on) toggle(); });
  cleanButton.addEventListener('click', () => setClean(!clean, true));
  document.addEventListener('crt-signal-change', () => setTimeout(kick));
  new ResizeObserver(() => { lastFrame = 0; kick(); }).observe(tv.screen);
  new IntersectionObserver(entries => { visible = entries.some(e => e.isIntersecting); kick(); }).observe(tv.root);
  poster.onload = kick;
  if (video.poster) poster.src = video.poster;
  if (!build()) cleanButton.hidden = true;
  setClean(clean, false);
  guideButtons[0].setAttribute('aria-current', 'true');
  status();
  box.topoTv = { tune, get channel() { return channel; },  video, canvas, get crt() { return crt(); }, setClean, power, get level() { return level; } };
})();
