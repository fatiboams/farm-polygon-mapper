# Farm Polygon Mapper v1.1.0

## Feature release

Version 1.1.0 turns the original polygon viewer into a more capable local-first editor.

### Added

- Add-point mode with edge insertion
- Delete selected boundary point
- Minimum three-point protection
- Undo and redo history
- Mouse-wheel zoom centered at the pointer
- Canvas panning
- Center-selected-point control
- Keyboard shortcuts
- Selection and editing-mode indicators
- Geometry validation module
- Node-based geometry tests

### Improved

- Rotation-aware fit-to-view
- JSON import error messages
- JSON coordinate and file-size limits
- Duplicate-point rejection
- Self-intersection protection
- Responsive toolbar and mobile presentation
- Accessibility labels and focus styles
- Export metadata

### Validation

The release was checked with:

- JavaScript syntax validation for `src/app.js`
- JavaScript syntax validation for `src/geometry.js`
- Geometry unit tests
- HTML asset-path validation
- ZIP structure verification

### Known limitations

- Coordinates are local editor units rather than geographic coordinates.
- GeoJSON and SVG export are not yet available.
- The app is not a certified surveying tool.
