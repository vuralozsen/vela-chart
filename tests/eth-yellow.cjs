/* r114b-ethprice regresyon: uzatılmış seans (ön/son seans) FİYAT ÇİZGİSİ sarı olmalı.
   TV paritesi: mumlar asla boyanmaz; normal seans dışı son mumda yön rengi yerine SARI
   fiyat çizgisi + eksen etiketi görünür. Sunucu normal seans dışı barlara x=('pre'|'post')
   işareti basar (markExtendedBars); istemci fiyat çizgisini C.eth'e çevirir.
   Çalıştır: node tests/eth-yellow.cjs  (sunucu çalışır olmalı: node server.mjs)
   NOT: test NASDAQ:AAPL kullanır — BIST'te uzatılmış seans yoktur. Seans durumuna göre
   (test anında ön/son seans işliyorsa) fiyat çizgisi sarı olur; normal seanssa yön rengi. */
const PW = process.env.PW_CORE || 'C:/Users/v_ozs/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright-core';
const CHROME = process.env.PW_CHROME || 'C:/Users/v_ozs/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';
const { chromium } = require(PW);

let fails = 0;
const ok = (c, m, extra) => { console.log((c ? '  ✓ ' : '  ✗ ') + m + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };

/* tuvalde sarı (#f0b90b ≈ 240,185,11) piksel sayısı — fiyat çizgisi + etiket bu kadar */
const YELLOW = () => {
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
/* yeşil/kırmızı mum pikselleri (#089981 / #f23645) */
const BARS = () => {
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
    /* AAPL 5m + ETH açık */
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
      return { total: b.length, marked: xs.length, lastX: b[b.length - 1].x || null,
        plc: window.__vela.series.options().priceLineColor,
        colored: window.__vela.series.data().filter(p => p.color !== undefined || p.borderColor !== undefined || p.wickColor !== undefined).length };
    });
    ok(flags.total > 50, 'barlar yüklendi', flags.total);
    ok(flags.marked > 0, 'uzatılmış seans barları işaretli (x)', flags.marked);
    ok(flags.colored === 0, 'MUM BOYANMIYOR — seride per-bar renk yok', flags.colored);
    ok(flags.lastX ? flags.plc === '#f0b90b' : true, 'son mum normal seans dışıysa fiyat çizgisi SARI', { lastX: flags.lastX, plc: flags.plc });

    const yOn = await pg.evaluate(YELLOW);
    ok(yOn > 50 && yOn < 6000, 'sarı YALNIZ fiyat çizgisi düzeyinde (mum boyası değil)', yOn);

    const badge = await pg.evaluate(() => {
      const el = document.querySelector('#legend .extb');
      return el ? el.textContent : null;
    });
    ok(badge === 'ÖS' || badge === 'SS', 'legend rozeti (ÖS/SS)', badge);

    await pg.screenshot({ path: 'gui-test-screenshots/eth-yellow-on.png' });

    /* KARIŞIK PENCERE: normal seans bölgesine kaydır — mumlar yeşil/kırmızı kalmalı,
       sarı yine yalnız fiyat çizgisi düzeyinde kalmalı */
    const mixed = await pg.evaluate(() => {
      const b = window.__vela.state.bars;
      let idx = -1;
      for (let i = b.length - 1; i >= 0; i--) if (!b[i].x) { idx = i; break; }
      if (idx < 0) return { ok: false };
      window.__chart.timeScale().setVisibleLogicalRange({ from: idx - 45, to: idx + 45 });
      return { ok: true, idx };
    });
    ok(mixed.ok, 'karışık pencere ankralandı', mixed);
    await pg.waitForTimeout(800);
    const rx = await pg.evaluate(BARS), yx = await pg.evaluate(YELLOW);
    ok(rx > 200, 'normal seans mumları yeşil/kırmızı (boyanmamış)', rx);
    ok(yx < 6000, 'normal seans bölgesinde sarı mum YOK (yalnız çizgi)', yx);
    await pg.screenshot({ path: 'gui-test-screenshots/eth-yellow-mixed.png' });

    /* ETH kapalı → işaret yok, sarı fiyat çizgisi yok */
    await pg.evaluate(() => { localStorage.setItem('vela.eth', 'false'); });
    await pg.reload({ waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => window.__vela && window.__vela.state.bars.length > 50, null, { timeout: 30000 });
    await pg.waitForTimeout(1500);
    const off = await pg.evaluate(() => ({
      marked: window.__vela.state.bars.filter(x => x.x).length }));
    off.yellow = await pg.evaluate(YELLOW);
    ok(off.marked === 0, 'ETH kapalıyken işaret yok', off.marked);
    ok(off.yellow < 50, 'ETH kapalıyken sarı yok', off.yellow);
    await pg.screenshot({ path: 'gui-test-screenshots/eth-yellow-off.png' });
  } catch (e) {
    console.log('  ✗ test hatası:', e.message); fails++;
  }
  await br.close();
  console.log(fails ? `\n${fails} BAŞARISIZ` : '\ntümü geçti');
  process.exit(fails ? 1 : 0);
})();
