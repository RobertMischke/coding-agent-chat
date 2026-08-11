import { describe, expect, it } from 'vitest';

import { inspectCliFrame } from './cli-frame';

describe('inspectCliFrame', () => {
  it('classifies captured lifecycle, tool, runtime, and truncation families', () => {
    expect(
      inspectCliFrame('{"type":"turn.started"}', { cli: 'codex', version: '0.146.0' }),
    ).toMatchObject({ known: true, kind: 'turn.started', family: 'lifecycle' });
    expect(
      inspectCliFrame('{"type":"item.completed","item":{"type":"command_execution"}}', {
        cli: 'codex',
        version: '0.146.0',
      }),
    ).toMatchObject({
      known: true,
      kind: 'item.completed/command_execution',
      family: 'tool-call',
    });
    expect(
      inspectCliFrame('{"type":"rate_limit_event"}', {
        cli: 'claude',
        version: '2.1.220',
      }),
    ).toMatchObject({ known: true, family: 'structured-runtime' });
    expect(
      inspectCliFrame('{"type":"system","subtype":"compact_boundary"}', {
        cli: 'claude',
        version: '2.1.220',
      }),
    ).toMatchObject({ known: true, family: 'truncation' });
  });

  it('reports nested payload drift rather than accepting a known outer kind', () => {
    expect(
      inspectCliFrame('{"type":"item.completed","item":{"type":"future_tool_payload"}}', {
        cli: 'codex',
        version: '0.147.0',
      }),
    ).toEqual({
      known: false,
      kind: 'item.completed/future_tool_payload',
      family: 'unknown',
      cli: 'codex',
      cliVersion: '0.147.0',
    });
  });

  it('does not mistake ordinary JSON documents for frames without a source', () => {
    expect(inspectCliFrame('{"type":"invoice","total":42}')).toBeNull();
    expect(inspectCliFrame('plain output')).toBeNull();
  });
});
