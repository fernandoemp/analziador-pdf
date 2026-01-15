import { beforeEach, describe, expect, it } from 'vitest';
import { clearActiveSession, clearSession } from '@/lib/ai-analysis-persistence/cleanup';
import {
  clearActiveSessionId,
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

describe('ai-analysis-persistence/cleanup', () => {
  it('clears a session meta and its parts', () => {
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
      savedPartIndices: [0, 1],
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
    saveSessionPart({
      version: 1,
      sessionId,
      partIndex: 1,
      storedAt: 3,
      headers: ['h1'],
      rows: [['r2']],
    });

    clearSession(sessionId);

    expect(loadSessionMeta(sessionId)).toBeNull();
    expect(loadSessionPart(sessionId, 0)).toBeNull();
    expect(loadSessionPart(sessionId, 1)).toBeNull();
  });

  it('clears the active session when present', () => {
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
      savedPartIndices: [],
      currentAiLogId: null,
      localResult: null,
    });
    setActiveSessionId(sessionId);

    clearActiveSession();

    expect(loadSessionMeta(sessionId)).toBeNull();
  });
});

