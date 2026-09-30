import { test } from "node:test";
import assert from "node:assert/strict";

import { triangulate } from "../src/core.js";

/**
 * Verify a triangulation's triangles exactly tile the input polygon's
 * bounding region. We do this by comparing the sum of triangle areas
 * against the shoelace area of the input polygon, allowing for a tiny
 * floating-point slack.
 */
function areasMatch(poly, triangles, slack = 1e-9) {
  let polyArea = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    polyArea += (b[0] - a[0]) * (b[1] + a[1]);
  }
  polyArea = Math.abs(polyArea) / 2;

  let triArea = 0;
  for (const t of triangles) {
    const [a, b, c] = t;
    triArea += Math.abs(
      (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
    ) / 2;
  }
  return Math.abs(triArea - polyArea) < slack;
}

test("empty polygon yields no triangles", () => {
  const { triangles, indices } = triangulate([]);
  assert.deepEqual(triangles, []);
  assert.deepEqual(indices, []);
});

test("two-point polygon yields no triangles", () => {
  const { triangles, indices } = triangulate([[0, 0], [1, 1]]);
  assert.deepEqual(triangles, []);
  assert.deepEqual(indices, []);
});

test("triangle is returned as a single triangle", () => {
  const poly = [[0, 0], [1, 0], [0, 1]];
  const { triangles, indices } = triangulate(poly);
  assert.equal(triangles.length, 1);
  assert.deepEqual(triangles[0], [[0, 0], [1, 0], [0, 1]]);
  assert.deepEqual(indices, [0, 1, 2]);
});

test("unit square produces two triangles that cover it", () => {
  const poly = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const { triangles, indices } = triangulate(poly);
  assert.equal(triangles.length, 2);
  assert.equal(indices.length, 6);
  assert.ok(areasMatch(poly, triangles));
  // All indices must be in range and the triangle count checks out.
  for (const i of indices) assert.ok(i >= 0 && i < 4);
});

test("clockwise square still produces a valid triangulation", () => {
  const poly = [[0, 0], [0, 1], [1, 1], [1, 0]];
  const { triangles, indices } = triangulate(poly);
  assert.equal(triangles.length, 2);
  assert.ok(areasMatch(poly, triangles));
  for (const i of indices) assert.ok(i >= 0 && i < 4);
});

test("convex pentagon triangulates to three triangles", () => {
  // Regular-ish convex pentagon.
  const poly = [
    [0, 0],
    [2, 0],
    [3, 1],
    [1, 2],
    [-1, 1],
  ];
  const { triangles, indices } = triangulate(poly);
  assert.equal(triangles.length, 3);
  assert.equal(indices.length, 9);
  assert.ok(areasMatch(poly, triangles));
  for (const i of indices) assert.ok(i >= 0 && i < 5);
});

test("concave notch polygon triangulates correctly", () => {
  // Square with a notch cut into the top edge — a classic ear-clipping
  // case where the reflex vertex must be skipped until its neighbours
  // form a valid ear.
  const poly = [
    [0, 0],
    [4, 0],
    [4, 4],
    [3, 4],
    [3, 1],
    [1, 1],
    [1, 4],
    [0, 4],
  ];
  const { triangles, indices } = triangulate(poly);
  assert.equal(triangles.length, poly.length - 2);
  assert.ok(areasMatch(poly, triangles));
  for (const i of indices) assert.ok(i >= 0 && i < poly.length);
});

test("star (non-convex) polygon triangulates", () => {
  // Five-pointed star outline (the outer 10 vertices, alternating
  // outer/inner radius). This is a non-trivial non-convex polygon.
  const poly = [];
  const outer = 2;
  const inner = 1;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    poly.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  const { triangles, indices } = triangulate(poly);
  assert.equal(triangles.length, poly.length - 2);
  assert.ok(areasMatch(poly, triangles));
  for (const i of indices) assert.ok(i >= 0 && i < poly.length);
});

test("collinear points yield no triangles", () => {
  // Three collinear points have zero area; the whole ring has zero
  // area, so we bail out.
  const poly = [[0, 0], [1, 0], [2, 0], [3, 0]];
  const { triangles, indices } = triangulate(poly);
  assert.deepEqual(triangles, []);
  assert.deepEqual(indices, []);
});

test("indices reference original input vertices", () => {
  // After a CW input is internally reversed, the reported indices must
  // still point back to the caller's original numbering.
  const poly = [[10, 0], [10, 10], [0, 10], [0, 0]]; // CW square
  const { triangles, indices } = triangulate(poly);
  for (let t = 0; t < triangles.length; t++) {
    for (let v = 0; v < 3; v++) {
      const expected = poly[indices[t * 3 + v]];
      assert.deepEqual(triangles[t][v], expected);
    }
  }
});

test("triangle areas are all strictly positive", () => {
  // No zero-area (sliver) triangles should be emitted for a healthy
  // polygon.
  const poly = [[0, 0], [4, 0], [4, 4], [2, 5], [0, 4]];
  const { triangles } = triangulate(poly);
  for (const [a, b, c] of triangles) {
    const area = Math.abs(
      (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
    ) / 2;
    assert.ok(area > 1e-9, `found a sliver triangle with area ${area}`);
  }
});
