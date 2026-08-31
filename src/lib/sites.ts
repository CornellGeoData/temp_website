// the families the network splits into; pins and legends wear these
export const AIR = '#6d9dcd';
export const SOIL = '#c1703f';
// regional NEWA weather stations wear the water team's blue
export const WEATHER = '#2e6fc9';

// One sensor as both the globe and the map draw it. Shared so the two stages
// agree without importing each other.
export interface GlobeSite {
  id: string;
  name: string;
  sub: string;
  lat: number;
  lon: number;
  tone: string;
  retired?: boolean;
  // hover/selected name renders under the dot instead of above it - set on
  // sensors whose label would otherwise sit on a crowded neighbor
  labelBelow?: boolean;
}
