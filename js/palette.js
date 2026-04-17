/* ═══════════════════════════════════════════
   palette.js — Symbol palette for RE input
   ═══════════════════════════════════════════ */

const PALETTE_DATA = [
  {
    label: 'Operators',
    items: [
      { symbol: '|', tip: 'Union (OR)', displayHtml: '+' },
      { symbol: '()', tip: 'Grouping parentheses', displayHtml: '( )' },
    ]
  },
  {
    label: 'Quantifiers',
    items: [
      { symbol: '*', tip: 'Zero or more (Kleene star)', displayHtml: 'a<sup class="re-sup">*</sup>' },
      { symbol: '⁺', tip: 'One or more (Kleene plus)', displayHtml: 'a<sup class="re-sup">+</sup>' },
    ]
  },
  {
    label: 'Letters',
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

/**
 * Build the palette UI inside the container element.
 * @param {HTMLElement} container
 * @param {HTMLTextAreaElement} textarea
 */
function buildPalette(container, textareaOrGetter) {
  container.innerHTML = '';
  let isUpperCase = false; // track letter case state
  // Support both a direct element and a getter function
  const getTarget = typeof textareaOrGetter === 'function'
    ? textareaOrGetter
    : () => textareaOrGetter;

  PALETTE_DATA.forEach(group => {
    const groupEl = document.createElement('div');
    groupEl.className = 'palette__group';

    /* ── Header row ── */
    const headerRow = document.createElement('div');
    headerRow.className = 'palette__header-row';

    const label = document.createElement('span');
    label.className = 'palette__label';
    label.textContent = group.label;
    headerRow.appendChild(label);

    // Add case toggle for Letters group
    if (group.label === 'Letters') {
      const toggleWrap = document.createElement('div');
      toggleWrap.className = 'palette__case-switch';

      const labelLeft = document.createElement('span');
      labelLeft.className = 'palette__case-label palette__case-label--active';
      labelLeft.textContent = 'a';

      const track = document.createElement('button');
      track.type = 'button';
      track.className = 'palette__case-track';
      track.title = 'Switch between lowercase and uppercase';
      const knob = document.createElement('span');
      knob.className = 'palette__case-knob';
      track.appendChild(knob);

      const labelRight = document.createElement('span');
      labelRight.className = 'palette__case-label';
      labelRight.textContent = 'A';

      track.addEventListener('click', () => {
        isUpperCase = !isUpperCase;
        track.classList.toggle('palette__case-track--on', isUpperCase);
        labelLeft.classList.toggle('palette__case-label--active', !isUpperCase);
        labelRight.classList.toggle('palette__case-label--active', isUpperCase);
        // Update label text to say current mode
        label.textContent = isUpperCase ? 'Letters (Uppercase)' : 'Letters';
        // Update all letter buttons
        const letterBtns = groupEl.querySelectorAll('.palette__btn[data-letter]');
        letterBtns.forEach(btn => {
          const base = btn.getAttribute('data-letter');
          const ch = isUpperCase ? base.toUpperCase() : base;
          btn.textContent = ch;
          btn.setAttribute('data-tip', `Letter ${ch}`);
          btn.setAttribute('data-insert', ch);
        });
      });

      toggleWrap.appendChild(labelLeft);
      toggleWrap.appendChild(track);
      toggleWrap.appendChild(labelRight);
      headerRow.appendChild(toggleWrap);
    }

    groupEl.appendChild(headerRow);

    /* ── Buttons ── */
    const items = document.createElement('div');
    items.className = 'palette__items';

    group.items.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'palette__btn';

      if (item.displayHtml) {
        btn.innerHTML = item.displayHtml;
      } else {
        btn.textContent = item.symbol;
      }
      btn.setAttribute('data-tip', item.tip);

      // Mark letter buttons for toggle
      if (group.label === 'Letters') {
        btn.setAttribute('data-letter', item.symbol);
        btn.setAttribute('data-insert', item.symbol);
      }

      btn.addEventListener('click', () => {
        const textarea = getTarget();
        if (!textarea) return;
        let insertText;
        if (group.label === 'Letters') {
          insertText = btn.getAttribute('data-insert');
        } else {
          insertText = item.insert !== undefined ? item.insert : item.symbol;
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
 * Insert text at the current cursor position in a textarea.
 */
function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);
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
