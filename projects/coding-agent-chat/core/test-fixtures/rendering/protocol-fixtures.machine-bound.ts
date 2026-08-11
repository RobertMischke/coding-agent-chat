// Opt-in by filename: Angular's standard `**/*.spec.ts` discovery must not collect this suite.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { inspectCliFrame } from '../../src/cli-frame';
import type { ConversationEvent } from '../../src/conversation-event';
import { projectConversation } from '../../src/conversation-projection';
import type { CliFrameSource, CliOutputLine } from '../../src/projection-inputs';

interface ProtocolCapture {
  schemaVersion: 2;
  fixtureKind: 'protocol';
  cli: string;
  cliVersion: string;
  versionFamily: string;
  transport: string;
  capturedAt: string;
  captureCommand: string;
  sanitized: boolean;
  visualScenario: string;
  frames: Record<string, unknown>[];
  renderLines: 'raw-frames' | { stream: string; text: string }[];
  expectedEventKinds: string[];
}

const FIXTURE_DIRECTORY = resolve(
  process.cwd(),
  'projects/coding-agent-chat/core/test-fixtures/rendering',
);
const LAB_SCENARIOS = readFileSync(
  resolve(process.cwd(), 'projects/conversation-lab/src/app/lab-scenarios.ts'),
  'utf8',
);
const captures = fixtureFiles(FIXTURE_DIRECTORY)
  .filter((path) => path.endsWith('/protocol.stream.json'))
  .sort()
  .map((path) => JSON.parse(readFileSync(path, 'utf8')) as ProtocolCapture);

describe('versioned CLI protocol fixtures [MachineBound]', () => {
  it('covers every supported CLI and every documented frame family', () => {
    expect(captures.map((capture) => `${capture.cli}/${capture.versionFamily}`)).toEqual([
      'claude/2.1.x',
      'codex/0.146.x',
      'gemini/0.49.x',
    ]);
    const families = new Set(
      captures.flatMap((capture) => capture.frames.map((frame) => inspect(capture, frame).family)),
    );
    expect([...families].sort()).toEqual([
      'lifecycle',
      'message',
      'structured-runtime',
      'tool-call',
      'truncation',
    ]);
  });

  for (const capture of captures) {
    it(`${capture.cli} ${capture.cliVersion} pins frame recognition and rendered events`, () => {
      expect(capture.schemaVersion).toBe(2);
      expect(capture.sanitized).toBe(true);
      expect(capture.captureCommand).toBeTruthy();
      expect(capture.frames.map((frame) => inspect(capture, frame).known)).not.toContain(false);

      const events = renderCapture(capture);
      expect(events.map((event) => event.kind)).toEqual(capture.expectedEventKinds);
      expect(events.map(eventProbe)).toMatchSnapshot();
    });

    it(`${capture.cli} ${capture.cliVersion} is wired into the visual scenario catalog`, () => {
      expect(capture.visualScenario).toBeTruthy();
      expect(LAB_SCENARIOS).toContain(`id: '${capture.visualScenario}'`);
    });

    it(`${capture.cli} ${capture.cliVersion} detects a novel top-level frame`, () => {
      const source = frameSource(capture);
      const events = projectConversation({
        source: `novelty:${capture.cli}:${capture.cliVersion}`,
        frameSource: source,
        lines: [line(JSON.stringify({ type: '__future_frame__', payload: '<raw-only>' }), 0)],
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        kind: 'system.unknownFrame',
        frameKind: '__future_frame__',
        cli: capture.cli,
        cliVersion: capture.cliVersion,
      });
    });
  }
});

function inspect(capture: ProtocolCapture, frame: Record<string, unknown>) {
  const inspection = inspectCliFrame(JSON.stringify(frame), frameSource(capture));
  expect(inspection, `${capture.cli} frame ${String(frame['type'])}`).not.toBeNull();
  return inspection!;
}

function renderCapture(capture: ProtocolCapture): ConversationEvent[] {
  const frames =
    capture.renderLines === 'raw-frames'
      ? capture.frames.map((frame) => ({ stream: 'stdout', text: JSON.stringify(frame) }))
      : capture.renderLines;
  return projectConversation({
    source: `capture:${capture.cli}:${capture.cliVersion}`,
    frameSource: frameSource(capture),
    lines: frames.map((entry, index) => line(entry.text, index, entry.stream)),
  });
}

function frameSource(capture: ProtocolCapture): CliFrameSource {
  return {
    cli: capture.cli,
    version: capture.cliVersion,
    transport: capture.transport,
  };
}

function line(text: string, index: number, stream = 'stdout'): CliOutputLine {
  return {
    timestamp: new Date(Date.UTC(2026, 6, 30, 12, 0, index)).toISOString(),
    stream,
    text,
  };
}

function eventProbe(event: ConversationEvent): Record<string, unknown> {
  const base = {
    kind: event.kind,
    severity: event.severity ?? null,
    collapsedByDefault: event.collapsedByDefault ?? false,
  };
  switch (event.kind) {
    case 'message.taskAgent':
      return { ...base, body: event.body, content: event.content?.map((item) => item.type) };
    case 'toolBurst':
    case 'workPhase':
      return {
        ...base,
        count: event.count,
        families: event.families,
        failures: event.failures,
        ...(event.kind === 'workPhase'
          ? {
              files: event.files,
              segmentCount: event.segmentCount,
              runtimeFrameCount: event.runtimeFrameCount,
            }
          : {}),
        commands: event.commands?.map((command) => ({
          command: command.command,
          status: command.status,
          exitCode: command.exitCode,
          output: command.output,
          outputTruncated: command.outputTruncated,
        })),
      };
    case 'system.status':
      return {
        ...base,
        category: event.category,
        label: event.label,
        explanation: event.explanation,
      };
    default:
      return base;
  }
}

function fixtureFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() && entry.name !== '__snapshots__' ? fixtureFiles(path) : [path];
  });
}
