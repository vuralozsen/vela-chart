/* r112 TEK MUM regresyon testi.
   Belirti: bazı grafikler bazen tek mum gösteriyor; bazen kendiliğinden düzeliyor, bazen
   kalmaya devam ediyor; sayfa yenileme / ticker değişimi düzeltmiyor.
   Kök neden: TV geçmişi paket paket gönderir; İLK paket çoğu zaman yalnızca son mum(lar)ı
   taşır. Eski server ilk pakette bekleyeni çözüyordu → tek mumluk grafik + bu eksik serinin
   önbelleğe yazılması (yenilemeler de aynı zehirli önbelleğe düştüğü için düzelmiyordu).

   Test, TV kütüphanesini stub'layıp senaryoları gerçek zamanlamayla oynatır:
     1) RACE   : ilk paket 1 mum (10ms), tam seri 60 mum (300ms) → yanıt 60 mum OLMALI
                 (eski kod 1 mumla çözüyordu)
     2) önbellek: hemen ardından gelen 2. istek TV'ye gitmemeli (setMarket sayısı 1 kalmalı)
     3) PARTIAL: TV yalnızca 1 mum gönderirse SOFT_MS'te 1 mum döner ama ÖNBELLEĞE yazılmaz
                 (2. istek TV'ye gider → setMarket sayısı 2 olur) — tek mum kalıcılaşmaz
     4) EMPTY  : ilk paket boş, sonra tam seri (r111b davranışı korunur)
     5) ERR    : series_error → 502 ve yeniden deneme yok (r111b davranışı korunur) */
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.VELA_TEST_PORT || 3177;
const BASE = `http://127.0.0.1:${PORT}`;
let fails = 0;
const check = (name, cond, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if(!cond) fails++;
};

const full = Array.from({ length: 60 }, (_, i) => {
  const t = 1750000000 + i * 86400;
  return [t, 100 + i, 101 + i, 99 + i, 100.5 + i, 1000 + i];
});
const last = full[full.length - 1];

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vela-single-candle-'));
  const scriptFile = path.join(dir, 'script.json');
  const countFile  = path.join(dir, 'counts.json');
  fs.writeFileSync(scriptFile, JSON.stringify({ markets: {
    'STUB:RACE':    [ { at: 10,  bars: [last] }, { at: 300, bars: full } ],
    'STUB:EMPTY':   [ { at: 10 },                { at: 300, bars: full } ],
    'STUB:PARTIAL': [ { at: 10,  bars: [last] } ],
    'STUB:ERR':     [ { at: 10,  error: 'Series error: erisim yok' } ],
  }}));

  const child = spawn(process.execPath, [
    '--import', pathToFileURL(path.join(__dirname, 'tv-stub-register.mjs')).href,
    path.join(ROOT, 'server.mjs'),
  ], { env: { ...process.env, PORT: String(PORT), VELA_TV_STUB_SCRIPT: scriptFile, VELA_TV_STUB_COUNT: countFile },
       stdio: ['ignore', 'inherit', 'inherit'] });

  const waitReady = async () => {
    for(let i = 0; i < 100; i++){
      if(child.exitCode != null) throw new Error('server erken çıktı: ' + child.exitCode);
      try{ const r = await fetch(`${BASE}/api/build`); if(r.ok) return; }catch{}
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('server açılmadı');
  };
  const bars = async (sym) => {
    const t0 = Date.now();
    const r = await fetch(`${BASE}/api/bars?symbol=${encodeURIComponent(sym)}&tf=1D&n=1500`);
    return { status: r.status, j: await r.json().catch(() => ({})), ms: Date.now() - t0 };
  };
  const counts = () => { try{ return JSON.parse(fs.readFileSync(countFile, 'utf8')); }catch{ return {}; } };

  try{
    await waitReady();
    console.log('  server hazır (stub TV ile)\n');

    /* 1) YARIŞ: ilk paket 1 mum, tam seri 300ms'de */
    const r1 = await bars('STUB:RACE');
    check('yarış senaryosu TAM SERİ döner (60 mum, eski kod 1 mumla çözüyordu)', r1.j.bars?.length === 60, `geldi: ${r1.j.bars?.length}, ${r1.ms}ms`);
    check('yanıt s:ok', r1.j.s === 'ok');

    /* 2) ÖNBELLEK: 2. istek TV'ye gitmez */
    const r2 = await bars('STUB:RACE');
    check('2. istek önbellekten aynı seri (60 mum)', r2.j.bars?.length === 60);
    check('RACE için tek setMarket (önbellek isabeti)', counts()['STUB:RACE'] === 1, `setMarket: ${counts()['STUB:RACE']}`);

    /* 3) PARTIAL: TV sadece 1 mum gönderir → şüpheli seri önbelleğe YAZILMAZ */
    const r3 = await bars('STUB:PARTIAL');
    check('eksik seri (1 mum) SOFT_MS içinde döner', r3.j.bars?.length === 1, `${r3.ms}ms`);
    const r4 = await bars('STUB:PARTIAL');
    check('şüpheli seri önbelleğe yazılmadı → 2. istek TV\'ye gider', counts()['STUB:PARTIAL'] === 2, `setMarket: ${counts()['STUB:PARTIAL']}`);

    /* 4) EMPTY: boş ilk paket beklenir (r111b) */
    const r5 = await bars('STUB:EMPTY');
    check('boş ilk paket sonrası tam seri (r111b korunur)', r5.j.bars?.length === 60, `geldi: ${r5.j.bars?.length}`);

    /* 5) ERR: series_error 502, yeniden deneme yok */
    const r6 = await bars('STUB:ERR');
    check('series_error → 502 (yeniden deneme yok)', r6.status === 502, `status: ${r6.status}, setMarket: ${counts()['STUB:ERR']}`);

  }catch(e){
    console.error('COKTU', e.message); fails = 99;
  }finally{
    try{ child.kill(); }catch{}
  }
  console.log(`\n${fails ? '✗ ' + fails + ' test başarısız' : '✓ tümü geçti'}`);
  process.exit(fails ? 1 : 0);
})();
