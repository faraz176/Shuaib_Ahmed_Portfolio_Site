const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, Intl, Date, Math });
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/network-space.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/archive-data.js'), 'utf8'), context);
const Network = context.window.NetworkArchive, photos = context.window.PORTFOLIO_ARCHIVE;
const close = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const advance = (space, seconds, dt = 1 / 120) => {
  for (let t = 0; t < Math.round(seconds / dt); t++) space.step(dt);
};
const body = (x, vx, mass = 1) => ({
  position: [x, 0, 0], velocity: [vx, 0, 0], mass, radius: 50, hit: 0
});

test('real archive: every image belongs to exactly one activity/date cluster', () => {
  const space = new Network(photos);
  assert.equal(space.groups.length, 7);
  for (const [gap, expected] of [[.25, 59], [1, 39], [3, 22], [7, 14], [14, 10], [30, 7]]) {
    const groups = space.makeGroups('time', gap);
    assert.equal(groups.length, expected);
    const indices = groups.flatMap(g => g.indices);
    assert.equal(indices.length, 201);
    assert.equal(new Set(indices).size, 201);
    assert.equal(groups.find(g => g.precision === 'unknown').indices.length, 22);
    assert.equal(groups.find(g => g.precision === 'month').indices.length, 3);
    for (const group of groups.filter(g => g.precision === 'timestamp')) {
      const times = group.indices.map(i => Date.parse(`${photos[i].captured}Z`)).sort((a, b) => a - b);
      assert.ok(times.slice(1).every((t, i) => t - times[i] <= gap * 86400000));
    }
  }
});

test('date boundaries use consecutive gaps, preserve equality, and do not invent days', () => {
  const sample = [
    { category: 'A', captured: '2026-01-01T00:00:00' },
    { category: 'B', captured: '2026-01-01T12:00:00' },
    { category: 'A', captured: '2026-01-02T12:00:00' },
    { category: 'B', captured: '2026-01-04T12:00:01' },
    { category: 'B', captured: '2026-01' },
    { category: 'A', captured: null }
  ];
  const groups = new Network(sample).makeGroups('time', 1);
  assert.equal(groups.filter(g => g.precision === 'timestamp').length, 2);
  assert.equal(groups.find(g => g.precision === 'timestamp' && g.indices.length === 3).indices.length, 3);
  assert.equal(groups.find(g => g.precision === 'month').indices[0], 4);
  assert.equal(groups.find(g => g.precision === 'unknown').indices[0], 5);
});

test('one-hour gap steps preserve equality and update layouts immediately', () => {
  const sample = [
    ...['00:00:00', '01:00:00', '03:00:00', '06:00:00'].map(time =>
      ({category: 'A', captured: `2026-01-01T${time}`})),
    {category: 'A', captured: '2026-01'},
    {category: 'A', captured: null}
  ];
  const space = new Network(sample);
  for (const [hours, count] of [[1, 5], [2, 4], [3, 3]]) {
    space.setGrouping('time', hours / 24, true);
    assert.equal(space.groups.length, count);
    assert.equal(space.rearranging, 0);
    assert.ok(space.nodes.every(n => n.position.every((v, k) => v === n.anchor[k])));
    assert.equal(space.groups.flatMap(g => g.indices).length, sample.length);
  }
});

test('full archive date span joins precise timestamps but keeps uncertain dates separate', () => {
  const space = new Network(photos);
  const hours = Math.max(1, Math.ceil((space.dateExtent[1] - space.dateExtent[0]) / 3600000));
  space.setGrouping('time', hours / 24, true);
  assert.equal(space.groups.filter(g => g.precision === 'timestamp').length, 1);
  assert.equal(space.groups.find(g => g.precision === 'timestamp').indices.length, 176);
  assert.equal(space.groups.find(g => g.precision === 'month').indices.length, 3);
  assert.equal(space.groups.find(g => g.precision === 'unknown').indices.length, 22);
});

test('forward/backward travel follows current heading, including east, west and pitch', () => {
  for (const [yaw, pitch] of [[0, 0], [Math.PI / 2, 0], [Math.PI, 0], [-Math.PI / 2, 0], [.83, .6]]) {
    const space = new Network([]);
    space.ambient = false;
    space.camera.yaw = yaw; space.camera.pitch = pitch;
    const before = space.camera.position.slice(), direction = space.basis().forward;
    space.advance(300); advance(space, 2);
    assert.ok(space.camera.travel > 299);
    direction.forEach((n, k) => close(space.camera.position[k] - before[k], n * space.camera.travel));
    close(space.camera.yaw, yaw); close(space.camera.pitch, pitch);
    const forward = space.camera.position.slice();
    space.advance(-150); advance(space, 2);
    const displacement = space.camera.position.map((n, k) => n - forward[k]);
    assert.ok(displacement.reduce((sum, n, k) => sum + n * direction[k], 0) < -149);
  }
});

test('a heading change affects the next movement, rather than a fixed global zoom axis', () => {
  const space = new Network([]); space.ambient = false;
  space.advance(200); advance(space, 2);
  const z = space.camera.position[2], x = space.camera.position[0], focal = space.focal;
  space.camera.yaw = Math.PI / 2;
  space.advance(200); advance(space, 2);
  assert.ok(space.camera.position[0] > x + 199);
  close(space.camera.position[2], z);
  close(space.focal, focal);
  space.setTravel(1e8); assert.equal(space.camera.targetTravel, 6000);
  space.setTravel(-1e8); assert.equal(space.camera.targetTravel, -6000);
});

test('equal-mass collisions reverse normal velocity with the specified restitution', () => {
  const a = body(-49, 100), b = body(49, -100);
  a.velocity[1] = 20; b.velocity[1] = -7;
  Network.resolvePair(a, b, .78);
  close(a.velocity[0], -78); close(b.velocity[0], 78);
  close(a.velocity[1], 20); close(b.velocity[1], -7);
  close(a.velocity[0] + b.velocity[0], 0);
  close((a.velocity[0] ** 2 + b.velocity[0] ** 2) / 20000, .78 ** 2);
  assert.ok(b.position[0] - a.position[0] >= 100);
});

test('unequal-mass elastic collisions preserve momentum and kinetic energy', () => {
  const a = body(-49, 90, 2), b = body(49, 0, 1);
  Network.resolvePair(a, b, 1);
  close(a.velocity[0], 30); close(b.velocity[0], 120);
  close(a.mass * a.velocity[0] + b.mass * b.velocity[0], 180);
  close((a.mass * a.velocity[0] ** 2 + b.mass * b.velocity[0] ** 2) / 2, 8100);
});

test('separating and coincident bubbles remain finite and do not gain a second impulse', () => {
  const a = body(0, -20), b = body(0, 20);
  Network.resolvePair(a, b);
  assert.ok([...a.position, ...b.position, ...a.velocity, ...b.velocity].every(Number.isFinite));
  close(a.velocity[0], -20); close(b.velocity[0], 20);
  assert.ok(Math.hypot(...a.position.map((n, i) => n - b.position[i])) >= 100);
});

test('camera travel hits and pushes a bubble, without tunneling on a large requested move', () => {
  const space = new Network([{ category: 'A', captured: null }]);
  space.ambient = false;
  const node = space.nodes[0];
  node.position = node.anchor = [0, 0, 0];
  space.camera.position = [0, 0, -250];
  space.advance(600);
  let peak = 0, peakHit = 0;
  for (let i = 0; i < 240; i++) {
    space.step(1 / 120);
    peak = Math.max(peak, node.position[2]);
    peakHit = Math.max(peakHit, node.hit);
    assert.ok(Math.hypot(...node.position.map((n, k) => n - space.camera.position[k])) >= node.radius + space.camera.radius - .01);
  }
  assert.ok(space.contacts > 0);
  assert.ok(peak > 100);
  assert.ok(peakHit > 0);
  assert.ok(node.hit < peakHit, 'impact deformation relaxes after contact');
});

test('damping returns a displaced bubble to its cluster without permanent drift', () => {
  const space = new Network([{ category: 'A', captured: null }]); space.ambient = false;
  space.nodes[0].position[0] += 150;
  advance(space, 30);
  assert.ok(space.offset < .05 && space.energy < .03);
  assert.equal(space.moving, false);
});

test('integration refinement agrees with the independent damped-oscillator solution', () => {
  const k = .65, damping = 1.15, time = 2, initial = 150;
  const omega = Math.sqrt(k - damping ** 2 / 4);
  const exact = Math.exp(-damping * time / 2) * initial
    * (Math.cos(omega * time) + damping / (2 * omega) * Math.sin(omega * time));
  const errors = [60, 120, 240].map(hz => {
    const space = new Network([{ category: 'A', captured: null }]); space.ambient = false;
    const anchor = space.nodes[0].anchor[0];
    space.nodes[0].position[0] += initial;
    advance(space, time, 1 / hz);
    return Math.abs(space.nodes[0].position[0] - anchor - exact);
  });
  assert.ok(errors[2] < errors[1] && errors[1] < errors[0], `refinement errors: ${errors}`);
  assert.ok(errors[1] < .6, `120 Hz error: ${errors[1]}`);
});

test('all real-data grouping layouts are finite, complete and resting without overlaps', () => {
  const space = new Network(photos); space.ambient = false; space.reducedMotion = true;
  for (const mode of ['activity', 'time']) {
    space.setGrouping(mode, 7, true);
    for (let i = 0; i < space.nodes.length; i++) {
      assert.ok(space.nodes[i].position.every(Number.isFinite));
      for (let j = i + 1; j < space.nodes.length; j++) {
        const a = space.nodes[i], b = space.nodes[j];
        const d = Math.hypot(...a.position.map((v, k) => v - b.position[k]));
        assert.ok(d >= a.radius + b.radius, `overlap ${i}, ${j}`);
      }
    }
  }
});

test('wheel intensity distinguishes measured gentle ticks from fast ticks of the same size', () => {
  const slow = new Network([]), fast = new Network([]);
  for (let i = 0; i < 12; i++) {
    slow.scroll(37.5, 1000 + i * 166);
    fast.scroll(37.5, 1000 + i * 20);
  }
  assert.equal(slow.wheel.baseline, 240);
  assert.ok(slow.wheel.strength < .05);
  assert.ok(fast.wheel.strength > .95);
});

test('soft-to-hard intensity is continuous, monotonic and symmetric for reverse scrolling', () => {
  let previous = 0;
  for (let speed = 0; speed <= 1200; speed += 2.4) {
    const value = Network.scrollHardness(speed, 240);
    assert.ok(value >= previous && value <= 1);
    assert.ok(value - previous < .01, 'no discrete jump between soft and hard');
    previous = value;
  }
  const a = new Network([]), b = new Network([]);
  for (let i = 0; i < 8; i++) { a.scroll(80, i * 24); b.scroll(-80, i * 24); }
  close(a.wheel.strength, b.wheel.strength);
});

test('soft and hard camera contacts use distinct restitution and deformation on the same trajectory', () => {
  const results = [0, 1].map(hardness => {
    const space = new Network([{ category: 'A', captured: null }]); space.ambient = false;
    const n = space.nodes[0];
    n.position = [0, 0, 0]; n.anchor = [0, 0, 0]; n.velocity = [0, 0, -1000];
    space.camera.position = [0, 0, -80];
    space.camera.hardness = space.camera.targetStrength = hardness;
    space.advance(1, hardness);
    space.step(1 / 120);
    const cameraSpeed = (space.camera.position[2] + 80) * 120;
    return { speed: n.velocity[2] - cameraSpeed, hit: n.hit };
  });
  assert.ok(results[0].speed > 0);
  close(results[1].speed / results[0].speed, .84 / .04, .01);
  assert.ok(results[1].hit > results[0].hit * 5);
});

test('reversing a queued wheel move reverses travel immediately instead of cancelling a long backlog', () => {
  const space = new Network([]); space.ambient = false;
  space.scroll(800, 0); advance(space, .1);
  const before = space.camera.travel;
  space.scroll(-40, 200); space.step(1 / 120);
  assert.ok(space.camera.travel < before);
});

test('date color ranges preserve month precision and never assign a date to undated captures', () => {
  const space = new Network([
    { category: 'A', captured: '2026-01-01T00:00:00' },
    { category: 'A', captured: '2026-02-01T00:00:00' },
    { category: 'A', captured: '2026-01' },
    { category: 'A', captured: null }
  ]);
  close(space.nodes[0].dateRange[0], 0); close(space.nodes[1].dateRange[0], 1);
  close(space.nodes[2].dateRange[0], 0);
  assert.ok(space.nodes[2].dateRange[1] > .99 && space.nodes[2].dateRange[1] < 1);
  assert.equal(space.nodes[3].dateRange, null);
});

test('a resting camera contact sleeps without snapping a bubble through the camera', () => {
  const space = new Network([{ category: 'A', captured: null }]); space.ambient = false;
  space.nodes[0].anchor = [0, 0, 0]; space.nodes[0].position = [0, 0, 0];
  space.camera.position = [0, 0, -20];
  advance(space, 30);
  assert.equal(space.moving, false);
  assert.ok(Math.hypot(...space.nodes[0].position.map((v, k) => v - space.camera.position[k]))
    >= space.nodes[0].radius + space.camera.radius - .01);
});
