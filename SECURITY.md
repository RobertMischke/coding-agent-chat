# Security policy

## Supported versions

`coding-agent-chat` is pre-1.0. Security fixes are provided for the latest
released minor version. Older minor versions are not supported.

| Version | Supported |
| ------- | --------- |
| 0.3.x   | Yes       |
| < 0.3   | No        |

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use
[GitHub's private vulnerability reporting flow](https://github.com/agent-orc/chat/security/advisories/new)
to send the maintainers a report.

Include the affected version, impact, reproduction steps or a proof of concept,
and any known mitigations. The maintainers will acknowledge the report through
the advisory and use that private thread for follow-up and disclosure
coordination.

## Scope notes

This library renders untrusted agent and user content in the browser, so the
following are in scope and worth reporting:

- markup or script that survives the Markdown sanitiser and executes in a host
  application (`<cac-markdown>`, `<cac-conversation-view>`, `<cac-chat>`);
- attachment references that escape the contract root, resolve outside the
  project directory, or bypass the SHA-256 content check
  (`coding-agent-chat/core`, `coding-agent-chat/node`);
- inline reference renderers or task-reference providers that can be driven into
  executing host-supplied content from message text.

Vulnerabilities in a host application's own transport, authentication, or media
endpoints are out of scope here — report those to that project.

## Released artifacts

Published packages carry npm provenance and a `release-manifest.json` (version,
tag, commit, build timestamp, SHA-512 digests). An unpacked package can be
verified with `node scripts/verify-release.mjs <directory>`; a manifest mismatch
on a package that claims to be a release is worth a report.
