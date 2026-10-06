/* '@mathieuc/tradingview' taklidi — tests/single-candle.cjs regresyon testi için.
   Gerçek kütüphane gibi davranır: setMarket sonrası periods'i PAKET PAKET doldurur ve her
   pakette onUpdate tetikler (timescale_update ile du ayrımı olmadan — kütüphane de öyle).
   Paket zamanlamaları VELA_TV_STUB_SCRIPT JSON'undan gelir; her setMarket çağrısı
   VELA_TV_STUB_COUNT dosyasına yazılır (önbellek isabeti saptaması için). */
import fs from 'node:fs';

const SCRIPT_PATH = process.env.VELA_TV_STUB_SCRIPT || '';
const COUNT_PATH  = process.env.VELA_TV_STUB_COUNT  || '';
const SCRIPT = SCRIPT_PATH ? JSON.parse(fs.readFileSync(SCRIPT_PATH, 'utf8')) : { markets: {} };
const counts = {};

class Emitter {
  #cbs = {};
  _on(n, cb){ (this.#cbs[n] ||= []).push(cb); }
  _emit(n, ...a){ (this.#cbs[n] || []).slice().forEach(f => { try{ f(...a); }catch{} }); }
}

class Chart extends Emitter {
  #periods = [];
  get periods(){ return this.#periods; }
  onUpdate(cb){ this._on('update', cb); }
  onError(cb){ this._on('error', cb); }
  setMarket(sym, opts = {}){
    this.#periods = [];
    counts[sym] = (counts[sym] || 0) + 1;
    if(COUNT_PATH) try{ fs.writeFileSync(COUNT_PATH, JSON.stringify(counts)); }catch{}
    const steps = (SCRIPT.markets || {})[sym] || [];
    steps.forEach(st => setTimeout(() => {
      if(st.error){ this._emit('error', '(', sym, ')', st.error); return; }
      if(st.bars) this.#periods = st.bars.map(([time, open, high, low, close, volume]) =>
        ({ time, open, max: high, min: low, close, volume: volume || 0 }));
      this._emit('update');
    }, st.at));
  }
  delete(){}
}

class QuoteSession extends Emitter {
  Market = class extends Emitter {
    onData(cb){ this._on('data', cb); }
    onError(cb){ this._on('error', cb); }
  };
  delete(){}
}

class TVClient extends Emitter {
  Session = { Chart, Quote: QuoteSession };
  onDisconnected(cb){ this._on('disconnected', cb); }
}

export default { Client: TVClient };
