import { describe, expect, it } from 'vitest';
import { highlightPayload } from './markdown-utils';

describe('highlightPayload', () => {
  it('uses the shared grammars for typed source payloads', () => {
    const diff = highlightPayload('-old\n+new\n@@ -1 +1 @@', 'diff');
    const csharp = highlightPayload('public sealed class Worker { }', 'code-block', 'csharp');

    expect(diff.highlighted).toBe(true);
    expect(diff.html).toContain('hljs-deletion');
    expect(diff.html).toContain('hljs-addition');
    expect(diff.html).toContain('hljs-meta');
    expect(csharp.highlighted).toBe(true);
    expect(csharp.html).toContain('hljs-keyword');
  });

  it('falls back to escaped plain text for unknown grammars and oversized payloads', () => {
    const unknown = highlightPayload('<unsafe>', 'code-block', 'not-a-grammar');
    const oversized = highlightPayload(`<unsafe>${'x'.repeat(60_000)}`, 'json');

    expect(unknown).toEqual({ html: '&lt;unsafe&gt;', highlighted: false });
    expect(oversized.highlighted).toBe(false);
    expect(oversized.html).toContain('&lt;unsafe&gt;');
    expect(oversized.html).not.toContain('hljs-');
  });
});
