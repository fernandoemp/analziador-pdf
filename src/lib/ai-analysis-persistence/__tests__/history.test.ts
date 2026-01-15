import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAiAnalysisPart, saveAiAnalysisPart } from '@/lib/ai-analysis-persistence/history';
import { clearSession } from '@/lib/ai-analysis-persistence/cleanup';

beforeEach(() => {
  localStorage.clear();
});

describe('ai-analysis-persistence/history', () => {
  it('saves and loads an analysis part', () => {
    const meta = {
      version: 1 as const,
      sessionId: 's1',
      createdAt: 1,
      updatedAt: 1,
      file: { name: 'a.pdf', size: 10, lastModified: 20, type: 'application/pdf' },
      provider: 'gemini' as const,
      model: 'm',
      status: 'running' as const,
      confirmedHeaders: ['h1'],
      totalParts: 2,
      processedParts: 1,
      nextPartIndex: 1,
      savedPartIndices: [],
      currentAiLogId: null,
      localResult: null,
    };

    const result = saveAiAnalysisPart({ meta, partIndex: 0, headers: ['h1'], rows: [['r1']] });
    expect(result.ok).toBe(true);

    const part = loadAiAnalysisPart(meta.sessionId, 0);
    expect(part?.headers).toEqual(['h1']);
    expect(part?.rows).toEqual([['r1']]);
  });

  it('returns quota_exceeded when localStorage rejects writes', () => {
    const meta = {
      version: 1 as const,
      sessionId: 's2',
      createdAt: 1,
      updatedAt: 1,
      file: { name: 'b.pdf', size: 10, lastModified: 20, type: 'application/pdf' },
      provider: 'gemini' as const,
      model: 'm',
      status: 'running' as const,
      confirmedHeaders: ['h1'],
      totalParts: 2,
      processedParts: 1,
      nextPartIndex: 1,
      savedPartIndices: [],
      currentAiLogId: null,
      localResult: null,
    };

    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      const err = new Error('quota');
      (err as unknown as { name: string }).name = 'QuotaExceededError';
      throw err;
    });

    const result = saveAiAnalysisPart({ meta, partIndex: 0, headers: ['h1'], rows: [['r1']] });
    expect(result.ok).toBe(false);
    if (!result.ok && 'reason' in result) {
      expect(result.reason).toBe('quota_exceeded');
    }

    spy.mockRestore();
    clearSession(meta.sessionId);
  });
});
