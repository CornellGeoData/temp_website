// the data page's views: one entry per tile on the landing and in the
// launcher. Thumbs are screenshots of each stage in public/stages/.
// Keep blurbs general (what the view shows) rather than naming individual
// sensors or models, so hardware changes don't rot them.
// Adding a view: add an entry here and teach SensorsPage.goStage how to open it.
export type StageId = 'home' | 'map' | 'charts' | 'forecast';

export interface Stage {
  id: Exclude<StageId, 'home'>;
  label: string;
  blurb: string;
  thumb: string;
  hash: string; // deep link, e.g. #/sensors/map
}

// order is display order everywhere (landing tiles, launcher); the forecast leads
export const STAGES: Stage[] = [
  {
    id: 'forecast',
    label: 'Weather Forecast',
    blurb: 'Forecast and nowcast layers mapped over the Finger Lakes.',
    thumb: '/stages/forecast.jpg',
    hash: '#/sensors/forecast',
  },
  {
    id: 'map',
    label: 'Sensor Map',
    blurb: 'Satellite map of the sensor network. Pick a pin for its latest readings.',
    thumb: '/stages/map.jpg',
    hash: '#/sensors/map',
  },
  {
    id: 'charts',
    label: 'Sensor Charts',
    blurb: 'Charts for every station over a day, week, month, or the full archive, with CSV download.',
    thumb: '/stages/charts.jpg',
    hash: '#/sensors/air',
  },
];
