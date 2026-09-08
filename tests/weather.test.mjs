import assert from 'node:assert/strict';
import { nearestFrame, freshness } from '../src/lib/weather.ts';

const init = Date.parse('2026-09-08T00:00:00Z');
const frames = step => Array.from({length: 19}, (_, i) => ({valid: new Date(init + i * step * 60_000).toISOString()}));
const requested = init + 130 * 60_000;
assert.equal(nearestFrame(frames(10), requested), 13);
assert.equal(nearestFrame(frames(60), requested), 2);
assert.equal(nearestFrame(frames(10), init - 60_000), 0);
const layer = {kind: 'forecast', init: new Date(init).toISOString(), stale_minutes: 120, frames: frames(10)};
assert.equal(freshness(layer, init + 130 * 60_000), 'Model update delayed');
assert.equal(freshness(layer, init + 181 * 60_000), 'Forecast ended');
assert.equal(freshness({...layer, kind:'obs'}, init + 130 * 60_000), 'Radar delayed');
assert.equal(freshness(layer, init + 60 * 60_000), null);
console.log('Forecast time alignment and source freshness checks passed.');
