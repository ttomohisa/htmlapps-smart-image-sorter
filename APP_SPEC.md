# Smart Image Sorter - App Spec

## Release

- Version: **1.0.0**
- Distribution: single standalone HTML
- Primary UI languages: Japanese / English
- Maximum images per batch: 500
- Runtime network policy: external connections blocked after the HTML is loaded

## User flow

1. Add images or a folder.
2. Enable at least two predefined categories.
3. Start local classification.
4. Review only ambiguous images when needed.
5. Correct individual or selected images.
6. Download original image bytes grouped into category folders inside one ZIP.

On mobile, the bottom navigation exposes **Images / Categories / Results**. Images and Categories scroll to the top edge of the corresponding card with a header offset so the card boundary remains visible.

## Release runtime

- Model: **TinyCLIP ViT-8M/16 · vision-only INT8**
- File: `models/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX/onnx/vision_model_quantized.onnx`
- Size: `8,957,217` bytes
- SHA-256: `bbf8426b0e548881dcfd9257030dd6139fceeeb4808994968b882ecc3ada291f`
- Label embeddings: `data/fixed-label-embeddings.tinyclip-int8.generated.json`
- Category definitions: `data/fixed-label-prototypes.json`

The release runtime calculates image embeddings only. Text/category embeddings are precomputed during development and committed with the repository.

## Category behavior

- The release UI uses predefined fixed categories.
- Eight recommended categories are enabled by default.
- The catalog is data-driven and may be expanded without changing the vision model.
- At least two categories must be active before sorting.
- Match values are relative within the active category set and are not correctness probabilities.

## Review behavior

An item is marked **Needs review** when the top match is below the configured threshold, when the gap between the first and second candidates is small, or both.

Focused review:

- is hidden when no review items remain
- supports previous / next navigation
- shows current review position
- automatically advances after resolving the current review item

## Manual and bulk changes

- Individual cards can accept the AI suggestion or move to another category.
- Multiple selected cards can be reassigned together.
- Bulk reassignment requires the shared confirmation dialog.
- The confirmation uses the localized category label rather than the internal key.

## Per-image failures

Decode or inference errors are stored on the affected image only and do not abort the batch.

Failed items:

- are shown separately
- can be retried individually or together
- can be removed from the working set
- are excluded from category ZIP export

## ZIP export

- Original image bytes are stored without recompression.
- ZIP entry names are sanitized for invalid path characters.
- Filename collision detection is case-insensitive after sanitization.
- Generated suffixes are rechecked, so names such as `foo.jpg`, another `foo.jpg`, and an existing `foo_2.jpg` remain unique.
- Uniqueness is scoped per category folder.
- One ZIP export is limited to 750 MB of source image bytes.

## Work-session persistence

The browser stores compact metadata only:

- active category keys
- review strictness
- file identity metadata
- compact ranking results
- review state
- manual overrides
- per-image failure state

Image bytes and 512-dimensional image embeddings are not persisted.

Restore requires reselecting the same files. Matching uses relative path where available plus filename, byte size, and last-modified timestamp. Work JSON export/import provides an explicit backup path.

## Regression tooling

`index.html#accuracy-test` exposes developer-only regression tools:

- Top-1 / Top-3
- macro accuracy
- recommended-category accuracy
- review rate
- per-category metrics
- common confusions
- JSON / CSV report export
- dataset review thumbnails
- keep / exclude / relabel decisions
- persisted review state and review JSON import/export

## Build and deployment

Normal Windows build:

```bat
setup-and-build.bat
```

Normal builds do not use Python, uv, the full TinyCLIP model, or tokenizer assets.

`main` deployments use `.github/workflows/deploy-pages.yml` to verify the committed release model, fetch pinned browser runtime assets, build `dist/index.html`, verify the standalone artifact, and deploy it with the official GitHub Pages actions.

## Privacy

- No image upload.
- No cloud inference.
- No runtime HTTP/HTTPS connection from the standalone app.
- ZIP/CSV/JSON exports are generated locally.
- The hosted demo requires only the initial HTML delivery.
