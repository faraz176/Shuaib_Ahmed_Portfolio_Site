/* Receipt TV: a DOS directory printed on glowing thermal paper inside the CRT. The homepage lab directory and
   every report use it; the authored HTML stays in the page as the Plain view. */
(() => {
  'use strict';
  if (!window.TVFrame) return;
  const { make } = window.TVFrame;
  const root = document.documentElement;
  const KEEP = 6, FEED = 520, INK = [24, 24, 21], SIZE_KEY = 'sa-receipt-size', SIZES = [.85, 1, 1.15, 1.3, 1.5];
  const LETTERHEAD = ['shuaibahmedportfolio.netlify.app', 'New York, NY', 'Your Engineer was SHUAIB AHMED'];
  const still = () => root.classList.contains('crt-motion-off');
  const words = node => (node?.textContent || '').replace(/\s+/g, ' ').trim();
  const bytes = value => new TextEncoder().encode(value).length;
  const count = n => n.toLocaleString('en-US');
  const remember = (key, value) => { try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* session only */ } };
  const recall = key => { try { return localStorage.getItem(key); } catch { return null; } };

  // Windows 95 short names: keep a valid 8.3 name, else a short first word, else six characters plus ~N.
  const squash = value => value.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  function shortName(long, ext, taken) {
    const whole = squash(long), first = squash(long.replace(/^(the|a|an)\s+/i, '').split(/[\s/·:,]+/)[0]);
    let base = whole && whole.length <= 8 ? whole : first.length >= 3 && first.length <= 8 ? first : '';
    for (let n = 1; !base || taken.has(base + ext); n++) base = (whole || 'FILE').slice(0, 7 - String(n).length) + '~' + n;
    taken.add(base + ext);
    return base + ext;
  }
  const claim = (wanted, long, ext, taken) => taken.has(wanted) ? shortName(long, ext, taken) : (taken.add(wanted), wanted);
  const folder = (name, long, parent, extra) => {
    const node = { kind: 'dir', name, long, parent, children: [], taken: new Set(), ...extra };
    parent?.children.push(node);
    return node;
  };
  const file = (parent, name, long, extra) => {
    const node = { kind: 'file', name, long, parent, size: 0, ...extra };
    parent.children.push(node);
    return node;
  };
  // A placeholder the printer fills with a dithered copy of the image.
  const plate = (src, alt) => {
    const box = make('div', 'rc-print');
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', alt || 'Image');
    if (src) box.dataset.src = src;
    return box;
  };

  const stamp = () => {
    const d = new Date(), p = n => String(n).padStart(2, '0'), h = d.getHours();
    return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${p(d.getFullYear() % 100)} ${p(h % 12 || 12)}:${p(d.getMinutes())}${h < 12 ? 'am' : 'pm'}`;
  };
  const dosName = node => {
    if (node.kind === 'dir') return node.name.padEnd(9) + '<DIR>';
    const [base, ext = ''] = node.name.split('.');
    return base.padEnd(9) + ext;
  };
  // A stable barcode and the digits printed under it, seeded by the ticket.
  function barcode(seed) {
    let h = 2166136261;
    for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    const next = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return h >>>= 0; };
    const widths = [2, 1, 1, 1];
    for (let i = 0; i < 60; i++) widths.push(1 + next() % 3);
    widths.push(1, 1, 2);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = 0, digits = '';
    const stops = widths.map((w, i) => `${i % 2 ? 'transparent' : 'var(--ink)'} ${(x / total * 100).toFixed(2)}% ${((x += w) / total * 100).toFixed(2)}%`);
    while (digits.length < 9) digits += next() % 10;
    return { image: `linear-gradient(90deg, ${stops.join(', ')})`, digits };
  }

  // ---- Thermal dither for images ------------------------------------------------------------------------------
  const load = src => new Promise(resolve => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
    setTimeout(() => resolve(image.naturalWidth ? image : null), 5000);
  });
  function dither(image, box, maxHeight) {
    const dpr = Math.min(3, devicePixelRatio || 1), dot = Math.max(1, Math.round(dpr)), ratio = image.naturalHeight / image.naturalWidth;
    const cssWidth = Math.min(box.clientWidth || 300, maxHeight / ratio);
    const cols = Math.max(16, Math.floor(cssWidth * dpr / dot)), rows = Math.max(1, Math.round(cols * ratio));
    const canvas = make('canvas', 'rc-dots');
    canvas.width = cols; canvas.height = rows;
    canvas.style.width = (cols * dot / dpr).toFixed(2) + 'px';
    canvas.setAttribute('aria-hidden', 'true');
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff';
    g.fillRect(0, 0, cols, rows);
    g.drawImage(image, 0, 0, cols, rows);
    const data = g.getImageData(0, 0, cols, rows), px = data.data, n = cols * rows, lum = new Float32Array(n), hist = new Uint32Array(256);
    let dark = 0;
    for (let i = 0; i < n; i++) {
      const v = .2126 * px[i * 4] + .7152 * px[i * 4 + 1] + .0722 * px[i * 4 + 2];
      lum[i] = v;
      if (v < 60) dark++;
    }
    // Dark console screenshots print as black text on paper instead of a solid black slab.
    const invert = dark > n * .5;
    for (let i = 0; i < n; i++) { if (invert) lum[i] = 255 - lum[i]; hist[lum[i] | 0]++; }
    const level = q => { let sum = 0; for (let v = 0; v < 256; v++) if ((sum += hist[v]) >= n * q) return v; return 255; };
    const lo = level(.02), hi = Math.max(lo + 1, level(.98)), gain = 255 / (hi - lo);
    for (let i = 0; i < n; i++) lum[i] = Math.min(255, Math.max(0, (lum[i] - lo) * gain));
    // Atkinson error diffusion keeps highlights open, like a thermal head.
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x, ink = lum[i] < 128, err = (lum[i] - (ink ? 0 : 255)) / 8;
      if (x + 1 < cols) lum[i + 1] += err;
      if (x + 2 < cols) lum[i + 2] += err;
      if (y + 1 < rows) { if (x > 0) lum[i + cols - 1] += err; lum[i + cols] += err; if (x + 1 < cols) lum[i + cols + 1] += err; }
      if (y + 2 < rows) lum[i + 2 * cols] += err;
      const o = i * 4;
      px[o] = INK[0]; px[o + 1] = INK[1]; px[o + 2] = INK[2]; px[o + 3] = ink ? 255 : 0;
    }
    g.putImageData(data, 0, 0);
    box.replaceChildren(canvas);
  }
  function printImage(image, box, maxHeight) {
    if (!image) { box.replaceChildren(make('span', 'rc-missing', '[ IMAGE UNAVAILABLE ]')); return; }
    try { dither(image, box, maxHeight); }
    catch {
      image.className = 'rc-fallback';
      image.alt = '';
      box.replaceChildren(image);
    }
  }

  // ---- A station: heading, Plain view switch, the TV and its printout -----------------------------------------
  let stations = 0;
  // top: root folder with a `base` path such as 'C:\\LABS'. render(file) returns the file's printed elements.
  // policy: { title, text } printed once, on the top directory's ticket.
  function mount({ host, place, title, hint, top, render, sizeOf = node => Promise.resolve(node.size), viewKey, boot, exit, policy, region = 'Printout', level = 2 }) {
    const sequence = [];
    (function walk(dir) { for (const node of dir.children) node.kind === 'dir' ? walk(node) : sequence.push(node); })(top);
    const within = (node, dir) => { for (let p = node.parent; p; p = p.parent) if (p === dir) return true; return false; };
    const nextOf = node => node.kind === 'file' ? sequence[sequence.indexOf(node) + 1] : sequence.find(f => within(f, node));
    const prevOf = node => {
      const i = node.kind === 'file' ? sequence.indexOf(node) : sequence.findIndex(f => within(f, node));
      return i > 0 ? sequence[i - 1] : null;
    };
    const pathOf = dir => { const parts = []; for (let n = dir; n && n !== top; n = n.parent) parts.unshift(n.name); return [top.base, ...parts].join('\\'); };
    const station = make('section', 'rtv-station'), id = 'rtv-label-' + ++stations;
    station.setAttribute('aria-labelledby', id);
    const bar = make('div', 'rtv-bar'), heading = make('h' + level, 'rtv-label', title), where = make('span', 'rtv-path');
    heading.id = id;
    heading.append(where);
    const viewButton = make('button', 'rtv-view', 'Plain view');
    viewButton.type = 'button';
    bar.append(heading, viewButton);
    const note = make('p', 'rtv-hint', hint);
    const live = make('p', 'rtv-live');
    live.setAttribute('aria-live', 'polite');
    const saved = SIZES.indexOf(Number(recall(SIZE_KEY)));
    let current = null, serial = 0, job = 0, feeding = null, size = saved >= 0 ? saved : 1;
    const step = (find, first) => () => { const node = current ? find(current) : first; if (node) open(node, null, { focus: false }); };
    const tv = window.TVFrame.build({ className: 'rtv-tv', label: title, keys: [
      { key: 'stop', text: 'ROOT', name: 'Root: print the top directory', action: () => open(top, null, { focus: false }) },
      { key: 'rew', text: 'PREV', name: 'Prev: print the previous file', action: step(prevOf, null) },
      { key: 'ff', text: 'NEXT', name: 'Next: print the next file', action: step(nextOf, sequence[0]) },
      { key: 'rec', text: 'PRINT', name: 'Print this receipt on paper', action: () => printTicket() },
      { key: 'up', text: 'UP', name: 'Up one directory', action: () => current?.parent && open(current.parent, null, { focus: false }) },
      { key: 'minus', text: 'A-', name: 'A- smaller type', action: () => resize(-1) },
      { key: 'plus', text: 'A+', name: 'A+ larger type', action: () => resize(1) }
    ] });
    const keys = tv.buttons;
    tv.screen.classList.add('rtv-screen');
    const roll = make('div', 'rtv-roll'), head = make('div', 'rtv-head');
    roll.tabIndex = 0;
    roll.setAttribute('role', 'region');
    roll.setAttribute('aria-label', region);
    head.setAttribute('aria-hidden', 'true');
    tv.show(roll, head);
    station.append(bar, note, tv.root, live);
    place(station);

    function sync() {
      const cwd = current && (current.kind === 'dir' ? current : current.parent);
      where.textContent = pathOf(cwd || top);
      keys.up.disabled = !current?.parent;
      keys.rew.disabled = !(current && prevOf(current));
      keys.ff.disabled = !(current ? nextOf(current) : sequence[0]);
      keys.rec.disabled = !roll.lastElementChild;
      keys.minus.disabled = size <= 0;
      keys.plus.disabled = size >= SIZES.length - 1;
      tv.slot.textContent = feeding ? '● PRINTING' : current ? (current.kind === 'dir' ? current.name + '\\' : current.name) : 'READY';
    }
    function resize(by) {
      size = Math.min(SIZES.length - 1, Math.max(0, size + by));
      roll.style.setProperty('--rtv-zoom', SIZES[size]);
      remember(SIZE_KEY, SIZES[size] === 1 ? null : String(SIZES[size]));
      sync();
    }
    roll.style.setProperty('--rtv-zoom', SIZES[size]);

    // ---- Tickets ----------------------------------------------------------------------------------------------
    function entry(node, up) {
      const item = make('button', 'rc-item'), row = make('span', 'rc-row'), amount = make('span', 'rc-size');
      item.type = 'button';
      row.append(make('span', 'rc-name', up ? '..'.padEnd(9) + '<DIR>' : dosName(node)), make('span', 'rc-lead'), amount);
      item.append(row, make('span', 'rc-long', up ? 'Parent directory' : node.long));
      if (up) {
        amount.textContent = 'UP';
        item.setAttribute('aria-label', 'Parent directory ' + pathOf(node));
      } else if (node.kind === 'dir') {
        amount.textContent = node.children.length + ' ITEMS';
        item.setAttribute('aria-label', `Directory ${node.name}, ${node.children.length} items: ${node.long}`);
      } else {
        amount.textContent = '...';
        sizeOf(node).then(n => { amount.textContent = n ? count(n) : '-'; });
        item.setAttribute('aria-label', `${node.long} (${node.name})`);
      }
      item.addEventListener('click', () => open(node));
      return item;
    }
    function listing(dir) {
      const box = make('div', 'rc-body');
      box.append(make('p', 'rc-line', ' Volume in drive C is SHUAIB'), make('p', 'rc-line', ' Directory of ' + pathOf(dir)));
      if (dir.note) box.append(make('p', 'rc-note', dir.note));
      const list = make('ul', 'rc-dir'), add = item => { const li = make('li'); li.append(item); list.append(li); };
      if (dir.parent) add(entry(dir.parent, true));
      else if (exit) {
        const link = make('a', 'rc-item'), row = make('span', 'rc-row');
        link.href = exit.href;
        row.append(make('span', 'rc-name', '..'.padEnd(9) + '<DIR>'), make('span', 'rc-lead'), make('span', 'rc-size', 'UP'));
        link.append(row, make('span', 'rc-long', exit.label));
        add(link);
      }
      dir.children.forEach(node => add(entry(node)));
      const kids = dir.children.filter(n => n.kind === 'file'), dirs = dir.children.length - kids.length;
      const totals = make('dl', 'rc-pairs rc-totals'), total = make('dd', null, '...');
      const pair = (term, value, cls) => {
        const row = make('div', cls);
        row.append(make('dt', null, term), typeof value === 'string' ? make('dd', null, value) : value);
        return row;
      };
      totals.append(pair('Dir(s)', String(dirs)), pair('File(s)', String(kids.length)), pair('**** Total bytes', total, 'rc-balance'));
      Promise.all(kids.map(sizeOf)).then(list => { total.textContent = count(list.reduce((a, b) => a + (b || 0), 0)); });
      box.append(list, make('hr', 'rc-rule'), totals);
      return box;
    }
    function body(node) {
      const box = make('div', 'rc-body');
      box.append(make('p', 'rc-line rc-quiet', `${pathOf(node.parent)}\\${node.name} is currently being printed`), make('hr', 'rc-rule'), ...render(node));
      return box;
    }
    function footer(node, no) {
      const foot = make('footer', 'rc-foot');
      foot.append(make('hr', 'rc-rule'));
      if (node.kind === 'file') {
        const eof = make('p', 'rc-eof', 'END OF FILE');
        sizeOf(node).then(n => { if (n) eof.textContent = `END OF FILE · ${count(n)} BYTES`; });
        foot.append(eof);
      } else {
        const job = make('div', 'rc-job');
        job.append(...[`Print job - ${top.name}`, `Directory: ${pathOf(node)}`, `Sequence number: ${no}`,
          `Total number of items listed = ${node.children.length}`, 'Response code: PRINTED'].map(line => make('p', null, line)));
        foot.append(job);
      }
      const nav = make('nav', 'rc-nav');
      nav.setAttribute('aria-label', 'Move through ' + top.name);
      const button = (content, target, verb) => {
        const b = make('button', null, content);
        b.type = 'button';
        if (!target) b.disabled = true;
        else {
          b.setAttribute('aria-label', `${verb} ${target.kind === 'dir' ? 'directory ' + target.name : target.name}: ${target.long}`);
          b.addEventListener('click', () => open(target));
        }
        return b;
      };
      nav.append(button('◂ PREV', prevOf(node), 'Prev:'), button(node.kind === 'file' ? '▴ DIR' : '▴ UP', node.parent, node.kind === 'file' ? 'Dir:' : 'Up:'), button('NEXT ▸', nextOf(node), 'Next:'));
      foot.append(nav);
      if (node === top) foot.append(make('p', 'rc-thanks', 'THANK YOU FOR READING AT SHUAIB AHMED NETWORK LABS'));
      const when = stamp(), code = barcode(`SA-${top.name}-${no}${node.name}`), bars = make('div', 'rc-barcode');
      foot.append(make('p', 'rc-stamp', `${when}  TKT ${no}  ${top.name}`));
      if (node === top && policy) {
        const terms = make('div', 'rc-policy');
        terms.append(make('strong', null, policy.title), make('p', null, policy.text));
        foot.append(terms);
      }
      bars.style.backgroundImage = code.image;
      const digits = make('p', 'rc-code', no + when.replace(/\D/g, '').slice(0, 6) + code.digits);
      for (const n of [bars, digits]) n.setAttribute('aria-hidden', 'true');
      foot.append(bars, digits, make('p', 'rc-bye', '** Thank You and please come again **'));
      return foot;
    }
    function ticket(node, commands) {
      const paper = make('article', 'rtv-ticket'), no = String(++serial).padStart(4, '0');
      paper.tabIndex = -1;
      paper.setAttribute('aria-label', node.kind === 'dir' ? `Directory ${pathOf(node)}: ${node.long}` : `${node.name}: ${node.long}`);
      const header = make('header', 'rc-head');
      if (node === top) {
        const logo = make('div', 'rc-logo');
        logo.append(make('b', null, 'SA'), make('strong', null, 'NETWORK LABS'));
        header.append(logo, ...LETTERHEAD.map(line => make('p', 'rc-small', line)), make('p', 'rc-band', top.long.toUpperCase()));
      }
      const meta = make('p', 'rc-meta');
      meta.append(make('span', null, stamp()), make('span', null, 'TKT ' + no));
      // Each ticket tears from a different stretch of the roll.
      const spot = (w, h) => `${-Math.round(Math.random() * w)}px ${-Math.round(Math.random() * h)}px`;
      paper.style.setProperty('--t1', spot(688, 432));
      paper.style.setProperty('--t2', spot(1007, 632));
      paper.style.setProperty('--bp', spot(330, 210));
      const command = make('h' + (level + 1), 'rc-cmd');
      commands.forEach(line => command.append(make('span', null, line)));
      header.append(meta, command);
      paper.append(header, make('hr', 'rc-rule rc-double'), node.kind === 'dir' ? listing(node) : body(node), footer(node, no));
      return paper;
    }

    // ---- Printing ---------------------------------------------------------------------------------------------
    const cdLine = (from, to) => {
      if (from === to) return null;
      const arg = to.parent === from ? to.name : from?.parent === to ? '..' : pathOf(to).slice(2);
      return (from ? pathOf(from) : 'C:\\') + '>CD ' + arg;
    };
    const finish = () => feeding?.done();
    function trim() {
      while (roll.children.length >= KEEP) {
        const old = roll.firstElementChild, height = old.offsetHeight;
        old.remove();
        roll.scrollTop -= height;
      }
    }
    // The paper leaves a fixed print head at the bottom of the tube, pushing older receipts up. Only the first
    // screenful animates; the rest is already printed when the ticket reaches its reading position.
    function feed(paper, animate) {
      return new Promise(resolve => {
        const view = roll.clientHeight, start = paper.offsetTop, gap = Math.round(view * .045);
        const travel = Math.min(paper.offsetHeight, view - gap), line = parseFloat(getComputedStyle(paper).lineHeight) || 18;
        let raf = 0, began = 0;
        const done = () => {
          cancelAnimationFrame(raf);
          paper.classList.remove('is-feeding');
          paper.style.removeProperty('--fed');
          roll.scrollTop = Math.max(0, start - view + travel);
          station.classList.remove('is-printing');
          feeding = null;
          sync();
          resolve();
        };
        const frame = now => {
          began ||= now;
          const fed = Math.min(travel, Math.ceil((now - began) * FEED / 1000 / line) * line);
          paper.style.setProperty('--fed', fed + 'px');
          roll.scrollTop = start - view + fed;
          head.style.transform = `translateY(${start + fed - roll.scrollTop}px)`;
          if (fed >= travel) done(); else raf = requestAnimationFrame(frame);
        };
        feeding = { done };
        station.classList.add('is-printing');
        sync();
        if (animate) raf = requestAnimationFrame(frame); else done();
      });
    }
    async function open(node, commands, { focus = true, quiet = false } = {}) {
      const id = ++job;
      finish();
      const cwd = current && (current.kind === 'dir' ? current : current.parent);
      const target = node.kind === 'dir' ? node : node.parent;
      const lines = commands || [cdLine(cwd, target), node.kind === 'dir' ? pathOf(node) + '>DIR > PRN' : pathOf(node.parent) + '>PRINT ' + node.name].filter(Boolean);
      current = node;
      trim();
      const paper = ticket(node, lines);
      paper.classList.add('is-feeding');
      paper.style.setProperty('--fed', '0px');
      roll.append(paper);
      sync();
      const boxes = [...paper.querySelectorAll('.rc-print[data-src]')];
      const images = await Promise.all(boxes.map(box => load(box.dataset.src)));
      boxes.forEach((box, i) => printImage(images[i], box, roll.clientHeight * .82));
      if (id !== job) {
        paper.classList.remove('is-feeding');
        paper.style.removeProperty('--fed');
        return;
      }
      if (focus) paper.focus({ preventScroll: true });
      if (!quiet) live.textContent = `Printed ${node.kind === 'dir' ? 'directory ' + pathOf(node) : node.name}: ${node.long}`;
      await feed(paper, !still());
    }
    async function printTicket() {
      const source = roll.lastElementChild;
      if (!source) return;
      finish();
      const paper = source.cloneNode(true);
      paper.className = 'rtv-ticket rtv-print-copy';
      ['style', 'tabindex'].forEach(a => paper.removeAttribute(a));
      const canvases = source.querySelectorAll('canvas'), pending = [];
      paper.querySelectorAll('canvas').forEach((canvas, i) => {
        const image = new Image();
        image.src = canvases[i].toDataURL();
        image.alt = '';
        image.className = 'rc-dots';
        image.style.cssText = canvases[i].style.cssText;
        pending.push(image.decode().catch(() => {}));
        canvas.replaceWith(image);
      });
      paper.querySelectorAll('.rc-nav').forEach(n => n.remove());
      await Promise.all(pending);
      document.body.append(paper);
      document.body.classList.add('printing-receipt');
      const cleanup = () => { paper.remove(); document.body.classList.remove('printing-receipt'); };
      addEventListener('afterprint', cleanup, { once: true });
      window.print();
    }

    // ---- Wiring -----------------------------------------------------------------------------------------------
    for (const type of ['wheel', 'touchstart', 'pointerdown']) roll.addEventListener(type, finish, { passive: true });
    roll.addEventListener('keydown', event => {
      finish();
      const item = event.target.closest?.('.rc-item');
      if (item && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        const items = [...item.closest('.rc-dir').querySelectorAll('.rc-item')], i = items.indexOf(item);
        items[(i + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
        event.preventDefault();
      } else if (event.key === 'Backspace' && current?.parent) {
        event.preventDefault();
        open(current.parent);
      }
    });
    document.addEventListener('crt-signal-change', event => { if (event.detail === 'off') finish(); });
    let plain = recall(viewKey) === 'plain';
    function setView(value, save) {
      plain = value;
      host.classList.toggle('receipt-on', !plain);
      viewButton.setAttribute('aria-pressed', String(plain));
      tv.root.hidden = plain;
      note.hidden = plain;
      if (save) remember(viewKey, plain ? 'plain' : null);
    }
    viewButton.addEventListener('click', () => setView(!plain, true));
    setView(plain, false);
    sync();
    let booted = false;
    new IntersectionObserver(entries => {
      if (booted || !entries.some(e => e.isIntersecting)) return;
      booted = true;
      open(top, boot, { focus: false, quiet: true });
    }, { threshold: .2 }).observe(tv.root);
    const api = { top, sequence, open, finish, setView, pathOf, tv, roll, get current() { return current; }, get plain() { return plain; } };
    station.receiptTv = api;
    return api;
  }
  window.ReceiptTV = { make, words, bytes, count, squash, shortName, claim, folder, file, plate, mount };
})();
