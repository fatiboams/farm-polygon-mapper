import assert from "node:assert/strict";
import {
  polygonArea,
  projectPointToSegment,
  hasSelfIntersections,
  validatePoints,
  validateImportData,
  normalizeRotation
} from "../src/geometry.js";

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 }
];

assert.equal(polygonArea(square), 100, "Square area should be 100.");

const projected = projectPointToSegment(
  { x: 4, y: 7 },
  { x: 0, y: 0 },
  { x: 10, y: 0 }
);
assert.deepEqual(
  { x: projected.x, y: projected.y },
  { x: 4, y: 0 },
  "Point should project onto the segment."
);

const bowTie = [
  { x: 0, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
  { x: 10, y: 0 }
];
assert.equal(hasSelfIntersections(bowTie), true, "Bow-tie polygon must self-intersect.");
assert.equal(validatePoints(square).valid, true, "Square should be valid.");
assert.equal(validatePoints(bowTie).valid, false, "Self-intersecting polygon should be invalid.");

const duplicate = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 0 },
  { x: 0, y: 10 }
];
assert.equal(validatePoints(duplicate).valid, false, "Adjacent duplicates should be rejected.");

const imported = validateImportData({
  points: square,
  view: {
    zoom: 99,
    rotation: -15,
    pan: { x: 5, y: -8 }
  }
});
assert.equal(imported.valid, true, "Valid import should pass.");
assert.equal(imported.data.view.zoom, 4, "Zoom should be clamped.");
assert.equal(imported.data.view.rotation, 345, "Rotation should normalize.");

assert.equal(normalizeRotation(390), 30);
assert.equal(normalizeRotation(-30), 330);

console.log("All geometry tests passed.");
