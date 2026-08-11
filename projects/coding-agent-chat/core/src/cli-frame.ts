import type { CliFrameSource } from './projection-inputs';

/** Stable frame families used by the compatibility matrix and drift events. */
export type CliFrameFamily =
  'lifecycle' | 'message' | 'tool-call' | 'structured-runtime' | 'truncation';

export interface CliFrameInspection {
  /** Top-level kind, including a nested payload kind when that is the drift boundary. */
  kind: string;
  family: CliFrameFamily | 'unknown';
  known: boolean;
  cli: string;
  cliVersion: string;
}

type JsonRecord = Record<string, unknown>;

const CODEX_LIFECYCLE = new Set([
  'thread.started',
  'thread.completed',
  'turn.started',
  'turn.completed',
  'turn.failed',
  'session.started',
  'session.completed',
]);
const CODEX_ITEM_FAMILIES: Readonly<Record<string, CliFrameFamily>> = {
  agent_message: 'message',
  reasoning: 'structured-runtime',
  command_execution: 'tool-call',
  file_change: 'tool-call',
  mcp_tool_call: 'tool-call',
  web_search: 'tool-call',
  todo_list: 'structured-runtime',
};

const CLAUDE_SYSTEM_FAMILIES: Readonly<Record<string, CliFrameFamily>> = {
  init: 'lifecycle',
  status: 'structured-runtime',
  compact_boundary: 'truncation',
};
const CLAUDE_CONTENT_FAMILIES: Readonly<Record<string, CliFrameFamily>> = {
  text: 'message',
  thinking: 'structured-runtime',
  tool_use: 'tool-call',
  tool_result: 'tool-call',
};

const GEMINI_FRAME_FAMILIES: Readonly<Record<string, CliFrameFamily>> = {
  init: 'lifecycle',
  message: 'message',
  tool_call: 'tool-call',
  tool_use: 'tool-call',
  tool_result: 'tool-call',
  result: 'lifecycle',
  error: 'structured-runtime',
  truncation: 'truncation',
};

/**
 * Inspect one raw JSON frame against the captured CLI protocol families.
 * Returns `null` for ordinary text and JSON documents that are not transport
 * frames. Unknown nested item/content kinds are deliberately reported at the
 * nested boundary (`item.completed/new_kind`, `assistant/new_block`).
 */
export function inspectCliFrame(
  text: string,
  source?: CliFrameSource | null,
): CliFrameInspection | null {
  const frame = parseFrame(text);
  if (!frame) return null;

  const cli = normalizeCli(source?.cli) ?? inferCli(frame);
  if (!cli) return null;
  const cliVersion = source?.version?.trim() || inferVersion(frame) || 'unknown';

  if (cli === 'codex') return inspectCodexFrame(frame, cliVersion);
  if (cli === 'claude') return inspectClaudeFrame(frame, cliVersion);
  if (cli === 'gemini') return inspectGeminiFrame(frame, cliVersion);

  const type = stringValue(frame['type']);
  if (!type || !source) return null;
  return unknown(type, cli, cliVersion);
}

function inspectCodexFrame(frame: JsonRecord, cliVersion: string): CliFrameInspection | null {
  const type = stringValue(frame['type']);
  if (!type) return null;
  if (CODEX_LIFECYCLE.has(type)) return known(type, 'lifecycle', 'codex', cliVersion);
  if (type === 'error') return known(type, 'structured-runtime', 'codex', cliVersion);
  if (type === 'output.truncated' || type === 'response.output_text.truncated') {
    return known(type, 'truncation', 'codex', cliVersion);
  }
  if (type === 'item.started' || type === 'item.updated' || type === 'item.completed') {
    const item = recordValue(frame['item']);
    const itemType = stringValue(item?.['type']);
    if (!itemType) return unknown(`${type}/<missing-item-kind>`, 'codex', cliVersion);
    const family = CODEX_ITEM_FAMILIES[itemType];
    return family
      ? known(`${type}/${itemType}`, family, 'codex', cliVersion)
      : unknown(`${type}/${itemType}`, 'codex', cliVersion);
  }
  return unknown(type, 'codex', cliVersion);
}

function inspectClaudeFrame(frame: JsonRecord, cliVersion: string): CliFrameInspection | null {
  const type = stringValue(frame['type']);
  if (!type) return null;
  if (type === 'system') {
    const subtype = stringValue(frame['subtype']) ?? '<missing-subtype>';
    const family = CLAUDE_SYSTEM_FAMILIES[subtype];
    return family
      ? known(`${type}/${subtype}`, family, 'claude', cliVersion)
      : unknown(`${type}/${subtype}`, 'claude', cliVersion);
  }
  if (type === 'assistant' || type === 'user') {
    const message = recordValue(frame['message']);
    const content = message?.['content'];
    if (!Array.isArray(content)) return unknown(`${type}/<missing-content>`, 'claude', cliVersion);
    const kinds = content
      .map((block) => stringValue(recordValue(block)?.['type']))
      .filter((kind): kind is string => kind !== null);
    const unknownKind = kinds.find((kind) => CLAUDE_CONTENT_FAMILIES[kind] === undefined);
    if (unknownKind) return unknown(`${type}/${unknownKind}`, 'claude', cliVersion);
    const family = kinds.some((kind) => CLAUDE_CONTENT_FAMILIES[kind] === 'tool-call')
      ? 'tool-call'
      : kinds.some((kind) => CLAUDE_CONTENT_FAMILIES[kind] === 'message')
        ? 'message'
        : 'structured-runtime';
    return known(`${type}/${kinds.join('+') || '<empty>'}`, family, 'claude', cliVersion);
  }
  if (type === 'result') {
    const subtype = stringValue(frame['subtype']) ?? '<missing-subtype>';
    if (subtype === 'success' || subtype === 'error_during_execution') {
      return known(`${type}/${subtype}`, 'lifecycle', 'claude', cliVersion);
    }
    return unknown(`${type}/${subtype}`, 'claude', cliVersion);
  }
  if (type === 'rate_limit_event' || type === 'stream_event') {
    return known(type, 'structured-runtime', 'claude', cliVersion);
  }
  return unknown(type, 'claude', cliVersion);
}

function inspectGeminiFrame(frame: JsonRecord, cliVersion: string): CliFrameInspection | null {
  const type = stringValue(frame['type']);
  if (!type) return null;
  const family = GEMINI_FRAME_FAMILIES[type];
  if (!family) return unknown(type, 'gemini', cliVersion);
  if (type === 'message') {
    const role = stringValue(frame['role']);
    if (role !== 'assistant' && role !== 'user') {
      return unknown(`${type}/${role ?? '<missing-role>'}`, 'gemini', cliVersion);
    }
    return known(`${type}/${role}`, family, 'gemini', cliVersion);
  }
  return known(type, family, 'gemini', cliVersion);
}

function known(
  kind: string,
  family: CliFrameFamily,
  cli: string,
  cliVersion: string,
): CliFrameInspection {
  return { kind, family, known: true, cli, cliVersion };
}

function unknown(kind: string, cli: string, cliVersion: string): CliFrameInspection {
  return { kind, family: 'unknown', known: false, cli, cliVersion };
}

function parseFrame(text: string): JsonRecord | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    return recordValue(JSON.parse(trimmed));
  } catch {
    return null;
  }
}

function inferCli(frame: JsonRecord): string | null {
  const type = stringValue(frame['type']);
  if (!type) return null;
  if (
    type.startsWith('thread.') ||
    type.startsWith('turn.') ||
    type.startsWith('item.') ||
    type.startsWith('response.') ||
    type.startsWith('session.')
  ) {
    return 'codex';
  }
  if (typeof frame['claude_code_version'] === 'string') return 'claude';
  return null;
}

function inferVersion(frame: JsonRecord): string | null {
  return stringValue(frame['claude_code_version']);
}

function normalizeCli(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('codex')) return 'codex';
  if (normalized.includes('claude')) return 'claude';
  if (normalized.includes('gemini')) return 'gemini';
  return normalized;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function recordValue(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}
