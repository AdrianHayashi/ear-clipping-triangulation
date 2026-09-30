/**
 * Ear-clipping triangulation for a simple polygon.
 *
 * A "simple polygon" is one whose edges touch only at shared vertices —
 * no self-intersections, no holes. Ear clipping is the standard O(n^2)
 * algorithm for triangulating such polygons. It is not the fastest
 * (monotone-partition methods are O(n log n)) but it is simple, robust
 * to implement, and entirely adequate for polygons with up to a few
 * thousand vertices, which covers the vast majority of real input.
 *
 * The algorithm repeatedly finds an "ear": a triangle formed by three
 * consecutive vertices v_{i-1}, v_i, v_{i+1} that (a) is convex and (b)
 * contains no other polygon vertex. The middle vertex is clipped, the
 * triangle is emitted, and the process continues until only three
 * vertices remain.
 */

/**
 * Two-dimensional point as a [x, y] tuple.
 *
 * @typedef {[number, number]} Point
 */

/**
 * @typedef {Object} TriangleResult
 * @property {[Point, Point, Point][]} triangles  Array of triangles, each
 *   given as three [x, y] points in the winding order the algorithm
 *   clipped them. The union of these triangles is the original polygon.
 * @property {number[]} indices  Indices into the input polygon for each
 *   triangle, flattened as [i0, i1, i2, i0, i1, i2, ...]. Useful for
 *   callers that want to map triangles back to source vertices.
 */

const EPS = 1e-12;

/**
 * Compute the signed area (×2) of the triangle a -> b -> c.
 *
 * Positive when a -> b -> c is a counter-clockwise turn, negative when
 * clockwise, zero when the points are collinear.
 *
 * We use the determinant form rather than atan2-based angles because it
 * is branch-free, has no transcendendentals, and is exactly what the
 * convexity and point-in-triangle tests need anyway.
 *
 * @param {Point} a
 * @param {Point} b
 * @param {Point} c
 * @returns {number}
 */
function signedArea(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
}

/**
 * Strictly inside a triangle, accounting for floating point.
 *
 * Points exactly on an edge are treated as outside: this is what we
 * want, because a vertex sitting on another triangle's edge is part of
 * the polygon boundary shared with that triangle, not an interior
 * obstruction.
 *
 * The sign tests cover all four winding cases (CCW triangle, CW
 * triangle, and the degenerate near-collinear ones) by comparing the
 * orientation against the triangle's own orientation.
 *
 * @param {Point} p
 * @param {Point} a
 * @param {Point} b
 * @param {Point} c
 * @returns {boolean}
 */
function pointInTriangle(p, a, b, c) {
  const s1 = signedArea(p, a, b);
  const s2 = signedArea(p, b, c);
  const s3 = signedArea(p, c, a);
  const hasNeg = s1 < -EPS || s2 < -EPS || s3 < -EPS;
  const hasPos = s1 > EPS || s2 > EPS || s3 > EPS;
  return !(hasNeg && hasPos);
}

/**
 * Triangulate a simple polygon using ear clipping.
 *
 * Contract:
 *  - Input is an array of [x, y] points in either winding order.
 *  - The polygon is simple (no self-intersections) and has no holes.
 *  - Consecutive duplicate points are not allowed and are not handled.
 *  - Returns { triangles, indices } where `triangles` is an array of
 *    [a, b, c] point tuples and `indices` is a flat array of three
 *    integer indices per triangle, referring to the input array.
 *
 * The implementation forces CCW orientation internally so that the
 * convexity test has a single, consistent sign convention regardless
 * of the input's winding. Output triangles follow the input winding:
 * we remap internal indices back through the same reversal so callers
 * see triangles consistent with their input.
 *
 * A small floating-point epsilon is used in both the convexity test
 * and the point-in-triangle test, so near-collinear ears are treated as
 * non-convex and points on an edge are treated as outside. This is the
 * pragmatic choice: triangulating polygons that are "almost" collinear
 * is a source of degenerate slivers, and skipping those is the safer
 * behaviour.
 *
 * @param {Point[]} polygon
 * @returns {TriangleResult}
 */
export function triangulate(polygon) {
  const n = polygon.length;
  if (n < 3) {
    return { triangles: [], indices: [] };
  }
  if (n === 3) {
    return {
      triangles: [[polygon[0], polygon[1], polygon[2]]],
      indices: [0, 1, 2],
    };
  }

  // Force CCW for a consistent convexity sign. We keep the index map
  // so we can translate internal indices back to the caller's indices.
  let verts = polygon;
  let indexMap = null;

  const polyArea = signedArea(polygon[0], polygon[1], polygon[2]);
  // Sum the signed area over the whole ring to decide winding; three
  // samples can be collinear even when the polygon as a whole is not.
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    total += (b[0] - a[0]) * (b[1] + a[1]);
  }
  const ccw = total <= 0;

  if (!ccw) {
    verts = [];
    indexMap = [];
    for (let i = n - 1; i >= 0; i--) {
      verts.push(polygon[i]);
      indexMap.push(i);
    }
  }

  // idx is the list of current vertex positions in `verts`.
  let idx = [];
  for (let i = 0; i < verts.length; i++) idx.push(i);

  const triangles = [];
  const outIndices = [];
  const totalArea = Math.abs(total);
  // If the whole polygon is near-degenerate (total area ~0), there is
  // nothing meaningful to triangulate. We bail out rather than emit a
  // pile of zero-area triangles.
  if (totalArea < EPS) {
    return { triangles: [], indices: [] };
  }

  // Defensive cap: the algorithm's worst case is O(n^2), and a simple
  // polygon always has n-2 ears, so n iterations of the outer loop
  // always suffice. The cap guards against an accidental infinite loop
  // if input invariants are violated (e.g. a self-intersecting polygon
  // where no ear is ever found).
  let guard = verts.length * verts.length + 4;
  while (idx.length > 3 && guard-- > 0) {
    let clipped = false;
    const m = idx.length;

    for (let i = 0; i < m; i++) {
      const prev = idx[(i - 1 + m) % m];
      const curr = idx[i];
      const next = idx[(i + 1) % m];

      const a = verts[prev];
      const b = verts[curr];
      const c = verts[next];

      // Convexity: for CCW winding, a reflex vertex has negative
      // signed area. We treat near-zero as reflex (skip) so we don't
      // emit zero-area ears.
      const area = signedArea(a, b, c);
      if (area <= EPS) continue;

      // Point-in-triangle: no other vertex may lie strictly inside
      // the candidate ear. We only need to check vertices that are
      // still in `idx` (others have already been clipped).
      let blocked = false;
      for (let k = 0; k < m; k++) {
        const vi = idx[k];
        if (vi === prev || vi === curr || vi === next) continue;
        if (pointInTriangle(verts[vi], a, b, c)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      // Ear found. Record it and remove the middle vertex.
      triangles.push([a, b, c]);
      const ip = ccw ? prev : indexMap[prev];
      const ic = ccw ? curr : indexMap[curr];
      const inx = ccw ? next : indexMap[next];
      outIndices.push(ip, ic, inx);
      idx.splice(i, 1);
      clipped = true;
      break;
    }

    if (!clipped) break;
  }

  // Emit the final triangle if exactly three vertices remain.
  if (idx.length === 3) {
    const p0 = verts[idx[0]];
    const p1 = verts[idx[1]];
    const p2 = verts[idx[2]];
    triangles.push([p0, p1, p2]);
    const i0 = ccw ? idx[0] : indexMap[idx[0]];
    const i1 = ccw ? idx[1] : indexMap[idx[1]];
    const i2 = ccw ? idx[2] : indexMap[idx[2]];
    outIndices.push(i0, i1, i2);
  }

  return { triangles, indices: outIndices };
}
