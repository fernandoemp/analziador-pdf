import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  settingsDb,
  type AiExtractionLog,
  type AiModelConfig,
  type AiProviderId,
  type AiRequestLog,
} from '@/lib/localDb';
import {
  analyzePDFWithGemini,
  analyzePDFWithKimi,
  detectPdfHeadersWithGemini,
  detectPdfHeadersWithKimi,
} from '@/lib/pdfToExcelAI';
import { computeInvalidAmountRows, computeSimpleDiff, normalizeHeaderText } from '@/lib/pdfStructuredExtractorUtils';
import { matchesSearchTokens, tokenizeSearchQuery, normalizeSearchText } from '@/lib/textSearch';
import { useAiAnalysisPersistence } from '@/hooks/useAiAnalysisPersistence';

export const useAiPdfVerification = ({
  selectedFile,
  localHeaders,
  localRows,
}: {
  selectedFile: File | null;
  localHeaders: string[];
  localRows: string[][];
}) => {
  const AI_PREFS_STORAGE_KEY = 'pdf-structured-extractor:ai-preferences:v1';
  const AI_PREFS_CHANGED_EVENT = 'pdf-structured-extractor:ai-preferences:changed';
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyError, setVerifyError] = useState<string>('');
  const [verifyMessage, setVerifyMessage] = useState<string>('');
  const [verifyDebugLog, setVerifyDebugLog] = useState<string>('');
  const [diff, setDiff] = useState<{ missingRows: number; extraRows: number; mismatchedAmounts: number } | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [aiAnalysisState, setAiAnalysisState] = useState<'idle' | 'running' | 'stopped' | 'failed' | 'completed'>('idle');
  const [selectedProvider, setSelectedProvider] = useState<AiProviderId>('gemini');
  const [models, setModels] = useState<AiModelConfig[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [customModel, setCustomModel] = useState<string>('');
  const [temperature, setTemperature] = useState<number>(0.1);
  const [topP, setTopP] = useState<number | undefined>(undefined);
  const [stream, setStream] = useState<boolean>(false);

  const [showHistoryIa, setShowHistoryIa] = useState<boolean>(false);
  const [focusAiLogId, setFocusAiLogId] = useState<string | null>(null);
  const [currentAiLogId, setCurrentAiLogId] = useState<string | null>(null);
  const [aiLogs, setAiLogs] = useState<AiExtractionLog[]>([]);
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false);

  const [totalParts, setTotalParts] = useState<number | null>(null);
  const [processedParts, setProcessedParts] = useState<number>(0);
  const [aiPageRowCounts, setAiPageRowCounts] = useState<number[]>([]);

  const [aiHeaders, setAiHeaders] = useState<string[]>([]);
  const [aiRows, setAiRows] = useState<string[][]>([]);

  const [headerCandidate, setHeaderCandidate] = useState<string[] | null>(null);
  const [confirmedHeaders, setConfirmedHeaders] = useState<string[] | null>(null);
  const [headerDraft, setHeaderDraft] = useState<string[] | null>(null);

  const [deleteColumnIndex, setDeleteColumnIndex] = useState<number | null>(null);
  const [showDeleteColumnModal, setShowDeleteColumnModal] = useState<boolean>(false);

  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [descriptionFilter, setDescriptionFilter] = useState<string>('');
  const [isFilterPending, startFilterTransition] = useTransition();
  const [currentPage, setCurrentPage] = useState<number>(1);
  const lastUnfilteredPageRef = useRef<number>(1);

  const aiAbortControllerRef = useRef<AbortController | null>(null);
  const aiRowsRef = useRef<string[][]>([]);
  const aiHeadersRef = useRef<string[]>([]);
  const aiNextPartIndexRef = useRef<number>(0);
  const currentAiLogIdRef = useRef<string | null>(null);
  const lastHydratedSessionIdRef = useRef<string | null>(null);
  const skipPrefsWriteRef = useRef<boolean>(false);

  const aiPersistence = useAiAnalysisPersistence();
  const hydratedAiSession = aiPersistence.hydrated;

  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    colIndex: number;
    value: string;
  } | null>(null);

  useEffect(() => {
    const initialModels = settingsDb.getAiModels();
    setModels(initialModels);
    const readPrefs = (): { provider: AiProviderId; modelId: string; customModel: string } | null => {
      try {
        const raw = localStorage.getItem(AI_PREFS_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') return null;
        const p = parsed as { provider?: unknown; modelId?: unknown; customModel?: unknown };
        const provider = p.provider === 'gemini' || p.provider === 'kimi' ? (p.provider as AiProviderId) : null;
        if (!provider) return null;
        return {
          provider,
          modelId: typeof p.modelId === 'string' ? p.modelId : '',
          customModel: typeof p.customModel === 'string' ? p.customModel : '',
        };
      } catch {
        return null;
      }
    };

    const resolveDefaultModelId = (provider: AiProviderId) => {
      if (initialModels.length === 0) return '';
      if (provider === 'gemini') {
        const preferred = initialModels.find((m) => m.provider === 'gemini' && m.id === 'gemini-2.5-pro');
        if (preferred) return preferred.id;
      }
      const firstForProvider = initialModels.find((m) => m.provider === provider);
      if (firstForProvider) return firstForProvider.id;
      return initialModels[0]?.id ?? '';
    };

    const prefs = readPrefs();
    const initialProvider: AiProviderId = prefs?.provider ?? 'gemini';
    const initialModelId =
      prefs?.modelId && initialModels.some((m) => m.provider === initialProvider && m.id === prefs.modelId)
        ? prefs.modelId
        : resolveDefaultModelId(initialProvider);

    setSelectedProvider(initialProvider);
    setSelectedModelId(initialModelId);
    if (typeof prefs?.customModel === 'string') setCustomModel(prefs.customModel);

    const initialLogs = settingsDb.getAiLogs();
    setAiLogs(initialLogs);
  }, [AI_PREFS_STORAGE_KEY]);

  useEffect(() => {
    try {
      if (skipPrefsWriteRef.current) {
        skipPrefsWriteRef.current = false;
        return;
      }
      localStorage.setItem(
        AI_PREFS_STORAGE_KEY,
        JSON.stringify({ provider: selectedProvider, modelId: selectedModelId, customModel }),
      );
    } catch {
      return;
    }
  }, [AI_PREFS_STORAGE_KEY, customModel, selectedModelId, selectedProvider]);

  useEffect(() => {
    if (models.length === 0) return;

    const resolveDefaultModelId = (provider: AiProviderId) => {
      if (provider === 'gemini') {
        const preferred = models.find((m) => m.provider === 'gemini' && m.id === 'gemini-2.5-pro');
        if (preferred) return preferred.id;
      }
      const firstForProvider = models.find((m) => m.provider === provider);
      if (firstForProvider) return firstForProvider.id;
      return models[0]?.id ?? '';
    };

    const applyPrefsFromStorage = () => {
      try {
        const raw = localStorage.getItem(AI_PREFS_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') return;
        const p = parsed as { provider?: unknown; modelId?: unknown; customModel?: unknown };
        const nextProvider = p.provider === 'gemini' || p.provider === 'kimi' ? p.provider : null;
        if (!nextProvider) return;

        const requestedModelId = typeof p.modelId === 'string' ? p.modelId : '';
        const resolvedModelId =
          requestedModelId && models.some((m) => m.provider === nextProvider && m.id === requestedModelId)
            ? requestedModelId
            : resolveDefaultModelId(nextProvider);

        setSelectedProvider(nextProvider);
        setSelectedModelId(resolvedModelId);
        setCustomModel(typeof p.customModel === 'string' ? p.customModel : '');
      } catch {
        return;
      }
    };

    const handler = () => applyPrefsFromStorage();
    window.addEventListener(AI_PREFS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(AI_PREFS_CHANGED_EVENT, handler);
  }, [AI_PREFS_CHANGED_EVENT, AI_PREFS_STORAGE_KEY, models]);

  useEffect(() => {
    if (models.length === 0) {
      if (selectedModelId !== '') setSelectedModelId('');
      return;
    }
    const available = models.filter(m => m.provider === selectedProvider);
    if (available.length === 0) {
      if (selectedModelId !== '') setSelectedModelId('');
      return;
    }
    const exists = available.some(m => m.id === selectedModelId);
    if (!exists) setSelectedModelId(available[0].id);
  }, [models, selectedProvider, selectedModelId]);

  const currentModel = useMemo(() => {
    return models.find(m => m.id === selectedModelId && m.provider === selectedProvider);
  }, [models, selectedModelId, selectedProvider]);

  const effectiveModelName = useMemo(() => {
    const isCompatible = (provider: AiProviderId, modelName: string) => {
      const name = (modelName || '').trim().toLowerCase();
      if (!name) return false;
      if (provider === 'gemini') return name.includes('gemini');
      if (provider === 'kimi') return name.includes('kimi') || name.includes('moonshot');
      return true;
    };

    const defaultModelName = selectedProvider === 'gemini' ? 'gemini-2.0-flash' : 'kimi-k2-turbo-preview';
    const selectedModelName = currentModel?.model || '';
    const customModelName = (customModel && customModel.trim()) || '';

    if (isCompatible(selectedProvider, customModelName)) return customModelName;
    if (isCompatible(selectedProvider, selectedModelName)) return selectedModelName;
    return defaultModelName;
  }, [customModel, currentModel?.model, selectedProvider]);

  const handleChangeProvider = (provider: AiProviderId) => {
    setSelectedProvider(provider);
    setCustomModel('');
    const first = models.find(m => m.provider === provider);
    if (first) {
      setSelectedModelId(first.id);
    } else {
      setSelectedModelId('');
    }
  };

  const fileNameForLogs = useMemo(() => {
    if (selectedFile) return selectedFile.name;
    if (hydratedAiSession?.meta?.file?.name) return hydratedAiSession.meta.file.name;
    return '';
  }, [hydratedAiSession?.meta?.file?.name, selectedFile]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('pdf-structured-extractor:advanced-ai-settings:v1');
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return;
      const p = parsed as { temperature?: unknown; topP?: unknown; stream?: unknown };

      if (typeof p.temperature === 'number' && Number.isFinite(p.temperature)) {
        setTemperature(Math.max(0, Math.min(1, p.temperature)));
      }
      if (typeof p.topP === 'number' && Number.isFinite(p.topP)) {
        setTopP(Math.max(0, Math.min(1, p.topP)));
      }
      if (typeof p.stream === 'boolean') {
        setStream(p.stream);
      }
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    if (!hydratedAiSession) {
      lastHydratedSessionIdRef.current = null;
      return;
    }
    const sessionId = hydratedAiSession.meta.sessionId;
    if (lastHydratedSessionIdRef.current === sessionId) return;
    lastHydratedSessionIdRef.current = sessionId;

    if (hydratedAiSession.meta.status !== 'completed') {
      skipPrefsWriteRef.current = true;
      setSelectedProvider(hydratedAiSession.meta.provider);
      setCustomModel(hydratedAiSession.meta.model);
    }

    const restoredRows = hydratedAiSession.parts.flatMap(p => p.rows);
    const restoredHeaders =
      hydratedAiSession.parts.length > 0
        ? hydratedAiSession.parts[hydratedAiSession.parts.length - 1].headers
        : hydratedAiSession.meta.confirmedHeaders;

    setAiHeaders(restoredHeaders);
    setAiRows(restoredRows);
    setAiPageRowCounts(hydratedAiSession.parts.map(p => p.rows.length));
    aiHeadersRef.current = restoredHeaders;
    aiRowsRef.current = restoredRows;

    setTotalParts(hydratedAiSession.meta.totalParts);
    setProcessedParts(hydratedAiSession.meta.processedParts);
    aiNextPartIndexRef.current = hydratedAiSession.meta.nextPartIndex ?? hydratedAiSession.meta.processedParts;

    const nextState = hydratedAiSession.meta.status === 'running' ? 'stopped' : hydratedAiSession.meta.status;
    setAiAnalysisState(nextState);

    const nextConfirmed =
      hydratedAiSession.meta.confirmedHeaders && hydratedAiSession.meta.confirmedHeaders.length > 0
        ? hydratedAiSession.meta.confirmedHeaders
        : null;
    setConfirmedHeaders(nextConfirmed);

    const logId = hydratedAiSession.meta.currentAiLogId ?? null;
    currentAiLogIdRef.current = logId;
    setCurrentAiLogId(logId);
  }, [hydratedAiSession]);

  useEffect(() => {
    if (localHeaders.length === 0 || localRows.length === 0) return;
    aiPersistence.updateMeta({ localResult: { headers: localHeaders, rows: localRows } });
  }, [aiPersistence, localHeaders, localRows]);

  const handleFileSelected = async (file: File) => {
    const shouldResumeStored = !!hydratedAiSession && aiPersistence.matchesActiveFile(file);
    if (!shouldResumeStored) {
      aiPersistence.clearActive();
    }

    aiAbortControllerRef.current?.abort();
    aiAbortControllerRef.current = null;

    if (!shouldResumeStored) {
      aiNextPartIndexRef.current = 0;
      aiRowsRef.current = [];
      aiHeadersRef.current = [];
      currentAiLogIdRef.current = null;
      setFocusAiLogId(null);
      setCurrentAiLogId(null);
    }

    setSelectedDates([]);
    setDescriptionFilter('');
    setCurrentPage(1);
    lastUnfilteredPageRef.current = 1;

    if (!shouldResumeStored) {
      setAiHeaders([]);
      setAiRows([]);
      setAiPageRowCounts([]);
      setDiff(null);
    }

    setVerifyError('');
    setVerifyMessage('');
    setVerifyDebugLog('');

    if (!shouldResumeStored) {
      setTotalParts(null);
      setProcessedParts(0);
      setAiAnalysisState('idle');
      setHeaderCandidate(null);
      setConfirmedHeaders(null);
      setHeaderDraft(null);

      aiPersistence.startNewSession({
        file,
        provider: selectedProvider,
        model: effectiveModelName,
        confirmedHeaders: [],
        localResult: null,
      });
    }
  };

  const runHeaderDetection = async () => {
    if (!selectedFile) {
      setVerifyError('Selecciona un PDF primero');
      return;
    }
    setIsAnalyzing(true);
    setIsVerifying(true);
    setVerifyError('');
    setVerifyMessage('');
    setVerifyDebugLog('');
    setHeaderCandidate(null);
    setConfirmedHeaders(null);
    setHeaderDraft(null);
    try {
      if (selectedProvider === 'gemini') {
        const geminiKey = settingsDb.getGeminiApiKey();
        if (!geminiKey) {
          setVerifyError('API Key de Gemini no configurada (Cuenta → Configuración)');
          return;
        }
        const result = await detectPdfHeadersWithGemini(selectedFile, geminiKey, effectiveModelName, temperature, topP, stream);
        if (!result.success || !result.headers) {
          setVerifyError(result.error || 'Error al detectar encabezado con Gemini');
          if (result.debugInfo) {
            setVerifyDebugLog(result.debugInfo);
          }
          return;
        }
        setHeaderCandidate(result.headers);
        setHeaderDraft(result.headers);
        setVerifyMessage('Encabezado detectado. Revísalo y confirma para continuar.');
      } else {
        const kimiKey = settingsDb.getKimiApiKey();
        if (!kimiKey) {
          setVerifyError('API Key de Kimi no configurada (Cuenta → Configuración)');
          return;
        }
        const result = await detectPdfHeadersWithKimi(selectedFile, kimiKey, effectiveModelName, temperature, topP);
        if (!result.success || !result.headers) {
          setVerifyError(result.error || 'Error al detectar encabezado con Kimi');
          if (result.debugInfo) {
            setVerifyDebugLog(result.debugInfo);
          }
          return;
        }
        setHeaderCandidate(result.headers);
        setHeaderDraft(result.headers);
        setVerifyMessage('Encabezado detectado. Revísalo y confirma para continuar.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      setVerifyError(msg);
      try {
        if (e instanceof Error && e.stack) {
          setVerifyDebugLog(e.stack);
        } else if (typeof e === 'string') {
          setVerifyDebugLog(e);
        } else {
          setVerifyDebugLog(JSON.stringify(e));
        }
      } catch {
        setVerifyDebugLog(String(e));
      }
    } finally {
      setIsAnalyzing(false);
      setIsVerifying(false);
    }
  };

  const runFullAnalysisWithHeaders = async (
    headersToUse: string[],
    resume?: { startPartIndex: number; initialProcessedParts: number; keepExisting: boolean },
  ) => {
    if (!selectedFile) {
      setVerifyError('Selecciona un PDF primero');
      return;
    }

    if (!resume?.keepExisting) {
      aiPersistence.clearActive();
      aiPersistence.startNewSession({
        file: selectedFile,
        provider: selectedProvider,
        model: effectiveModelName,
        confirmedHeaders: headersToUse,
        localResult: localHeaders.length > 0 && localRows.length > 0 ? { headers: localHeaders, rows: localRows } : null,
      });
    } else {
      const updated = aiPersistence.updateMeta({
        status: 'running',
        provider: selectedProvider,
        model: effectiveModelName,
        confirmedHeaders: headersToUse,
      });
      if (!updated) {
        aiPersistence.startNewSession({
          file: selectedFile,
          provider: selectedProvider,
          model: effectiveModelName,
          confirmedHeaders: headersToUse,
          localResult: localHeaders.length > 0 && localRows.length > 0 ? { headers: localHeaders, rows: localRows } : null,
        });
      }
    }

    aiAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    aiAbortControllerRef.current = abortController;

    setIsAnalyzing(true);
    setIsVerifying(true);
    setAiAnalysisState('running');
    setVerifyError('');
    setVerifyMessage('');
    setVerifyDebugLog('');
    if (!resume?.keepExisting) {
      setAiHeaders([]);
      setAiRows([]);
      setAiPageRowCounts([]);
      setDiff(null);
      setTotalParts(null);
      setProcessedParts(0);
      setCurrentPage(1);
      lastUnfilteredPageRef.current = 1;
      aiRowsRef.current = [];
      aiHeadersRef.current = [];
      aiNextPartIndexRef.current = 0;
    } else {
      setProcessedParts(resume.initialProcessedParts);
      aiNextPartIndexRef.current = resume.initialProcessedParts;
    }
    try {
      const runTimestamp = Date.now();
      const existingLogId = resume?.keepExisting ? currentAiLogIdRef.current : null;
      const logId = existingLogId || `${selectedProvider}-${runTimestamp}`;
      if (!existingLogId) {
        currentAiLogIdRef.current = logId;
        setCurrentAiLogId(logId);
      } else {
        setCurrentAiLogId(existingLogId);
      }

      aiPersistence.updateMeta({
        status: 'running',
        currentAiLogId: logId,
        provider: selectedProvider,
        model: effectiveModelName,
        confirmedHeaders: headersToUse,
      });

      const upsertLog = (nextLog: AiExtractionLog) => {
        settingsDb.upsertAiLog(nextLog);
        setAiLogs(prev => [nextLog, ...prev.filter(l => l.id !== nextLog.id)]);
        return nextLog;
      };

      const getTokensFromRequests = (requests: AiRequestLog[] | undefined) => {
        const list = requests && Array.isArray(requests) ? requests : [];
        let prompt = 0;
        let completion = 0;
        let total = 0;
        for (const r of list) {
          prompt += typeof r.promptTokens === 'number' ? r.promptTokens : 0;
          completion += typeof r.completionTokens === 'number' ? r.completionTokens : 0;
          total += typeof r.totalTokens === 'number' ? r.totalTokens : 0;
        }
        return { prompt, completion, total };
      };

      const existingLogs = existingLogId ? settingsDb.getAiLogs() : null;
      const existingLog = existingLogId ? existingLogs?.find(l => l.id === existingLogId) : undefined;

      let currentLog: AiExtractionLog = {
        ...(existingLog || {}),
        id: logId,
        timestamp: existingLog?.timestamp ?? runTimestamp,
        provider: selectedProvider,
        model: effectiveModelName,
        fileName: fileNameForLogs || selectedFile.name,
        fileSizeBytes: selectedFile.size,
        fileType: selectedFile.type,
        status: 'in_progress',
        startedAt: existingLog?.startedAt ?? existingLog?.timestamp ?? runTimestamp,
        endedAt: existingLogId ? undefined : existingLog?.endedAt,
        requests: existingLog?.requests && Array.isArray(existingLog.requests) ? existingLog.requests : [],
      };

      if (existingLogId) {
        currentLog = upsertLog(currentLog);
      } else {
        settingsDb.addAiLog(currentLog);
        setAiLogs(prev => [currentLog, ...prev]);
      }

      let lastPersistedProcessedParts = -1;
      let lastPersistedTotalParts: number | null = null;

      const onProgress = ({
        totalParts,
        processedParts,
        headers,
        rows,
        kind,
        segmentId,
        partIndex,
        status,
        elapsedMs,
        usage,
        error,
        rowCount,
      }: {
        totalParts: number;
        processedParts: number;
        provider: 'gemini' | 'kimi';
        headers?: string[];
        rows?: string[][];
        kind?: 'analyze_part';
        segmentId?: string;
        partIndex?: number;
        status?: 'in_progress' | 'completed' | 'failed';
        elapsedMs?: number;
        usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
        error?: string;
        rowCount?: number;
      }) => {
        if (typeof totalParts === 'number') {
          setTotalParts(totalParts);
          setProcessedParts(processedParts);
          aiNextPartIndexRef.current = processedParts;
        }
        if (headers) {
          setAiHeaders(headers);
          aiHeadersRef.current = headers;
        }
        if (rows) {
          setAiRows(prev => [...prev, ...rows]);
          setAiPageRowCounts(prev => [...prev, rows.length]);
          aiRowsRef.current = [...aiRowsRef.current, ...rows];
        }

        if (kind !== 'analyze_part' || !segmentId || !status) return;

        if (typeof totalParts === 'number') {
          if (processedParts !== lastPersistedProcessedParts || totalParts !== lastPersistedTotalParts) {
            lastPersistedProcessedParts = processedParts;
            lastPersistedTotalParts = totalParts;
            aiPersistence.updateMeta({
              status: 'running',
              totalParts,
              processedParts,
              nextPartIndex: processedParts,
              currentAiLogId: logId,
            });
          }
        }

        if (status === 'completed' && typeof partIndex === 'number' && rows) {
          const saveResult = aiPersistence.addPart({
            partIndex,
            headers: headers || aiHeadersRef.current || headersToUse,
            rows,
          });
          if (!saveResult.ok) {
            aiAbortControllerRef.current?.abort();
            currentLog = upsertLog({ ...currentLog, status: 'stopped', endedAt: Date.now() });
            aiPersistence.updateMeta({
              status: 'stopped',
              processedParts: aiNextPartIndexRef.current,
              nextPartIndex: aiNextPartIndexRef.current,
              totalParts: typeof totalParts === 'number' ? totalParts : null,
            });
            const reason = 'reason' in saveResult ? saveResult.reason : null;
            setVerifyError(
              reason === 'quota_exceeded'
                ? 'No hay suficiente espacio en el almacenamiento del navegador para guardar el progreso.'
                : 'No se pudo guardar el progreso del análisis.',
            );
            setAiAnalysisState('stopped');
            return;
          }
        }

        const eventAt = Date.now();
        const requestId = `${logId}:${segmentId}`;
        const prevRequests = currentLog.requests && Array.isArray(currentLog.requests) ? currentLog.requests : [];
        const existing = prevRequests.find(r => r.id === requestId);
        const startedAt =
          typeof existing?.startedAt === 'number'
            ? existing.startedAt
            : status === 'in_progress'
              ? eventAt
              : typeof elapsedMs === 'number'
                ? eventAt - elapsedMs
                : eventAt;
        const endedAt = status === 'completed' || status === 'failed' ? eventAt : existing?.endedAt;

        const nextReq: AiRequestLog = {
          id: requestId,
          kind,
          segmentId,
          partIndex,
          totalParts,
          status,
          startedAt,
          endedAt,
          elapsedMs: typeof elapsedMs === 'number' ? elapsedMs : existing?.elapsedMs,
          promptTokens: typeof usage?.promptTokens === 'number' ? usage.promptTokens : existing?.promptTokens,
          completionTokens:
            typeof usage?.completionTokens === 'number' ? usage.completionTokens : existing?.completionTokens,
          totalTokens: typeof usage?.totalTokens === 'number' ? usage.totalTokens : existing?.totalTokens,
          rowCount: typeof rowCount === 'number' ? rowCount : existing?.rowCount,
          error: error || existing?.error,
        };
        const nextRequests = [nextReq, ...prevRequests.filter(r => r.id !== requestId)];
        const tokens = getTokensFromRequests(nextRequests);

        currentLog = upsertLog({
          ...currentLog,
          status: 'in_progress',
          totalParts,
          processedParts,
          promptTokens: tokens.prompt || undefined,
          completionTokens: tokens.completion || undefined,
          totalTokens: tokens.total || undefined,
          requests: nextRequests,
        });
      };

      if (selectedProvider === 'gemini') {
        const geminiKey = settingsDb.getGeminiApiKey();
        if (!geminiKey) {
          currentLog = upsertLog({ ...currentLog, status: 'failed', endedAt: Date.now() });
          aiPersistence.updateMeta({
            status: 'failed',
            processedParts: aiNextPartIndexRef.current,
            nextPartIndex: aiNextPartIndexRef.current,
            totalParts: typeof totalParts === 'number' ? totalParts : null,
          });
          setAiAnalysisState('failed');
          setVerifyError('API Key de Gemini no configurada (Cuenta → Configuración)');
          return;
        }
        const result = await analyzePDFWithGemini(selectedFile, geminiKey, effectiveModelName, {
          knownHeaders: headersToUse,
          onProgress,
          signal: abortController.signal,
          startPartIndex: resume?.startPartIndex,
          initialProcessedParts: resume?.initialProcessedParts,
          temperature,
          topP,
          stream,
        });
        if (!result.success || !result.headers || !result.rows) {
          if (result.error === 'ABORTED') {
            if (currentAiLogIdRef.current !== logId) return;
            currentLog = upsertLog({ ...currentLog, status: 'stopped', endedAt: Date.now() });
            aiPersistence.updateMeta({
              status: 'stopped',
              processedParts: aiNextPartIndexRef.current,
              nextPartIndex: aiNextPartIndexRef.current,
              totalParts: typeof totalParts === 'number' ? totalParts : null,
            });
            setVerifyMessage('Análisis detenido.');
            setAiAnalysisState('stopped');
            return;
          }
          currentLog = upsertLog({
            ...currentLog,
            status: 'failed',
            endedAt: Date.now(),
            model: result.model || effectiveModelName,
          });
          aiPersistence.updateMeta({
            status: 'failed',
            processedParts: aiNextPartIndexRef.current,
            nextPartIndex: aiNextPartIndexRef.current,
            totalParts: typeof totalParts === 'number' ? totalParts : null,
          });
          setAiAnalysisState('failed');
          setVerifyError(result.error || 'Error al analizar con Gemini');
          if (result.debugInfo) {
            setVerifyDebugLog(result.debugInfo);
          }
          return;
        }
        currentLog = upsertLog({
          ...currentLog,
          status: 'completed',
          endedAt: Date.now(),
          model: result.model || effectiveModelName,
        });
        setAiHeaders(result.headers);
        aiHeadersRef.current = result.headers;
        setDiff(computeSimpleDiff(localHeaders, localRows, result.headers, aiRowsRef.current));
        setVerifyMessage(`Análisis completado con ${result.model || 'Gemini'}`);
        setAiAnalysisState('completed');
        aiPersistence.updateMeta({
          status: 'completed',
          processedParts: aiNextPartIndexRef.current,
          nextPartIndex: aiNextPartIndexRef.current,
          totalParts: typeof totalParts === 'number' ? totalParts : null,
        });
      } else if (selectedProvider === 'kimi') {
        const kimiKey = settingsDb.getKimiApiKey();
        if (!kimiKey) {
          currentLog = upsertLog({ ...currentLog, status: 'failed', endedAt: Date.now() });
          aiPersistence.updateMeta({
            status: 'failed',
            processedParts: aiNextPartIndexRef.current,
            nextPartIndex: aiNextPartIndexRef.current,
            totalParts: typeof totalParts === 'number' ? totalParts : null,
          });
          setAiAnalysisState('failed');
          setVerifyError('API Key de Kimi no configurada (Cuenta → Configuración)');
          return;
        }
        const result = await analyzePDFWithKimi(selectedFile, kimiKey, effectiveModelName, temperature, topP, {
          knownHeaders: headersToUse,
          onProgress,
          signal: abortController.signal,
          startPartIndex: resume?.startPartIndex,
          initialProcessedParts: resume?.initialProcessedParts,
        });
        if (!result.success || !result.headers || !result.rows) {
          if (result.error === 'ABORTED') {
            if (currentAiLogIdRef.current !== logId) return;
            currentLog = upsertLog({ ...currentLog, status: 'stopped', endedAt: Date.now() });
            aiPersistence.updateMeta({
              status: 'stopped',
              processedParts: aiNextPartIndexRef.current,
              nextPartIndex: aiNextPartIndexRef.current,
              totalParts: typeof totalParts === 'number' ? totalParts : null,
            });
            setVerifyMessage('Análisis detenido.');
            setAiAnalysisState('stopped');
            return;
          }
          currentLog = upsertLog({
            ...currentLog,
            status: 'failed',
            endedAt: Date.now(),
            model: result.model || effectiveModelName,
          });
          aiPersistence.updateMeta({
            status: 'failed',
            processedParts: aiNextPartIndexRef.current,
            nextPartIndex: aiNextPartIndexRef.current,
            totalParts: typeof totalParts === 'number' ? totalParts : null,
          });
          setAiAnalysisState('failed');
          setVerifyError(result.error || 'Error al analizar con Kimi');
          if (result.debugInfo) {
            setVerifyDebugLog(result.debugInfo);
          }
          return;
        }
        currentLog = upsertLog({
          ...currentLog,
          status: 'completed',
          endedAt: Date.now(),
          model: result.model || effectiveModelName,
        });
        setAiHeaders(result.headers);
        aiHeadersRef.current = result.headers;
        setDiff(computeSimpleDiff(localHeaders, localRows, result.headers, aiRowsRef.current));
        setVerifyMessage(`Análisis completado con ${result.model || 'Kimi'}`);
        setAiAnalysisState('completed');
        aiPersistence.updateMeta({
          status: 'completed',
          processedParts: aiNextPartIndexRef.current,
          nextPartIndex: aiNextPartIndexRef.current,
          totalParts: typeof totalParts === 'number' ? totalParts : null,
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      setVerifyError(msg);
      setAiAnalysisState('failed');
      aiPersistence.updateMeta({
        status: 'failed',
        processedParts: aiNextPartIndexRef.current,
        nextPartIndex: aiNextPartIndexRef.current,
        totalParts: typeof totalParts === 'number' ? totalParts : null,
      });
      try {
        if (e instanceof Error && e.stack) {
          setVerifyDebugLog(e.stack);
        } else if (typeof e === 'string') {
          setVerifyDebugLog(e);
        } else {
          setVerifyDebugLog(JSON.stringify(e));
        }
      } catch {
        setVerifyDebugLog(String(e));
      }
    } finally {
      setIsAnalyzing(false);
      setIsVerifying(false);
    }
  };

  const handleAnalyzeWithAI = async () => {
    if (!selectedFile) {
      setVerifyError('Selecciona un PDF primero');
      return;
    }
    if (!confirmedHeaders) {
      await runHeaderDetection();
      return;
    }
    if (aiAnalysisState === 'stopped' || aiAnalysisState === 'failed') {
      await handleResumeAiAnalysis();
      return;
    }
    await runFullAnalysisWithHeaders(confirmedHeaders);
  };

  const detectHeadersOnly = async () => {
    setAiAnalysisState('idle');
    setAiHeaders([]);
    setAiRows([]);
    setAiPageRowCounts([]);
    setDiff(null);
    setTotalParts(null);
    setProcessedParts(0);
    await runHeaderDetection();
  };

  const addHeaderField = () => {
    setHeaderDraft(prev => {
      if (!prev || prev.length === 0) return [''];
      return [...prev, ''];
    });
  };

  const deleteHeaderField = (index: number) => {
    setHeaderDraft(prev => {
      if (!prev) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateHeaderField = (index: number, value: string) => {
    setHeaderDraft(prev => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const confirmHeaderDraftAndAnalyze = async () => {
    const source = headerDraft || headerCandidate;
    if (!source) return;
    const cleaned = source.map(h => (h || '').trim()).filter(h => h !== '');
    if (cleaned.length === 0) {
      setVerifyError('Define al menos un nombre de columna antes de continuar.');
      return;
    }
    setConfirmedHeaders(cleaned);
    await runFullAnalysisWithHeaders(cleaned);
  };

  const handleStopAiAnalysis = () => {
    if (!isAnalyzing) return;
    aiAbortControllerRef.current?.abort();
    aiPersistence.updateMeta({
      status: 'stopped',
      processedParts: aiNextPartIndexRef.current,
      nextPartIndex: aiNextPartIndexRef.current,
      totalParts: typeof totalParts === 'number' ? totalParts : null,
    });
    const logId = currentAiLogIdRef.current;
    if (logId) {
      const logs = settingsDb.getAiLogs();
      const existing = logs.find(l => l.id === logId);
      if (existing) {
        const stopped: AiExtractionLog = { ...existing, status: 'stopped', endedAt: Date.now() };
        settingsDb.upsertAiLog(stopped);
        setAiLogs(prev => [stopped, ...prev.filter(l => l.id !== stopped.id)]);
      }
    }
    setAiAnalysisState('stopped');
  };

  const handleResumeAiAnalysis = async () => {
    if (!selectedFile) return;
    if (aiAnalysisState !== 'stopped' && aiAnalysisState !== 'failed') return;
    if (!currentAiLogIdRef.current) return;
    const headersToUse =
      confirmedHeaders && confirmedHeaders.length > 0
        ? confirmedHeaders
        : hydratedAiSession?.meta.confirmedHeaders && hydratedAiSession.meta.confirmedHeaders.length > 0
          ? hydratedAiSession.meta.confirmedHeaders
          : null;
    if (!headersToUse) return;
    if (!confirmedHeaders) setConfirmedHeaders(headersToUse);
    const startPartIndex = aiNextPartIndexRef.current;
    if (typeof totalParts === 'number' && startPartIndex >= totalParts) return;
    await runFullAnalysisWithHeaders(headersToUse, {
      startPartIndex,
      initialProcessedParts: startPartIndex,
      keepExisting: true,
    });
  };

  const handleRestartAiAnalysis = async () => {
    if (!selectedFile || !confirmedHeaders) return;
    aiAbortControllerRef.current?.abort();
    const prevLogId = currentAiLogIdRef.current;
    if (prevLogId) {
      const prevLogs = settingsDb.getAiLogs();
      const existing = prevLogs.find(l => l.id === prevLogId);
      if (existing) {
        const canceled: AiExtractionLog = { ...existing, status: 'canceled', endedAt: Date.now() };
        settingsDb.upsertAiLog(canceled);
        setAiLogs(prev => [canceled, ...prev.filter(l => l.id !== canceled.id)]);
      }
    }
    currentAiLogIdRef.current = null;
    setFocusAiLogId(null);
    setCurrentAiLogId(null);
    aiNextPartIndexRef.current = 0;
    aiRowsRef.current = [];
    aiHeadersRef.current = [];
    setAiHeaders([]);
    setAiRows([]);
    setAiPageRowCounts([]);
    setTotalParts(null);
    setProcessedParts(0);
    setDiff(null);
    setAiAnalysisState('idle');
    await runFullAnalysisWithHeaders(confirmedHeaders);
  };

  const handleCancelAiAnalysis = () => {
    if (aiAnalysisState === 'completed') return;
    aiAbortControllerRef.current?.abort();
    aiPersistence.clearActive();
    const logId = currentAiLogIdRef.current;
    if (logId) {
      settingsDb.removeAiLog(logId);
      setAiLogs(prev => prev.filter(l => l.id !== logId));
    }
    currentAiLogIdRef.current = null;
    setFocusAiLogId(null);
    setCurrentAiLogId(null);
    aiNextPartIndexRef.current = 0;
    aiRowsRef.current = [];
    aiHeadersRef.current = [];
    setAiHeaders([]);
    setAiRows([]);
    setAiPageRowCounts([]);
    setTotalParts(null);
    setProcessedParts(0);
    setDiff(null);
    setVerifyError('');
    setVerifyMessage('');
    setVerifyDebugLog('');
    setAiAnalysisState('idle');
  };

  const handleDiscardSavedAiAnalysis = () => {
    aiPersistence.clearActive();
    currentAiLogIdRef.current = null;
    setFocusAiLogId(null);
    setCurrentAiLogId(null);
    aiNextPartIndexRef.current = 0;
    aiRowsRef.current = [];
    aiHeadersRef.current = [];
    setAiHeaders([]);
    setAiRows([]);
    setAiPageRowCounts([]);
    setTotalParts(null);
    setProcessedParts(0);
    setDiff(null);
    setVerifyError('');
    setVerifyMessage('');
    setVerifyDebugLog('');
    setAiAnalysisState('idle');
    setHeaderCandidate(null);
    setConfirmedHeaders(null);
    setHeaderDraft(null);
  };

  const handleViewCurrentAiLogDetail = () => {
    const logId = currentAiLogId;
    if (!logId) return;
    setFocusAiLogId(logId);
    setShowHistoryIa(true);
  };

  const invalidRows = useMemo(
    () => (aiHeaders.length > 0 && aiRows.length > 0 ? computeInvalidAmountRows(aiHeaders, aiRows) : []),
    [aiHeaders, aiRows],
  );

  const headerNormalized = useMemo(() => aiHeaders.map(h => normalizeHeaderText(h || '')), [aiHeaders]);

  const dateColIndex = useMemo(() => {
    const idx = headerNormalized.findIndex(h => h.includes('fecha') || h.includes('date'));
    return idx >= 0 ? idx : null;
  }, [headerNormalized]);

  const descriptionColIndex = useMemo(() => {
    const idx = headerNormalized.findIndex(
      h => h.includes('descripcion') || h.includes('descripción') || h.includes('concepto') || h.includes('desc'),
    );
    return idx >= 0 ? idx : null;
  }, [headerNormalized]);

  const normalizedQuery = useMemo(() => normalizeSearchText(descriptionFilter), [descriptionFilter]);
  const queryTokens = useMemo(() => tokenizeSearchQuery(descriptionFilter), [descriptionFilter]);

  const rowSearchText = useMemo(() => {
    if (aiRows.length === 0) return [];
    const texts: string[] = new Array(aiRows.length);
    for (let i = 0; i < aiRows.length; i++) {
      const r = aiRows[i] || [];
      const raw = descriptionColIndex !== null ? (r?.[descriptionColIndex] ?? '') : r.join(' ');
      texts[i] = normalizeSearchText(raw);
    }
    return texts;
  }, [aiRows, descriptionColIndex]);

  const dateOptions = useMemo(() => {
    if (dateColIndex === null) return [];
    const totals = new Map<string, number>();
    const matches = new Map<string, number>();
    const hasQuery = queryTokens.length > 0;
    for (let i = 0; i < aiRows.length; i++) {
      const r = aiRows[i];
      if (!r) continue;
      const raw = (r?.[dateColIndex] ?? '').trim();
      if (!raw) continue;
      totals.set(raw, (totals.get(raw) || 0) + 1);
      if (!hasQuery) continue;
      const hay = rowSearchText[i] ?? '';
      if (matchesSearchTokens(hay, queryTokens)) {
        matches.set(raw, (matches.get(raw) || 0) + 1);
      }
    }

    const parseDateForSort = (value: string) => {
      const v = value.trim();
      const iso = /^(\d{4})-(\d{2})-(\d{2})/;
      const latam = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/;
      const m1 = v.match(iso);
      if (m1) return new Date(Number(m1[1]), Number(m1[2]) - 1, Number(m1[3])).getTime();
      const m2 = v.match(latam);
      if (m2) {
        const day = Number(m2[1]);
        const month = Number(m2[2]);
        let year = Number(m2[3]);
        if (year < 100) year += 2000;
        return new Date(year, month - 1, day).getTime();
      }
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
    };

    return Array.from(totals.entries())
      .map(([value, total]) => ({ value, total, matches: matches.get(value) || 0, sortKey: parseDateForSort(value) }))
      .sort((a, b) => (a.sortKey !== b.sortKey ? a.sortKey - b.sortKey : a.value.localeCompare(b.value, 'es')))
      .map(({ value, total, matches }) => ({ value, total, matches }));
  }, [aiRows, dateColIndex, queryTokens, rowSearchText]);

  const selectedDatesSet = useMemo(() => new Set(selectedDates), [selectedDates]);

  const missingSelectedDatesCount = useMemo(() => {
    if (selectedDates.length === 0) return 0;
    const available = new Set(dateOptions.map(o => o.value));
    return selectedDates.filter(d => !available.has(d)).length;
  }, [selectedDates, dateOptions]);

  const filteredRowIndices = useMemo(() => {
    const indices: number[] = [];
    const hasDateFilter = selectedDates.length > 0 && dateColIndex !== null;
    const hasQuery = queryTokens.length > 0;

    for (let i = 0; i < aiRows.length; i++) {
      const r = aiRows[i];
      if (!r) continue;

      if (hasDateFilter) {
        const raw = (r[dateColIndex!] ?? '').trim();
        if (!selectedDatesSet.has(raw)) continue;
      }

      if (hasQuery) {
        const hay = rowSearchText[i] ?? '';
        if (!matchesSearchTokens(hay, queryTokens)) continue;
      }

      indices.push(i);
    }

    return indices;
  }, [aiRows, dateColIndex, queryTokens, rowSearchText, selectedDates, selectedDatesSet]);

  const hasActiveFilters = selectedDates.length > 0 || descriptionFilter.trim().length > 0;

  const totalPages = useMemo(() => Math.max(1, aiPageRowCounts.length || 1), [aiPageRowCounts.length]);

  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);

  const pageStartIndex = useMemo(() => {
    if (aiPageRowCounts.length === 0) return 0;
    let start = 0;
    for (let i = 0; i < safeCurrentPage - 1; i++) start += aiPageRowCounts[i] || 0;
    return start;
  }, [aiPageRowCounts, safeCurrentPage]);

  const pageRowCount = useMemo(() => {
    if (aiPageRowCounts.length === 0) return aiRows.length;
    const count = aiPageRowCounts[safeCurrentPage - 1];
    if (typeof count === 'number') return count;
    return Math.max(0, aiRows.length - pageStartIndex);
  }, [aiPageRowCounts, aiRows.length, pageStartIndex, safeCurrentPage]);

  const visibleRowIndices = useMemo(() => {
    if (hasActiveFilters) return filteredRowIndices;
    const start = pageStartIndex;
    const end = Math.min(pageStartIndex + pageRowCount, aiRows.length);
    const indices: number[] = [];
    for (let i = start; i < end; i++) indices.push(i);
    return indices;
  }, [aiRows.length, filteredRowIndices, hasActiveFilters, pageRowCount, pageStartIndex]);

  useEffect(() => {
    if (hasActiveFilters) {
      lastUnfilteredPageRef.current = safeCurrentPage;
    }
  }, [hasActiveFilters, safeCurrentPage]);

  useEffect(() => {
    if (!hasActiveFilters && currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, hasActiveFilters, safeCurrentPage]);

  const toggleDateSelection = (value: string) => {
    startFilterTransition(() => {
      setSelectedDates(prev => (prev.includes(value) ? prev.filter(d => d !== value) : [...prev, value]));
    });
  };

  const handleDescriptionFilterChange = (value: string) => {
    const next = value.length > 200 ? value.slice(0, 200) : value;
    setDescriptionFilter(next);
  };

  const clearFilters = () => {
    startFilterTransition(() => {
      setSelectedDates([]);
      setDescriptionFilter('');
      setCurrentPage(lastUnfilteredPageRef.current || 1);
    });
  };

  const startEditCell = (rowIndex: number, colIndex: number) => {
    const current = aiRows[rowIndex]?.[colIndex] ?? '';
    setEditingCell({ rowIndex, colIndex, value: current });
  };

  const cancelEditCell = () => {
    setEditingCell(null);
  };

  const saveEditCell = () => {
    if (!editingCell) return;
    const { rowIndex, colIndex, value } = editingCell;
    setAiRows(prev => {
      const next = prev.map(r => [...r]);
      if (!next[rowIndex]) return next;
      next[rowIndex][colIndex] = value;
      return next;
    });
    setEditingCell(null);
  };

  const handleChangeEditingValue = (value: string) => {
    setEditingCell(prev => (prev ? { ...prev, value } : prev));
  };

  const addRowAfter = (rowIndex: number) => {
    if (aiHeaders.length === 0) return;
    const emptyRow = Array(aiHeaders.length).fill('');
    setAiRows(prev => {
      const next = [...prev];
      next.splice(rowIndex + 1, 0, emptyRow);
      return next;
    });
  };

  const deleteRow = (rowIndex: number) => {
    setAiRows(prev => prev.filter((_, index) => index !== rowIndex));
  };

  const handleDownloadAiCSV = () => {
    if (!aiHeaders.length || !aiRows.length) return;
    const lines: string[] = [];
    lines.push(aiHeaders.map(h => `"${(h || '').replace(/"/g, '""')}"`).join(','));
    for (const r of aiRows) {
      lines.push(r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(','));
    }
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (fileNameForLogs ? fileNameForLogs.replace(/\.pdf$/i, '') : 'tabla_ia') + '_ia.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const requestDeleteColumn = (index: number) => {
    setDeleteColumnIndex(index);
    setShowDeleteColumnModal(true);
  };

  const cancelDeleteColumn = () => {
    setShowDeleteColumnModal(false);
    setDeleteColumnIndex(null);
  };

  const confirmDeleteColumn = () => {
    if (deleteColumnIndex === null) {
      setShowDeleteColumnModal(false);
      return;
    }
    setAiHeaders(prev => prev.filter((_, idx) => idx !== deleteColumnIndex));
    setAiRows(prev => prev.map(row => row.filter((_, idx) => idx !== deleteColumnIndex)));
    setDeleteColumnIndex(null);
    setShowDeleteColumnModal(false);
  };

  return {
    isVerifying,
    verifyError,
    verifyMessage,
    verifyDebugLog,
    setVerifyError,
    setVerifyMessage,
    setVerifyDebugLog,
    diff,
    isAnalyzing,
    aiAnalysisState,
    selectedProvider,
    models,
    selectedModelId,
    setSelectedModelId,
    customModel,
    setCustomModel,
    temperature,
    setTemperature,
    topP,
    setTopP,
    stream,
    setStream,
    hydratedAiSession,
    matchesActiveFile: aiPersistence.matchesActiveFile,
    showHistoryIa,
    setShowHistoryIa,
    focusAiLogId,
    setFocusAiLogId,
    currentAiLogId,
    aiLogs,
    showCompareModal,
    setShowCompareModal,
    totalParts,
    processedParts,
    aiHeaders,
    aiRows,
    headerCandidate,
    confirmedHeaders,
    headerDraft,
    setHeaderDraft,
    deleteColumnIndex,
    showDeleteColumnModal,
    selectedDates,
    selectedDatesSet,
    descriptionFilter,
    isFilterPending,
    dateOptions,
    dateColIndex,
    descriptionColIndex,
    invalidRows,
    visibleRowIndices,
    hasActiveFilters,
    missingSelectedDatesCount,
    normalizedQuery,
    handleChangeProvider,
    effectiveModelName,
    handleFileSelected,
    handleAnalyzeWithAI,
    detectHeadersOnly,
    addHeaderField,
    deleteHeaderField,
    updateHeaderField,
    confirmHeaderDraftAndAnalyze,
    handleStopAiAnalysis,
    handleResumeAiAnalysis,
    handleRestartAiAnalysis,
    handleCancelAiAnalysis,
    handleDiscardSavedAiAnalysis,
    handleViewCurrentAiLogDetail,
    toggleDateSelection,
    handleDescriptionFilterChange,
    clearFilters,
    safeCurrentPage,
    totalPages,
    setCurrentPage,
    editingCell,
    startEditCell,
    cancelEditCell,
    saveEditCell,
    handleChangeEditingValue,
    addRowAfter,
    deleteRow,
    handleDownloadAiCSV,
    requestDeleteColumn,
    cancelDeleteColumn,
    confirmDeleteColumn,
  };
};

export type AiPdfVerificationModel = ReturnType<typeof useAiPdfVerification>;
