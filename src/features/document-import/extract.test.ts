import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { saveAIConfig, deleteAIConfig } from '../../db/aiConfig';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { extractEntries } from './extract';
import { AiCallError } from './aiCallError';
import type { DocumentClassification, PreparedInput } from './types';

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
    sourceFile: { name: 'lab.txt', type: 'text/plain', size: text.length },
  };
}

const LAB_CLASSIFICATION: DocumentClassification = {
  type: 'lab-report',
  confidence: 0.95,
};

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockCurrent();
  vi.restoreAllMocks();
});

afterEach(async () => {
  await deleteAIConfig();
});

describe('extractEntries', () => {
  it('throws ai-config-missing when no AI config saved', async () => {
    await expect(extractEntries(textInput('x'), LAB_CLASSIFICATION)).rejects.toMatchObject({
      kind: 'ai-config-missing',
    });
  });

  it('runs all four per-class extractors and returns aggregated drafts', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk', model: 'm' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse((init as RequestInit).body as string);
      const toolName = body.tool_choice?.name;
      if (toolName === 'extract_observations') {
        return jsonResponse({
          content: [
            {
              type: 'tool_use',
              id: 't',
              name: 'extract_observations',
              input: {
                observations: [
                  {
                    theme: 'Schulter',
                    fact: 'Schmerz beim Heben',
                    pattern: 'Nur unter Belastung',
                    selfRegulation: 'Kraefttraining',
                    status: 'in Besserung',
                  },
                ],
              },
            },
          ],
          stop_reason: 'tool_use',
        });
      }
      if (toolName === 'extract_lab_values') {
        return jsonResponse({
          content: [
            {
              type: 'tool_use',
              id: 't',
              name: 'extract_lab_values',
              input: {
                labValues: [
                  {
                    category: 'Blutbild',
                    parameter: 'Haemoglobin',
                    result: '14.2',
                    unit: 'g/dl',
                    referenceRange: '13.5-17.5',
                    assessment: 'normal',
                  },
                ],
              },
            },
          ],
          stop_reason: 'tool_use',
        });
      }
      if (toolName === 'extract_supplements') {
        return jsonResponse({
          content: [
            {
              type: 'tool_use',
              id: 't',
              name: 'extract_supplements',
              input: { supplements: [{ name: 'Vitamin D3 2000 IE', category: 'daily' }] },
            },
          ],
          stop_reason: 'tool_use',
        });
      }
      if (toolName === 'extract_open_points') {
        return jsonResponse({
          content: [
            {
              type: 'tool_use',
              id: 't',
              name: 'extract_open_points',
              input: {
                openPoints: [{ text: 'Wiederholungs-Blutabnahme', context: 'In 3 Monaten' }],
              },
            },
          ],
          stop_reason: 'tool_use',
        });
      }
      return jsonResponse({ content: [] });
    });

    const result = await extractEntries(textInput('lab data'), LAB_CLASSIFICATION);

    expect(fetchSpy).toHaveBeenCalledTimes(4);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]?.theme).toBe('Schulter');
    expect(result.observations[0]?.source).toBe('ai');
    expect(result.labValues).toHaveLength(1);
    expect(result.labValues[0]?.parameter).toBe('Haemoglobin');
    expect(result.supplements).toHaveLength(1);
    expect(result.supplements[0]?.category).toBe('daily');
    expect(result.openPoints).toHaveLength(1);
    expect(result.openPoints[0]?.resolved).toBe(false);
  });

  it('returns empty arrays when extractors return no items', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk', model: 'm' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse((init as RequestInit).body as string);
      const toolName = body.tool_choice?.name as string;
      const arrayKey = toolName
        .replace('extract_', '')
        .replace(/_(\w)/g, (_m, c) => c.toUpperCase());
      return jsonResponse({
        content: [
          {
            type: 'tool_use',
            id: 't',
            name: toolName,
            input: { [arrayKey]: [] },
          },
        ],
        stop_reason: 'tool_use',
      });
    });

    const result = await extractEntries(textInput('empty'), LAB_CLASSIFICATION);
    expect(result.observations).toEqual([]);
    expect(result.labValues).toEqual([]);
    expect(result.supplements).toEqual([]);
    expect(result.openPoints).toEqual([]);
  });

  it('propagates AiCallError when one of the parallel calls fails', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk', model: 'm' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse((init as RequestInit).body as string);
      if (body.tool_choice?.name === 'extract_lab_values') {
        return new Response('', { status: 401 });
      }
      return jsonResponse({
        content: [
          {
            type: 'tool_use',
            id: 't',
            name: body.tool_choice?.name as string,
            input: {},
          },
        ],
        stop_reason: 'tool_use',
      });
    });

    await expect(
      extractEntries(textInput('x'), LAB_CLASSIFICATION, { retryDelay: async () => undefined }),
    ).rejects.toBeInstanceOf(AiCallError);
  });

  it('coerces malformed supplement category to on-demand', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk', model: 'm' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse((init as RequestInit).body as string);
      const toolName = body.tool_choice?.name as string;
      if (toolName === 'extract_supplements') {
        return jsonResponse({
          content: [
            {
              type: 'tool_use',
              id: 't',
              name: toolName,
              input: { supplements: [{ name: 'Vitamin C', category: 'BOGUS' }] },
            },
          ],
          stop_reason: 'tool_use',
        });
      }
      const arrayKey = toolName
        .replace('extract_', '')
        .replace(/_(\w)/g, (_m, c) => c.toUpperCase());
      return jsonResponse({
        content: [{ type: 'tool_use', id: 't', name: toolName, input: { [arrayKey]: [] } }],
        stop_reason: 'tool_use',
      });
    });

    const result = await extractEntries(textInput('x'), LAB_CLASSIFICATION);
    expect(result.supplements[0]?.category).toBe('on-demand');
  });
});
