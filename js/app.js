/* ═══════════════════════════════════════════
   app.js — Wire everything together
   ═══════════════════════════════════════════ */

/* ── Shared regex suggestions (single source of truth) ── */
const RE_SUGGESTIONS = [];

/**
 * Attach a suggestion popover to an input/textarea element.
 * Shows when the field is focused AND empty; hides on outside click,
 * close button, or suggestion selection.
 */
function setupSuggestionPopover(inputEl) {
  let popover = null;

  function getInputValue() {
    return inputEl.value.trim();
  }

  function createPopover() {
    const pop = document.createElement('div');
    pop.className = 're-suggestion-popover';

    // Header with title + close button
    const header = document.createElement('div');
    header.className = 're-suggestion-popover__header';

    const title = document.createElement('span');
    title.className = 're-suggestion-popover__title';
    title.textContent = 'Suggestions';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 're-suggestion-popover__close';
    closeBtn.innerHTML = '&times;';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hidePopover();
    });
    header.appendChild(closeBtn);
    pop.appendChild(header);

    // Suggestion list
    const list = document.createElement('ul');
    list.className = 're-suggestion-popover__list';

    RE_SUGGESTIONS.forEach(item => {
      const li = document.createElement('li');
      li.className = 're-suggestion-popover__item';
      li.textContent = item.display;
      li.addEventListener('click', (e) => {
        e.stopPropagation();
        // Set value and fire input event
        inputEl.value = item.insert;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.focus();
        hidePopover();
      });
      list.appendChild(li);
    });

    pop.appendChild(list);
    return pop;
  }

  function showPopover() {
    if (popover) return; // already open
    // Only show when input is empty
    if (getInputValue() !== '') return;

    popover = createPopover();
    // Append to the input's positioned parent
    const parent = inputEl.parentElement;
    parent.style.position = 'relative';
    parent.appendChild(popover);
  }

  function hidePopover() {
    if (!popover) return;
    popover.remove();
    popover = null;
  }

  // Show on focus if empty
  inputEl.addEventListener('focus', () => {
    if (getInputValue() === '') {
      showPopover();
    }
  });

  // Show on click if empty (handles re-click after clearing)
  inputEl.addEventListener('click', () => {
    if (getInputValue() === '' && !popover) {
      showPopover();
    }
  });

  // Hide when user starts typing
  inputEl.addEventListener('input', () => {
    if (getInputValue() !== '') {
      hidePopover();
    }
  });

  // Close on outside click
  document.addEventListener('mousedown', (e) => {
    if (popover && !popover.contains(e.target) && e.target !== inputEl) {
      hidePopover();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const reInput = document.getElementById('re-input');
  const btnGenerate = document.getElementById('btn-generate');
  const palette = document.getElementById('palette');
  const resultsMeta = document.getElementById('results-meta');
  const resultsGrid = document.getElementById('results-grid');
  const stringCount = document.getElementById('string-count');

  const equivRe1 = document.getElementById('equiv-re1');
  const equivRe2 = document.getElementById('equiv-re2');
  const btnEquiv = document.getElementById('btn-equiv');
  const equivResult = document.getElementById('equiv-result');

  const btnTestString = document.getElementById('btn-test-string');
  const membershipPanel = document.getElementById('membership-panel');
  const membershipClose = document.getElementById('membership-close');
  const membershipInput = document.getElementById('membership-input');
  const btnCheckMembership = document.getElementById('btn-check-membership');
  const btnInsertEpsilon = document.getElementById('btn-insert-epsilon');
  const membershipResult = document.getElementById('membership-result');


  /* ── Epsilon button in membership panel ── */
  btnInsertEpsilon.addEventListener('click', () => {
    insertAtCursor(membershipInput, 'ε');
    membershipInput.focus();
  });

  /* ── Tab switching ─────────────────── */
  const tabBtns = document.querySelectorAll('.tab-nav__btn');
  const pages = document.querySelectorAll('.page');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      tabBtns.forEach(b => b.classList.remove('tab-nav__btn--active'));
      btn.classList.add('tab-nav__btn--active');
      pages.forEach(p => p.classList.remove('page--active'));
      document.getElementById('page-' + target).classList.add('page--active');
    });
  });

  /* ── Build the palette ─────────────── */
  buildPalette(palette, reInput);

  /* ── Build equivalence palette ─────── */
  const equivPalette = document.getElementById('equiv-palette');
  let lastFocusedEquivInput = equivRe1; // default to first
  equivRe1.addEventListener('focus', () => { lastFocusedEquivInput = equivRe1; });
  equivRe2.addEventListener('focus', () => { lastFocusedEquivInput = equivRe2; });
  buildPalette(equivPalette, () => lastFocusedEquivInput);

  /* ── Reset membership state when regex changes ── */
  reInput.addEventListener('input', () => {
    membershipResult.innerHTML = '';
  });

  /* ── Superscript & Inline-OR overlays ── */
  setupRegexOverlay(reInput, 're-overlay');
  setupRegexOverlay(equivRe1, 'field-overlay');
  setupRegexOverlay(equivRe2, 'field-overlay');




  /* ── Generate strings ──────────────── */
  btnGenerate.addEventListener('click', () => {
    const pattern = reInput.value.replace(/\s+/g, '');
    if (!pattern) {
      showError(resultsGrid, resultsMeta, 'Please enter a regular expression first.');
      return;
    }
    try {
      const count = parseInt(stringCount.value, 10) || 50;
      const strings = generateStrings(pattern, count);
      renderResults(resultsGrid, resultsMeta, strings, pattern);
      membershipResult.innerHTML = '';
    } catch (err) {
      showError(resultsGrid, resultsMeta, err.message);
    }
  });

  // 'Test String' button toggles the membership panel
  btnTestString.addEventListener('click', () => {
    const isOpen = membershipPanel.style.display !== 'none';
    if (isOpen) {
      membershipPanel.style.display = 'none';
    } else {
      membershipPanel.style.display = '';
      membershipInput.focus();
    }
  });

  // Close button inside membership panel
  membershipClose.addEventListener('click', () => {
    membershipPanel.style.display = 'none';
  });

  // Also allow Ctrl+Enter to generate
  reInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      btnGenerate.click();
    }
  });

  /* ── Shift+4 → Insert ε ─────────────── */
  function handleEpsilonShortcut(e) {
    if (e.shiftKey && e.key === '$') {
      e.preventDefault();
      const el = e.target;
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        insertAtCursor(el, 'ε');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }
  document.addEventListener('keydown', handleEpsilonShortcut);

  /* ── + key → insert | (union, displayed as normal +) ── */
  /* ── = key → insert ⁺ (Kleene plus, displayed as superscript +) ── */
  function handlePlusEqualsShortcut(e) {
    const el = e.target;
    if (el.tagName !== 'TEXTAREA' && el.tagName !== 'INPUT') return;
    // Only intercept on regex-related inputs
    const isRegexField = el === reInput || el === equivRe1 || el === equivRe2;
    if (!isRegexField) return;

    if (e.key === '+') {
      // Shift+= produces '+', intercept and insert '|' (union)
      e.preventDefault();
      insertAtCursor(el, '|');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (e.key === '=' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      // = key inserts '+' (Kleene plus, rendered as superscript by overlay)
      e.preventDefault();
      insertAtCursor(el, '+');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  document.addEventListener('keydown', handlePlusEqualsShortcut);



  /* ── String membership check ────────── */
  btnCheckMembership.addEventListener('click', () => {
    const currentPattern = reInput.value.replace(/\s+/g, '');
    if (!currentPattern) {
      membershipResult.innerHTML = `<div class="result-error" style="margin-top:.5rem"><svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10c0 4.418-3.582 8-8 8s-8-3.582-8-8 3.582-8 8-8 8 3.582 8 8zm-8-4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg> Please enter a regular expression first.</div>`;
      return;
    }
    let testStr = membershipInput.value;
    // Strip all ε / ϵ characters (epsilon = empty string, so remove them)
    testStr = testStr.replace(/[εϵ]/g, '');
    try {
      const nfa = reToNFA(currentPattern);
      const dfa = nfaToDFA(nfa);
      const minDFA = minimizeDFA(dfa);
      const accepted = simulateDFA(minDFA, testStr);
      renderMembershipResult(membershipResult, testStr, accepted, currentPattern);
    } catch (err) {
      membershipResult.innerHTML = `<div class="result-error" style="margin-top:.5rem"><svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10c0 4.418-3.582 8-8 8s-8-3.582-8-8 3.582-8 8-8 8 3.582 8 8zm-8-4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg> ${escapeHtml(err.message)}</div>`;
    }
  });

  // Allow Enter in membership input
  membershipInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnCheckMembership.click();
    }
  });

  /* ── Equivalence check ─────────────── */
  btnEquiv.addEventListener('click', () => {
    const r1 = equivRe1.value.replace(/\s+/g, '');
    const r2 = equivRe2.value.replace(/\s+/g, '');
    if (!r1 || !r2) {
      renderEquivResult(equivResult, null, null, null, 'Please enter both regular expressions.');
      return;
    }
    try {
      const result = checkEquivalence(r1, r2);
      const dfas = getMinimizedDFAs(r1, r2);
      if (!result.equivalent && result.counterExample) {
        const trace = buildMismatchTrace(r1, r2, result.counterExample);
        renderEquivResult(equivResult, result, r1, r2, null, trace, dfas);
      } else {
        renderEquivResult(equivResult, result, r1, r2, null, null, dfas);
      }
    } catch (err) {
      renderEquivResult(equivResult, null, null, null, err.message);
    }
  });

  // Allow Enter in equiv inputs
  [equivRe1, equivRe2].forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnEquiv.click();
      }
    });
  });
});

/* ── Render generated strings ──────── */
function renderResults(grid, meta, strings, pattern) {
  meta.innerHTML = `${strings.length} string${strings.length !== 1 ? 's' : ''} generated from: <code>${formatRegexHtml(pattern)}</code>`;

  grid.innerHTML = '';
  strings.forEach((s, i) => {
    const chip = document.createElement('span');
    chip.className = 'result-chip' + (s === '' ? ' result-chip--empty' : '');
    chip.textContent = s === '' ? 'ε (empty)' : s;
    chip.style.animationDelay = `${i * 25}ms`;
    grid.appendChild(chip);
  });

  if (strings.length === 0) {
    const chip = document.createElement('span');
    chip.className = 'result-chip result-chip--empty';
    chip.textContent = 'No strings generated';
    grid.appendChild(chip);
  }
}

/* ── Render membership test result ──── */
function renderMembershipResult(container, testStr, accepted, pattern) {
  const displayStr = testStr === '' ? 'ε' : escapeHtml(testStr);
  const regexHtml = pattern ? formatRegexHtml(pattern) : '';
  const cls = accepted ? 'membership-badge--accepted' : 'membership-badge--rejected';
  const icon = accepted
    ? '<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clip-rule="evenodd"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>';
  const belongsSymbol = accepted ? '∈' : '∉';
  const label = accepted ? 'Accepted' : 'Rejected';
  container.innerHTML = `<div class="membership-badge ${cls}" style="margin-top:.6rem">${icon} <code>${displayStr}</code> ${belongsSymbol} L(<code>${regexHtml}</code>) — <strong>${label}</strong></div>`;
}

/* ── Show error ────────────────────── */
function showError(grid, meta, message) {
  meta.textContent = '';
  grid.innerHTML = '';
  const err = document.createElement('div');
  err.className = 'result-error';
  err.innerHTML = `<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10c0 4.418-3.582 8-8 8s-8-3.582-8-8 3.582-8 8-8 8 3.582 8 8zm-8-4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg> ${escapeHtml(message)}`;
  grid.appendChild(err);
}

/* ══════════════════════════════════════════════
   Render equivalence result
   NEW LAYOUT ORDER:
     1. DFA diagrams side by side
     2. Transition tables side by side
     3. Equivalent badge / counter-example / trace
   ══════════════════════════════════════════════ */
function renderEquivResult(container, result, re1, re2, errorMsg, trace, dfas) {
  container.innerHTML = '';

  if (errorMsg) {
    const err = document.createElement('div');
    err.className = 'result-error';
    err.style.marginTop = '.75rem';
    err.innerHTML = `<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10c0 4.418-3.582 8-8 8s-8-3.582-8-8 3.582-8 8-8 8 3.582 8 8zm-8-4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg> ${escapeHtml(errorMsg)}`;
    container.appendChild(err);
    return;
  }

  // ─── 1. DFA diagrams + tables side by side (always shown) ───
  if (dfas) {
    container.appendChild(renderDFASection(dfas, re1, re2));
  }

  // ─── 2. Result badge ───
  const resultBox = document.createElement('div');
  resultBox.className = 'box';
  resultBox.style.marginTop = '1.25rem';

  if (result.equivalent) {
    const badge = document.createElement('div');
    badge.className = 'equiv-badge equiv-badge--yes';
    badge.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clip-rule="evenodd"/></svg> Equivalent — Both REs describe the same language`;
    resultBox.appendChild(badge);

    // Show matching strings in a trace table
    try {
      const matchingStrings = generateStrings(re1, 20);
      if (matchingStrings.length > 0) {
        const wrapper = document.createElement('div');
        wrapper.className = 'trace-wrapper';

        const heading = document.createElement('div');
        heading.className = 'equiv-strings-heading';
        heading.textContent = `First ${matchingStrings.length} matching string${matchingStrings.length !== 1 ? 's' : ''} in the language:`;
        wrapper.appendChild(heading);

        const table = document.createElement('div');
        table.className = 'trace-table';

        const headerRow = document.createElement('div');
        headerRow.className = 'trace-row trace-row--header';
        headerRow.innerHTML = `
          <div class="trace-cell trace-cell--len">Length</div>
          <div class="trace-cell trace-cell--str">String</div>
          <div class="trace-cell trace-cell--re"><code>${formatRegexHtml(re1)}</code></div>
          <div class="trace-cell trace-cell--re"><code>${formatRegexHtml(re2)}</code></div>
          <div class="trace-cell trace-cell--status">Match?</div>
        `;
        table.appendChild(headerRow);

        matchingStrings.forEach((s, i) => {
          const row = document.createElement('div');
          row.className = 'trace-row trace-row--ok';
          row.style.animationDelay = `${i * 100}ms`;
          row.style.setProperty('--row-delay', `${i * 100}ms`);
          const displayStr = s === '' ? 'ε' : s;
          const strLen = s === '' ? 0 : s.length;
          row.innerHTML = `
            <div class="trace-cell trace-cell--len">${strLen}</div>
            <div class="trace-cell trace-cell--str"><code>${escapeHtml(displayStr)}</code></div>
            <div class="trace-cell trace-cell--re"><span class="trace-icon trace-icon--yes">✓</span></div>
            <div class="trace-cell trace-cell--re"><span class="trace-icon trace-icon--yes">✓</span></div>
            <div class="trace-cell trace-cell--status"><span class="trace-icon trace-icon--yes">✓ Same</span></div>
          `;
          table.appendChild(row);
        });

        wrapper.appendChild(table);
        resultBox.appendChild(wrapper);
      }
    } catch (e) {
      // silently ignore
    }

    container.appendChild(resultBox);
    return;
  }

  /* ─── Not equivalent ─── */

  // Badge
  const badge = document.createElement('div');
  badge.className = 'equiv-badge equiv-badge--no';
  badge.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg> Not Equivalent`;
  resultBox.appendChild(badge);

  // Counter-example
  if (result.counterExample !== null) {
    const counter = document.createElement('div');
    counter.className = 'counter-callout';
    const acceptedRE = result.acceptedBy1 ? re1 : re2;
    const rejectedRE = result.acceptedBy1 ? re2 : re1;
    counter.innerHTML = `
      <span class="counter-callout__label">Counter-example found:</span>
      <code class="counter-callout__value">${escapeHtml(result.counterExample)}</code>
      <span class="counter-callout__desc">This string is accepted by <code>${formatRegexHtml(acceptedRE)}</code> but rejected by <code>${formatRegexHtml(rejectedRE)}</code>.</span>
    `;
    resultBox.appendChild(counter);
  }

  // Animated trace table
  if (trace && trace.length > 0) {
    const wrapper = document.createElement('div');
    wrapper.className = 'trace-wrapper';

    const heading = document.createElement('div');
    heading.className = 'trace-heading';
    heading.textContent = 'Scanning string lengths…';
    wrapper.appendChild(heading);

    const table = document.createElement('div');
    table.className = 'trace-table';

    const headerRow = document.createElement('div');
    headerRow.className = 'trace-row trace-row--header';
    headerRow.innerHTML = `
      <div class="trace-cell trace-cell--len">Length</div>
      <div class="trace-cell trace-cell--str">String</div>
      <div class="trace-cell trace-cell--re"><code>${formatRegexHtml(re1)}</code></div>
      <div class="trace-cell trace-cell--re"><code>${formatRegexHtml(re2)}</code></div>
      <div class="trace-cell trace-cell--status">Match?</div>
    `;
    table.appendChild(headerRow);

    let rowIndex = 0;
    let foundMismatch = false;
    for (const step of trace) {
      if (foundMismatch) break;
      for (const sample of step.samples) {
        const row = document.createElement('div');
        const isMismatch = sample.mismatch;
        row.className = 'trace-row' + (isMismatch ? ' trace-row--mismatch' : ' trace-row--ok');
        row.style.animationDelay = `${rowIndex * 400}ms`;

        const accept1Icon = sample.accept1
          ? '<span class="trace-icon trace-icon--yes">✓</span>'
          : '<span class="trace-icon trace-icon--no">✗</span>';
        const accept2Icon = sample.accept2
          ? '<span class="trace-icon trace-icon--yes">✓</span>'
          : '<span class="trace-icon trace-icon--no">✗</span>';
        const statusIcon = isMismatch
          ? '<span class="trace-icon trace-icon--no">✗ Diverge</span>'
          : '<span class="trace-icon trace-icon--yes">✓ Same</span>';

        row.innerHTML = `
          <div class="trace-cell trace-cell--len">${step.length}</div>
          <div class="trace-cell trace-cell--str"><code>${escapeHtml(sample.str)}</code></div>
          <div class="trace-cell trace-cell--re">${accept1Icon}</div>
          <div class="trace-cell trace-cell--re">${accept2Icon}</div>
          <div class="trace-cell trace-cell--status">${statusIcon}</div>
        `;

        table.appendChild(row);
        rowIndex++;

        if (isMismatch) { foundMismatch = true; break; }
      }
    }

    wrapper.appendChild(table);
    resultBox.appendChild(wrapper);

    const totalDelay = rowIndex * 400 + 200;
    setTimeout(() => {
      heading.textContent = `Divergence found at length ${trace.find(t => t.hasMismatch)?.length ?? '?'}`;
      heading.classList.add('trace-heading--done');
    }, totalDelay);
  }

  container.appendChild(resultBox);
}

/* ══════════════════════════════════════════════
   Render DFA section — diagrams & tables
   side by side in a 2-column grid
   ══════════════════════════════════════════════ */
function renderDFASection(dfas, re1, re2) {
  const section = document.createElement('div');
  section.className = 'dfa-section';
  section.style.marginTop = '1.25rem';

  // Diagrams heading
  const diagramHeading = document.createElement('div');
  diagramHeading.className = 'dfa-section-heading';
  diagramHeading.textContent = 'Minimized DFA Diagrams';
  section.appendChild(diagramHeading);

  // Diagrams grid (side by side)
  const diagramGrid = document.createElement('div');
  diagramGrid.className = 'dfa-grid';

  const { card: card1, container: container1 } = renderSingleDFADiagramOnly(dfas.min1, `Expression 1: <code>${formatRegexHtml(re1)}</code>`);
  const { card: card2, container: container2 } = renderSingleDFADiagramOnly(dfas.min2, `Expression 2: <code>${formatRegexHtml(re2)}</code>`);
  diagramGrid.appendChild(card1);
  diagramGrid.appendChild(card2);
  section.appendChild(diagramGrid);

  // Equalize DFA container heights after both SVGs are rendered
  // Use setTimeout to ensure renderDFADiagram's internal rAF has completed
  setTimeout(() => {
    const svg1 = container1.querySelector('svg');
    const svg2 = container2.querySelector('svg');
    const h1 = svg1 ? parseInt(svg1.getAttribute('height')) || 250 : 250;
    const h2 = svg2 ? parseInt(svg2.getAttribute('height')) || 250 : 250;
    const maxH = Math.max(h1, h2, 250);
    container1.style.height = maxH + 'px';
    container2.style.height = maxH + 'px';
  }, 200);

  // Tables heading
  const tableHeading = document.createElement('div');
  tableHeading.className = 'dfa-section-heading';
  tableHeading.style.marginTop = '1.5rem';
  tableHeading.textContent = 'Transition Tables';
  section.appendChild(tableHeading);

  // Tables grid (side by side)
  const tableGrid = document.createElement('div');
  tableGrid.className = 'dfa-grid';
  tableGrid.appendChild(renderSingleDFATableOnly(dfas.min1, `Expression 1: <code>${formatRegexHtml(re1)}</code>`));
  tableGrid.appendChild(renderSingleDFATableOnly(dfas.min2, `Expression 2: <code>${formatRegexHtml(re2)}</code>`));
  section.appendChild(tableGrid);

  return section;
}

/* ── Toggle DFA fullscreen (Browser Fullscreen API) ── */
const ICON_ENTER_FS = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>`;
const ICON_EXIT_FS = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6m10-10h-6V4m0 6l7-7M3 21l7-7"/></svg>`;

function refitDFADiagram(card) {
  const container = card.querySelector('.dfa-diagram-container');
  if (!container) return;
  // Hide content while we wait for the container to get its new dimensions
  const panLayer = container.querySelector('.dfa-pan-layer');
  if (panLayer) panLayer.style.opacity = '0';
  // Wait for layout to settle, then fit and reveal
  setTimeout(() => {
    container.dispatchEvent(new Event('dfa-fit'));
    if (panLayer) {
      // Small delay after fit to ensure transform is applied before reveal
      requestAnimationFrame(() => {
        panLayer.style.transition = 'opacity 0.15s ease';
        panLayer.style.opacity = '1';
        // Clean up transition after it completes
        setTimeout(() => { panLayer.style.transition = ''; }, 200);
      });
    }
  }, 100);
}

function enterCSSFullscreen(card) {
  // Hide graph immediately before layout change
  const panLayer = card.querySelector('.dfa-diagram-container .dfa-pan-layer');
  if (panLayer) panLayer.style.opacity = '0';
  card.classList.add('dfa-card--fullscreen');
  document.body.classList.add('has-fullscreen-dfa');
  const btn = card.querySelector('.dfa-fullscreen-btn');
  if (btn) { btn.innerHTML = ICON_EXIT_FS; btn.title = 'Exit fullscreen (Esc)'; }
  refitDFADiagram(card);
}

function exitCSSFullscreen(card) {
  // Hide graph immediately before layout change
  const panLayer = card.querySelector('.dfa-diagram-container .dfa-pan-layer');
  if (panLayer) panLayer.style.opacity = '0';
  card.classList.remove('dfa-card--fullscreen');
  document.body.classList.remove('has-fullscreen-dfa');
  const btn = card.querySelector('.dfa-fullscreen-btn');
  if (btn) { btn.innerHTML = ICON_ENTER_FS; btn.title = 'Toggle fullscreen'; }
  refitDFADiagram(card);
}

function toggleDFAFullscreen(card) {
  // Try real fullscreen first
  if (document.fullscreenElement === card) {
    document.exitFullscreen().catch(() => exitCSSFullscreen(card));
    return;
  }
  if (card.classList.contains('dfa-card--fullscreen')) {
    // Already in CSS fallback fullscreen — exit it
    exitCSSFullscreen(card);
    return;
  }
  // Attempt native fullscreen
  if (card.requestFullscreen) {
    card.requestFullscreen().catch(() => {
      // Native fullscreen failed (e.g. not trusted gesture) — use CSS fallback
      enterCSSFullscreen(card);
    });
  } else {
    // API not available — CSS fallback
    enterCSSFullscreen(card);
  }
}

// Global listener: update card styling & icons on native fullscreen change
document.addEventListener('fullscreenchange', () => {
  document.querySelectorAll('.dfa-card').forEach(card => {
    const btn = card.querySelector('.dfa-fullscreen-btn');
    if (!btn) return;
    // Hide graph before refit
    const panLayer = card.querySelector('.dfa-diagram-container .dfa-pan-layer');
    if (panLayer) panLayer.style.opacity = '0';

    if (document.fullscreenElement === card) {
      card.classList.add('dfa-card--fullscreen');
      btn.innerHTML = ICON_EXIT_FS;
      btn.title = 'Exit fullscreen (Esc)';
      refitDFADiagram(card);
    } else {
      card.classList.remove('dfa-card--fullscreen');
      document.body.classList.remove('has-fullscreen-dfa');
      btn.innerHTML = ICON_ENTER_FS;
      btn.title = 'Toggle fullscreen';
      refitDFADiagram(card);
    }
  });
});

// Escape key to exit CSS fallback fullscreen
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const fs = document.querySelector('.dfa-card--fullscreen');
    if (fs && !document.fullscreenElement) {
      exitCSSFullscreen(fs);
    }
  }
});

/* ── Render ONLY the DFA diagram card ── */
function renderSingleDFADiagramOnly(minDFA, labelHtml) {
  const card = document.createElement('div');
  card.className = 'dfa-card';

  const title = document.createElement('div');
  title.className = 'dfa-card-title';
  title.innerHTML = labelHtml;
  card.appendChild(title);

  const completeDFA = addDeadState(minDFA);

  const diagramContainer = document.createElement('div');
  diagramContainer.className = 'dfa-diagram-container';
  card.appendChild(diagramContainer);

  // Fullscreen toggle button
  const fsBtn = document.createElement('button');
  fsBtn.type = 'button';
  fsBtn.className = 'dfa-fullscreen-btn';
  fsBtn.title = 'Toggle fullscreen';
  fsBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>`;
  fsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDFAFullscreen(card);
  });
  card.appendChild(fsBtn);

  requestAnimationFrame(() => {
    renderDFADiagram(completeDFA, diagramContainer);
  });

  return { card, container: diagramContainer };
}

/* ── Render ONLY the DFA transition table card ── */
function renderSingleDFATableOnly(minDFA, labelHtml) {
  const card = document.createElement('div');
  card.className = 'dfa-card';

  const title = document.createElement('div');
  title.className = 'dfa-card-title';
  title.innerHTML = labelHtml;
  card.appendChild(title);

  const completeDFA = addDeadState(minDFA);
  const alpha = [...completeDFA.alphabet].sort();

  // BFS for state ordering
  const mainIds = [];
  const deadId = -999;
  const visited = new Set();
  const queue = [completeDFA.start];
  visited.add(completeDFA.start);

  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur !== deadId) mainIds.push(cur);
    const st = completeDFA.states.get(cur);
    if (!st) continue;
    for (const ch of alpha) {
      const tgt = st.transitions[ch];
      if (tgt !== undefined && !visited.has(tgt)) {
        visited.add(tgt);
        queue.push(tgt);
      }
    }
  }
  for (const id of completeDFA.states.keys()) {
    if (id !== deadId && !visited.has(id)) mainIds.push(id);
  }

  const stateIds = [...mainIds];
  if (completeDFA.states.has(deadId)) stateIds.push(deadId);

  const stateLabel = new Map();
  let qIdx = 0;
  stateIds.forEach((id) => {
    stateLabel.set(id, id === deadId ? 'dead' : `q${qIdx++}`);
  });

  // Build table
  const table = document.createElement('table');
  table.className = 'dfa-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.innerHTML = `<th>State</th>` + alpha.map(ch => `<th>${escapeHtml(ch)}</th>`).join('');
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const sid of stateIds) {
    const st = completeDFA.states.get(sid);
    const row = document.createElement('tr');
    if (sid === -999) row.className = 'dfa-row--dead';
    else if (st.accept) row.className = 'dfa-row--accept';

    const prefix = sid === completeDFA.start ? '→ ' : '';
    const labelStr = stateLabel.get(sid);
    const displayLabel = st.accept ? `<span class="state-circle">${labelStr}</span>` : labelStr;
    let cells = `<td class="dfa-cell-state">${prefix}${displayLabel}</td>`;
    for (const ch of alpha) {
      const target = st.transitions[ch];
      cells += `<td>${target !== undefined ? stateLabel.get(target) : '—'}</td>`;
    }
    row.innerHTML = cells;
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  card.appendChild(table);

  // Stats
  const stats = document.createElement('div');
  stats.className = 'dfa-stats';
  const hasDead = completeDFA.states.has(-999);
  stats.textContent = `${stateIds.length} state${stateIds.length !== 1 ? 's' : ''} · ${alpha.length} symbol${alpha.length !== 1 ? 's' : ''}${hasDead ? ' · 1 dead' : ''}`;
  card.appendChild(stats);

  return card;
}

/* ── Add dead state to make DFA complete ── */
function addDeadState(minDFA) {
  const alpha = [...minDFA.alphabet];
  let needsDead = false;
  for (const [sid, st] of minDFA.states) {
    for (const ch of alpha) {
      if (st.transitions[ch] === undefined) { needsDead = true; break; }
    }
    if (needsDead) break;
  }
  if (!needsDead) return minDFA;

  const DEAD = -999;
  const newStates = new Map();
  for (const [sid, st] of minDFA.states) {
    const newTrans = { ...st.transitions };
    for (const ch of alpha) {
      if (newTrans[ch] === undefined) newTrans[ch] = DEAD;
    }
    newStates.set(sid, { accept: st.accept, transitions: newTrans });
  }
  const deadTrans = {};
  for (const ch of alpha) { deadTrans[ch] = DEAD; }
  newStates.set(DEAD, { accept: false, transitions: deadTrans });

  return { states: newStates, start: minDFA.start, alphabet: minDFA.alphabet };
}

/* ── Utility ───────────────────────── */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/* ── Superscript & Inline-OR Overlay ── */
function setupRegexOverlay(inputEl, overlayClass) {
  const overlay = document.createElement('div');
  overlay.className = overlayClass;
  inputEl.parentElement.appendChild(overlay);

  function sync() {
    const val = inputEl.value;
    if (val) {
      overlay.innerHTML = formatRegexHtml(val);
      overlay.style.visibility = 'visible';
    } else {
      // Show example in overlay when empty
      overlay.innerHTML = '';
      overlay.style.visibility = 'hidden';
    }
    overlay.scrollTop = inputEl.scrollTop;
    overlay.scrollLeft = inputEl.scrollLeft;
  }

  inputEl.addEventListener('input', sync);
  inputEl.addEventListener('scroll', sync);
  inputEl.addEventListener('keyup', sync);
  setTimeout(sync, 0);
}

function formatRegexHtml(str) {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '*') {
      out += '<span class="re-sup">*</span>';
    } else if (ch === '+' || ch === '⁺') {
      out += '<span class="re-sup">+</span>';
    } else if (ch === '|') {
      out += '<span class="re-or">+</span>';
    } else if (ch === '<') {
      out += '&lt;';
    } else if (ch === '>') {
      out += '&gt;';
    } else if (ch === '&') {
      out += '&amp;';
    } else {
      out += ch;
    }
  }
  return out;
}
