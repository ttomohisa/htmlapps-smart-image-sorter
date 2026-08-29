# Offline Verification

After `setup-and-build.bat` completes:

1. Disconnect the network or use DevTools Network → Offline.
2. Open `index.html` directly with `file://`.
3. Add a few images.
4. Enable at least two categories.
5. Run sorting.
6. Export CSV, JSON, and a category ZIP.

Expected behavior:

- Classification succeeds without network access.
- No HTTP/HTTPS request is made during classification.
- CSP contains `connect-src blob:` and `'wasm-unsafe-eval'`.
- ZIP contains original image bytes grouped under category folders.
- The release runtime reports TinyCLIP vision-only INT8.

Build integrity checks:

- `vision_model_quantized.onnx` must already exist in the repository.
- Its SHA-256 must match the release manifest.
- committed label embeddings must match the current category/prototype definitions.
- stale label embeddings fail the build with a developer update command instead of being regenerated implicitly.

Normal setup/build does not use Python, uv, ONNX graph extraction, the TinyCLIP full model, or tokenizer assets.

Work-session verification:

1. Classify several images and manually change at least one category.
2. Confirm the work-session status changes to autosaved.
3. Reload the page while still offline.
4. Click the restore action, then reselect the same image files or folder.
5. Confirm classification results and manual changes return without any network request.
6. Export a work JSON and verify it contains metadata/results but no image bytes or data URLs.
