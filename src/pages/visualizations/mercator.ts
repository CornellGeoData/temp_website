// Web Mercator, the projection every XYZ tile service is cut to. Pure maths,
// no DOM - so the tile arithmetic can be checked without a browser.
export const TILE = 256;

export const worldSize = (z: number): number => TILE * 2 ** z;

export const lonToX = (lon: number, z: number): number => ((lon + 180) / 360) * worldSize(z);

export const latToY = (lat: number, z: number): number => {
  // clamped to the Mercator limit; the poles are at infinity
  const s = Math.sin((Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * worldSize(z);
};

export const xToLon = (x: number, z: number): number => (x / worldSize(z)) * 360 - 180;

export const yToLat = (y: number, z: number): number => {
  const n = Math.PI * (1 - (2 * y) / worldSize(z));
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
};

// ground resolution, for the scale bar
export const metresPerPixel = (lat: number, z: number): number =>
  (156543.03392804097 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;

export interface RasterTiles { width: number; height: number; size: number }
export interface Rect { x: number; y: number; w: number; h: number }

// Published weather tiles use image rows/columns, not XYZ map coordinates.
// Return only intersecting pieces, including the smaller right/bottom edges.
export function visibleRasterTiles(grid: RasterTiles, image: Rect, viewport: { w: number; h: number }) {
  const out: { row: number; col: number; rect: Rect }[] = [];
  if (image.w <= 0 || image.h <= 0 || viewport.w <= 0 || viewport.h <= 0 ||
      image.x >= viewport.w || image.y >= viewport.h || image.x + image.w <= 0 || image.y + image.h <= 0 ||
      ![grid.width, grid.height, grid.size].every((n) => Number.isSafeInteger(n) && n > 0)) return out;
  const sx = image.w / grid.width;
  const sy = image.h / grid.height;
  const firstCol = Math.max(0, Math.floor(-image.x / sx / grid.size));
  const firstRow = Math.max(0, Math.floor(-image.y / sy / grid.size));
  const lastCol = Math.min(Math.ceil(grid.width / grid.size), Math.ceil((viewport.w - image.x) / sx / grid.size));
  const lastRow = Math.min(Math.ceil(grid.height / grid.size), Math.ceil((viewport.h - image.y) / sy / grid.size));
  for (let row = firstRow; row < lastRow; row++) {
    for (let col = firstCol; col < lastCol; col++) {
      out.push({ row, col, rect: {
        x: image.x + col * grid.size * sx,
        y: image.y + row * grid.size * sy,
        w: Math.min(grid.size, grid.width - col * grid.size) * sx,
        h: Math.min(grid.size, grid.height - row * grid.size) * sy,
      } });
    }
  }
  return out;
}
