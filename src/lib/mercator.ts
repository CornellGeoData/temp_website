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
