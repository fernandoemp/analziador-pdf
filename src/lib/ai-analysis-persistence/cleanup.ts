import {
  clearActiveSessionId,
  getActiveSessionId,
  loadSessionMeta,
  removeSessionMeta,
  removeSessionPart,
} from '@/lib/ai-analysis-persistence/storage';

const STORAGE_PREFIX = 'pdfStructuredExtractor.aiAnalysis.session.';

const getStorage = (): Storage | null => {
  if (typeof globalThis === 'undefined') return null;
  const ls = (globalThis as unknown as { localStorage?: Storage }).localStorage;
  return ls || null;
};

export const clearSession = (sessionId: string) => {
  const storage = getStorage();
  if (!storage) return;

  const meta = loadSessionMeta(sessionId);
  if (meta) {
    for (const idx of meta.savedPartIndices) {
      removeSessionPart(sessionId, idx);
    }
  } else {
    const prefix = `${STORAGE_PREFIX}${sessionId}.part.`;
    const toDelete: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(prefix)) toDelete.push(k);
    }
    for (const k of toDelete) {
      storage.removeItem(k);
    }
  }

  removeSessionMeta(sessionId);
};

export const clearActiveSession = () => {
  const sessionId = getActiveSessionId();
  if (!sessionId) {
    clearActiveSessionId();
    return;
  }
  clearSession(sessionId);
  clearActiveSessionId();
};

