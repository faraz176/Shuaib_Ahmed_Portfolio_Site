/* The photographic CRT/VCR housing as a reusable frame. The housing is a nine-slice border image, so a receipt
   TV can grow taller on phones without distorting the deck. Real buttons sit over the photographed ones. */
(() => {
  'use strict';
  const ICONS = { stop: '■', rew: '◂◂', play: '▶', ff: '▸▸', rec: '●', down: '▼', up: '▲', minus: '−', plus: '+', power: '⏻' };
  const make = (tag, cls, content) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (content != null) node.textContent = content;
    return node;
  };
  // keys: [{ key: 'stop' | 'rew' | ..., text: 'ROOT', name: 'Root: ...', action }]
  function build({ className = '', label, keys = [] }) {
    const root = make('div', ('sa-tv ' + className).trim());
    const frame = make('div', 'sa-tv-frame'), screen = make('div', 'sa-tv-screen'), glass = make('div', 'sa-tv-glass');
    const slot = make('p', 'sa-tv-slot');
    glass.setAttribute('aria-hidden', 'true');
    slot.setAttribute('aria-hidden', 'true');
    screen.append(glass);
    frame.append(screen, slot);
    const deck = make('div', 'sa-tv-deck');
    deck.setAttribute('role', 'group');
    deck.setAttribute('aria-label', label + ' controls');
    const buttons = {};
    for (const { key, text, name, action } of keys) {
      const button = make('button', 'sa-key sa-key-' + key);
      button.type = 'button';
      button.setAttribute('aria-label', name);
      const icon = make('span', 'sa-key-icon', ICONS[key] || '');
      icon.setAttribute('aria-hidden', 'true');
      button.append(icon, make('span', 'sa-key-text', text));
      if (action) button.addEventListener('click', action);
      deck.append(button);
      buttons[key] = button;
    }
    root.append(frame, deck);
    // Screen content goes beneath the glass layer.
    const show = (...nodes) => glass.before(...nodes);
    const relabel = (key, text, name) => {
      const button = buttons[key];
      if (!button) return;
      button.querySelector('.sa-key-text').textContent = text;
      button.setAttribute('aria-label', name);
    };
    return { root, frame, screen, glass, slot, deck, buttons, show, relabel };
  }
  window.TVFrame = { build, make };
})();
