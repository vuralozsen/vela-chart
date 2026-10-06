/* r114-ethyellow regresyon: uzatılmış seans (ön/son seans) mumları grafikte SARI görünmeli.
   Sunucu normal seans dışı barlara x=('pre'|'post'|1) işareti basar (markExtendedBars);
   istemci bu barları sarı (#f0b90b) boyar, legend'a ÖS/SS rozeti basar.
   Çalıştır: node tests/eth-yellow.cjs  (sunucu çalışır olmalı: node server.mjs)
   NOT: test NASDAQ:AAPL kullanır — BIST'te uzatılmış seans yoktur, sarı beklenmez. */
const PW = process.env.PW_CORE || 'C:/Users/v_ozs/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright-core';
const CHROME = process.env.PW_CHROME || 'C:/Users/v_ozs/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';
const { chromium } = require(PW);

let fails = 0;
const ok = (c, m, extra) => { console.log((c ? '  ✓ ' : '  ✗ ') + m + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };

/* grafik tuvallerinde sarı (#f0b90b ≈ 240,185,11) piksel sayısı */
const SCAN = () => {
  const cs = [...document.querySelectorAll('#chartarea canvas')];
  let n = 0;
  for (const cv of cs) {
    try {
      const cx = cv.getContext('2d'); if (!cx) continue;
      const img = cx.getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 0; i < img.length; i += 4) {
        const r = img[i], g = img[i + 1], b = img[i + 2];
        if (r >= 225 && g >= 160 && g <= 205 && b <= 45) n++;
      }
    } catch (e) {}
  }
  return n;
};
/* yeşil (#089981 ≈ 8,153,129) + kırmızı (#f23645 ≈ 242,54,69) mum pikselleri */
const SCANR = () => {
  const cs = [...document.querySelectorAll('#chartarea canvas')];
  let n = 0;
  for (const cv of cs) {
    try {
      const cx = cv.getContext('2d'); if (!cx) continue;
      const img = cx.getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 0; i < img.length; i += 4) {
        const r = img[i], g = img[i + 1], b = img[i + 2];
        if ((r <= 60 && g >= 120 && g <= 180 && b >= 95 && b <= 160) ||
            (r >= 200 && g <= 90 && b >= 40 && b <= 100)) n++;
      }
    } catch (e) {}
  }
  return n;
};

(async () => {
  const br = await chromium.launch({ executablePath: CHROME });
  const pg = await br.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await pg.goto(URL, { waitUntil: 'domcontentloaded' });
    /* AAPL 5m + ETH açık → uzatılmış seans barları sarı gelmeli */
    await pg.evaluate(() => {
      localStorage.setItem('vela.symbol', JSON.stringify('NASDAQ:AAPL'));
      localStorage.setItem('vela.interval', JSON.stringify('5m'));
      localStorage.setItem('vela.eth', 'true');
      localStorage.setItem('vela.chartType', JSON.stringify('candles'));
    });
    await pg.reload({ waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => window.__vela && window.__vela.state.bars.length > 50, null, { timeout: 30000 });
    await pg.waitForTimeout(1500);

    const flags = await pg.evaluate(() => {
      const b = window.__vela.state.bars;
      const xs = b.filter(x => x.x);
      return { total: b.length, marked: xs.length,
        kinds: xs.reduce((a, x) => { a[x.x] = (a[x.x] || 0) + 1; return a; }, {}) };
    });
    ok(flags.total > 50, 'barlar yüklendi', flags.total);
    ok(flags.marked > 0, 'uzatılmış seans barları işaretli (x)', flags);

    await pg.waitForTimeout(500);
    const yellow = await pg.evaluate(SCAN);
    ok(yellow > 200, 'grafikte SARI mum pikselleri var', yellow);

    const badge = await pg.evaluate(() => {
      const el = document.querySelector('#legend .extb');
      return el ? el.textContent : null;
    });
    ok(badge === 'ÖS' || badge === 'SS', 'legend rozeti (ÖS/SS)', badge);

    await pg.screenshot({ path: 'gui-test-screenshots/eth-yellow-on.png' });

    /* KARIŞIK PENCERE: görünümü normal seans bölgesine kaydır — aynı ekranda hem sarı
       (ön/son seans) hem yeşil/kırmızı (normal seans) mumlar TOGETHER görünmeli. */
    const mixed = await pg.evaluate(() => {
      const b = window.__vela.state.bars;
      /* dünkü regular seans barlarının SONUNCUSU (normal seans kapanış mumu) */
      let idx = -1;
      for (let i = b.length - 1; i >= 0; i--) if (!b[i].x) { idx = i; break; }
      if (idx < 0) return { ok: false };
      window.__chart.timeScale().setVisibleLogicalRange({ from: idx - 45, to: idx + 45 });
      return { ok: true, idx, x: b[idx].time };
    });
    ok(mixed.ok, 'karışık pencere ankralandı', mixed);
    await pg.waitForTimeout(800);
    const yx = await pg.evaluate(SCAN), rx = await pg.evaluate(SCANR);
    ok(yx > 200 && rx > 200, 'aynı pencerede sarı + yeşil/kırmızı birlikte', { sari: yx, normal: rx });
    await pg.screenshot({ path: 'gui-test-screenshots/eth-yellow-mixed.png' });

    /* ETH kapalı → işaret yok, sarı yok */
    await pg.evaluate(() => { localStorage.setItem('vela.eth', 'false'); });
    await pg.reload({ waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => window.__vela && window.__vela.state.bars.length > 50, null, { timeout: 30000 });
    await pg.waitForTimeout(1500);
    const off = await pg.evaluate(() => ({
      marked: window.__vela.state.bars.filter(x => x.x).length, yellow: 0 }));
    off.yellow = await pg.evaluate(SCAN);
    ok(off.marked === 0, 'ETH kapalıyken işaret yok', off.marked);
    ok(off.yellow < 50, 'ETH kapalıyken sarı piksel yok', off.yellow);

    await pg.screenshot({ path: 'gui-test-screenshots/eth-yellow-off.png' });
  } catch (e) {
    console.log('  ✗ test hatası:', e.message); fails++;
  }
  await br.close();
  console.log(fails ? `\n${fails} BAŞARISIZ` : '\ntümü geçti');
  process.exit(fails ? 1 : 0);
})();
