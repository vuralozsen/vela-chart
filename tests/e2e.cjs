/* Vela Chart — uçtan uca tarayıcı testi (gerçek Chrome, DOM üzerinden) */
const puppeteer = require('/tmp/vela-test/node_modules/puppeteer');
const CHROME = '/opt/data/.pw-browsers/chromium-1208/chrome-linux64/chrome';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    protocolTimeout: 600000,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  const fails = [];
  const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails.push(m); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const ev = (fn, ...a) => page.evaluate(fn, ...a);

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(4000);

  // 1) indikatör kataloğu
  const indCount = await ev(() => window.velaChart ? window.velaChart.indCount : -1).catch(() => -1);
  ok(indCount === 66, `IND kataloğu: ${indCount} gösterge (66 olmalı)`);

  // 2) grafik çizildi
  const cv = await ev(() => document.querySelectorAll('#chart canvas').length);
  ok(cv > 0, `grafik canvas sayısı: ${cv}`);
  const bars = await ev(() => (window.velaChart && window.velaChart.state.bars) ? window.velaChart.state.bars.length : 0);
  ok(bars > 50, `yüklenen bar: ${bars}`);

  // 3) legend sembol bilgisi
  const legend = await ev(() => document.getElementById('legend').innerText.replace(/\s*\n\s*/g, ' | '));
  ok(/THYAO/.test(legend), `legend: ${legend.slice(0, 80)}`);

  // 4) izleme listesi: metinler üst üste binmemeli
  const wl = await ev(() => {
    const rows = [...document.querySelectorAll('.wrow')];
    let bad = 0;
    for (const r of rows) {
      const s1 = r.querySelector('.s1'), s2 = r.querySelector('.s2');
      if (!s1 || !s2) continue;
      const a = s1.getBoundingClientRect(), b = s2.getBoundingClientRect();
      if (a.width > 0 && b.width > 0 && b.top < a.bottom - 1) bad++;
    }
    return { rows: rows.length, bad };
  });
  ok(wl.rows > 0, `izleme satırı: ${wl.rows}`);
  ok(wl.bad === 0, `üst üste binen izleme satırı: ${wl.bad} (0 olmalı)`);

  // 5) gösterge menüsü
  await page.click('#indbtn');
  await wait(500);
  const menu = await ev(() => {
    const dd = document.querySelector('.dd.ind');
    if (!dd) return { open: false, cats: [], items: 0 };
    return { open: dd.classList.contains('open'),
      cats: [...dd.querySelectorAll('.cat')].map(x => x.textContent),
      items: dd.querySelectorAll('[data-add]').length };
  });
  ok(menu.open, 'gösterge menüsü açıldı');
  ok(menu.items === 66, `menüde listelenen gösterge: ${menu.items}`);
  ok(menu.cats.length >= 8, `kategori: ${menu.cats.length} → ${menu.cats.slice(0, 9).join(', ')}`);

  // 6) arama filtresi
  await page.type('.dd.ind #indsrch', 'rsi');
  await wait(400);
  const srch = await ev(() => [...document.querySelectorAll('.dd.ind [data-add]')].map(x => x.dataset.add));
  ok(srch.length > 0 && srch.length < 12 && srch.some(x => /rsi/i.test(x)), `arama 'rsi' → ${srch.join(', ')}`);

  // 7) RSI ekle → alt panel oluşmalı
  await ev(() => { document.querySelector('.dd.ind [data-add="rsi"]').click(); });
  await wait(1200);
  const a1 = await ev(() => ({ panes: window.velaChart.chart.panes().length,
    chips: [...document.querySelectorAll('#indlist .chip .nm')].map(x => x.textContent),
    rsiChip: (document.querySelector('#indlist .chip') || {innerText:''}).innerText,
    rsiVals: [...document.querySelectorAll('#indlist .chip .vl')].map(x => x.textContent),
    rsiCount: ((document.getElementById('legend').innerText + ' ' + document.getElementById('indlist').innerText)
               .match(/RSI/g) || []).length }));
  ok(a1.panes >= 2, `RSI alt paneli → pane sayısı: ${a1.panes}`);
  ok(a1.chips.length === 1, `çip listesi: ${JSON.stringify(a1.chips)}`);
  ok(/RSI/.test(a1.rsiChip), 'RSI göstergesi legend listesinde (isim)');
  ok(a1.rsiVals.length > 0 && /\d/.test(a1.rsiVals.join('')),
     `RSI legend satırında son değer gösteriliyor: ${JSON.stringify(a1.rsiVals)}`);
  ok(a1.rsiCount === 1, `RSI yalnızca BİR kez yazılıyor (çift legend yok): ${a1.rsiCount}`);

  // 8) MACD ekle → AYRI panel (pane çakışması testi)
  await ev(() => window.velaChart.addIndicator('macd'));
  await wait(1000);
  const a2 = await ev(() => ({ panes: window.velaChart.chart.panes().length,
    chips: [...document.querySelectorAll('#indlist .chip .nm')].map(x => x.textContent) }));
  ok(a2.panes >= 3, `RSI+MACD ayrı panellerde → pane: ${a2.panes}`);
  ok(a2.chips.length === 2, `çip: ${JSON.stringify(a2.chips)}`);

  // 9) overlay gösterge (Bollinger) → panel açmamalı
  await ev(() => window.velaChart.addIndicator('bb'));
  await wait(1000);
  const a3 = await ev(() => ({ panes: window.velaChart.chart.panes().length,
    chips: [...document.querySelectorAll('#indlist .chip .nm')].map(x => x.textContent) }));
  ok(a3.panes === a2.panes, `overlay pane açmadı → pane: ${a3.panes}`);
  ok(a3.chips.length === 3, `çip: ${JSON.stringify(a3.chips)}`);

  // 10) çiple kaldırma
  await ev(() => { const c = [...document.querySelectorAll('#indlist .chip')].find(x => /RSI/.test(x.textContent)); c.querySelector('.x').click(); });
  await wait(1000);
  const a4 = await ev(() => ({ chips: [...document.querySelectorAll('#indlist .chip .nm')].map(x => x.textContent) }));
  ok(!a4.chips.some(x => /RSI/.test(x)), `RSI kaldırıldı → çip: ${JSON.stringify(a4.chips)}`);

  // 11) kalıcılık
  const stored = await ev(() => JSON.parse(localStorage.getItem('vela.active') || '[]').map(a => a.id));
  ok(stored.length === 2, `localStorage'da gösterge: ${JSON.stringify(stored)}`);

  // 12) aralık hesabı
  await ev(() => { window.velaChart.state.range = '1D'; window.velaChart.applyRange(); });
  await wait(600);
  const r1 = await ev(() => { const lr = window.velaChart.chart.timeScale().getVisibleLogicalRange(); return lr ? Math.round(lr.to - lr.from) : -1; });
  await ev(() => { window.velaChart.state.range = '6M'; window.velaChart.applyRange(); });
  await wait(600);
  const r6 = await ev(() => { const lr = window.velaChart.chart.timeScale().getVisibleLogicalRange(); return lr ? Math.round(lr.to - lr.from) : -1; });
  ok(r1 > 0 && r1 < r6, `aralık: 1D=${r1} bar < 6M=${r6} bar (eskiden ikisi de 3'tü)`);

  // 13) günlükte zaman etiketi kapalı, intraday'de açık
  const tvDaily = await ev(() => window.velaChart.chart.timeScale().options().timeVisible);
  ok(tvDaily === false, `1D'de zaman etiketi kapalı: ${tvDaily}`);
  await ev(() => window.velaChart.setInt('15m'));
  await wait(4000);
  const tvIntra = await ev(() => window.velaChart.chart.timeScale().options().timeVisible);
  ok(tvIntra === true, `15m'de zaman etiketi açık: ${tvIntra}`);
  const sameDay = await ev(() => { const b = window.velaChart.state.bars; if (b.length < 2) return -1; return Math.round(b[1].time - b[0].time); });
  ok(sameDay === 900, `15m bar aralığı: ${sameDay}sn (900 olmalı)`);
  await ev(() => window.velaChart.setInt('1D'));
  await wait(3500);

  // 14) Bollinger matematiği canlı veride: orta = 20 kapanışın ortalaması, bantlar simetrik
  const bbCheck = await ev(() => {
    const b = window.velaChart.state.bars, s = window.velaChart.seriesMap;
    let k = null; s.forEach(v => { if (v.def && v.def.id === 'bb') k = v; });
    if (!k) return { err: 'bb serisi yok' };
    const up = k.plots.up.data(), mid = k.plots.mid.data(), dn = k.plots.dn.data();
    const i = mid.length - 1;
    let sum = 0; for (let j = b.length - 20; j < b.length; j++) sum += b[j].close;
    const sma = sum / 20;
    // stddev kontrolü
    let ss = 0; for (let j = b.length - 20; j < b.length; j++) ss += Math.pow(b[j].close - sma, 2);
    const sd = Math.sqrt(ss / 20);
    return { midGot: mid[i].value, midExp: sma,
      upGot: up[i].value, upExp: sma + 2 * sd, dnGot: dn[i].value, dnExp: sma - 2 * sd,
      len: { up: up.length, mid: mid.length, dn: dn.length } };
  });
  const close = (a, b, t) => a !== undefined && Math.abs(a - b) < t;
  ok(bbCheck.err === undefined, `BB serisi bulundu: ${bbCheck.err || 'evet'}`);
  if (!bbCheck.err) {
    ok(close(bbCheck.midGot, bbCheck.midExp, 1e-6), `BB orta = SMA20 (${bbCheck.midGot?.toFixed(4)} vs ${bbCheck.midExp?.toFixed(4)})`);
    ok(close(bbCheck.upGot, bbCheck.upExp, 1e-6), `BB üst = SMA20 + 2σ (${bbCheck.upGot?.toFixed(4)} vs ${bbCheck.upExp?.toFixed(4)})`);
    ok(close(bbCheck.dnGot, bbCheck.dnExp, 1e-6), `BB alt = SMA20 - 2σ (${bbCheck.dnGot?.toFixed(4)} vs ${bbCheck.dnExp?.toFixed(4)})`);
    ok(bbCheck.len.up === bbCheck.len.mid && bbCheck.len.mid === bbCheck.len.dn, `BB bant uzunlukları eşit: ${JSON.stringify(bbCheck.len)}`);
  }
  // 15) RSI değerleri 0-100 aralığında
  await ev(() => window.velaChart.addIndicator('rsi'));
  await wait(900);
  const rsiChk = await ev(() => {
    let k = null; window.velaChart.seriesMap.forEach(v => { if (v.def && v.def.id === 'rsi') k = v; });
    if (!k) return null;
    const pk = Object.keys(k.plots)[0];          // plot anahtar adına bağımlı değil
    const d = k.plots[pk].data();
    return { key: pk, n: d.length, min: Math.min(...d.map(x => x.value)), max: Math.max(...d.map(x => x.value)) };
  });
  ok(rsiChk && rsiChk.min >= 0 && rsiChk.max <= 100 && rsiChk.n > 100,
    `RSI 0-100 aralığında: n=${rsiChk?.n} min=${rsiChk?.min.toFixed(2)} max=${rsiChk?.max.toFixed(2)}`);

  // 16) ÇİZİM ARAÇLARI — 42 aracın her biri gerçekten çiziyor mu?
  const drw = await ev(() => {
    const V = window.velaChart, cv = document.getElementById('overlay');
    const r = cv.getBoundingClientRect();
    const P = (x, y, type) => cv.dispatchEvent(new PointerEvent(type, {
      clientX: r.left + x, clientY: r.top + y, bubbles: true, button: 0,
      buttons: type === 'pointerup' ? 0 : 1, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    const realPrompt = window.prompt; window.prompt = function () { return 'TEST METNI'; };
    const INK = (x0, y0, x1, y1) => V.overlayInk(x0, y0, x1, y1);
    const BOX = [420, 180, 900, 460];   // jestlerin geçtiği bölge (CSS px)
    const out = [];
    for (const t of V.TOOLS) {
      V.clearDrawings(); V.setTool(t.id);
      const inkBefore = INK.apply(null, BOX);
      const n = t.pts;
      if (t.id === 'brush' || t.id === 'highlighter') {
        P(600, 300, 'pointerdown');
        for (let i = 1; i <= 12; i++) P(600 + i * 9, 300 + Math.sin(i / 2) * 34, 'pointermove');
        P(708, 320, 'pointerup');
      } else if (t.id === 'path') {
        P(520, 300, 'pointerdown'); P(560, 340, 'pointermove'); P(560, 340, 'pointerup');
        P(620, 320, 'pointerdown'); P(620, 320, 'pointerup');
        cv.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      } else if (n <= 1) {
        P(600, 300, 'pointerdown'); P(600, 300, 'pointerup');
      } else if (n === 2) {
        P(500, 260, 'pointerdown'); P(620, 320, 'pointermove');
        P(760, 380, 'pointermove'); P(760, 380, 'pointerup');
      } else {
        const co = [[500, 240], [560, 300], [620, 250], [680, 330], [740, 270], [800, 360]];
        for (let i = 0; i < n; i++) { const c = co[i % co.length];
          P(c[0], c[1], 'pointerdown'); P(c[0], c[1], 'pointerup'); }
      }
      out.push({ id: t.id, need: n, made: V.getDrawings().length,
        ink: INK.apply(null, BOX) - inkBefore, stuck: !!V.getPending() });
      if (V.getPending()) V.setTool('cursor'), V.clearDrawings();
    }
    window.prompt = realPrompt;
    V.clearDrawings(); V.setTool('cursor');
    return out;
  });
  const NO_DRAW = new Set(['cursor', 'crosshair']);
  ok(drw.length === 41, `araç paleti: ${drw.length} araç (41 olmalı)`);
  const selfDraw = drw.filter(x => !NO_DRAW.has(x.id));
  const notMade = selfDraw.filter(x => x.made !== 1);
  ok(notMade.length === 0,
    `çizim kaydı oluşturan araç: ${selfDraw.length - notMade.length}/${selfDraw.length}` +
    (notMade.length ? ` → EKSİK: ${notMade.map(x => x.id + '(pts=' + x.need + ')').join(', ')}` : ''));
  const blank = selfDraw.filter(x => x.ink <= 0);
  ok(blank.length === 0,
    `tuvale GERÇEKTEN boyayan araç: ${selfDraw.length - blank.length}/${selfDraw.length}` +
    (blank.length ? ` → BOŞ ÇİZEN: ${blank.map(x => x.id).join(', ')}` : ''));
  const stuck = drw.filter(x => x.stuck);
  ok(stuck.length === 0, `yarım kalan (takılı) çizim aracı: ${stuck.length}`);

  // 17) geometri round-trip: sürüklenen nokta ekrandaki yere geri düşüyor mu (1D)
  const rt = async (tf) => {
    if (tf) { await ev(t => window.velaChart.setInt(t), tf); await wait(4200); }
    return await ev(() => {
      const V = window.velaChart, cv = document.getElementById('overlay');
      const r = cv.getBoundingClientRect();
      const P = (x, y, type) => cv.dispatchEvent(new PointerEvent(type, { clientX: r.left + x,
        clientY: r.top + y, bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerId: 1 }));
      V.clearDrawings(); V.setTool('trend');
      P(500, 260, 'pointerdown'); P(700, 340, 'pointermove'); P(700, 340, 'pointerup');
      V.setTool('cursor');
      const d = V.getDrawings()[0]; if (!d || !d.pts) return { err: 'çizim kaydı yok' };
      if (!V.main) return { err: 'ana seri yok' };
      const a = V.toXY(d.pts[0].time, d.pts[0].price);
      const d2 = d.pts[d.pts.length - 1];
      const b = V.toXY(d2.time, d2.price);
      if (a.x == null || a.y == null || b.x == null || b.y == null) return { err: 'koordinat dönüşü null' };
      V.clearDrawings();
      return { dx: Math.round(a.x - 500), dy: Math.round(a.y - 260),
        dx2: Math.round(b.x - 700), dy2: Math.round(b.y - 340) };
    });
  };
  const g1 = await rt(null);
  ok(!g1.err && Math.abs(g1.dx) <= 4 && Math.abs(g1.dy) <= 4 && Math.abs(g1.dx2) <= 4 && Math.abs(g1.dy2) <= 4,
    g1.err ? `geometri(1D): ${g1.err}` : `geometri(1D) sıfırlanma: baş=(${g1.dx},${g1.dy}) son=(${g1.dx2},${g1.dy2}) — |Δ|≤4px olmalı`);

  // 18) aynı test 15m'de → TZ kayması regresyonu (çizim 3 saat kaymamalı)
  const g2 = await rt('15m');
  ok(!g2.err && Math.abs(g2.dx) <= 4 && Math.abs(g2.dy) <= 4,
    g2.err ? `geometri(15m): ${g2.err}` : `geometri(15m) intraday TZ kayması: Δx=${g2.dx}px, Δy=${g2.dy}px — |Δ|≤4px olmalı`);
  await ev(() => window.velaChart.setInt('1D'));
  await wait(3500);

  // 19) konsol hatası yok
  ok(errs.length === 0, `JS hatası: ${errs.length}${errs.length ? ' → ' + errs.slice(0, 3).join(' | ') : ''}`);

  await page.screenshot({ path: '/opt/data/tmp/vela-e2e.png' });
  console.log('\n' + '='.repeat(46));
  console.log(fails.length ? `BAŞARISIZ (${fails.length}):\n - ` + fails.join('\n - ') : 'TÜM E2E TESTLERİ GEÇTİ ✓');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('TEST ÇÖKTÜ:', e.message); process.exit(2); });
