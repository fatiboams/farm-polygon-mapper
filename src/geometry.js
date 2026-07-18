export const LIMITS = Object.freeze({
  minPoints: 3,
  maxPoints: 200,
  minZoom: 0.25,
  maxZoom: 4,
  maxCoordinate: 100000,
  maxFileBytes: 200000
});

const EPSILON = 1e-8;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeRotation(degrees) {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function polygonArea(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;

  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

export function polygonSignedArea(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;

  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

export function projectPointToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared <= EPSILON) {
    return { x: start.x, y: start.y, t: 0 };
  }

  const t = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    0,
    1
  );

  return {
    x: start.x + t * dx,
    y: start.y + t * dy,
    t
  };
}

function orientation(a, b, c) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < EPSILON) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return (
    b.x <= Math.max(a.x, c.x) + EPSILON &&
    b.x + EPSILON >= Math.min(a.x, c.x) &&
    b.y <= Math.max(a.y, c.y) + EPSILON &&
    b.y + EPSILON >= Math.min(a.y, c.y)
  );
}

export function segmentsIntersect(p1, q1, p2, q2) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

function pointsEqual(a, b) {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
}

export function hasSelfIntersections(points) {
  const count = points.length;
  if (count < 4) return false;

  for (let first = 0; first < count; first += 1) {
    const firstNext = (first + 1) % count;

    for (let second = first + 1; second < count; second += 1) {
      const secondNext = (second + 1) % count;

      const adjacent =
        first === second ||
        firstNext === second ||
        secondNext === first;

      if (adjacent) continue;

      if (
        segmentsIntersect(
          points[first],
          points[firstNext],
          points[second],
          points[secondNext]
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

export function validatePoints(points) {
  if (!Array.isArray(points)) {
    return { valid: false, error: "The JSON must contain a points array." };
  }

  if (points.length < LIMITS.minPoints) {
    return {
      valid: false,
      error: `A polygon requires at least ${LIMITS.minPoints} points.`
    };
  }

  if (points.length > LIMITS.maxPoints) {
    return {
      valid: false,
      error: `A polygon cannot contain more than ${LIMITS.maxPoints} points.`
    };
  }

  const normalized = [];

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];

    if (
      !point ||
      !Number.isFinite(Number(point.x)) ||
      !Number.isFinite(Number(point.y))
    ) {
      return {
        valid: false,
        error: `Point ${index + 1} must contain finite x and y values.`
      };
    }

    const normalizedPoint = {
      x: Number(point.x),
      y: Number(point.y)
    };

    if (
      Math.abs(normalizedPoint.x) > LIMITS.maxCoordinate ||
      Math.abs(normalizedPoint.y) > LIMITS.maxCoordinate
    ) {
      return {
        valid: false,
        error: `Point ${index + 1} exceeds the allowed coordinate range.`
      };
    }

    normalized.push(normalizedPoint);
  }

  for (let index = 0; index < normalized.length; index += 1) {
    const next = normalized[(index + 1) % normalized.length];
    if (pointsEqual(normalized[index], next)) {
      return {
        valid: false,
        error: `Points ${index + 1} and ${(index + 1) % normalized.length + 1} are duplicates.`
      };
    }
  }

  if (polygonArea(normalized) <= EPSILON) {
    return {
      valid: false,
      error: "The polygon area must be greater than zero."
    };
  }

  if (hasSelfIntersections(normalized)) {
    return {
      valid: false,
      error: "The polygon edges cannot cross each other."
    };
  }

  return { valid: true, points: normalized };
}

export function validateImportData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, error: "The imported JSON must be an object." };
  }

  const pointResult = validatePoints(data.points);
  if (!pointResult.valid) return pointResult;

  const sourceView = data.view && typeof data.view === "object" ? data.view : data;

  const zoomValue = Number(sourceView.zoom ?? 1);
  const rotationValue = Number(sourceView.rotation ?? 0);
  const panX = Number(sourceView.pan?.x ?? 0);
  const panY = Number(sourceView.pan?.y ?? 0);

  if (![zoomValue, rotationValue, panX, panY].every(Number.isFinite)) {
    return {
      valid: false,
      error: "Zoom, rotation and pan values must be finite numbers."
    };
  }

  return {
    valid: true,
    data: {
      version: "1.1",
      points: pointResult.points,
      view: {
        zoom: clamp(zoomValue, LIMITS.minZoom, LIMITS.maxZoom),
        rotation: normalizeRotation(rotationValue),
        pan: {
          x: clamp(panX, -LIMITS.maxCoordinate, LIMITS.maxCoordinate),
          y: clamp(panY, -LIMITS.maxCoordinate, LIMITS.maxCoordinate)
        }
      }
    }
  };
}

export function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}
