/* One prismatic light pass over an opened photo. It crosses the whole frame from the upper-left as a translucent
   sheen and burns brighter inside precomputed letter shapes. No pixel reads. */
(() => {
  'use strict';
  // A fading glass sheen behind a saturated spectrum head and a white leading glint: [offset, rgb, alpha].
  const LIGHT = [[0, '225,238,255', 0], [.22, '225,238,255', .08], [.45, '240,246,255', .22], [.56, '255,255,255', .34],
    [.62, '162,107,255', .82], [.69, '84,140,255', .9], [.76, '56,214,255', .92], [.83, '84,240,150', .92],
    [.89, '255,232,92', .94], [.94, '255,150,84', .94], [.975, '255,92,170', .92], [.99, '255,255,255', .98], [1, '255,255,255', 0]];
  const SHEEN = .3; // Whole-photo strength relative to the lettering.
  class PhotoShine {
    // still: a MediaQueryList-like source, { matches, addEventListener('change', fn) }, that is true while motion is off.
    constructor(image, canvas, still, masks) {
      this.image = image; this.canvas = canvas; this.still = still; this.masks = masks;
      this.ctx = canvas.getContext('2d');
      this.generation = 0; this.raf = 0; this.active = false; this.mask = null; this.progress = 0;
      this.frame = time => {
        this.raf = 0;
        if (!this.active) return;
        if (document.hidden || this.still.matches) { this.stop(this.still.matches ? 'still' : 'hidden'); return; }
        if (this.startedAt === null) this.startedAt = time;
        this.progress = Math.min(1, Math.max(0, (time - this.startedAt) / 4200));
        if (this.progress === 1) { this.stop('done'); return; }
        this.paint();
        this.raf = requestAnimationFrame(this.frame);
      };
      new ResizeObserver(() => this.resize()).observe(image);
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop('hidden'); });
      still.addEventListener('change', () => { if (still.matches) this.stop('still'); });
      canvas.dataset.shine = 'idle';
    }
    stop(state = 'idle') {
      this.generation++;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0; this.active = false; this.mask = null;
      this.canvas.hidden = true; this.canvas.dataset.shine = state;
      this.ctx?.clearRect(0, 0, this.width || 0, this.height || 0);
    }
    async play(id) {
      this.stop();
      this.progress = 0;
      if (!this.ctx) { this.canvas.dataset.shine = 'unavailable'; return; }
      if (this.still.matches) { this.canvas.dataset.shine = 'still'; return; }
      if (document.hidden) { this.canvas.dataset.shine = 'hidden'; return; }
      const generation = this.generation, path = this.masks[id];
      let letters = null;
      if (path) { letters = new Image(); letters.src = path; }
      // Lettering is optional: without a mask, or if it fails to load, the sheen still crosses the photo.
      const lettering = letters ? letters.decode().then(() => letters, () => null) : Promise.resolve(null);
      this.canvas.dataset.shine = 'pending';
      try {
        await this.image.decode();
      } catch {
        if (generation === this.generation) this.stop('unavailable');
        return;
      }
      const mask = await lettering;
      if (generation !== this.generation) return;
      if (this.still.matches || document.hidden) { this.stop(this.still.matches ? 'still' : 'hidden'); return; }
      this.active = true; this.mask = mask;
      if (!this.resize()) { this.stop('unavailable'); return; }
      this.startedAt = null;
      this.canvas.hidden = false; this.canvas.dataset.shine = 'playing';
      this.canvas.dataset.letters = mask ? 'lit' : 'none';
      this.raf = requestAnimationFrame(this.frame);
    }
    resize() {
      if (!this.active || !this.ctx) return false;
      const box = this.image.getBoundingClientRect(), parent = this.canvas.parentElement.getBoundingClientRect();
      const style = getComputedStyle(this.image), border = side => parseFloat(style[`border${side}Width`]) || 0;
      const left = border('Left'), top = border('Top');
      this.width = box.width - left - border('Right'); this.height = box.height - top - border('Bottom');
      if (this.width <= 0 || this.height <= 0) return false;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      const width = Math.round(this.width * ratio), height = Math.round(this.height * ratio);
      if (this.canvas.width !== width) this.canvas.width = width;
      if (this.canvas.height !== height) this.canvas.height = height;
      Object.assign(this.canvas.style, {
        left: `${box.left - parent.left + left}px`, top: `${box.top - parent.top + top}px`,
        width: `${this.width}px`, height: `${this.height}px`,
        borderRadius: `${Math.max(0, (parseFloat(style.borderTopLeftRadius) || 0) - left)}px`
      });
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      return true;
    }
    paint() {
      const g = this.ctx, w = this.width, h = this.height;
      const distance = Math.hypot(w, h), x = w / distance, y = h / distance;
      const trail = distance * .26, lead = distance * .012;
      const cursor = this.progress * (distance + trail + lead) - lead;
      const light = strength => {
        const band = g.createLinearGradient((cursor - trail) * x, (cursor - trail) * y, (cursor + lead) * x, (cursor + lead) * y);
        LIGHT.forEach(([stop, rgb, alpha]) => band.addColorStop(stop, `rgba(${rgb},${+(alpha * strength).toFixed(3)})`));
        return band;
      };
      g.clearRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
      if (this.mask) {
        g.drawImage(this.mask, 0, 0, w, h);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = light(1); g.fillRect(0, 0, w, h);
        // The sheen goes behind the lit letters.
        g.globalCompositeOperation = 'destination-over';
      }
      g.fillStyle = light(SHEEN); g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    }
  }
  window.PhotoShine = PhotoShine;
})();
