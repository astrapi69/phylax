import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { saveAIConfig, deleteAIConfig } from '../../db/aiConfig';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { classifyDocument, MIN_CLASSIFICATION_CONFIDENCE, buildContentBlocks } from './classify';
import { AiCallError } from './aiCallError';
import type { PreparedInput } from './types';

const TEST_PASSWORD = 'test-password-12';

async function unlockCurrent(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textInput(text: string): PreparedInput {
  return {
    mode: 'text',
    textContent: text,
    sourceFile: { name: 'note.txt', type: 'text/plain', size: text.length },
  };
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockCurrent();
  vi.restoreAllMocks();
});

afterEach(async () => {
  await deleteAIConfig();
});

describe('classifyDocument', () => {
  it('throws AiCallError ai-config-missing when no AI config saved', async () => {
    const input = textInput('Hallo');
    try {
      await classifyDocument(input);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(AiCallError);
      expect((err as AiCallError).kind).toBe('ai-config-missing');
    }
  });

  it('returns classification + uncertain=false on confidence above threshold', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-test', model: 'm' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        content: [
          {
            type: 'tool_use',
            id: 'tu_1',
            name: 'classify_document',
            input: { type: 'lab-report', confidence: 0.95 },
          },
        ],
        stop_reason: 'tool_use',
      }),
    );

    const result = await classifyDocument(textInput('Lab values'));

    expect(result.classification.type).toBe('lab-report');
    expect(result.classification.confidence).toBe(0.95);
    expect(result.uncertain).toBe(false);
  });

  it('returns uncertain=true when confidence is below threshold', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-test', model: 'm' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        content: [
          {
            type: 'tool_use',
            id: 'tu_1',
            name: 'classify_document',
            input: { type: 'doctor-letter', confidence: 0.4 },
          },
        ],
        stop_reason: 'tool_use',
      }),
    );

    const result = await classifyDocument(textInput('ambiguous'));
    expect(result.uncertain).toBe(true);
    expect(result.classification.confidence).toBeLessThan(MIN_CLASSIFICATION_CONFIDENCE);
  });

  it('throws malformed-response when tool_use missing', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'k', model: 'm' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ content: [{ type: 'text', text: 'no tool used' }], stop_reason: 'end_turn' }),
    );

    await expect(classifyDocument(textInput('x'))).rejects.toMatchObject({
      kind: 'malformed-response',
    });
  });

  it('throws malformed-response when classification type is invalid', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'k', model: 'm' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        content: [
          {
            type: 'tool_use',
            id: 'x',
            name: 'classify_document',
            input: { type: 'made-up-class', confidence: 0.8 },
          },
        ],
        stop_reason: 'tool_use',
      }),
    );

    await expect(classifyDocument(textInput('x'))).rejects.toMatchObject({
      kind: 'malformed-response',
    });
  });

  it('throws response-truncated when stop_reason is max_tokens', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'k', model: 'm' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ content: [], stop_reason: 'max_tokens' }),
    );

    await expect(classifyDocument(textInput('x'))).rejects.toMatchObject({
      kind: 'response-truncated',
    });
  });

  it('throws auth error on 401', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'k', model: 'm' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 401 }));

    await expect(
      classifyDocument(textInput('x'), { retryDelay: async () => undefined }),
    ).rejects.toMatchObject({ kind: 'auth' });
  });

  it('retries network errors and eventually succeeds', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'k', model: 'm' });
    let calls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      calls++;
      if (calls < 2) throw new TypeError('Failed to fetch');
      return jsonResponse({
        content: [
          {
            type: 'tool_use',
            id: 'x',
            name: 'classify_document',
            input: { type: 'lab-report', confidence: 0.9 },
          },
        ],
        stop_reason: 'tool_use',
      });
    });

    const result = await classifyDocument(textInput('x'), {
      retryDelay: async () => undefined,
    });
    expect(result.classification.type).toBe('lab-report');
    expect(calls).toBe(2);
  });
});

describe('buildContentBlocks', () => {
  it('text mode → single text block', () => {
    const blocks = buildContentBlocks(textInput('hello'));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'text', text: 'hello' });
  });

  it('image mode → text block + image block', () => {
    const blocks = buildContentBlocks({
      mode: 'image',
      imageData: new ArrayBuffer(2),
      sourceFile: { name: 's.png', type: 'image/png', size: 2 },
    });
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.type).toBe('text');
    expect(blocks[1]?.type).toBe('image');
  });

  it('multimodal mode → text block + N image blocks', () => {
    const blocks = buildContentBlocks({
      mode: 'multimodal',
      textContent: 'partial',
      imageData: [new ArrayBuffer(1), new ArrayBuffer(1), new ArrayBuffer(1)],
      sourceFile: { name: 's.pdf', type: 'application/pdf', size: 3 },
    });
    expect(blocks).toHaveLength(4);
    expect(blocks[0]?.type).toBe('text');
    expect(blocks.slice(1).every((b) => b.type === 'image')).toBe(true);
  });

  it('multimodal text block omits text section when textContent empty', () => {
    const blocks = buildContentBlocks({
      mode: 'multimodal',
      textContent: '',
      imageData: [new ArrayBuffer(1)],
      sourceFile: { name: 's.pdf', type: 'application/pdf', size: 1 },
    });
    expect(blocks[0]?.type).toBe('text');
    if (blocks[0]?.type !== 'text') throw new Error('unreachable');
    expect(blocks[0].text).not.toMatch(/Partial extracted text/);
  });
});
