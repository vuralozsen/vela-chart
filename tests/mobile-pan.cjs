/* MOBIL PAN REGRESYON: tek parmak yatay kaydirma chart'i kaydirir (TV parite).
   - cursor aracindayken sola swipe → logical range kayar
   - eksen bolgelerindeki dokunma pan yapmaz (fiyat/zaman ekseni motoru Calisir)
   - cizim araci (trend) seciliyken pan yapmaz (cizim on planda)
   - dikey pinch fiyat zoom'u hala calisir (mevcut motor)
*/
const puppeteer = require('/tmp/vela-test/node_modules/puppeteer');
const CHROME = '/opt/data/.pw-browsers/chromium-1208/chrome-linux64/chrome';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';
let fails = 0;
const ok = (c, name, extra) => { console.log((c ? '  ✓ ' : '  ✗ ') + name, extra !== undefined ? JSON.stringify(extra) : ''); if (!c) fails++; };
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await (await browser.createBrowserContext()).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 7000));
  const range = () => p.evaluate(() => { const t = window.__chart.timeScale().getVisibleLogicalRange(); return [Math.round(t.from * 10) / 10, Math.round(t.to * 10) / 10]; });

  /* 1) cursor araci + sola swipe = kay */
  await p.evaluate(() => { window.velaChart.setTool('cursor'); });
  await new Promise(r => setTimeout(r, 250));
  const a0 = await range();
  await p.touchscreen.touchStart(280, 420);
  await p.touchscreen.touchMove(160, 420);
  await new Promise(r => setTimeout(r, 90));
  await p.touchscreen.touchEnd();
  await new Promise(r => setTimeout(r, 600));
  const a1 = await range();
  ok(a1[0] > a0[0] + 5, 'cursor aracinda sola swipe grafik ileri kayar', { once: a0, sonra: a1 });

  /* 2) saga swipe = geri */
  const b0 = await range();
  await p.touchscreen.touchStart(120, 420);
  await p.touchscreen.touchMove(300, 420);
  await new Promise(r => setTimeout(r, 90));
  await p.touchscreen.touchEnd();
  await new Promise(r => setTimeout(r, 600));
  const b1 = await range();
  ok(b1[0] < b0[0] - 5, 'saga swipe geri kaydirir', { once: b0, sonra: b1 });

  /* 3) cizim aracindayken swipe kaydirmaz */
  await p.evaluate(() => { window.velaChart.setTool('trend'); });
  await new Promise(r => setTimeout(r, 250));
  const c0 = await range();
  await p.touchscreen.touchStart(200, 420);
  await p.touchscreen.touchMove(80, 420);
  await new Promise(r => setTimeout(r, 90));
  await p.touchscreen.touchEnd();
  await new Promise(r => setTimeout(r, 500));
  const c1 = await range();
  ok(Math.abs(c1[0] - c0[0]) < 3, 'cizim aracinda swipe pan yapmaz (cizim on planda)', { once: c0, sonra: c1 });
  await p.evaluate(() => { window.velaChart.setTool('cursor'); });

  /* 4) iki parmak chart govdesinde pinch = zaman zoom (LWC native; TV parite) */
  const w0 = await p.evaluate(() => { const t = window.__chart.timeScale().getVisibleLogicalRange(); return t.to - t.from; });
  const cdp = await p.target().createCDPSession();
  const cxp = 195, cyp = 420;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
    { x: cxp - 30, y: cyp, id: 1 }, { x: cxp + 30, y: cyp, id: 2 }] });
  for (let i = 1; i <= 8; i++) {
    const d = 60 + i * 14;   /* acilma: 60→172 */
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
      { x: cxp - d / 2, y: cyp, id: 1 }, { x: cxp + d / 2, y: cyp, id: 2 }] });
    await new Promise(r => setTimeout(r, 30));
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await new Promise(r => setTimeout(r, 900));
  const w1 = await p.evaluate(() => { const t = window.__chart.timeScale().getVisibleLogicalRange(); return t.to - t.from; });
  ok(Math.abs(w1 - w0) > 2, 'iki parmak pinch zoom calisiyor (govde: zaman zoom)', { w0: Math.round(w0), w1: Math.round(w1) });

  /* 5) sayfa hatasi yok */
  ok(errs.length === 0, 'sayfa hatasi yok', errs.slice(0, 3));

  await browser.close();
  console.log(fails ? `mobile-pan BASARISIZ (${fails})` : 'mobile-pan GECTI');
  process.exit(fails ? 1 : 0);
})();
