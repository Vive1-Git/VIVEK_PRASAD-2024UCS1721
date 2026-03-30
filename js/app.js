/* ═══════════════════════════════════════════
   app.js — Wire everything together
   ═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  const reInput      = document.getElementById('re-input');
  const btnGenerate  = document.getElementById('btn-generate');
  const palette      = document.getElementById('palette');
  const resultsMeta  = document.getElementById('results-meta');
  const resultsGrid  = document.getElementById('results-grid');
  const stringCount  = document.getElementById('string-count');

  const equivRe1    = document.getElementById('equiv-re1');
  const equivRe2    = document.getElementById('equiv-re2');
  const btnEquiv    = document.getElementById('btn-equiv');
  const equivResult = document.getElementById('equiv-result');

  /* ── Build the palette ─────────────── */
  buildPalette(palette, reInput);

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
    } catch (err) {
      showError(resultsGrid, resultsMeta, err.message);
    }
  });

  // Also allow Ctrl+Enter to generate
  reInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      btnGenerate.click();
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
  // Auto-open the collapsible panel
  const resultsCard = document.getElementById('results-card');
  if (resultsCard && !resultsCard.open) resultsCard.open = true;

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

/* ── Show error ────────────────────── */
function showError(grid, meta, message) {
  // Auto-open the collapsible panel
  const resultsCard = document.getElementById('results-card');
  if (resultsCard && !resultsCard.open) resultsCard.open = true;

  meta.textContent = '';
  grid.innerHTML = '';
  const err = document.createElement('div');
  err.className = 'result-error';
  err.innerHTML = `<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10c0 4.418-3.582 8-8 8s-8-3.582-8-8 3.582-8 8-8 8 3.582 8 8zm-8-4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg> ${escapeHtml(message)}`;
  grid.appendChild(err);
}

/* ── Render equivalence result ─────── */
function renderEquivResult(container, result, re1, re2, errorMsg, trace, dfas) {
  container.innerHTML = '';

  if (errorMsg) {
    const err = document.createElement('div');
    err.className = 'result-error';
    err.innerHTML = `<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10c0 4.418-3.582 8-8 8s-8-3.582-8-8 3.582-8 8-8 8 3.582 8 8zm-8-4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg> ${escapeHtml(errorMsg)}`;
    container.appendChild(err);
    return;
  }

  if (result.equivalent) {
    const badge = document.createElement('div');
    badge.className = 'equiv-badge equiv-badge--yes';
    badge.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clip-rule="evenodd"/></svg> Equivalent — Both REs describe the same language`;
    container.appendChild(badge);

    // Generate and show the first 20 matching strings in a trace table
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

        // Header row
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

        // Data rows
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
        container.appendChild(wrapper);
      }
    } catch (e) {
      // Silently ignore string generation errors
    }

    // DFA tables for equivalent case
    if (dfas) {
      container.appendChild(renderDFASection(dfas, re1, re2));
    }
    return;
  }

  /* ── Not equivalent → show animated trace ── */

  // 1. Badge
  const badge = document.createElement('div');
  badge.className = 'equiv-badge equiv-badge--no';
  badge.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg> Not Equivalent`;
  container.appendChild(badge);

  // 2. Counter-example callout
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
    container.appendChild(counter);
  }

  // 3. Animated trace table
  if (trace && trace.length > 0) {
    const wrapper = document.createElement('div');
    wrapper.className = 'trace-wrapper';

    const heading = document.createElement('div');
    heading.className = 'trace-heading';
    heading.textContent = 'Scanning string lengths…';
    wrapper.appendChild(heading);

    const table = document.createElement('div');
    table.className = 'trace-table';

    // Header row
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

    // Data rows — they'll animate in sequentially, stop at first mismatch
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

        if (isMismatch) {
          foundMismatch = true;
          break;
        }
      }
    }

    wrapper.appendChild(table);
    container.appendChild(wrapper);

    // Update heading after the last row animates in
    const totalDelay = rowIndex * 400 + 200;
    setTimeout(() => {
      heading.textContent = `Divergence found at length ${trace.find(t => t.hasMismatch)?.length ?? '?'}`;
      heading.classList.add('trace-heading--done');
    }, totalDelay);
  }

  // DFA tables for non-equivalent case
  if (dfas) {
    container.appendChild(renderDFASection(dfas, re1, re2));
  }
}

/* ── Render DFA transition tables ──── */
function renderDFASection(dfas, re1, re2) {
  const section = document.createElement('div');
  section.className = 'dfa-section';

  const heading = document.createElement('div');
  heading.className = 'dfa-section-heading';
  heading.textContent = 'Minimized DFAs';
  section.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'dfa-grid';

  grid.appendChild(renderSingleDFA(dfas.min1, `RE₁: <code>${formatRegexHtml(re1)}</code>`));
  grid.appendChild(renderSingleDFA(dfas.min2, `RE₂: <code>${formatRegexHtml(re2)}</code>`));

  section.appendChild(grid);
  return section;
}

function renderSingleDFA(minDFA, labelHtml) {
  const card = document.createElement('div');
  card.className = 'dfa-card';

  const title = document.createElement('div');
  title.className = 'dfa-card-title';
  title.innerHTML = labelHtml;
  card.appendChild(title);

  // Augment with dead state for complete DFA
  const completeDFA = addDeadState(minDFA);

  // Visual diagram container
  const diagramContainer = document.createElement('div');
  diagramContainer.className = 'dfa-diagram-container';
  card.appendChild(diagramContainer);

  // Render SVG diagram after the card is in the DOM
  requestAnimationFrame(() => {
    renderDFADiagram(completeDFA, diagramContainer);
  });

  // Build state label mapping: state id → q0, q1, ...
  const stateIds = [...completeDFA.states.keys()].sort((a, b) => {
    if (a === completeDFA.start) return -1;
    if (b === completeDFA.start) return 1;
    // Dead state last
    if (a === -999) return 1;
    if (b === -999) return 1;
    return a - b;
  });
  const stateLabel = new Map();
  let qIdx = 0;
  stateIds.forEach((id) => {
    if (id === -999) {
      stateLabel.set(id, 'dead');
    } else {
      stateLabel.set(id, `q${qIdx++}`);
    }
  });

  const alpha = [...completeDFA.alphabet].sort();

  // Table element
  const table = document.createElement('table');
  table.className = 'dfa-table';

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.innerHTML = `<th>State</th>` +
    alpha.map(ch => `<th>${escapeHtml(ch)}</th>`).join('');
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  for (const sid of stateIds) {
    const st = completeDFA.states.get(sid);
    const row = document.createElement('tr');
    if (sid === -999) {
      row.className = 'dfa-row--dead';
    } else if (st.accept) {
      row.className = 'dfa-row--accept';
    }

    const prefix = sid === completeDFA.start ? '→ ' : '';
    const labelStr = stateLabel.get(sid);
    const displayLabel = st.accept ? `<span class="state-circle">${labelStr}</span>` : labelStr;
    let stateCell = `<td class="dfa-cell-state">${prefix}${displayLabel}</td>`;

    let transCells = '';
    for (const ch of alpha) {
      const target = st.transitions[ch];
      const targetLabel = target !== undefined ? stateLabel.get(target) : '—';
      transCells += `<td>${targetLabel}</td>`;
    }

    row.innerHTML = stateCell + transCells;
    tbody.appendChild(row);
  }
  table.appendChild(tbody);

  // Stats
  const stats = document.createElement('div');
  stats.className = 'dfa-stats';
  const hasDead = completeDFA.states.has(-999);
  stats.textContent = `${stateIds.length} state${stateIds.length !== 1 ? 's' : ''} · ${alpha.length} symbol${alpha.length !== 1 ? 's' : ''}${hasDead ? ' · 1 dead' : ''}`;

  card.appendChild(table);
  card.appendChild(stats);
  return card;
}

/* ── Add dead state to make DFA complete ── */
function addDeadState(minDFA) {
  const alpha = [...minDFA.alphabet];

  // Check if any transitions are missing
  let needsDead = false;
  for (const [sid, st] of minDFA.states) {
    for (const ch of alpha) {
      if (st.transitions[ch] === undefined) {
        needsDead = true;
        break;
      }
    }
    if (needsDead) break;
  }

  if (!needsDead) return minDFA;

  // Create augmented DFA
  const DEAD = -999;
  const newStates = new Map();

  for (const [sid, st] of minDFA.states) {
    const newTrans = { ...st.transitions };
    for (const ch of alpha) {
      if (newTrans[ch] === undefined) {
        newTrans[ch] = DEAD;
      }
    }
    newStates.set(sid, { accept: st.accept, transitions: newTrans });
  }

  // Dead state transitions to itself on all symbols
  const deadTrans = {};
  for (const ch of alpha) {
    deadTrans[ch] = DEAD;
  }
  newStates.set(DEAD, { accept: false, transitions: deadTrans });

  return {
    states: newStates,
    start: minDFA.start,
    alphabet: minDFA.alphabet
  };
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
      overlay.innerHTML = '';
      overlay.style.visibility = 'hidden';
    }
    // Sync scroll for textareas
    overlay.scrollTop = inputEl.scrollTop;
    overlay.scrollLeft = inputEl.scrollLeft;
  }

  inputEl.addEventListener('input', sync);
  inputEl.addEventListener('scroll', sync);
  inputEl.addEventListener('keyup', sync);
  // Initial sync
  setTimeout(sync, 0);
}

function formatRegexHtml(str) {
  let out = '';
  // Process char by char to safely avoid replacing inside HTML tags
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '*') {
      out += '<span class="re-sup">*</span>';
    } else if (ch === '+') {
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

