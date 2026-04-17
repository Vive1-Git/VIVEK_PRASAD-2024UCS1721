/* ═══════════════════════════════════════════════════════════
   DFA Diagram — Strictly Linear Horizontal Layout Render
   ─────────────────────────────────────────────────────────
   Rules: Horizontal main states, separate tracks for edges,
   no overlapping arrows, labels above arrows!
   ═══════════════════════════════════════════════════════════ */

function renderDFADiagram(minDFA, containerEl) {
  const alpha = [...minDFA.alphabet].sort();

  // 1. Sort state IDs. Flow order: Start State -> BFS -> Accept States
  const mainIds = [];
  const deadId = -999;
  const hasDead = minDFA.states.has(deadId);

  const visited = new Set();
  const queue = [minDFA.start];
  visited.add(minDFA.start);

  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur !== deadId) mainIds.push(cur);
    const st = minDFA.states.get(cur);
    for (const ch of alpha) {
      const tgt = st.transitions[ch];
      if (tgt !== undefined && !visited.has(tgt)) {
        visited.add(tgt);
        queue.push(tgt);
      }
    }
  }
  for (const id of minDFA.states.keys()) {
    if (id !== deadId && !visited.has(id)) mainIds.push(id);
  }

  const label = new Map();
  let qi = 0;
  mainIds.forEach(id => label.set(id, `q${qi++}`));
  if (hasDead) label.set(deadId, 'dead');

  // 2. Extract Edges
  const edges = [];
  for (const sid of minDFA.states.keys()) {
    const st = minDFA.states.get(sid);
    const tgtMap = new Map();
    for (const ch of alpha) {
      const tgt = st.transitions[ch];
      if (tgt !== undefined) {
        if (!tgtMap.has(tgt)) tgtMap.set(tgt, []);
        tgtMap.get(tgt).push(ch);
      }
    }
    for (const [tgt, chars] of tgtMap.entries()) {
      edges.push({ src: sid, tgt: tgt, label: chars.join(', ') });
    }
  }

  // 3. Spacing
  const SR = 34;

  let maxLabelLen = 1;
  for (const e of edges) {
    if (e.label.length > maxLabelLen) maxLabelLen = e.label.length;
  }
  const minRequiredDx = maxLabelLen * 10 + 122;
  const DX = Math.max(160, minRequiredDx);

  const LEFT_PAD = 100;

  const xPos = new Map();
  mainIds.forEach((id, i) => xPos.set(id, LEFT_PAD + i * DX));

  const mainCenterX = mainIds.length > 0 ? LEFT_PAD + (mainIds.length - 1) * DX / 2 : LEFT_PAD;
  if (hasDead) xPos.set(deadId, mainCenterX);

  // 4. Track Assignment
  function overlaps(i1, i2) { return Math.max(i1[0], i2[0]) < Math.min(i1[1], i2[1]); }

  const topTracks = [];
  const bottomTracks = [];
  const selfLoops = new Map();
  const deadTracks = new Map();

  for (const e of edges) {
    if (e.src === e.tgt) {
      e.type = 'self';
      if (!selfLoops.has(e.src)) selfLoops.set(e.src, []);
      e.track = selfLoops.get(e.src).length;
      selfLoops.get(e.src).push(true);
      continue;
    }

    if (e.tgt === deadId || e.src === deadId) {
      e.type = 'dead';
      if (!deadTracks.has(e.src)) deadTracks.set(e.src, []);
      e.track = deadTracks.get(e.src).length;
      deadTracks.get(e.src).push(true);
      continue;
    }

    const iSrc = mainIds.indexOf(e.src);
    const iTgt = mainIds.indexOf(e.tgt);
    const minI = Math.min(iSrc, iTgt);
    const maxI = Math.max(iSrc, iTgt);
    const interval = [minI, maxI];

    if (iTgt > iSrc) {
      e.type = 'forward';
      let t = 0;
      if (maxI - minI > 1) t = 1;

      while (true) {
        if (!topTracks[t]) topTracks[t] = [];
        const collision = topTracks[t].some(intv => overlaps(intv, interval));
        if (!collision) {
          topTracks[t].push(interval);
          e.track = t;
          break;
        }
        t++;
      }
    } else {
      e.type = 'backward';
      let t = 1;
      while (true) {
        if (!bottomTracks[t]) bottomTracks[t] = [];
        const collision = bottomTracks[t].some(intv => overlaps(intv, interval));
        if (!collision) {
          bottomTracks[t].push(interval);
          e.track = t;
          break;
        }
        t++;
      }
    }
  }

  // 5. Geometry
  const ARC_STEP = 55;
  const LOOP_STEP = 35;

  let maxTopArcHeight = 0;
  let maxBottomArcHeight = 0;
  for (const e of edges) {
    if (e.type === 'forward' && e.track > 0) {
      const minI = Math.min(mainIds.indexOf(e.src), mainIds.indexOf(e.tgt));
      const maxI = Math.max(mainIds.indexOf(e.src), mainIds.indexOf(e.tgt));
      let highestLoopUnderArc = 0;
      for (let i = minI + 1; i < maxI; i++) {
        const id = mainIds[i];
        if (selfLoops.has(id)) {
          const loopHeight = SR + 40 + (selfLoops.get(id).length - 1) * LOOP_STEP;
          if (loopHeight > highestLoopUnderArc) highestLoopUnderArc = loopHeight;
        }
      }
      let h = e.track * ARC_STEP;
      if (h < highestLoopUnderArc + 30) {
        h = highestLoopUnderArc + 30 + (e.track - 1) * ARC_STEP;
      }
      if (h > maxTopArcHeight) maxTopArcHeight = h;
      e.visualHeight = h;
    } else if (e.type === 'backward') {
      e.visualHeight = e.track * 70;
      if (e.visualHeight > maxBottomArcHeight) maxBottomArcHeight = e.visualHeight;
    }
  }

  const maxSelfLoop = Math.max(0, ...Array.from(selfLoops.values()).map(a => a.length));

  const highestArcY = -maxTopArcHeight;
  const highestLoopY = -SR - (maxSelfLoop * LOOP_STEP);
  const minVisualY = Math.min(-60, highestArcY - 40, highestLoopY - 60);

  const bottomArcY = maxBottomArcHeight;

  const Y_MAIN = 0;
  const Y_DEAD = hasDead ? Math.max(120, bottomArcY + 140) : Y_MAIN;

  let deadLoopOffset = 0;
  if (selfLoops.has(deadId)) {
    const Hloop = 40 + (selfLoops.get(deadId).length - 1) * LOOP_STEP;
    deadLoopOffset = SR + Hloop + 40;
  }

  const maxVisualY = hasDead ? Y_DEAD + Math.max(100, deadLoopOffset) : Math.max(60, bottomArcY + 60);

  const H = maxVisualY - minVisualY;
  const W = Math.max(containerEl.clientWidth || 520, LEFT_PAD + mainIds.length * DX + LEFT_PAD);

  // 6. SVG Setup
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 ${minVisualY} ${W} ${H}`);
  svg.classList.add('dfa-svg');

  const defs = document.createElementNS(NS, 'defs');
  const uid = Math.random().toString(36).slice(2, 8);
  const MK_N = 'mn' + uid, MK_D = 'md' + uid, MK_S = 'ms' + uid;
  defs.appendChild(arrowMarker(NS, MK_N, '#2d8a4e', 1.0));
  defs.appendChild(arrowMarker(NS, MK_D, '#c0392b', 1.0));
  defs.appendChild(arrowMarker(NS, MK_S, '#2d8a4e', 1.0));
  svg.appendChild(defs);

  function path(d, stroke, mk) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', stroke);
    p.setAttribute('stroke-width', 2);
    if (mk) p.setAttribute('marker-end', `url(#${mk})`);
    svg.appendChild(p);
  }

  function text(x, y, txt, fill, anchor = 'middle', fontSize = '16') {
    const e = document.createElementNS(NS, 'text');
    e.setAttribute('x', x);
    e.setAttribute('y', y);
    e.setAttribute('text-anchor', anchor);
    e.setAttribute('fill', fill);
    e.setAttribute('font-size', fontSize);
    e.setAttribute('font-weight', '700');
    e.setAttribute('font-family', "'IBM Plex Mono', monospace");
    e.setAttribute('stroke', '#e8efe8');
    e.setAttribute('stroke-width', '4');
    e.setAttribute('paint-order', 'stroke');
    e.setAttribute('stroke-linejoin', 'round');
    e.textContent = txt;
    svg.appendChild(e);
  }

  function getBezierEdge(x1, y1, cx, cy, x2, y2, r) {
    let vx1 = cx - x1, vy1 = cy - y1;
    let len1 = Math.sqrt(vx1 * vx1 + vy1 * vy1);
    let ex1 = x1 + (vx1 / len1) * r;
    let ey1 = y1 + (vy1 / len1) * r;
    let vx2 = x2 - cx, vy2 = y2 - cy;
    let len2 = Math.sqrt(vx2 * vx2 + vy2 * vy2);
    let ex2 = x2 - (vx2 / len2) * r;
    let ey2 = y2 - (vy2 / len2) * r;
    return { ex1, ey1, ex2, ey2 };
  }

  // 7. Draw Edges
  const labelsToDraw = [];

  for (const e of edges) {
    const isDead = e.src === deadId || e.tgt === deadId;
    const stroke = isDead ? 'rgba(192,57,43,.5)' : 'rgba(45,138,78,.5)';
    const lbCol = isDead ? '#c0392b' : '#2d8a4e';
    const mk = isDead ? MK_D : MK_N;

    const x1 = xPos.get(e.src);
    const y1 = e.src === deadId ? Y_DEAD : Y_MAIN;
    const x2 = xPos.get(e.tgt);
    const y2 = e.tgt === deadId ? Y_DEAD : Y_MAIN;

    let labelX, labelY;

    if (e.type === 'self') {
      const Hloop = 40 + e.track * LOOP_STEP;
      const Wloop = 25 + e.track * (LOOP_STEP * 0.5);
      let d, labelY;

      if (e.src === deadId) {
        d = `M ${x1 - 10} ${y1 + SR - 4} C ${x1 - Wloop} ${y1 + SR + Hloop} ${x1 + Wloop} ${y1 + SR + Hloop} ${x1 + 10} ${y1 + SR - 4}`;
        labelY = y1 + SR + Hloop * 0.75 + 32;
      } else {
        d = `M ${x1 - 10} ${y1 - SR + 4} C ${x1 - Wloop} ${y1 - SR - Hloop} ${x1 + Wloop} ${y1 - SR - Hloop} ${x1 + 10} ${y1 - SR + 4}`;
        labelY = y1 - SR - Hloop * 0.75 - 6;
      }
      path(d, stroke, mk);
      labelX = x1;
      labelsToDraw.push({ x: labelX, y: labelY, txt: e.label, col: lbCol, anchor: 'middle' });

    } else if (e.type === 'forward' && e.track === 0) {
      path(`M ${x1 + SR + 4} ${Y_MAIN} L ${x2 - SR - 4} ${Y_MAIN}`, stroke, mk);
      labelX = (x1 + x2) / 2;
      labelY = Y_MAIN - 8;
      labelsToDraw.push({ x: labelX, y: labelY, txt: e.label, col: lbCol, anchor: 'middle' });

    } else if (e.type === 'forward' && e.track > 0) {
      const height = e.visualHeight;
      const cx = (x1 + x2) / 2;
      const cy = Y_MAIN - 2 * height;
      const bz = getBezierEdge(x1, Y_MAIN, cx, cy, x2, Y_MAIN, SR + 4);
      path(`M ${bz.ex1} ${bz.ey1} Q ${cx} ${cy} ${bz.ex2} ${bz.ey2}`, stroke, mk);
      const my = 0.25 * bz.ey1 + 0.5 * cy + 0.25 * bz.ey2;
      labelX = cx;
      labelY = my - 8;
      labelsToDraw.push({ x: labelX, y: labelY, txt: e.label, col: lbCol, anchor: 'middle' });

    } else if (e.type === 'backward') {
      const height = e.visualHeight;
      const cx = (x1 + x2) / 2;
      const cy = Y_MAIN + 2 * height;
      const bz = getBezierEdge(x1, Y_MAIN, cx, cy, x2, Y_MAIN, SR + 4);
      path(`M ${bz.ex1} ${bz.ey1} Q ${cx} ${cy} ${bz.ex2} ${bz.ey2}`, stroke, mk);
      const my = 0.25 * bz.ey1 + 0.5 * cy + 0.25 * bz.ey2;
      labelX = cx;
      labelY = my + 22;
      labelsToDraw.push({ x: labelX, y: labelY, txt: e.label, col: lbCol, anchor: 'middle' });

    } else if (e.type === 'dead') {
      if (e.src !== deadId) {
        const offset = (e.track - (deadTracks.get(e.src).length - 1) / 2) * 20;
        const cx = (x1 + x2) / 2 + offset;
        const cy = (Y_MAIN + Y_DEAD) / 2;
        const bz = getBezierEdge(x1, Y_MAIN, cx, cy, x2, Y_DEAD, SR + 4);
        path(`M ${bz.ex1} ${bz.ey1} Q ${cx} ${cy} ${bz.ex2} ${bz.ey2}`, stroke, mk);
        const iSrc = mainIds.indexOf(e.src);
        const t = (iSrc % 2 === 0) ? 0.35 : 0.6;
        labelX = (1 - t) * (1 - t) * bz.ex1 + 2 * (1 - t) * t * cx + t * t * bz.ex2;
        labelY = (1 - t) * (1 - t) * bz.ey1 + 2 * (1 - t) * t * cy + t * t * bz.ey2;
        labelsToDraw.push({ x: labelX, y: labelY - 8, txt: e.label, col: lbCol, anchor: 'middle' });
      }
    }
  }

  // 8. Start Arrow
  if (minDFA.states.has(minDFA.start)) {
    const sx = xPos.get(minDFA.start);
    const isStartAccept = minDFA.states.get(minDFA.start)?.accept;
    // Clear the outer accept ring (SR+6) + glow/stroke when start is also an accept state
    const edgeR = isStartAccept ? SR + 12 : SR + 4;
    path(`M ${sx - edgeR - 50} ${Y_MAIN} L ${sx - edgeR} ${Y_MAIN}`, '#2d8a4e', MK_S);
    labelsToDraw.push({ x: sx - edgeR - 25, y: Y_MAIN - 8, txt: 'start', col: '#2d8a4e', anchor: 'middle' });
  }

  labelsToDraw.forEach(l => {
    text(l.x, l.y, l.txt, l.col, l.anchor);
  });

  // 9. Draw Nodes
  function drawNode(id, x, y) {
    const isDead = id === deadId;
    const isAcc = minDFA.states.get(id)?.accept;

    if (isAcc) {
      const c1 = document.createElementNS(NS, 'circle');
      c1.setAttribute('cx', x); c1.setAttribute('cy', y); c1.setAttribute('r', SR + 6);
      c1.setAttribute('fill', 'none'); c1.setAttribute('stroke', '#1a7a36'); c1.setAttribute('stroke-width', 2);
      svg.appendChild(c1);
    }

    const c2 = document.createElementNS(NS, 'circle');
    c2.setAttribute('cx', x); c2.setAttribute('cy', y); c2.setAttribute('r', SR);
    c2.setAttribute('fill', isDead ? '#fdecea' : isAcc ? '#d1f5dc' : '#ffffff');
    c2.setAttribute('stroke', isDead ? '#c0392b' : isAcc ? '#1a7a36' : '#2d8a4e');
    c2.setAttribute('stroke-width', 2);
    if (isDead) c2.setAttribute('stroke-dasharray', '5 4');
    svg.appendChild(c2);

    text(x, y + 7, label.get(id), isDead ? '#c0392b' : isAcc ? '#1a7a36' : '#1b2e1b', 'middle', '22');
  }

  mainIds.forEach(id => drawNode(id, xPos.get(id), Y_MAIN));
  if (hasDead) drawNode(deadId, xPos.get(deadId), Y_DEAD);

  // ── Interactive Pan & Zoom ────────────────────────
  containerEl.innerHTML = '';
  containerEl.style.overflow = 'hidden';
  containerEl.style.position = 'relative';
  containerEl.style.cursor = 'grab';
  containerEl.style.userSelect = 'none';
  containerEl.style.touchAction = 'none';

  const wrapper = document.createElement('div');
  wrapper.className = 'dfa-pan-layer';
  wrapper.style.transformOrigin = '0 0';
  wrapper.appendChild(svg);
  containerEl.appendChild(wrapper);

  let scale = 1;
  let panX = 0, panY = 0;
  let isDragging = false;
  let dragStartX = 0, dragStartY = 0;
  let panStartX = 0, panStartY = 0;

  function applyTransform() {
    wrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  }

  // Dedicated fit function — resets view to fit diagram in container
  function fitToContainer() {
    const cw = containerEl.clientWidth;
    const ch = containerEl.clientHeight;
    if (cw > 0 && ch > 0 && W > 0 && H > 0) {
      const fitScale = Math.min(cw / W, ch / H, 1);
      scale = fitScale * 0.92;
      panX = (cw / 2) - mainCenterX * scale;
      panY = (ch - H * scale) / 2;
      applyTransform();
    }
  }

  // Fit on initial render
  requestAnimationFrame(() => { fitToContainer(); });

  // Custom event for programmatic fit (used by fullscreen toggle)
  containerEl.addEventListener('dfa-fit', () => { fitToContainer(); });

  // Also keep dblclick for backward compat (user double-clicks background to reset)
  containerEl.addEventListener('dblclick', () => { fitToContainer(); });

  // Mouse drag to pan
  containerEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    panStartX = panX;
    panStartY = panY;
    containerEl.style.cursor = 'grabbing';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panX = panStartX + (e.clientX - dragStartX);
    panY = panStartY + (e.clientY - dragStartY);
    applyTransform();
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      containerEl.style.cursor = 'grab';
    }
  });

  // Mouse wheel to zoom
  containerEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = containerEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const oldScale = scale;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    scale = Math.max(0.15, Math.min(5, scale * delta));
    panX = mx - (mx - panX) * (scale / oldScale);
    panY = my - (my - panY) * (scale / oldScale);
    applyTransform();
  }, { passive: false });

  // Touch support
  let lastTouchDist = 0;
  containerEl.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
      panStartX = panX;
      panStartY = panY;
    } else if (e.touches.length === 2) {
      isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist = Math.sqrt(dx * dx + dy * dy);
    }
    e.preventDefault();
  }, { passive: false });

  containerEl.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isDragging) {
      panX = panStartX + (e.touches[0].clientX - dragStartX);
      panY = panStartY + (e.touches[0].clientY - dragStartY);
      applyTransform();
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastTouchDist > 0) {
        const pinchScale = dist / lastTouchDist;
        scale = Math.max(0.15, Math.min(5, scale * pinchScale));
        applyTransform();
      }
      lastTouchDist = dist;
    }
    e.preventDefault();
  }, { passive: false });

  containerEl.addEventListener('touchend', () => {
    isDragging = false;
    lastTouchDist = 0;
  });

  // ── Zoom Control Buttons ──────────────────────────
  let zoomDebounceTimer = null;
  function debouncedZoom(fn) {
    if (zoomDebounceTimer) return;
    fn();
    zoomDebounceTimer = setTimeout(() => { zoomDebounceTimer = null; }, 80);
  }

  const controls = document.createElement('div');
  controls.className = 'dfa-zoom-controls';

  // CRITICAL: Block dblclick from bubbling out of zoom controls
  // This prevents rapid +/- clicks from triggering the container's dblclick reset
  controls.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    e.preventDefault();
  });

  // Graph content center in SVG element coordinates (not viewBox)
  // X: mainCenterX is the center of the states row (viewBox x maps 1:1 to element x)
  // Y: H/2 is the vertical center of the element (viewBox y is offset by minVisualY)
  const graphCX = mainCenterX;
  const graphCY = H / 2;

  [
    { label: '+', title: 'Zoom in', action: () => {
      const oldScale = scale;
      scale = Math.min(5, scale * 1.25);
      // Keep the graph's on-screen center fixed: panX + graphCX * scale = const
      panX -= graphCX * (scale - oldScale);
      panY -= graphCY * (scale - oldScale);
      applyTransform();
    } },
    { label: '−', title: 'Zoom out', action: () => {
      const oldScale = scale;
      scale = Math.max(0.15, scale * 0.8);
      panX -= graphCX * (scale - oldScale);
      panY -= graphCY * (scale - oldScale);
      applyTransform();
    } },
    { label: '⟲', title: 'Reset view', action: () => { fitToContainer(); } }
  ].forEach(({ label, title, action }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dfa-zoom-btn';
    btn.textContent = label;
    btn.title = title;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (label === '⟲') {
        action();
      } else {
        debouncedZoom(action);
      }
    });
    btn.addEventListener('mousedown', (e) => e.stopPropagation());
    controls.appendChild(btn);
  });
  containerEl.appendChild(controls);
}

function arrowMarker(NS, id, color, sw) {
  const size = Math.round(6 + sw);
  const m = document.createElementNS(NS, 'marker');
  m.setAttribute('id', id); m.setAttribute('viewBox', '0 0 12 12');
  m.setAttribute('refX', '11'); m.setAttribute('refY', '6');
  m.setAttribute('markerWidth', size); m.setAttribute('markerHeight', size);
  m.setAttribute('orient', 'auto-start-reverse');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', 'M 2 3 L 11 6 L 2 9 z');
  p.setAttribute('fill', color);
  m.appendChild(p);
  return m;
}
