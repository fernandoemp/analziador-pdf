import {
  type PersistedAiAnalysisMetaV1,
  type PersistedAiAnalysisPartV1,
  isQuotaExceededError,
  loadSessionPart,
  removeSessionPart,
  saveSessionPart,
} from '@/lib/ai-analysis-persistence/storage';

export type SavePartResult =
  | { ok: true }
  | { ok: false; reason: 'quota_exceeded' | 'storage_unavailable' | 'unknown'; error?: unknown };

export const saveAiAnalysisPart = ({
  meta,
  partIndex,
  headers,
  rows,
}: {
  meta: PersistedAiAnalysisMetaV1;
  partIndex: number;
  headers: string[];
  rows: string[][];
}): SavePartResult => {
  const part: PersistedAiAnalysisPartV1 = {
    version: 1,
    sessionId: meta.sessionId,
    partIndex,
    storedAt: Date.now(),
    headers,
    rows,
  };

  try {
    saveSessionPart(part);
    return { ok: true };
  } catch (error) {
    if (isQuotaExceededError(error)) return { ok: false, reason: 'quota_exceeded', error };
    return { ok: false, reason: 'unknown', error };
  }
};

export const loadAiAnalysisPart = (sessionId: string, partIndex: number) => loadSessionPart(sessionId, partIndex);

export const deleteAiAnalysisPart = (sessionId: string, partIndex: number) => removeSessionPart(sessionId, partIndex);

