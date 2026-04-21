// Myers diff — returns an array of {type: 'equal'|'insert'|'delete', value: string}
// Works on arbitrary token arrays; we wrap with tokenizers for word / char / line.

(function (global) {
  function diffTokens(a, b) {
    const n = a.length, m = b.length;
    const max = n + m;
    if (max === 0) return [];
    const v = {};
    const trace = [];
    v[1] = 0;
    outer: for (let d = 0; d <= max; d++) {
      const snap = {};
      for (let k = -d; k <= d; k += 2) {
        let x;
        if (k === -d || (k !== d && (v[k - 1] ?? -1) < (v[k + 1] ?? -1))) {
          x = v[k + 1] ?? 0;
        } else {
          x = (v[k - 1] ?? 0) + 1;
        }
        let y = x - k;
        while (x < n && y < m && a[x] === b[y]) { x++; y++; }
        v[k] = x;
        snap[k] = x;
        if (x >= n && y >= m) {
          trace.push(snap);
          break outer;
        }
      }
      trace.push(snap);
    }
    // Backtrack
    const ops = [];
    let x = n, y = m;
    for (let d = trace.length - 1; d > 0; d--) {
      const vd = trace[d];
      const vp = trace[d - 1];
      const k = x - y;
      let prevK;
      if (k === -d || (k !== d && (vp[k - 1] ?? -1) < (vp[k + 1] ?? -1))) {
        prevK = k + 1;
      } else {
        prevK = k - 1;
      }
      const prevX = vp[prevK] ?? 0;
      const prevY = prevX - prevK;
      while (x > prevX && y > prevY) {
        ops.push({ type: 'equal', a: x - 1, b: y - 1 });
        x--; y--;
      }
      if (d > 0) {
        if (x === prevX) {
          ops.push({ type: 'insert', b: y - 1 });
          y--;
        } else {
          ops.push({ type: 'delete', a: x - 1 });
          x--;
        }
      }
    }
    while (x > 0 && y > 0) {
      ops.push({ type: 'equal', a: x - 1, b: y - 1 });
      x--; y--;
    }
    ops.reverse();

    // Coalesce into runs with values
    const result = [];
    for (const op of ops) {
      const last = result[result.length - 1];
      if (op.type === 'equal') {
        const val = a[op.a];
        if (last && last.type === 'equal') last.tokens.push(val);
        else result.push({ type: 'equal', tokens: [val] });
      } else if (op.type === 'insert') {
        const val = b[op.b];
        if (last && last.type === 'insert') last.tokens.push(val);
        else result.push({ type: 'insert', tokens: [val] });
      } else {
        const val = a[op.a];
        if (last && last.type === 'delete') last.tokens.push(val);
        else result.push({ type: 'delete', tokens: [val] });
      }
    }
    return result;
  }

  // Tokenizers
  function tokenizeWords(s) {
    // Split keeping whitespace as their own tokens so we preserve spacing
    return s.match(/(\s+|[^\s]+)/g) || [];
  }
  function tokenizeChars(s) {
    return Array.from(s);
  }
  function tokenizeLines(s) {
    return s.split(/(\n)/).filter(x => x.length > 0);
  }

  function diffText(a, b, mode = 'word') {
    const tokenize =
      mode === 'char' ? tokenizeChars :
      mode === 'line' ? tokenizeLines :
      tokenizeWords;
    const ta = tokenize(a);
    const tb = tokenize(b);
    const ops = diffTokens(ta, tb);
    return ops.map(op => ({ type: op.type, value: op.tokens.join('') }));
  }

  // Stats
  function computeStats(ops, a, b) {
    let additions = 0, deletions = 0, unchanged = 0;
    let wordsAdded = 0, wordsRemoved = 0;
    for (const op of ops) {
      const chars = op.value.length;
      const words = (op.value.match(/\S+/g) || []).length;
      if (op.type === 'insert') { additions += chars; wordsAdded += words; }
      else if (op.type === 'delete') { deletions += chars; wordsRemoved += words; }
      else { unchanged += chars; }
    }
    const total = Math.max(a.length, b.length, 1);
    const similarity = Math.round((unchanged / total) * 100);
    const aWords = (a.match(/\S+/g) || []).length;
    const bWords = (b.match(/\S+/g) || []).length;
    const readA = Math.max(1, Math.round(aWords / 200));
    const readB = Math.max(1, Math.round(bWords / 200));
    return {
      additions, deletions, similarity,
      wordsAdded, wordsRemoved,
      aChars: a.length, bChars: b.length,
      aWords, bWords,
      readA, readB,
    };
  }

  global.TextDiff = { diffText, computeStats };
})(window);
