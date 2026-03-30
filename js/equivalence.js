/* ═══════════════════════════════════════════════════════
   equivalence.js — Check if two REs describe the same
   language via Thompson → NFA → subset-construction DFA
   → DFA minimisation → structural comparison.
   ═══════════════════════════════════════════════════════ */

/* ── NFA state/fragment helpers ────────────────────── */
let _nfaStateId = 0;
function newState() { return { id: _nfaStateId++, transitions: {}, epsilons: [] }; }

/**
 * NFA fragment: { start, accept }
 * Transitions:  state.transitions[char] = [state, ...]
 * Epsilon:      state.epsilons  = [state, ...]
 */

/* ═══════════════════════════════════════
   Thompson's construction
   Re-uses the parser from generator.js
   ═══════════════════════════════════════ */
function reToNFA(pattern) {
  _nfaStateId = 0;
  const ast = parse(pattern); // from generator.js
  return astToNFA(ast);
}

function astToNFA(node) {
  switch (node.type) {
    case N.EMPTY: {
      const s = newState(), a = newState();
      s.epsilons.push(a);
      return { start: s, accept: a };
    }

    case N.LITERAL: {
      const s = newState(), a = newState();
      s.transitions[node.char] = s.transitions[node.char] || [];
      s.transitions[node.char].push(a);
      return { start: s, accept: a };
    }

    case N.DOT: {
      const s = newState(), a = newState();
      // treat dot as [a-z0-9] for finite alphabet
      for (const ch of DOT_CHARS) {
        s.transitions[ch] = s.transitions[ch] || [];
        s.transitions[ch].push(a);
      }
      return { start: s, accept: a };
    }

    case N.CHAR_CLASS: {
      const s = newState(), a = newState();
      for (const ch of node.chars) {
        s.transitions[ch] = s.transitions[ch] || [];
        s.transitions[ch].push(a);
      }
      return { start: s, accept: a };
    }

    case N.CONCAT: {
      const left = astToNFA(node.left);
      const right = astToNFA(node.right);
      left.accept.epsilons.push(right.start);
      return { start: left.start, accept: right.accept };
    }

    case N.ALT: {
      const s = newState(), a = newState();
      const left = astToNFA(node.left);
      const right = astToNFA(node.right);
      s.epsilons.push(left.start, right.start);
      left.accept.epsilons.push(a);
      right.accept.epsilons.push(a);
      return { start: s, accept: a };
    }

    case N.STAR: {
      const s = newState(), a = newState();
      const inner = astToNFA(node.child);
      s.epsilons.push(inner.start, a);
      inner.accept.epsilons.push(inner.start, a);
      return { start: s, accept: a };
    }

    case N.PLUS: {
      const s = newState(), a = newState();
      const inner = astToNFA(node.child);
      s.epsilons.push(inner.start);
      inner.accept.epsilons.push(inner.start, a);
      return { start: s, accept: a };
    }

    case N.QUESTION: {
      const s = newState(), a = newState();
      const inner = astToNFA(node.child);
      s.epsilons.push(inner.start, a);
      inner.accept.epsilons.push(a);
      return { start: s, accept: a };
    }

    case N.REPEAT: {
      // {min,max} — chain min mandatory copies and (max-min) optional copies
      const parts = [];
      for (let i = 0; i < node.min; i++) {
        parts.push(astToNFA(node.child));
      }
      for (let i = node.min; i < node.max; i++) {
        // optional copy
        const optNode = { type: N.QUESTION, child: node.child };
        parts.push(astToNFA(optNode));
      }
      if (parts.length === 0) {
        const s = newState(), a = newState();
        s.epsilons.push(a);
        return { start: s, accept: a };
      }
      let frag = parts[0];
      for (let i = 1; i < parts.length; i++) {
        frag.accept.epsilons.push(parts[i].start);
        frag = { start: frag.start, accept: parts[i].accept };
      }
      return frag;
    }

    default: {
      const s = newState(), a = newState();
      s.epsilons.push(a);
      return { start: s, accept: a };
    }
  }
}

/* ═══════════════════════════════════
   Epsilon closure
   ═══════════════════════════════════ */
function epsilonClosure(states) {
  const stack = [...states];
  const closure = new Set(states.map(s => s.id));
  const closureStates = [...states];
  while (stack.length) {
    const s = stack.pop();
    for (const e of s.epsilons) {
      if (!closure.has(e.id)) {
        closure.add(e.id);
        closureStates.push(e);
        stack.push(e);
      }
    }
  }
  return closureStates;
}

/* ═══════════════════════════════════
   Subset construction: NFA → DFA
   ═══════════════════════════════════ */
function nfaToDFA(nfa) {
  // collect alphabet
  const alphabet = new Set();
  const allStates = [];
  (function collect(s, seen) {
    if (seen.has(s.id)) return;
    seen.add(s.id);
    allStates.push(s);
    for (const ch in s.transitions) {
      alphabet.add(ch);
      for (const t of s.transitions[ch]) collect(t, seen);
    }
    for (const e of s.epsilons) collect(e, seen);
  })(nfa.start, new Set());

  const alpha = [...alphabet].sort();
  const acceptId = nfa.accept.id;

  // DFA state = set of NFA state ids
  const startClosure = epsilonClosure([nfa.start]);
  const startKey = stateSetKey(startClosure);

  const dfaStates = new Map(); // key → { id, nfaStates, transitions: {char→key}, accept }
  let nextId = 0;

  dfaStates.set(startKey, {
    id: nextId++,
    nfaStates: startClosure,
    transitions: {},
    accept: startClosure.some(s => s.id === acceptId),
  });

  const queue = [startKey];
  while (queue.length) {
    const key = queue.shift();
    const dfaState = dfaStates.get(key);

    for (const ch of alpha) {
      // move
      const moved = [];
      for (const ns of dfaState.nfaStates) {
        if (ns.transitions[ch]) {
          for (const t of ns.transitions[ch]) moved.push(t);
        }
      }
      if (moved.length === 0) continue;

      const closure = epsilonClosure(moved);
      const newKey = stateSetKey(closure);

      if (!dfaStates.has(newKey)) {
        dfaStates.set(newKey, {
          id: nextId++,
          nfaStates: closure,
          transitions: {},
          accept: closure.some(s => s.id === acceptId),
        });
        queue.push(newKey);
      }

      dfaState.transitions[ch] = newKey;
    }
  }

  return { startKey, states: dfaStates, alphabet: alpha };
}

function stateSetKey(nfaStates) {
  return nfaStates.map(s => s.id).sort((a, b) => a - b).join(',');
}

/* ═══════════════════════════════════
   DFA Minimisation  (Hopcroft-style
   partition refinement)
   ═══════════════════════════════════ */
function minimizeDFA(dfa) {
  const { states, alphabet, startKey } = dfa;
  const stateList = [...states.values()];

  // Initial partition: accept vs. non-accept
  const accept = stateList.filter(s => s.accept);
  const nonAccept = stateList.filter(s => !s.accept);

  let partitions = [];
  if (accept.length) partitions.push(new Set(accept.map(s => s.id)));
  if (nonAccept.length) partitions.push(new Set(nonAccept.map(s => s.id)));

  const idToState = new Map();
  stateList.forEach(s => idToState.set(s.id, s));

  const idToKey = new Map();
  stateList.forEach(s => {
    for (const [key, val] of states.entries()) {
      if (val.id === s.id) { idToKey.set(s.id, key); break; }
    }
  });

  let changed = true;
  while (changed) {
    changed = false;
    const newPartitions = [];
    for (const part of partitions) {
      const splits = splitPartition(part, partitions, alphabet, idToState, states, idToKey);
      if (splits.length > 1) changed = true;
      newPartitions.push(...splits);
    }
    partitions = newPartitions;
  }

  // Build minimised DFA
  const partIndex = new Map(); // state id → partition index
  partitions.forEach((part, idx) => {
    for (const sid of part) partIndex.set(sid, idx);
  });

  const startState = states.get(startKey);
  const minStart = partIndex.get(startState.id);

  const minStates = new Map(); // partition idx → { id, transitions, accept }
  for (let i = 0; i < partitions.length; i++) {
    const representative = idToState.get([...partitions[i]][0]);
    const trans = {};
    for (const ch of alphabet) {
      const key = idToKey.get(representative.id);
      const targetKey = states.get(key).transitions[ch];
      if (targetKey !== undefined) {
        const targetState = states.get(targetKey);
        trans[ch] = partIndex.get(targetState.id);
      }
    }
    minStates.set(i, {
      id: i,
      transitions: trans,
      accept: representative.accept || false,
    });
  }

  return { start: minStart, states: minStates, alphabet };
}

function splitPartition(part, allPartitions, alphabet, idToState, dfaStates, idToKey) {
  if (part.size <= 1) return [part];

  for (const ch of alphabet) {
    const groups = new Map(); // target partition index (or -1 for dead) → set of state ids
    for (const sid of part) {
      const key = idToKey.get(sid);
      const targetKey = dfaStates.get(key).transitions[ch];
      let targetPart = -1;
      if (targetKey !== undefined) {
        const targetState = dfaStates.get(targetKey);
        targetPart = allPartitions.findIndex(p => p.has(targetState.id));
      }
      if (!groups.has(targetPart)) groups.set(targetPart, new Set());
      groups.get(targetPart).add(sid);
    }
    if (groups.size > 1) {
      return [...groups.values()];
    }
  }
  return [part];
}

/* ═══════════════════════════════════
   Get minimized DFAs for two REs
   (for display purposes)
   ═══════════════════════════════════ */
function getMinimizedDFAs(re1, re2) {
  const nfa1 = reToNFA(re1);
  const dfa1 = nfaToDFA(nfa1);
  const min1 = minimizeDFA(dfa1);

  const nfa2 = reToNFA(re2);
  const dfa2 = nfaToDFA(nfa2);
  const min2 = minimizeDFA(dfa2);

  return { min1, min2 };
}

/* ═══════════════════════════════════
   Equivalence check
   ═══════════════════════════════════ */
function checkEquivalence(re1, re2) {
  // Build minimal DFAs for both
  const nfa1 = reToNFA(re1);
  const dfa1 = nfaToDFA(nfa1);
  const min1 = minimizeDFA(dfa1);

  const nfa2 = reToNFA(re2);
  const dfa2 = nfaToDFA(nfa2);
  const min2 = minimizeDFA(dfa2);

  // BFS to check isomorphism / find counter-example
  const visited = new Set();
  const queue = [{ s1: min1.start, s2: min2.start, path: '' }];
  visited.add(`${min1.start},${min2.start}`);

  // Collect all alphabet symbols
  const allAlpha = new Set([...min1.alphabet, ...min2.alphabet]);

  while (queue.length) {
    const { s1, s2, path } = queue.shift();

    const st1 = min1.states.get(s1);
    const st2 = min2.states.get(s2);

    // If one accepts and the other doesn't → not equivalent
    const acc1 = st1 ? st1.accept : false;
    const acc2 = st2 ? st2.accept : false;
    if (acc1 !== acc2) {
      return { equivalent: false, counterExample: path || 'ε (empty string)', acceptedBy1: acc1, acceptedBy2: acc2 };
    }

    for (const ch of allAlpha) {
      const next1 = st1 && st1.transitions[ch] !== undefined ? st1.transitions[ch] : null;
      const next2 = st2 && st2.transitions[ch] !== undefined ? st2.transitions[ch] : null;

      // treat missing transition as dead state (id = -1)
      const n1 = next1 !== null ? next1 : -1;
      const n2 = next2 !== null ? next2 : -1;

      const key = `${n1},${n2}`;
      if (!visited.has(key)) {
        visited.add(key);
        // If one leads to a dead state and the other to an accept state, we'll catch it
        // by checking acceptance on the next dequeue.
        queue.push({
          s1: n1,
          s2: n2,
          path: path + ch,
        });
      }
    }
  }

  return { equivalent: true, counterExample: null, trace: null };
}

/* ═══════════════════════════════════
   DFA simulator — test if a string
   is accepted by a minimised DFA
   ═══════════════════════════════════ */
function simulateDFA(minDFA, str) {
  let current = minDFA.start;
  for (const ch of str) {
    const st = minDFA.states.get(current);
    if (!st || st.transitions[ch] === undefined) return false;
    current = st.transitions[ch];
  }
  const st = minDFA.states.get(current);
  return st ? st.accept : false;
}

/* ═══════════════════════════════════
   Build mismatch trace for animation.
   For each length 0..counterLen, generate
   a few sample strings and show accept/reject
   per RE, scanning until we hit the mismatch.
   ═══════════════════════════════════ */
function buildMismatchTrace(re1, re2, counterExample) {
  const nfa1 = reToNFA(re1);
  const dfa1 = nfaToDFA(nfa1);
  const min1 = minimizeDFA(dfa1);

  const nfa2 = reToNFA(re2);
  const dfa2 = nfaToDFA(nfa2);
  const min2 = minimizeDFA(dfa2);

  const ceLen = counterExample === 'ε (empty string)' ? 0 : counterExample.length;
  const trace = [];

  // Collect the alphabet from both DFAs
  const alpha = [...new Set([...min1.alphabet, ...min2.alphabet])].sort();

  // For each length 0..ceLen, generate sample strings and test them
  for (let len = 0; len <= ceLen; len++) {
    const samples = [];

    if (len === 0) {
      // Only the empty string
      const a1 = simulateDFA(min1, '');
      const a2 = simulateDFA(min2, '');
      samples.push({ str: 'ε', accept1: a1, accept2: a2, mismatch: a1 !== a2 });
    } else {
      // Generate a few representative strings of this length using BFS
      const strs = new Set();
      // Always include the counter-example if it's this length
      if (len === ceLen && counterExample !== 'ε (empty string)') {
        strs.add(counterExample);
      }
      // Build some strings of exactly this length from the alphabet
      const queue = [''];
      for (let d = 0; d < len && strs.size < 6; d++) {
        const nextQueue = [];
        for (const prefix of queue) {
          for (const ch of alpha) {
            if (prefix.length + 1 + (len - d - 1) === len && d === len - 1) {
              strs.add(prefix + ch);
            } else {
              nextQueue.push(prefix + ch);
            }
            if (strs.size >= 6 && nextQueue.length > 50) break;
          }
          if (nextQueue.length > 200) break;
        }
        queue.length = 0;
        queue.push(...nextQueue.slice(0, 200));
      }

      // If BFS didn't produce enough, generate simple repeating strings
      if (strs.size < 3) {
        for (const ch of alpha.slice(0, 3)) {
          strs.add(ch.repeat(len));
          if (strs.size >= 6) break;
        }
      }

      for (const s of strs) {
        if (s.length !== len) continue;
        const a1 = simulateDFA(min1, s);
        const a2 = simulateDFA(min2, s);
        samples.push({ str: s, accept1: a1, accept2: a2, mismatch: a1 !== a2 });
      }
    }

    const hasMismatch = samples.some(s => s.mismatch);
    trace.push({ length: len, samples, hasMismatch });
  }

  return trace;
}
