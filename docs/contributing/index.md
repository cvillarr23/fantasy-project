---
title: Contributing
description: How to work on the fantasy-* repos and on these docs.
sidebar_position: 6
---

:::info[Stub]

This section is a placeholder. It will cover:

- Branches, pull requests and the ticket workflow on the wayfinder map.
- Running each repo's tests and checks.

:::


## Working on these docs

The site is built with [Docusaurus](https://docusaurus.io/) from the `docs/` folder of this repo. From the repo root:

```bash
npm ci
npm start        # dev server with live reload
npm run build    # production build; fails on broken links
```

Follow the [docs style guide](./docs-style-guide.md) when adding or editing pages.
