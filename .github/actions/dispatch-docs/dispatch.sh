#!/usr/bin/env bash
set -euo pipefail

if [ -z "${GH_TOKEN:-}" ]; then
  echo "::error::Set DOCS_SITE_DISPATCH_TOKEN with Contents: write for fantasy-project only."
  exit 1
fi

# curl rather than the gh CLI, so the action works on runner images that ship
# curl but not gh, such as actions-runner. The token goes in through a config on stdin so it never shows
# up in the process's arguments.
printf 'header = "Authorization: Bearer %s"\n' "$GH_TOKEN" |
  curl --config - --fail-with-body --silent --show-error \
    --retry 2 \
    --request POST \
    --header 'Accept: application/vnd.github+json' \
    --header 'X-GitHub-Api-Version: 2022-11-28' \
    --data "{\"event_type\":\"docs-updated\",\"client_payload\":{\"repository\":\"$SOURCE_REPOSITORY\",\"sha\":\"$SOURCE_SHA\"}}" \
    https://api.github.com/repos/cvillarr23/fantasy-project/dispatches
