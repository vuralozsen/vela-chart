
/* TANI: canli akista mum neden ilerlemiyor? sunucu vs grafik karsilastirmasi */
const puppeteer = require('/tmp/vela-test/node_modules/puppeteer');
const CHROME = '/opt/data/.pw-browsers/chromium-1208/chrome-linux64/chrome';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';
(async()=>{
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',protocolTimeout:600000,
    args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
  const p=await b.newPage(); await p.setViewport({width:1600,height:900});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL,{waitUntil:'networkidle2'}); await new Promise(r=>setTimeout(r,2500));
  await p.evaluate(()=>window.velaChart.pickSymbol('BINANCE:BTCUSDT'));
  await p.evaluate(()=>window.velaChart.setInt('1m'));
  await new Promise(r=>setTimeout(r,6000));   // TAM yukleme, sentetik mum YOK
  const T=3*3600;
  const snap=async lbl=>{
    const s=await p.evaluate(async(T)=>{ const V=window.velaChart,B=V.state.bars,L=B[B.length-1];
      const r=await fetch('/api/bars?symbol=BINANCE%3ABTCUSDT&tf=1&n=20&adj=splits&fresh=1');
      const j=await r.json(); const S=j.bars[j.bars.length-1];
      return {grafik:L.time, srv:S.time, grafikC:L.close, srvC:S.close,
        seri:V.main.data().slice(-1)[0].time-T, n:B.length, iv:V.state.interval,
        spy:document.getElementById('symprice')?document.getElementById('symprice').textContent:''}; }, T);
    console.log(`  ${lbl} | grafik=${new Date(s.grafik*1000).toISOString().slice(11,16)} srv=${new Date(s.srv*1000).toISOString().slice(11,16)} | fark=${s.srv-s.grafik}s | n=${s.n} | fiyat grafik=${s.grafikC} srv=${s.srvC}`);
    return s; };
  let prev=null;
  for(let i=0;i<7;i++){
    const s=await snap(`t+${i*20}s`);
    if(prev && s.grafik!==prev.grafik) console.log(`     ^^ GRAFIK MUMU ILERLEDI ${prev.grafik} -> ${s.grafik}`);
    if(i===3){ const d=await p.evaluate(()=>window.velaChart.loadBars(true,true,true)); console.log(`     (uzlastirma cagrildi -> ${d})`); }
    prev=s; await new Promise(r=>setTimeout(r,20000));
  }
  console.log('  JS hata:', errs.length, errs.slice(0,2).join(' | '));
  await b.close();
})().catch(e=>{console.error('COKTU',e.message);process.exit(2);});
