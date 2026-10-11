# Changelog

## 1.0.5 - 2026-10-10

- Keep modal Help within short and narrow viewports with a fixed header and scrollable body, and prevent background page scrolling while it is open.
- Keep the narrow header version visible with wrapping title/version and stable utility controls.
- Add Help layout regression contracts to the existing source/generated CI gate.

## 1.0.4 - 2026-10-09

- Normalize brand icon backgrounds to #16624f with exact 25% corner radii across SVG assets, header icons, and embedded favicons, preserving existing artwork.
- Add focused brand representation regression checks.

## 1.0.3 - 2026-10-09

- Add the canonical default screenshot path for catalog checks, preserving the existing Japanese screenshot bytes.

## 1.0.2 - 2026-10-09

- Refresh the app icon, header artwork, and standalone favicon with the supplied Smart Image Sorter design.

## 1.0.1 - 2026-10-08

- Normalize header EN / JA labels and localized language/Help tooltips and accessible names.
- Dismiss Help on a click outside its actual dialog bounds, keep inside clicks open, and return focus to its opener after dismissal.
- Keep the visible app version and release metadata synchronized; normalize existing Japanese local-processing badges without changing processing behavior.

## 1.0.0 - 2026-08-29

Initial public release.

- Local TinyCLIP image sorting with predefined categories
- Focused needs-review workflow and manual/bulk correction
- Per-image processing failure isolation and retry/removal
- Original-byte category ZIP export with filename collision handling
- Autosave / restore and work JSON backup
- Developer category regression and dataset-review tooling
- Japanese / English UI
- Single-HTML offline build and GitHub Pages deployment workflow
