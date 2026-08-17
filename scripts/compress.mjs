// emit .br and .gz next to every compressible dist file so the static server
// (sirv --brotli --gzip) can serve them precompressed
import { promises as fs } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);
const EXTS = new Set(['.js', '.css', '.html', '.svg', '.json', '.glb']);

async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(p);
    } else if (EXTS.has(path.extname(entry.name))) {
      const buf = await fs.readFile(p);
      await fs.writeFile(p + '.br', await brotli(buf, {
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
      }));
      await fs.writeFile(p + '.gz', await gzip(buf, { level: 9 }));
      console.log(`${p}: ${buf.length} -> br ${(await fs.stat(p + '.br')).size}`);
    }
  }
}

await walk('dist');
