/* Vela Chart — indikatör çekirdeği testi (node tests/ind.test.js) */
global.window = global;
const path = require('path');
require(path.join(__dirname, '..', 'public', 'ind-core.js'));
require(path.join(__dirname, '..', 'public', 'ind-catalog.js'));
const IND = global.IND;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  ✗ ' + m); } };
const fin = (v) => typeof v === 'number' && isFinite(v);
const allFin = (arr) => arr.length > 0 && arr.every(p => fin(p.value) && fin(p.time));

/* --- sentetik barlar: tohumlu rastgele yürüyüş (deterministik) --- */
function mkBars(n, seed) {
  let s = seed || 42; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = []; let px = 100;
  for (let i = 0; i < n; i++) {
    const dr = (rnd() - 0.5) * 2;
    const open = px, close = Math.max(1, px * (1 + dr * 0.012));
    const high = Math.max(open, close) * (1 + rnd() * 0.006), low = Math.min(open, close) * (1 - rnd() * 0.006);
    out.push({ time: 1700000000 + i * 86400, open, high, low, close, volume: 100000 + Math.floor(rnd() * 900000) });
    px = close;
  }
  return out;
}
const bars = mkBars(400, 7);

console.log('=== 1) Temel matematik doğrulaması ===');
const flat = mkBars(60, 3).map((x, i) => ({ ...x, open: 50, high: 50.5, low: 49.5, close: 50 }));
const smaFlat = IND.sma(flat, 10);
ok(smaFlat.length === 51, 'SMA uzunluk: ' + smaFlat.length + ' (bekl. 51)');
ok(smaFlat.every(x => Math.abs(x.value - 50) < 1e-9), 'SMA sabit seride 50 dönmeli');
const emaFlat = IND.ema(flat, 10);
ok(emaFlat.every(x => Math.abs(x.value - 50) < 1e-9), 'EMA sabit seride 50 dönmeli');
const wmaFlat = IND.wma(flat, 10);
ok(wmaFlat.every(x => Math.abs(x.value - 50) < 1e-9), 'WMA sabit seride 50 dönmeli');
const rsiFlat = IND.rsiSeries(flat, 14);
ok(rsiFlat.every(x => x.value >= 0 && x.value <= 100), 'RSI 0-100 aralığında');
const up = mkBars(120, 11);
const rsiUp = IND.rsiSeries(up, 14);
ok(rsiUp.length === 120 - 14, 'RSI uzunluk: ' + rsiUp.length);
/* RSI bağımsız referans: Wilder'ın kendi formülüyle yeniden hesap */
function rsiRef(b, p) {
  let ag = 0, al = 0, out = [];
  for (let i = 1; i < b.length; i++) {
    const d = b[i].close - b[i - 1].close, g = Math.max(d, 0), l = Math.max(-d, 0);
    if (i <= p) { ag += g; al += l; if (i === p) { ag /= p; al /= p; out.push(100 - 100 / (1 + (al === 0 ? 1e9 : ag / al))); } }
    else { ag = (ag * (p - 1) + g) / p; al = (al * (p - 1) + l) / p; out.push(100 - 100 / (1 + (al === 0 ? 1e9 : ag / al))); }
  }
  return out;
}
const ref = rsiRef(up, 14);
const dev = Math.max(...rsiUp.map((x, i) => Math.abs(x.value - ref[i])));
ok(dev < 1e-6, 'RSI referans formülle birebir (max sapma=' + dev.toExponential(2) + ')');

console.log('=== 2) Katalog bütünlüğü ===');
const CAT = IND.all();
console.log('  kayıtlı indikatör: ' + CAT.length);
ok(CAT.length >= 60, 'katalog >= 60 (var: ' + CAT.length + ')');
const ids = new Set(); let dup = 0;
CAT.forEach(d => { if (ids.has(d.id)) dup++; ids.add(d.id); });
ok(dup === 0, 'tekrarlanan id yok');
const grp = IND.groups();
console.log('  kategori: ' + grp.size + ' → ' + [...grp.keys()].join(' | '));
ok(grp.size >= 6, 'kategori >= 6');

console.log('=== 3) Her indikatör çalışıyor mu (400 bar) ===');
const broken = [];
CAT.forEach(def => {
  try {
    const r = IND.compute(def, bars, null);
    const keys = Object.keys(r.plots);
    if (!keys.length) { broken.push(def.id + ': boş çıktı'); return; }
    keys.forEach(k => {
      const p = r.plots[k];
      if (!Array.isArray(p)) { broken.push(def.id + '.' + k + ': dizi değil'); return; }
      if (!p.length) { broken.push(def.id + '.' + k + ': 0 nokta'); return; }
      if (!allFin(p)) { broken.push(def.id + '.' + k + ': sonlu olmayan değer'); return; }
    });
  } catch (e) { broken.push(def.id + ': HATA ' + e.message); }
});
if (broken.length) { broken.forEach(b => console.log('  ✗ ' + b)); fail += broken.length; }
else { console.log('  ✓ ' + CAT.length + '/' + CAT.length + ' indikatör hatasız, dolu ve sonlu çıktı verdi'); pass++; }

console.log('=== 4) Bant sıralaması (üst > orta > alt) ===');
[['bb', null], ['kc', null], ['dc', null], ['env', null], ['atrb', null], ['pc', null]].forEach(([id]) => {
  const r = IND.compute(IND.get(id), bars, null);
  const upA = r.plots.up || r.plots.sa, midA = r.plots.mid || r.plots.ma, dnA = r.plots.dn || r.plots.sb;
  if (!upA || !midA || !dnA) { fail++; console.log('  ✗ ' + id + ': bant anahtarları eksik'); return; }
  const m = new Map(midA.map(x => [x.time, x.value]));
  const bad = upA.filter(x => m.has(x.time)).filter(x => !(x.value >= m.get(x.time) - 1e-9)).length +
    dnA.filter(x => m.has(x.time)).filter(x => !(x.value <= m.get(x.time) + 1e-9)).length;
  ok(bad === 0, id + ': üst>=orta>=alt ihlali ' + bad + ' kez');
});

console.log('=== 5) MACD hist = line - signal ===');
{
  const r = IND.compute(IND.get('macd'), bars, null);
  const m = new Map(r.plots.sig.map(x => [x.time, x.value]));
  const bad = r.plots.hist.filter(x => m.has(x.time)).filter(x => Math.abs(x.value - (r.plots.line.find(y => y.time === x.time).value - m.get(x.time))) > 1e-9).length;
  ok(bad === 0, 'MACD histogram tutarlı (ihlal=' + bad + ')');
}

console.log('=== 6) Osilatör sınırları ===');
{
  const rr = IND.compute(IND.get('rsi'), bars, null).plots.rsi;
  ok(rr.every(x => x.value >= -1e-6 && x.value <= 100 + 1e-6), 'RSI sınırları');
  const st = IND.compute(IND.get('stoch'), bars, null); 
  ok(st.plots.k.every(x => x.value >= -1e-6 && x.value <= 100 + 1e-6), 'Stokastik %K 0-100');
  ok(st.plots.d.every(x => x.value >= -1e-6 && x.value <= 100 + 1e-6), 'Stokastik %D 0-100');
  const wr = IND.compute(IND.get('willr'), bars, null).plots.w;
  ok(wr.every(x => x.value >= -100 - 1e-6 && x.value <= 0 + 1e-6), 'Williams %R -100..0');
  const mf = IND.compute(IND.get('mfi'), bars, null).plots.mfi;
  ok(mf.every(x => x.value >= -1e-6 && x.value <= 100 + 1e-6), 'MFI 0-100');
  const ar = IND.compute(IND.get('aroon'), bars, null);
  ok(ar.plots.up.every(x => x.value >= 0 && x.value <= 100), 'Aroon Up 0-100');
}

console.log('=== 7) Panel/overlay sınıflaması ===');
{
  const panes = CAT.filter(d => d.pane).length, ovl = CAT.filter(d => !d.pane).length;
  console.log('  overlay(ana grafik): ' + ovl + ' | pane(alt panel): ' + panes);
  ok(ovl >= 15 && panes >= 30, 'her iki grup da dolu');
}

console.log('\n========================================');
console.log('GEÇTİ: ' + pass + ' | BAŞARISIZ: ' + fail);
process.exit(fail ? 1 : 0);
