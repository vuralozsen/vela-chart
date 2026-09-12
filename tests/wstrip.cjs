/* wstrip (grafik alti izleme seridi) dogrulama: mobilde gorunur, satirlar dolu,
   secili buyuk/beyaz, dokununca sembol gecer */
const puppeteer = require('/tmp/vela-test/node_modules/puppeteer');
/* gercek dokunma: CDP touch (puppeteer tap bazi durumlarda click uretmeyebilir) */
async function cdpTouch(p, x, y, holdMs) {
  const cdp = await p.target().createCDPSession();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await new Promise(r => setTimeout(r, holdMs || 80));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
(async () => {
  const b = await puppeteer.launch({ headless: 'new',
    executablePath: '/opt/data/.pw-browsers/chromium-1208/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 100)));
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.goto('http://127.0.0.1:3010/', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 8000));
  let fails = 0;
  const ok = (c, n, x) => { console.log((c ? '  ✓ ' : '  ✗ ') + n, x !== undefined ? JSON.stringify(x) : ''); if (!c) fails++; };
  const strip = await p.evaluate(() => {
    const el = document.querySelector('#wstrip');
    const r = el.getBoundingClientRect();
    const rows = [...el.querySelectorAll('.wsrow')];
    const sel = el.querySelector('.wsrow.sel');
    return { gorunur: r.height >= 40, satir: rows.length,
      seciliBuyuk: sel ? getComputedStyle(sel.querySelector('.wst')).fontSize : null,
      renk: sel ? getComputedStyle(sel.querySelector('.wst')).color : null,
      seciliSembol: sel ? sel.dataset.sym : null };
  });
  ok(strip.gorunur, 'wstrip gorunur (tek satir bant)', strip);
  ok(strip.satir >= 3, 'satirlar dolu', strip.satir);
  ok(strip.seciliBuyuk === '16px', 'secili ticker buyuk (16px tek satir bant)', strip.seciliBuyuk);
  ok(strip.renk === 'rgb(255, 255, 255)', 'secili ticker beyaz', strip.renk);
  // seritteki baska satira dokun → sembol gecer
  /* tek satir pencere: gorunmez satira dokunulamaz → once BASILI TUT ile fulllist ac,
     koordinatlari fulllist acildiktan SONRA al */
  const wsBox = await p.evaluate(() => { const r = document.querySelector('#wstrip').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await cdpTouch(p, wsBox.x, wsBox.y, 800);   /* basili tut → fulllist */
  await new Promise(r2 => setTimeout(r2, 400));
  const opened = await p.evaluate(() => document.querySelector('#wstrip').classList.contains('fulllist'));
  if (opened) {
    const otherInfo = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('#wstrip .wsrow')];
      const el = rows.find(r => !r.classList.contains('sel'));
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { sym: el.dataset.sym, x: b.left + b.width / 2, y: b.top + b.height / 2 };
    });
    await cdpTouch(p, otherInfo.x, otherInfo.y);
    await new Promise(r2 => setTimeout(r2, 2000));
    const now = await p.evaluate(() => window.velaChart.state.symbol);
    ok(now === otherInfo.sym, 'fulllist satirina dokun → sembol gecer', { beklenen: otherInfo.sym, gelen: now });
  } else {
    ok(false, 'basili tut → fulllist acilmadi');
  }
  // dikey kaydirma: 5 satir sigmiyorsa scrollable olmali; sigiyorsa zaten gezinme gereksiz
  const sc = await p.evaluate(() => { const el = document.querySelector('#wstrip');
    return { sh: el.scrollHeight, ch: el.clientHeight, scrollable: el.scrollHeight > el.clientHeight + 2,
      overflowY: getComputedStyle(el).overflowY, maxH: getComputedStyle(el).maxHeight }; });
  ok(sc.scrollable || sc.overflowY === 'hidden', 'serit kaydirma hazir (yatay bant)', sc);
  ok(errs.length === 0, 'sayfa hatasi yok', errs.slice(0, 3));
  console.log(fails ? `wstrip BASARISIZ (${fails})` : 'wstrip GECTI');
  process.exit(fails ? 1 : 0);
})();
