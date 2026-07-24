/**
 * Normal chat replies stay fully visible. Only transcript-sized bodies use
 * progressive disclosure, based on stable source text rather than layout.
 */
export const MESSAGE_COLLAPSE_LINE_THRESHOLD = 40;
export const MESSAGE_COLLAPSE_CHAR_THRESHOLD = 3000;

const EXPANDED_MESSAGE_IDS_KEY = 'coding-agent-chat.expanded-message-ids';
const MAX_PERSISTED_IDS = 500;

export function isMessageCollapsible(body: string): boolean {
  if (!body) return false;
  return countSourceLines(body) > MESSAGE_COLLAPSE_LINE_THRESHOLD
    || body.length > MESSAGE_COLLAPSE_CHAR_THRESHOLD;
}

export function readExpandedMessageIds(): ReadonlySet<string> {
  try {
    const raw = globalThis.sessionStorage?.getItem(EXPANDED_MESSAGE_IDS_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0));
  } catch {
    return new Set();
  }
}

export function persistExpandedMessageIds(ids: ReadonlySet<string>): void {
  try {
    const bounded = Array.from(ids).slice(-MAX_PERSISTED_IDS);
    globalThis.sessionStorage?.setItem(EXPANDED_MESSAGE_IDS_KEY, JSON.stringify(bounded));
  } catch {
    // Storage can be unavailable in restricted embeds. In-memory state still works.
  }
}

function countSourceLines(text: string): number {
  return text.replace(/\n+$/, '').split('\n').length;
}
