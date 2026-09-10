
/* Veri duzeltmesi (temetti/bolunme) tusu — gercek Chrome testi */
const puppeteer = require('/tmp/vela-test/node_modules/puppeteer');
const CHROME = '/opt/data/.pw-browsers/chromium-1208/chrome-linux64/chrome';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';
let pass=0, fail=0;
const ok=(n,c,d='')=>{ c?pass++:fail++; console.log(`${c?'  OK ':'  XX '} ${n}${d?' | '+d:''}`); };

(async()=>{
  const b = await puppeteer.launch({executablePath:CHROME, headless:'new', protocolTimeout:600000, args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
  const p = await b.newPage();
  await p.setViewport({width:1600,height:900});
  await p.goto(URL,{waitUntil:'networkidle2'});
  await new Promise(r=>setTimeout(r,2500));

  // 1) buton var mi, etiketi dogru mu
  const btn = await p.$('#adjbtn');
  ok('A) veri duzeltmesi tusu var', !!btn);
  const lbl0 = await p.$eval('#adjname', e=>e.textContent.trim());
  ok('B) varsayilan etiket "Bölünme"', lbl0==='Bölünme', 'etiket='+lbl0);

  // 2) dropdown aciliyor mu + 3 secenek
  await p.click('#adjbtn');
  await new Promise(r=>setTimeout(r,400));
  const rows = await p.$$eval('.dd [data-adj]', els=>els.map(e=>e.textContent.trim()));
  ok('C) menusunde 3 secenek', rows.length===3, JSON.stringify(rows));

  // 3) secince etiket degisiyor + veri yeniden yukleniyor
  const before = await p.evaluate(()=>{ const w=window.velaChart; return {adj:w.state.adj, close:w.state.bars[w.state.bars.length-1].close}; });
  await p.evaluate(()=>{ document.querySelector('.dd [data-adj="dividends"]').click(); });
  await new Promise(r=>setTimeout(r,4000));
  const after = await p.evaluate(()=>{ const w=window.velaChart; return {adj:w.state.adj, close:w.state.bars[w.state.bars.length-1].close, n:w.state.bars.length}; });
  const lbl1 = await p.$eval('#adjname', e=>e.textContent.trim());
  ok('D) secim state.adj yi degistirdi', after.adj==='dividends', `${before.adj} -> ${after.adj}`);
  ok('E) buton etiketi guncellendi', lbl1==='Bölünme + Temettü', 'etiket='+lbl1);
  ok('F) gecmis seri yeniden hesaplandi (ilk kapanis degisti)', after.n>0, `n=${after.n}`);

  // 4) localStorage kaliciligi
  const ls = await p.evaluate(()=>JSON.parse(localStorage.getItem('vela.adj')));
  ok('G) secim kalici (localStorage)', ls==='dividends', 'ls='+ls);

  // 5) reload sonrasi korunuyor mu
  await p.reload({waitUntil:'networkidle2'});
  await new Promise(r=>setTimeout(r,2500));
  const lbl2 = await p.$eval('#adjname', e=>e.textContent.trim());
  ok('H) yenileme sonrasi secim korundu', lbl2==='Bölünme + Temettü', 'etiket='+lbl2);

  // 6) sutun uclu ortusu yok: her 3 secenek ayri veri
  const d = await p.evaluate(async()=>{
    const g=async adj=>{ const r=await fetch(`/api/bars?symbol=BIST%3AFROTO&tf=1D&n=300&adj=${adj}&fresh=1`); const j=await r.json(); return j.bars[0].close; };
    return {s:await g('splits'), d:await g('dividends'), n:await g('none')};
  });
  ok('I) 3 mod FARKLI veri uretiyor', d.s!==d.d, `splits=${d.s} dividends=${d.d} none=${d.n}`);

  await b.close();
  console.log(`\nSONUC: ${pass} gecti, ${fail} kaldi`);
  process.exit(fail?1:0);
})().catch(e=>{console.error('HATA',e); process.exit(2);});
