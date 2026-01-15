import React, { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Pencil, AlertTriangle, Square, Play, RotateCcw } from 'lucide-react';
import {
  settingsDb,
  type AiModelConfig,
  type AiProviderId,
  type AiExtractionLog,
  type AiRequestLog,
} from '@/lib/localDb';
import {
  analyzePDFWithGemini,
  analyzePDFWithKimi,
  detectPdfHeadersWithGemini,
  detectPdfHeadersWithKimi,
} from '@/lib/pdfToExcelAI';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { AiLogsDialog } from '@/components/pdf-structured-extractor/AiLogsDialog';
import { ComparePdfAiDialog } from '@/components/pdf-structured-extractor/ComparePdfAiDialog';
import { PdfLocalControls } from '@/components/pdf-structured-extractor/PdfLocalControls';
import { useLocalPdfAnalysis } from '@/hooks/useLocalPdfAnalysis';
import { computeInvalidAmountRows, computeSimpleDiff, normalizeHeaderText } from '@/lib/pdfStructuredExtractorUtils';

const PdfStructuredExtractor: React.FC = () => {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [processed, setProcessed] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyError, setVerifyError] = useState<string>('');
  const [verifyMessage, setVerifyMessage] = useState<string>('');
  const [verifyDebugLog, setVerifyDebugLog] = useState<string>('');
  const [aiHeaders, setAiHeaders] = useState<string[]>([]);
  const [aiRows, setAiRows] = useState<string[][]>([]);
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
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [totalParts, setTotalParts] = useState<number | null>(null);
  const [processedParts, setProcessedParts] = useState<number>(0);
  const [aiPageRowCounts, setAiPageRowCounts] = useState<number[]>([]);
  const [headerCandidate, setHeaderCandidate] = useState<string[] | null>(null);
  const [confirmedHeaders, setConfirmedHeaders] = useState<string[] | null>(null);
  const [headerDraft, setHeaderDraft] = useState<string[] | null>(null);
  const [deleteColumnIndex, setDeleteColumnIndex] = useState<number | null>(null);
  const [showDeleteColumnModal, setShowDeleteColumnModal] = useState<boolean>(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [descriptionFilter, setDescriptionFilter] = useState<string>('');
  const deferredDescriptionFilter = useDeferredValue(descriptionFilter);
  const [isFilterPending, startFilterTransition] = useTransition();
  const [currentPage, setCurrentPage] = useState<number>(1);
  const lastUnfilteredPageRef = useRef<number>(1);

  const pdfScrollRef = useRef<HTMLDivElement | null>(null);
  const aiScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef<boolean>(false);
  const aiAbortControllerRef = useRef<AbortController | null>(null);
  const aiRowsRef = useRef<string[][]>([]);
  const aiHeadersRef = useRef<string[]>([]);
  const aiNextPartIndexRef = useRef<number>(0);
  const currentAiLogIdRef = useRef<string | null>(null);

  useEffect(() => {
    const initialModels = settingsDb.getAiModels();
    setModels(initialModels);
    const firstGemini = initialModels.find(m => m.provider === 'gemini');
    const firstKimi = initialModels.find(m => m.provider === 'kimi');
    if (firstGemini) {
      setSelectedModelId(firstGemini.id);
    } else if (firstKimi) {
      setSelectedProvider('kimi');
      setSelectedModelId(firstKimi.id);
    }
    const initialLogs = settingsDb.getAiLogs();
    setAiLogs(initialLogs);
  }, []);

  const {
    analysisRuns,
    localAnalysisState,
    localProgress,
    pauseLocalAnalysis,
    stopLocalAnalysis,
    resumeOrContinueLocalAnalysis,
    startLocalAnalysis,
    currentRunId,
  } = useLocalPdfAnalysis({
    setIsProcessing,
    onResult: (nextHeaders, nextRows) => {
      setHeaders(nextHeaders);
      setRows(nextRows);
      setProcessed(nextHeaders.length > 0 && nextRows.length > 0);
    },
    onError: (message) => {
      setVerifyError(message);
      setProcessed(false);
    },
  });

  useEffect(() => {
    if (models.length === 0) {
      if (selectedModelId !== '') {
        setSelectedModelId('');
      }
      return;
    }
    const available = models.filter(m => m.provider === selectedProvider);
    if (available.length === 0) {
      if (selectedModelId !== '') {
        setSelectedModelId('');
      }
      return;
    }
    const exists = available.some(m => m.id === selectedModelId);
    if (!exists) {
      setSelectedModelId(available[0].id);
    }
  }, [models, selectedProvider, selectedModelId]);

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const handleFile = async (file: File) => {
    aiAbortControllerRef.current?.abort();
    aiAbortControllerRef.current = null;
    aiNextPartIndexRef.current = 0;
    aiRowsRef.current = [];
    aiHeadersRef.current = [];
    currentAiLogIdRef.current = null;
    setFocusAiLogId(null);
    setCurrentAiLogId(null);

    setProcessed(false);
    setHeaders([]);
    setRows([]);
    setFileName(file.name);
    setSelectedFile(file);
    setSelectedDates([]);
    setDescriptionFilter('');
    setCurrentPage(1);
    lastUnfilteredPageRef.current = 1;
    setAiHeaders([]);
    setAiRows([]);
    setAiPageRowCounts([]);
    setDiff(null);
    setVerifyError('');
    setVerifyMessage('');
    setTotalParts(null);
    setProcessedParts(0);
    setAiAnalysisState('idle');
    setHeaderCandidate(null);
    setConfirmedHeaders(null);
    setHeaderDraft(null);
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
    await startLocalAnalysis(file);
  };

  const handleDownloadCSV = () => {
    const lines = [];
    lines.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));
    for (const r of rows) {
      lines.push(r.map(c => `"${c.replace(/"/g, '""')}"`).join(','));
    }
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (fileName ? fileName.replace(/\.pdf$/i, '') : 'tabla') + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    a.download = (fileName ? fileName.replace(/\.pdf$/i, '') : 'tabla_ia') + '_ia.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentModel = models.find(m => m.id === selectedModelId && m.provider === selectedProvider);
  const effectiveModelName =
    (customModel && customModel.trim()) || currentModel?.model || (selectedProvider === 'gemini' ? 'gemini-2.0-flash' : 'moonshot-v1-8k');

  const handleChangeProvider = (provider: AiProviderId) => {
    setSelectedProvider(provider);
    const first = models.find(m => m.provider === provider);
    if (first) {
      setSelectedModelId(first.id);
    } else {
      setSelectedModelId('');
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
        const result = await detectPdfHeadersWithGemini(selectedFile, geminiKey, effectiveModelName);
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
        fileName: fileName || selectedFile.name,
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
          setVerifyError('API Key de Gemini no configurada (Cuenta → Configuración)');
          return;
        }
        const result = await analyzePDFWithGemini(selectedFile, geminiKey, effectiveModelName, {
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
        setDiff(computeSimpleDiff(headers, rows, result.headers, aiRowsRef.current));
        setVerifyMessage(`Análisis completado con ${result.model || 'Gemini'}`);
        setAiAnalysisState('completed');
      } else if (selectedProvider === 'kimi') {
        const kimiKey = settingsDb.getKimiApiKey();
        if (!kimiKey) {
          currentLog = upsertLog({ ...currentLog, status: 'failed', endedAt: Date.now() });
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
        setDiff(computeSimpleDiff(headers, rows, result.headers, aiRowsRef.current));
        setVerifyMessage(`Análisis completado con ${result.model || 'Kimi'}`);
        setAiAnalysisState('completed');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      setVerifyError(msg);
      setAiAnalysisState('failed');
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

  const handleStopAiAnalysis = () => {
    if (!isAnalyzing) return;
    aiAbortControllerRef.current?.abort();
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
    if (!selectedFile || !confirmedHeaders) return;
    if (aiAnalysisState !== 'stopped') return;
    if (!currentAiLogIdRef.current) return;
    const startPartIndex = aiNextPartIndexRef.current;
    if (typeof totalParts === 'number' && startPartIndex >= totalParts) return;
    await runFullAnalysisWithHeaders(confirmedHeaders, {
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
    aiAbortControllerRef.current?.abort();
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

  const handleViewCurrentAiLogDetail = () => {
    const logId = currentAiLogId;
    if (!logId) return;
    setFocusAiLogId(logId);
    setShowHistoryIa(true);
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
    if (aiAnalysisState === 'stopped') {
      await handleResumeAiAnalysis();
      return;
    }
    await runFullAnalysisWithHeaders(confirmedHeaders);
  };

  const syncScroll = () => {
    const source = pdfScrollRef.current;
    const target = aiScrollRef.current;
    if (!source || !target) return;
    const sourceMax = source.scrollHeight - source.clientHeight || 1;
    const targetMax = target.scrollHeight - target.clientHeight;
    const ratio = sourceMax > 0 ? source.scrollTop / sourceMax : 0;
    target.scrollTop = ratio * targetMax;
  };

  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    colIndex: number;
    value: string;
  } | null>(null);

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
      h =>
        h.includes('descripcion') ||
        h.includes('descripción') ||
        h.includes('concepto') ||
        h.includes('desc'),
    );
    return idx >= 0 ? idx : null;
  }, [headerNormalized]);

  const normalizedQuery = useMemo(() => deferredDescriptionFilter.trim().toLowerCase(), [deferredDescriptionFilter]);

  const dateOptions = useMemo(() => {
    if (dateColIndex === null) return [];
    const totals = new Map<string, number>();
    const matches = new Map<string, number>();
    const hasQuery = normalizedQuery.length > 0;
    for (const r of aiRows) {
      const raw = (r?.[dateColIndex] ?? '').trim();
      if (!raw) continue;
      totals.set(raw, (totals.get(raw) || 0) + 1);
      if (!hasQuery) continue;
      const hay = (descriptionColIndex !== null ? (r?.[descriptionColIndex] ?? '') : (r || []).join(' ')).toLowerCase();
      if (hay.includes(normalizedQuery)) {
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
  }, [aiRows, dateColIndex, descriptionColIndex, normalizedQuery]);

  const selectedDatesSet = useMemo(() => new Set(selectedDates), [selectedDates]);

  const missingSelectedDatesCount = useMemo(() => {
    if (selectedDates.length === 0) return 0;
    const available = new Set(dateOptions.map(o => o.value));
    return selectedDates.filter(d => !available.has(d)).length;
  }, [selectedDates, dateOptions]);

  const filteredRowIndices = useMemo(() => {
    const indices: number[] = [];
    const hasDateFilter = selectedDates.length > 0 && dateColIndex !== null;
    const hasQuery = normalizedQuery.length > 0;

    for (let i = 0; i < aiRows.length; i++) {
      const r = aiRows[i];
      if (!r) continue;

      if (hasDateFilter) {
        const raw = (r[dateColIndex!] ?? '').trim();
        if (!selectedDatesSet.has(raw)) continue;
      }

      if (hasQuery) {
        const hay = (descriptionColIndex !== null ? (r[descriptionColIndex] ?? '') : r.join(' ')).toLowerCase();
        if (!hay.includes(normalizedQuery)) continue;
      }

      indices.push(i);
    }

    return indices;
  }, [aiRows, dateColIndex, descriptionColIndex, normalizedQuery, selectedDates, selectedDatesSet]);

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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Extractor PDF Estructurado</CardTitle>
        <CardDescription>Detecta columnas y filas usando posiciones del texto.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <PdfLocalControls
            localProgress={localProgress}
            localAnalysisState={localAnalysisState}
            isProcessing={isProcessing}
            selectedFile={selectedFile}
            canDownloadCsv={headers.length > 0 && rows.length > 0}
            onSelectFile={handleFile}
            onShowHistoryIa={() => setShowHistoryIa(true)}
            onPause={pauseLocalAnalysis}
            onStop={stopLocalAnalysis}
            onResume={resumeOrContinueLocalAnalysis}
            onRestart={() => {
              if (selectedFile) void handleFile(selectedFile);
            }}
            onDownloadCsv={handleDownloadCSV}
          />

          <div className="border rounded-md p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Verificación con IA</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Proveedor</Label>
                    <Select value={selectedProvider} onValueChange={(val) => handleChangeProvider(val as AiProviderId)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecciona proveedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini">Gemini</SelectItem>
                        <SelectItem value="kimi">Kimi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Modelo</Label>
                    <Select
                      value={
                        models.some(m => m.id === selectedModelId && m.provider === selectedProvider)
                          ? selectedModelId
                          : undefined
                      }
                      onValueChange={setSelectedModelId}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecciona modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        {models
                          .filter(m => m.provider === selectedProvider)
                          .map(m => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.label} ({m.model})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="custom-model">Modelo personalizado</Label>
                  <Input
                    id="custom-model"
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder={selectedProvider === 'gemini' ? 'gemini-2.0-flash' : 'kimi-k2-turbo-preview'}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Temperature</Label>
                    <div className="mt-2">
                      <Slider
                        value={[temperature]}
                        onValueChange={(vals) => setTemperature(Number(vals[0]))}
                        min={0}
                        max={2}
                        step={0.05}
                      />
                    </div>
                    <Input
                      className="mt-2"
                      type="number"
                      step="0.05"
                      min={0}
                      max={2}
                      value={temperature}
                      onChange={(e) => setTemperature(Math.max(0, Math.min(2, Number(e.target.value))))}
                    />
                  </div>
                  <div>
                    <Label>Top P</Label>
                    <div className="mt-2">
                      <Slider
                        value={[typeof topP === 'number' ? topP : 1]}
                        onValueChange={(vals) => setTopP(Number(vals[0]))}
                        min={0}
                        max={1}
                        step={0.05}
                      />
                    </div>
                    <Input
                      className="mt-2"
                      type="number"
                      step="0.05"
                      min={0}
                      max={1}
                      value={typeof topP === 'number' ? topP : 1}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setTopP(Math.max(0, Math.min(1, v)));
                      }}
                    />
                  </div>
                  <div className="flex flex-col">
                    <Label>Stream</Label>
                    <div className="mt-2 flex items-center gap-2">
                      <Switch checked={stream} onCheckedChange={setStream} />
                      <span className="text-sm text-muted-foreground">{stream ? 'On' : 'Off'}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="mt-4 text-xs text-muted-foreground">
                  La configuración de API Keys se realiza en Mi Cuenta → Configuración
                  (Gemini y Kimi).
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-end gap-2">
                <Button
                  variant="secondary"
                  onClick={handleAnalyzeWithAI}
                  disabled={!selectedFile || isAnalyzing}
                >
                  {isAnalyzing
                    ? 'Analizando...'
                    : confirmedHeaders
                    ? 'Analizar movimientos con IA'
                    : 'Detectar encabezado con IA'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCompareModal(true)}
                  disabled={!selectedFile || aiHeaders.length === 0}
                >
                  Ver PDF vs resultado IA
                </Button>
              </div>
              {headerCandidate && !confirmedHeaders && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Encabezado detectado por IA. Revísalo y confirma para continuar.
                  </div>
                  <div className="border rounded-md overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {(headerDraft || headerCandidate || []).map((h, i) => (
                            <TableHead key={`header-candidate-${i}`} className="align-middle">
                              {headerDraft ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    className="h-8 text-xs"
                                    value={headerDraft[i] ?? ''}
                                    onChange={e => updateHeaderField(i, e.target.value)}
                                  />
                                  {headerDraft.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => deleteHeaderField(i)}
                                      className="text-muted-foreground hover:text-destructive transition"
                                      title="Eliminar campo"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                h || '-'
                              )}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                    </Table>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={addHeaderField}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar campo
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        const source = headerDraft || headerCandidate;
                        if (!source) return;
                        const cleaned = source.map(h => (h || '').trim()).filter(h => h !== '');
                        if (cleaned.length === 0) {
                          setVerifyError('Define al menos un nombre de columna antes de continuar.');
                          return;
                        }
                        setConfirmedHeaders(cleaned);
                        await runFullAnalysisWithHeaders(cleaned);
                      }}
                      disabled={isAnalyzing || !selectedFile}
                    >
                      Confirmar encabezado y analizar movimientos
                    </Button>
                  </div>
                </div>
              )}
              {totalParts && totalParts > 0 && aiAnalysisState !== 'idle' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex justify-between text-xs text-muted-foreground flex-1">
                      <span>
                        Progreso del análisis: {processedParts}/{totalParts} partes
                      </span>
                      <span>
                        {Math.round((processedParts / totalParts) * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="destructive" onClick={handleStopAiAnalysis} disabled={!isAnalyzing}>
                        <Square className="h-4 w-4 mr-1" />
                        Parar
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleResumeAiAnalysis}
                        disabled={aiAnalysisState !== 'stopped' || isAnalyzing}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Continuar
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleRestartAiAnalysis} disabled={!confirmedHeaders}>
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Reiniciar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleCancelAiAnalysis}
                        disabled={aiAnalysisState === 'idle'}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleViewCurrentAiLogDetail}
                        disabled={!currentAiLogId}
                      >
                        Ver detalle
                      </Button>
                    </div>
                  </div>
                  <Progress value={(processedParts / totalParts) * 100} />
                </div>
              )}
            </div>
            {verifyMessage && (
              <div className="text-sm text-green-600">{verifyMessage}</div>
            )}
            {verifyError && (
              <div className="text-sm text-destructive">{verifyError}</div>
            )}
            {verifyDebugLog && (
              <div className="mt-2 text-xs bg-muted font-mono p-2 rounded max-h-40 overflow-auto whitespace-pre-wrap">
                {verifyDebugLog}
              </div>
            )}

            <AiLogsDialog
              open={showHistoryIa}
              onOpenChange={setShowHistoryIa}
              aiLogs={aiLogs}
              analysisRuns={analysisRuns}
              currentRunId={currentRunId}
              focusAiLogId={focusAiLogId}
            />
            <ComparePdfAiDialog
              open={showCompareModal}
              onOpenChange={setShowCompareModal}
              pdfUrl={pdfUrl}
              aiHeaders={aiHeaders}
              aiRows={aiRows}
              pdfScrollRef={pdfScrollRef}
              aiScrollRef={aiScrollRef}
              onPdfScroll={syncScroll}
            />
            {aiHeaders.length > 0 && (
              <div className="border rounded-md p-3 overflow-auto max-h-[75vh]">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">Tabla detectada por IA</div>
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="text-xs">
                        Filtros activos
                      </Badge>
                    )}
                    {isFilterPending && (
                      <Badge variant="outline" className="text-xs">
                        Filtrando...
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadAiCSV}
                      disabled={aiHeaders.length === 0 || aiRows.length === 0}
                    >
                      Exportar CSV IA
                    </Button>
                  </div>
                </div>
                <div className="mb-3 grid gap-3 md:grid-cols-3">
                  <div className="md:col-span-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="ai-desc-filter">Filtro por descripción</Label>
                      <div className="text-xs text-muted-foreground">
                        Mostrando {visibleRowIndices.length} de {aiRows.length}
                      </div>
                    </div>
                    <Input
                      id="ai-desc-filter"
                      value={descriptionFilter}
                      onChange={e => handleDescriptionFilterChange(e.target.value)}
                      placeholder="Buscar (coincidencias parciales)…"
                      aria-label="Buscar por descripción"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">
                        {descriptionColIndex === null ? 'No se detectó columna de descripción; se busca en toda la fila.' : ''}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                        disabled={!hasActiveFilters}
                      >
                        Limpiar filtros
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Filtro por fecha</Label>
                      {dateColIndex === null && (
                        <span className="text-xs text-muted-foreground">Sin columna fecha</span>
                      )}
                    </div>
                    <div className="border rounded-md p-2 max-h-44 overflow-auto">
                      {dateColIndex === null ? (
                        <div className="text-xs text-muted-foreground">No se pudo detectar la columna de fecha.</div>
                      ) : dateOptions.length === 0 ? (
                        <div className="text-xs text-muted-foreground">Aún no hay fechas detectadas.</div>
                      ) : (
                        <div className="space-y-1">
                          {dateOptions.map((opt, idx) => {
                            const id = `ai-date-${idx}`;
                            const checked = selectedDatesSet.has(opt.value);
                            const countLabel = normalizedQuery.length > 0 ? `${opt.matches}/${opt.total}` : String(opt.total);
                            return (
                              <div key={opt.value} className="flex items-center gap-2">
                                <Checkbox
                                  id={id}
                                  checked={checked}
                                  onCheckedChange={() => toggleDateSelection(opt.value)}
                                />
                                <label htmlFor={id} className="text-xs select-none cursor-pointer flex-1 truncate">
                                  {opt.value}
                                </label>
                                <Badge variant="outline" className="text-[10px]">
                                  {countLabel}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {missingSelectedDatesCount > 0 && (
                      <div className="text-[10px] text-amber-600">
                        {missingSelectedDatesCount} fecha(s) seleccionada(s) no están en los datos actuales.
                      </div>
                    )}
                  </div>
                </div>
                {invalidRows.length > 0 && (
                  <div className="mb-2 text-xs text-red-600">
                    Hay {invalidRows.length} filas con montos inválidos (crédito/débito vacíos o ambos con valor).
                  </div>
                )}
                {!hasActiveFilters && aiRows.length > 0 && (
                  <div className="mb-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
                    <span>
                      Página {safeCurrentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => setCurrentPage(safeCurrentPage - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => setCurrentPage(safeCurrentPage + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      {aiHeaders.map((h, i) => (
                        <TableHead key={`aih-${i}`} className="relative">
                          <span>{h || '-'}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteColumnIndex(i);
                              setShowDeleteColumnModal(true);
                            }}
                            className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive transition"
                            title="Eliminar columna"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aiRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={aiHeaders.length + 1} className="text-center text-muted-foreground">
                          Sin filas
                        </TableCell>
                      </TableRow>
                    ) : hasActiveFilters && visibleRowIndices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={aiHeaders.length + 1} className="text-center text-muted-foreground">
                          Sin coincidencias
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleRowIndices.map(rowIndex => {
                        const r = aiRows[rowIndex] || [];
                        const isInvalid = invalidRows.includes(rowIndex);
                        return (
                          <TableRow key={`air-${rowIndex}`} className="group">
                            <TableCell className="p-1 align-middle">
                              <div className="flex flex-col items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => addRowAfter(rowIndex)}
                                  className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition"
                                  title="Agregar fila debajo"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteRow(rowIndex)}
                                  className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed text-destructive opacity-0 group-hover:opacity-100 hover:bg-muted transition"
                                  title="Eliminar fila"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </TableCell>
                            {r.map((c, j) => {
                              const isEditing =
                                editingCell &&
                                editingCell.rowIndex === rowIndex &&
                                editingCell.colIndex === j;
                              return (
                                <TableCell
                                  key={`aic-${rowIndex}-${j}`}
                                  className={`relative group/cell ${isInvalid ? 'bg-red-50' : ''}`}
                                >
                                  {isEditing ? (
                                    <div className="flex items-center gap-2">
                                      <Input
                                        autoFocus
                                        value={editingCell.value}
                                        onChange={e => handleChangeEditingValue(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            saveEditCell();
                                          }
                                          if (e.key === 'Escape') {
                                            e.preventDefault();
                                            cancelEditCell();
                                          }
                                        }}
                                      />
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-green-600"
                                        type="button"
                                        onClick={saveEditCell}
                                      >
                                        ✓
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-destructive"
                                        type="button"
                                        onClick={cancelEditCell}
                                      >
                                        ✕
                                      </Button>
                                    </div>
                                  ) : (
                                    <>
                                      <span>{c || '-'}</span>
                                      <button
                                        type="button"
                                        onClick={() => startEditCell(rowIndex, j)}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/cell:opacity-100 text-muted-foreground hover:text-foreground transition"
                                        title="Editar celda"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </button>
                                      {isInvalid && (
                                        <AlertTriangle className="absolute left-1 top-1/2 -translate-y-1/2 h-3 w-3 text-amber-500" />
                                      )}
                                    </>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
            <AlertDialog open={showDeleteColumnModal} onOpenChange={setShowDeleteColumnModal}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar columna</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará la columna seleccionada y todos sus valores de la tabla de IA.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    onClick={() => {
                      setShowDeleteColumnModal(false);
                      setDeleteColumnIndex(null);
                    }}
                  >
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => {
                      if (deleteColumnIndex === null) {
                        setShowDeleteColumnModal(false);
                        return;
                      }
                      setAiHeaders(prev => prev.filter((_, idx) => idx !== deleteColumnIndex));
                      setAiRows(prev =>
                        prev.map(row => row.filter((_, idx) => idx !== deleteColumnIndex)),
                      );
                      setDeleteColumnIndex(null);
                      setShowDeleteColumnModal(false);
                    }}
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PdfStructuredExtractor;
