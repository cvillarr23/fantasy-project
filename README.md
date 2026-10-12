# fantasy-project
Cross-cutting planning/epics for the fantasy-* project — home of the wayfinder map and the project docs site.

Fantasy Project is unofficial and not affiliated with ESPN or Disney. It is for personal use on your own leagues. Read the [disclaimer and scope](DISCLAIMER.md) before using it.

The docs site is [Docusaurus](https://docusaurus.io/), built from this repo's `docs/`
and the four source repositories' `docs/` folders. Local development reads sibling
checkouts (`../fantasy-core-pipeline`, `../fantasy-browser-worker`,
`../fantasy-web-ui`, `../fantasy-infra`). Update them to their default branches to
preview current docs; web-ui uses `master`, the others use `main`.

```bash
npm ci
npm start        # dev server
npm run build    # production build; fails on broken links
```

Missing local repos show section placeholders. Set `FANTASY_DOCS_ROOT` to use
another directory of checkouts, and `FANTASY_DOCS_REQUIRED=true` to require all four
repos for a complete build. CI imports each source's default branch and rebuilds
after docs changes, with a nightly fallback.

See [the docs style guide](docs/contributing/docs-style-guide.md) before adding
pages and [docs site deploys](docs/contributing/docs-site-deploys.md) for credentials
and rebuild instructions.

## License

Code, configuration and documentation are licensed under the [MIT License](LICENSE).
Third-party dependencies retain their own licenses.
The docs build includes `LICENSE.txt` and `THIRD_PARTY_LICENSES.txt` with the static assets.
See [licensing and dependency notices](docs/contributing/licensing.md) for audit results
and redistribution requirements.
