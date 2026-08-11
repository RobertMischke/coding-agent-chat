# Rendering stream captures

These fixtures pin the content boundary between supported coding-agent CLIs
and `coding-agent-chat/core`. They contain sanitized JSONL frames: volatile
session IDs, signatures, token counts, costs, and local paths are removed,
while assistant payload text and transport field names stay unchanged.

- `claude/2.1.x/content-matrix.stream.json` was recorded with
  `claude -p --output-format stream-json --verbose`.
- `codex/0.146.x/content-matrix.stream.json` was recorded with `codex exec --json`.
- `codex/0.146.x/work-phase.stream.json` retains the versioned Codex
  `file_change` and `todo_list` item lifecycles from the CAC-25 operator case.
  It is a projection fixture rather than a second content-matrix capture.
- `gemini/0.49.x/content-matrix.stream.json` uses the runner-normalized message frame retained
  by the parity archive. The local capture runner had no non-interactive Gemini
  credentials, so the checked-in archival capture is used rather than
  refreshing it.

Every `content-matrix` capture contains the same matrix: C# source, git diff, a
complete HTML file, conversational Markdown, an image reference, nested JSON, raw logs, a
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

Each version folder also contains `protocol.stream.json`: captured lifecycle,
tool-call, runtime, and truncation frames plus the normalized lines that enter
the renderer. Those files pin complete projected event snapshots, run a novelty
probe, and name their Conversation Lab `capture-*` replay. See
[`docs/cli-frame-compatibility.md`](../../../../../docs/cli-frame-compatibility.md)
for the deviation matrix and consumer versioning contract.

The Codex work-phase fixture additionally locks the visual row contract: the
raw frame flood projects to one `workPhase`, one stable `plan.update`, and one
agent message. The Conversation Lab scenario “Codex work phase + todo” renders
that same capture; opening Trace supplies the before/raw side of the comparison.
