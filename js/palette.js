/* ═══════════════════════════════════════════
   palette.js — Symbol palette for RE input
   ═══════════════════════════════════════════ */

const PALETTE_DATA = [
  {
    label: 'Operators',
    items: [
      { symbol: '|',  tip: 'Alternation (OR)', displayHtml: '<span class="re-or">+</span>' },
      { symbol: '()', tip: 'Grouping' },
    ]
  },
  {
    label: 'Quantifiers',
    items: [
      { symbol: '*', tip: 'Zero or more (Kleene star)', displayHtml: 'a<sup class="re-sup">*</sup>' },
      { symbol: '+', tip: 'One or more',                displayHtml: 'a<sup class="re-sup">+</sup>' },
    ]
  },
  {
    label: 'Letters',
    type: 'letters',
    items: 'abcdefghijklmnopqrstuvwxyz'.split('').map(ch => ({
      symbol: ch,
      tip: `Letter ${ch}`
    }))
  },
  {
    label: 'Digits & Epsilon',
    items: [
      ...'0123456789'.split('').map(d => ({ symbol: d, tip: `Digit ${d}` })),
      { symbol: 'ε', tip: 'Empty string (epsilon)', insert: 'ε' },
    ]
  }
];

/** Track capitalize state */
let _isCapitalized = false;

/**
 * Build the palette UI inside the container element.
 * @param {HTMLElement} container
 * @param {HTMLTextAreaElement} textarea
 */
function buildPalette(container, textarea) {
  container.innerHTML = '';

  PALETTE_DATA.forEach(group => {
    const groupEl = document.createElement('div');
    groupEl.className = 'palette__group';

    /* ── Header row (label + optional toggle) ── */
    const headerRow = document.createElement('div');
    headerRow.className = 'palette__header-row';

    const label = document.createElement('span');
    label.className = 'palette__label';
    label.textContent = group.label;
    headerRow.appendChild(label);

    /* Add capitalize toggle for the Letters group */
    if (group.type === 'letters') {
      const toggleWrap = document.createElement('label');
      toggleWrap.className = 'palette__toggle-wrap';
      toggleWrap.setAttribute('data-tip', 'Toggle uppercase / lowercase');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'palette__toggle-input';
      checkbox.checked = _isCapitalized;

      const slider = document.createElement('span');
      slider.className = 'palette__toggle-slider';

      const toggleLabel = document.createElement('span');
      toggleLabel.className = 'palette__toggle-label';
      toggleLabel.textContent = _isCapitalized ? 'A-Z' : 'a-z';

      toggleWrap.appendChild(checkbox);
      toggleWrap.appendChild(slider);
      toggleWrap.appendChild(toggleLabel);
      headerRow.appendChild(toggleWrap);

      checkbox.addEventListener('change', () => {
        _isCapitalized = checkbox.checked;
        toggleLabel.textContent = _isCapitalized ? 'A-Z' : 'a-z';
        updateLetterButtons(container);
      });
    }

    groupEl.appendChild(headerRow);

    /* ── Buttons ── */
    const items = document.createElement('div');
    items.className = 'palette__items';

    group.items.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'palette__btn';

      const displayChar = (group.type === 'letters' && _isCapitalized)
        ? item.symbol.toUpperCase()
        : item.symbol;

      if (item.displayHtml) {
        btn.innerHTML = item.displayHtml;
      } else {
        btn.textContent = displayChar;
      }
      btn.setAttribute('data-tip', item.tip);

      if (group.type === 'letters') {
        btn.classList.add('palette__btn--letter');
        btn.setAttribute('data-base', item.symbol);
      }

      btn.addEventListener('click', () => {
        let insertText;
        if (item.insert !== undefined) {
          insertText = item.insert;
        } else if (group.type === 'letters' && _isCapitalized) {
          insertText = item.symbol.toUpperCase();
        } else {
          insertText = item.symbol;
        }
        insertAtCursor(textarea, insertText);
        textarea.focus();
      });

      items.appendChild(btn);
    });

    groupEl.appendChild(items);
    container.appendChild(groupEl);
  });
}

/**
 * Update all letter buttons when capitalize is toggled.
 */
function updateLetterButtons(container) {
  container.querySelectorAll('.palette__btn--letter').forEach(btn => {
    const base = btn.getAttribute('data-base');
    const display = _isCapitalized ? base.toUpperCase() : base;
    btn.textContent = display;
    btn.setAttribute('data-tip', `Letter ${display}`);
  });
}

/**
 * Insert text at the current cursor position in a textarea.
 */
function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart;
  const end   = textarea.selectionEnd;
  const before = textarea.value.substring(0, start);
  const after  = textarea.value.substring(end);
  textarea.value = before + text + after;

  // If we inserted "()", place cursor inside the parens
  if (text === '()') {
    textarea.selectionStart = textarea.selectionEnd = start + 1;
  } else {
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
  }

  // Fire input event so any listeners can react
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}
