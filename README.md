# Farm Polygon Mapper

A lightweight, browser-based editor for reshaping, rotating, zooming and exporting irregular farm or land polygons.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Open_Mapper-166534?style=for-the-badge)](https://fatiboams.github.io/farm-polygon-mapper/)
[![License: MIT](https://img.shields.io/badge/License-MIT-0f172a?style=for-the-badge)](LICENSE)
[![Built with HTML, CSS and JavaScript](https://img.shields.io/badge/Built_with-HTML%20%7C%20CSS%20%7C%20JavaScript-15803d?style=for-the-badge)](#technology)

![Farm Polygon Mapper application preview](docs/farm-polygon-mapper-preview.png)

## Overview

Farm Polygon Mapper provides a simple visual interface for working with irregular farm and land boundaries. Users can drag numbered boundary points, rotate and zoom the polygon, fit it to the viewer, review an approximate area, and save or restore the current shape using JSON.

## Features

- Interactive irregular polygon editor
- Draggable numbered boundary points
- Zoom in and zoom out
- Clockwise and counter-clockwise rotation
- Fit polygon to the available viewer
- Reset to the default polygon
- Approximate polygon-area calculation
- Boundary-point count
- Current zoom and rotation indicators
- JSON export
- JSON import
- Responsive browser layout
- No account, database or backend required

## Live demo

Open the hosted application:

**https://fatiboams.github.io/farm-polygon-mapper/**

## How it works

1. Drag any numbered point to reshape the boundary.
2. Use the zoom and rotation controls to inspect the polygon.
3. Select **Fit view** to return the polygon to a clear viewing position.
4. Review the point count and approximate area.
5. Export the polygon as JSON to save it locally.
6. Import a compatible JSON file to restore the saved shape.

## Data and privacy

The application has no backend and does not intentionally upload polygon data to a server.

Exported JSON files are created locally in the browser. Imported JSON files are read locally and used to rebuild the polygon.

## Run locally

1. Download or clone this repository.
2. Open `index.html` in a modern browser.
3. Drag the polygon points or use the controls.

No package installation or build command is required.

## Project structure

```text
farm-polygon-mapper/
├── src/
│   ├── app.js
│   └── styles.css
├── docs/
│   └── farm-polygon-mapper-preview.png
├── index.html
├── .gitignore
├── LICENSE
└── README.md
```

## JSON format

A typical export contains the application version, rotation, zoom and polygon points:

```json
{
  "version": 1,
  "rotation": 0,
  "zoom": 1,
  "points": [
    { "x": 190, "y": 150 },
    { "x": 650, "y": 100 }
  ]
}
```

At least three valid points are required when importing a polygon.

## Technology

- Semantic HTML
- Responsive CSS
- Vanilla JavaScript
- SVG
- Pointer Events API
- File and Blob APIs
- GitHub Pages

## Roadmap

- [ ] Add new boundary points
- [ ] Delete selected boundary points
- [ ] Add undo and redo
- [ ] Add mouse-wheel zoom and panning
- [ ] Improve automatic fit-to-view
- [ ] Export GeoJSON
- [ ] Export SVG
- [ ] Add grid snapping
- [ ] Add perimeter measurement
- [ ] Add automated browser tests

## Contributing

Bug reports, feature suggestions and pull requests are welcome. Avoid including confidential land records, ownership information or precise private coordinates in public issues.

## License

Released under the [MIT License](LICENSE).
