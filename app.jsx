const { useState, useMemo, useEffect, useRef, useCallback } = React;

// ---- Sample texts ---------------------------------------------------------
const SAMPLE_A = `Dear Marion,

I hope this letter finds you in good spirits. The days have grown shorter here, and the garden is beginning to retire for the season. I spent yesterday afternoon rereading the pages you sent me in September — you have a gift for noticing the small, luminous details that most writers hurry past.

I would be delighted to read the next chapter whenever you feel it is ready. No pressure, of course. The best work takes the time it takes.

With warm regards,
Eleanor`;

const SAMPLE_B = `Dear Marion,

I hope this letter finds you well. The days have grown shorter here in the valley, and the garden is quietly retiring for the season. I spent Sunday afternoon rereading the pages you sent in early September — you have a rare gift for noticing the small, luminous details that most writers sprint past without a glance.

I would be genuinely delighted to read the next chapter whenever you feel it is ready. No pressure at all. The best work takes exactly the time it takes.

Yours warmly,
Eleanor`;

// ---- Tweaks ---------------------------------------------------------------
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "granularity": "word",
  "viewMode": "side",
  "serifFont": "Fraunces",
  "accent": "sage",
  "paper": true,
  "showLineNumbers": true
}/*EDITMODE-END*/;

const ACCENTS = {
  sage:   { add: '#4a6b4a', addBg: '#dae6d4', del: '#8a4a3f', delBg: '#ecd5ce', dot: '#6a8c6a' },
  ink:    { add: '#2b5f8a', addBg: '#d6e3ef', del: '#8a3a3a', delBg: '#ecd0d0', dot: '#3f7aa8' },
  plum:   { add: '#6b4a7a', addBg: '#e4d9ea', del: '#a0604a', delBg: '#f0dbd0', dot: '#836094' },
  mono:   { add: '#1f1f1f', addBg: '#e4e4e0', del: '#1f1f1f', delBg: '#efe0dc', dot: '#555' },
};

// ---- Root -----------------------------------------------------------------
function App() {
  const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);
  const [textA, setTextA] = useState(SAMPLE_A);
  const [textB, setTextB] = useState(SAMPLE_B);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [ignoreWS, setIgnoreWS] = useState(false);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [tweaksEnabled, setTweaksEnabled] = useState(false);
  const [activeChange, setActiveChange] = useState(0);

  // Tweaks host protocol
  useEffect(() => {
    function onMsg(e) {
      const d = e.data || {};
      if (d.type === '__activate_edit_mode') { setTweaksEnabled(true); setTweaksOpen(true); }
      if (d.type === '__deactivate_edit_mode') { setTweaksEnabled(false); setTweaksOpen(false); }
    }
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  function updateTweak(key, value) {
    setTweaks(t => ({ ...t, [key]: value }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: value } }, '*');
  }

  // Preprocess for ignore toggles
  const [procA, procB] = useMemo(() => {
    let a = textA, b = textB;
    if (ignoreCase) { a = a.toLowerCase(); b = b.toLowerCase(); }
    if (ignoreWS) { a = a.replace(/[ \t]+/g, ' '); b = b.replace(/[ \t]+/g, ' '); }
    return [a, b];
  }, [textA, textB, ignoreCase, ignoreWS]);

  const ops = useMemo(
    () => TextDiff.diffText(procA, procB, tweaks.granularity),
    [procA, procB, tweaks.granularity]
  );
  const stats = useMemo(() => TextDiff.computeStats(ops, procA, procB), [ops, procA, procB]);

  // Count of change blocks (contiguous non-equal runs)
  const changeCount = useMemo(() => {
    let c = 0;
    for (let i = 0; i < ops.length; i++) {
      if (ops[i].type !== 'equal') {
        if (i === 0 || ops[i-1].type === 'equal') c++;
      }
    }
    return c;
  }, [ops]);

  const accent = ACCENTS[tweaks.accent] || ACCENTS.sage;

  // Sync scroll refs
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  useEffect(() => {
    const L = leftRef.current, R = rightRef.current;
    if (!L || !R) return;
    let lock = false;
    function sync(src, dst) {
      if (lock) return;
      lock = true;
      const ratio = src.scrollTop / Math.max(1, src.scrollHeight - src.clientHeight);
      dst.scrollTop = ratio * (dst.scrollHeight - dst.clientHeight);
      requestAnimationFrame(() => { lock = false; });
    }
    const onL = () => sync(L, R);
    const onR = () => sync(R, L);
    L.addEventListener('scroll', onL);
    R.addEventListener('scroll', onR);
    return () => { L.removeEventListener('scroll', onL); R.removeEventListener('scroll', onR); };
  }, [tweaks.viewMode]);

  // Jump to change
  const jumpRefs = useRef([]);
  function jumpToChange(idx) {
    const list = jumpRefs.current.filter(Boolean);
    if (!list.length) return;
    const target = list[((idx % list.length) + list.length) % list.length];
    if (target) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target.classList.add('flash');
      setTimeout(() => target.classList.remove('flash'), 900);
    }
    setActiveChange(((idx % list.length) + list.length) % list.length);
  }

  return (
    <div className={`root accent-${tweaks.accent} ${tweaks.paper ? 'paper' : ''}`}
         style={{ '--serif': `'${tweaks.serifFont}', 'Fraunces', Georgia, serif` }}>
      <style>{`
        .root.accent-${tweaks.accent} {
          --add: ${accent.add};
          --add-bg: ${accent.addBg};
          --del: ${accent.del};
          --del-bg: ${accent.delBg};
          --dot: ${accent.dot};
        }
      `}</style>

      <Header
        stats={stats}
        changeCount={changeCount}
        activeChange={activeChange}
        onPrev={() => jumpToChange(activeChange - 1)}
        onNext={() => jumpToChange(activeChange + 1)}
        ignoreCase={ignoreCase} setIgnoreCase={setIgnoreCase}
        ignoreWS={ignoreWS} setIgnoreWS={setIgnoreWS}
        granularity={tweaks.granularity}
        setGranularity={v => updateTweak('granularity', v)}
        viewMode={tweaks.viewMode}
        setViewMode={v => updateTweak('viewMode', v)}
        onLoadSample={() => { setTextA(SAMPLE_A); setTextB(SAMPLE_B); }}
        onClear={() => { setTextA(''); setTextB(''); }}
        onSwap={() => { setTextA(textB); setTextB(textA); }}
      />

      <main className="stage">
        <aside className="summary">
          <SummaryCard stats={stats} changeCount={changeCount} ops={ops} />
        </aside>

        <section className="diffgrid">
          {tweaks.viewMode === 'side' ? (
            <SideBySide
              textA={textA} textB={textB}
              setTextA={setTextA} setTextB={setTextB}
              ops={ops}
              leftRef={leftRef} rightRef={rightRef}
              jumpRefs={jumpRefs}
              showLineNumbers={tweaks.showLineNumbers}
            />
          ) : tweaks.viewMode === 'unified' ? (
            <Unified ops={ops} jumpRefs={jumpRefs} showLineNumbers={tweaks.showLineNumbers} />
          ) : (
            <Inline ops={ops} jumpRefs={jumpRefs} />
          )}
        </section>
      </main>

      {tweaksEnabled && tweaksOpen && (
        <TweaksPanel tweaks={tweaks} onChange={updateTweak} onClose={() => setTweaksOpen(false)} />
      )}
      {tweaksEnabled && !tweaksOpen && (
        <button className="tweaks-fab" onClick={() => setTweaksOpen(true)}>Tweaks</button>
      )}
    </div>
  );
}

// ---- Header ---------------------------------------------------------------
function Header({
  stats, changeCount, activeChange, onPrev, onNext,
  ignoreCase, setIgnoreCase, ignoreWS, setIgnoreWS,
  granularity, setGranularity, viewMode, setViewMode,
  onLoadSample, onClear, onSwap,
}) {
  return (
    <header className="header">
      <div className="brand">
        <div className="mark">
          <span className="mark-a">A</span>
          <span className="mark-dash" />
          <span className="mark-b">B</span>
        </div>
        <div className="brand-text">
          <h1>Collation</h1>
          <p className="brand-sub">a careful reading of two drafts</p>
        </div>
      </div>

      <div className="header-stats">
        <Stat label="similarity" value={`${stats.similarity}%`} big />
        <Divider />
        <Stat label="added" value={`+${stats.wordsAdded}`} tone="add" />
        <Stat label="removed" value={`−${stats.wordsRemoved}`} tone="del" />
        <Divider />
        <div className="nav-changes">
          <button className="ghost" onClick={onPrev} aria-label="previous change">↑</button>
          <div className="nav-count">
            <span className="nav-num">{changeCount === 0 ? 0 : activeChange + 1}</span>
            <span className="nav-slash">/</span>
            <span className="nav-tot">{changeCount}</span>
            <span className="nav-lab">changes</span>
          </div>
          <button className="ghost" onClick={onNext} aria-label="next change">↓</button>
        </div>
      </div>

      <div className="header-tools">
        <SegControl
          label="view"
          options={[['side','side-by-side'],['unified','unified'],['inline','inline']]}
          value={viewMode} onChange={setViewMode}
        />
        <SegControl
          label="detail"
          options={[['char','char'],['word','word'],['line','line']]}
          value={granularity} onChange={setGranularity}
        />
        <div className="toggles">
          <Toggle label="ignore case" value={ignoreCase} onChange={setIgnoreCase} />
          <Toggle label="ignore whitespace" value={ignoreWS} onChange={setIgnoreWS} />
        </div>
        <div className="actions">
          <button className="ghost tiny" onClick={onSwap}>⇄ swap</button>
          <button className="ghost tiny" onClick={onLoadSample}>sample</button>
          <button className="ghost tiny" onClick={onClear}>clear</button>
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value, tone, big }) {
  return (
    <div className={`stat ${tone || ''} ${big ? 'big' : ''}`}>
      <div className="stat-val">{value}</div>
      <div className="stat-lab">{label}</div>
    </div>
  );
}
function Divider() { return <span className="v-div" />; }

function SegControl({ label, options, value, onChange }) {
  return (
    <div className="seg">
      <span className="seg-label">{label}</span>
      <div className="seg-track">
        {options.map(([v, l]) => (
          <button key={v} className={`seg-btn ${value === v ? 'on' : ''}`} onClick={() => onChange(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
function Toggle({ label, value, onChange }) {
  return (
    <label className={`tog ${value ? 'on' : ''}`}>
      <span className="tog-switch"><span className="tog-dot" /></span>
      <span className="tog-lab">{label}</span>
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} />
    </label>
  );
}

// ---- Summary rail ---------------------------------------------------------
function SummaryCard({ stats, changeCount, ops }) {
  // Ribbon visualizing the shape of change
  const total = ops.reduce((s, o) => s + o.value.length, 0) || 1;
  return (
    <div className="summary-card">
      <div className="sum-row">
        <span className="sum-k">Document A</span>
        <span className="sum-v">{stats.aWords} w · {stats.aChars} ch</span>
      </div>
      <div className="sum-row">
        <span className="sum-k">Document B</span>
        <span className="sum-v">{stats.bWords} w · {stats.bChars} ch</span>
      </div>

      <div className="sum-hr" />

      <div className="sum-big">
        <div className="sum-big-num">{stats.similarity}<span className="pct">%</span></div>
        <div className="sum-big-lab">similarity</div>
      </div>

      <div className="ribbon" aria-hidden>
        {ops.map((o, i) => (
          <span key={i}
                className={`rib rib-${o.type}`}
                style={{ flex: Math.max(0.4, (o.value.length / total) * 100) }}
                title={`${o.type} · ${o.value.length} chars`} />
        ))}
      </div>
      <div className="ribbon-legend">
        <span><em className="dot eq" /> kept</span>
        <span><em className="dot add" /> added</span>
        <span><em className="dot del" /> removed</span>
      </div>

      <div className="sum-hr" />

      <div className="sum-grid">
        <div><b>{changeCount}</b><span>change blocks</span></div>
        <div><b className="add">+{stats.additions}</b><span>chars added</span></div>
        <div><b className="del">−{stats.deletions}</b><span>chars removed</span></div>
        <div><b>{stats.readB - stats.readA >= 0 ? '+' : ''}{stats.readB - stats.readA}m</b><span>read-time Δ</span></div>
      </div>
    </div>
  );
}

// ---- Side-by-side ---------------------------------------------------------
function SideBySide({ textA, textB, setTextA, setTextB, ops, leftRef, rightRef, jumpRefs, showLineNumbers }) {
  jumpRefs.current = [];

  // Build per-side annotated spans
  const leftNodes = [];
  const rightNodes = [];
  let changeIdx = 0;
  let inChange = false;
  ops.forEach((op, i) => {
    const isChange = op.type !== 'equal';
    if (isChange && !inChange) { changeIdx++; inChange = true; }
    if (!isChange) inChange = false;

    const attachRef = (el) => {
      if (el && isChange) {
        const idx = changeIdx - 1;
        if (!jumpRefs.current[idx]) jumpRefs.current[idx] = el;
      }
    };

    if (op.type === 'equal') {
      leftNodes.push(<span key={`l${i}`}>{op.value}</span>);
      rightNodes.push(<span key={`r${i}`}>{op.value}</span>);
    } else if (op.type === 'delete') {
      leftNodes.push(
        <span key={`l${i}`} ref={attachRef} className="chip del">
          {op.value}
        </span>
      );
    } else {
      rightNodes.push(
        <span key={`r${i}`} ref={attachRef} className="chip add">
          {op.value}
        </span>
      );
    }
  });

  return (
    <div className="pair">
      <DocPane
        refObj={leftRef}
        sideLabel="A · original"
        editValue={textA}
        onEdit={setTextA}
        children={leftNodes}
        showLineNumbers={showLineNumbers}
        tone="del"
      />
      <DocPane
        refObj={rightRef}
        sideLabel="B · revised"
        editValue={textB}
        onEdit={setTextB}
        children={rightNodes}
        showLineNumbers={showLineNumbers}
        tone="add"
      />
    </div>
  );
}

function DocPane({ refObj, sideLabel, editValue, onEdit, children, showLineNumbers, tone }) {
  const [mode, setMode] = useState('view'); // 'view' | 'edit'

  return (
    <div className={`pane pane-${tone}`}>
      <div className="pane-head">
        <span className="pane-label">{sideLabel}</span>
        <div className="pane-actions">
          <button className={`tab ${mode === 'view' ? 'on' : ''}`} onClick={() => setMode('view')}>diff</button>
          <button className={`tab ${mode === 'edit' ? 'on' : ''}`} onClick={() => setMode('edit')}>edit</button>
        </div>
      </div>
      {mode === 'view' ? (
        <div className="pane-body" ref={refObj}>
          {showLineNumbers && <LineNumbers text={editValue} />}
          <pre className="doc">{children}</pre>
        </div>
      ) : (
        <div className="pane-body">
          <textarea
            className="doc-edit"
            value={editValue}
            onChange={e => onEdit(e.target.value)}
            spellCheck={false}
            placeholder="paste text here…"
          />
        </div>
      )}
    </div>
  );
}

function LineNumbers({ text }) {
  const lines = text.split('\n');
  return (
    <div className="ln-col" aria-hidden>
      {lines.map((_, i) => <span key={i}>{i + 1}</span>)}
    </div>
  );
}

// ---- Unified --------------------------------------------------------------
function Unified({ ops, jumpRefs, showLineNumbers }) {
  jumpRefs.current = [];
  // Split into "lines" grouping ops until a newline token
  // Simpler: render as flowing text with red/green chips inline, with line numbers by line breaks
  let changeIdx = 0;
  let inChange = false;

  const nodes = [];
  ops.forEach((op, i) => {
    const isChange = op.type !== 'equal';
    if (isChange && !inChange) { changeIdx++; inChange = true; }
    if (!isChange) inChange = false;

    const attachRef = (el) => {
      if (el && isChange) {
        const idx = changeIdx - 1;
        if (!jumpRefs.current[idx]) jumpRefs.current[idx] = el;
      }
    };

    if (op.type === 'equal') {
      nodes.push(<span key={i}>{op.value}</span>);
    } else if (op.type === 'insert') {
      nodes.push(<span key={i} ref={attachRef} className="chip add">{op.value}</span>);
    } else {
      nodes.push(<span key={i} ref={attachRef} className="chip del strike">{op.value}</span>);
    }
  });

  return (
    <div className="pane pane-unified">
      <div className="pane-head">
        <span className="pane-label">unified · deletions struck, additions highlighted</span>
      </div>
      <div className="pane-body">
        <pre className="doc">{nodes}</pre>
      </div>
    </div>
  );
}

// ---- Inline ---------------------------------------------------------------
function Inline({ ops, jumpRefs }) {
  jumpRefs.current = [];
  let changeIdx = 0;
  let inChange = false;

  const nodes = [];
  ops.forEach((op, i) => {
    const isChange = op.type !== 'equal';
    if (isChange && !inChange) { changeIdx++; inChange = true; }
    if (!isChange) inChange = false;

    const attachRef = (el) => {
      if (el && isChange) {
        const idx = changeIdx - 1;
        if (!jumpRefs.current[idx]) jumpRefs.current[idx] = el;
      }
    };

    if (op.type === 'equal') {
      nodes.push(<span key={i}>{op.value}</span>);
    } else if (op.type === 'insert') {
      nodes.push(
        <span key={i} ref={attachRef} className="inline-chip add">
          <span className="inline-mark">+</span>{op.value}
        </span>
      );
    } else {
      nodes.push(
        <span key={i} ref={attachRef} className="inline-chip del">
          <span className="inline-mark">−</span><s>{op.value}</s>
        </span>
      );
    }
  });

  return (
    <div className="pane pane-inline">
      <div className="pane-head">
        <span className="pane-label">inline · a single woven reading</span>
      </div>
      <div className="pane-body">
        <pre className="doc">{nodes}</pre>
      </div>
    </div>
  );
}

// ---- Tweaks panel ---------------------------------------------------------
function TweaksPanel({ tweaks, onChange, onClose }) {
  return (
    <div className="tweaks-panel">
      <div className="tweaks-head">
        <span>Tweaks</span>
        <button className="x" onClick={onClose}>×</button>
      </div>
      <div className="tweaks-body">
        <div className="tweak-row">
          <label>Accent palette</label>
          <div className="tweak-swatches">
            {Object.keys(ACCENTS).map(k => (
              <button key={k}
                      className={`sw sw-${k} ${tweaks.accent === k ? 'on' : ''}`}
                      onClick={() => onChange('accent', k)}
                      title={k}>
                <span className="sw-del" style={{ background: ACCENTS[k].delBg, borderColor: ACCENTS[k].del }} />
                <span className="sw-add" style={{ background: ACCENTS[k].addBg, borderColor: ACCENTS[k].add }} />
              </button>
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <label>Serif</label>
          <div className="tweak-seg">
            {['Fraunces', 'EB Garamond', 'Newsreader', 'Instrument Serif'].map(f => (
              <button key={f} className={tweaks.serifFont === f ? 'on' : ''}
                      onClick={() => onChange('serifFont', f)}
                      style={{ fontFamily: `'${f}', serif` }}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <label>Granularity</label>
          <div className="tweak-seg">
            {['char','word','line'].map(g => (
              <button key={g} className={tweaks.granularity === g ? 'on' : ''}
                      onClick={() => onChange('granularity', g)}>{g}</button>
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <label>View</label>
          <div className="tweak-seg">
            {[['side','side'],['unified','unified'],['inline','inline']].map(([v, l]) => (
              <button key={v} className={tweaks.viewMode === v ? 'on' : ''}
                      onClick={() => onChange('viewMode', v)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <label>Paper texture</label>
          <Toggle label="" value={tweaks.paper} onChange={v => onChange('paper', v)} />
        </div>
        <div className="tweak-row">
          <label>Line numbers</label>
          <Toggle label="" value={tweaks.showLineNumbers} onChange={v => onChange('showLineNumbers', v)} />
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
