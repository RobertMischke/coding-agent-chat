# CAC-16 regression evidence

Audit date: 2026-07-24

## Library fix

`coding-agent-chat@0.3.1` contains the Conversation View regression fix:

- `StickToBottomDirective.scrollToBottom()` resolves the current pane scroll
  owner again before pinning, so an embedded host that took scroll ownership
  after the view first rendered receives the jump.
- The jump is synchronous and re-enables following. Streamed content remains
  pinned until the reader deliberately scrolls up; returning to the bottom
  hides the affordance again.
- Virtualised feeds immediately recompute their tail window after a jump.
- Normal conversation messages render in full. Clamp, expand and nested
  code-scroll controls remain reserved for explicitly technical rows.

## Verification completed in this worktree

- `npm install --include=dev --ignore-scripts --foreground-scripts` restored
  the interrupted fresh-worktree dependency installation.
- `npx ng test coding-agent-chat --watch=false`: 34 files, 398 tests passed.
  This includes the dynamic scroll-owner jump regression, virtualised
  jump-to-latest re-slicing, normal-message no-disclosure rendering, and the
  technical disclosure cases.
- The Conversation Lab `long-run` replay is the operator scenario for this
  interaction; its description explicitly calls out streaming, scrolling and
  jump-to-latest coverage.
- Theme captures are committed at
  `results/cac-16-long-run-light.png` and
  `results/cac-16-long-run-dark.png`.

## Publication and Agent Studio follow-up

This worker does not create tags or push releases: the platform owns those
transitions. The repository already carries the `0.3.1` package and changelog
metadata; the release workflow must publish the immutable `v0.3.1` tag through
its configured trusted-publishing path. Agent Studio must then bump to that
exact package version, hard-reload its side sheet, and confirm the live
streaming jump-to-latest behaviour in the consumer.
