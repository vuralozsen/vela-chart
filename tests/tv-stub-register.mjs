/* TV kütüphanesi stub'unu takan ESM kayıt dosyası:
   node --import <bu dosya> server.mjs  →  server '@mathieuc/tradingview' yerine stub'u görür. */
import { register } from 'node:module';
register(new URL('./tv-stub-loader.mjs', import.meta.url));
