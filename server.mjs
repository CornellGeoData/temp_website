import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';

// serves dist/ and proxies the Air Quality Egg API so the key stays server-side.
// EGG_SERIAL and EGG_API_KEY live in the host's environment (Railway), never in the repo.
const app = express();
const CACHE_MS = 5 * 60_000; // the Egg reports ~every minute; 15-min buckets make 5 min plenty
let cache = { t: 0, data: null };

app.get('/api/aqi', async (_req, res) => {
  if (!process.env.EGG_SERIAL || !process.env.EGG_API_KEY) {
    res.status(503).json({ error: 'sensor proxy not configured' });
    return;
  }
  try {
    if (!cache.data || Date.now() - cache.t > CACHE_MS) {
      // EGG_SERIAL may be a comma-separated list; the API batches them in one call.
      // dur is only valid with an anchor date (422 otherwise)
      const serials = process.env.EGG_SERIAL.split(',').map((x) => x.trim()).filter(Boolean);
      const url =
        `https://airqualityegg.com/api/v2/messages/device/${serials.join(',')}` +
        `?dur=P1D&end-date=${new Date().toISOString()}&reduced=1&grouped=1&apiKey=${process.env.EGG_API_KEY}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`upstream ${r.status}`);
      const raw = await r.json();
      // re-key each egg by its position in EGG_SERIAL (egg1, egg2, ...) so the
      // client references stable slots and never sees the serial numbers
      const data = Object.fromEntries(
        serials.map((sn, i) => {
          const k = Object.keys(raw ?? {}).find((x) => x.toLowerCase() === sn.toLowerCase());
          return [`egg${i + 1}`, k ? raw[k] : null];
        }),
      );
      cache = { t: Date.now(), data };
    }
    res.set('cache-control', 'public, max-age=60');
    res.json(cache.data);
  } catch (err) {
    if (cache.data) {
      res.json(cache.data); // stale beats nothing
      return;
    }
    res.status(502).json({ error: String(err) });
  }
});

// the eggs' lifetime archive: same re-keying as /api/aqi, but a year deep and
// refreshed every 6h - the history only grows at the margin
let eggLife = { t: 0, p: null };
app.get('/api/aqi-lifetime', async (_req, res) => {
  if (!process.env.EGG_SERIAL || !process.env.EGG_API_KEY) {
    res.status(503).json({ error: 'sensor proxy not configured' });
    return;
  }
  const serials = process.env.EGG_SERIAL.split(',').map((x) => x.trim()).filter(Boolean);
  if (!eggLife.p || Date.now() - eggLife.t > 6 * 3600_000) {
    const url =
      `https://airqualityegg.com/api/v2/messages/device/${serials.join(',')}` +
      `?dur=P1Y&end-date=${new Date().toISOString()}&reduced=1&grouped=1&apiKey=${process.env.EGG_API_KEY}`;
    eggLife = {
      t: Date.now(),
      p: fetch(url)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`upstream ${r.status}`))))
        .then((raw) => Object.fromEntries(
          serials.map((sn, i) => {
            const k = Object.keys(raw ?? {}).find((x) => x.toLowerCase() === sn.toLowerCase());
            return [`egg${i + 1}`, k ? raw[k] : null];
          }),
        )),
    };
    eggLife.p.catch(() => { eggLife.p = null; }); // failed fetch: next request retries
  }
  try {
    res.set('cache-control', 'public, max-age=3600');
    res.json(await eggLife.p);
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

// the Soilmote lifetime archive: Zynect takes ~a minute to assemble it, so one
// upstream fetch is shared by all visitors and refreshed every 6h. Serials must
// match SOILMOTES in src/pages/sensors.tsx (internal ids, not portal aliases).
const SOIL_SERIALS = ['egge82d1055169daf2b'];
let soilLife = { t: 0, p: null };
app.get('/api/soil-lifetime', async (_req, res) => {
  if (!soilLife.p || Date.now() - soilLife.t > 6 * 3600_000) {
    const url =
      `https://zynect.com/api/v2/messages/device/${SOIL_SERIALS.join(',')}` +
      `?dur=P2Y&end-date=${new Date().toISOString()}&reduced=1&grouped=1`;
    soilLife = { t: Date.now(), p: fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`upstream ${r.status}`)))) };
    soilLife.p.catch(() => { soilLife.p = null; }); // failed fetch: next request retries
  }
  try {
    res.set('cache-control', 'public, max-age=3600');
    res.json(await soilLife.p);
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

// serve the .br/.gz siblings scripts/compress.mjs emits at build time
const DIST = path.resolve('dist');
const COMPRESSIBLE = /\.(?:js|css|html|svg|json|glb)$/;
app.use((req, res, next) => {
  if ((req.method !== 'GET' && req.method !== 'HEAD') || !COMPRESSIBLE.test(req.path)) return next();
  const enc = req.acceptsEncodings('br', 'gzip');
  if (!enc) return next();
  const file = path.join(DIST, req.path) + (enc === 'br' ? '.br' : '.gz');
  if (!file.startsWith(DIST + path.sep) || !existsSync(file)) return next();
  res.set('content-encoding', enc);
  res.set('vary', 'accept-encoding');
  res.type(path.extname(req.path));
  res.sendFile(file);
});

app.use(express.static('dist', { etag: true }));
app.use((_req, res) => res.sendFile('index.html', { root: 'dist' }));

app.listen(process.env.PORT ?? 4173);
