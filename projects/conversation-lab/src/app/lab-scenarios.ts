/**
 * Scenario catalog for the Conversation Lab — the single place to exercise the
 * library against every interesting transcript shape.
 *
 * Three scenario kinds:
 *
 * - `replay`  — a scripted `CliOutputLine[]` feed played through the SAME
 *   projection (`projectConversation`) the live workbench mode uses. This
 *   tests the real pipeline (activity-log parse → events → renderer), not
 *   hand-built events, and can be streamed line-by-line to simulate a live
 *   session without a backend.
 * - `live`    — a preset prompt for a REAL CLI run via the workbench host
 *   (`workbench/`, port 5055). Each preset is a reproducible starting point
 *   that provokes a specific event shape (tool rows, failures, todo plans).
 * - `events`  — hand-built `ConversationEvent[]` fixtures for renderer-only
 *   rows the projection cannot synthesize from short scripts (durable image
 *   artifacts, orchestrator decisions with retry budgets, token metrics).
 *
 * All replay scripts use a fixed timestamp base so replays are deterministic
 * across reloads.
 */

import type {
  ChatMessage,
  CliOutputLine,
  ConversationEvent,
  RunInfoLite,
  RunTimelineLite,
} from 'coding-agent-chat/core';
import { codexTextModeStderrTranscriptFragment } from 'coding-agent-chat/core';

import {
  LAB_CONVERSATION_EVENTS,
  LAB_IMAGE_EVENTS,
  LAB_TURN_METADATA_MESSAGES,
} from './lab-fixtures';

export type LabScenarioKind = 'events' | 'replay' | 'live';
export type LiveCliType = 'claude' | 'codex' | 'gemini';

interface LabScenarioBase {
  id: string;
  title: string;
  /** One or two sentences: what the scenario provokes and what to look for. */
  description: string;
}

/** Hand-built ConversationEvents rendered directly (renderer showcase). */
export interface EventsScenario extends LabScenarioBase {
  kind: 'events';
  events: readonly ConversationEvent[];
  /** Optional `<cac-chat>` turns for composer/message-specific fixtures. */
  messages?: readonly ChatMessage[];
}

/** Scripted raw lines replayed through `projectConversation`. */
export interface ReplayScenario extends LabScenarioBase {
  kind: 'replay';
  lines: readonly CliOutputLine[];
  /** Optional real run timeline so the projection emits run markers. */
  runTimeline?: RunTimelineLite;
}

/** Preset prompt for a real CLI session via the workbench host. */
export interface LiveScenario extends LabScenarioBase {
  kind: 'live';
  prompt: string;
  /** Preferred CLI; the user can still override it in the live bar. */
  cliType?: LiveCliType;
  /** Suggested follow-up message — exercises the resume-session chain. */
  followUp?: string;
}

export type LabScenario = EventsScenario | ReplayScenario | LiveScenario;

// ── Script builder ────────────────────────────────────────────────────────────

type ScriptEntry = readonly [text: string, stream?: string];

/** Fixed base (2026-07-01T09:00Z) + 2s steps: deterministic, ordered lines. */
function script(entries: readonly ScriptEntry[], stepSeconds = 2): CliOutputLine[] {
  const base = Date.UTC(2026, 6, 1, 9, 0, 0);
  return entries.map(([text, stream], index) => ({
    timestamp: new Date(base + index * stepSeconds * 1000).toISOString(),
    stream: stream ?? 'stdout',
    text,
  }));
}

function run(
  partial: Partial<RunInfoLite> & Pick<RunInfoLite, 'index' | 'lineStart' | 'lineEnd'>,
): RunInfoLite {
  return {
    intent: 'start',
    startedAt: '2026-07-01T09:00:00.000Z',
    status: 'completed',
    cli: 'claude',
    exitCode: 0,
    durationSeconds: 120,
    capturedSessionId: null,
    ...partial,
  };
}

// ── Replay scripts ────────────────────────────────────────────────────────────

const happyPathLines = script([
  ['Please add a dark/light toggle to the settings page and cover it with a spec.', 'user'],
  [
    '[taskboard] Started claude CLI (PID 4711), model=claude-sonnet-5, thinkingLevel=high, session=lab-sess-1',
    'system',
  ],
  ['I will look at the settings module and the existing theme service first.'],
  ['* Read settings.component.ts'],
  ['  | src/app/settings/settings.component.ts'],
  ['* Read theme.service.ts'],
  ['  | src/app/theme/theme.service.ts'],
  ['* Search "data-studio-theme"'],
  ['  | 6 matches in 3 files'],
  ['* Edit settings.component.ts'],
  ['  | Toggle + persistence added'],
  ['* Run npx vitest run settings (shell)'],
  ['  | ✓ settings.component.spec.ts (4 tests) 312ms'],
  [
    'The toggle is wired up: it flips `data-studio-theme` on the document root and persists the selection.',
  ],
  [''],
  ['All four tests pass.'],
]);

const testFailRetryLines = script([
  ['Run the Playwright suite and fix any failures.', 'user'],
  [
    '[taskboard] Started claude CLI (PID 4712), model=claude-sonnet-5, thinkingLevel=high',
    'system',
  ],
  ['* Run npx playwright test perf-frontend.spec.ts (shell)'],
  ['  | running playwright tests'],
  ['x Run npx playwright test perf-frontend.spec.ts (shell): exited with error 1'],
  ['  | grouped jobs poll took 11521 ms', 'stderr'],
  ['The polling timeout is too tight — I will increase the budget and try again.'],
  ['* Edit perf-frontend.spec.ts'],
  ['  | Timeout 10s → 30s'],
  ['* Run npx playwright test perf-frontend.spec.ts (shell)'],
  ['  | passed in 320ms'],
  ['The suite passes: the failed run had an overly tight polling budget, not a product defect.'],
]);

const watchdogWaitLines = script([
  ['Analyze the entire log directory and summarize the error classes.', 'user'],
  [
    '[taskboard] Started claude CLI (PID 4713), model=claude-sonnet-5, thinkingLevel=high',
    'system',
  ],
  ['* Read logs/2026-06-30.log'],
  ['  | 48,000 lines'],
  ['[watchdog] Agent has been quiet for 30s', 'orchestrator'],
  ['[watchdog] Still silent at 60s', 'orchestrator'],
  ['[watchdog] Still silent at 120s', 'orchestrator'],
  ['[watchdog] Agent resumed streaming', 'orchestrator'],
  [
    'The long silence was caused by reading the 48k-line log — here are the three dominant error classes.',
  ],
]);

const watchdogKillLines = script([
  ['Start the migration and wait for the result.', 'user'],
  [
    '[taskboard] Started claude CLI (PID 4714), model=claude-sonnet-5, thinkingLevel=high',
    'system',
  ],
  ['* Run npm run migrate (shell)'],
  ['  | applying 14 migrations'],
  ['[watchdog] Agent has been quiet for 300s', 'orchestrator'],
  ['[watchdog] Killed after 600s of silence', 'orchestrator'],
  ['Run failed: watchdog kill after 600s of silence', 'stderr'],
]);

const needsInputLines = script([
  ['Build the recovery test for the CLI wrapper.', 'user'],
  [
    '[taskboard] Started claude CLI (PID 4715), model=claude-sonnet-5, thinkingLevel=high',
    'system',
  ],
  ['* Read cli-wrapper.ts'],
  ['  | src/runner/cli-wrapper.ts'],
  ['[[TASK_NEEDS_INPUT: which CLI should I target for the recovery test?]]', 'orchestrator'],
  ['[reissue] retrying because evidence was incomplete', 'orchestrator'],
]);

const modelSwitchLines = script([
  ['Implement the model badge in the conversation header.', 'user'],
  ['[taskboard] Started codex CLI (PID 11), model=gpt-5-codex, thinkingLevel=high', 'system'],
  ['First pass on the initial model — I am adding the badge markup.'],
  ['[taskboard] Started claude CLI (PID 22), model=claude-sonnet-5, thinkingLevel=high', 'system'],
  ['Recovery run on the switched model — the badge now reads the per-run model.'],
]);

const stderrCrashLines = script([
  ['Start the development server and check the home page.', 'user'],
  [
    '[taskboard] Started claude CLI (PID 4716), model=claude-sonnet-5, thinkingLevel=high',
    'system',
  ],
  ['* Run npm run dev (shell)'],
  ['  | starting dev server'],
  ["Error: Cannot find module 'esbuild'", 'stderr'],
  ['    at Function.Module._resolveFilename (node:internal/modules/cjs/loader:1145:15)', 'stderr'],
  ['Run failed: process exited with code 1', 'stderr'],
]);

const codexTextModeStderrLines = codexTextModeStderrTranscriptFragment();

/** ~120 lines: 10 work blocks for scroll, fold, and performance checks. */
function longRunLines(): CliOutputLine[] {
  const entries: ScriptEntry[] = [
    ['Refactor all ten feature modules to standalone components.', 'user'],
    [
      '[taskboard] Started claude CLI (PID 4717), model=claude-sonnet-5, thinkingLevel=high',
      'system',
    ],
  ];
  for (let block = 1; block <= 10; block += 1) {
    entries.push(
      [`Module ${block}/10: convert feature-${block}.`],
      [`* Read feature-${block}.module.ts`],
      [`  | src/app/feature-${block}/feature-${block}.module.ts`],
      [`* Search "feature-${block}" usages`],
      [`  | ${3 + (block % 4)} matches`],
      [`* Edit feature-${block}.component.ts`],
      ['  | standalone: true, imports moved'],
      [`* Run npx vitest run feature-${block} (shell)`],
      [`  | ✓ feature-${block}.component.spec.ts (${2 + (block % 3)} tests)`],
      [`Module feature-${block} complete — tests pass.`],
      [''],
    );
  }
  entries.push(['All ten modules are standalone; the full suite passes.']);
  return script(entries, 1);
}

/** Claude-style TodoWrite plan: one list, re-emitted (a full snapshot) after
 *  each step, so the checklist ticks items off in place. The `* Todo …` lines
 *  match the workbench's PlanUpdated mapping, so replay == live. */
const todoPlanLines = script([
  ['Build a small CLI tool: argument parsing, help text, tests, and a README.', 'user'],
  [
    '[taskboard] Started claude CLI (PID 5001), model=claude-sonnet-5, thinkingLevel=high',
    'system',
  ],
  ['I will create a plan first and then work through it step by step.'],
  [
    '* Todo [in_progress] Implement argument parsing; [pending] Add help text; [pending] Write tests; [pending] Write README',
  ],
  ['* Edit src/cli.ts'],
  ['  | argv parsing with -h/--help flags added'],
  [
    '* Todo [completed] Implement argument parsing; [in_progress] Add help text; [pending] Write tests; [pending] Write README',
  ],
  ['* Edit src/help.ts'],
  ['  | Help text with examples'],
  [
    '* Todo [completed] Implement argument parsing; [completed] Add help text; [in_progress] Write tests; [pending] Write README',
  ],
  ['* Run npx vitest run (shell)'],
  ['  | ✓ 6 tests pass'],
  [
    '* Todo [completed] Implement argument parsing; [completed] Add help text; [completed] Write tests; [in_progress] Write README',
  ],
  ['* Edit README.md'],
  ['  | Usage + examples documented'],
  [
    '* Todo [completed] Implement argument parsing; [completed] Add help text; [completed] Write tests; [completed] Write README',
  ],
  ['All four items are complete: parsing, help, passing tests, and the README.'],
]);

// ── Catalog ───────────────────────────────────────────────────────────────────

export const LAB_SCENARIOS: readonly LabScenario[] = [
  {
    id: 'showcase',
    kind: 'events',
    title: 'Showcase (Fixtures)',
    description:
      'Hand-built ConversationEvents: message groups, tool burst, image artifacts (durable + scratch), orchestrator decision with retry budget, token metric, and run marker.',
    events: LAB_CONVERSATION_EVENTS,
  },
  {
    id: 'turn-metadata',
    kind: 'events',
    title: 'Turn metadata + complete message',
    description:
      'Complete short and long chat turns with immutable CLI, model, token, time, and run provenance. “Details” opens the quiet metadata view with copy actions.',
    events: [],
    messages: LAB_TURN_METADATA_MESSAGES,
  },
  {
    id: 'images',
    kind: 'events',
    title: 'Images (screenshots + lightbox)',
    description:
      'Rendered image artifacts and an inline Markdown image. A click opens the lightbox (arrow keys navigate, Escape closes) — the CHAT_MEDIA_LIGHTBOX host seam provides the overlay.',
    events: LAB_IMAGE_EVENTS,
  },
  {
    id: 'happy-path',
    kind: 'replay',
    title: 'Feature task (happy path)',
    description:
      'User task → tool burst (Read/Search/Edit) → passing test run → agent summary. The [taskboard] marker sets the model and is itself hidden from the chat.',
    lines: happyPathLines,
    runTimeline: {
      runCount: 1,
      runs: [
        run({
          index: 1,
          lineStart: 1,
          lineEnd: happyPathLines.length,
          capturedSessionId: 'lab-sess-1',
          durationSeconds: 210,
        }),
      ],
    },
  },
  {
    id: 'test-fail-retry',
    kind: 'replay',
    title: 'Test failure + retry',
    description:
      'A failed test run (x line + stderr) followed by a fix and passing retry — exercises the test aggregate in the tool burst and the error line.',
    lines: testFailRetryLines,
  },
  {
    id: 'watchdog-wait',
    kind: 'replay',
    title: 'Watchdog: Wait-Loop',
    description:
      'The agent goes quiet, the watchdog reports several times, then work resumes — the canonical wait loop from the edge cases.',
    lines: watchdogWaitLines,
  },
  {
    id: 'watchdog-kill',
    kind: 'replay',
    title: 'Watchdog: Kill after silence',
    description:
      'The run is killed after 600s of silence; the termination appears as an error line.',
    lines: watchdogKillLines,
  },
  {
    id: 'needs-input',
    kind: 'replay',
    title: 'Needs Input + Reissue',
    description:
      'The agent requests clarification through a NEEDS_INPUT sentinel; the orchestrator reissues the task. Exercises orchestrator-line classification.',
    lines: needsInputLines,
  },
  {
    id: 'model-switch',
    kind: 'replay',
    title: 'Model switch across two runs',
    description:
      'Two runs use different models (Codex → Claude). Each agent message carries the model of its own run, and the run marker shows the switch.',
    lines: modelSwitchLines,
    runTimeline: {
      runCount: 2,
      runs: [
        run({
          index: 1,
          lineStart: 1,
          lineEnd: 3,
          cli: 'codex',
          capturedSessionId: 'sess-one',
          durationSeconds: 60,
        }),
        run({
          index: 2,
          intent: 'recovery',
          startedAt: '2026-07-01T09:00:06.000Z',
          lineStart: 4,
          lineEnd: 5,
          capturedSessionId: 'sess-two',
          durationSeconds: 45,
        }),
      ],
    },
  },
  {
    id: 'stderr-crash',
    kind: 'replay',
    title: 'Crash with stderr',
    description:
      'The process terminates abruptly: a Node stack trace on stderr plus "Run failed". Exercises error-line rendering without any success context.',
    lines: stderrCrashLines,
  },
  {
    id: 'codex-stderr-transcript',
    kind: 'replay',
    title: 'Codex stderr transcript',
    description:
      'AGT-2176-shape: [runner]-Preface + Codex text-mode stderr transcript collapse into one trace row while the final stdout reply stays visible.',
    lines: codexTextModeStderrLines,
  },
  {
    id: 'long-run',
    kind: 'replay',
    title: 'Long run (10 blocks)',
    description:
      '~120 lines across ten work blocks — for scrolling behavior, the “Jump to latest” return, tool-burst folding, and rendering performance. Streamed playback simulates a real long session.',
    lines: longRunLines(),
  },
  {
    id: 'todo-plan',
    kind: 'replay',
    title: 'Todo plan (completed)',
    description:
      'Claude-style TodoWrite: a four-item plan is created and completed step by step. All snapshots merge into one checklist that updates in place — play it streamed to watch the items complete live.',
    lines: todoPlanLines,
  },
  {
    id: 'live-smoke',
    kind: 'live',
    title: 'Live: Smoke test',
    description:
      'Harmless prompt without tool use — exercises the Workbench → CLI → SSE → projection chain. Expected: a plain agent text response.',
    prompt:
      'Reply only with a brief greeting and name your current working directory. Do not use tools.',
  },
  {
    id: 'live-write-file',
    kind: 'live',
    title: 'Live: Create a file',
    description:
      'The agent writes a file in the workbench sandbox. Expected: a Write tool line in the burst plus brief confirmation.',
    prompt:
      "Create a hello.md file in the working directory with exactly one line, 'Hello from the workbench sandbox', and confirm briefly.",
    followUp: "Read hello.md and append a second line containing today's date.",
  },
  {
    id: 'live-fail-command',
    kind: 'live',
    title: 'Live: Failing command',
    description:
      'The agent deliberately runs a failing shell command. Expected: a red x line (tool failure) and an explanation.',
    prompt:
      'Run the shell command `node -e "process.exit(1)"` in the working directory, report the exit code, and explain what happened in one sentence.',
  },
  {
    id: 'live-todo-plan',
    kind: 'live',
    title: 'Live: Todo plan',
    description:
      'Forces Claude to use its TodoWrite tool: the plan (PlanUpdated) is rendered as a live checklist whose items complete as the work proceeds.',
    prompt:
      'You must use your TodoWrite tool: start with a four-item plan to create a small README.md in the working directory (title, short description, one usage example, and one license line). Update the todo list after each item (in_progress → completed), then complete all items.',
  },
];

export function findScenario(id: string): LabScenario {
  return LAB_SCENARIOS.find((s) => s.id === id) ?? LAB_SCENARIOS[0];
}
