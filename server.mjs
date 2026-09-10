// Vela Chart — TradingView veri köprüsü
// REST: /api/bars?symbol=BIST:THYAO&tf=1D&n=300          → OHLCV (30sn cache, in-flight dedupe)
//       /api/search?query=thyao                          → sembol arama (TV global search + lokal fallback)
//       /api/quotes?symbols=A,B,C                        → toplu snapshot quote (watchlist ilk yükleme)
// WS  : /ws/quote?symbols=A,B,C                          → canlı fiyat relay
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import TradingView from '@mathieuc/tradingview';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3010;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// ---------- bars cache ----------
const barsCache = new Map();   // key → { at, bars }
const inflight = new Map();    // key → Promise
const BARS_TTL = 30_000;
const N_TTL    = 120_000;      // uzun geçmiş daha yavaş bayatlansın

function fetchBars(symbol, tf, n) {
  const key = `${symbol}|${tf}|${n}`;
  const ttl = n > 400 ? N_TTL : BARS_TTL;
  const hit = barsCache.get(key);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.bars);
  if (inflight.has(key)) return inflight.get(key);
  const p = new Promise((resolve, reject) => {
    const client = new TradingView.Client();
    const chart = new client.Session.Chart();
    const to = setTimeout(() => { client.end(); inflight.delete(key); reject(new Error('timeout')); }, 20000);
    chart.setMarket(symbol, { timeframe: tf, range: n });
    chart.onUpdate(() => {
      clearTimeout(to);
      const out = chart.periods.map(p => ({
        time: p.time, open: p.open, high: p.max, low: p.min, close: p.close, volume: p.volume ?? 0,
      })).sort((a, b) => a.time - b.time);
      client.end();
      barsCache.set(key, { at: Date.now(), bars: out });
      inflight.delete(key);
      resolve(out);
    });
    chart.onError((...e) => { clearTimeout(to); inflight.delete(key); client.end(); reject(new Error(e.join(' '))); });
  });
  inflight.set(key, p);
  return p;
}

app.get('/api/bars', async (req, res) => {
  const symbol = String(req.query.symbol || 'BIST:XU100');
  const tf = String(req.query.tf || '1D');
  const n = Math.min(Number(req.query.n || 300), 2000);
  try {
    const bars = await fetchBars(symbol, tf, n);
    res.json({ symbol, tf, bars, s: 'ok' });
  } catch (e) {
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
app.get('/api/quotes', async (req, res) => {
  const symbols = String(req.query.symbols || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 30);
  if (!symbols.length) return res.json({ quotes: {} });
  try {
    const quotes = await new Promise((resolve, reject) => {
      const client = new TradingView.Client();
      const session = new client.Session.Quote();
      const out = {}; let pending = symbols.length;
      const done = () => { client.end(); resolve(out); };
      const to = setTimeout(() => { client.end(); resolve(out); }, 8000);
      const markets = symbols.map(s => ({ sym: s, m: new session.Market(s) }));
      markets.forEach(({ sym, m }) => {
        m.onData(d => {
          if (d.lp || d.close || d.current_session_state) {
            out[sym] = { lp: d.lp ?? d.close, ch: d.ch, chp: d.chp, description: d.description, exchange: d.exchange, volume: d.volume };
            if (--pending <= 0) { clearTimeout(to); done(); }
          }
        });
        m.onError((...e) => { out[sym] = { error: e.join(' ') }; if (--pending <= 0) { clearTimeout(to); done(); } });
      });
    });
    res.json({ quotes });
  } catch (e) {
    res.status(502).json({ error: e.message, quotes: {} });
  }
});

// ---------- WS: canlı quote relay ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/quote' });

wss.on('connection', (sock, req) => {
  const url = new URL(req.url, 'http://x');
  const symbols = (url.searchParams.get('symbols') || 'BIST:XU100').split(',').filter(Boolean).slice(0, 20);
  const quote = new TradingView.Client();
  const session = new quote.Session.Quote();
  const markets = symbols.map(s => ({ sym: s, m: new session.Market(s) }));
  const fwd = (d, sym) => {
    if (sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify({ symbol: sym, quote: d }));
  };
  markets.forEach(({ sym, m }) => {
    m.onData(d => fwd(d, sym));
    m.onError((...e) => fwd({ error: e.join(' ') }, sym));
  });
  sock.on('close', () => { try { quote.end(); } catch {} });
});

server.listen(PORT, () => console.log(`vela-chart listening on :${PORT}`));
