// Shared projects for the Visualizations list and view launcher.
export type ViewId = 'home' | 'map' | 'charts' | 'forecast' | 'lidar' | 'hexapod';

export interface Visualization {
  id: Exclude<ViewId, 'home'>;
  label: string;
  blurb: string;
  thumb: string;
  hash: string; // deep link, e.g. #/sensors/map
}

// Order is display order everywhere (project list and launcher).
export const VISUALIZATIONS: Visualization[] = [
  {
    id: 'map',
    label: 'Sensor Map',
    blurb: 'Environmental sensor locations mapped over satellite imagery. Select a station to inspect its recent measurements.',
    thumb: '/visualizations/map.jpg',
    hash: '#/sensors/map',
  },
  {
    id: 'forecast',
    label: 'Weather Forecast',
    blurb: 'Radar observations and regional forecasts for the Finger Lakes. Compare precipitation, temperature, and wind across separate model layers.',
    thumb: '/visualizations/forecast.jpg',
    hash: '#/sensors/forecast',
  },
  {
    id: 'charts',
    label: 'Sensor Charts',
    blurb: 'Time series from the environmental sensor network. Review current and historical measurements, or export records as CSV.',
    thumb: '/visualizations/charts.jpg',
    hash: '#/sensors/air',
  },
  {
    id: 'lidar',
    label: 'Ithaca LiDAR',
    blurb: 'A 3D point cloud of central Ithaca with predicted surface classes. Inspect individual points and navigate terrain, vegetation, and buildings.',
    thumb: '/visualizations/lidar.jpg',
    hash: '#/sensors/lidar',
  },
  {
    id: 'hexapod',
    label: 'Hexapod',
    blurb: 'Explore the Hexapod MKII in 3D. Select a leg, adjust its joints, and inspect the moving linkages.',
    thumb: '/projects/hexapod.webp',
    hash: '#/sensors/hexapod',
  },
];
