# Smart Image Sorter

[![GitHub Pages](https://github.com/ttomohisa/htmlapps-smart-image-sorter/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/ttomohisa/htmlapps-smart-image-sorter/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Single HTML](https://img.shields.io/badge/distribution-single%20HTML-0ea5e9)](https://ttomohisa.github.io/htmlapps-smart-image-sorter/)
[![Local AI](https://img.shields.io/badge/processing-local%20AI-16624F)](#privacy-and-runtime-network-protection)

[日本語版 README](README.ja.md)

Smart Image Sorter is a single-HTML browser app for sorting batches of images with local AI. It classifies up to 500 images into predefined categories, lets you review uncertain results, and downloads the original files grouped into category ZIP folders.

Selected images are not uploaded by the app. Classification, review, work-session metadata, and ZIP generation stay on the device.

## 🚀 Live demo

### [Open Smart Image Sorter on GitHub Pages](https://ttomohisa.github.io/htmlapps-smart-image-sorter/)

GitHub Pages serves the initial HTML. After it loads, image processing runs locally in the browser. No installation or account is required.

## Screenshots

`assets/screenshot.png` is the canonical catalog copy of the existing Japanese screenshot (`assets/screenshot-ja.png`).

### English UI

![Smart Image Sorter English UI showing sorting results and the needs-review flow](assets/screenshot-en.png)

### 日本語 UI

![Smart Image Sorter Japanese UI showing sorting results and the needs-review flow](assets/screenshot-ja.png)

## Features

- **Sort up to 500 images at once** — Add individual images or choose a folder.
- **Predefined category catalog** — Start with eight recommended categories and enable only what you need from the built-in catalog.
- **Find results quickly** — Search filenames and relative folder paths alongside category, review, and failed filters. Search only changes the view; exports still cover the full batch.
- **Review only uncertain results** — Images with close or low-scoring candidates are separated into a focused review flow.
- **Manual and bulk correction** — Move individual images or selected images to another category. Bulk changes require confirmation.
- **Failure isolation** — A broken or unsupported image does not stop the rest of the batch; failed items can be retried or removed.
- **Original bytes in category ZIPs** — Images are not recompressed when exported. Filename collisions are resolved safely inside each category folder.
- **Autosave and restore** — Classification results and manual edits are saved locally; reselect the same files to restore the work session.
- **Single-HTML local runtime** — TinyCLIP vision-only INT8, label embeddings, Transformers.js, and ONNX Runtime Web are embedded into the release HTML.
- **Japanese / English UI** — Both languages are included in the same file.

## Quick start

### Use the web demo

Open the [GitHub Pages demo](https://ttomohisa.github.io/htmlapps-smart-image-sorter/), add images, choose at least two categories, and start sorting.

### Build a standalone HTML on Windows

1. Download or clone this repository.
2. Run:

```bat
setup-and-build.bat
```

3. Open the generated `index.html`.

The first setup downloads the pinned browser runtime files and TinyCLIP metadata. The release vision-only INT8 ONNX model and precomputed label embeddings are committed to the repository.

Normal builds do not require Python, uv, or the ONNX Python package. After setup assets are available, rebuild with:

```bat
build-standalone.bat
```

## Usage

1. **Add images** — Choose JPEG / PNG / WebP / AVIF files or a folder containing them.
2. **Choose categories** — Eight recommended categories are enabled initially. Keep only the categories relevant to the batch; at least two are required.
3. **Start sorting** — The local TinyCLIP vision model calculates image embeddings and compares them with precomputed category label embeddings.
4. **Review uncertain images** — Use the needs-review flow only when the app flags ambiguous results.
5. **Correct results if needed** — Change one image, or select several and apply a confirmed bulk change.
6. **Download the category ZIP** — Original image bytes are grouped by category without recompression.

### What “Needs review” means

An image is sent to review when its top match is relatively low, when the first and second candidates are close, or both. The displayed match value is a **relative score among the currently enabled categories**, not the probability that the result is correct.

### Failed images

Decode or inference failures are separated from normal results. Other images continue processing. Failed items can be retried individually or together, or removed from the working set. Failed images are not included in the category ZIP.

### Search results

Use **Search filenames and folders** to find classified or failed items by filename or supplied relative folder path. Matching is a trimmed, case-insensitive literal substring, including punctuation and Japanese text. Search combines with the selected category, Needs Review, or Failed filter; pending images are not Results cards.

The matching count and 60-card pages follow the search. Previous/next review and automatic advance stay within matching review items. **Select displayed** adds only classified cards on the current page, while previously selected hidden items remain selected and included in the total selection count. Existing bulk actions still act on that total selection.

**Clear search** restores the current filter's unsearched view. Search is temporary, survives language switching, and resets when clearing images or starting restore. It is not autosaved or included in work JSON. ZIP, CSV, and JSON keep their existing whole-batch scope regardless of search; ZIP still excludes failed and pending images.

### Autosave and restore

The app stores category selection, strictness, compact classification results, review state, manual corrections, and file identity metadata in the browser. It does **not** save image bytes or image embeddings.

To restore work, reselect the same files or folder. Matching uses relative path when available, plus filename, size, and last-modified time. Work JSON export/import is available as an explicit backup. Replacing an open work session asks for confirmation and saves the previous work in a local backup (Manage work data → Restore work before replacement). While some files are still waiting to be reselected, autosave and work JSON export preserve both current edits and unmatched restore records. Images are not backed up, so the original files must still be reselected.

During sorting, adding/removing images, changing categories or review strictness, retrying failed images, and replacing saved work are temporarily unavailable. Cancel sorting first to change these inputs. ZIP export uses category assignments captured when ZIP creation begins, even if results or interface language subsequently change.

If you start a new batch without restoring a previous autosave, the previous work is backed up before the new batch is saved. Work opened in another tab is protected by a saved-content conflict check; if another tab changes it, autosave pauses and asks you to export a work JSON. This is best-effort protection against cross-tab overwrites, not a transactional lock. Failed deletion of saved work is reported rather than shown as completed. Work JSON generation and validation share the same record-count limit. CSV fields that begin with spreadsheet formula characters are prefixed to reduce formula-injection risk; spreadsheet behavior should still be checked when exporting externally sourced names.

Corrupted or incompatible work JSON is rejected before replacing the open work. If categories change during a partial restore, unmatched records are kept without outdated automatic scores; re-sort them with the current categories. Needs Review is recalculated using the current strictness. Autosave failures are explicitly shown so you can export a work JSON manually. **Delete all saved work** clears both the autosave and its local recovery backup; **Delete current autosave** only clears the current saved session.

ZIP export calculates checksums incrementally from original image file streams and builds the ZIP from original File/Blob references rather than retaining copied whole-file buffers. The 750 MB size limit still applies, and large exports can be slow or hit device memory limits. Filenames are sanitized while preserving extensions and complete Unicode code points; downloadable Blob URLs remain valid for 60 seconds after download is started.

Different known relative paths are kept as separate images even when filename, size, and timestamp match. Paths and filenames retain case; backslashes in supplied paths are normalized. Repeated selections of the same full identity are deduplicated. Selecting the same file individually and through a folder may produce separate entries because a pathless selection does not prove a folder identity.

Restore reads existing schema-v1 work JSON from raw file metadata, including legacy saved keys. Exact identities take priority. A missing-path fallback is allowed only for a unique, one-to-one metadata match, never across conflicting known paths. Ambiguous candidates stay unrestored with a prompt to reselect the original folder; each saved record restores at most one loaded image. No image bytes or hashes are read to establish identity.

## Releases

Version **v1.0.6** is prepared by PR #11. After merging into `main`, the **Publish versioned GitHub Release** workflow validates the app, rebuilds `dist/index.html` from the tracked source and bundled assets, and publishes a tag `v1.0.6` with three downloads: the standalone HTML, a ZIP containing that same HTML with licensing/docs/assets, and `SHA256SUMS.txt`. It does not release on PR branches and does not overwrite existing releases. The workflow can also be re-run manually on `main` if it fails.

For a pre-merge download, use the GitHub Actions **Validate standalone HTML** run's `smart-image-sorter-release-candidate-...` artifact. The historical checked-in repository-root `smart-image-sorter.html` is **not** the release artifact. Always use the generated `dist/index.html` or the versioned GitHub Release HTML, which include the current source and embedded model.

This workflow cannot establish cross-browser compatibility alone: manual checks with Safari, Firefox, actual smartphones, and large ZIP files remain relevant before wider distribution.

## Fixed categories and developer maintenance

Normal users choose from the predefined catalog. The release UI does not accept arbitrary free-text categories.

Category definitions live in:

```text
data/fixed-label-prototypes.json
```

When adding/removing a category or changing its prototype prompts:

```bat
dev-update-label-embeddings.bat
build-standalone.bat
```

`dev-update-label-embeddings.bat` regenerates:

```text
data/fixed-label-embeddings.tinyclip-int8.generated.json
```

Changing category definitions **does not require rebuilding the release TinyCLIP vision-only model**. The normal build verifies that the category definitions and committed label embeddings match and stops if they are stale.

Only vision-model replacement/re-extraction uses `dev-reextract-vision-model.bat` and the project-local Python / uv / ONNX maintenance environment. See [DEVELOPMENT.md](DEVELOPMENT.md).

## Category regression test

A developer-only regression screen is available at:

```text
index.html#accuracy-test
```

It reports Top-1 / Top-3, macro accuracy, recommended-category accuracy, review rate, per-category accuracy, and common confusions. It also includes a dataset-review UI for keeping, excluding, or relabeling test images.

Useful commands:

```bat
collect-regression-images.bat
check-regression-dataset.bat -Strict
```

See [tests/accuracy/README.md](tests/accuracy/README.md) for details.

## Publish with GitHub Pages

The repository includes GitHub Actions for pull-request build validation and automatic deployment from `main`.

1. Open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions** once.
2. Push to `main`.
3. **Deploy standalone app to GitHub Pages** verifies the committed release model, downloads pinned runtime assets, builds `dist/index.html`, checks the standalone CSP/build markers, and deploys `dist`.
4. The demo is published at `https://ttomohisa.github.io/htmlapps-smart-image-sorter/`.

If Pages has not been enabled yet, the build succeeds and the workflow summary explains the one-time setup while skipping deployment.

## Development and build layout

```text
.
├─ src/index.template.html
├─ app.config.json
├─ schemas/app-config.schema.json
├─ assets/
│  ├─ favicon.svg
│  ├─ screenshot.png
│  ├─ screenshot-en.png
│  └─ screenshot-ja.png
├─ data/
│  ├─ fixed-label-prototypes.json
│  └─ fixed-label-embeddings.tinyclip-int8.generated.json
├─ models/
│  └─ TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX/
│     └─ onnx/vision_model_quantized.onnx
├─ tools/
├─ tests/
├─ .github/workflows/
│  ├─ build-standalone.yml
│  └─ deploy-pages.yml
├─ setup-and-build.bat
└─ build-standalone.bat
```

The committed release model is 8,957,217 bytes and has SHA-256:

```text
bbf8426b0e548881dcfd9257030dd6139fceeeb4808994968b882ecc3ada291f
```

## Privacy and runtime network protection

The generated standalone HTML is designed to keep user images on the device.

- Selected images are not uploaded by the app.
- The AI model and required browser runtime are embedded into the release HTML.
- Content Security Policy blocks external runtime network access.
- ZIP generation runs locally in the browser.
- Autosave does not include image bytes.

The hosted demo still requires the initial HTML request. For fully disconnected use, build `index.html`, disconnect the network, and open the file locally. See [VERIFY_OFFLINE.md](VERIFY_OFFLINE.md).

## Limitations

- Up to 500 images can be loaded in one batch.
- Categories are predefined at build time.
- Match values are relative scores, not correctness probabilities.
- Image decoding support varies by browser and platform.
- Large batches of high-resolution images can use substantial device memory.
- ZIP creation is limited to 750 MB of selected source images in one export.
- Failed images are excluded from the category ZIP.
- Work restore requires reselecting the original image files.

## Components

| Component | Version / configuration | License | Purpose |
| --- | --- | --- | --- |
| TinyCLIP | ViT-8M/16 vision-only INT8 | See upstream model terms | Image embedding |
| @huggingface/transformers | 3.8.1 | Apache-2.0 | Model preprocessing and browser runtime support |
| onnxruntime-web | 1.22.0-dev.20250409-89f8206ba4 | MIT | ONNX inference |

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for third-party details.

## Contributing

Bug reports and feature proposals are welcome through GitHub Issues. See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidance.

## License

Copyright © 2026 ttomohisa

Licensed under the [MIT License](LICENSE).
