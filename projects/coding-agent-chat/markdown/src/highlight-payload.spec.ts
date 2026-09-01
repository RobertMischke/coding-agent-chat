// Covers the public typed-payload wrapper around the Markdown highlighter.
import { describe, expect, it } from 'vitest';
import { highlightPayload } from './markdown-utils';

describe('highlightPayload', () => {
  it('uses the shared grammars for typed source payloads and escapes source HTML', () => {
    expect(highlightPayload('public sealed class Foo {}', 'code-block', 'csharp')).toContain(
      'hljs-keyword',
    );
    expect(highlightPayload('{"ok": true}', 'json')).toContain('hljs-literal');
    expect(highlightPayload('<main data-value="x">Text</main>', 'html-file')).toContain('hljs-tag');
    expect(highlightPayload('<script>alert(1)</script>', 'html-file')).not.toContain('<script>');
    expect(highlightPayload('@@ -1 +1 @@\n-old\n+new', 'diff')).toContain('hljs-meta');
  });

  it('falls back for unknown grammars and payloads over the shared size guard', () => {
    expect(highlightPayload('plain source', 'code-block', 'unknown-language')).toBeNull();
    expect(highlightPayload('x'.repeat(60_001), 'code-block', 'csharp')).toBeNull();
  });
});
