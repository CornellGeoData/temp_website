// emit .br and .gz next to every compressible dist file so server.mjs can
// serve them precompressed
import { promises as fs } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);
const EXTS = new Set(['.js', '.css', '.html', '.svg', '.json', '.glb', '.stl', '.urdf']);

async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(p);
    } else if (entry.name === '.DS_Store') {
      // vite copies public/ verbatim, so a Finder-created .DS_Store ships to prod
      await fs.unlink(p);
    } else if (EXTS.has(path.extname(entry.name))) {
      const buf = await fs.readFile(p);
      await fs.writeFile(p + '.br', await brotli(buf, {
        // Binary CAD meshes compress well at level 5 without a lengthy build.
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: path.extname(p) === '.stl' ? 5 : 11 },
      }));
      await fs.writeFile(p + '.gz', await gzip(buf, { level: 9 }));
      console.log(`${p}: ${buf.length} -> br ${(await fs.stat(p + '.br')).size}`);
    }
  }
}

await walk('dist');
