/* r114d-ethlineonly regresyon: uzatılmış seans (ön/son seans) MUM OLARAK ÇİZİLMEZ;
   yalnız AYRI bir SARI kesikli fiyat çizgisiyle gösterilir. Normal seans son fiyat çizgisi
   mumlarla ilişkili hâliyle kalır (regular mumların sonunda, yön renginde). Mum kapanış
   geri sayımı varsa İKİ fiyat etiketinin de ALTINA iner (üst üste gelmesin).
   Sunucu normal seans dışı barlara x=('pre'|'post') işareti basar (markExtendedBars).
   Çalıştır: node tests/eth-yellow.cjs  (sunucu çalışır olmalı: node server.mjs)
   NOT: test NASDAQ:AAPL kullanır — BIST'te uzatılmış seans yoktur. Ön/son seans işliyorken
   sarı çizgi görünür; normal seans işliyorken görünmez (koşullu doğrulama). */
const PW = process.env.PW_CORE || 'C:/Users/v_ozs/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright-core';
const CHROME = process.env.PW_CHROME || 'C:/Users/v_ozs/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';
const { chromium } = require(PW);

let fails = 0;
const ok = (c, m, extra) => { console.log((c ? '  ✓ ' : '  ✗ ') + m + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };

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
const BARS_PX = () => {
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

    const st = await pg.evaluate(async () => {
      /* YAPISAL anlık görüntü: state.bars ve series.data() AYNI senkron anda okunur
         (araya WS tick/reconcile girip yarış yaratmasın) */
      const b = window.__vela.state.bars;
      const d = window.__vela.series.data();
      const snap = {
        total: b.length,
        markedInChart: b.filter(x => x.x).length,
        dataCount: d.length,
        lastDataTime: d[d.length - 1].time,
        lastBarTime: b[b.length - 1].time,
        colored: d.filter(p => p.color !== undefined || p.borderColor !== undefined || p.wickColor !== undefined).length,
        ethPrice: window.__vela.ethPrice, extLine: window.__vela.extLine,
        plc: window.__vela.series.options().priceLineColor,
        lastClose: b[b.length - 1].close, lastOpen: b[b.length - 1].open,
      };
      /* sunucu hâlâ uzatılmış barları işaretliyor mu (ayrı istek, yarıştan bağımsız) */
      const r = await fetch('/api/bars?symbol=NASDAQ:AAPL&tf=5&n=400&session=extended').then(x => x.json());
      snap.srvMarked = (r.bars || []).filter(x => x.x).length;
      return snap;
    });
    ok(st.total > 50, 'barlar yüklendi', st.total);
    ok(st.srvMarked > 0, 'sunucu uzatılmış barları işaretliyor', st.srvMarked);
    ok(st.markedInChart === 0, 'grafik serisinde uzatılmış mum YOK (regular-only)', st.markedInChart);
    ok(st.dataCount === st.total && st.lastDataTime - st.lastBarTime === 10800, 'seri = state.bars (regular mumlar, ct +3h görüntü kayması)', { dataCount: st.dataCount, total: st.total, dt: st.lastDataTime - st.lastBarTime });
    ok(st.colored === 0, 'mum başına renk yok', st.colored);
    ok(st.plc !== '#f0b90b', 'ana fiyat çizgisi mumla ilişkili (yön rengi, sarı DEĞİL)', st.plc);
    ok(st.plc === (st.lastClose >= st.lastOpen ? '#089981' : '#f23645'), 'ana fiyat çizgisi yön renginde', st.plc);

    /* uzatılmış seans işliyorsa: sarı çizgi var, seviyesi canlı ETH fiyatı */
    if (st.ethPrice != null) {
      ok(!!st.extLine && st.extLine.price === st.ethPrice, 'sarı çizgi uzatılmış seans fiyatında', { eth: st.ethPrice, line: st.extLine });
      const y = await pg.evaluate(() => {
        const s = window.__vela.series, ep = window.__vela.ethPrice, lb = window.__vela.state.bars[window.__vela.state.bars.length - 1];
        const cd = document.getElementById('countdown');
        return { yEth: s.priceToCoordinate(ep), yLast: s.priceToCoordinate(lb.close),
          cdTop: cd && cd.style.display !== 'none' ? parseFloat(cd.style.top) : null };
      });
      ok(y.yEth != null && y.yLast != null, 'etiket koordinatları okunuyor', y);
      if (y.yEth != null && y.yLast != null) {
        ok(y.cdTop != null && y.cdTop >= Math.max(y.yEth, y.yLast) + 5, 'geri sayım İKİ fiyat etiketinin de ALTINDA', y);
      }
      const yOn = await pg.evaluate(YELLOW);
      ok(yOn > 50 && yOn < 6000, 'sarı YALNIZ çizgi düzeyinde', yOn);
    } else {
      ok(!st.extLine, 'normal seans işliyor → sarı çizgi YOK', st.extLine);
    }
    const badge = await pg.evaluate(() => {
      const el = document.querySelector('#legend .extb');
      return el ? el.textContent : null;
    });
    ok(badge === null || badge === 'ÖS' || badge === 'SS', 'legend rozeti (ÖS/SS veya yok)', badge);

    const px = await pg.evaluate(BARS_PX);
    ok(px > 200, 'normal seans mumları yeşil/kırmızı çiziliyor', px);
    await pg.screenshot({ path: 'gui-test-screenshots/eth-yellow-on.png' });

    /* ETH kapalı → sarı çizgi yok, her şey eski hâli */
    await pg.evaluate(() => { localStorage.setItem('vela.eth', 'false'); });
    await pg.reload({ waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => window.__vela && window.__vela.state.bars.length > 50, null, { timeout: 30000 });
    await pg.waitForTimeout(1500);
    const off = await pg.evaluate(() => ({ ethPrice: window.__vela.ethPrice, extLine: window.__vela.extLine }));
    off.yellow = await pg.evaluate(YELLOW);
    ok(off.ethPrice == null && off.extLine == null, 'ETH kapalıyken sarı çizgi yok', off);
    ok(off.yellow < 50, 'ETH kapalıyken sarı piksel yok', off.yellow);
    await pg.screenshot({ path: 'gui-test-screenshots/eth-yellow-off.png' });
  } catch (e) {
    console.log('  ✗ test hatası:', e.message); fails++;
  }
  await br.close();
  console.log(fails ? `\n${fails} BAŞARISIZ` : '\ntümü geçti');
  process.exit(fails ? 1 : 0);
})();
