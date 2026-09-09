# Hexapod viewer

The full-screen robot view is available at `#/sensors/hexapod`, alongside LiDAR
in the visualization launcher. Its standalone Vite entry point is `/hexapod/`.
The controls reuse the LiDAR stylesheet and view-angle icons. Select a leg by
clicking its geometry or using the menu; the three sliders and numeric inputs
edit angles in degrees. The model retains radians internally.

Selected parts use the posts' Source Serif 4 font. `parts.js` names every shipped
mesh, including motor subcomponents, bearing internals, and sized fasteners.
Labels use the pinned source's `assembly_report.json` and inspection of the STL
shapes; generic CAD feature names are interpreted from geometry and placement,
not treated as a manufacturer bill of materials. Vendor references remain in
the catalog; the inspector shows only the part name and leg. Actuator names
follow housing axes so an output hub can belong to a motor on an adjacent link.
Run `node --test src/viewers/hexapod/parts.test.js` to check catalog coverage.

Link colors start enabled. Motion offers a selected joint sweep and an in-place
tripod walk: left front, left rear, and right middle alternate with the other
three legs. The walk blends into a modest joint-space cycle around the standing
pose; it does not enforce planted feet or simulate balance. Pause preserves the
current pose and phase. Reset restores the standing pose.

The robot assets in `public/hexapod/model/` and `motion.js` come from
[Cornell Physical Intelligence's hexapod repository](https://github.com/Cornell-Physical-Intelligence/hexapod-cupi)
at commit `49f4078d7468d3b6ce68c07debe054a0e270b63a`:

- `robot/hexapod_mkii_assy/meshes/` and `urdf/`
- `stance_v2.json`, `joint_limits.json`, and `preview/inspection_models.json`
- `preview/inspection_motion.js`

The loading, posing, and inspection logic is adapted from that repository's
`preview/inspection_v2.js`. The URDF hashes in `models.json` pin both variants.
The linkage model has 18 independent controls and 12 mimic joints. This is a
kinematic viewer, with no Isaac Sim connection or contact physics. The serial
model is a historical geometry comparison, not the current physical simulation.

Three.js is isolated in this npm workspace, as in `src/viewers/lidar/`, so the home globe's
older renderer is unaffected. `npm run build` builds all three entry points.
