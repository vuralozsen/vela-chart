/* =====================================================================
   Vela Chart — indikatör kataloğu (60+ tanım, TradingView kategori düzeni)
   pane:true → alt panel; pane:false → ana grafik üzerine
   calc(bars, params, U) → { plotKey: [{time,value}], __levels:[...] }
   ===================================================================== */
(function () {
  'use strict';
  const G = {
    MA: 'Hareketli Ortalamalar',
    BAND: 'Bantlar ve Kanallar',
    OSC: 'Osilatörler',
    TREND: 'Trend',
    VOL: 'Hacim',
    VLT: 'Volatilite',
    SR: 'Destek ve Direnç',
    STAT: 'İstatistik',
  };
  const P = (k, t, v, min, max, step) => ({ k, t, v, min, max, step });
  const C1 = '#2962ff', C2 = '#ff6d00', C3 = '#26a69a', C4 = '#ef5350', C5 = '#b39ddb';

  const L = [];
  const add = (o) => L.push(o);

  /* ---------------- Hareketli Ortalamalar ---------------- */
  add({ id: 'ma', name: 'Hareketli Ortalama (MA)', group: G.MA, params: [P('length', 'int', 20, 1, 500)],
    plots: [{ k: 'ma', color: C1 }], calc: (b, p, U) => ({ ma: U.sma(b, p.length) }) });
  add({ id: 'ema', name: 'Üstel Hareketli Ortalama (EMA)', group: G.MA, params: [P('length', 'int', 21, 1, 500)],
    plots: [{ k: 'ema', color: C1 }], calc: (b, p, U) => ({ ema: U.ema(b, p.length) }) });
  add({ id: 'wma', name: 'Ağırlıklı Hareketli Ortalama (WMA)', group: G.MA, params: [P('length', 'int', 20, 1, 500)],
    plots: [{ k: 'wma', color: C5 }], calc: (b, p, U) => ({ wma: U.wma(b, p.length) }) });
  add({ id: 'hma', name: 'Hull Hareketli Ortalaması (HMA)', group: G.MA, params: [P('length', 'int', 21, 2, 500)],
    plots: [{ k: 'hma', color: C3 }], calc: (b, p, U) => ({ hma: U.hma(b, p.length) }) });
  add({ id: 'dema', name: 'İki Katlı EMA (DEMA)', group: G.MA, params: [P('length', 'int', 21, 2, 500)],
    plots: [{ k: 'dema', color: C2 }], calc: (b, p, U) => ({ dema: U.dema(b, p.length) }) });
  add({ id: 'tema', name: 'Üç Katlı EMA (TEMA)', group: G.MA, params: [P('length', 'int', 21, 2, 500)],
    plots: [{ k: 'tema', color: C2 }], calc: (b, p, U) => ({ tema: U.tema(b, p.length) }) });
  add({ id: 'rma', name: 'Yumuşatılmış Ortalama (SMMA/RMA)', group: G.MA, params: [P('length', 'int', 14, 1, 500)],
    plots: [{ k: 'rma', color: C4 }], calc: (b, p, U) => ({ rma: U.rma(b, p.length) }) });
  add({ id: 'vwma', name: 'Hacim Ağırlıklı Ortalama (VWMA)', group: G.MA, params: [P('length', 'int', 20, 1, 500)],
    plots: [{ k: 'vwma', color: C3 }], calc: (b, p, U) => {
      const out = [];
      for (let i = p.length - 1; i < b.length; i++) {
        let n = 0, d = 0; for (let j = 0; j < p.length; j++) { n += b[i - j].close * b[i - j].volume; d += b[i - j].volume; }
        if (d) out.push({ time: b[i].time, value: n / d });
      }
      return { vwma: out };
    } });
  add({ id: 'lsma', name: 'En Küçük Kareler Ortalaması (LSMA)', group: G.MA, params: [P('length', 'int', 25, 2, 500)],
    plots: [{ k: 'lsma', color: C1 }], calc: (b, p, U) => ({ lsma: U.linreg(b, p.length) }) });
  add({ id: 'ma3', name: 'Üçlü MA Şeridi', group: G.MA, params: [P('l1', 'int', 20, 1, 500), P('l2', 'int', 50, 1, 500), P('l3', 'int', 200, 1, 500)],
    plots: [{ k: 'a', color: C1 }, { k: 'b', color: C2 }, { k: 'c', color: C5 }],
    calc: (b, p, U) => ({ a: U.sma(b, p.l1), b: U.sma(b, p.l2), c: U.sma(b, p.l3) }) });

  /* ---------------- Bantlar ve Kanallar ---------------- */
  const bbCalc = (b, len, mult, U) => {
    const mid = U.sma(b, len), sd = U.stdev(b, len), m = new Map(sd.map(x => [x.time, x.value]));
    const up = [], dn = [];
    mid.forEach(x => { const s = m.get(x.time) || 0; up.push({ time: x.time, value: x.value + mult * s }); dn.push({ time: x.time, value: x.value - mult * s }); });
    return { mid, up, dn };
  };
  add({ id: 'bb', name: 'Bollinger Bantları', group: G.BAND, params: [P('length', 'int', 20, 2, 500), P('mult', 'num', 2, 0.1, 10, 0.1)],
    plots: [{ k: 'up', color: '#2962ff' }, { k: 'mid', color: '#787b86', style: 2 }, { k: 'dn', color: '#2962ff' }],
    calc: (b, p, U) => { const r = bbCalc(b, p.length, p.mult, U); return { up: r.up, mid: r.mid, dn: r.dn }; } });
  add({ id: 'bbpb', name: 'Bollinger %B', group: G.BAND, pane: true, params: [P('length', 'int', 20, 2, 500), P('mult', 'num', 2, 0.1, 10, 0.1)],
    plots: [{ k: 'pb', color: C1 }], __levels: [100, 0],
    calc: (b, p, U) => { const r = bbCalc(b, p.length, p.mult, U); const um = new Map(r.up.map(x => [x.time, x.value])), dm = new Map(r.dn.map(x => [x.time, x.value]));
      return { pb: r.mid.map(x => { const u = um.get(x.time), d = dm.get(x.time); return { time: x.time, value: u === d ? 50 : (b.find(y => y.time === x.time).close - d) / (u - d) * 100 }; }), __levels: [100, 0] }; } });
  add({ id: 'bbw', name: 'Bollinger Bant Genişliği', group: G.BAND, pane: true, params: [P('length', 'int', 20, 2, 500), P('mult', 'num', 2, 0.1, 10, 0.1)],
    plots: [{ k: 'w', color: C2 }],
    calc: (b, p, U) => { const r = bbCalc(b, p.length, p.mult, U); const um = new Map(r.up.map(x => [x.time, x.value])), dm = new Map(r.dn.map(x => [x.time, x.value]));
      return { w: r.mid.map(x => ({ time: x.time, value: (um.get(x.time) - dm.get(x.time)) / x.value * 100 })) }; } });
  add({ id: 'kc', name: 'Keltner Kanalları', group: G.BAND, params: [P('length', 'int', 20, 1, 500), P('mult', 'num', 2, 0.1, 10, 0.1)],
    plots: [{ k: 'up', color: C3 }, { k: 'mid', color: '#787b86', style: 2 }, { k: 'dn', color: C3 }],
    calc: (b, p, U) => { const mid = U.ema(b, p.length), a = U.atr(b, p.length), m = new Map(a.map(x => [x.time, x.value]));
      return { mid, up: mid.map(x => ({ time: x.time, value: x.value + p.mult * (m.get(x.time) || 0) })), dn: mid.map(x => ({ time: x.time, value: x.value - p.mult * (m.get(x.time) || 0) })) }; } });
  add({ id: 'dc', name: 'Donchian Kanalları', group: G.BAND, params: [P('length', 'int', 20, 1, 500)],
    plots: [{ k: 'up', color: C3 }, { k: 'mid', color: '#787b86', style: 2 }, { k: 'dn', color: C3 }],
    calc: (b, p, U) => { const up = U.highest(b, p.length), dn = U.lowest(b, p.length), m = new Map(dn.map(x => [x.time, x.value]));
      return { up, dn, mid: up.filter(x => m.has(x.time)).map(x => ({ time: x.time, value: (x.value + m.get(x.time)) / 2 })) }; } });
  add({ id: 'env', name: 'Zarflar (Envelopes)', group: G.BAND, params: [P('length', 'int', 20, 1, 500), P('pct', 'num', 1, 0.01, 50, 0.01)],
    plots: [{ k: 'up', color: C5 }, { k: 'ma', color: '#787b86', style: 2 }, { k: 'dn', color: C5 }],
    calc: (b, p, U) => { const ma = U.sma(b, p.length);
      return { ma, up: U.scale(ma, 1 + p.pct / 100), dn: U.scale(ma, 1 - p.pct / 100) }; } });
  add({ id: 'atrb', name: 'ATR Bantları', group: G.BAND, params: [P('length', 'int', 20, 1, 500), P('mult', 'num', 2, 0.1, 10, 0.1)],
    plots: [{ k: 'up', color: C2 }, { k: 'ma', color: '#787b86', style: 2 }, { k: 'dn', color: C2 }],
    calc: (b, p, U) => { const ma = U.sma(b, p.length), a = U.atr(b, p.length), m = new Map(a.map(x => [x.time, x.value]));
      return { ma, up: ma.map(x => ({ time: x.time, value: x.value + p.mult * (m.get(x.time) || 0) })), dn: ma.map(x => ({ time: x.time, value: x.value - p.mult * (m.get(x.time) || 0) })) }; } });
  add({ id: 'pc', name: 'Fiyat Kanalı', group: G.BAND, params: [P('length', 'int', 20, 1, 500)],
    plots: [{ k: 'up', color: C1 }, { k: 'mid', color: '#787b86', style: 2 }, { k: 'dn', color: C1 }],
    calc: (b, p, U) => { const up = U.highest(b, p.length), dn = U.lowest(b, p.length), m = new Map(dn.map(x => [x.time, x.value]));
      return { up, dn, mid: up.filter(x => m.has(x.time)).map(x => ({ time: x.time, value: (x.value + m.get(x.time)) / 2 })) }; } });

  /* ---------------- Osilatörler ---------------- */
  add({ id: 'rsi', name: 'Göreceli Güç Endeksi (RSI)', group: G.OSC, pane: true, __levels: [70, 30],
    params: [P('length', 'int', 14, 2, 200)], plots: [{ k: 'rsi', color: C5 }],
    calc: (b, p, U) => ({ rsi: U.rsiSeries(b, p.length) }) });
  add({ id: 'stoch', name: 'Stokastik', group: G.OSC, pane: true, __levels: [80, 20],
    params: [P('k', 'int', 14, 1, 200), P('smoothK', 'int', 3, 1, 50), P('d', 'int', 3, 1, 50)],
    plots: [{ k: 'k', color: C1 }, { k: 'd', color: C2 }],
    calc: (b, p, U) => { const r = U.stochSeries(b, p.k, p.smoothK, p.d); return { k: r.k, d: r.d }; } });
  add({ id: 'stochrsi', name: 'Stokastik RSI', group: G.OSC, pane: true, __levels: [80, 20],
    params: [P('length', 'int', 14, 2, 200), P('k', 'int', 14, 1, 200), P('d', 'int', 3, 1, 50)],
    plots: [{ k: 'k', color: C1 }, { k: 'd', color: C2 }],
    calc: (b, p, U) => { const r = U.rsiSeries(b, p.length).map(x => ({ time: x.time, value: x.value }));
      const ss = U.stochSeries(r.map(x => ({ time: x.time, high: x.value, low: x.value, close: x.value })), p.k, p.k, p.d);
      return { k: ss.k, d: ss.d }; } });
  add({ id: 'cci', name: 'Emtia Kanal Endeksi (CCI)', group: G.OSC, pane: true, __levels: [100, -100],
    params: [P('length', 'int', 20, 1, 500)], plots: [{ k: 'cci', color: C1 }],
    calc: (b, p, U) => { const tp = U.hlc3(b), ma = U.sma(tp, p.length), m = new Map(ma.map(x => [x.time, x.value])); const out = [];
      for (let i = p.length - 1; i < b.length; i++) { let d = 0; for (let j = 0; j < p.length; j++) { const t2 = (b[i - j].high + b[i - j].low + b[i - j].close) / 3; d += Math.abs(t2 - m.get(b[i].time)); }
        d /= p.length; out.push({ time: b[i].time, value: d === 0 ? 0 : ((b[i].high + b[i].low + b[i].close) / 3 - m.get(b[i].time)) / (0.015 * d) }); }
      return { cci: out }; } });
  add({ id: 'willr', name: 'Williams %R', group: G.OSC, pane: true, __levels: [-20, -80],
    params: [P('length', 'int', 14, 1, 500)], plots: [{ k: 'w', color: C4 }],
    calc: (b, p, U) => ({ w: U.mapIdx(b, (i) => { let hh = -Infinity, ll = Infinity;
      for (let j = 0; j < p.length; j++) { hh = Math.max(hh, b[i - j].high); ll = Math.min(ll, b[i - j].low); }
      return hh === ll ? -50 : (hh - b[i].close) / (hh - ll) * -100; }, p.length) }) });
  add({ id: 'mom', name: 'Momentum', group: G.OSC, pane: true, __levels: [0],
    params: [P('length', 'int', 10, 1, 500)], plots: [{ k: 'm', color: C1 }],
    calc: (b, p, U) => ({ m: U.mapIdx(b, (i) => b[i].close - b[i - p.length].close, p.length + 1) }) });
  add({ id: 'roc', name: 'Değişim Oranı (ROC)', group: G.OSC, pane: true, __levels: [0],
    params: [P('length', 'int', 9, 1, 500)], plots: [{ k: 'r', color: C1 }],
    calc: (b, p, U) => ({ r: U.mapIdx(b, (i) => (b[i].close / b[i - p.length].close - 1) * 100, p.length + 1) }) });
  add({ id: 'macd', name: 'MACD', group: G.OSC, pane: true, __levels: [0],
    params: [P('fast', 'int', 12, 1, 200), P('slow', 'int', 26, 1, 400), P('signal', 'int', 9, 1, 100)],
    plots: [{ k: 'line', color: C1 }, { k: 'sig', color: C2 }, { k: 'hist', type: 'hist', up: 'rgba(38,166,154,.6)', dn: 'rgba(239,83,80,.6)' }],
    calc: (b, p, U) => { const r = U.macdSeries(b, p.fast, p.slow, p.signal);
      return { line: r.line, sig: r.signal, hist: U.histFrom(r.line, r.signal, 'rgba(38,166,154,.6)', 'rgba(239,83,80,.6)') }; } });
  add({ id: 'ao', name: 'Müthiş Osilatör (AO)', group: G.OSC, pane: true, __levels: [0],
    params: [P('f', 'int', 5, 1, 200), P('s', 'int', 34, 1, 400)],
    plots: [{ k: 'ao', type: 'hist', up: 'rgba(38,166,154,.6)', dn: 'rgba(239,83,80,.6)' }],
    calc: (b, p, U) => { const h = U.hl2(b), a = U.sma(h, p.f), c = U.sma(h, p.s), m = new Map(c.map(x => [x.time, x.value]));
      return { ao: a.filter(x => m.has(x.time)).map(x => { const v = x.value - m.get(x.time); return { time: x.time, value: v, color: v >= 0 ? 'rgba(38,166,154,.6)' : 'rgba(239,83,80,.6)' }; }) }; } });
  add({ id: 'trix', name: 'TRIX', group: G.OSC, pane: true, __levels: [0],
    params: [P('length', 'int', 18, 2, 200), P('signal', 'int', 9, 1, 100)],
    plots: [{ k: 't', color: C1 }, { k: 's', color: C2 }],
    calc: (b, p, U) => { const e1 = U.ema(b, p.length); if (!e1.length) return {}; const e2 = U.emaSer(e1, p.length); if (!e2.length) return {};
      const e3 = U.emaSer(e2, p.length); const out = [];
      for (let i = 1; i < e3.length; i++) out.push({ time: e3[i].time, value: (e3[i].value / e3[i - 1].value - 1) * 100 });
      return { t: out, s: U.emaSer(out, p.signal) }; } });
  add({ id: 'dpo', name: 'Trendden Arındırılmış Fiyat (DPO)', group: G.OSC, pane: true, __levels: [0],
    params: [P('length', 'int', 21, 2, 500)], plots: [{ k: 'd', color: C1 }],
    calc: (b, p, U) => { const ma = U.sma(b, p.length), fwd = Math.floor(p.length / 2) + 1, m = new Map(ma.map(x => [x.time, x.value])); const out = [];
      for (let i = 0; i < b.length - fwd; i++) { const t = b[i + fwd].time; if (m.has(t)) out.push({ time: b[i].time, value: b[i].close - m.get(t) }); }
      return { d: out }; } });
  add({ id: 'uo', name: 'Ultimate Osilatör', group: G.OSC, pane: true, __levels: [70, 30],
    params: [P('p1', 'int', 7, 2, 100), P('p2', 'int', 14, 2, 200), P('p3', 'int', 28, 2, 400)],
    plots: [{ k: 'uo', color: C1 }],
    calc: (b, p, U) => { const bp = [], tr = [];
      for (let i = 0; i < b.length; i++) { const pc = i ? b[i - 1].close : b[i].close; const t = Math.max(b[i].high, pc) - Math.min(b[i].low, pc);
        tr.push({ time: b[i].time, close: t || 1 }); bp.push({ time: b[i].time, close: b[i].close - Math.min(b[i].low, pc) }); }
      const avg = (n) => { const a = U.sma(bp, n, 'close'), c = U.sma(tr, n, 'close'), m = new Map(c.map(x => [x.time, x.value]));
        const o = []; a.forEach(x => { const d = m.get(x.time); if (d) o.push({ time: x.time, value: x.value / d }); }); return o; };
      const a1 = avg(p.p1), a2 = avg(p.p2), a3 = avg(p.p3);
      const m2 = new Map(a2.map(x => [x.time, x.value])), m3 = new Map(a3.map(x => [x.time, x.value]));
      return { uo: a1.filter(x => m2.has(x.time) && m3.has(x.time)).map(x => ({ time: x.time, value: 100 * (4 * x.value + 2 * m2.get(x.time) + m3.get(x.time)) / 7 })) }; } });
  add({ id: 'cmo', name: 'Chande Momentum Osilatörü', group: G.OSC, pane: true, __levels: [50, -50],
    params: [P('length', 'int', 14, 1, 200)], plots: [{ k: 'c', color: C1 }],
    calc: (b, p, U) => ({ c: U.mapIdx(b, (i) => { let su = 0, sd = 0;
      for (let j = 0; j < p.length; j++) { const d = b[i - j].close - b[i - j - 1].close; if (d > 0) su += d; else sd -= d; }
      return (su + sd) === 0 ? 0 : 100 * (su - sd) / (su + sd); }, p.length + 1) }) });
  add({ id: 'rvi', name: 'Göreceli Volatilite Endeksi', group: G.OSC, pane: true, __levels: [50],
    params: [P('length', 'int', 10, 2, 200)], plots: [{ k: 'r', color: C1 }],
    calc: (b, p, U) => { const sd = U.stdev(b, p.length), m = new Map(sd.map(x => [x.time, x.value]));
      const su = [], sdn = [];   /* tam zaman ızgarası: uygun olmayan barda 0 (aksi halde kesişim boş kalır) */
      for (let i = 1; i < b.length; i++) { const s = m.get(b[i].time); if (s === undefined) continue;
        const up = b[i].close > b[i - 1].close, dn = b[i].close < b[i - 1].close;
        su.push({ time: b[i].time, close: up ? s : 0 }); sdn.push({ time: b[i].time, close: dn ? s : 0 }); }
      const eu = U.rma(su, p.length, 'close'), ed = U.rma(sdn, p.length, 'close');
      const md = new Map(ed.map(x => [x.time, x.value]));
      return { r: eu.filter(x => md.has(x.time)).map(x => { const s = x.value + md.get(x.time); return { time: x.time, value: s === 0 ? 50 : 100 * x.value / s }; }) }; } });
  add({ id: 'fisher', name: 'Fisher Dönüşümü', group: G.OSC, pane: true, __levels: [1.5, -1.5],
    params: [P('length', 'int', 9, 2, 200)], plots: [{ k: 'f', color: C1 }],
    calc: (b, p, U) => { const out = []; let v = 0, pr = 0;
      for (let i = p.length - 1; i < b.length; i++) { let hh = -Infinity, ll = Infinity;
        for (let j = 0; j < p.length; j++) { hh = Math.max(hh, b[i - j].high); ll = Math.min(ll, b[i - j].low); }
        const r = hh === ll ? 0.5 : (b[i].close - ll) / (hh - ll); v = 0.33 * 2 * (r - 0.5) + 0.67 * v;
        v = Math.max(-0.999, Math.min(0.999, v)); const f = 0.5 * Math.log((1 + v) / (1 - v)) + 0.5 * pr; pr = f;
        out.push({ time: b[i].time, value: f }); }
      return { f: out }; } });
  add({ id: 'tsi', name: 'Gerçek Güç Endeksi (TSI)', group: G.OSC, pane: true, __levels: [25, -25],
    params: [P('long', 'int', 25, 2, 200), P('short', 'int', 13, 2, 100)],
    plots: [{ k: 't', color: C1 }],
    calc: (b, p, U) => { const mm = [], am = [];
      for (let i = 1; i < b.length; i++) { const d = b[i].close - b[i - 1].close; mm.push({ time: b[i].time, close: d }); am.push({ time: b[i].time, close: Math.abs(d) }); }
      const s1 = (s) => { const a = U.ema(s, p.long, 'close'); return a.map(x => ({ time: x.time, value: x.value })); };
      const m1 = s1(mm), a1 = s1(am);
      const m2 = U.emaSer(m1, p.short), a2 = U.emaSer(a1, p.short);
      const dm = new Map(a2.map(x => [x.time, x.value]));
      return { t: m2.filter(x => dm.has(x.time)).map(x => ({ time: x.time, value: dm.get(x.time) === 0 ? 0 : 100 * x.value / dm.get(x.time) })) }; } });
  add({ id: 'coppock', name: 'Coppock Eğrisi', group: G.OSC, pane: true, __levels: [0],
    params: [P('long', 'int', 14, 1, 200), P('short', 'int', 11, 1, 200), P('wma', 'int', 10, 1, 200)],
    plots: [{ k: 'c', color: C1 }],
    calc: (b, p, U) => { const r1 = U.mapIdx(b, (i) => (b[i].close / b[i - p.long].close - 1) * 100, p.long + 1);
      const r2 = U.mapIdx(b, (i) => (b[i].close / b[i - p.short].close - 1) * 100, p.short + 1);
      const m = new Map(r2.map(x => [x.time, x.value]));
      const sum = r1.filter(x => m.has(x.time)).map(x => ({ time: x.time, close: x.value + m.get(x.time) }));
      return { c: U.wma(sum, p.wma, 'close') }; } });
  add({ id: 'ppo', name: 'Yüzde Fiyat Osilatörü (PPO)', group: G.OSC, pane: true, __levels: [0],
    params: [P('fast', 'int', 12, 1, 200), P('slow', 'int', 26, 1, 400), P('signal', 'int', 9, 1, 100)],
    plots: [{ k: 'line', color: C1 }, { k: 'sig', color: C2 }, { k: 'hist', type: 'hist', up: 'rgba(38,166,154,.6)', dn: 'rgba(239,83,80,.6)' }],
    calc: (b, p, U) => { const f = U.ema(b, p.fast), s = U.ema(b, p.slow), m = new Map(s.map(x => [x.time, x.value]));
      const line = f.filter(x => m.has(x.time)).map(x => ({ time: x.time, value: (x.value - m.get(x.time)) / m.get(x.time) * 100 }));
      const sig = U.emaSer(line, p.signal);
      return { line, sig, hist: U.histFrom(line, sig, 'rgba(38,166,154,.6)', 'rgba(239,83,80,.6)') }; } });
  add({ id: 'bias', name: 'BIAS', group: G.OSC, pane: true, __levels: [0],
    params: [P('length', 'int', 6, 1, 500)], plots: [{ k: 'b', color: C1 }],
    calc: (b, p, U) => { const ma = U.sma(b, p.length), m = new Map(ma.map(x => [x.time, x.value]));
      return { b: U.mapIdx(b, (i) => { const a = m.get(b[i].time); return a === undefined ? null : (b[i].close - a) / a * 100; }, p.length) }; } });

  /* ---------------- Trend ---------------- */
  add({ id: 'dmi', name: 'Yön Hareketi (ADX/DMI)', group: G.TREND, pane: true, __levels: [20],
    params: [P('length', 'int', 14, 2, 200)], plots: [{ k: 'adx', color: C5 }, { k: 'pdi', color: C3 }, { k: 'mdi', color: C4 }],
    calc: (b, p, U) => { const pdm = [], mdm = [], tr = [];
      for (let i = 0; i < b.length; i++) { const pc = i ? b[i - 1].close : b[i].close, ph = i ? b[i - 1].high : b[i].high, pl = i ? b[i - 1].low : b[i].low;
        const up = b[i].high - ph, dn = pl - b[i].low;
        pdm.push({ time: b[i].time, close: (up > dn && up > 0) ? up : 0 }); mdm.push({ time: b[i].time, close: (dn > up && dn > 0) ? dn : 0 });
        tr.push({ time: b[i].time, close: Math.max(b[i].high, pc) - Math.min(b[i].low, pc) || 1 }); }
      const rp = U.rma(pdm, p.length, 'close'), rm = U.rma(mdm, p.length, 'close'), rt = U.rma(tr, p.length, 'close');
      const tm = new Map(rt.map(x => [x.time, x.value]));
      const pdi = rp.filter(x => tm.has(x.time)).map(x => ({ time: x.time, value: 100 * x.value / tm.get(x.time) })),
        mdi = rm.filter(x => tm.has(x.time)).map(x => ({ time: x.time, value: 100 * x.value / tm.get(x.time) }));
      const pm = new Map(pdi.map(x => [x.time, x.value])), mm = new Map(mdi.map(x => [x.time, x.value]));
      const dx = pdi.filter(x => mm.has(x.time)).map(x => { const s = x.value + mm.get(x.time); return { time: x.time, close: s === 0 ? 0 : 100 * Math.abs(x.value - mm.get(x.time)) / s }; });
      return { pdi, mdi, adx: U.rma(dx, p.length, 'close') }; } });
  add({ id: 'aroon', name: 'Aroon', group: G.TREND, pane: true, __levels: [70, 30],
    params: [P('length', 'int', 14, 1, 500)], plots: [{ k: 'up', color: C3 }, { k: 'dn', color: C4 }],
    calc: (b, p, U) => { const up = [], dn = [];
      for (let i = p.length; i < b.length; i++) { let hi = i, lo = i;
        for (let j = 0; j <= p.length; j++) { if (b[i - j].high >= b[hi].high) hi = i - j; if (b[i - j].low <= b[lo].low) lo = i - j; }
        up.push({ time: b[i].time, value: 100 * (p.length - (i - hi)) / p.length });
        dn.push({ time: b[i].time, value: 100 * (p.length - (i - lo)) / p.length }); }
      return { up, dn }; } });
  add({ id: 'psar', name: 'Parabolik SAR', group: G.TREND, params: [P('start', 'num', 0.02, 0.001, 1, 0.001), P('inc', 'num', 0.02, 0.001, 1, 0.001), P('max', 'num', 0.2, 0.01, 2, 0.01)],
    plots: [{ k: 'psar', color: C1, marker: true }],
    calc: (b, p, U) => { if (b.length < 3) return { psar: [] };
      let up = true, af = p.start, ep = b[1].high, sar = b[0].low; const out = [];
      for (let i = 1; i < b.length; i++) { sar = sar + af * (ep - sar);
        if (up) { if (b[i].low < sar) { up = false; sar = ep; ep = b[i].low; af = p.start; } else if (b[i].high > ep) { ep = b[i].high; af = Math.min(p.max, af + p.inc); } }
        else { if (b[i].high > sar) { up = true; sar = ep; ep = b[i].high; af = p.start; } else if (b[i].low < ep) { ep = b[i].low; af = Math.min(p.max, af + p.inc); } }
        out.push({ time: b[i].time, value: sar }); }
      return { psar: out }; } });
  add({ id: 'supertrend', name: 'SuperTrend', group: G.TREND, params: [P('atr', 'int', 10, 1, 200), P('mult', 'num', 3, 0.1, 20, 0.1)],
    plots: [{ k: 'st', color: C3 }],
    calc: (b, p, U) => { const a = U.atr(b, p.atr), m = new Map(a.map(x => [x.time, x.value])); const out = [];
      let dir = 1, prevUp = 0, prevDn = 0;
      for (let i = 0; i < b.length; i++) { const av = m.get(b[i].time); if (av === undefined) continue;
        const hl2 = (b[i].high + b[i].low) / 2; let up = hl2 - p.mult * av, dn = hl2 + p.mult * av;
        if (i && b[i - 1].close > prevUp) up = Math.max(up, prevUp); if (i && b[i - 1].close < prevDn) dn = Math.min(dn, prevDn);
        dir = i ? (dir === 1 ? (b[i].close < up ? -1 : 1) : (b[i].close > dn ? 1 : -1)) : 1;
        out.push({ time: b[i].time, value: dir === 1 ? up : dn, color: dir === 1 ? C3 : C4 });
        prevUp = up; prevDn = dn; }
      return { st: out }; } });
  add({ id: 'ichimoku', name: 'Ichimoku Bulut', group: G.TREND,
    params: [P('tenkan', 'int', 9, 1, 200), P('kijun', 'int', 26, 1, 400), P('senkou', 'int', 52, 1, 600)],
    plots: [{ k: 'tenkan', color: C1 }, { k: 'kijun', color: C4 }, { k: 'sa', color: C3 }, { k: 'sb', color: C4 }],
    calc: (b, p, U) => { const mid = (n) => { const h = U.highest(b, n), l = U.lowest(b, n), m = new Map(l.map(x => [x.time, x.value]));
        return h.filter(x => m.has(x.time)).map(x => ({ time: x.time, value: (x.value + m.get(x.time)) / 2 })); };
      const t = mid(p.tenkan), k = mid(p.kijun), s = mid(p.senkou), m = new Map(s.map(x => [x.time, x.value]));
      const sa = t.filter(x => m.has(x.time)).map(x => ({ time: x.time, value: (x.value + m.get(x.time)) / 2 }));
      return { tenkan: t, kijun: k, sa, sb: s }; } });
  add({ id: 'vortex', name: 'Vortex Göstergesi', group: G.TREND, pane: true, __levels: [1],
    params: [P('length', 'int', 14, 1, 200)], plots: [{ k: 'viP', color: C3 }, { k: 'viM', color: C4 }],
    calc: (b, p, U) => { const vmP = [], vmM = [], tr = [];
      for (let i = 1; i < b.length; i++) { vmP.push({ time: b[i].time, close: Math.abs(b[i].high - b[i - 1].low) });
        vmM.push({ time: b[i].time, close: Math.abs(b[i].low - b[i - 1].high) });
        tr.push({ time: b[i].time, close: Math.max(b[i].high, b[i - 1].close) - Math.min(b[i].low, b[i - 1].close) || 1 }); }
      const sp = U.sma(vmP, p.length, 'close'), sm = U.sma(vmM, p.length, 'close'), st = U.sma(tr, p.length, 'close');
      const tm = new Map(st.map(x => [x.time, x.value]));
      return { viP: sp.filter(x => tm.has(x.time)).map(x => ({ time: x.time, value: x.value / tm.get(x.time) })),
        viM: sm.filter(x => tm.has(x.time)).map(x => ({ time: x.time, value: x.value / tm.get(x.time) })) }; } });
  add({ id: 'chop', name: 'Dalgalanma Endeksi (CHOP)', group: G.TREND, pane: true, __levels: [61.8, 38.2],
    params: [P('length', 'int', 14, 2, 200)], plots: [{ k: 'c', color: C1 }],
    calc: (b, p, U) => { const a = U.tr(b), s = U.sma(a, p.length, 'value'), m = new Map(s.map(x => [x.time, x.value]));
      return { c: U.mapIdx(b, (i) => { const av = m.get(b[i].time); if (av === undefined) return null;
        let hh = -Infinity, ll = Infinity; for (let j = 0; j < p.length; j++) { hh = Math.max(hh, b[i - j].high); ll = Math.min(ll, b[i - j].low); }
        return hh === ll ? 50 : 100 * Math.log10(av / (hh - ll)) / Math.log10(p.length); }, p.length) }; } });
  add({ id: 'qstick', name: 'Qstick', group: G.TREND, pane: true, __levels: [0],
    params: [P('length', 'int', 8, 1, 200)], plots: [{ k: 'q', color: C1 }],
    calc: (b, p, U) => { const d = b.map(x => ({ time: x.time, close: x.close - x.open }));
      return { q: U.sma(d, p.length, 'close') }; } });

  /* ---------------- Hacim ---------------- */
  add({ id: 'volume', name: 'Hacim', group: G.VOL, overlay: 'volume', params: [],
    plots: [{ k: 'v', type: 'hist', up: 'rgba(38,166,154,.5)', dn: 'rgba(239,83,80,.5)' }],
    calc: (b) => ({ v: b.map(x => ({ time: x.time, value: x.volume, color: x.close >= x.open ? 'rgba(38,166,154,.5)' : 'rgba(239,83,80,.5)' })) }) });
  add({ id: 'obv', name: 'Denge Hacmi (OBV)', group: G.VOL, pane: true, params: [],
    plots: [{ k: 'obv', color: C1 }],
    calc: (b) => { let v = 0; const out = [{ time: b[0].time, value: 0 }];
      for (let i = 1; i < b.length; i++) { v += b[i].close > b[i - 1].close ? b[i].volume : b[i].close < b[i - 1].close ? -b[i].volume : 0;
        out.push({ time: b[i].time, value: v }); }
      return { obv: out }; } });
  add({ id: 'vwap', name: 'Hacim Ağırlıklı Ortalama Fiyat (VWAP)', group: G.VOL, params: [],
    plots: [{ k: 'vwap', color: C5 }],
    calc: (b) => { let pv = 0, vv = 0; const out = [];
      for (let i = 0; i < b.length; i++) { const tp = (b[i].high + b[i].low + b[i].close) / 3;
        pv += tp * b[i].volume; vv += b[i].volume; if (vv) out.push({ time: b[i].time, value: pv / vv }); }
      return { vwap: out }; } });
  add({ id: 'mfi', name: 'Para Akışı Endeksi (MFI)', group: G.VOL, pane: true, __levels: [80, 20],
    params: [P('length', 'int', 14, 2, 200)], plots: [{ k: 'mfi', color: C1 }],
    calc: (b, p, U) => { const pos = [], neg = [];   /* tam zaman ızgarası: para akışı yönü yoksa 0 */
      for (let i = 1; i < b.length; i++) { const tp = (b[i].high + b[i].low + b[i].close) / 3, pt = (b[i - 1].high + b[i - 1].low + b[i - 1].close) / 3;
        const mf = tp * b[i].volume;
        pos.push({ time: b[i].time, close: tp > pt ? mf : 0 }); neg.push({ time: b[i].time, close: tp < pt ? mf : 0 }); }
      const sp = U.sma(pos, p.length, 'close'), sn = U.sma(neg, p.length, 'close');
      const nm = new Map(sn.map(x => [x.time, x.value]));
      return { mfi: sp.filter(x => nm.has(x.time)).map(x => { const n = nm.get(x.time); return { time: x.time, value: (x.value + n) === 0 ? 50 : 100 - 100 / (1 + x.value / (n || 1e-9)) }; }) }; } });
  add({ id: 'cmf', name: 'Chaikin Para Akışı', group: G.VOL, pane: true, __levels: [0],
    params: [P('length', 'int', 20, 2, 200)], plots: [{ k: 'cmf', color: C1 }],
    calc: (b, p, U) => { const mfv = b.map(x => { const r = x.high - x.low; 
        return { time: x.time, close: r === 0 ? 0 : ((x.close - x.low) - (x.high - x.close)) / r * x.volume }; });
      const s1 = U.sma(mfv, p.length, 'close'), s2 = U.sma(b.map(x => ({ time: x.time, close: x.volume })), p.length, 'close');
      const m = new Map(s2.map(x => [x.time, x.value]));
      return { cmf: s1.filter(x => m.has(x.time)).map(x => ({ time: x.time, value: x.value / (m.get(x.time) || 1e-9) })) }; } });
  add({ id: 'adl', name: 'Birikim/Dağıtım (ADL)', group: G.VOL, pane: true, params: [],
    plots: [{ k: 'adl', color: C1 }],
    calc: (b) => { let v = 0; const out = [];
      b.forEach(x => { const r = x.high - x.low; v += r === 0 ? 0 : ((x.close - x.low) - (x.high - x.close)) / r * x.volume; out.push({ time: x.time, value: v }); });
      return { adl: out }; } });
  add({ id: 'fi', name: 'Güç Endeksi', group: G.VOL, pane: true, __levels: [0],
    params: [P('length', 'int', 13, 1, 200)], plots: [{ k: 'fi', color: C1 }],
    calc: (b, p, U) => { const e = b.map((x, i) => ({ time: x.time, close: (x.close - (i ? b[i - 1].close : x.close)) * x.volume }));
      return { fi: U.ema(e, p.length, 'close') }; } });
  add({ id: 'eom', name: 'Hareket Kolaylığı (EOM)', group: G.VOL, pane: true, __levels: [0],
    params: [P('length', 'int', 14, 1, 200)], plots: [{ k: 'e', color: C1 }],
    calc: (b, p, U) => { const d = [];
      for (let i = 1; i < b.length; i++) { const dm = (b[i].high + b[i].low) / 2 - (b[i - 1].high + b[i - 1].low) / 2;
        const br = b[i].volume / 1e6 / Math.max(1e-9, b[i].high - b[i].low);
        d.push({ time: b[i].time, close: br === 0 ? 0 : dm / br }); }
      const s = U.sma(d, p.length, 'close'); const m = new Map();
      return { e: s }; } });
  add({ id: 'pvt', name: 'Fiyat Hacim Eğilimi (PVT)', group: G.VOL, pane: true, params: [],
    plots: [{ k: 'pvt', color: C1 }],
    calc: (b) => { let v = 0; const out = [];
      for (let i = 1; i < b.length; i++) { v += (b[i].close - b[i - 1].close) / b[i - 1].close * b[i].volume; out.push({ time: b[i].time, value: v }); }
      return { pvt: out }; } });
  add({ id: 'vosc', name: 'Hacim Osilatörü', group: G.VOL, pane: true, __levels: [0],
    params: [P('short', 'int', 14, 1, 200), P('long', 'int', 28, 2, 400)], plots: [{ k: 'v', color: C1 }],
    calc: (b, p, U) => { const v = b.map(x => ({ time: x.time, close: x.volume }));
      const s = U.ema(v, p.short, 'close'), l = U.ema(v, p.long, 'close'), m = new Map(l.map(x => [x.time, x.value]));
      return { v: s.filter(x => m.has(x.time)).map(x => ({ time: x.time, value: (x.value - m.get(x.time)) / (m.get(x.time) || 1e-9) * 100 })) }; } });

  /* ---------------- Volatilite ---------------- */
  add({ id: 'atr', name: 'Ortalama Gerçek Aralık (ATR)', group: G.VLT, pane: true, __levels: [0],
    params: [P('length', 'int', 14, 1, 200)], plots: [{ k: 'atr', color: C1 }],
    calc: (b, p, U) => ({ atr: U.atr(b, p.length) }) });
  add({ id: 'tr', name: 'Gerçek Aralık', group: G.VLT, pane: true, __levels: [0],
    params: [], plots: [{ k: 'tr', color: C1 }], calc: (b, p, U) => ({ tr: U.tr(b) }) });
  add({ id: 'hv', name: 'Tarihsel Volatilite', group: G.VLT, pane: true, __levels: [0],
    params: [P('length', 'int', 20, 2, 500), P('annual', 'int', 252, 1, 365)],
    plots: [{ k: 'hv', color: C2 }],
    calc: (b, p, U) => { const r = [];
      for (let i = 1; i < b.length; i++) r.push({ time: b[i].time, close: Math.log(b[i].close / b[i - 1].close) * 100 });
      const s = U.stdev(r, p.length, 'close');
      return { hv: s.map(x => ({ time: x.time, value: x.value * Math.sqrt(p.annual) })) }; } });
  add({ id: 'chvol', name: 'Chaikin Volatilite', group: G.VLT, pane: true, __levels: [0],
    params: [P('length', 'int', 10, 1, 200), P('roc', 'int', 10, 1, 200)], plots: [{ k: 'c', color: C2 }],
    calc: (b, p, U) => { const hl = b.map(x => ({ time: x.time, close: x.high - x.low }));
      const e1 = U.ema(hl, p.length, 'close'), e2 = U.emaSer(e1, p.length), m = new Map(e2.map(x => [x.time, x.value]));
      const out = []; const src = e1.filter(x => m.has(x.time));
      for (let i = p.roc; i < src.length; i++) { const base = m.get(src[i - p.roc].time) || m.get(src[i - p.roc].time);
        out.push({ time: src[i].time, value: base ? (m.get(src[i].time) - base) / base * 100 : 0 }); }
      return { c: out }; } });
  add({ id: 'mass', name: 'Kütle Endeksi', group: G.VLT, pane: true, params: [P('length', 'int', 25, 2, 200), P('ema', 'int', 9, 1, 100)],
    plots: [{ k: 'm', color: C1 }],
    calc: (b, p, U) => { const hl = b.map(x => ({ time: x.time, close: x.high - x.low }));
      const e1 = U.ema(hl, p.ema, 'close'), e2 = U.emaSer(e1, p.ema), m = new Map(e2.map(x => [x.time, x.value]));
      const ratio = e1.filter(x => m.has(x.time)).map(x => ({ time: x.time, close: x.value / (m.get(x.time) || 1e-9) }));
      return { m: U.sma(ratio, p.length, 'close') }; } });

  /* ---------------- Destek ve Direnç ---------------- */
  add({ id: 'pivots', name: 'Pivot Noktaları (Standart)', group: G.SR, params: [],
    plots: [{ k: 'p', color: '#787b86' }, { k: 'r1', color: C4 }, { k: 's1', color: C3 }, { k: 'r2', color: C4 }, { k: 's2', color: C3 }, { k: 'r3', color: C4 }, { k: 's3', color: C3 }],
    calc: (b) => { /* son tam günü bul, klasik pivot seviyeleri */ const days = new Map();
      b.forEach(x => { const d = new Date(x.time * 1000).toISOString().slice(0, 10); const c = days.get(d) || { h: -Infinity, l: Infinity, c: null, o: null, t: x.time };
        c.h = Math.max(c.h, x.high); c.l = Math.min(c.l, x.low); c.c = x.close; if (c.o === null) c.o = x.open; c.t = x.time; days.set(d, c); });
      const ks = [...days.keys()].sort(); if (ks.length < 2) return {};
      const prev = days.get(ks[ks.length - 2]); const P0 = (prev.h + prev.l + prev.c) / 3, R1 = 2 * P0 - prev.l, S1 = 2 * P0 - prev.h;
      const R2 = P0 + (prev.h - prev.l), S2 = P0 - (prev.h - prev.l), R3 = prev.h + 2 * (P0 - prev.l), S3 = prev.l - 2 * (prev.h - P0);
      const seg = [{ time: b[0].time, value: P0 }, { time: b[b.length - 1].time, value: P0 }];
      const mk = (v) => [{ time: b[0].time, value: v }, { time: b[b.length - 1].time, value: v }];
      return { p: seg, r1: mk(R1), s1: mk(S1), r2: mk(R2), s2: mk(S2), r3: mk(R3), s3: mk(S3) }; } });

  /* ---------------- İstatistik ---------------- */
  add({ id: 'lrc', name: 'Doğrusal Regresyon Eğrisi', group: G.STAT, params: [P('length', 'int', 100, 2, 1000)],
    plots: [{ k: 'l', color: C1 }], calc: (b, p, U) => ({ l: U.linreg(b, p.length) }) });
  add({ id: 'dev', name: 'Standart Sapma', group: G.STAT, pane: true, __levels: [0],
    params: [P('length', 'int', 20, 2, 500)], plots: [{ k: 'd', color: C1 }],
    calc: (b, p, U) => ({ d: U.stdev(b, p.length) }) });
  add({ id: 'median', name: 'Medyan', group: G.STAT, params: [P('length', 'int', 20, 1, 500)],
    plots: [{ k: 'm', color: C1 }],
    calc: (b, p, U) => { const out = [];
      for (let i = p.length - 1; i < b.length; i++) { const w = []; for (let j = 0; j < p.length; j++) w.push(b[i - j].close);
        w.sort((x, y) => x - y); const n = w.length;
        out.push({ time: b[i].time, value: n % 2 ? w[(n - 1) / 2] : (w[n / 2 - 1] + w[n / 2]) / 2 }); }
      return { m: out }; } });
  add({ id: 'highest', name: 'En Yüksek', group: G.STAT, params: [P('length', 'int', 14, 1, 500)],
    plots: [{ k: 'h', color: C3 }], calc: (b, p, U) => ({ h: U.highest(b, p.length) }) });
  add({ id: 'lowest', name: 'En Düşük', group: G.STAT, params: [P('length', 'int', 14, 1, 500)],
    plots: [{ k: 'l', color: C4 }], calc: (b, p, U) => ({ l: U.lowest(b, p.length) }) });

  window.IND.register(L);
})();
