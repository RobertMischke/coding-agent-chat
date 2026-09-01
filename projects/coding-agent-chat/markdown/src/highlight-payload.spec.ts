import { describe, expect, it } from 'vitest';
import { highlightPayload } from './markdown-utils';

describe('highlightPayload', () => {
  it('maps typed payloads to the shared grammars', () => {
    expect(highlightPayload('public sealed class Foo {}', 'code-block', 'csharp')).toContain(
      'hljs-keyword',
    );
    const diff = highlightPayload('@@ -1 +1 @@\n-old\n+new', 'diff');
    expect(diff).toContain('hljs-meta');
    expect(diff).toContain('hljs-deletion');
    expect(highlightPayload('{"ok":true}', 'json')).toContain('hljs-attr');
    expect(highlightPayload('<main>ok</main>', 'html-file')).toContain('hljs-tag');
  });

  it('falls back for unknown grammars and oversized payloads', () => {
    expect(highlightPayload('plain', 'code-block', 'unknown-language')).toBeNull();
    expect(highlightPayload('x'.repeat(60_001), 'code-block', 'csharp')).toBeNull();
  });
});
