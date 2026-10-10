#!/usr/bin/env bash
set -euo pipefail

if [ -z "${GH_TOKEN:-}" ]; then
  echo "::error::Set DOCS_SITE_DISPATCH_TOKEN with Contents: write for fantasy-project only."
  exit 1
fi

gh api --method POST repos/cvillarr23/fantasy-project/dispatches \
  -f event_type=docs-updated \
  -f "client_payload[repository]=$SOURCE_REPOSITORY" \
  -f "client_payload[sha]=$SOURCE_SHA"
