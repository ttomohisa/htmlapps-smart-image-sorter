# Contributing

Bug reports and feature proposals are welcome through GitHub Issues.

## Development

- Keep the application usable as a single standalone HTML.
- Keep selected image processing local; do not add runtime network dependencies without an explicit design change.
- Use `src/index.template.html` as the application source of truth.
- Run `setup-and-build.bat` on Windows before release.
- When changing fixed categories or prototype prompts, run `dev-update-label-embeddings.bat` and commit the regenerated label embeddings.
- When changing classification behavior, run the regression tools described in `tests/accuracy/README.md`.

See [DEVELOPMENT.md](DEVELOPMENT.md) for model/category maintenance details.
