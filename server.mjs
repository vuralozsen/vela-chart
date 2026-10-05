// Vela Chart — TradingView veri köprüsü
// REST: /api/bars?symbol=BIST:THYAO&tf=1D&n=300          → OHLCV (30sn cache, in-flight dedupe)
//       /api/bars?...&fresh=1                             → cache'i ATLA (canlı uzlaştırma tazelemesi)
//       /api/bars?...&adj=dividends                        → veri düzeltmesi: splits|dividends|none
//       /api/search?query=thyao                          → sembol arama (TV global search + lokal fallback)
//       /api/quotes?symbols=A,B,C                        → toplu snapshot quote (watchlist ilk yükleme)
// WS  : /ws/quote?symbols=A,B,C                          → canlı fiyat relay
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import TradingView from '@mathieuc/tradingview';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3010;

const app = express();
app.use(express.json({ limit: '3mb' }));
/* Statik dosyalar önbelleğe alınmasın: kod güncellemesi (deploy) anında görünsün.
   Aksi halde tarayıcı eski index.html'i önbellekten çalıştırıp "düzeltme gelmedi" sanılıyor. */
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false, lastModified: false,
  setHeaders: (res) => { res.setHeader('Cache-Control', 'no-store, must-revalidate'); },
}));

/* ================= BASİT HESAP + SENKRON =================
   users  : { ad: { salt, hash } }            (scrypt)
   sessions: { token: ad }                    (kalıcı)
   state  : { ad: { "vela.lists": "...", ... } }  (uygulama ayarları + listeler + çizimler)
   Depo: data/vela-store.json  (docker'da named volume ile kalıcı) */
const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'vela-store.json');
let store = { users:{}, sessions:{}, state:{} };
try{ const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); if(raw && typeof raw==='object') store = { users:raw.users||{}, sessions:raw.sessions||{}, state:raw.state||{} }; }catch{}
let storeTimer=null;
function saveStore(){
  clearTimeout(storeTimer);
  storeTimer = setTimeout(()=>{
    try{ fs.mkdirSync(DATA_DIR,{recursive:true}); fs.writeFileSync(STORE_FILE, JSON.stringify(store)); }
    catch(e){ console.warn('store yazilamadi:', e.message); }
  }, 400);
}
const hashPass = (pass, salt) => crypto.scryptSync(String(pass), salt, 32).toString('hex');
const newToken = () => crypto.randomBytes(24).toString('hex');
function requireAuth(req,res,next){
  const t = String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  const u = t && store.sessions[t];
  if(!u || !store.users[u]) return res.status(401).json({ error:'yetkisiz' });
  req.user = u; req.token = t; next();
}
const okUser = n => /^[a-zA-Z0-9._-]{3,24}$/.test(String(n||''));

/* ---------- sürüm damgası (/api/build) ----------
   index.html'deki VELA_BUILD başta bir kez okunur; istemci periyodik kontrol edip
   yeni sürüm görünce kendini yeniler (mobil/PWA'da eski sürüm kilitlenmesinin çözümü). */
const VELA_BUILD = (()=>{ try{
  const m = fs.readFileSync(path.join(__dirname,'public','index.html'),'utf8').match(/VELA_BUILD\s*=\s*'([^']+)'/);
  return m ? m[1] : 'bilinmiyor';
}catch{ return 'bilinmiyor'; } })();

app.get('/api/build', (req,res)=>{ res.set('Cache-Control','no-store'); res.json({ build: VELA_BUILD }); });

app.post('/api/auth/register', (req,res)=>{
  const u = String((req.body&&req.body.user)||'').trim().toLowerCase();
  const p = String((req.body&&req.body.pass)||'');
  if(!okUser(u)) return res.status(400).json({ error:'Kullanıcı adı 3-24 karakter, harf/rakam/._-' });
  if(p.length < 4) return res.status(400).json({ error:'Şifre en az 4 karakter' });
  if(store.users[u]) return res.status(409).json({ error:'Bu kullanıcı adı alınmış' });
  const salt = crypto.randomBytes(16).toString('hex');
  store.users[u] = { salt, hash: hashPass(p, salt), created: Date.now() };
  const token = newToken(); store.sessions[token] = u;
  store.state[u] = store.state[u] || {};
  saveStore();
  res.json({ ok:true, user:u, token });
});
app.post('/api/auth/login', (req,res)=>{
  const u = String((req.body&&req.body.user)||'').trim().toLowerCase();
  const p = String((req.body&&req.body.pass)||'');
  const rec = store.users[u];
  if(!rec || hashPass(p, rec.salt) !== rec.hash) return res.status(401).json({ error:'Kullanıcı adı veya şifre hatalı' });
  const token = newToken(); store.sessions[token] = u; saveStore();
  res.json({ ok:true, user:u, token });
});
app.get('/api/auth/me', requireAuth, (req,res)=> res.json({ ok:true, user:req.user, hasState: !!(store.state[req.user] && Object.keys(store.state[req.user]).length) }));
app.post('/api/auth/logout', requireAuth, (req,res)=>{ delete store.sessions[req.token]; saveStore(); res.json({ ok:true }); });
/* şifre değiştirme: oturum açıkken, mevcut şifre doğrulanarak */
app.post('/api/auth/change', requireAuth, (req,res)=>{
  const oldP = String((req.body&&req.body.old)||'');
  const newP = String((req.body&&req.body.np)||'');
  const rec = store.users[req.user];
  if(!rec || hashPass(oldP, rec.salt) !== rec.hash) return res.status(400).json({ error:'Mevcut şifre hatalı' });
  if(newP.length < 4) return res.status(400).json({ error:'Yeni şifre en az 4 karakter' });
  const salt = crypto.randomBytes(16).toString('hex');
  store.users[req.user] = { ...rec, salt, hash: hashPass(newP, salt) };
  saveStore();
  res.json({ ok:true });
});

app.get('/api/state', requireAuth, (req,res)=>{
  const st = store.state[req.user] || {};
  const { _rev, ...data } = st;                       /* rev zarfta döner, data temiz kalır */
  res.json({ ok:true, data, rev: _rev || null });
});
app.put('/api/state', requireAuth, (req,res)=>{
  const d = req.body && req.body.data;
  if(!d || typeof d !== 'object' || Array.isArray(d)) return res.status(400).json({ error:'geçersiz veri' });
  /* yalnız vela.* anahtarları, en fazla 2MB */
  const clean = {}; let n=0;
  Object.keys(d).forEach(k=>{ if(!/^vela\./.test(k)) return; const v=String(d[k]); n+=v.length; if(n>2_000_000) return; clean[k]=v; });
  /* vela._gen: dış araç (tools/sync-watchlists.mjs) hesabı elle yazarken nesli yükseltir.
     İstemcinin göndermediği push'larda mevcut nesil KORUNUR — böylece bayat sekme eski veriyi
     geri yazsa bile nesil değişmez ve o sekme açılışta sunucudan çeker (index.html r104). */
  const prevGen = store.state[req.user] && store.state[req.user]['vela._gen'];
  if (d['vela._gen'] != null) clean['vela._gen'] = String(d['vela._gen']);
  else if (prevGen != null) clean['vela._gen'] = prevGen;
  /* _rev: HER yazımda artan revizyon — cihazlar arasında anlık iki yönlü senkron için (r108).
     Yoklama: istemci rev'i değişince sunucuyu çeker; kendi push'unun rev'ini saymaz. */
  clean._rev = String(Date.now());
  store.state[req.user] = clean;
  saveStore();
  res.json({ ok:true, keys:Object.keys(clean).length-1, bytes:n, rev:clean._rev });
});
/* Bilinmeyen GET yolları (ör. /goal) uygulamaya düşsün — Express'in 'Cannot GET /x'
   404 sayfası yerine tek sayfalık uygulama açılır. API/WS yolları etkilenmez. */
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/ws/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- bars cache ----------
const barsCache = new Map();   // key → { at, bars }
const inflight = new Map();    // key → Promise
const BARS_TTL = 30_000;
const N_TTL    = 120_000;      // uzun geçmiş daha yavaş bayatlansın

const barsKey = (symbol, tf, n, adj, ses) => `${symbol}|${tf}|${n}|${adj || 'splits'}|${ses}`;

/* ---------- r111: PAYLAŞILAN TV İSTEMCİSİ ----------
   Eskiden HER istek (bars/quotes/WS/uzlaştırma) kendi TradingView.Client'ini — yani kendi
   WebSocket'ini — açıyordu; istemci her 15-30 sn'de fresh uzlaştırma + 60 sn'de quotes
   yaptığı için TV tarafında kota kısıtlaması oluşuyor, soğuk istekler 20 sn+ asılı
   kalıyordu (kullanıcı: "ticker tıklıyorum 1-2 dk sonra ya geliyor ya gelmiyor").
   Artık TEK kalıcı istemci (tek socket) üzerinde oturum açılıp kapatılır. */
let tvClient = null;
function getSharedTV(){
  if(!tvClient){
    tvClient = new TradingView.Client();
    tvClient.onDisconnected(() => { tvClient = null; barChart = null; });
  }
  return tvClient;
}

/* bars: TEK kalıcı Chart oturumu + seri kuyruk — aynı anda tek istek setMarket alır,
   onUpdate tek bekleyeni çözümler. Hata/zaman aşımında chart oturumu atılır (istemci kalır). */
let barChart = null, tvBarPending = null, tvBarChain = Promise.resolve();
function getBarChart(){
  if(!barChart){
    barChart = new (getSharedTV()).Session.Chart();
    barChart.onUpdate(() => {
      const P = tvBarPending; if(!P) return; tvBarPending = null; clearTimeout(P.timer);
      const out = (barChart.periods || []).map(p => ({
        time: p.time, open: p.open, high: p.max, low: p.min, close: p.close, volume: p.volume ?? 0,
      })).sort((a, b) => a.time - b.time);
      if(out.length) P.resolve(out); else P.reject(new Error('tv bos dondu'));
    });
    barChart.onError((...e) => {
      const P = tvBarPending; if(!P) return; tvBarPending = null; clearTimeout(P.timer);
      try{ barChart.delete(); }catch(_){} barChart = null;
      P.reject(new Error(e.join(' ') || 'tv hata'));
    });
  }
  return barChart;
}
function tvFetchOnce(symbol, tf, n, adj, ses){
  return new Promise((resolve, reject) => {
    let ch;
    try{ ch = getBarChart(); }catch(e){ reject(e); return; }
    const P = { resolve, reject, timer: null };
    P.timer = setTimeout(() => {
      if(tvBarPending !== P) return; tvBarPending = null;
      try{ ch.delete(); }catch(_){} barChart = null;   // kararsız durum → oturumu at, istemci kalsın
      reject(new Error('timeout'));
    }, 10000);
    tvBarPending = P;
    try{ ch.setMarket(symbol, { timeframe: tf, range: n, adjustment: adj || 'splits', session: ses }); }
    catch(e){ clearTimeout(P.timer); tvBarPending = null; reject(e); }
  });
}

function fetchBars(symbol, tf, n, fresh, adj, session) {
  const ses = session === 'extended' ? 'extended' : 'regular';
  const key = barsKey(symbol, tf, n, adj, ses);
  const ttl = n > 400 ? N_TTL : BARS_TTL;
  const hit = barsCache.get(key);
  const age = hit ? Date.now() - hit.at : Infinity;
  if (!fresh && hit) {
    if (age < ttl) return Promise.resolve(hit.bars);
    /* BAYAT AMA KULLANILABİLİR: hemen dön, arkada tazele. Sembol/periyot geçişlerinde
       TV turu (~0.3–1s) beklenmesin; geri dönüşler anında olsun. */
    if (age < 15 * 60_000) {
      if (!inflight.has(key)) fetchBars(symbol, tf, n, true, adj, session).catch(() => {});
      return Promise.resolve(hit.bars);
    }
  }
  if (inflight.has(key)) return inflight.get(key);
  /* r111: paylaşılan chart oturumu tek seferde tek pazar çeker → istekler kuyruğa girer */
  const p = tvBarChain.then(() => tvFetchOnce(symbol, tf, n, adj, ses));
  tvBarChain = p.catch(() => {});
  inflight.set(key, p);
  p.then(bars => { barsCache.set(key, { at: Date.now(), bars }); })
   .catch(() => {}).finally(() => { if (inflight.get(key) === p) inflight.delete(key); });
  return p;
}

app.get('/api/bars', async (req, res) => {
  const symbol = String(req.query.symbol || 'BIST:XU100');
  const tf = String(req.query.tf || '1D');
  const n = Math.min(Number(req.query.n || 300), 2000);
  const fresh = String(req.query.fresh || '') === '1';
  /* veri duzeltmesi: splits (bolunme) | dividends (bolunme+temettu) | none */
  const adj = ['splits', 'dividends', 'none'].includes(String(req.query.adj)) ? String(req.query.adj) : 'splits';
  /* uzatilmis seans: regular (varsayilan) | extended */
  const session = String(req.query.session || '') === 'extended' ? 'extended' : 'regular';
  try {
    const bars = await fetchBars(symbol, tf, n, fresh, adj, session);
    res.json({ symbol, tf, session, bars, s: 'ok' });
  } catch (e) {
    /* r111: TV kısıtlaması/zaman aşımı — önbellekte bayat da olsa veri varsa onu dön;
       "ya gelmiyor" yerine grafik eski veriyle açılır (arkada WS canlı tick zaten akar) */
    const hit = barsCache.get(barsKey(symbol, tf, n, adj, session === 'extended' ? 'extended' : 'regular'));
    if (hit) { console.warn(`bars: TV basarisiz (${e.message}) — bayat onbellek dondu ${symbol}`); return res.json({ symbol, tf, session, bars: hit.bars, s: 'stale' }); }
    res.status(502).json({ error: e.message, s: 'error' });
  }
});

// ---------- sembol arama (TV global search; hata olursa lokal fallback) ----------
const LOCAL_SYMS = [
  { symbol: 'THYAO',  full_name: 'BIST:THYAO',  description: 'Türk Hava Yolları',        exchange: 'BIST',    type: 'stock' },
  { symbol: 'ASELS',  full_name: 'BIST:ASELS',  description: 'Aselsan',                  exchange: 'BIST',    type: 'stock' },
  { symbol: 'GARAN',  full_name: 'BIST:GARAN',  description: 'Garanti BBVA',             exchange: 'BIST',    type: 'stock' },
  { symbol: 'AKBNK',  full_name: 'BIST:AKBNK',  description: 'Akbank',                   exchange: 'BIST',    type: 'stock' },
  { symbol: 'ISCTR',  full_name: 'BIST:ISCTR',  description: 'İş Bankası (C)',           exchange: 'BIST',    type: 'stock' },
  { symbol: 'BIMAS',  full_name: 'BIST:BIMAS',  description: 'BİM Mağazalar',            exchange: 'BIST',    type: 'stock' },
  { symbol: 'EREGL',  full_name: 'BIST:EREGL',  description: 'Ereğli Demir Çelik',       exchange: 'BIST',    type: 'stock' },
  { symbol: 'KOZAL',  full_name: 'BIST:KOZAL',  description: 'Koza Altın',               exchange: 'BIST',    type: 'stock' },
  { symbol: 'SASA',   full_name: 'BIST:SASA',   description: 'SASA Polyester',           exchange: 'BIST',    type: 'stock' },
  { symbol: 'TUPRS',  full_name: 'BIST:TUPRS',  description: 'Tüpraş',                   exchange: 'BIST',    type: 'stock' },
  { symbol: 'XU100',  full_name: 'BIST:XU100',  description: 'BIST 100 Endeksi',         exchange: 'BIST',    type: 'index' },
  { symbol: 'XU030',  full_name: 'BIST:XU030',  description: 'BIST 30 Endeksi',          exchange: 'BIST',    type: 'index' },
  { symbol: 'BTCUSDT', full_name: 'BINANCE:BTCUSDT', description: 'Bitcoin / TetherUS',   exchange: 'BINANCE', type: 'crypto' },
  { symbol: 'ETHUSDT', full_name: 'BINANCE:ETHUSDT', description: 'Ethereum / TetherUS',  exchange: 'BINANCE', type: 'crypto' },
  { symbol: 'SOLUSDT', full_name: 'BINANCE:SOLUSDT', description: 'Solana / TetherUS',    exchange: 'BINANCE', type: 'crypto' },
  { symbol: 'AVAXUSDT', full_name: 'BINANCE:AVAXUSDT', description: 'Avalanche / TetherUS', exchange: 'BINANCE', type: 'crypto' },
  { symbol: 'XRPUSDT', full_name: 'BINANCE:XRPUSDT', description: 'XRP / TetherUS',       exchange: 'BINANCE', type: 'crypto' },
];

app.get('/api/search', async (req, res) => {
  const q = String(req.query.query || '').trim();
  if (!q) return res.json({ symbols: [] });
  try {
    const url = `https://symbol-search.tradingview.com/symbol_search/v3/?text=${encodeURIComponent(q)}&hl=1&exchange=&lang=tr&search_type=undefined&domain=production&sort_by_country=TR&limit=30`;
    const r = await fetch(url, { headers: { 'Origin': 'https://www.tradingview.com', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error(`tvsearch ${r.status}`);
    const j = await r.json();
    const symbols = (j.symbols || j || []).slice(0, 30).map(s => {
      const strip = v => String(v ?? '').replace(/<\/?em>/g, '').trim();
      return {
        symbol: strip(s.symbol),
        full_name: strip(s.full_name) || `${strip(s.prefix || s.exchange)}:${strip(s.symbol)}`,
        description: strip(s.description).slice(0, 80),
        exchange: strip(s.exchange || s.prefix),
        type: strip(s.type),
      };
    }).filter(s => s.symbol && s.full_name);
    res.json({ symbols });
  } catch {
    const ql = q.toLocaleLowerCase('tr');
    const symbols = LOCAL_SYMS.filter(s =>
      s.symbol.toLocaleLowerCase('tr').includes(ql) ||
      s.description.toLocaleLowerCase('tr').includes(ql)).slice(0, 20);
    res.json({ symbols, fallback: true });
  }
});

// ---------- toplu snapshot quote ----------
/* Büyük izleme listeleri (yüzlerce sembol) için istek başına sınır 150; istemci parça parça ister.
   Zaman aşımı 12sn (çok sembolde TV köprüsü daha yavaş yanıt veriyor).

   ÖNBELLEK: her istek TV'de YENİ oturum açtığı için çok sekme/cihaz + büyük listeler köprüyü
   eziyordu → TV kota sınırına takılıp bazı istekler boş dönüyor ("veriler bazen görünmüyor").
   · 10 sn içinde aynı sembol kümesi → anında önbellekten
   · TV isteği başarısız olursa → varsa bayat veri dön (satırlar "—" kalmasın) */
const quotesCache = new Map();   // key → { at, quotes }
const QUOTES_TTL = 10_000;
const QUOTES_STALE_MAX = 10 * 60_000;

app.get('/api/quotes', async (req, res) => {
  const symbols = String(req.query.symbols || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 150);
  if (!symbols.length) return res.json({ quotes: {} });
  const key = symbols.join(',');
  const hit = quotesCache.get(key);
  const age = hit ? Date.now() - hit.at : Infinity;
  if (age < QUOTES_TTL) return res.json({ quotes: hit.quotes });
  try{
    const quotes = await new Promise((resolve) => {
      /* r111: paylaşılan istemci üzerinde istek başına QuoteSession (yeni socket YOK) */
      const client = getSharedTV();
      const session = new client.Session.Quote();
      const out = {}; let pending = symbols.length;
      let doneCalled = false;
      const done = () => { if(doneCalled) return; doneCalled = true; try{ session.delete(); }catch(e){} resolve(out); };
      const to = setTimeout(done, 12000);
      const markets = symbols.map(s => ({ sym: s, m: new session.Market(s) }));
      markets.forEach(({ sym, m }) => {
        m.onData(d => {
          if (d.lp || d.close || d.current_session_state) {
            /* current_session: pre_market | post_market | market | out_of_session
               rtc: normal seans kapanışı (uzatılmış seans değişimi bunun üzerinden hesaplanır)
               lp_time: son işlem zamanı  · prev_close_price: önceki kapanış
               r83: open/high/low + temel analiz alanları (sektör, mcap, F/K, HDD, temettü verimi, beta)
                    — watchlist ek kolonları ve sembil bilgi penceresi için */
            out[sym] = { lp: d.lp ?? d.close, ch: d.ch, chp: d.chp, description: d.description, exchange: d.exchange, volume: d.volume,
              rtc: d.rtc, rch: d.rch, rchp: d.rchp, lp_time: d.lp_time,
              current_session: d.current_session, prev_close_price: d.prev_close_price,
              open: d.open_price, high: d.high_price, low: d.low_price,
              bid: d.bid, ask: d.ask, currency: d.currency_code, pricescale: d.pricescale,
              sector: d.sector, industry: d.industry, market_cap: d.market_cap_basic,
              pe: d.price_earnings_ttm, eps: d.earnings_per_share_basic_ttm,
              div_yield: d.dividends_yield, beta: d.beta_1_year, type: d.type };
            if (--pending <= 0) { clearTimeout(to); done(); }
          }
        });
        m.onError((...e) => { out[sym] = { error: e.join(' ') }; if (--pending <= 0) { clearTimeout(to); done(); } });
      });
    });
    const dolu = Object.values(quotes).filter(q => !q.error && (q.lp != null || q.close != null)).length;
    if (dolu) { quotesCache.set(key, { at: Date.now(), quotes }); return res.json({ quotes }); }
    /* TV hiç veri vermedi (kota/zaman aşımı): varsa bayat veriyle satırları doldur */
    if (hit && age < QUOTES_STALE_MAX) { console.warn('quotes: TV bos — bayat onbellek dondu (' + symbols.length + ' sembol)'); return res.json({ quotes: hit.quotes, stale: true }); }
    return res.json({ quotes });
  } catch (e) {
    res.status(502).json({ error: e.message, quotes: {} });
  }
});

// ---------- WS: canlı quote relay ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/quote' });

wss.on('connection', (sock, req) => {
  const url = new URL(req.url, 'http://x');
  const symbols = (url.searchParams.get('symbols') || 'BIST:XU100').split(',').filter(Boolean).slice(0, 40);
  /* r111: paylaşılan istemci — bağlantı başına yeni TV socket'i değil, tek socket'te oturum */
  const client = getSharedTV();
  const session = new client.Session.Quote();
  const markets = symbols.map(s => ({ sym: s, m: new session.Market(s) }));
  const fwd = (d, sym) => {
    if (sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify({ symbol: sym, quote: d }));
  };
  markets.forEach(({ sym, m }) => {
    m.onData(d => fwd(d, sym));
    m.onError((...e) => fwd({ error: e.join(' ') }, sym));
  });
  sock.on('close', () => { try { session.delete(); } catch {} });
});

server.listen(PORT, () => console.log(`vela-chart listening on :${PORT}`));
