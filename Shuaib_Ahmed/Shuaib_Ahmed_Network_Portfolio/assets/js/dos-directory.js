/* Report TV: the complete lab report as a DOS directory on receipt paper (receipt-tv.js). Every file is built
   from the authored report, which stays in the page as the Plain view. */
(() => {
  'use strict';
  const article = document.querySelector('.detail-grid > article'), R = window.ReceiptTV;
  if (!article || !R) return;
  const { make, words, bytes, shortName, claim, folder, file, plate } = R;
  const grid = article.parentElement, aside = grid.querySelector(':scope > .detail-sidebar');
  const slug = location.pathname.split('/').pop().replace(/\.html?$/, '') || 'report';
  const records = window.LAB_TERMINALS || {}, guide = (window.LAB_RUNBOOKS || {})[slug];

  // ---- The report as a file system -------------------------------------------------------------------------
  function label(node) {
    const eyebrow = words(node.querySelector(':scope > .eyebrow'));
    const heading = words(node.querySelector(':scope > h2, :scope > h3, :scope > h4'));
    const fallback = words(node).slice(0, 60);
    return { key: eyebrow.split('·')[0].trim() || heading || fallback, long: eyebrow && heading ? `${eyebrow}: ${heading}` : eyebrow || heading || fallback };
  }
  const figuresOf = entry => entry.matches('figure') ? [entry] : [...entry.querySelectorAll('figure')];
  function caption(figure) {
    const cap = figure.querySelector('figcaption');
    const strong = words(cap?.querySelector('strong')).replace(/[.:]$/, '');
    return strong || words(cap).split(/\.\s/)[0].replace(/\.$/, '') || figure.querySelector('img')?.alt || 'Image';
  }
  const assetKey = src => decodeURIComponent(new URL(src, location.href).pathname).split('/assets/')[1];
  const transcript = image => image && records[assetKey(image.getAttribute('src'))];
  const textOf = blocks => blocks.map(block => {
    if (block.card) return words(block.card);
    if (block.guide) return block.guide.lines.join('\n');
    return figuresOf(block.figure).map(f => words(f.querySelector('figcaption')) + '\n' + (transcript(f.querySelector('img'))?.lines.join('\n') || '')).join('\n');
  }).join('\n');

  const name = shortName(slug.replace(/-/g, ' '), '', new Set());
  const top = folder(name, words(document.querySelector('h1')) || document.title, null, { base: 'C:\\LABS\\' + name });
  const addText = (parent, { key, long }, blocks) => file(parent, shortName(key, '.TXT', parent.taken), long, { blocks, images: [] });
  function addImage(parent, entry) {
    const images = figuresOf(entry).map(f => f.querySelector('img')).filter(Boolean);
    if (!images.length) return addText(parent, label(entry), [{ card: entry }]);
    const base = decodeURIComponent(new URL(images[0].src).pathname.split('/').pop());
    const dot = base.lastIndexOf('.'), ext = dot > 0 ? '.' + R.squash(base.slice(dot + 1)).slice(0, 3) : '.IMG';
    return file(parent, shortName(dot > 0 ? base.slice(0, dot) : base, ext, parent.taken), caption(figuresOf(entry)[0]), { blocks: [{ figure: entry }], images: images.map(i => i.src) });
  }
  // A card owns the figures that follow it. Four or more figures become a folder with the card as README.TXT.
  const groups = [];
  let group = null;
  for (const child of article.children) {
    if (child.matches('figure, .figure-pair')) {
      if (group) group.figures.push(child); else groups.push({ card: null, figures: [child] });
    } else groups.push(group = { card: child, figures: [] });
  }
  for (const { card, figures } of groups) {
    if (!card) { addImage(top, figures[0]); continue; }
    const named = label(card);
    if (figures.length >= 4) {
      const dir = folder(shortName(named.key, '', top.taken), named.long, top);
      file(dir, claim('README.TXT', 'Readme', '.TXT', dir.taken), named.long, { blocks: [{ card }], images: [] });
      figures.forEach(entry => addImage(dir, entry));
    } else addText(top, named, [{ card }, ...figures.map(figure => ({ figure }))]);
  }
  if (guide?.channels?.length) {
    const dir = folder(claim('SETUP', 'Setup', '', top.taken), 'Setup guides, reconstructed (not recorded evidence)', top, { note: guide.description });
    for (const channel of guide.channels) file(dir, shortName(channel.title.split('/')[0].trim(), '.TXT', dir.taken), channel.title, { blocks: [{ guide: channel }], images: [] });
  }
  if (aside) file(top, claim('SUMMARY.TXT', 'Lab summary', '.TXT', top.taken), label(aside).long, { blocks: [{ card: aside }], images: [] });
  (function measure(dir) { for (const node of dir.children) node.kind === 'dir' ? measure(node) : node.size = bytes(textOf(node.blocks)); })(top);

  // Image files report the real byte count of their originals.
  const sizes = new Map();
  const sizeOf = node => {
    if (!node.images.length) return Promise.resolve(node.size);
    if (!sizes.has(node)) sizes.set(node, Promise.all(node.images.map(src => fetch(src, { method: 'HEAD' })
      .then(r => (r.ok && Number(r.headers.get('content-length'))) || 0, () => 0))).then(list => list.reduce((a, b) => a + b, 0) || null));
    return sizes.get(node);
  };

  // ---- Printed content ---------------------------------------------------------------------------------------
  const scrub = (node, cls) => {
    if (node.nodeType !== 1) return node;
    for (const n of [node, ...node.querySelectorAll('*')]) ['id', 'class', 'style'].forEach(a => n.removeAttribute(a));
    if (cls) node.className = cls;
    return node;
  };
  const copy = (node, cls) => scrub(node.cloneNode(true), cls);
  const inner = (from, to) => { to.append(...[...from.childNodes].map(n => scrub(n.cloneNode(true)))); return to; };
  function card(source) {
    const out = [];
    for (const n of source.children) {
      if (n.matches('.eyebrow')) out.push(make('p', 'rc-eyebrow', words(n)));
      else if (n.matches('h1, h2, h3, h4, h5, h6')) out.push(make('h4', 'rc-title', words(n)));
      else if (n.matches('table')) out.push(table(n));
      else if (n.children.length === 1 && n.firstElementChild.matches('table')) out.push(table(n.firstElementChild));
      else if (n.matches('.metric-row')) out.push(metrics(n));
      else if (n.matches('.frame-visual')) out.push(copy(n, 'rc-frame'));
      else if (n.matches('.card-actions')) out.push(links(n));
      else if (n.matches('pre')) out.push(copy(n, 'rc-pre'));
      else if (n.matches('.fine-print')) out.push(copy(n, 'rc-fine'));
      else out.push(copy(n));
    }
    return out;
  }
  function table(source) {
    const rows = [...source.rows];
    if (!source.tHead && rows.length && rows.every(r => r.cells.length === 2 && r.cells[0].tagName === 'TH')) {
      const list = make('dl', 'rc-pairs');
      for (const r of rows) {
        const pair = make('div', words(r.cells[1]).length > 40 ? 'is-long' : null);
        pair.append(inner(r.cells[0], make('dt')), inner(r.cells[1], make('dd')));
        list.append(pair);
      }
      return list;
    }
    const wrap = make('div', 'rc-scroll');
    wrap.append(copy(source, 'rc-grid'));
    return wrap;
  }
  function metrics(row) {
    const list = make('dl', 'rc-pairs rc-metrics');
    for (const metric of row.querySelectorAll('.metric')) {
      const pair = make('div');
      pair.append(make('dt', null, words(metric.querySelector('span'))), make('dd', null, words(metric.querySelector('strong'))));
      list.append(pair);
    }
    return list;
  }
  function links(actions) {
    const list = make('ul', 'rc-links');
    for (const a of actions.querySelectorAll('a')) {
      const link = copy(a);
      link.textContent = '▸ ' + words(a).replace(/\s*[→>]+$/, '').toUpperCase();
      const item = make('li');
      item.append(link);
      list.append(item);
    }
    return list;
  }
  function figure(source) {
    const image = source.querySelector('img'), out = make('figure', 'rc-figure');
    out.append(plate(image && (image.currentSrc || image.src), image?.alt || 'Report image'));
    const cap = source.querySelector('figcaption');
    if (cap) out.append(inner(cap, make('figcaption')));
    if (image) {
      const link = make('a', 'rc-link', '▸ VIEW ORIGINAL');
      Object.assign(link, { href: image.src, target: '_blank', rel: 'noopener' });
      link.setAttribute('aria-label', 'View original image: ' + (image.alt || caption(source)));
      out.append(link);
    }
    const record = transcript(image);
    if (record) out.append(make('p', 'rc-eyebrow', 'Console transcript · recorded excerpt'),
      make('pre', 'rc-pre rc-transcript', record.lines.join('\n')), make('p', 'rc-fine', 'Brackets mark omitted output or masked values.'));
    return out;
  }
  const setup = channel => [make('p', 'rc-eyebrow', 'Setup guide · reconstructed'), make('h4', 'rc-title', channel.title),
    make('pre', 'rc-pre', channel.lines.join('\n')), make('p', 'rc-fine', 'Rebuilt from the published topology and captured state. The recorded evidence is in the report files.')];
  const render = node => node.blocks.flatMap(block => block.card ? card(block.card) : block.guide ? setup(block.guide) : figuresOf(block.figure).map(figure));

  const pictures = [...article.querySelectorAll('figure img')];
  const policy = [
    'Every file reprints the authored report. PLAIN VIEW shows the same report as a web page.',
    pictures.length && 'Images print from the original captures; VIEW ORIGINAL opens each one.',
    pictures.some(transcript) && 'Console transcripts are recorded excerpts. Brackets mark omitted output or masked values.',
    guide?.channels?.length && 'SETUP files are reconstructed from the published topology and captured state. They are not recorded evidence.'
  ].filter(Boolean).join(' ');

  R.mount({
    host: grid,
    place: station => article.prepend(station),
    title: 'Report TV',
    hint: 'Pick a file to print it on the tube. The deck walks the whole report: ROOT, PREV, NEXT and UP. PRINT sends the current receipt to your printer.',
    top, render, sizeOf,
    viewKey: 'sa-report-view',
    boot: ['C:\\>CD \\LABS\\' + top.name, top.base + '>DIR > PRN'],
    exit: { href: '../index.html#labs', label: 'C:\\LABS: every lab report' },
    policy: { title: 'EVIDENCE POLICY', text: policy },
    region: 'Report printout'
  });
})();
