
/* v3 TESTI: tema + coklu liste + sidebar + JS hata */
const puppeteer = require('/tmp/vela-test/node_modules/puppeteer');
const CHROME = '/opt/data/.pw-browsers/chromium-1208/chrome-linux64/chrome';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';
let ok=0, bad=0;
const t=(n,c,x)=>{ if(c){ok++;console.log('  OK  '+n+(x?'  ['+x+']':''));} else {bad++;console.log('  X   '+n+(x?'  ['+x+']':''));} };
(async()=>{
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',protocolTimeout:600000,
    args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
  const p=await b.newPage(); await p.setViewport({width:1600,height:900});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL,{waitUntil:'networkidle2'}); await new Promise(r=>setTimeout(r,2500));
  const g=f=>p.evaluate(f);

  console.log('--- 1) TEMA ---');
  t('tema dugmesi var', await g(()=>!!document.getElementById('themebtn')));
  t('tema koyu baslangic', (await g(()=>window.velaChart.theme()))==='dark');
  await g(()=>window.velaChart.setTheme('light'));
  await new Promise(r=>setTimeout(r,600));
  t('acik temaya gecti', (await g(()=>window.velaChart.theme()))==='light');
  const bgLight = await g(()=>getComputedStyle(document.body).backgroundColor+'|'+document.documentElement.getAttribute('data-theme'));
  t('CSS acik tema uygulandi', bgLight.includes('light'), bgLight);
  await g(()=>window.velaChart.setTheme('dark')); await new Promise(r=>setTimeout(r,400));
  t('koyu temaya dondu', (await g(()=>window.velaChart.theme()))==='dark');

  console.log('--- 2) COKLU IZLEME LISTESI ---');
  const n0 = await g(()=>window.velaChart.listNames());
  t('liste altyapisi var', Array.isArray(n0)&&n0.length>=1, JSON.stringify(n0));
  const created = await g(()=>window.velaChart.createList('Test Listesi'));
  await new Promise(r=>setTimeout(r,400));
  const n1 = await g(()=>window.velaChart.listNames());
  t('yeni liste olustu', n1.includes('Test Listesi'), JSON.stringify(n1));
  await g(()=>window.velaChart.addToList('BIST:EREGL'));
  await new Promise(r=>setTimeout(r,300));
  t('listeye sembol eklendi', (await g(()=>window.velaChart.listItems())).includes('BIST:EREGL'));
  await g(()=>window.velaChart.switchList(0)); await new Promise(r=>setTimeout(r,400));
  t('liste degistirilebiliyor', (await g(()=>window.velaChart.listIdx()))===0);
  t('liste cubugu ekranda', (await g(()=>document.querySelector('#listsel .lnm').textContent.trim()))===n1[0]);
  const ddRows = await g(()=>{ document.getElementById('listsel').click(); return document.querySelectorAll('#listdd .row').length; });
  t('liste menusu aciliyor', ddRows>=2, ddRows+' satir');
  await g(()=>document.body.click()); await new Promise(r=>setTimeout(r,200));

  console.log('--- 3) SIDEBAR (TV tarzi) ---');
  const wasOpen = await g(()=>!document.getElementById('watchpanel').classList.contains('hide'));
  t('panel acik basladi', wasOpen);
  const hasTrans = await g(()=>getComputedStyle(document.getElementById('watchpanel')).transitionDuration);
  t('yumusak gecis tanimli', hasTrans && hasTrans!=='0s', hasTrans);
  await g(()=>document.getElementById('wptoggle').click());
  await new Promise(r=>setTimeout(r,400));
  const w1 = await g(()=>document.getElementById('watchpanel').getBoundingClientRect().width);
  t('panel kapandi (genislik 0)', w1<2, w1+'px');
  await g(()=>document.getElementById('wptoggle').click());
  await new Promise(r=>setTimeout(r,450));
  const w2 = await g(()=>document.getElementById('watchpanel').getBoundingClientRect().width);
  t('panel geri acildi', w2>250, w2+'px');
  const chartW = await g(()=>document.getElementById('chart').getBoundingClientRect().width);
  t('grafik yeniden olceklendi', chartW>600, chartW+'px');

  console.log('--- 4) IC/ DISA AKTAR + OZEL GOS ---');
  t('IO modali var', await g(()=>!!document.getElementById('ioModal')));
  t('ozel gosterge modali var', await g(()=>!!document.getElementById('ciModal')));
  const ev = await g(()=>window.velaChart.evaluateFormula('sma(close,20)'));
  t('formul motoru calisiyor', Array.isArray(ev)&&ev.length>0&&ev[0].count>0, JSON.stringify(ev).slice(0,90));

  console.log('--- JS HATA ---');
  t('JS hatasi yok', errs.length===0, errs.slice(0,2).join(' | '));
  console.log(`\nSONUC: ${ok} gecti, ${bad} kirmizi`);
  await b.close(); process.exit(bad?1:0);
})().catch(e=>{console.error('COKTU',e.message);process.exit(2);});
