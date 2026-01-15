import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearActiveSession,
  clearSession,
} from '@/lib/ai-analysis-persistence/cleanup';
import {
  type PersistedAiAnalysisHydratedV1,
  type PersistedAiAnalysisPartV1,
  getActiveSessionId,
  getFileFingerprint,
  isSameFingerprint,
} from '@/lib/ai-analysis-persistence/storage';
import {
  addSavedPartIndex,
  createNewSessionMeta,
  loadActiveSession,
  setActiveSessionMeta,
  type PersistMetaUpdate,
  updateSessionMeta,
} from '@/lib/ai-analysis-persistence/stateManager';
import { saveAiAnalysisPart, type SavePartResult } from '@/lib/ai-analysis-persistence/history';

export const useAiAnalysisPersistence = () => {
  const [hydrated, setHydrated] = useState<PersistedAiAnalysisHydratedV1 | null>(null);
  const metaRef = useRef<PersistedAiAnalysisHydratedV1['meta'] | null>(null);

  useEffect(() => {
    const loaded = loadActiveSession();
    const activeId = getActiveSessionId();
    if (activeId && !loaded) {
      clearActiveSession();
    }
    if (!loaded) {
      setHydrated(null);
      metaRef.current = null;
      return;
    }
    const normalizedMeta =
      loaded.meta.status === 'running' ? updateSessionMeta(loaded.meta, { status: 'stopped' }) : loaded.meta;
    const normalizedHydrated = normalizedMeta === loaded.meta ? loaded : { ...loaded, meta: normalizedMeta };
    setHydrated(normalizedHydrated);
    metaRef.current = normalizedMeta;
  }, []);

  const hasActiveSession = !!hydrated?.meta?.sessionId;

  const activeFingerprint = useMemo(() => hydrated?.meta.file || null, [hydrated?.meta.file]);

  const matchesActiveFile = useCallback(
    (file: Pick<File, 'name' | 'size' | 'lastModified' | 'type'>) => {
      if (!activeFingerprint) return false;
      return isSameFingerprint(activeFingerprint, getFileFingerprint(file));
    },
    [activeFingerprint],
  );

  const clearActive = useCallback(() => {
    clearActiveSession();
    setHydrated(null);
    metaRef.current = null;
  }, []);

  const startNewSession = useCallback(
    ({
      file,
      provider,
      model,
      confirmedHeaders,
      localResult,
    }: {
      file: Pick<File, 'name' | 'size' | 'lastModified' | 'type'>;
      provider: 'gemini' | 'kimi';
      model: string;
      confirmedHeaders: string[];
      localResult?: { headers: string[]; rows: string[][] } | null;
    }) => {
      const meta = createNewSessionMeta({
        file: getFileFingerprint(file),
        provider,
        model,
        confirmedHeaders,
        localResult: localResult ?? null,
      });
      setActiveSessionMeta(meta);
      metaRef.current = meta;
      setHydrated(prev => (prev ? { ...prev, meta, parts: [] } : { meta, parts: [] }));
      return meta;
    },
  []);

  const updateMeta = useCallback((update: PersistMetaUpdate) => {
    const current = metaRef.current;
    if (!current) return null;
    const next = updateSessionMeta(current, update);
    metaRef.current = next;
    setHydrated(prev => (prev ? { ...prev, meta: next } : prev));
    return next;
  }, []);

  const addPart = useCallback(
    ({
      partIndex,
      headers,
      rows,
    }: {
      partIndex: number;
      headers: string[];
      rows: string[][];
    }): SavePartResult => {
      const meta = metaRef.current;
      if (!meta) return { ok: false, reason: 'storage_unavailable' };
      const result = saveAiAnalysisPart({ meta, partIndex, headers, rows });
      if (!result.ok) return result;
      const updatedMeta = addSavedPartIndex(meta, partIndex);
      metaRef.current = updatedMeta;
      const persistedPart: PersistedAiAnalysisPartV1 = {
        version: 1,
        sessionId: updatedMeta.sessionId,
        partIndex,
        storedAt: Date.now(),
        headers,
        rows,
      };
      setHydrated(prev => {
        if (!prev) return prev;
        const nextParts = [...prev.parts.filter(p => p.partIndex !== partIndex), persistedPart].sort(
          (a, b) => a.partIndex - b.partIndex,
        );
        return { ...prev, meta: updatedMeta, parts: nextParts };
      });
      return { ok: true };
    },
    [],
  );

  const replaceHydrated = useCallback((next: PersistedAiAnalysisHydratedV1 | null) => {
    setHydrated(next);
    metaRef.current = next?.meta || null;
  }, []);

  const clearSessionById = useCallback((sessionId: string) => {
    clearSession(sessionId);
    if (metaRef.current?.sessionId === sessionId) {
      setHydrated(null);
      metaRef.current = null;
    }
  }, []);

  return {
    hydrated,
    replaceHydrated,
    metaRef,
    hasActiveSession,
    matchesActiveFile,
    startNewSession,
    updateMeta,
    addPart,
    clearActive,
    clearSessionById,
  };
};
