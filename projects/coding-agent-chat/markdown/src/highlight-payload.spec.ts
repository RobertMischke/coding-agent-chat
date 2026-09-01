import { describe, expect, it } from 'vitest';
import { highlightPayload } from './markdown-utils';

describe('highlightPayload', () => {
  it('maps typed payloads to the shared registered grammars', () => {
    const diff = highlightPayload(
      'diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-old\n+new',
      'diff',
    );
    const json = highlightPayload('{"ok":true}', 'json');
    const html = highlightPayload('<main data-id="fixture">Hello</main>', 'html-file');

    expect(diff?.language).toBe('diff');
    expect(diff?.html).toContain('hljs-addition');
    expect(diff?.html).toContain('hljs-deletion');
    expect(diff?.html).toContain('hljs-meta');
    expect(json?.language).toBe('json');
    expect(json?.html).toContain('hljs-attr');
    expect(html?.language).toBe('xml');
    expect(html?.html).toContain('hljs-tag');
  });

  it('highlights known source languages and safely declines unknown or oversized input', () => {
    const csharp = highlightPayload('public class Foo { }', 'code-block', 'CSharp');

    expect(csharp?.language).toBe('csharp');
    expect(csharp?.html).toContain('hljs-keyword');
    expect(highlightPayload('<script>alert(1)</script>', 'code-block', 'unknown')).toBeNull();
    expect(highlightPayload('x'.repeat(60_001), 'code-block', 'typescript')).toBeNull();
  });
});
