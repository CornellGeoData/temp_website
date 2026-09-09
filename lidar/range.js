// COPC uses end-exclusive ranges. Parts are consecutive slices of the same
// file, so this also handles a node that straddles a static asset boundary.
export function createRangeGetter(metadata, base) {
  return async (begin, end) => {
    if (!Number.isSafeInteger(begin) || !Number.isSafeInteger(end) || begin < 0 || end < begin || end > metadata.bytes) throw new Error('Invalid point-cloud byte range');
    const output = new Uint8Array(end - begin);
    if (begin === end) return output;
    const first = Math.floor(begin / metadata.chunkSize);
    const last = Math.ceil(end / metadata.chunkSize);
    await Promise.all(Array.from({ length: last - first }, async (_, i) => {
      const index = first + i;
      const offset = index * metadata.chunkSize;
      const start = Math.max(begin - offset, 0);
      const stop = Math.min(end - offset, metadata.chunkSize);
      const response = await fetch(new URL(metadata.chunks[index], base), { headers: { Range: `bytes=${start}-${stop - 1}` } });
      if (!response.ok) throw new Error(`Point-cloud download failed (${response.status})`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      // A static host may ignore Range and return the whole part.
      const part = response.status === 206 ? bytes : bytes.subarray(start, stop);
      if (part.length !== stop - start) throw new Error('Incomplete point-cloud download');
      output.set(part, Math.max(begin, offset) - begin);
    }));
    return output;
  };
}
