// Opt-in by filename: Angular's standard `**/*.spec.ts` discovery must not collect this suite.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { MessageEvent } from '../../src/conversation-event';
import type { MessageContentPayload } from '../../src/message-content';
import { projectConversation } from '../../src/conversation-projection';
import type { CliOutputLine } from '../../src/projection-inputs';

type FixtureCli = 'claude' | 'codex' | 'gemini';
type ContentCase =
  | 'source'
  | 'diff'
  | 'html'
  | 'markdown'
  | 'image'
  | 'json'
  | 'logs'
  | 'longLine'
  | 'mixed'
  | 'table'
  | 'mermaid'
  | 'ansi';

interface StreamCapture {
  schemaVersion: 1;
  cli: FixtureCli;
  cliVersion: string;
  transport: string;
  sanitized: boolean;
  frames: unknown[];
}

const EXPECTED_TYPES: Readonly<Record<ContentCase, readonly MessageContentPayload['type'][]>> = {
  source: ['code-block'],
  diff: ['diff'],
  html: ['html-file'],
  markdown: ['markdown'],
  image: ['image-reference'],
  json: ['json'],
  logs: ['raw-log'],
  longLine: ['markdown'],
  mixed: ['markdown', 'code-block', 'markdown'],
  table: ['markdown'],
  mermaid: ['code-block'],
  ansi: ['raw-log'],
};

const RAW_FILE_CASES: readonly ContentCase[] = ['source', 'diff', 'html', 'json', 'logs', 'ansi'];
const CASES = Object.keys(EXPECTED_TYPES) as ContentCase[];
const FIXTURE_DIRECTORY = resolve(
  process.cwd(),
  'projects/coding-agent-chat/core/test-fixtures/rendering',
);

const captures = readdirSync(FIXTURE_DIRECTORY)
  .filter((name) => name.endsWith('.stream.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(`${FIXTURE_DIRECTORY}/${name}`, 'utf8')) as StreamCapture);

describe('rendering stream fixtures [MachineBound]', () => {
  it('has a sanitized recorded envelope for every supported CLI', () => {
    expect(captures.map((capture) => capture.cli)).toEqual(['claude', 'codex', 'gemini']);
    for (const capture of captures) {
      expect(capture.schemaVersion).toBe(1);
      expect(capture.cliVersion).toBeTruthy();
      expect(capture.transport).toBeTruthy();
      expect(capture.sanitized).toBe(true);
    }
  });

  for (const capture of captures) {
    it(`${capture.cli} classifies every captured content type`, () => {
      const matrix = extractContentMatrix(capture);
      const snapshot: Record<string, unknown> = {};

      for (const caseName of CASES) {
        const original = matrix[caseName];
        expect(original, `${capture.cli}/${caseName} is recorded`).toBeTypeOf('string');

        const message = projectCase(capture.cli, caseName, original);
        const payloads = message.content ?? [];
        expect(
          payloads.map((payload) => payload.type),
          `${capture.cli}/${caseName}`,
        ).toEqual(EXPECTED_TYPES[caseName]);
        expect(message.body).toBe(original);

        if (RAW_FILE_CASES.includes(caseName)) {
          expect(
            payloads.some((payload) => payload.type === 'markdown'),
            `${capture.cli}/${caseName} must bypass Markdown parsing`,
          ).toBe(false);
          const rawPayload = payloads[0];
          expect(rawPayload && 'text' in rawPayload ? rawPayload.text : undefined).toBe(original);
        }
        if (caseName === 'longLine') expect(message.body.length).toBe(original.length);

        snapshot[caseName] = payloads.map(payloadProbe);
      }

      expect({
        cli: capture.cli,
        cliVersion: capture.cliVersion,
        cases: snapshot,
      }).toMatchSnapshot();
    });

    it(`${capture.cli} preserves actor boundaries and typed payload order in mixed turns`, () => {
      const matrix = extractContentMatrix(capture);
      const userLine: CliOutputLine = {
        timestamp: '2026-07-30T12:00:00.000Z',
        stream: 'user',
        text: 'Show the implementation and keep source formatting.',
      };
      const agentLine = projectionLine(capture.cli, 'mixed', matrix.mixed, 1);
      const messages = projectConversation({
        source: `${capture.cli}-mixed-turn`,
        lines: [userLine, agentLine],
      }).filter((event): event is MessageEvent => event.kind.startsWith('message.'));

      expect(messages.map((message) => message.kind)).toEqual([
        'message.user',
        'message.taskAgent',
      ]);
      expect(messages[1]?.content?.map((payload) => payload.type)).toEqual(EXPECTED_TYPES.mixed);
    });
  }
});

function projectCase(cli: FixtureCli, caseName: ContentCase, text: string): MessageEvent {
  const events = projectConversation({
    source: `${cli}-${caseName}`,
    lines: [projectionLine(cli, caseName, text, 0)],
  });
  const message = events.find((event): event is MessageEvent => event.kind === 'message.taskAgent');
  expect(message, `${cli}/${caseName} projects an agent message`).toBeDefined();
  return message!;
}

function projectionLine(
  cli: FixtureCli,
  caseName: ContentCase,
  text: string,
  offset: number,
): CliOutputLine {
  const timestamp = `2026-07-30T12:00:${String(offset).padStart(2, '0')}.000Z`;
  if (cli === 'codex') {
    return {
      timestamp,
      stream: 'stdout',
      text: JSON.stringify({
        type: 'item.completed',
        item: { id: `fixture-${caseName}`, type: 'agent_message', text },
      }),
    };
  }
  // Claude and Gemini streams are normalized to visible assistant text by
  // coding-agent-runner before they enter the library.
  return { timestamp, stream: 'stdout', text };
}

function extractContentMatrix(capture: StreamCapture): Record<ContentCase, string> {
  let matrixText: string | undefined;
  if (capture.cli === 'claude') {
    const assistant = capture.frames.find(
      (frame) => isRecord(frame) && frame['type'] === 'assistant',
    );
    if (isRecord(assistant) && isRecord(assistant['message'])) {
      const content = assistant['message']['content'];
      if (Array.isArray(content)) {
        const textBlock = content.find((block) => isRecord(block) && block['type'] === 'text');
        if (isRecord(textBlock) && typeof textBlock['text'] === 'string') {
          matrixText = textBlock['text'];
        }
      }
    }
  } else if (capture.cli === 'codex') {
    const completed = capture.frames.find(
      (frame) => isRecord(frame) && frame['type'] === 'item.completed',
    );
    if (isRecord(completed) && isRecord(completed['item'])) {
      const text = completed['item']['text'];
      if (typeof text === 'string') matrixText = text;
    }
  } else {
    const message = capture.frames.find(
      (frame) => isRecord(frame) && frame['type'] === 'message' && frame['role'] === 'assistant',
    );
    if (isRecord(message) && typeof message['content'] === 'string') {
      matrixText = message['content'];
    }
  }

  expect(matrixText, `${capture.cli} assistant matrix`).toBeTypeOf('string');
  return JSON.parse(matrixText!) as Record<ContentCase, string>;
}

function payloadProbe(payload: MessageContentPayload): Record<string, unknown> {
  if (payload.type === 'image-reference') {
    return { type: payload.type, uri: payload.uri, alt: payload.alt };
  }
  return {
    type: payload.type,
    characters: payload.text.length,
    lines: payload.text.split(/\r?\n/).length,
    ...('language' in payload && payload.language ? { language: payload.language } : {}),
    ...('ansi' in payload ? { ansi: payload.ansi } : {}),
    ...('format' in payload ? { format: payload.format } : {}),
    ...('mediaType' in payload ? { mediaType: payload.mediaType } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
