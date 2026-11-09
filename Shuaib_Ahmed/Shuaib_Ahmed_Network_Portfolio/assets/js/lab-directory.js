/* Lab TV: the homepage lab cards as C:\LABS on receipt paper (receipt-tv.js). Each .RPT file summarizes one report
   and links to it; the cards stay in the page as the Plain view. */
(() => {
  if (document.body.classList.contains('dos-home')) return;
  'use strict';
  const section = document.querySelector('#labs'), cards = section?.querySelector('.lab-grid'), R = window.ReceiptTV;
  if (!cards || !R) return;
  const { make, words, bytes, shortName, claim, folder, file, plate } = R;
  const top = folder('LABS', words(section.querySelector('h2')) || 'Network labs and field reports', null, { base: 'C:\\LABS' });
  for (const card of cards.querySelectorAll('.lab-card')) {
    const link = card.querySelector('.card-actions a[href]');
    if (!link) continue;
    const slug = new URL(link.href).pathname.split('/').pop().replace(/\.html?$/, '');
    // Same short name the report TV gives the lab's own folder.
    const folderName = shortName(slug.replace(/-/g, ' '), '', new Set());
    file(top, claim(folderName + '.RPT', slug.replace(/-/g, ' '), '.RPT', top.taken), words(card.querySelector('h3')),
      { card, link, folderName, size: bytes(words(card.querySelector('.lab-body'))) });
  }

  function render({ card, link, folderName }) {
    const out = [], image = card.querySelector(':scope > img'), tool = card.querySelector(':scope > .lab-tool-visual');
    if (image) {
      const figure = make('figure', 'rc-figure');
      figure.append(plate(image.currentSrc || image.src, image.alt));
      out.push(figure);
    } else if (tool) {
      const readout = make('div', 'rc-readout');
      readout.setAttribute('aria-hidden', 'true');
      for (const part of tool.children) if (part.matches('span, strong, small, .binary-frame')) readout.append(make('p', part.tagName === 'STRONG' ? 'rc-big' : null, words(part)));
      out.push(readout);
    }
    const body = card.querySelector('.lab-body');
    for (const n of body.children) {
      if (n.matches('.eyebrow')) out.push(make('p', 'rc-eyebrow', words(n)));
      else if (n.matches('h3')) out.push(make('h5', 'rc-title', words(n)));
      else if (n.matches('.lab-tags')) out.push(make('p', 'rc-tags', [...n.children].map(tag => '#' + words(tag).toUpperCase().replace(/\s+/g, '_')).join('  ')));
      else if (n.matches('p')) out.push(make('p', null, words(n)));
    }
    const open = make('a', 'rc-open');
    open.href = link.href;
    open.append(make('span', null, '▸ ' + words(link).replace(/\s*[→>]+$/, '').toUpperCase()), make('small', null, `C:\\LABS>CD ${folderName}`));
    out.push(open);
    return out;
  }

  R.mount({
    host: section,
    place: station => cards.before(station),
    level: 3,
    title: 'Lab TV',
    hint: 'Each lab is a report file on C:\\LABS. Pick one to print its summary, then open the full report. ROOT, PREV, NEXT and UP on the deck walk the directory.',
    top, render,
    viewKey: 'sa-labs-view',
    boot: ['C:\\>CD \\LABS', 'C:\\LABS>DIR > PRN'],
    policy: { title: 'REPORT POLICY', text: words(section.querySelector('.section-copy')) },
    region: 'Lab directory printout'
  });
})();
