import { describe, expect, it } from 'vitest';
import { highlightPayload, MAX_HIGHLIGHT_CHARS } from './markdown-utils';

describe('highlightPayload', () => {
  it('maps typed payloads to the existing grammars and escapes their source', () => {
    const diff = highlightPayload(
      'diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-old\n+new',
      'diff',
    );
    const json = highlightPayload('{"ok": true}', 'json');
    const html = highlightPayload('<script>const unsafe = true;</script>', 'html-file');

    expect(diff).toContain('hljs-addition');
    expect(diff).toContain('hljs-deletion');
    expect(diff).toContain('hljs-meta');
    expect(json).toContain('hljs-attr');
    expect(html).toContain('hljs-tag');
    expect(html).toContain('&lt;');
    expect(html).not.toContain('<script>');
  });

  it('falls back for unknown grammars and payloads over the shared size guard', () => {
    expect(highlightPayload('some source', 'code-block', 'unknown-language')).toBeNull();
    expect(
      highlightPayload('x'.repeat(MAX_HIGHLIGHT_CHARS + 1), 'code-block', 'csharp'),
    ).toBeNull();
  });
});
