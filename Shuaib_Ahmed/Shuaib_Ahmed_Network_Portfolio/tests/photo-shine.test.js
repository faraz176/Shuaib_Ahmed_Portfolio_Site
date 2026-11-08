const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const file = path.resolve(__dirname, '../assets/js/photo-shine.js');
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const peak = gradient => Math.max(...gradient.stops.map(([, color]) => +color.match(/rgba\([^)]*,([\d.]+)\)/)[1]));

function scene(options = {}) {
  const pending = new Map(), gradients = [], draws = [], fills = [], events = {};
  let next = 0;
  const ctx = {
    setTransform() {}, clearRect() {},
    drawImage(image) { draws.push(image.src); },
    createLinearGradient(...points) {
      const gradient = {points, stops: [], addColorStop(...stop) { this.stops.push(stop); }};
      gradients.push(gradient); return gradient;
    },
    fillRect() { fills.push(this.globalCompositeOperation); }
  };
  const bounds = {left: 20, top: 30, width: 402, height: 202};
  const image = {src: 'original.webp', naturalWidth: 400, naturalHeight: 200,
    decode: () => options.imageFails ? Promise.reject(new Error('Broken')) : Promise.resolve(), getBoundingClientRect: () => bounds};
  const canvas = {width: 0, height: 0, hidden: true, style: {}, dataset: {},
    getContext: () => options.noCanvas ? null : ctx,
    parentElement: {getBoundingClientRect: () => ({left: 10, top: 15})}};
  const still = {matches: !!options.still, addEventListener(type, fn) { events.still = fn; }};
  const document = {hidden: false, addEventListener(type, fn) { events[type] = fn; }};
  class Mask {
    constructor() { this.naturalWidth = 400; this.naturalHeight = 200; }
    decode() { return options.decodes?.[this.src] || Promise.resolve(); }
  }
  const context = vm.createContext({
    window: {}, document, Image: Mask, Math, devicePixelRatio: 2,
    requestAnimationFrame(fn) { const id = ++next; pending.set(id, fn); return id; },
    cancelAnimationFrame(id) { pending.delete(id); },
    ResizeObserver: class { constructor(fn) { events.resize = fn; } observe() {} },
    getComputedStyle: () => ({borderLeftWidth: '1px', borderRightWidth: '1px',
      borderTopWidth: '1px', borderBottomWidth: '1px', borderTopLeftRadius: '20px'})
  });
  if (fs.existsSync(file)) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  assert.equal(typeof context.window.PhotoShine, 'function', 'PhotoShine module is available');
  const shine = new context.window.PhotoShine(image, canvas, still,
    {text: 'mask.png', first: 'first.png', second: 'second.png'});
  return {shine, canvas, image, still, document, pending, gradients, draws, fills, bounds, events,
    tick(time) { const batch = [...pending.values()]; pending.clear(); batch.forEach(fn => fn(time)); }};
}

test('motion off, a missing canvas, or a broken photo leave the image unchanged without an animation loop', async () => {
  for (const [options, state] of [[{still: true}, 'still'], [{noCanvas: true}, 'unavailable'], [{imageFails: true}, 'unavailable']]) {
    const s = scene(options); await s.shine.play('text');
    assert.equal(s.canvas.dataset.shine, state);
    assert.equal(s.canvas.hidden, true); assert.equal(s.pending.size, 0);
    assert.equal(s.draws.length, 0); assert.equal(s.image.src, 'original.webp');
  }
});

test('a photo without lettering still gets one sheen across the whole frame', async () => {
  const s = scene(); await s.shine.play('no-text');
  assert.equal(s.canvas.dataset.shine, 'playing'); assert.equal(s.canvas.dataset.letters, 'none');
  assert.equal(s.canvas.hidden, false);
  s.tick(0); s.tick(2100);
  assert.equal(s.draws.length, 0, 'No letter mask is drawn');
  assert.ok(s.fills.length >= 2 && s.fills.every(operation => operation === 'source-over'), 'The sheen fills the frame');
  assert.ok(peak(s.gradients.at(-1)) <= .3, 'The whole-photo sheen stays translucent');
  s.tick(4200);
  assert.equal(s.canvas.dataset.shine, 'done'); assert.equal(s.canvas.hidden, true);
  assert.equal(s.image.src, 'original.webp');
});

test('one diagonal pass starts at the upper-left, is brighter on lettering, and finishes within five seconds', async () => {
  const s = scene(); await s.shine.play('text');
  assert.equal(s.canvas.dataset.shine, 'playing'); assert.equal(s.canvas.dataset.letters, 'lit');
  assert.equal(s.canvas.width, 800); assert.equal(s.canvas.height, 400);
  assert.equal(s.canvas.style.left, '11px'); assert.equal(s.canvas.style.top, '16px');
  s.tick(0);
  const first = s.gradients.at(-1).points;
  assert.ok(first[0] < 0 && first[1] < 0);
  assert.ok(Math.abs(first[2]) < .001 && Math.abs(first[3]) < .001);
  s.tick(2100);
  const [letters, sheen] = s.gradients.slice(-2);
  assert.deepEqual(letters.points, sheen.points, 'Lettering and sheen travel together');
  assert.ok(sheen.points[2] > 0 && sheen.points[3] > 0);
  assert.ok(Math.abs(sheen.points[2] / sheen.points[3] - 2) < .001);
  assert.ok(peak(letters) > .9 && peak(sheen) < peak(letters) / 2, 'Lettering is lit brighter than the rest of the photo');
  assert.ok(s.gradients.every(g => g.stops.length >= 7));
  assert.deepEqual([...new Set(s.fills)], ['source-in', 'destination-over'], 'Light fills the letter mask, then the sheen goes behind it');
  s.tick(4200);
  assert.equal(s.canvas.dataset.shine, 'done'); assert.equal(s.canvas.hidden, true);
  assert.equal(s.pending.size, 0);
  const draws = s.draws.length; s.tick(9000);
  assert.equal(s.draws.length, draws, 'Finished scans never loop');
  assert.equal(s.image.src, 'original.webp');
});

test('closing cancels pending frames and clears the decorative layer', async () => {
  const s = scene(); await s.shine.play('text'); s.tick(0);
  s.shine.stop();
  assert.equal(s.pending.size, 0); assert.equal(s.canvas.hidden, true);
  const draws = s.draws.length; s.tick(500);
  assert.equal(s.draws.length, draws);
});

test('a stale mask decode cannot revive a closed image or paint over the next photo', async () => {
  const first = deferred(), s = scene({decodes: {'first.png': first.promise}});
  const old = s.shine.play('first');
  await s.shine.play('second');
  first.resolve(); await old; s.tick(0);
  assert.equal(s.draws.at(-1), 'second.png');
  const pending = deferred(), closed = scene({decodes: {'first.png': pending.promise}});
  const loading = closed.shine.play('first');
  closed.shine.stop(); pending.resolve(); await loading;
  assert.equal(closed.pending.size, 0); assert.equal(closed.canvas.hidden, true);
});

test('hidden tabs and switching motion off cancel without replaying on return', async () => {
  const s = scene(); await s.shine.play('text'); s.tick(0);
  s.document.hidden = true; s.events.visibilitychange();
  assert.equal(s.pending.size, 0); assert.equal(s.canvas.hidden, true);
  s.document.hidden = false; s.events.visibilitychange();
  assert.equal(s.pending.size, 0);
  await s.shine.play('text');
  s.still.matches = true; s.events.still();
  assert.equal(s.canvas.dataset.shine, 'still'); assert.equal(s.pending.size, 0);
});

test('resizing keeps the shine aligned with the photo rather than its caption or border', async () => {
  const s = scene(); await s.shine.play('text');
  Object.assign(s.bounds, {left: 40, top: 50, width: 322, height: 162});
  s.events.resize();
  assert.equal(s.canvas.width, 640); assert.equal(s.canvas.height, 320);
  assert.equal(s.canvas.style.left, '31px'); assert.equal(s.canvas.style.top, '36px');
  assert.equal(s.canvas.style.width, '320px'); assert.equal(s.canvas.style.height, '160px');
});

test('failed mask loading still plays the sheen, without lettering', async () => {
  const s = scene({decodes: {'mask.png': Promise.reject(new Error('Unavailable'))}});
  await s.shine.play('text');
  assert.equal(s.canvas.dataset.shine, 'playing'); assert.equal(s.canvas.dataset.letters, 'none');
  s.tick(0); s.tick(1000);
  assert.equal(s.draws.length, 0);
  assert.ok(s.fills.every(operation => operation === 'source-over'));
});
