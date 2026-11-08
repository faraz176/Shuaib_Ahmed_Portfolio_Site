/* The portrait's phosphor signal carried across the page. Only this background is warped;
   content remains ordinary, selectable HTML above it. One low-resolution pass keeps it inexpensive. */
(() => {
  'use strict';
  const KEY = 'sa-wave-signal', FRAME = 1000 / 60;
  const VERTEX = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}';
  const FRAGMENT = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime, uScroll;
uniform vec3 uInk;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+1.0),f.x),f.y);
}
float bayer2(vec2 p) { p=floor(p); return fract(p.x*.5+p.y*p.y*.75); }
void main() {
  vec2 cell=floor(gl_FragCoord.xy), uv=(cell+.5)/uRes;
  vec2 p=(cell-uRes*.5)/uRes.y;
  float t=uTime, y=p.y+uScroll;
  float flow=sin(y*3.2+t*.34)*.52+sin(y*7.7-t*.23)*.19;
  float tear=(noise(vec2(floor(y*75.0)*.11,t*.15))-.5)*.13;
  float band=abs(sin((p.x+flow+tear)*3.8+t*.12));
  float ribbon=smoothstep(.62,.98,band);
  float structure=.45+.55*noise(vec2(cell.x*.085-t*.15,cell.y*.12+t*.1));
  float light=ribbon*structure;
  float bayer=bayer2(cell*.5)*.25+bayer2(cell);
  float tone=clamp(floor(light*4.0+bayer)/4.0,0.0,1.0);
  float blue=step(uInk.g*1.5,uInk.b);
  vec3 hot=mix(min(vec3(1.0),uInk+.15),vec3(.12,.9,1.0),blue);
  vec3 col=mix(uInk*uInk*.18,uInk,tone)*tone;
  col=mix(col,hot,smoothstep(.62,1.0,tone)*.72);
  col+=uInk*pow(ribbon,3.0)*.16;
  // Leave the reading column quiet; broad bright waves remain visible around the panel edges.
  float edge=smoothstep(.04,.48,abs(uv.x-.5));
  col*=.19+.53*edge;
  vec2 grid=abs(fract(cell/8.0)-.5);
  float line=1.0-step(.08,min(grid.x,grid.y));
  col+=uInk*line*.018;
  col*=1.0-.38*dot(uv-.5,uv-.5);
  gl_FragColor=vec4(col+vec3(.002,.006,.014),1.0);
}`;

  class CrtField {
    constructor() {
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'crt-field';
      this.canvas.setAttribute('aria-hidden', 'true');
      document.body.prepend(this.canvas);
      this.button = document.createElement('button');
      this.button.type = 'button'; this.button.className = 'crt-field-toggle';
      this.button.innerHTML = '<i aria-hidden="true"></i><span>Signal on</span>';
      const navigation = document.querySelector('.nav-inner');
      (navigation || document.body).append(this.button);
      this.button.classList.toggle('is-floating', !navigation);
      this.color=document.createElement('label'); this.color.className='crt-color-control';
      this.color.innerHTML='<span>Color</span><input type="range" min="0" max="360" step="1" aria-label="Site color"><i aria-hidden="true"></i>';
      (navigation||document.body).append(this.color); this.color.classList.toggle('is-floating',!navigation);
      this.slider=this.color.querySelector('input'); this.slider.value=window.PortfolioColor?.current.hue ?? 222;
      this.slider.addEventListener('input',()=>window.PortfolioColor?.hue(this.slider.value));
      this.clock = 0; this.last = 0; this.raf = 0; this.gpu = null;
      this.motion = null;
      try { this.motion = localStorage.getItem(KEY); } catch { /* session-only controls */ }
      this.contrast = matchMedia('(forced-colors: active), (prefers-contrast: more)');
      this.tick = time => {
        this.raf = 0;
        if (!this.running()) { this.update(); return; }
        if (time - this.last >= FRAME * .8) {
          if (this.last) this.clock += Math.min(.1, (time - this.last) / 1000);
          this.last = time; this.draw();
        }
        this.raf = requestAnimationFrame(this.tick);
      };
      this.button.addEventListener('click', () => {
        const value = this.motion === 'off' ? 'on' : 'off';
        try { localStorage.setItem(KEY, value); } catch { /* session-only controls */ }
        document.dispatchEvent(new CustomEvent('crt-signal-change', { detail: value }));
      });
      document.addEventListener('crt-signal-change', event => this.setMotion(event.detail));
      document.addEventListener('crt-color-change',()=>{this.slider.value=PortfolioColor.current.hue;this.palette();this.draw();});
      document.addEventListener('visibilitychange', () => this.update());
      this.contrast.addEventListener('change', () => { this.draw(); this.update(); });
      addEventListener('resize', () => this.resize(), { passive: true });
      new MutationObserver(() => this.update()).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['inert'] });
      new MutationObserver(() => { this.palette(); this.draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-palette'] });
      this.canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault(); this.gpu = null; this.update(); this.canvas.dataset.signal = 'unavailable';
      });
      this.canvas.addEventListener('webglcontextrestored', () => this.build());
      this.label();
      const start = () => this.build();
      if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 500 });
      else setTimeout(start, 0);
    }

    build() {
      try {
        const gl = this.gl || (this.gl = this.canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' }));
        if (!gl) throw new Error('No WebGL');
        const program = gl.createProgram();
        for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]]) {
          const shader = gl.createShader(type);
          gl.shaderSource(shader, source); gl.compileShader(shader); gl.attachShader(program, shader);
        }
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Signal shader unavailable');
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, 'aPos');
        gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        this.gpu = Object.fromEntries(['uRes','uTime','uScroll','uInk'].map(name => [name,gl.getUniformLocation(program,name)]));
        document.documentElement.classList.add('crt-field-live');
        this.palette(); this.resize(); this.update();
      } catch {
        this.canvas.dataset.signal = 'unavailable';
        this.canvas.hidden = true;
        this.button.hidden = true;
        // The HTML and its static CRT styling remain usable without a graphics context.
      }
    }

    palette() {
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--crt-ink').trim();
      this.ink = [1,3,5].map(i => parseInt(ink.slice(i,i+2),16)/255);
    }
    resize() {
      this.canvas.width = Math.ceil(innerWidth / 3); this.canvas.height = Math.ceil(innerHeight / 3);
      if (this.gl) this.gl.viewport(0,0,this.canvas.width,this.canvas.height);
      this.draw();
    }
    running() { return !!this.gpu && this.motion !== 'off' && !document.hidden && !this.contrast.matches && !document.querySelector('main[inert]'); }
    setMotion(value) {
      this.motion = value === 'off' || value === 'on' ? value : null;
      this.update(); this.draw(); this.label();
    }
    label() {
      const on = this.motion !== 'off';
      document.documentElement.classList.toggle('crt-motion-off', !on);
      this.button.setAttribute('aria-pressed', String(on));
      this.button.setAttribute('aria-label', on ? 'Signal on: pause site animation' : 'Signal off: play site animation');
      this.button.querySelector('span').textContent = on ? 'Signal on' : 'Signal off';
    }
    update() {
      const blocked = !!document.querySelector('main[inert]');
      this.button.hidden = blocked;
      this.color.hidden = blocked;
      if (this.running()) {
        this.canvas.dataset.signal = 'running';
        if (!this.raf) this.raf = requestAnimationFrame(this.tick);
      } else {
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = 0; this.last = 0;
        this.canvas.dataset.signal = this.motion === 'off' || this.contrast.matches ? 'still' : 'paused';
      }
    }
    draw() {
      if (!this.gpu || this.gl.isContextLost()) return;
      const gl = this.gl, u = this.gpu;
      gl.uniform2f(u.uRes,this.canvas.width,this.canvas.height);
      gl.uniform1f(u.uTime,this.clock);
      gl.uniform1f(u.uScroll,scrollY*.00015);
      gl.uniform3fv(u.uInk,this.ink);
      gl.drawArrays(gl.TRIANGLES,0,3);
    }
  }
  window.crtField = new CrtField();
})();
