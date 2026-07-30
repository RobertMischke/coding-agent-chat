/**
 * Typed message content shared by stream projections and renderers.
 *
 * `markdown` is the only payload that may be passed through a Markdown parser.
 * File contents, diffs, JSON, and logs deliberately use distinct payloads so a
 * renderer cannot accidentally reinterpret source lines as lists or headings.
 */
export type MessageContentPayload =
  | MarkdownContentPayload
  | CodeBlockContentPayload
  | DiffContentPayload
  | HtmlFileContentPayload
  | ImageReferenceContentPayload
  | JsonContentPayload
  | RawLogContentPayload;

export interface MarkdownContentPayload {
  type: 'markdown';
  text: string;
}

export interface CodeBlockContentPayload {
  type: 'code-block';
  text: string;
  language?: string;
}

export interface DiffContentPayload {
  type: 'diff';
  text: string;
  format: 'git';
}

export interface HtmlFileContentPayload {
  type: 'html-file';
  text: string;
  mediaType: 'text/html';
}

export interface ImageReferenceContentPayload {
  type: 'image-reference';
  uri: string;
  alt: string;
  title?: string;
}

export interface JsonContentPayload {
  type: 'json';
  text: string;
}

export interface RawLogContentPayload {
  type: 'raw-log';
  text: string;
  ansi: boolean;
}

const FENCE_RE =
  /^ {0,3}(`{3,}|~{3,})[ \t]*([\w.+-]*)[^\r\n]*\r?\n([\s\S]*?)\r?\n {0,3}\1[ \t]*$/gm;
// Captured streams contain either the control byte or the diagnostic spelling
// `ESC[` when the CLI intentionally sanitizes terminal control characters.
const ANSI_RE = /(?:\u001b|ESC)\[[0-?]*[ -/]*[@-~]/;
const GIT_DIFF_RE =
  /^(?:diff --git\s+a\/.+\s+b\/.+|---\s+(?:a\/|\/dev\/null).+\r?\n\+\+\+\s+(?:b\/|\/dev\/null).+\r?\n@@\s)/m;
const HTML_DOCUMENT_RE = /^\s*(?:<!doctype\s+html\b|<html\b)[\s\S]*<\/html>\s*$/i;
const HTML_FRAGMENT_RE =
  /^\s*<(?:article|aside|body|button|div|footer|form|header|main|nav|section|table|template)\b[\s\S]*<\/(?:article|aside|body|button|div|footer|form|header|main|nav|section|table|template)>\s*$/i;
const IMAGE_RE = /^\s*!\[([^\]]*)\]\(\s*(?:(<[^>]+>)|([^\s)]+))(?:\s+["']([^"']*)["'])?\s*\)\s*$/;
const LOG_LINE_RE =
  /^(?:\d{4}-\d{2}-\d{2}[T ][^\s]+\s+)?(?:\[(?:trace|debug|info|warn|warning|error|fatal)\]|(?:trace|debug|info|warn|warning|error|fatal)\b)/i;

/**
 * Classifies one visible message body into renderer-safe payloads.
 *
 * Fenced mixed replies are split into Markdown prose plus typed fenced
 * payloads. Unfenced complete file/diff/JSON/log bodies are classified as a
 * single non-Markdown payload. Unknown prose remains Markdown for backwards
 * compatibility.
 */
export function classifyMessageContent(body: string): readonly MessageContentPayload[] {
  if (!body) return [];

  const fenced = splitFencedContent(body);
  if (fenced) return fenced;

  return [classifyAtomicContent(body)];
}

function splitFencedContent(body: string): MessageContentPayload[] | null {
  const payloads: MessageContentPayload[] = [];
  let cursor = 0;
  let found = false;

  for (const match of body.matchAll(FENCE_RE)) {
    found = true;
    const index = match.index ?? 0;
    pushMarkdown(payloads, body.slice(cursor, index));
    payloads.push(classifyFencedContent(match[3] ?? '', match[2] ?? ''));
    cursor = index + match[0].length;
  }

  if (!found) return null;
  pushMarkdown(payloads, body.slice(cursor));
  return payloads;
}

function pushMarkdown(payloads: MessageContentPayload[], text: string): void {
  const normalized = text.replace(/^(?:\r?\n)+|(?:\r?\n)+$/g, '');
  if (normalized.trim()) payloads.push({ type: 'markdown', text: normalized });
}

function classifyFencedContent(text: string, rawLanguage: string): MessageContentPayload {
  const language = normalizeLanguage(rawLanguage);
  if (language === 'diff' || language === 'patch') {
    return { type: 'diff', text, format: 'git' };
  }
  if (language === 'html') {
    return { type: 'html-file', text, mediaType: 'text/html' };
  }
  if (language === 'json' || language === 'jsonc' || language === 'jsonl') {
    return { type: 'json', text };
  }
  if (language === 'log' || language === 'ansi' || ANSI_RE.test(text)) {
    return { type: 'raw-log', text, ansi: ANSI_RE.test(text) };
  }
  return {
    type: 'code-block',
    text,
    ...(language ? { language } : {}),
  };
}

function classifyAtomicContent(text: string): MessageContentPayload {
  const trimmed = text.trim();
  const image = IMAGE_RE.exec(trimmed);
  if (image) {
    return {
      type: 'image-reference',
      uri: (image[2] ?? image[3] ?? '').replace(/^<|>$/g, ''),
      alt: image[1] ?? '',
      ...(image[4] ? { title: image[4] } : {}),
    };
  }

  if (GIT_DIFF_RE.test(trimmed)) {
    return { type: 'diff', text, format: 'git' };
  }
  if (HTML_DOCUMENT_RE.test(trimmed) || HTML_FRAGMENT_RE.test(trimmed)) {
    return { type: 'html-file', text, mediaType: 'text/html' };
  }
  if (isJson(trimmed)) {
    return { type: 'json', text };
  }
  if (ANSI_RE.test(text) || looksLikeLog(text)) {
    return { type: 'raw-log', text, ansi: ANSI_RE.test(text) };
  }

  const language = inferSourceLanguage(trimmed);
  if (language) {
    return { type: 'code-block', text, language };
  }
  return { type: 'markdown', text };
}

function isJson(text: string): boolean {
  if (
    !(text.startsWith('{') && text.endsWith('}')) &&
    !(text.startsWith('[') && text.endsWith(']'))
  ) {
    return false;
  }
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function looksLikeLog(text: string): boolean {
  const meaningfulLines = text.split(/\r?\n/).filter((line) => line.trim());
  if (meaningfulLines.length < 2) return false;
  return meaningfulLines.filter((line) => LOG_LINE_RE.test(line.trim())).length >= 2;
}

function inferSourceLanguage(text: string): string | null {
  if (
    /^(?:using\s+[\w.]+;|namespace\s+[\w.]+|(?:public|internal|private|protected)\s+(?:sealed\s+|static\s+|abstract\s+|partial\s+)*(?:class|record|interface|struct|enum)\s+\w+)/m.test(
      text,
    ) ||
    /\b(?:public|private|protected|internal)\s+(?:async\s+)?[\w.<>,?\[\]]+\s+\w+\s*\([^)]*\)\s*(?:=>|\{)/m.test(
      text,
    ) ||
    /^(?:\s*\[[\w.(,\s"'=]+\]\s*)*\s*(?:public|private|protected|internal)\s+(?:(?:readonly|const|static|required|volatile)\s+)*[\w.<>,?\[\]]+\s+\w+\s*(?:[;={])/m.test(
      text,
    )
  ) {
    return 'csharp';
  }
  if (/^(?:import|export)\s.+\sfrom\s+['"][^'"]+['"];?$/m.test(text)) {
    return /(?:interface|type)\s+\w+|:\s*(?:string|number|boolean)\b/.test(text)
      ? 'typescript'
      : 'javascript';
  }
  if (/^(?:def|class)\s+\w+.*:\s*$/m.test(text) && /^(?: {2,}|\t)\S/m.test(text)) {
    return 'python';
  }
  if (/^(?:package\s+\w+|func\s+\w+\s*\(|type\s+\w+\s+struct\b)/m.test(text)) {
    return 'go';
  }
  if (/^(?:SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE)\b[\s\S]*[;\n]$/i.test(text)) {
    return 'sql';
  }
  return null;
}

function normalizeLanguage(language: string): string {
  const normalized = language.trim().toLowerCase();
  if (normalized === 'cs') return 'csharp';
  if (normalized === 'ts') return 'typescript';
  if (normalized === 'js') return 'javascript';
  if (normalized === 'md') return 'markdown';
  if (normalized === 'htm') return 'html';
  return normalized;
}
