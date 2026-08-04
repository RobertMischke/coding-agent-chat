# Rendering stream captures

These fixtures pin the content boundary between supported coding-agent CLIs
and `coding-agent-chat/core`. They contain sanitized JSONL frames: volatile
session IDs, signatures, token counts, costs, and local paths are removed,
while assistant payload text and transport field names stay unchanged.

- `claude-2.1.220.stream.json` was recorded with
  `claude -p --output-format stream-json --verbose`.
- `codex-0.146.0.stream.json` was recorded with `codex exec --json`.
- `gemini-0.49.0.stream.json` uses the runner-normalized message frame retained
  by the parity archive. The local capture runner had no non-interactive Gemini
  credentials, so the checked-in archival capture is used rather than
  refreshing it.

GitHub Copilot CLI is not currently a supported `coding-agent-runner`
transport, so it has no stream fixture in this suite. Add a capture only after
the runner exposes Copilot assistant output through its normalized message
contract.

Every capture contains the same matrix: C# source, git diff, a complete HTML
file, conversational Markdown, an image reference, nested JSON, raw logs, a
long line, and a mixed prose/source turn. Tables, Mermaid, and ANSI are included
because they exercise three distinct hazards: pipe-heavy Markdown, fenced
diagram syntax, and terminal control sequences.

The opt-in suite is intentionally outside the standard `npm test` path. Run it
with:

```sh
npm run test:render-fixtures
```

The suite replays the actual CLI envelope, extracts the recorded assistant
matrix, projects each case, and snapshots the typed content contract. Only
`markdown` is allowed to reach Markdown parsing; all raw/file-oriented payloads
must remain typed.
