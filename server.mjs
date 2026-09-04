// Vela Chart — TradingView veri köprüsü
// REST: /api/bars?symbol=BIST:THYAO&tf=1D&n=300  → OHLCV
// WS  : /ws/quote?symbols=BIST:THYAO,BINANCE:BTCUSDT → canlı fiyat
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

// ---------- REST: bars ----------
app.get('/api/bars', async (req, res) => {
  const symbol = String(req.query.symbol || 'BIST:XU100');
  const tf = String(req.query.tf || '1D');
  const n = Math.min(Number(req.query.n || 300), 2000);
  try {
    const bars = await new Promise((resolve, reject) => {
      const client = new TradingView.Client();
      const chart = new client.Session.Chart();
      const to = setTimeout(() => { client.end(); reject(new Error('timeout')); }, 20000);
      chart.setMarket(symbol, { timeframe: tf, range: n });
      chart.onUpdate(() => {
        clearTimeout(to);
        const out = chart.periods.map(p => ({
          time: p.time, open: p.open, high: p.max, low: p.min, close: p.close, volume: p.volume ?? 0,
        }));
        client.end();
        resolve(out);
      });
      chart.onError((...e) => { clearTimeout(to); client.end(); reject(new Error(e.join(' '))); });
    });
    res.json({ symbol, tf, bars });
  } catch (e) {
    res.status(502).json({ error: e.message });
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
  const markets = symbols.map(s => new session.Market(s));
  const fwd = (d, sym) => {
    if (sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify({ symbol: sym, quote: d }));
  };
  markets.forEach(m => {
    m.onData(d => fwd(d, m.symbol));
    m.onError((...e) => fwd({ error: e.join(' ') }, m.symbol));
  });
  sock.on('close', () => { try { quote.end(); } catch {} });
});

server.listen(PORT, () => console.log(`vela-chart listening on :${PORT}`));
