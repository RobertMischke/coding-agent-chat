# Contributing to coding-agent-chat

`coding-agent-chat` is pre-1.0, so its public surface can still change. Issues,
ideas, and pull requests are welcome.

## Build & test

Install Node.js 22 (or newer) and run these commands from the repository root:

```sh
npm ci
npm run build      # ng build coding-agent-chat → dist/coding-agent-chat
npm test           # vitest: zero-Angular kernel specs (core, markdown, node)
npm run test:render-fixtures # opt-in captured CLI rendering parity fixtures
npx ng test        # Angular component specs across all entry points
```

Build the library before running the component specs or either demo app: the
lab, the website, and the specs all compile against the built package entry
points in `dist/`, not against the sources. That is deliberate — it exercises
the published partial-Ivy compile mode and catches strict-template mismatches
early.

The standard commands cover the kernel and Angular suites; the capture-backed
rendering parity suite is an explicit opt-in:

| Command                        | Covers                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `npm test`                     | pure kernel specs — wire contract, projection, markdown utils, attachment storage |
| `npm run test:render-fixtures` | opt-in MachineBound Claude/Codex/Gemini capture classification snapshots          |
| `npx ng test`                  | `*.component.spec.ts` through the `@angular/build:unit-test` builder              |

Run the demo surfaces while working on rendering:

```sh
npm run lab        # Conversation Lab  → http://localhost:4201
npm run website    # public website    → http://localhost:4202
npm run workbench  # optional .NET live host for the Lab → http://localhost:5055
```

The Lab's scenario catalog (`projects/conversation-lab/src/app/lab-scenarios.ts`)
is the fastest way to reproduce a transcript shape — add a scenario when you fix
a rendering bug.

## Conventions

- TypeScript with strict mode; Angular standalone components and signals.
- Formatting is Prettier + `.editorconfig` (100 columns, single quotes). Run
  `npx prettier --write <changed files>` before committing.
- The library stays **host-agnostic**: it owns rendering and matching mechanics,
  never what a task key, model id, or reference _means_. New host knowledge
  belongs behind an injection seam (see `provideCodingAgentChat`), not in a
  component.
- `coding-agent-chat/core` must stay free of Angular imports — backends, SSR and
  tests consume the wire contract without the renderer.
- New public surface goes through an entry point's `public-api`, gets a
  CHANGELOG entry, and follows SemVer.
- Conventional-commit style messages are appreciated.

Start with [README.md](README.md) for the workspace layout and
[`projects/coding-agent-chat/README.md`](projects/coding-agent-chat/README.md)
for the public API, entry points, and host-wiring seams. The history-window
defaults and their measurements are documented in
[docs/history-window-benchmark.md](docs/history-window-benchmark.md).

## Scope

This library is the _rendering_ layer for coding-agent conversations: it turns
the event stream produced by
[`coding-agent-runner`](https://github.com/agent-orc/runner) into a grouped,
progressively-disclosed conversation. It deliberately does **not** include
transport, persistence, orchestration, or task semantics — those belong in the
host application.

## Agent-driven maintenance

The agent-orc organization uses agent-driven pipelines, so most changes here
land without a conventional human-authored pull request; quality is enforced on
the pipeline rather than at a PR gate. Human issues and pull requests are still
welcome and are reviewed against the same tests, scope, and project conventions.

## Pull requests

- Keep changes focused and explain the behavior or problem they address.
- Add or update tests when behavior changes — a rendering fix should come with a
  spec or a Lab scenario that fails without it.
- Update the CHANGELOG and the relevant README when the public API or setup
  changes.
- Do not break the zero-cost-by-default guarantee of the optional seams
  (inline reference renderers, task references, media lightbox): with nothing
  registered, rendering must be unchanged.

By participating, you agree to follow the
[Code of Conduct](CODE_OF_CONDUCT.md). Report security issues through the
private process in [SECURITY.md](SECURITY.md), not through a public issue.

## Releases

Releases are cut from `main` with `scripts/release.sh <version>`, which
validates, tests, tags `v<version>`, and pushes the tag. The `release` workflow
builds that exact commit and publishes to npm with provenance. Contributors do
not need to bump versions in a pull request.

## License

By contributing you agree that your contributions are licensed under the
[Apache-2.0](LICENSE) license.
