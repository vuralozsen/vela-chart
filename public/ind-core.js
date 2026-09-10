/* =====================================================================
   Vela Chart — indikatör motoru (saf hesap; DOM/grafik bağımsız)
   bars girdisi: [{time,open,high,low,close,volume}] ; time = grafik zamanı
   Çıktı her seri için: [{time,value}] veya histogram için [{time,value,color}]
   ===================================================================== */
(function (root) {
  'use strict';
  const U = {};

  /* ---------------- temel yardımcılar ---------------- */
  const arr = (n) => new Array(n).fill(null);
  const S = (bars, k) => bars.map(x => x[k]);

  U.sma = function (bars, p, key) {           // basit ortalama
    key = key || 'close'; const src = S(bars, key), out = []; let s = 0;
    for (let i = 0; i < src.length; i++) {
      s += src[i];
      if (i >= p) s -= src[i - p];
      if (i >= p - 1) out.push({ time: bars[i].time, value: s / p });
    }
    return out;
  };
  U.ema = function (bars, p, key) {           // üstel ortalama (seed = SMA)
    key = key || 'close'; const src = S(bars, key), out = [];
    if (src.length < p) return out;
    const k = 2 / (p + 1); let s = 0;
    for (let i = 0; i < p; i++) s += src[i];
    let prev = s / p; out.push({ time: bars[p - 1].time, value: prev });
    for (let i = p; i < src.length; i++) { prev = src[i] * k + prev * (1 - k); out.push({ time: bars[i].time, value: prev }); }
    return out;
  };
  U.rma = function (bars, p, key) {           // Wilder yumuşatma
    key = key || 'close'; const src = S(bars, key), out = [];
    if (src.length < p) return out;
    let s = 0; for (let i = 0; i < p; i++) s += src[i];
    let prev = s / p; out.push({ time: bars[p - 1].time, value: prev });
    for (let i = p; i < src.length; i++) { prev = (prev * (p - 1) + src[i]) / p; out.push({ time: bars[i].time, value: prev }); }
    return out;
  };
  U.wma = function (bars, p, key) {           // ağırlıklı ortalama
    key = key || 'close'; const src = S(bars, key), out = [], den = p * (p + 1) / 2;
    for (let i = p - 1; i < src.length; i++) {
      let s = 0; for (let j = 0; j < p; j++) s += src[i - j] * (p - j);
      out.push({ time: bars[i].time, value: s / den });
    }
    return out;
  };
  U.hma = function (bars, p) {                // Hull
    const w2 = U.wma(bars, Math.max(1, Math.round(p / 2)));
    const w1 = U.wma(bars, p); const m = new Map(w2.map(x => [x.time, x.value]));
    const diff = w1.filter(x => m.has(x.time)).map(x => ({ time: x.time, value: 2 * m.get(x.time) - x.value }));
    const sq = Math.max(1, Math.round(Math.sqrt(p)));
    const out = []; const den = sq * (sq + 1) / 2;
    for (let i = sq - 1; i < diff.length; i++) {
      let s = 0; for (let j = 0; j < sq; j++) s += diff[i - j].value * (sq - j);
      out.push({ time: diff[i].time, value: s / den });
    }
    return out;
  };
  U.emaSer = function (ser, p) {              // {time,value} serisi üzerinde EMA
    const out = []; if (ser.length < p) return out;
    const k = 2 / (p + 1); let s = 0;
    for (let i = 0; i < p; i++) s += ser[i].value;
    let prev = s / p; out.push({ time: ser[p - 1].time, value: prev });
    for (let i = p; i < ser.length; i++) { prev = ser[i].value * k + prev * (1 - k); out.push({ time: ser[i].time, value: prev }); }
    return out;
  };
  U.dema = function (bars, p) {
    const e1 = U.ema(bars, p); if (!e1.length) return [];
    const e2 = U.emaSer(e1, p); const m = new Map(e2.map(x => [x.time, x.value]));
    return e1.filter(x => m.has(x.time)).map(x => ({ time: x.time, value: 2 * x.value - m.get(x.time) }));
  };
  U.tema = function (bars, p) {
    const e1 = U.ema(bars, p); if (!e1.length) return [];
    const e2 = U.emaSer(e1, p); if (!e2.length) return [];
    const e3 = U.emaSer(e2, p);
    const m2 = new Map(e2.map(x => [x.time, x.value])), m3 = new Map(e3.map(x => [x.time, x.value]));
    return e1.filter(x => m3.has(x.time)).map(x => ({ time: x.time, value: 3 * x.value - 3 * m2.get(x.time) + m3.get(x.time) }));
  };
  U.stdev = function (bars, p, key) {
    key = key || 'close'; const src = S(bars, key), out = [];
    for (let i = p - 1; i < src.length; i++) {
      let m = 0; for (let j = 0; j < p; j++) m += src[i - j]; m /= p;
      let v = 0; for (let j = 0; j < p; j++) v += Math.pow(src[i - j] - m, 2);
      out.push({ time: bars[i].time, value: Math.sqrt(v / p) });
    }
    return out;
  };
  U.tr = function (bars) {
    const out = [];
    for (let i = 0; i < bars.length; i++) {
      const h = bars[i].high, l = bars[i].low, pc = i ? bars[i - 1].close : bars[i].close;
      out.push({ time: bars[i].time, value: Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)) });
    }
    return out;
  };
  U.atr = function (bars, p) {
    const t = U.tr(bars), plain = bars.map((x, i) => ({ time: x.time, close: t[i].value }));
    return U.rma(plain, p, 'close');
  };
  U.highest = function (bars, p, key) {
    key = key || 'high'; const out = [];
    for (let i = p - 1; i < bars.length; i++) { let m = -Infinity; for (let j = 0; j < p; j++) m = Math.max(m, bars[i - j][key]); out.push({ time: bars[i].time, value: m }); }
    return out;
  };
  U.lowest = function (bars, p, key) {
    key = key || 'low'; const out = [];
    for (let i = p - 1; i < bars.length; i++) { let m = Infinity; for (let j = 0; j < p; j++) m = Math.min(m, bars[i - j][key]); out.push({ time: bars[i].time, value: m }); }
    return out;
  };
  U.offset = (ser, v) => ser.map(x => ({ time: x.time, value: x.value + v }));
  U.scale = (ser, v) => ser.map(x => ({ time: x.time, value: x.value * v }));
  U.sub = (a, b) => { const m = new Map(b.map(x => [x.time, x.value])); return a.filter(x => m.has(x.time)).map(x => ({ time: x.time, value: x.value - m.get(x.time) })); };
  U.zle = (bars, v) => { const p = bars.length ? bars[0] : null; return p ? [{ time: p.time, value: v }] : []; };
  U.mapIdx = function (bars, fn, p) {                 // fn(i) → değer; ilk p-1 bar atlanır
    const out = [];
    for (let i = (p || 1) - 1; i < bars.length; i++) { const v = fn(i); if (v !== null && v !== undefined && isFinite(v)) out.push({ time: bars[i].time, value: v }); }
    return out;
  };
  U.hl2 = (bars) => bars.map(x => ({ time: x.time, close: (x.high + x.low) / 2 }));
  U.hlc3 = (bars) => bars.map(x => ({ time: x.time, close: (x.high + x.low + x.close) / 3 }));
  U.ohlc4 = (bars) => bars.map(x => ({ time: x.time, close: (x.open + x.high + x.low + x.close) / 4 }));
  U.typ = U.hlc3;

  /* ---------------- hazır osilatörler ---------------- */
  U.rsiSeries = function (bars, p) {
    const out = []; let ag = 0, al = 0;
    for (let i = 1; i < bars.length; i++) {
      const d = bars[i].close - bars[i - 1].close, g = Math.max(d, 0), l = Math.max(-d, 0);
      if (i <= p) { ag += g; al += l; if (i === p) { ag /= p; al /= p; out.push({ time: bars[i].time, value: 100 - 100 / (1 + (al === 0 ? Infinity : ag / al)) }); } }
      else { ag = (ag * (p - 1) + g) / p; al = (al * (p - 1) + l) / p; out.push({ time: bars[i].time, value: 100 - 100 / (1 + (al === 0 ? Infinity : ag / al)) }); }
    }
    return out;
  };
  U.macdSeries = function (bars, f, s, sig) {
    const ef = U.ema(bars, f), es = U.ema(bars, s), m = new Map(es.map(x => [x.time, x.value]));
    const line = ef.filter(x => m.has(x.time)).map(x => ({ time: x.time, value: x.value - m.get(x.time) }));
    const k = 2 / (sig + 1); const out = []; let prev = null;
    for (let i = 0; i < line.length; i++) {
      if (i < sig) { if (prev === null) prev = line[i].value; else prev = prev + (line[i].value - prev) / (i + 1); if (i === sig - 1) out.push({ time: line[i].time, value: prev }); }
      else { prev = line[i].value * k + prev * (1 - k); out.push({ time: line[i].time, value: prev }); }
    }
    return { line, signal: out };
  };
  U.histFrom = function (a, b, up, dn) {
    const m = new Map(b.map(x => [x.time, x.value]));
    return a.filter(x => m.has(x.time)).map(x => { const v = x.value - m.get(x.time); return { time: x.time, value: v, color: v >= 0 ? up : dn }; });
  };
  U.stochSeries = function (bars, p, k, s) {
    const kk = [], out = [];
    for (let i = p - 1; i < bars.length; i++) {
      let hh = -Infinity, ll = Infinity;
      for (let j = 0; j < p; j++) { hh = Math.max(hh, bars[i - j].high); ll = Math.min(ll, bars[i - j].low); }
      kk.push({ time: bars[i].time, value: hh === ll ? 0 : (bars[i].close - ll) / (hh - ll) * 100 });
    }
    const plain = kk.map(x => ({ time: x.time, close: x.value }));
    const ks = U.sma(plain, k, 'close'); const m = new Map(ks.map(x => [x.time, x.value]));
    const ksr = kk.filter(x => m.has(x.time));
    const ds = U.sma(ks.map(x => ({ time: x.time, close: x.value })), s, 'close');
    const dm = new Map(ds.map(x => [x.time, x.value]));
    const pctK = ksr.filter(x => dm.has(x.time));
    return { k: pctK, d: pctK.map(x => ({ time: x.time, value: dm.get(x.time) })) };
  };
  U.linreg = function (bars, p, key) {
    key = key || 'close'; const out = [];
    for (let i = p - 1; i < bars.length; i++) {
      let sx = 0, sy = 0, sxy = 0, sxx = 0;
      for (let j = 0; j < p; j++) { const x = j, y = bars[i - p + 1 + j][key]; sx += x; sy += y; sxy += x * y; sxx += x * x; }
      const b = (p * sxy - sx * sy) / (p * sxx - sx * sx), a = (sy - b * sx) / p;
      out.push({ time: bars[i].time, value: a + b * (p - 1), slope: b, intercept: a, n: p });
    }
    return out;
  };

  /* ---------------- kayıt defteri ---------------- */
  const CATALOG = [], BY_ID = new Map();
  U.register = function (list) { list.forEach(d => { CATALOG.push(d); BY_ID.set(d.id, d); }); };
  U.get = (id) => BY_ID.get(id) || null;
  U.all = () => CATALOG;
  U.groups = function () {
    const g = new Map();
    CATALOG.forEach(d => { const k = d.group || 'Diğer'; if (!g.has(k)) g.set(k, []); g.get(k).push(d); });
    return g;
  };
  U.defaults = (def) => { const o = {}; (def.params || []).forEach(p => o[p.k] = p.v); return o; };
  U.label = function (def, params) {
    const ps = params || U.defaults(def);
    if (!def.params || !def.params.length) return def.name;
    return def.name + ' (' + def.params.map(p => ps[p.k]).join(', ') + ')';
  };
  /* calc → {plots:{k:[{time,value}]}, levels:[sayı], calcZero:bool} */
  U.compute = function (def, bars, params) {
    const p = Object.assign(U.defaults(def), params || {});
    const res = def.calc(bars, p, U) || {};
    const plots = {}; const levels = [];
    Object.keys(res).forEach(k => {
      if (k === '__levels') { (res[k] || []).forEach(v => levels.push(v)); return; }
      if (k === '__dyn') { res[k].forEach(v => levels.push(v)); return; }
      const v = res[k];
      if (Array.isArray(v)) plots[k] = v;
    });
    return { plots, levels, def, params: p };
  };
  U.PALETTE = ['#2962ff', '#ff6d00', '#26a69a', '#ef5350', '#b39ddb', '#ffd54f', '#4dd0e1', '#f06292',
    '#9ccc65', '#ffb74d', '#7986cb', '#a1887f', '#4db6ac', '#ba68c8', '#e57373', '#64b5f6'];

  root.IND = root.IND || {};
  Object.assign(root.IND, U);
})(typeof window !== 'undefined' ? window : globalThis);
