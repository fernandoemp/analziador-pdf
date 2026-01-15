import { v4 as uuidv4 } from 'uuid';
import {
  type FileFingerprint,
  type PersistedAiAnalysisLocalResultV1,
  type PersistedAiAnalysisMetaV1,
  getActiveSessionId,
  loadActiveSessionHydrated,
  loadSessionMeta,
  saveSessionMeta,
  setActiveSessionId,
} from '@/lib/ai-analysis-persistence/storage';

export type PersistMetaUpdate = Partial<
  Pick<
    PersistedAiAnalysisMetaV1,
    | 'status'
    | 'provider'
    | 'model'
    | 'confirmedHeaders'
    | 'totalParts'
    | 'processedParts'
    | 'nextPartIndex'
    | 'savedPartIndices'
    | 'currentAiLogId'
    | 'localResult'
  >
>;

export const createNewSessionMeta = ({
  file,
  provider,
  model,
  confirmedHeaders,
  localResult,
}: {
  file: FileFingerprint;
  provider: PersistedAiAnalysisMetaV1['provider'];
  model: string;
  confirmedHeaders: string[];
  localResult?: PersistedAiAnalysisLocalResultV1 | null;
}): PersistedAiAnalysisMetaV1 => {
  const sessionId = uuidv4();
  const now = Date.now();
  return {
    version: 1,
    sessionId,
    createdAt: now,
    updatedAt: now,
    file,
    provider,
    model,
    status: 'idle',
    confirmedHeaders,
    totalParts: null,
    processedParts: 0,
    nextPartIndex: 0,
    savedPartIndices: [],
    currentAiLogId: null,
    localResult: localResult ?? null,
  };
};

export const setActiveSessionMeta = (meta: PersistedAiAnalysisMetaV1) => {
  setActiveSessionId(meta.sessionId);
  saveSessionMeta(meta);
};

export const updateSessionMeta = (meta: PersistedAiAnalysisMetaV1, update: PersistMetaUpdate) => {
  const now = Date.now();
  const next: PersistedAiAnalysisMetaV1 = {
    ...meta,
    ...update,
    updatedAt: now,
  };
  saveSessionMeta(next);
  return next;
};

export const addSavedPartIndex = (meta: PersistedAiAnalysisMetaV1, partIndex: number) => {
  if (meta.savedPartIndices.includes(partIndex)) return meta;
  const nextList = [...meta.savedPartIndices, partIndex].sort((a, b) => a - b);
  return updateSessionMeta(meta, { savedPartIndices: nextList });
};

export const loadActiveSession = () => loadActiveSessionHydrated();

export const loadActiveSessionMeta = () => {
  const id = getActiveSessionId();
  if (!id) return null;
  return loadSessionMeta(id);
};

