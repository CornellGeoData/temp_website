import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { animationPose } from './motion.js';

test('tripod walk alternates legs, stays in the CAD limits, and blends without a jump', () => {
  const read = name => JSON.parse(readFileSync(new URL(`../../../public/hexapod/model/${name}`, import.meta.url)));
  const limits = read('joint_limits.json'), stance = read('stance_v2.json');
  const legs = ['lf', 'lm', 'lr', 'rf', 'rm', 'rr'];
  const kinds = ['coxa_yaw', 'femur_pitch', 'tibia_pitch'];
  const stancePose = Object.fromEntries(legs.flatMap(leg => kinds.map(kind => [`${leg}_${kind}`, stance[`${kind}_rad`]])));
  const options = { mode: 'gait', basePose: stancePose, stancePose, legs, kinds, limits };
  const pose = phase => animationPose({ ...options, phase });
  for (let step = 0; step <= 64; step++) {
    const values = pose(step * Math.PI / 32);
    assert.equal(Object.keys(values).length, 18);
    for (const leg of legs) for (const kind of kinds) {
      assert.ok(values[`${leg}_${kind}`] >= limits[kind].lower && values[`${leg}_${kind}`] <= limits[kind].upper);
    }
  }
  const first = pose(Math.PI / 2), second = pose(3 * Math.PI / 2);
  for (const leg of legs) {
    const name = `${leg}_femur_pitch`, groupA = ['lf', 'lr', 'rm'].includes(leg);
    assert.equal(first[name] > stancePose[name] + 0.1, groupA);
    assert.equal(second[name] > stancePose[name] + 0.1, !groupA);
  }
  for (const name of Object.keys(stancePose)) assert.ok(Math.abs(pose(0)[name] - pose(2 * Math.PI)[name]) < 1e-12);
  const manualPose = { ...stancePose, lf_coxa_yaw: 0.4, rf_femur_pitch: 0.1 };
  assert.deepEqual(animationPose({ ...options, basePose: manualPose, phase: 1, transition: 0 }), manualPose);
  const swept = animationPose({ ...options, mode: 'joint', joint: 'coxa_yaw', leg: 'lf', phase: Math.PI });
  assert.equal(swept.lf_coxa_yaw, limits.coxa_yaw.upper);
  for (const name of Object.keys(stancePose).filter(name => name !== 'lf_coxa_yaw')) assert.equal(swept[name], stancePose[name]);
});
