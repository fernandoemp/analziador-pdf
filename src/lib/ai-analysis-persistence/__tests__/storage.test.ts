import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearActiveSessionId,
  loadActiveSessionHydrated,
  loadSessionMeta,
  loadSessionPart,
  saveSessionMeta,
  saveSessionPart,
  setActiveSessionId,
} from '@/lib/ai-analysis-persistence/storage';

beforeEach(() => {
  localStorage.clear();
  clearActiveSessionId();
});

describe('ai-analysis-persistence/storage', () => {
  it('hydrates an active session with parts', () => {
    const sessionId = 's1';
    saveSessionMeta({
      version: 1,
      sessionId,
      createdAt: 1,
      updatedAt: 1,
      file: { name: 'a.pdf', size: 10, lastModified: 20, type: 'application/pdf' },
      provider: 'gemini',
      model: 'm',
      status: 'running',
      confirmedHeaders: ['h1'],
      totalParts: 2,
      processedParts: 1,
      nextPartIndex: 1,
      savedPartIndices: [0],
      currentAiLogId: null,
      localResult: null,
    });
    saveSessionPart({
      version: 1,
      sessionId,
      partIndex: 0,
      storedAt: 2,
      headers: ['h1'],
      rows: [['r1']],
    });
    setActiveSessionId(sessionId);

    const hydrated = loadActiveSessionHydrated();
    expect(hydrated?.meta.sessionId).toBe(sessionId);
    expect(hydrated?.parts).toHaveLength(1);
    expect(hydrated?.parts[0].rows).toEqual([['r1']]);
  });

  it('returns null when a referenced part is missing', () => {
    const sessionId = 's2';
    saveSessionMeta({
      version: 1,
      sessionId,
      createdAt: 1,
      updatedAt: 1,
      file: { name: 'b.pdf', size: 10, lastModified: 20, type: 'application/pdf' },
      provider: 'gemini',
      model: 'm',
      status: 'running',
      confirmedHeaders: ['h1'],
      totalParts: 2,
      processedParts: 1,
      nextPartIndex: 1,
      savedPartIndices: [0],
      currentAiLogId: null,
      localResult: null,
    });
    setActiveSessionId(sessionId);

    expect(loadSessionMeta(sessionId)).not.toBeNull();
    expect(loadSessionPart(sessionId, 0)).toBeNull();
    expect(loadActiveSessionHydrated()).toBeNull();
  });
});

