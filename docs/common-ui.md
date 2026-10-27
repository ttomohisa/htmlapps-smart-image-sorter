# Shared UI 1.0.0

The build embeds fixed canonical JS/CSS verified by the lock; no new runtime request. The existing TinyCLIP model, precomputed labels, ONNX/Transformers versions and byte-preserving ZIP/CSV/JSON formats remain unchanged. Explicit LF attributes keep component hashes stable in Windows checkouts.

The working area shows dirty, saving, confirmed save time and persistent failure. The existing metadata schema is retained; image bytes remain in this tab and restoration still requires the original files. Failed autosave keeps current work and offers Retry save and project JSON. Developer review decisions have a separate persistent failure notice and review JSON escape.

Delete saved data confirms metadata-only scope, leaves current images and language preferences intact, and reports removal failure without claiming success. Clear images confirms its full current/saved metadata scope and does not change original files. Restore validates before confirming replacement; invalid developer review imports cannot partially mutate decisions. Cancel is initially focused, Escape/backdrop cancel, and opener focus is restored by the existing dialog.

Classification and ZIP expose busy/stopping states and reject duplicate requests. Generation checks after awaited analysis prevent stale results from committing across Clear/restore. ZIP captures category folders and edited filename before awaiting bytes. Dirty classification results cannot be exported as current ZIP. Filters/search/selection do not change whole-batch output scope.

Language is resolved URL/shared/legacy/browser/en without startup preference writes. Explicit switches persist only the common key and preserve input, search, selection and work. Blocked preference writes show screen-only notice; persistent output failure remains translated with retry guidance. The editable filename base applies to all existing output extensions.

`scripts/check-common-ui.ps1` parses PowerShell, rebuilds, checks source/all generated runtime regressions, icon/help/visual assets, model/hash/CSP and release parity. No browser, native inference, actual download delivery or layout/device acceptance is claimed. Category/filter selection chips retain their selection appearance; action controls opt into shared colors/targets.
