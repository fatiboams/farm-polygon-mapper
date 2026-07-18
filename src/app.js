import {
  LIMITS,
  clamp,
  normalizeRotation,
  polygonArea,
  projectPointToSegment,
  validatePoints,
  validateImportData,
  cloneState
} from "./geometry.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const VIEWBOX = Object.freeze({ width: 1000, height: 650 });
const CENTER = Object.freeze({ x: VIEWBOX.width / 2, y: VIEWBOX.height / 2 });
const HISTORY_LIMIT = 80;

const DEFAULT_STATE = Object.freeze({
  points: [
    { x: 215, y: 145 },
    { x: 620, y: 100 },
    { x: 815, y: 250 },
    { x: 730, y: 510 },
    { x: 420, y: 570 },
    { x: 175, y: 415 }
  ],
  view: {
    zoom: 1,
    rotation: 0,
    pan: { x: 0, y: 0 }
  }
});

const state = {
  points: cloneState(DEFAULT_STATE.points),
  view: cloneState(DEFAULT_STATE.view),
  selectedIndex: null,
  addMode: false,
  history: [],
  historyIndex: -1,
  gesture: null,
  wheelTimer: null,
  toastTimer: null
};

const elements = {
  svgFrame: document.querySelector("#svgFrame"),
  svg: document.querySelector("#editorSvg"),
  transform: document.querySelector("#polygonTransform"),
  polygon: document.querySelector("#polygonShape"),
  edgeLayer: document.querySelector("#edgeLayer"),
  pointLayer: document.querySelector("#pointLayer"),
  editorHint: document.querySelector("#editorHint"),
  modeBadge: document.querySelector("#modeBadge"),
  selectionBadge: document.querySelector("#selectionBadge"),
  undo: document.querySelector("#undoButton"),
  redo: document.querySelector("#redoButton"),
  addPoint: document.querySelector("#addPointButton"),
  deletePoint: document.querySelector("#deletePointButton"),
  zoomOut: document.querySelector("#zoomOutButton"),
  zoomIn: document.querySelector("#zoomInButton"),
  rotateLeft: document.querySelector("#rotateLeftButton"),
  rotateRight: document.querySelector("#rotateRightButton"),
  fit: document.querySelector("#fitButton"),
  reset: document.querySelector("#resetButton"),
  export: document.querySelector("#exportButton"),
  import: document.querySelector("#importButton"),
  importFile: document.querySelector("#importFile"),
  centerSelected: document.querySelector("#centerSelectedButton"),
  pointCount: document.querySelector("#pointCount"),
  areaReadout: document.querySelector("#areaReadout"),
  selectedReadout: document.querySelector("#selectedReadout"),
  zoomReadout: document.querySelector("#zoomReadout"),
  rotationReadout: document.querySelector("#rotationReadout"),
  zoomStat: document.querySelector("#zoomStat"),
  rotationStat: document.querySelector("#rotationStat"),
  historyStat: document.querySelector("#historyStat"),
  validityBadge: document.querySelector("#validityBadge"),
  toast: document.querySelector("#toast")
};

function snapshot() {
  return {
    points: cloneState(state.points),
    view: cloneState(state.view)
  };
}

function snapshotKey(value) {
  return JSON.stringify(value);
}

function recordHistory() {
  const current = snapshot();
  const currentKey = snapshotKey(current);
  const active = state.history[state.historyIndex];

  if (active && snapshotKey(active) === currentKey) {
    updateControls();
    return;
  }

  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(current);

  if (state.history.length > HISTORY_LIMIT) {
    state.history.shift();
  }

  state.historyIndex = state.history.length - 1;
  updateControls();
}

function applySnapshot(value, message = "") {
  state.points = cloneState(value.points);
  state.view = cloneState(value.view);
  state.selectedIndex = null;
  state.addMode = false;
  render();

  if (message) showToast(message);
}

function undo() {
  if (state.historyIndex <= 0) return;
  state.historyIndex -= 1;
  applySnapshot(state.history[state.historyIndex], "Undo complete");
}

function redo() {
  if (state.historyIndex >= state.history.length - 1) return;
  state.historyIndex += 1;
  applySnapshot(state.history[state.historyIndex], "Redo complete");
}

function rotateVector(x, y, degrees) {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);

  return {
    x: x * cosine - y * sine,
    y: x * sine + y * cosine
  };
}

function localToSvg(point, view = state.view) {
  const scaledX = (point.x - CENTER.x) * view.zoom;
  const scaledY = (point.y - CENTER.y) * view.zoom;
  const rotated = rotateVector(scaledX, scaledY, view.rotation);

  return {
    x: CENTER.x + view.pan.x + rotated.x,
    y: CENTER.y + view.pan.y + rotated.y
  };
}

function svgToLocal(point, view = state.view) {
  const offsetX = point.x - CENTER.x - view.pan.x;
  const offsetY = point.y - CENTER.y - view.pan.y;
  const unrotated = rotateVector(offsetX, offsetY, -view.rotation);

  return {
    x: CENTER.x + unrotated.x / view.zoom,
    y: CENTER.y + unrotated.y / view.zoom
  };
}

function screenToSvg(clientX, clientY) {
  const point = elements.svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;

  const matrix = elements.svg.getScreenCTM();
  if (!matrix) return { x: CENTER.x, y: CENTER.y };

  const converted = point.matrixTransform(matrix.inverse());
  return { x: converted.x, y: converted.y };
}

function screenToLocal(clientX, clientY) {
  return svgToLocal(screenToSvg(clientX, clientY));
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });

  return element;
}

function renderEdges() {
  elements.edgeLayer.replaceChildren();

  state.points.forEach((point, index) => {
    const next = state.points[(index + 1) % state.points.length];
    const line = createSvgElement("line", {
      x1: point.x,
      y1: point.y,
      x2: next.x,
      y2: next.y,
      class: `edge-target${state.addMode ? " add-enabled" : ""}`,
      "data-edge-index": index,
      "stroke-width": 22 / state.view.zoom
    });

    if (state.addMode) {
      line.setAttribute(
        "aria-label",
        `Add a point between points ${index + 1} and ${(index + 1) % state.points.length + 1}`
      );
      line.setAttribute("tabindex", "0");
    }

    line.addEventListener("pointerdown", handleEdgePointerDown);
    line.addEventListener("keydown", (event) => {
      if (state.addMode && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        addPointAtEdge(index, {
          x: (point.x + next.x) / 2,
          y: (point.y + next.y) / 2
        });
      }
    });

    elements.edgeLayer.append(line);
  });
}

function renderPoints() {
  elements.pointLayer.replaceChildren();

  state.points.forEach((point, index) => {
    const group = createSvgElement("g", {
      class: `point-handle${state.selectedIndex === index ? " selected" : ""}`,
      transform: `translate(${point.x} ${point.y})`,
      "data-point-index": index,
      tabindex: "0",
      role: "button",
      "aria-label": `Boundary point ${index + 1}`
    });

    const circle = createSvgElement("circle", {
      r: 18 / state.view.zoom,
      "stroke-width": 4 / state.view.zoom
    });

    const text = createSvgElement("text", {
      "font-size": 16 / state.view.zoom,
      "font-weight": "900",
      "text-anchor": "middle",
      "dominant-baseline": "central",
      "pointer-events": "none"
    });
    text.textContent = String(index + 1);

    group.append(circle, text);
    group.addEventListener("pointerdown", handlePointPointerDown);
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectPoint(index);
      }
    });

    elements.pointLayer.append(group);
  });
}

function renderTransform() {
  const { zoom, rotation, pan } = state.view;
  elements.transform.setAttribute(
    "transform",
    `translate(${CENTER.x + pan.x} ${CENTER.y + pan.y}) rotate(${rotation}) scale(${zoom}) translate(${-CENTER.x} ${-CENTER.y})`
  );
}

function renderPolygon() {
  elements.polygon.setAttribute(
    "points",
    state.points.map((point) => `${point.x},${point.y}`).join(" ")
  );
}

function renderStats() {
  const zoomPercent = Math.round(state.view.zoom * 100);
  const rotation = Math.round(normalizeRotation(state.view.rotation));
  const area = Math.round(polygonArea(state.points)).toLocaleString();

  elements.pointCount.textContent = String(state.points.length);
  elements.areaReadout.textContent = area;
  elements.selectedReadout.textContent =
    state.selectedIndex === null ? "None" : `Point ${state.selectedIndex + 1}`;
  elements.zoomReadout.textContent = `${zoomPercent}%`;
  elements.rotationReadout.textContent = `${rotation}°`;
  elements.zoomStat.textContent = `${zoomPercent}%`;
  elements.rotationStat.textContent = `${rotation}°`;
  elements.historyStat.textContent = `${state.history.length} state${state.history.length === 1 ? "" : "s"}`;

  const validation = validatePoints(state.points);
  elements.validityBadge.textContent = validation.valid ? "Valid" : "Invalid";
  elements.validityBadge.classList.toggle("valid", validation.valid);
  elements.validityBadge.classList.toggle("invalid", !validation.valid);
  elements.validityBadge.title = validation.valid ? "Polygon is valid" : validation.error;
}

function updateControls() {
  elements.undo.disabled = state.historyIndex <= 0;
  elements.redo.disabled = state.historyIndex >= state.history.length - 1;
  elements.deletePoint.disabled =
    state.selectedIndex === null || state.points.length <= LIMITS.minPoints;
  elements.centerSelected.disabled = state.selectedIndex === null;
  elements.addPoint.setAttribute("aria-pressed", String(state.addMode));
  elements.addPoint.classList.toggle("active", state.addMode);
  elements.modeBadge.hidden = !state.addMode;
  elements.selectionBadge.hidden = state.selectedIndex === null;

  if (state.selectedIndex !== null) {
    elements.selectionBadge.textContent = `Point ${state.selectedIndex + 1} selected`;
  }

  elements.svgFrame.classList.toggle("add-mode", state.addMode);

  elements.editorHint.textContent = state.addMode
    ? "Click a highlighted polygon edge to insert a new boundary point."
    : "Drag a numbered point to reshape the land. Drag the canvas to pan.";
}

function render() {
  renderTransform();
  renderPolygon();
  renderEdges();
  renderPoints();
  renderStats();
  updateControls();
}

function showToast(message, type = "success") {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.className = `toast visible ${type}`;

  state.toastTimer = window.setTimeout(() => {
    elements.toast.className = "toast";
  }, 2600);
}

function selectPoint(index) {
  state.selectedIndex = index;
  state.addMode = false;
  render();
}

function handlePointPointerDown(event) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();

  const index = Number(event.currentTarget.dataset.pointIndex);
  selectPoint(index);

  state.gesture = {
    type: "point",
    pointerId: event.pointerId,
    index,
    startClientX: event.clientX,
    startClientY: event.clientY,
    moved: false,
    before: snapshot()
  };

  elements.svg.setPointerCapture?.(event.pointerId);
}

function handleEdgePointerDown(event) {
  if (!state.addMode || event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();

  const edgeIndex = Number(event.currentTarget.dataset.edgeIndex);
  const local = screenToLocal(event.clientX, event.clientY);
  addPointAtEdge(edgeIndex, local);
}

function addPointAtEdge(edgeIndex, requestedPoint) {
  if (state.points.length >= LIMITS.maxPoints) {
    showToast(`Maximum of ${LIMITS.maxPoints} points reached.`, "error");
    return;
  }

  const start = state.points[edgeIndex];
  const end = state.points[(edgeIndex + 1) % state.points.length];
  const projected = projectPointToSegment(requestedPoint, start, end);
  const point = { x: projected.x, y: projected.y };

  state.points.splice(edgeIndex + 1, 0, point);
  state.selectedIndex = edgeIndex + 1;
  state.addMode = false;
  recordHistory();
  render();
  showToast(`Point ${state.selectedIndex + 1} added`);
}

function deleteSelectedPoint() {
  if (state.selectedIndex === null) return;

  if (state.points.length <= LIMITS.minPoints) {
    showToast("A polygon must keep at least three points.", "error");
    return;
  }

  const deleted = state.selectedIndex + 1;
  state.points.splice(state.selectedIndex, 1);
  state.selectedIndex = null;
  recordHistory();
  render();
  showToast(`Point ${deleted} deleted`);
}

function handleSvgPointerDown(event) {
  if (event.button !== 0 || state.addMode) return;
  if (event.target.closest?.(".point-handle, .edge-target")) return;

  event.preventDefault();
  const start = screenToSvg(event.clientX, event.clientY);

  state.gesture = {
    type: "pan",
    pointerId: event.pointerId,
    start,
    originalPan: cloneState(state.view.pan),
    before: snapshot(),
    moved: false
  };

  elements.svgFrame.classList.add("panning");
  elements.svg.setPointerCapture?.(event.pointerId);
}

function handlePointerMove(event) {
  const gesture = state.gesture;
  if (!gesture || event.pointerId !== gesture.pointerId) return;

  if (gesture.type === "point") {
    const local = screenToLocal(event.clientX, event.clientY);
    state.points[gesture.index] = {
      x: clamp(local.x, -LIMITS.maxCoordinate, LIMITS.maxCoordinate),
      y: clamp(local.y, -LIMITS.maxCoordinate, LIMITS.maxCoordinate)
    };

    if (
      Math.abs(event.clientX - gesture.startClientX) > 2 ||
      Math.abs(event.clientY - gesture.startClientY) > 2
    ) {
      gesture.moved = true;
    }

    render();
    return;
  }

  if (gesture.type === "pan") {
    const current = screenToSvg(event.clientX, event.clientY);
    const dx = current.x - gesture.start.x;
    const dy = current.y - gesture.start.y;

    state.view.pan = {
      x: gesture.originalPan.x + dx,
      y: gesture.originalPan.y + dy
    };

    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      gesture.moved = true;
    }

    render();
  }
}

function handlePointerUp(event) {
  const gesture = state.gesture;
  if (!gesture || event.pointerId !== gesture.pointerId) return;

  elements.svgFrame.classList.remove("panning");

  if (gesture.type === "point" && gesture.moved) {
    const validation = validatePoints(state.points);

    if (!validation.valid) {
      state.points = cloneState(gesture.before.points);
      state.view = cloneState(gesture.before.view);
      render();
      showToast(validation.error, "error");
    } else {
      recordHistory();
      render();
    }
  } else if (gesture.type === "pan" && gesture.moved) {
    recordHistory();
    render();
  }

  state.gesture = null;
}

function zoomAroundSvgPoint(nextZoom, anchor) {
  const oldZoom = state.view.zoom;
  const clampedZoom = clamp(nextZoom, LIMITS.minZoom, LIMITS.maxZoom);
  if (Math.abs(oldZoom - clampedZoom) < 1e-6) return false;

  const localAnchor = svgToLocal(anchor);
  state.view.zoom = clampedZoom;
  const movedAnchor = localToSvg(localAnchor);

  state.view.pan.x += anchor.x - movedAnchor.x;
  state.view.pan.y += anchor.y - movedAnchor.y;
  return true;
}

function zoomBy(factor, anchor = CENTER, record = true) {
  if (zoomAroundSvgPoint(state.view.zoom * factor, anchor)) {
    if (record) recordHistory();
    render();
  }
}

function handleWheel(event) {
  event.preventDefault();

  const anchor = screenToSvg(event.clientX, event.clientY);
  const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;

  if (zoomAroundSvgPoint(state.view.zoom * factor, anchor)) {
    render();

    window.clearTimeout(state.wheelTimer);
    state.wheelTimer = window.setTimeout(() => {
      recordHistory();
      render();
    }, 220);
  }
}

function rotateBy(amount) {
  state.view.rotation = normalizeRotation(state.view.rotation + amount);
  recordHistory();
  render();
}

function transformedBounds(points, view) {
  const transformed = points.map((point) => localToSvg(point, view));
  const xs = transformed.map((point) => point.x);
  const ys = transformed.map((point) => point.y);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
}

function fitView(record = true) {
  const unscaledView = {
    zoom: 1,
    rotation: state.view.rotation,
    pan: { x: 0, y: 0 }
  };

  const unscaled = transformedBounds(state.points, unscaledView);
  const padding = 72;
  const availableWidth = VIEWBOX.width - padding * 2;
  const availableHeight = VIEWBOX.height - padding * 2;

  const nextZoom = clamp(
    Math.min(
      availableWidth / Math.max(unscaled.width, 1),
      availableHeight / Math.max(unscaled.height, 1)
    ),
    LIMITS.minZoom,
    LIMITS.maxZoom
  );

  const zeroPanView = {
    zoom: nextZoom,
    rotation: state.view.rotation,
    pan: { x: 0, y: 0 }
  };

  const scaled = transformedBounds(state.points, zeroPanView);
  const boundsCenter = {
    x: (scaled.minX + scaled.maxX) / 2,
    y: (scaled.minY + scaled.maxY) / 2
  };

  state.view.zoom = nextZoom;
  state.view.pan = {
    x: CENTER.x - boundsCenter.x,
    y: CENTER.y - boundsCenter.y
  };

  if (record) recordHistory();
  render();
}

function resetAll() {
  state.points = cloneState(DEFAULT_STATE.points);
  state.view = cloneState(DEFAULT_STATE.view);
  state.selectedIndex = null;
  state.addMode = false;
  recordHistory();
  render();
  showToast("Mapper reset to the default polygon");
}

function toggleAddMode() {
  state.addMode = !state.addMode;
  state.selectedIndex = null;
  render();

  if (state.addMode) {
    showToast("Click any highlighted edge to add a point");
  }
}

function centerSelectedPoint() {
  if (state.selectedIndex === null) return;

  const selected = state.points[state.selectedIndex];
  const currentPosition = localToSvg(selected);

  state.view.pan.x += CENTER.x - currentPosition.x;
  state.view.pan.y += CENTER.y - currentPosition.y;

  recordHistory();
  render();
  showToast(`Point ${state.selectedIndex + 1} centered`);
}

function exportJson() {
  const payload = {
    app: "farm-polygon-mapper",
    version: "1.1",
    exportedAt: new Date().toISOString(),
    points: state.points.map((point) => ({
      x: Number(point.x.toFixed(3)),
      y: Number(point.y.toFixed(3))
    })),
    view: {
      zoom: Number(state.view.zoom.toFixed(4)),
      rotation: Number(normalizeRotation(state.view.rotation).toFixed(2)),
      pan: {
        x: Number(state.view.pan.x.toFixed(3)),
        y: Number(state.view.pan.y.toFixed(3))
      }
    },
    metadata: {
      pointCount: state.points.length,
      approximateArea: Number(polygonArea(state.points).toFixed(2)),
      coordinateSystem: "local-editor-units"
    }
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `farm-polygon-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("Polygon JSON exported");
}

async function importJson() {
  const [file] = elements.importFile.files;
  if (!file) return;

  try {
    if (file.size > LIMITS.maxFileBytes) {
      throw new Error("The selected JSON file is larger than 200 KB.");
    }

    const text = await file.text();
    const parsed = JSON.parse(text);
    const result = validateImportData(parsed);

    if (!result.valid) {
      throw new Error(result.error);
    }

    state.points = cloneState(result.data.points);
    state.view = cloneState(result.data.view);
    state.selectedIndex = null;
    state.addMode = false;
    recordHistory();
    fitView(false);
    recordHistory();
    render();
    showToast(`Imported a valid ${state.points.length}-point polygon`);
  } catch (error) {
    showToast(
      error instanceof Error ? error.message : "The JSON file could not be imported.",
      "error"
    );
  } finally {
    elements.importFile.value = "";
  }
}

function handleKeyboard(event) {
  const activeTag = document.activeElement?.tagName;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) return;

  const command = event.ctrlKey || event.metaKey;

  if (command && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }

  if (command && event.key.toLowerCase() === "y") {
    event.preventDefault();
    redo();
    return;
  }

  if ((event.key === "Delete" || event.key === "Backspace") && state.selectedIndex !== null) {
    event.preventDefault();
    deleteSelectedPoint();
    return;
  }

  if (event.key === "Escape") {
    state.addMode = false;
    state.selectedIndex = null;
    render();
  }
}

elements.undo.addEventListener("click", undo);
elements.redo.addEventListener("click", redo);
elements.addPoint.addEventListener("click", toggleAddMode);
elements.deletePoint.addEventListener("click", deleteSelectedPoint);
elements.zoomOut.addEventListener("click", () => zoomBy(1 / 1.15));
elements.zoomIn.addEventListener("click", () => zoomBy(1.15));
elements.rotateLeft.addEventListener("click", () => rotateBy(-15));
elements.rotateRight.addEventListener("click", () => rotateBy(15));
elements.fit.addEventListener("click", () => fitView());
elements.reset.addEventListener("click", resetAll);
elements.export.addEventListener("click", exportJson);
elements.import.addEventListener("click", () => elements.importFile.click());
elements.importFile.addEventListener("change", importJson);
elements.centerSelected.addEventListener("click", centerSelectedPoint);

elements.svg.addEventListener("pointerdown", handleSvgPointerDown);
elements.svg.addEventListener("pointermove", handlePointerMove);
elements.svg.addEventListener("pointerup", handlePointerUp);
elements.svg.addEventListener("pointercancel", handlePointerUp);
elements.svg.addEventListener("wheel", handleWheel, { passive: false });

document.addEventListener("keydown", handleKeyboard);

state.history = [snapshot()];
state.historyIndex = 0;
fitView(false);
state.history = [snapshot()];
state.historyIndex = 0;
render();
