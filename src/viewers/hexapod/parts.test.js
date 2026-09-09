import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';
import { PARTS, describePart } from './parts.js';

test('every shipped mesh has a descriptive component label', () => {
  const files = readdirSync(new URL('../../../public/hexapod/model/meshes/', import.meta.url)).filter(file => file.endsWith('.stl'));
  assert.deepEqual(Object.keys(PARTS).sort(), files.map(file => file.slice(0, -4)).sort());
  for (const file of files) {
    const part = describePart(file);
    assert.ok(part.name && part.detail, file);
    assert.doesNotMatch(part.name, /revolve|cirpattern|cut.extrude|\.stl|·/i, file);
  }
  assert.equal(describePart('motor_1_1_06_eb463_507.stl').name, 'Motor');
  assert.equal(describePart('motor_1_2_05_000438.stl').name, 'Motor countersunk screw');
});
