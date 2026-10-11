# Security policy

## Reporting a vulnerability

Report vulnerabilities privately. Don't open a public issue or pull request.

1. Open a [private security advisory](https://github.com/cvillarr23/fantasy-project/security/advisories/new) on the affected repository (GitHub **Security** tab → **Report a vulnerability**).
2. Include what you found, the affected repo and version or commit, steps to reproduce, and the impact.
3. Don't include real credentials, ESPN cookies, or other people's data in the report. Redact them.

Expect an acknowledgement within 7 days. We'll keep you updated, and credit you in the fix if you want.

## Scope

| In scope | Out of scope |
|---|---|
| Code and configuration in the fantasy-project, core-pipeline, browser-worker, web-ui and infra repositories | ESPN's own services and endpoints |
| Leaked credentials or personal data in a repo or its history | Findings that need a compromised maintainer account or cluster |
| Weaknesses in the approval gates for trades, waivers and lineup changes | Reports from automated scanners with no demonstrated impact |

## If you find a leaked secret

Tell us privately as above. Rotate the credential first; removing it from a file doesn't remove it from Git history.

## Supported versions

Only the latest commit on each repository's default branch (`main`, or `master` for web-ui) is supported.

## Related

The [disclaimer](DISCLAIMER.md) explains the project's scope and what it doesn't do.
