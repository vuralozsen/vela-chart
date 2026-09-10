/* Vela Chart — v3 + TV-parite arayüz testi (gerçek Chrome) */
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

  let pass = 0, fail = 0;
  const ok = (c, m) => { console.log((c ? '  \u2713 ' : '  \u2717 ') + m); c ? pass++ : fail++; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const ev = (fn, ...a) => page.evaluate(fn, ...a);

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(4000);

  console.log('\n== A) v3 ozellikleri ==');
  const v3 = await ev(() => ({
    theme: !!document.getElementById('themebtn'),
    listmenu: !!document.getElementById('listmenu'),
    listsel: !!document.getElementById('listsel'),
    ioModal: !!document.getElementById('ioModal'),
    ciModal: !!document.getElementById('ciModal'),
    wlist: !!document.getElementById('wlist'),
    rows: document.querySelectorAll('#wlist .wrow').length }));
  ok(v3.theme, 'tema altyapisi (data-theme)');
  ok(v3.listmenu && v3.listsel, 'coklu izleme listesi menusu');
  ok(v3.ioModal, 'ice/disa aktarma modali');
  ok(v3.ciModal, 'ozel gosterge modali');
  ok(v3.rows > 0, `izleme listesi satiri: ${v3.rows}`);

  // tema gecisi (isik grafigi)
  await ev(() => document.getElementById('themebtn').click());
  await wait(1200);
  const th1 = await ev(() => ({ attr: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor }));
  ok(th1.attr === 'light', `isik temasina gecildi: data-theme=${th1.attr}`);
  await ev(() => document.getElementById('themebtn').click());
  await wait(1200);
  const th2 = await ev(() => document.documentElement.getAttribute('data-theme'));
  ok(th2 === 'dark', `koyu temaya donuldu: ${th2}`);

  console.log('\n== B) zaman dilimi favorileri ==');
  const fav0 = await ev(() => Array.from(document.querySelectorAll('#favtf .tfbtn')).map(b=>b.textContent));
  ok(fav0.length >= 3, `favori seridi: ${JSON.stringify(fav0)}`);
  await page.click('#intbtn').catch(()=>{});
  await wait(400);
  const stars = await ev(() => ({
    open: !!document.querySelector('#intdd.open'),
    starCount: document.querySelectorAll('#intdd .star').length,
    onCount: document.querySelectorAll('#intdd .star.on').length }));
  ok(stars.open, 'zaman dilimi menusu acildi');
  ok(stars.starCount === 20 || stars.starCount > 5, `yildiz sayisi: ${stars.starCount}`);
  ok(stars.onCount >= 3, `isaretli favori: ${stars.onCount}`);

  // favori ekle (30m)
  await ev(() => { const s=document.querySelector('#intdd .star[data-star="30m"]'); if(s) s.click(); });
  await wait(500);
  const fav1 = await ev(() => Array.from(document.querySelectorAll('#favtf .tfbtn')).map(b=>b.textContent));
  ok(fav1.includes('30m'), `30m favoriye eklendi: ${JSON.stringify(fav1)}`);
  // favoriden cikar
  await ev(() => { const s=document.querySelector('#intdd .star[data-star="30m"]'); if(s) s.click(); });
  await wait(400);
  const fav2 = await ev(() => Array.from(document.querySelectorAll('#favtf .tfbtn')).map(b=>b.textContent));
  ok(!fav2.includes('30m'), `30m favoriden cikti: ${JSON.stringify(fav2)}`);
  // periyot secimi
  await ev(() => { document.querySelector('#intbtn').click(); });
  await wait(400);
  await ev(() => { document.querySelector('#intdd .row[data-int="15m"] .tf').click(); });
  await wait(2500);
  const ivOK = await ev(() => window.velaChart.state.interval);
  ok(ivOK === '15m', `favori seridinden periyot secimi: ${ivOK}`);
  await page.keyboard.press('Escape').catch(()=>{});

  console.log('\n== C) uzatilmis seans (ETH) ==');
  const eth0 = await ev(() => ({ exists: !!document.getElementById('ethbtn'),
    on: document.getElementById('ethbtn').classList.contains('on'), eth: !!window.velaChart.state.eth }));
  ok(eth0.exists, 'uzatilmis seans dugmesi var');
  ok(eth0.on === false && eth0.eth === false, 'varsayilan KAPALI');
  await ev(() => document.getElementById('ethbtn').click());
  await wait(3000);
  const eth1 = await ev(() => ({ on: document.getElementById('ethbtn').classList.contains('on'),
    eth: !!window.velaChart.state.eth, txt: document.getElementById('ethbtn').textContent }));
  ok(eth1.eth === true && eth1.on === true, `acildi: ${eth1.txt}`);
  // sunucuya session=extended gitti mi
  const ethReq = await ev(async () => {
    const r = await fetch('/api/bars?symbol=AAPL&tf=5&n=50&adj=splits&session=extended');
    const j = await r.json(); return { code: r.status, bars: (j.bars||[]).length };
  });
  ok(ethReq.code === 200 && ethReq.bars > 0, `sunucu session=extended: ${ethReq.code} / ${ethReq.bars} bar`);
  await ev(() => document.getElementById('ethbtn').click());
  await wait(2500);
  const eth2 = await ev(() => !!window.velaChart.state.eth);
  ok(eth2 === false, 'kapatinca state sifirlandi');

  console.log('\n== D) izleme listesinde % degisim ==');
  const wq = await ev(async () => {
    const syms = (window.velaChart.state.watch||[]).map(w=> typeof w === 'string' ? w : w.sym);
    const r = await fetch('/api/quotes?symbols=' + encodeURIComponent(syms.join(',')));
    const j = await r.json();
    const list = Object.values(j.quotes||{});
    const withChp = list.filter(q => q.chp != null).length;
    return { code: r.status, n: list.length, withChp, sample: list[0] || null };
  });
  ok(wq.code === 200, `/api/quotes: ${wq.code}`);
  ok(wq.withChp > 0, `% degisim (chp) dolu: ${wq.withChp}/${wq.n}`);
  const domPct = await ev(() => {
    const rows = Array.from(document.querySelectorAll('#wlist .wrow'));
    return { total: rows.length,
      withPct: rows.filter(r => /%/.test(r.textContent)).length };
  });
  ok(domPct.withPct > 0, `DOM'da yuzde gosterimi: ${domPct.withPct}/${domPct.total}`);

  console.log('\n== E) MOBIL uyumluluk (390x844) ==');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await wait(2500);
  const mob = await ev(() => {
    const wp = document.getElementById('watchpanel');
    const cs = getComputedStyle(wp);
    const tb = document.getElementById('topbar');
    const db = getComputedStyle(document.getElementById('drawbar'));
    return { isFixed: cs.position === 'fixed', wpHidden: wp.classList.contains('hide'),
      wpW: wp.getBoundingClientRect().width,
      topbarScroll: getComputedStyle(tb).overflowX === 'auto',
      drawbarRow: db.flexDirection === 'row',
      overflowX: document.documentElement.scrollWidth <= window.innerWidth + 2 };
  });
  ok(mob.isFixed, 'izleme paneli mobilde sabit cekmece (position:fixed)');
  ok(mob.wpHidden, 'mobilde panel baslangicta KAPALI');
  ok(mob.wpW < 400, `cekmecе genisligi: ${Math.round(mob.wpW)}px (ekran 390)`);
  ok(mob.topbarScroll, 'ust cubuk yatay kaydirilabilir');
  ok(mob.drawbarRow, 'cizim araclari alt bara tasindi');
  ok(mob.overflowX, 'yatay tasma YOK');

  // cekmeceyi ac
  await ev(() => document.getElementById('wptoggle').click());
  await wait(900);
  const mob2 = await ev(() => ({ hidden: document.getElementById('watchpanel').classList.contains('hide'),
    bd: document.getElementById('wpbackdrop').classList.contains('on') }));
  ok(!mob2.hidden, 'cekmece acildi');
  ok(mob2.bd, 'arka plan karartmasi acildi');
  // backdrop'a tiklayinca kapanmali
  await ev(() => document.getElementById('wpbackdrop').click());
  await wait(900);
  const mob3 = await ev(() => document.getElementById('watchpanel').classList.contains('hide'));
  ok(mob3, 'arka plana tiklayinca cekmece kapandi');

  // 390px'te yatay tasma yok (kritik)
  const ow = await ev(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  ok(ow.sw <= ow.iw + 2, `yatay tasma: scrollW=${ow.sw} innerW=${ow.iw}`);

  console.log('\n== F) masaustune donus ==');
  await page.setViewport({ width: 1600, height: 900 });
  await wait(1200);
  const desk = await ev(() => ({ pos: getComputedStyle(document.getElementById('watchpanel')).position }));
  ok(desk.pos !== 'fixed', `masaustunde panel normal akis: ${desk.pos}`);

  console.log('\n== G) JS hatasi ==');
  ok(errs.length === 0, `konsol hatasi: ${errs.length}${errs.length ? ' -> ' + errs.slice(0,3).join(' | ') : ''}`);

  console.log(`\nSONUC: ${pass} gecti, ${fail} kaldi`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST HATASI:', e.message); process.exit(2); });
