const defaultPoints = [
  { x: 190, y: 150 },
  { x: 650, y: 100 },
  { x: 850, y: 260 },
  { x: 760, y: 540 },
  { x: 410, y: 610 },
  { x: 150, y: 430 }
];

let points = structuredClone(defaultPoints);
let zoom = 1;
let rotation = 0;
let activeIndex = null;

const svg = document.querySelector("#polygonSvg");
const polygon = document.querySelector("#farmPolygon");
const handlesLayer = document.querySelector("#handlesLayer");
const transformLayer = document.querySelector("#transformLayer");
const statusText = document.querySelector("#statusText");
const pointCount = document.querySelector("#pointCount");
const areaValue = document.querySelector("#areaValue");
const zoomValue = document.querySelector("#zoomValue");
const rotationValue = document.querySelector("#rotationValue");
const fileInput = document.querySelector("#jsonFile");

function polygonArea(items) {
  return Math.abs(items.reduce((sum, point, index) => {
    const next = items[(index + 1) % items.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2);
}

function centroid(items) {
  const total = items.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: total.x / items.length, y: total.y / items.length };
}

function render() {
  polygon.setAttribute("points", points.map(({ x, y }) => `${x},${y}`).join(" "));
  handlesLayer.replaceChildren();

  points.forEach((point, index) => {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.classList.add("handle");
    group.dataset.index = String(index);

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", point.x);
    circle.setAttribute("cy", point.y);
    circle.setAttribute("r", 22);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", point.x);
    label.setAttribute("y", point.y + 1);
    label.textContent = String(index + 1);

    group.append(circle, label);
    handlesLayer.append(group);
  });

  const center = centroid(points);
  transformLayer.setAttribute(
    "transform",
    `translate(${center.x} ${center.y}) rotate(${rotation}) scale(${zoom}) translate(${-center.x} ${-center.y})`
  );

  const roundedZoom = Math.round(zoom * 100);
  statusText.textContent = `Zoom ${roundedZoom}% · Rotation ${rotation}°`;
  pointCount.textContent = String(points.length);
  areaValue.textContent = `${Math.round(polygonArea(points)).toLocaleString()} units²`;
  zoomValue.textContent = `${roundedZoom}%`;
  rotationValue.textContent = `${rotation}°`;
}

function clientToSvg(clientX, clientY) {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  return point.matrixTransform(transformLayer.getScreenCTM().inverse());
}

function setZoom(nextZoom) {
  zoom = Math.min(2.5, Math.max(0.35, nextZoom));
  render();
}

handlesLayer.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest(".handle");
  if (!handle) return;
  activeIndex = Number(handle.dataset.index);
  svg.setPointerCapture(event.pointerId);
});

svg.addEventListener("pointermove", (event) => {
  if (activeIndex === null) return;
  const next = clientToSvg(event.clientX, event.clientY);
  points[activeIndex] = {
    x: Math.min(970, Math.max(30, next.x)),
    y: Math.min(670, Math.max(30, next.y))
  };
  render();
});

function stopDragging(event) {
  activeIndex = null;
  if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
}

svg.addEventListener("pointerup", stopDragging);
svg.addEventListener("pointercancel", stopDragging);

document.querySelector("#zoomIn").addEventListener("click", () => setZoom(zoom + 0.1));
document.querySelector("#zoomOut").addEventListener("click", () => setZoom(zoom - 0.1));
document.querySelector("#rotateLeft").addEventListener("click", () => {
  rotation = (rotation - 15 + 360) % 360;
  render();
});
document.querySelector("#rotateRight").addEventListener("click", () => {
  rotation = (rotation + 15) % 360;
  render();
});
document.querySelector("#fitView").addEventListener("click", () => {
  zoom = 1;
  render();
});
document.querySelector("#resetPolygon").addEventListener("click", () => {
  points = structuredClone(defaultPoints);
  zoom = 1;
  rotation = 0;
  render();
});

document.querySelector("#exportJson").addEventListener("click", () => {
  const data = JSON.stringify({ version: 1, rotation, zoom, points }, null, 2);
  const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "farm-polygon.json";
  anchor.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#importJson").addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const [file] = fileInput.files;
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    const validPoints = Array.isArray(parsed.points)
      && parsed.points.length >= 3
      && parsed.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

    if (!validPoints) throw new Error("Invalid polygon data.");

    points = parsed.points.map(({ x, y }) => ({ x, y }));
    zoom = Number.isFinite(parsed.zoom) ? Math.min(2.5, Math.max(0.35, parsed.zoom)) : 1;
    rotation = Number.isFinite(parsed.rotation) ? ((parsed.rotation % 360) + 360) % 360 : 0;
    render();
  } catch (error) {
    alert(error instanceof Error ? error.message : "Could not import this file.");
  } finally {
    fileInput.value = "";
  }
});

render();
