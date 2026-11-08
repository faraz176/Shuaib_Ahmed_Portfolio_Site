/* Network layout and fixed-step, damped sphere dynamics. No DOM or rendering dependencies. */
(() => {
  'use strict';
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const noise = n => ((Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
  const stamp = value => Date.parse(value.length === 10 ? `${value}T12:00:00Z` : `${value}Z`);
  const dateFormat = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  });
  const label = value => dateFormat.format(new Date(value));

  class NetworkArchive {
    constructor(photos) {
      this.photos = photos;
      const spans = photos.map(p => NetworkArchive.captureSpan(p.captured));
      const dated = spans.filter(Boolean);
      this.dateExtent = dated.length
        ? [Math.min(...dated.map(s => s[0])), Math.max(...dated.map(s => s[1]))] : [0, 1];
      const dateWidth = this.dateExtent[1] - this.dateExtent[0] || 1;
      this.nodes = photos.map((photo, index) => ({
        photo, index, radius: 50 + noise(index + 12) * 5, mass: 1,
        position: [0, 0, 0], velocity: [0, 0, 0], anchor: [0, 0, 0],
        cluster: 0, hit: 0, softness: 0, cameraContact: false,
        dateRange: spans[index]?.map(t => (t - this.dateExtent[0]) / dateWidth) || null
      }));
      this.nodes.forEach(n => { n.mass = (n.radius / 50) ** 3; });
      this.camera = { position: [0, 0, -2400], yaw: 0, pitch: 0, travel: 0, targetTravel: 0, radius: 38,
        hardness: 0, targetStrength: 0 };
      // A gentle reference measured ~226 CSS px/s; round to a tunable 240 px/s baseline.
      this.wheel = { baseline: 240, speed: 0, strength: 0, lastTime: null };
      this.sleeping = false; this.quietFor = 0;
      this.width = 1220; this.height = 660; this.focal = 957;
      this.time = 0; this.rearranging = 0; this.energy = 0; this.offset = 0;
      this.ambient = true; this.reducedMotion = false; this.contacts = 0;
      this.grouping = 'activity'; this.gapDays = 7; this.groups = [];
      this.setGrouping('activity', 7, true);
    }
    static captureSpan(value) {
      if (!value) return null;
      if (/^\d{4}-\d{2}$/.test(value)) {
        const [year, month] = value.split('-').map(Number);
        return month >= 1 && month <= 12 ? [Date.UTC(year, month - 1, 1), Date.UTC(year, month, 1) - 1] : null;
      }
      const time = stamp(value);
      return Number.isFinite(time) ? [time, time] : null;
    }
    static scrollHardness(speed, baseline = 240) {
      const x = clamp((speed / baseline - .65) / 3.35, 0, 1);
      return x * x * (3 - 2 * x);
    }
    scroll(pixels, time) {
      if (!Number.isFinite(pixels) || !Number.isFinite(time) || !pixels) return;
      const w = this.wheel, gap = w.lastTime === null ? Infinity : time - w.lastTime;
      const fresh = gap > 250 || gap < 0, elapsed = fresh ? .16 : Math.max(.016, gap / 1000);
      const rate = Math.abs(pixels) / elapsed;
      w.speed = fresh ? rate : w.speed + (rate - w.speed) * (1 - Math.exp(-elapsed / .08));
      w.lastTime = time; w.strength = NetworkArchive.scrollHardness(w.speed, w.baseline);
      this.advance(clamp(pixels, -800, 800) * 1.5, w.strength);
    }
    makeGroups(mode, gapDays) {
      const groups = [];
      const add = (id, name, indices, precision) => groups.push({ id, label: name, indices, precision, center: [0, 0, 0] });
      if (mode === 'activity') {
        [...new Set(this.photos.map(p => p.category))].forEach((name, i) => {
          add(`activity-${i}`, name, this.photos.flatMap((p, j) => p.category === name ? [j] : []), 'activity');
        });
        return groups;
      }
      const dated = this.photos.flatMap((p, index) => p.captured?.length > 7
        && Number.isFinite(stamp(p.captured)) ? [{ index, time: stamp(p.captured) }] : []).sort((a, b) => a.time - b.time);
      let run = [];
      const flush = () => {
        if (!run.length) return;
        const start = run[0].time, end = run[run.length - 1].time;
        const name = label(start) === label(end) ? label(start) : `${label(start)} – ${label(end)}`;
        add(`date-${start}`, name, run.map(p => p.index), 'timestamp');
        run = [];
      };
      dated.forEach(p => {
        if (run.length && p.time - run[run.length - 1].time > gapDays * 86400000) flush();
        run.push(p);
      });
      flush();
      groups.reverse();
      [...new Set(this.photos.filter(p => p.captured?.length === 7).map(p => p.captured))].sort().reverse().forEach(month => {
        const name = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
          .format(new Date(`${month}-01T12:00:00Z`));
        add(`month-${month}`, `${name} · month only`, this.photos.flatMap((p, i) => p.captured === month ? [i] : []), 'month');
      });
      const unknown = this.photos.flatMap((p, i) => !p.captured || (p.captured.length !== 7 && !Number.isFinite(stamp(p.captured))) ? [i] : []);
      if (unknown.length) add('undated', 'Date unavailable', unknown, 'unknown');
      return groups;
    }
    setGrouping(mode, gapDays = this.gapDays, immediate = false) {
      this.grouping = mode === 'time' ? 'time' : 'activity';
      this.gapDays = gapDays;
      this.groups = this.makeGroups(this.grouping, gapDays);
      const count = this.groups.length, extent = 640 + Math.sqrt(count) * 90;
      this.groups.forEach((group, i) => {
        const y = 1 - 2 * (i + .5) / count, angle = i * 2.39996323;
        const ring = Math.sqrt(1 - y * y);
        group.center = [Math.cos(angle) * ring * extent, y * extent * .65, Math.sin(angle) * ring * extent * .65];
        const side = Math.ceil(Math.cbrt(group.indices.length)), cells = [];
        for (let x = 0; x < side; x++) for (let yy = 0; yy < side; yy++) for (let z = 0; z < side; z++) {
          const p = [x - (side - 1) / 2, yy - (side - 1) / 2, z - (side - 1) / 2];
          cells.push({ p, distance: p.reduce((s, v) => s + v * v, 0), tie: noise(x * 61 + yy * 17 + z * 3 + i) });
        }
        cells.sort((a, b) => a.distance - b.distance || a.tie - b.tie);
        group.indices.forEach((index, j) => {
          const node = this.nodes[index], p = cells[j].p.map(n => n * 126);
          const a = angle + .4, b = .6 + i * .17;
          const x = p[0] * Math.cos(a) + p[2] * Math.sin(a);
          const z = -p[0] * Math.sin(a) + p[2] * Math.cos(a);
          const local = [x, p[1] * Math.cos(b) - z * Math.sin(b), p[1] * Math.sin(b) + z * Math.cos(b)];
          node.anchor = local.map((v, axis) => group.center[axis] + v + (noise(index * 7 + axis) - .5) * 5);
          node.cluster = i;
        });
      });
      // Separate any neighboring clusters too, so the resting layout is not a pile of intersecting spheres.
      for (let pass = 0; pass < 16; pass++) {
        let overlaps = 0;
        for (let i = 0; i < this.nodes.length; i++) for (let j = i + 1; j < this.nodes.length; j++) {
          const a = this.nodes[i], b = this.nodes[j], delta = b.anchor.map((v, k) => v - a.anchor[k]);
          const limit = a.radius + b.radius + 8, d = Math.hypot(...delta);
          if (d < limit) {
            const n = d > .001 ? delta.map(v => v / d) : [1, 0, 0];
            const move = (limit - d) * .51;
            for (let k = 0; k < 3; k++) { a.anchor[k] -= n[k] * move; b.anchor[k] += n[k] * move; }
            overlaps++;
          }
        }
        if (!overlaps) break;
      }
      this.nodes.forEach(n => {
        if (immediate || this.reducedMotion) n.position = n.anchor.slice();
        n.velocity.fill(0); n.hit = 0; n.softness = 0; n.cameraContact = false;
      });
      this.rearranging = immediate || this.reducedMotion ? 0 : 2.6;
      this.energy = this.rearranging ? 1 : 0;
      this.resetCamera();
    }
    setViewport(width, height) {
      this.width = width; this.height = height;
      this.focal = Math.min(width * .94, height * 1.45);
    }
    resetCamera() {
      let distance = 1800;
      this.nodes.forEach(n => {
        distance = Math.max(distance,
          (Math.abs(n.anchor[0]) + n.radius + 30) * this.focal / (this.width * .43) - n.anchor[2],
          (Math.abs(n.anchor[1]) + n.radius + 30) * this.focal / (this.height * .38) - n.anchor[2]);
      });
      this.camera.position = [0, 0, -distance];
      this.camera.yaw = 0; this.camera.pitch = 0;
      this.camera.travel = 0; this.camera.targetTravel = 0;
      this.camera.hardness = this.camera.targetStrength = 0;
      this.wheel.speed = this.wheel.strength = 0; this.wheel.lastTime = null;
      this.sleeping = false; this.quietFor = 0;
      this.contacts = 0;
      this.nodes.forEach(n => { n.cameraContact = false; });
    }
    basis() {
      const { yaw, pitch } = this.camera, sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
      return { forward: [sy * cp, sp, cy * cp], right: [cy, 0, -sy], up: [-sy * sp, cp, -cy * sp] };
    }
    aimAt(point) {
      const d = point.map((v, i) => v - this.camera.position[i]);
      this.camera.yaw = Math.atan2(d[0], d[2]);
      this.camera.pitch = Math.atan2(d[1], Math.hypot(d[0], d[2]));
      this.stopTravel();
    }
    setTravel(value, strength = .35) {
      this.camera.targetTravel = clamp(value, -6000, 6000);
      this.camera.targetStrength = clamp(strength, 0, 1);
      this.sleeping = false; this.quietFor = 0;
    }
    advance(distance, strength = .25) {
      if (distance * (this.camera.targetTravel - this.camera.travel) < 0) this.camera.targetTravel = this.camera.travel;
      this.setTravel(this.camera.targetTravel + distance, strength);
    }
    stopTravel() {
      this.camera.targetTravel = this.camera.travel; this.camera.targetStrength = 0;
      this.wheel.lastTime = null; this.wheel.speed = this.wheel.strength = 0;
    }
    static resolvePair(a, b, restitution = .78) {
      const dx = b.position[0] - a.position[0], dy = b.position[1] - a.position[1], dz = b.position[2] - a.position[2];
      const limit = a.radius + b.radius;
      if (Math.abs(dx) >= limit || Math.abs(dy) >= limit || Math.abs(dz) >= limit) return false;
      const distance = Math.hypot(dx, dy, dz);
      if (distance >= limit) return false;
      const n = distance > .0001 ? [dx / distance, dy / distance, dz / distance] : [1, 0, 0];
      const ia = 1 / a.mass, ib = 1 / b.mass, sum = ia + ib;
      const separation = (limit - distance + .001) / sum;
      let relative = 0;
      for (let k = 0; k < 3; k++) {
        a.position[k] -= n[k] * separation * ia;
        b.position[k] += n[k] * separation * ib;
        relative += (b.velocity[k] - a.velocity[k]) * n[k];
      }
      if (relative < 0) {
        const impulse = -(1 + restitution) * relative / sum;
        for (let k = 0; k < 3; k++) { a.velocity[k] -= impulse * ia * n[k]; b.velocity[k] += impulse * ib * n[k]; }
        const softness = Math.max(a.softness || 0, b.softness || 0);
        const hit = Math.min(1, -relative / 240 + .18) * (1 - .85 * softness);
        a.hit = Math.max(a.hit, hit); b.hit = Math.max(b.hit, hit);
        a.softness = b.softness = softness;
      }
      return true;
    }
    step(dt) {
      this.time += dt;
      this.rearranging = Math.max(0, this.rearranging - dt);
      const c = this.camera, forward = this.basis().forward;
      const remaining = c.targetTravel - c.travel;
      c.hardness += (c.targetStrength - c.hardness) * (1 - Math.exp(-20 * dt));
      if (Math.abs(remaining) < .02) c.targetStrength = 0;
      if (c.hardness < .0001) c.hardness = 0;
      const movement = Math.abs(remaining) < .02 ? remaining : clamp(remaining * (1 - Math.exp(-12 * dt)), -1800 * dt, 1800 * dt);
      const cameraVelocity = forward.map(n => n * movement / dt);
      for (let k = 0; k < 3; k++) c.position[k] += forward[k] * movement;
      c.travel += movement;
      const spring = this.rearranging ? 8 : .65;
      this.nodes.forEach(n => {
        n.hit = Math.max(0, n.hit - dt * 2.6);
        const damping = Math.exp(-(this.rearranging ? 4.8 : 1.15 + n.softness * 3) * dt);
        n.softness *= Math.exp(-1.6 * dt);
        for (let k = 0; k < 3; k++) {
          const float = this.ambient && !this.reducedMotion ? Math.sin(this.time * .65 + n.index * 1.71 + k * 2) * 6 : 0;
          n.velocity[k] = (n.velocity[k] + (n.anchor[k] + float - n.position[k]) * spring * dt) * damping;
          n.position[k] += n.velocity[k] * dt;
        }
      });
      for (let pass = 0; pass < 2; pass++) {
        this.nodes.forEach(n => {
          const d = n.position.map((v, i) => v - c.position[i]), distance = Math.hypot(...d), limit = n.radius + c.radius;
          if (distance >= limit) { if (distance > limit + 3) n.cameraContact = false; return; }
          const normal = distance > .001 ? d.map(v => v / distance) : forward;
          let relative = 0;
          for (let k = 0; k < 3; k++) {
            n.position[k] += normal[k] * (limit - distance + .001);
            relative += (n.velocity[k] - cameraVelocity[k]) * normal[k];
          }
          if (relative < 0) {
            const strength = c.hardness * clamp(-relative / 300, 0, 1);
            const restitution = .04 + .8 * strength;
            for (let k = 0; k < 3; k++) n.velocity[k] -= normal[k] * relative * (1 + restitution);
            n.softness = Math.max(n.softness, 1 - strength);
            n.hit = Math.max(n.hit, Math.min(1, -relative / 800) * (.08 + .92 * strength));
          }
          if (!n.cameraContact) { this.contacts++; n.cameraContact = true; }
        });
        for (let i = 0; i < this.nodes.length; i++) for (let j = i + 1; j < this.nodes.length; j++) {
          const a = this.nodes[i], b = this.nodes[j];
          NetworkArchive.resolvePair(a, b, .78 - .6 * Math.max(a.softness, b.softness));
        }
      }
      this.energy = 0; this.offset = 0;
      this.nodes.forEach(n => {
        this.energy = Math.max(this.energy, ...n.velocity.map(v => Math.abs(v)));
        this.offset = Math.max(this.offset, ...n.position.map((v, k) => Math.abs(v - n.anchor[k])));
      });
      const constrained = this.nodes.some(n => n.cameraContact);
      const quiet = !this.ambient && !this.rearranging && this.energy < .03
        && (this.offset < .05 || constrained) && Math.abs(c.targetTravel - c.travel) < .02;
      this.quietFor = quiet ? this.quietFor + dt : 0;
      if (!quiet) this.sleeping = false;
      if (this.quietFor > .35) {
        this.nodes.forEach(n => {
          if (this.offset < .05) n.position = n.anchor.slice();
          n.velocity.fill(0); n.hit = 0;
        });
        this.energy = 0; this.sleeping = true;
        if (this.offset < .05) this.offset = 0;
      }
    }
    get moving() {
      return (this.ambient && !this.reducedMotion) || this.rearranging > 0 || this.camera.hardness > .001
        || Math.abs(this.camera.targetTravel - this.camera.travel) >= .02
        || (!this.sleeping && (this.energy > .03 || this.offset > .05 || this.nodes.some(n => n.hit > 0)));
    }
  }
  window.NetworkArchive = NetworkArchive;
})();
