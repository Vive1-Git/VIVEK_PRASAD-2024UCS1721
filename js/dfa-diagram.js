/* ═══════════════════════════════════════════════════════════
   DFA Diagram — Strictly Linear Horizontal Layout Render
   ─────────────────────────────────────────────────────────
   Rules: Horizontal main states, separate tracks for edges,
   no overlapping arrows, labels above arrows!
   ═══════════════════════════════════════════════════════════ */

function renderDFADiagram(minDFA, containerEl) {
  const alpha  = [...minDFA.alphabet].sort();

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
  // Add any unreachable main states just in case
  for (const id of minDFA.states.keys()) {
    if (id !== deadId && !visited.has(id)) mainIds.push(id);
  }

  // State text mapping
  const label = new Map();
  let qi = 0;
  [...minDFA.states.keys()].sort((a, b) => {
    if (a === minDFA.start) return -1;
    if (b === minDFA.start) return  1;
    if (a === deadId) return  1;
    if (b === deadId) return -1;
    return a - b;
  }).forEach(id => label.set(id, id === deadId ? 'dead' : `q${qi++}`));

  // 2. Extract Edges (Grouped by target for combined arcs)
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

  // 3. Spacing & Metics
  const SR = 34; // state radius
  const DX = 150; // horizontal spacing between main states
  const LEFT_PAD = 100;
  
  // Assign indices on 1D grid
  const xPos = new Map();
  mainIds.forEach((id, i) => xPos.set(id, LEFT_PAD + i * DX));
  
  const mainCenterX = mainIds.length > 0 ? LEFT_PAD + (mainIds.length - 1) * DX / 2 : LEFT_PAD;
  if (hasDead) xPos.set(deadId, mainCenterX);

  // 4. Track Assignment
  function overlaps(i1, i2) { return Math.max(i1[0], i2[0]) < Math.min(i1[1], i2[1]); }
  
  const topTracks = []; // Arrays of [startIdx, endIdx]
  const bottomTracks = [];
  const selfLoops = new Map(); // src -> array of tracks
  const deadTracks = new Map(); // src -> array of tracks
  
  // Decorate edges with routing info
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
      // Forward edge -> top arc (or straight if span 1 & track 0)
      e.type = 'forward';
      let t = 0;
      if (maxI - minI > 1) t = 1; // force arcs for span > 1
      
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
      // Backward edge -> bottom arc
      e.type = 'backward';
      let t = 1; // Always use arcs for backward to avoid baseline
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

  // 5. Geometry calculation
  const ARC_STEP = 55;  
  const LOOP_STEP = 35; 
  
  const maxTopTrack = topTracks.length > 0 ? topTracks.length - 1 : 0;
  const maxSelfLoop = Math.max(0, ...Array.from(selfLoops.values()).map(a => a.length));
  
  const highestArcY = - (maxTopTrack * ARC_STEP);
  const highestLoopY = -SR - (maxSelfLoop * LOOP_STEP);
  const minVisualY = Math.min(-60, highestArcY - 40, highestLoopY - 60); 
  
  const maxBottomTrack = bottomTracks.length > 0 ? bottomTracks.length - 1 : 0;
  const bottomArcY = maxBottomTrack * ARC_STEP;
  
  const Y_MAIN = 0;
  const Y_DEAD = hasDead ? Math.max(120, bottomArcY + 140) : Y_MAIN;
  
  const maxVisualY = hasDead ? Y_DEAD + SR + 100 : Math.max(60, bottomArcY + 60);

  const H = maxVisualY - minVisualY;
  const W = Math.max(containerEl.clientWidth || 520, LEFT_PAD + mainIds.length * DX + LEFT_PAD);

  // 6. SVG Setup
  const NS  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width',  W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 ${minVisualY} ${W} ${H}`); 
  svg.classList.add('dfa-svg');

  const defs = document.createElementNS(NS, 'defs');
  const uid  = Math.random().toString(36).slice(2, 8);
  const MK_N = 'mn' + uid, MK_D = 'md' + uid, MK_S = 'ms' + uid;
  defs.appendChild(arrowMarker(NS, MK_N, '#a78bfa', 2.0));
  defs.appendChild(arrowMarker(NS, MK_D, '#ef4444', 2.0));
  defs.appendChild(arrowMarker(NS, MK_S, '#60a5fa', 2.0));
  svg.appendChild(defs);

  // Rendering Helpers
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
    e.setAttribute('font-family', "'JetBrains Mono', monospace");
    e.setAttribute('stroke', '#1a182a');
    e.setAttribute('stroke-width', '4');
    e.setAttribute('paint-order', 'stroke');
    e.setAttribute('stroke-linejoin', 'round');
    e.textContent = txt;
    svg.appendChild(e);
  }

  function getBezierEdge(x1, y1, cx, cy, x2, y2, r) {
    let vx1 = cx - x1, vy1 = cy - y1;
    let len1 = Math.sqrt(vx1*vx1 + vy1*vy1);
    let ex1 = x1 + (vx1/len1) * r;
    let ey1 = y1 + (vy1/len1) * r;
    let vx2 = x2 - cx, vy2 = y2 - cy;
    let len2 = Math.sqrt(vx2*vx2 + vy2*vy2);
    let ex2 = x2 - (vx2/len2) * r;
    let ey2 = y2 - (vy2/len2) * r;
    return {ex1, ey1, ex2, ey2};
  }

  // 7. Draw Edges
  for (const e of edges) {
    const isDead = e.src === deadId || e.tgt === deadId;
    const stroke = isDead ? 'rgba(248,113,113,.7)' : 'rgba(167,139,250,.7)';
    const lbCol  = isDead ? '#f87171' : '#c4b5fd';
    const mk     = isDead ? MK_D : MK_N;
    
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
        // Draw downward loop for dead state to avoid overlapping incoming edges
        d = `M ${x1 - 10} ${y1 + SR - 4} C ${x1 - Wloop} ${y1 + SR + Hloop} ${x1 + Wloop} ${y1 + SR + Hloop} ${x1 + 10} ${y1 + SR - 4}`;
        labelY = y1 + SR + Hloop * 0.75 + 32;
      } else {
        d = `M ${x1 - 10} ${y1 - SR + 4} C ${x1 - Wloop} ${y1 - SR - Hloop} ${x1 + Wloop} ${y1 - SR - Hloop} ${x1 + 10} ${y1 - SR + 4}`;
        labelY = y1 - SR - Hloop * 0.75 - 6; 
      }
      path(d, stroke, mk);
      
      labelX = x1;
      text(labelX, labelY, e.label, lbCol);
      
    } else if (e.type === 'forward' && e.track === 0) {
      path(`M ${x1 + SR + 4} ${Y_MAIN} L ${x2 - SR - 4} ${Y_MAIN}`, stroke, mk);
      labelX = (x1 + x2) / 2;
      labelY = Y_MAIN - 8;
      text(labelX, labelY, e.label, lbCol);
      
    } else if (e.type === 'forward' && e.track > 0) {
      const height = e.track * ARC_STEP;
      const cx = (x1 + x2) / 2;
      const cy = Y_MAIN - 2 * height; 
      const bz = getBezierEdge(x1, Y_MAIN, cx, cy, x2, Y_MAIN, SR + 4);
      
      path(`M ${bz.ex1} ${bz.ey1} Q ${cx} ${cy} ${bz.ex2} ${bz.ey2}`, stroke, mk);
      
      const my = 0.25 * bz.ey1 + 0.5 * cy + 0.25 * bz.ey2;
      labelX = cx;
      labelY = my - 8; 
      text(labelX, labelY, e.label, lbCol, 'middle');
      
    } else if (e.type === 'backward') {
      const height = e.track * ARC_STEP;
      const cx = (x1 + x2) / 2;
      const cy = Y_MAIN + 2 * height;
      const bz = getBezierEdge(x1, Y_MAIN, cx, cy, x2, Y_MAIN, SR + 4);

      path(`M ${bz.ex1} ${bz.ey1} Q ${cx} ${cy} ${bz.ex2} ${bz.ey2}`, stroke, mk);
      
      const my = 0.25 * bz.ey1 + 0.5 * cy + 0.25 * bz.ey2;
      labelX = cx;
      labelY = my + 22; 
      text(labelX, labelY, e.label, lbCol, 'middle');
      
    } else if (e.type === 'dead') {
      if (e.src !== deadId) {
        const offset = (e.track - (deadTracks.get(e.src).length - 1) / 2) * 20; 
        const cx = (x1 + x2) / 2 + offset;
        const cy = (Y_MAIN + Y_DEAD) / 2;
        const bz = getBezierEdge(x1, Y_MAIN, cx, cy, x2, Y_DEAD, SR + 4);
        
        path(`M ${bz.ex1} ${bz.ey1} Q ${cx} ${cy} ${bz.ex2} ${bz.ey2}`, stroke, mk);
        
        const iSrc = mainIds.indexOf(e.src);
        const t = (iSrc % 2 === 0) ? 0.35 : 0.6;
        labelX = (1-t)*(1-t)*bz.ex1 + 2*(1-t)*t*cx + t*t*bz.ex2;
        labelY = (1-t)*(1-t)*bz.ey1 + 2*(1-t)*t*cy + t*t*bz.ey2;
        text(labelX, labelY - 8, e.label, lbCol);
      }
    }
  }

  // 8. Start Arrow
  if (minDFA.states.has(minDFA.start)) {
    const sx = xPos.get(minDFA.start);
    path(`M ${sx - SR - 50} ${Y_MAIN} L ${sx - SR - 4} ${Y_MAIN}`, '#3b82f6', MK_S);
    text(sx - SR - 25, Y_MAIN - 8, 'start', '#60a5fa');
  }

  // 9. Draw Nodes last
  function drawNode(id, x, y) {
    const isDead = id === deadId;
    const isAcc = minDFA.states.get(id)?.accept;
    
    if (isAcc) {
      const c1 = document.createElementNS(NS, 'circle');
      c1.setAttribute('cx', x); c1.setAttribute('cy', y); c1.setAttribute('r', SR + 6);
      c1.setAttribute('fill', 'none'); c1.setAttribute('stroke', '#4ade80'); c1.setAttribute('stroke-width', 2);
      svg.appendChild(c1);
    }
    
    const c2 = document.createElementNS(NS, 'circle');
    c2.setAttribute('cx', x); c2.setAttribute('cy', y); c2.setAttribute('r', SR);
    c2.setAttribute('fill', isDead ? '#2a1215' : isAcc ? '#112217' : '#1a182a');
    c2.setAttribute('stroke', isDead ? '#ef4444' : isAcc ? '#4ade80' : '#a78bfa');
    c2.setAttribute('stroke-width', 2);
    if (isDead) c2.setAttribute('stroke-dasharray', '5 4');
    svg.appendChild(c2);
    
    text(x, y + 7, label.get(id), isDead ? '#ef4444' : isAcc ? '#4ade80' : '#e2e8f0', 'middle', '22');
  }

  mainIds.forEach(id => drawNode(id, xPos.get(id), Y_MAIN));
  if (hasDead) drawNode(deadId, xPos.get(deadId), Y_DEAD);

  containerEl.appendChild(svg);
}

function arrowMarker(NS, id, color, sw) {
  const size = Math.round(8 + sw * 2);
  const m = document.createElementNS(NS, 'marker');
  m.setAttribute('id', id); m.setAttribute('viewBox', '0 0 12 12');
  m.setAttribute('refX', '11'); m.setAttribute('refY', '6');
  m.setAttribute('markerWidth', size); m.setAttribute('markerHeight', size);
  m.setAttribute('orient', 'auto-start-reverse');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', 'M 1 2 L 11 6 L 1 10 z');
  p.setAttribute('fill', color);
  m.appendChild(p);
  return m;
}
