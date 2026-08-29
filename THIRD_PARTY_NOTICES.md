# Third-Party Notices

Smart Image Sorter bundles third-party software/model assets into its generated standalone HTML. Their licenses remain applicable to those components.

## TinyCLIP

- Model family: TinyCLIP
- Runtime source lineage: `onnx-community/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX`
- Upstream project: `wkcn/TinyCLIP`
- Release runtime: extracted vision-only INT8 ONNX
- The 8,957,217-byte release ONNX is committed directly to this repository
- SHA-256: `bbf8426b0e548881dcfd9257030dd6139fceeeb4808994968b882ecc3ada291f`
- License copy after setup: `models/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX/LICENSE`

The full TinyCLIP ONNX and tokenizer files are developer-only maintenance assets. They are downloaded on demand when label embeddings need to be regenerated or when the release vision model is re-extracted. They are not embedded into the final HTML.

## Transformers.js

- Package: `@huggingface/transformers` 3.8.1
- License: Apache-2.0
- License copy after setup: `vendor/transformers/TRANSFORMERS-LICENSE`

## ONNX Runtime Web

- Package: `onnxruntime-web` `1.22.0-dev.20250409-89f8206ba4`
- License: MIT
- License copy: `vendor/transformers/ONNXRUNTIME-LICENSE`

## ONNX Python package

- Not used by normal setup/build.
- Used only by the optional developer command that re-extracts the TinyCLIP vision subgraph.
- Installed into the project-local uv environment `.venv-onnx`.
- Not embedded into the final HTML.
