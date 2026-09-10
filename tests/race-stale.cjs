
/* YARIS DURUMU testi: gec gelen /api/bars yaniti guncel serinin uzerine yaziyor mu?
   Senaryo: gunluk (1D) yaniti 3 sn geciktirilir, bu arada kullanici 1m'e gecer.
   Beklenen (dogru davranis): grafik 1m serisini gosterir.
   Hata: state.interval='1m' ama state.bars GUNLUK -> mumlar ilerlemez. */
const puppeteer = require('/tmp/vela-test/node_modules/puppeteer');
const CHROME = '/opt/data/.pw-browsers/chromium-1208/chrome-linux64/chrome';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';

(async()=>{
  const b = await puppeteer.launch({executablePath:CHROME, headless:'new', protocolTimeout:600000,
    args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
  const p = await b.newPage();
  await p.setViewport({width:1600,height:900});
  await p.setRequestInterception(true);
  let delayed = 0;
  p.on('request', async req=>{
    const u = req.url();
    if(u.includes('/api/bars') && u.includes('tf=1D')){
      delayed++;
      await new Promise(r=>setTimeout(r,3000));   // gunluk yaniti GECIKTIR
      return req.continue();
    }
    req.continue();
  });
  await p.goto(URL,{waitUntil:'networkidle2'});
  await new Promise(r=>setTimeout(r,2500));

  // Sembol degistir (1D istegi gecikecek) + hemen 1m'e gec
  await p.evaluate(()=>window.velaChart.pickSymbol('BINANCE:BTCUSDT'));
  await new Promise(r=>setTimeout(r,150));
  await p.evaluate(()=>window.velaChart.setInt('1m'));
  await new Promise(r=>setTimeout(r,9000));       // gecikmis yanit da gelsin

  const s = await p.evaluate(()=>{ const V=window.velaChart, B=V.state.bars, L=B[B.length-1];
    const now=Math.floor(Date.now()/1000);
    return {iv:V.state.interval, sym:V.state.symbol, n:B.length, age:now-L.time,
      barIso:new Date(L.time*1000).toISOString().slice(0,16),
      seriIso:new Date((V.main.data().slice(-1)[0].time-3*3600)*1000).toISOString().slice(0,16)}; });
  console.log(`  geciktirilen 1D istegi: ${delayed}`);
  console.log(`  durum: interval=${s.iv} symbol=${s.sym} n=${s.n}`);
  console.log(`  son bar: ${s.barIso}Z  (${s.age} sn geride)   grafik serisi: ${s.seriIso}`);
  const okFresh = s.age < 600;
  console.log(`\n  ${okFresh?'✓':'✗'} GRAFIK SERISI GUNCEL (yas < 10 dk)  → yas=${s.age} sn`);
  console.log(`  ${okFresh?'✓':'✗'} periyot ile seri TUTARLI (1m secili ama seri gunluk mu?)`);
  await b.close();
  process.exit(okFresh?0:1);
})().catch(e=>{console.error('COKTU',e.message);process.exit(2);});
