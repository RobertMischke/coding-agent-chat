# CLI frame compatibility

Coding-agent transports are not one protocol. Their envelopes, lifecycle
boundaries, tool payloads, runtime metadata, and truncation signals drift on
independent release schedules. `coding-agent-chat` treats that complexity as a
feature: captured behavior is versioned, regression-tested, and visible to the
host when a CLI invents a frame the library does not know.

This document describes the capture baselines shipped with the current
library. “Trace” means the raw source remains addressable through
`ConversationEvent.rawRange`; it does not mean raw JSON is painted as chat.

## Deviation matrix

| CLI capture                                    | Lifecycle frames                                                                                                                                                                    | Tool-call payloads                                                                                                                                                                                                                                                           | Structured runtime frames                                                                                                                                                             | Truncation markers                                                                                                                        | Known quirks and rendered result                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex `0.146.0` (`0.146.x` fixture family)     | `thread.started`, `turn.started`, `turn.completed`; projected as compact `system.status` rows with Trace links                                                                      | `item.started` / `item.completed` with `command_execution` become `toolBurst`; `agent_message` becomes `message.taskAgent`; known `file_change`, `mcp_tool_call`, and `web_search` item kinds are protocol-recognized but require runner normalization for rich tool details | `reasoning` and `todo_list` item kinds are recognized structured metadata; unsupported display payloads remain compact Codex runtime status rows                                      | `output.truncated` and `response.output_text.truncated` become warning `system.status` rows; visible output must be treated as incomplete | Codex emits dot-qualified top-level kinds and nests the semantic kind under `item.type`. Novel nested kinds are reported as, for example, `item.completed/new_kind`, not accepted merely because `item.completed` is familiar. Text-mode stderr transcripts are a separate compatibility path and render as one trace-backed status row. |
| Claude Code `2.1.220` (`2.1.x` fixture family) | `system/init` and `result/success` are captured. The runner normally removes these envelopes; if forwarded raw, the library renders trace-backed lifecycle status rather than JSON. | `assistant` content blocks use `tool_use`; results return in `user` frames as `tool_result`. Normalized action/result lines render as `toolBurst`; unnormalized raw tool frames render as compact trace-backed tool status.                                                  | `thinking`, `rate_limit_event`, `stream_event`, and `system/status` are recognized and render as compact runtime/Trace evidence unless the runner maps them to a richer public event. | `system/compact_boundary` becomes an “Output truncated” warning if the raw marker is forwarded                                            | A Claude `assistant` frame can contain several block kinds in one array. The library checks every block and raises `system.unknownFrame` for one novel block rather than silently swallowing the whole mixed frame. Tool results use the nominal `user` transport role even though they are not human chat turns.                        |
| Gemini CLI `0.49.0` (`0.49.x` fixture family)  | Runner archive uses `init` and `result`; normalized streams filter them, while forwarded raw frames become trace-backed lifecycle status                                            | Runner archive uses `tool_call` / `tool_result`; normalized action lines render as `toolBurst`, raw envelopes as compact tool status                                                                                                                                         | `error` is recognized structured runtime evidence and renders as a status row when forwarded raw                                                                                      | Runner-normalized `truncation` becomes an “Output truncated” warning                                                                      | The checked-in Gemini baseline is the retained runner-normalized archive because the capture host had no non-interactive Gemini credentials. `message` additionally depends on `role`; any role other than `assistant` or `user` is drift, not an assumed assistant message.                                                             |

The current manifests also recognize the following family variants that occur
within the captured transports:

| Family             | Codex                                                             | Claude                                                            | Gemini                                 |
| ------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------- |
| Message            | `item.* / agent_message`                                          | `assistant / text`                                                | `message / assistant`                  |
| Lifecycle          | `thread.*`, `turn.*`, `session.*`                                 | `system / init`, terminal `result`                                | `init`, `result`                       |
| Tool call          | `command_execution`, `file_change`, `mcp_tool_call`, `web_search` | `tool_use`, `tool_result` blocks                                  | `tool_call`, `tool_use`, `tool_result` |
| Structured runtime | `reasoning`, `todo_list`, `error`                                 | `thinking`, `rate_limit_event`, `stream_event`, `system / status` | `error`                                |
| Truncation         | `output.truncated`, `response.output_text.truncated`              | `system / compact_boundary`                                       | runner-normalized `truncation`         |

## Unknown-frame contract

When raw JSON frames reach the projection, provide the exact source:

```ts
const events = projectConversation({
  source: 'cli-output.log',
  lines,
  frameSource: {
    cli: 'codex',
    version: '0.146.0',
    transport: 'jsonl',
  },
});
```

A syntactically valid frame outside the manifest emits a typed event:

```ts
interface SystemUnknownFrameEvent {
  kind: 'system.unknownFrame';
  frameKind: string;
  cli: string;
  cliVersion: string;
  transport?: string;
  message: string; // "Unknown frame (kind X, cli Y vZ)"
  rawRange: RawLineRange;
}
```

The event intentionally excludes the raw payload. Hosts can alert or count by
the typed fields and offer a Trace link to the source range without copying
credentials, paths, tool arguments, or model output into telemetry. The stock
conversation renderer shows a distinct “Protocol drift” warning row. Unknown
frames are never downgraded to a generic internal-event label.

Set `frameSource` only on streams that still contain protocol envelopes (or a
mixed normalized stream that deliberately retains selected markers). Ordinary
JSON documents in an assistant answer are content, not frames, and should enter
the projection through the runner-normalized text path.

## Versioning contract for consumers

The library and CLI versions must be pinned independently:

1. Pin an exact `coding-agent-chat` version in the host lockfile.
2. Pin each production CLI to an exact version and record that exact version in
   `frameSource` when forwarding raw frames.
3. Treat a fixture-family label such as `2.1.x` as corpus organization, not a
   promise that every future patch is wire-compatible. The exact captured
   version named in the fixture is the tested baseline.
4. Before upgrading a CLI, capture its real sanitized frames into a new version
   folder, run `npm run test:render-fixtures`, and inspect the Conversation Lab
   replay. Do not update snapshots until the semantic rendering change is
   understood and documented here.
5. In production, surface or monitor `system.unknownFrame`. It is the runtime
   signal that the deployed CLI moved beyond the tested manifest.

`ConversationEvent` follows the library's SemVer contract. Adding recognition
for a new CLI frame without changing existing rendering is compatible; changing
the rendered event shape of a known capture is a behavior change and must update
the fixture snapshot, this matrix, and the changelog together.

## Fixture and regression tiers

The corpus lives under
`projects/coding-agent-chat/core/test-fixtures/rendering/<cli>/<version-family>/`:

- `content-matrix.stream.json` retains the real assistant-content capture used
  by the CAC-18 renderer-safety suite.
- `protocol.stream.json` retains sanitized lifecycle/tool/runtime/truncation
  frames, the exact CLI version, capture command, expected event kinds, and its
  Conversation Lab scenario id.

`npm run test:render-fixtures` performs three checks:

- content payload regression snapshots (Markdown versus typed raw/file payloads);
- full protocol event snapshots, so any known rendering drift fails the suite;
- novelty probes that inject a future frame kind and require
  `system.unknownFrame` for every supported CLI family.

Each protocol fixture names a `capture-*` Conversation Lab replay. The fixture
suite verifies that the scenario remains present, and the Lab specs replay the
same CLI/version projection contract as the visual renderer.
