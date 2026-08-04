import { describe, expect, it } from 'vitest';

import { classifyMessageContent } from './message-content';

describe('classifyMessageContent', () => {
  it('splits mixed prose and fenced source into typed payloads', () => {
    const payloads = classifyMessageContent(
      [
        'The handler now preserves the result:',
        '',
        '```csharp',
        'public async Task<Result> ExecuteAsync()',
        '{',
        '    return await runner.RunAsync();',
        '}',
        '```',
        '',
        'The caller is unchanged.',
      ].join('\n'),
    );

    expect(payloads).toEqual([
      { type: 'markdown', text: 'The handler now preserves the result:' },
      {
        type: 'code-block',
        language: 'csharp',
        text: [
          'public async Task<Result> ExecuteAsync()',
          '{',
          '    return await runner.RunAsync();',
          '}',
        ].join('\n'),
      },
      { type: 'markdown', text: 'The caller is unchanged.' },
    ]);
  });

  it.each([
    [
      'diff',
      [
        'diff --git a/src/a.ts b/src/a.ts',
        '--- a/src/a.ts',
        '+++ b/src/a.ts',
        '@@ -1 +1 @@',
        '-old',
        '+new',
      ].join('\n'),
    ],
    ['html-file', '<!doctype html>\n<html><body><ul><li>literal</li></ul></body></html>'],
    ['json', '{\n  "ok": true,\n  "items": [1, 2]\n}'],
    ['raw-log', '2026-07-30T10:00:00Z [INFO] starting\n2026-07-30T10:00:01Z [ERROR] failed'],
    ['code-block', 'public sealed class Worker\n{\n    public void Run() { }\n}'],
    ['image-reference', '![build graph](results/build.png "Build graph")'],
    ['markdown', '| Name | State |\n| --- | --- |\n| parser | fixed |'],
  ] as const)('classifies a complete %s body without Markdown fallback', (type, body) => {
    expect(classifyMessageContent(body)[0]?.type).toBe(type);
  });

  it('keeps raw Markdown file content fenced instead of parsing it as conversation Markdown', () => {
    const payload = classifyMessageContent(
      '```markdown\n- literal source bullet\n# literal heading\n```',
    )[0];

    expect(payload).toEqual({
      type: 'code-block',
      language: 'markdown',
      text: '- literal source bullet\n# literal heading',
    });
  });

  it('recognizes an unfenced C# method fragment with nested generic return types', () => {
    const source = [
      '[HttpGet("{id}")]',
      'public async Task<ActionResult<Item>> GetAsync(Guid id)',
      '{',
      '    return await repository.FindAsync(id);',
      '}',
    ].join('\n');

    expect(classifyMessageContent(source)).toEqual([
      { type: 'code-block', text: source, language: 'csharp' },
    ]);
  });

  it('recognizes an unfenced C# statement fragment without a declaration', () => {
    const source = ['if (result is null)', '{', '    return Array.Empty<Item>();', '}'].join('\n');

    expect(classifyMessageContent(source)).toEqual([
      { type: 'code-block', text: source, language: 'csharp' },
    ]);
  });

  it('recognizes a standalone git hunk without file headers', () => {
    const hunk = [
      '@@ -18,3 +18,4 @@ public void Execute()',
      '     Keep();',
      '-    Remove();',
      '+    Replace();',
      '+    Verify();',
    ].join('\n');

    expect(classifyMessageContent(hunk)).toEqual([{ type: 'diff', text: hunk, format: 'git' }]);
  });

  it('recognizes truncated HTML documents and leading capture comments', () => {
    const html = [
      '<!-- sanitized capture -->',
      '<!doctype html>',
      '<html lang="en">',
      '<body><ul><li>literal source</li></ul></body>',
    ].join('\n');

    expect(classifyMessageContent(html)).toEqual([
      { type: 'html-file', text: html, mediaType: 'text/html' },
    ]);
  });

  it('classifies raw JSONL as JSON instead of Markdown', () => {
    const jsonl = '{"type":"start","id":1}\n{"type":"done","id":1}';

    expect(classifyMessageContent(jsonl)).toEqual([{ type: 'json', text: jsonl }]);
  });

  it('preserves ANSI escapes and long lines in raw log payloads', () => {
    const longLine = `\u001b[31mERROR\u001b[0m ${'x'.repeat(8_192)}`;
    const payload = classifyMessageContent(longLine)[0];

    expect(payload).toMatchObject({ type: 'raw-log', text: longLine, ansi: true });
    expect('text' in payload ? payload.text.length : 0).toBe(longLine.length);
  });
});
