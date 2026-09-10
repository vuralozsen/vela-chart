/* Vela Chart — g1 izgara / g2 otomatik olcek / g4 Alt+R parite testi (gerçek Chrome) */
const puppeteer = require('/tmp/vela-test/node_modules/puppeteer');
const CHROME = '/opt/data/.pw-browsers/chromium-1208/chrome-linux64/chrome';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    protocolTimeout: 600000, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  let pass = 0, fail = 0;
  const ok = (c, m) => { console.log((c ? '  \u2713 ' : '  \u2717 ') + m); c ? pass++ : fail++; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const ev = (fn, ...a) => page.evaluate(fn, ...a);

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => window.velaChart && window.velaChart.chart, { timeout: 30000 });
  await wait(3000);
  /* varsayilan aralik = sayfa acilisindaki aralik (Alt+R bunu geri getirmeli) */
  const DEF = await ev(() => window.velaChart.state.range);
  console.log(`  (varsayilan aralik: ${DEF})`);

  const gridOpt = () => ev(() => {
    const g = window.velaChart.chart.options().grid || {};
    return { v: (g.vertLines||{}).visible, h: (g.horzLines||{}).visible };
  });

  console.log('\n== g1) IZGARA ac/kapa (sag tik menusu) ==');
  const g0 = await gridOpt();
  ok(g0.v === true, `baslangicta izgara ACIK (vert=${g0.v})`);
  // sag tik: grafik ortasi (bos alan, cizim yok)
  const box = await ev(() => { const c = document.querySelector('#chart canvas');
    const r = c.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 - 60 }; });
  await page.mouse.click(box.x, box.y, { button: 'right' });
  await wait(600);
  const menu = await ev(() => ({ open: document.getElementById('ctxmenu').classList.contains('open'),
    items: Array.from(document.querySelectorAll('#ctxmenu .ci')).map(e => e.textContent.trim()) }));
  ok(menu.open, 'sag tik menusu acildi');
  ok(menu.items.some(t => /Izgara/i.test(t)), `menude "Izgara" ogesi var -> ${JSON.stringify(menu.items.filter(t=>/Izgara|s.f.rla/.test(t)))}`);

  // menuden izgarayi kapat
  await ev(() => { const it = Array.from(document.querySelectorAll('#ctxmenu .ci')).find(e => /Izgara/i.test(e.textContent)); if (it) it.click(); });
  await wait(700);
  const g1 = await gridOpt();
  ok(g1.v === false && g1.h === false, `izgara KAPANDI (vert=${g1.v} horz=${g1.h})`);
  const ls1 = await ev(() => JSON.parse(localStorage.getItem('vela.grid')));
  ok(ls1 === false, `tercih kaydedildi (LS vela.grid=${ls1})`);
  const menuClosed = await ev(() => !document.getElementById('ctxmenu').classList.contains('open'));
  ok(menuClosed, 'menu islemden sonra kapandi');

  // tekrar ac
  await page.mouse.click(box.x, box.y, { button: 'right' });
  await wait(500);
  await ev(() => { const it = Array.from(document.querySelectorAll('#ctxmenu .ci')).find(e => /Izgara/i.test(e.textContent)); if (it) it.click(); });
  await wait(700);
  const g2 = await gridOpt();
  ok(g2.v === true, `izgara yeniden ACILDI (vert=${g2.v})`);

  console.log('\n== g1b) izgara tema degisiminde korunuyor ==');
  await page.mouse.click(box.x, box.y, { button: 'right' });
  await wait(500);
  await ev(() => { const it = Array.from(document.querySelectorAll('#ctxmenu .ci')).find(e => /Izgara/i.test(e.textContent)); if (it) it.click(); });
  await wait(600);
  await ev(() => document.getElementById('themebtn').click());
  await wait(1200);
  const gTheme = await gridOpt();
  const th = await ev(() => document.documentElement.getAttribute('data-theme'));
  ok(gTheme.v === false, `tema=${th} sonrasi izgara hala KAPALI (vert=${gTheme.v})`);
  await ev(() => document.getElementById('themebtn').click());   // koyuya don
  await wait(900);
  await ev(() => { LS.set && null; });
  // temizlik: izgarayi geri ac
  await page.mouse.click(box.x, box.y, { button: 'right' });
  await wait(400);
  await ev(() => { const it = Array.from(document.querySelectorAll('#ctxmenu .ci')).find(e => /Izgara/i.test(e.textContent)); if (it) it.click(); });
  await wait(600);
  const gBack = await gridOpt();
  ok(gBack.v === true, `izgara geri acildi (vert=${gBack.v})`);

  console.log('\n== g2) sembol degisince fiyat ekseni otomatik olcek ==');
  await ev(() => window.velaChart.pickSymbol('BINANCE:BTCUSDT'));
  await wait(4000);
  const btc = await ev(() => {
    const V = window.velaChart;
    const ps = V.chart.priceScale('right');
    const s = V.main.data(); const last = s.slice(-1)[0];
    return { sym: V.state.symbol, auto: ps.options().autoScale, c: last && last.close,
      h: last && last.high, l: last && last.low };
  });
  ok(btc.auto === true, `BTC: autoScale=${btc.auto} (fiyat ${btc.c})`);
  ok(btc.c > 5000, `BTC fiyat olcegi buyuk: ${btc.c}`);

  // fiyat eksenini elle sabitle (autoscale kapat) — TV senaryosu
  await ev(() => { window.velaChart.chart.priceScale('right').applyOptions({ autoScale: false }); });
  const before = await ev(() => window.velaChart.chart.priceScale('right').options().autoScale);
  ok(before === false, 'once fiyat ekseni ELLE sabitlendi (autoScale=false)');

  await ev(() => window.velaChart.pickSymbol('BIST:THYAO'));
  await wait(5000);
  const thy = await ev(() => {
    const V = window.velaChart;
    return { sym: V.state.symbol, auto: V.chart.priceScale('right').options().autoScale,
      c: V.main.data().slice(-1)[0].close };
  });
  ok(thy.sym === 'BIST:THYAO', `sembol degisti: ${thy.sym}`);
  ok(thy.auto === true, `sembol degisince autoScale YENIDEN ACILDI (${thy.auto})`);
  ok(thy.c < 5000, `THYAO fiyat olcegi kucuk (eksen uyum sagladi): ${thy.c}`);

  console.log('\n== g4) Alt+R = grafigi sifirla ==');
  // once boz: yakilastir + araligi degistir
  await ev(() => { const V = window.velaChart; V.state.range = '1M';
    document.querySelectorAll('.rbtn').forEach(b => b.classList.toggle('on', b.dataset.r === '1M')); V.applyRange(); });
  await wait(900);
  await ev(() => { for (let i = 0; i < 12; i++) {
    const c = document.querySelector('#chart canvas'); const r = c.getBoundingClientRect();
    c.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, clientX: r.left + r.width/2, clientY: r.top + r.height/2, bubbles: true, cancelable: true })); } });
  await wait(1200);
  const dirty = await ev(() => ({ range: window.velaChart.state.range,
    spacing: window.velaChart.chart.timeScale().options().barSpacing }));
  ok(dirty.range === '1M' && dirty.spacing > 9, `once bozuldu: range=${dirty.range} barSpacing=${dirty.spacing}`);

  await page.keyboard.down('Alt'); await page.keyboard.press('KeyR'); await page.keyboard.up('Alt');
  await wait(1500);
  const reset = await ev(() => {
    const V = window.velaChart;
    return { range: V.state.range, auto: V.chart.priceScale('right').options().autoScale,
      spacing: V.chart.timeScale().options().barSpacing,
      on: Array.from(document.querySelectorAll('.rbtn.on')).map(b => b.dataset.r),
      toast: (document.querySelector('#toast') || {}).textContent || '' };
  });
  ok(reset.range === DEF && reset.on.includes(DEF), `Alt+R aralik varsayilana dondu: ${reset.range} (beklenen ${DEF}, aktif ${JSON.stringify(reset.on)})`);
  ok(reset.auto === true, `Alt+R sonrasi autoScale acik (${reset.auto})`);
  ok(reset.spacing < dirty.spacing / 2, `barSpacing normale dondu: ${reset.spacing.toFixed(1)} (bozukken ${dirty.spacing.toFixed(1)})`);
  ok(/Alt\+R|sıfırlandı/.test(reset.toast), `kullaniciya bildirildi: "${reset.toast.trim()}"`);

  // Alt+R hala dikdortgen aracini bozmuyor mu? Shift+Alt+R dikdortgen olmali
  await page.keyboard.down('Shift'); await page.keyboard.down('Alt'); await page.keyboard.press('KeyR');
  await page.keyboard.up('Alt'); await page.keyboard.up('Shift');
  await wait(700);
  const t2 = await ev(() => (window.velaChart.getTool ? window.velaChart.getTool() : 'n/a'));
  ok(t2 === 'rect' || t2 === 'n/a', `Alt+Shift+R = dikdortgen (${t2})`);
  await page.keyboard.press('Escape');

  console.log('\n== H) JS hatasi ==');
  ok(errs.length === 0, `konsol hatasi: ${errs.length}${errs.length ? ' -> ' + errs.slice(0, 3).join(' | ') : ''}`);
  console.log(`\nSONUC: ${pass} gecti, ${fail} kaldi`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST HATASI:', e.message); process.exit(2); });
