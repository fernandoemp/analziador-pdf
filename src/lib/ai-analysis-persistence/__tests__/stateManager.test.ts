import { beforeEach, describe, expect, it } from 'vitest';
import {
  createNewSessionMeta,
  setActiveSessionMeta,
  updateSessionMeta,
} from '@/lib/ai-analysis-persistence/stateManager';
import { clearActiveSessionId, getActiveSessionId, loadSessionMeta } from '@/lib/ai-analysis-persistence/storage';

beforeEach(() => {
  localStorage.clear();
  clearActiveSessionId();
});

describe('ai-analysis-persistence/stateManager', () => {
  it('creates, stores, and updates session meta', () => {
    const meta = createNewSessionMeta({
      file: { name: 'a.pdf', size: 10, lastModified: 20, type: 'application/pdf' },
      provider: 'gemini',
      model: 'm',
      confirmedHeaders: ['h1'],
      localResult: null,
    });

    setActiveSessionMeta(meta);
    expect(getActiveSessionId()).toBe(meta.sessionId);
    expect(loadSessionMeta(meta.sessionId)?.status).toBe('idle');

    const updated = updateSessionMeta(meta, { status: 'running', processedParts: 2, nextPartIndex: 2 });
    const reloaded = loadSessionMeta(meta.sessionId);
    expect(reloaded?.status).toBe('running');
    expect(reloaded?.processedParts).toBe(2);
    expect(reloaded?.nextPartIndex).toBe(2);
    expect(reloaded?.updatedAt).toBeGreaterThanOrEqual(updated.updatedAt);
  });
});

