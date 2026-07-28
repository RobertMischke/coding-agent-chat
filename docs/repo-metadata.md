# Repository metadata

Recommended settings for the `agent-orc/chat` GitHub repository. An operator
applies these in the GitHub repository settings — they are not committed
configuration.

## Description

> Angular library for rendering coding-agent conversations: grouped tool bursts,
> streaming replies, history windowing, and host-agnostic extension seams.

(GitHub truncates the description in search results at roughly 150 characters —
keep the first clause self-contained.)

## Website

<https://agent-orchestrator.dev/chat/>

## Topics

- `angular`
- `typescript`
- `chat-ui`
- `ai-agents`
- `coding-agents`
- `claude-code`
- `openai-codex`
- `llm`
- `markdown`
- `component-library`
- `npm-package`

The topics mirror the `keywords` array in
[`projects/coding-agent-chat/package.json`](../projects/coding-agent-chat/package.json);
keep the two lists aligned when either changes.

## Repository settings

- **Releases** — the `release` workflow publishes to npm from a `v<version>`
  tag; leave "Packages" unchecked in the sidebar and let Releases show the tags.
- **Private vulnerability reporting** — enable it, since
  [SECURITY.md](../SECURITY.md) sends reporters to the advisory flow.
- **Social preview** — `docs/media/conversation-view-dark.png` works as the
  preview image.
- **Pull requests** — external PRs are welcome even though internal changes land
  through agent pipelines (see [CONTRIBUTING.md](../CONTRIBUTING.md)).

## Notes

Keep the description factual and consistent with the README's opening line. The
website points to the chat-specific page; the README links to the wider Agent
Orchestrator ecosystem.
