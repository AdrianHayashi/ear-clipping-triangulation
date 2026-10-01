# ear-clip

A small, dependency-free TypeScript/JavaScript library that triangulates a simple polygon using the ear-clipping algorithm.

## Usage

```js
import { triangulate } from "./src/index.js";

const poly = [[0, 0], [4, 0], [4, 4], [0, 4]];
const { triangles, indices } = triangulate(poly);
// triangles: Array of [a, b, c] point triples
// indices:   Flat array [i0, i1, i2, i0, i1, i2, ...] into the input polygon
```

The function is exported as `triangulate` from `src/index.js` (which re-exports from `src/core.js`). It takes an array of `[x, y]` points in either winding order and returns `{ triangles, indices }` where `triangles` is an array of three-point tuples and `indices` is a flat array of three integer indices per triangle, referring back to the input array.

## Why this exists

Ear clipping is the simplest correct polygon triangulator to implement from scratch. It runs in O(n²) worst case, which is fine for typical polygons (up to a few thousand vertices). Faster algorithms exist (monotone partitioning is O(n log n)) but they are substantially more code and more failure modes. This library picks the simple, robust option and accepts the asymptotic cost.

## Edge cases

The input must be a *simple* polygon — no self-intersections, no holes. Consecutive duplicate points are not handled. Near-collinear vertices (within ~1e-12) are treated as reflex and skipped rather than emitted as zero-area slivers, so a polygon whose total area is effectively zero yields an empty result rather than a pile of degenerate triangles. If you have a polygon with holes, cut a seam first.
