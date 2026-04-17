/* ═══════════════════════════════════════════════
   generator.js — Generate strings from a regex
   
   Supports the core formal-language RE operators:
     concatenation, alternation |, Kleene star *,
     plus +, optional ?, char classes [abc],
     ranges [a-z], bounded repetition {n}, {n,m},
     dot ., escape sequences \d \w \s
   ═══════════════════════════════════════════════ */

/* ── Token types ───────────────────────────── */
const T = Object.freeze({
  CHAR:       'CHAR',
  DOT:        'DOT',
  PIPE:       'PIPE',
  STAR:       'STAR',
  PLUS:       'PLUS',
  QUESTION:   'QUESTION',
  LPAREN:     'LPAREN',
  RPAREN:     'RPAREN',
  LBRACKET:   'LBRACKET',
  RBRACKET:   'RBRACKET',
  LBRACE:     'LBRACE',
  RBRACE:     'RBRACE',
  COMMA:      'COMMA',
  CARET:      'CARET',
  DOLLAR:     'DOLLAR',
  EOF:        'EOF',
});

/* ── AST node types ────────────────────────── */
const N = Object.freeze({
  LITERAL:    'LITERAL',      // { char }
  DOT:        'DOT',
  CHAR_CLASS: 'CHAR_CLASS',   // { chars: string[] }
  CONCAT:     'CONCAT',       // { left, right }
  ALT:        'ALT',          // { left, right }
  STAR:       'STAR',         // { child }
  PLUS:       'PLUS',         // { child }
  QUESTION:   'QUESTION',     // { child }
  REPEAT:     'REPEAT',       // { child, min, max }
  EMPTY:      'EMPTY',
});

/* ═══════════════════════════════════════════════
   Lexer
   ═══════════════════════════════════════════════ */
function tokenize(pattern) {
  const tokens = [];
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === '\\' && i + 1 < pattern.length) {
      const next = pattern[i + 1];
      if (next === 'd') {
        // Push a char-class token for digits
        tokens.push({ type: T.LBRACKET });
        '0123456789'.split('').forEach(ch => tokens.push({ type: T.CHAR, value: ch }));
        tokens.push({ type: T.RBRACKET });
        i += 2; continue;
      } else if (next === 'w') {
        tokens.push({ type: T.LBRACKET });
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'.split('').forEach(ch => tokens.push({ type: T.CHAR, value: ch }));
        tokens.push({ type: T.RBRACKET });
        i += 2; continue;
      } else if (next === 's') {
        tokens.push({ type: T.LBRACKET });
        [' ', '\t', '\n'].forEach(ch => tokens.push({ type: T.CHAR, value: ch }));
        tokens.push({ type: T.RBRACKET });
        i += 2; continue;
      } else {
        tokens.push({ type: T.CHAR, value: next });
        i += 2; continue;
      }
    }
    switch (c) {
      case '|':  tokens.push({ type: T.PIPE }); break;
      case '*':  tokens.push({ type: T.STAR }); break;
      case '+':  tokens.push({ type: T.PLUS }); break;
      case '⁺':  tokens.push({ type: T.PLUS }); break;
      case '?':  tokens.push({ type: T.QUESTION }); break;
      case '(':  tokens.push({ type: T.LPAREN }); break;
      case ')':  tokens.push({ type: T.RPAREN }); break;
      case '[':  tokens.push({ type: T.LBRACKET }); break;
      case ']':  tokens.push({ type: T.RBRACKET }); break;
      case '{':  tokens.push({ type: T.LBRACE }); break;
      case '}':  tokens.push({ type: T.RBRACE }); break;
      case ',':  tokens.push({ type: T.COMMA }); break;
      case '.':  tokens.push({ type: T.DOT }); break;
      case '^':  tokens.push({ type: T.CARET }); break;
      case '$':  tokens.push({ type: T.DOLLAR }); break;
      case 'ε':  break; // epsilon = empty string, skip (identity for concatenation)
      default:   tokens.push({ type: T.CHAR, value: c }); break;
    }
    i++;
  }
  tokens.push({ type: T.EOF });
  return tokens;
}

/* ═══════════════════════════════════════════════
   Parser  (recursive descent)
   Grammar:
     expr     → concat ( '|' concat )*
     concat   → quantified+
     quantified → atom ( '*' | '+' | '?' | '{n}' | '{n,m}' )?
     atom     → CHAR | '.' | group | charclass
     group    → '(' expr ')'
     charclass→ '[' ... ']'
   ═══════════════════════════════════════════════ */
function parse(pattern) {
  const tokens = tokenize(pattern);
  let pos = 0;
  const peek = () => tokens[pos];
  const advance = () => tokens[pos++];
  const expect = (type) => {
    if (peek().type !== type) throw new Error(`Expected ${type} but got ${peek().type}`);
    return advance();
  };

  function expr() {
    let node = concat();
    while (peek().type === T.PIPE) {
      advance();
      const right = concat();
      node = { type: N.ALT, left: node, right };
    }
    return node;
  }

  function concat() {
    let parts = [];
    while (
      peek().type !== T.PIPE &&
      peek().type !== T.RPAREN &&
      peek().type !== T.EOF
    ) {
      parts.push(quantified());
    }
    if (parts.length === 0) return { type: N.EMPTY };
    if (parts.length === 1) return parts[0];
    let node = parts[0];
    for (let i = 1; i < parts.length; i++) {
      node = { type: N.CONCAT, left: node, right: parts[i] };
    }
    return node;
  }

  function quantified() {
    let node = atom();
    if (peek().type === T.STAR)     { advance(); return { type: N.STAR, child: node }; }
    if (peek().type === T.PLUS)     { advance(); return { type: N.PLUS, child: node }; }
    if (peek().type === T.QUESTION) { advance(); return { type: N.QUESTION, child: node }; }
    if (peek().type === T.LBRACE) {
      advance(); // {
      let numStr = '';
      while (peek().type === T.CHAR && /\d/.test(peek().value)) {
        numStr += advance().value;
      }
      const min = parseInt(numStr, 10);
      if (peek().type === T.COMMA) {
        advance(); // ,
        let numStr2 = '';
        while (peek().type === T.CHAR && /\d/.test(peek().value)) {
          numStr2 += advance().value;
        }
        const max = numStr2 ? parseInt(numStr2, 10) : min + 3; // default cap
        expect(T.RBRACE);
        return { type: N.REPEAT, child: node, min, max };
      }
      expect(T.RBRACE);
      return { type: N.REPEAT, child: node, min, max: min };
    }
    return node;
  }

  function atom() {
    const t = peek();
    if (t.type === T.CHAR) {
      advance();
      return { type: N.LITERAL, char: t.value };
    }
    if (t.type === T.DOT) {
      advance();
      return { type: N.DOT };
    }
    if (t.type === T.CARET || t.type === T.DOLLAR) {
      // anchors — treat as empty (no character consumed) for generation
      advance();
      return { type: N.EMPTY };
    }
    if (t.type === T.LPAREN) {
      advance();
      const node = expr();
      expect(T.RPAREN);
      return node;
    }
    if (t.type === T.LBRACKET) {
      return charClass();
    }
    throw new Error(`Unexpected token: ${t.type}${t.value ? ' (' + t.value + ')' : ''}`);
  }

  function charClass() {
    advance(); // [
    const chars = new Set();
    while (peek().type !== T.RBRACKET && peek().type !== T.EOF) {
      const c1 = advance();
      if (c1.type !== T.CHAR) { chars.add(c1.value || c1.type); continue; }
      // check for range  a-z
      if (peek().type === T.CHAR && peek().value === '-') {
        advance(); // -
        if (peek().type === T.CHAR) {
          const c2 = advance();
          const lo = c1.value.charCodeAt(0);
          const hi = c2.value.charCodeAt(0);
          for (let code = lo; code <= hi; code++) {
            chars.add(String.fromCharCode(code));
          }
          continue;
        } else {
          chars.add(c1.value);
          chars.add('-');
          continue;
        }
      }
      chars.add(c1.value);
    }
    expect(T.RBRACKET);
    return { type: N.CHAR_CLASS, chars: [...chars] };
  }

  const ast = expr();
  if (peek().type !== T.EOF) {
    throw new Error(`Unexpected token at position ${pos}: ${peek().type}`);
  }
  return ast;
}

/* ═══════════════════════════════════════════════
   String generator — DFA-based BFS enumeration.
   Builds NFA → DFA from the regex, then walks the
   DFA breadth-first producing strings in perfect
   length-first, then lexicographic order.
   ═══════════════════════════════════════════════ */
const DOT_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');

function generateStrings(pattern, maxCount = 60) {
  const ast = parse(pattern); // may throw — uses parser above

  // ── Build NFA → DFA using equivalence.js infrastructure ──
  const nfa   = reToNFA(pattern);
  const dfa   = nfaToDFA(nfa);

  // Collect sorted alphabet for consistent ordering
  const alpha = [...dfa.alphabet].sort();
  if (alpha.length === 0) {
    const startState = dfa.states.get(dfa.startKey);
    return startState && startState.accept ? [''] : [];
  }

  const results = [];
  const accepted = new Set(); // track accepted strings to avoid dupes

  // Check if start state accepts (empty string)
  const startState = dfa.states.get(dfa.startKey);
  if (startState && startState.accept) {
    results.push('');
    accepted.add('');
    if (results.length >= maxCount) return results;
  }

  // ── Level-by-level BFS ──
  // Each level = all strings of a specific length.
  // We keep ALL unique (dfaKey, str) entries per level, capped at
  // LEVEL_CAP to prevent combinatorial explosion. Entries within
  // each level are processed in alphabetical order of their str
  // field, ensuring lexicographic ordering of accepted strings.
  const LEVEL_CAP = 500;
  let currentLevel = [{ dfaKey: dfa.startKey, str: '' }];

  while (currentLevel.length > 0 && results.length < maxCount) {
    // Expand each entry by each alphabet char (already sorted)
    const nextEntries = [];
    const nextAccepted = [];

    for (const { dfaKey, str } of currentLevel) {
      const dfaState = dfa.states.get(dfaKey);
      if (!dfaState) continue;

      for (const ch of alpha) {
        const nextKey = dfaState.transitions[ch];
        if (nextKey === undefined) continue;

        const nextStr = str + ch;
        const nextState = dfa.states.get(nextKey);

        // Collect accepted strings at this new length
        if (nextState && nextState.accept && !accepted.has(nextStr)) {
          accepted.add(nextStr);
          nextAccepted.push(nextStr);
        }

        nextEntries.push({ dfaKey: nextKey, str: nextStr });
      }
    }

    // Sort accepted strings at this length lexicographically
    nextAccepted.sort((a, b) => a.localeCompare(b));
    for (const s of nextAccepted) {
      results.push(s);
      if (results.length >= maxCount) return results;
    }

    // Deduplicate next-level entries: keep unique (dfaKey, str) pairs
    // and cap at LEVEL_CAP to prevent exponential blowup
    const seen = new Set();
    const deduped = [];
    for (const entry of nextEntries) {
      const key = entry.dfaKey + '|' + entry.str;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(entry);
      }
    }
    // If too many entries, keep the first LEVEL_CAP (they're already
    // in alphabetical order since we expand alphabetically)
    currentLevel = deduped.length > LEVEL_CAP
      ? deduped.slice(0, LEVEL_CAP)
      : deduped;
  }

  return results;
}

