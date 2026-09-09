# Standalone 3D viewers

`lidar/` and `hexapod/` contain their HTML, styles, JavaScript, and isolated npm
workspaces. The site embeds them at `/lidar/` and `/hexapod/`; `vite.config.ts`
maps those URLs to the source pages during development and puts the built HTML
at those same paths. Large datasets and original CAD assets stay in
`public/lidar/` and `public/hexapod/`.

Build from the repository root with `npm run build`. Run the hexapod checks with
`node --test src/viewers/hexapod/*.test.js`. Use `npm start` to check production
compression; the Vite development server serves the original assets.

## Current performance

Measured from the pinned model on September 9, 2026:

| Hexapod asset measurement | Value |
| --- | ---: |
| Unique STL meshes | 77 |
| Mesh instances in either assembled model | 1,927 |
| Triangle instances before view culling | 23,154,342 |
| Original STL download size | 42,953,468 bytes |
| Brotli STL download size at quality 5 | 12,543,659 bytes |
| Gzip STL download size at level 9 | 15,715,350 bytes |

The production server serves precompressed STL and URDF files. STL transfer is
70.8% smaller with Brotli, with identical decoded geometry. This reduces network
transfer; it does not reduce parsing cost, triangle count, or GPU memory.
Byte-range requests bypass compression so they retain the original byte offsets.

The hexapod renders when the camera, pose, display, or selection changes, and
continuously while motion plays or orbit damping settles. It stops drawing when
idle and pauses when hidden. This follows the
[Three.js rendering-on-demand pattern](https://threejs.org/manual/en/rendering-on-demand.html).

LiDAR already streams a COPC hierarchy using HTTP byte ranges and worker decoding.
It starts with a 750,000-point budget on small screens and 2,500,000 elsewhere.
Giro3D schedules rendering; the loading indicator now follows its update events
instead of running an extra animation loop.

## Next optimizations, in priority order

1. **Simplify the hexapod display meshes offline.** Tiny screw threads dominate
   the triangle count: one motor screw mesh alone contributes 2.59 million
   repeated triangles. Create separate web meshes with fewer triangles while
   retaining silhouettes, part IDs, transforms, and the original CAD/physics
   assets. Benchmark the result at the closest useful inspection zoom.
2. **Instance repeated hexapod hardware.** Shared geometry is already cached,
   but each CAD piece remains a separate draw call. Batch matching fasteners
   with [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html), keeping
   instance-to-part mappings for selection and joint motion. Instancing reduces
   draw calls; mesh simplification is still needed to reduce triangle work.
3. **Package simplified geometry for the web.** A glTF/GLB export processed by
   [gltfpack](https://github.com/zeux/meshoptimizer/blob/master/gltf/README.md)
   can add indexing, quantization, and mesh compression. Preserve the individual
   named parts so the inspector and joint controls continue to work.
4. **Adapt LiDAR quality during interaction.** Benchmark a lower point budget
   while dragging, then restore the user's selected budget when movement stops.
   The existing Light setting is available now. Keep HTTP `206` range support
   and immutable caching for the content-hashed scan chunks at the deployment
   host/CDN; without ranges, small reads can fetch entire 16 MiB chunks.

The counts above describe the assets, not measured frame-rate improvements.
Compare cold-cache load time, orbit/animation frame time, picking latency, and
idle GPU activity on the target laptop and phone before setting quality defaults.
