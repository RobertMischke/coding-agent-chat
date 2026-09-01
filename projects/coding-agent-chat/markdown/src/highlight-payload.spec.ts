import { describe, expect, it } from 'vitest';
import { highlightPayload } from './markdown-utils';

describe('highlightPayload', () => {
  it('maps typed payloads to the shared curated grammars', () => {
    expect(highlightPayload('public class Foo {}', 'code-block', 'csharp')).toContain(
      'hljs-keyword',
    );
    expect(highlightPayload('{"ok": true}', 'json')).toContain('hljs-attr');
    expect(highlightPayload('<main>Fixture</main>', 'html-file')).toContain('hljs-tag');
  });

  it('balances visual diff tokens per line', () => {
    const source = [
      'diff --git a/a.txt b/a.txt',
      '--- a/a.txt',
      '+++ b/a.txt',
      '@@ -1 +1 @@',
      '-old',
      '+new',
    ].join('\n');
    const highlighted = highlightPayload(source, 'diff');

    expect(highlighted).toContain('hljs-meta');
    expect(highlighted).toContain('hljs-deletion');
    expect(highlighted).toContain('hljs-addition');
    expect((highlighted?.match(/\n/g) ?? []).length).toBe(5);
    expect((highlighted?.match(/<span/g) ?? []).length).toBe(
      (highlighted?.match(/<\/span>/g) ?? []).length,
    );
  });

  it('returns null for unknown grammars and payloads over the existing size guard', () => {
    expect(highlightPayload('plain', 'code-block', 'unknown-language')).toBeNull();
    expect(highlightPayload('x'.repeat(60_001), 'json')).toBeNull();
  });
});
