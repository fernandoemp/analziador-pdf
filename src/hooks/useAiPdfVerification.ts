import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { settingsDb, type AiExtractionLog, type AiModelConfig, type AiProviderId } from '@/lib/localDb';
import {
  analyzePDFWithGemini,
  analyzePDFWithKimi,
  detectPdfHeadersWithGemini,
  detectPdfHeadersWithKimi,
} from '@/lib/pdfToExcelAI';
import { computeInvalidAmountRows, computeSimpleDiff, normalizeHeaderText } from '@/lib/pdfStructuredExtractorUtils';

export const useAiPdfVerification = ({
  selectedFile,
  fileName,
  localHeaders,
  localRows,
}: {
  selectedFile: File | null;
  fileName: string;
  localHeaders: string[];
  localRows: string[][];
}) => {
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyError, setVerifyError] = useState<string>('');
  const [verifyMessage, setVerifyMessage] = useState<string>('');
  const [verifyDebugLog, setVerifyDebugLog] = useState<string>('');
  const [diff, setDiff] = useState<{ missingRows: number; extraRows: number; mismatchedAmounts: number } | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [selectedProvider, setSelectedProvider] = useState<AiProviderId>('gemini');
  const [models, setModels] = useState<AiModelConfig[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [customModel, setCustomModel] = useState<string>('');
  const [temperature, setTemperature] = useState<number>(0.1);
  const [topP, setTopP] = useState<number | undefined>(undefined);
  const [stream, setStream] = useState<boolean>(false);

  const [showLogs, setShowLogs] = useState<boolean>(false);
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
  const deferredDescriptionFilter = useDeferredValue(descriptionFilter);
  const [isFilterPending, startFilterTransition] = useTransition();
  const [currentPage, setCurrentPage] = useState<number>(1);
  const lastUnfilteredPageRef = useRef<number>(1);

  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    colIndex: number;
    value: string;
  } | null>(null);

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

  const currentModel = useMemo(
    () => models.find(m => m.id === selectedModelId && m.provider === selectedProvider),
    [models, selectedModelId, selectedProvider],
  );

  const effectiveModelName = useMemo(() => {
    const v = customModel && customModel.trim();
    if (v) return v;
    if (currentModel?.model) return currentModel.model;
    return selectedProvider === 'gemini' ? 'gemini-2.0-flash' : 'moonshot-v1-8k';
  }, [customModel, currentModel?.model, selectedProvider]);

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

  const runFullAnalysisWithHeaders = async (headersToUse: string[]) => {
    if (!selectedFile) {
      setVerifyError('Selecciona un PDF primero');
      return;
    }
    setIsAnalyzing(true);
    setIsVerifying(true);
    setVerifyError('');
    setVerifyMessage('');
    setVerifyDebugLog('');
    setAiHeaders([]);
    setAiRows([]);
    setAiPageRowCounts([]);
    setDiff(null);
    setTotalParts(null);
    setProcessedParts(0);
    setCurrentPage(1);
    lastUnfilteredPageRef.current = 1;
    try {
      if (selectedProvider === 'gemini') {
        const geminiKey = settingsDb.getGeminiApiKey();
        if (!geminiKey) {
          setVerifyError('API Key de Gemini no configurada (Cuenta → Configuración)');
          return;
        }
        const result = await analyzePDFWithGemini(selectedFile, geminiKey, effectiveModelName, {
          knownHeaders: headersToUse,
          onProgress: ({ totalParts, processedParts, headers, rows }) => {
            if (typeof totalParts === 'number') {
              setTotalParts(totalParts);
              setProcessedParts(processedParts);
            }
            if (headers) setAiHeaders(headers);
            if (rows) {
              setAiRows(prev => [...prev, ...rows]);
              setAiPageRowCounts(prev => [...prev, rows.length]);
            }
          },
        });
        if (!result.success || !result.headers || !result.rows) {
          setVerifyError(result.error || 'Error al analizar con Gemini');
          if (result.debugInfo) {
            setVerifyDebugLog(result.debugInfo);
          }
          return;
        }
        const log: AiExtractionLog = {
          id: `gemini-${Date.now()}`,
          timestamp: Date.now(),
          provider: 'gemini',
          model: result.model || effectiveModelName,
          fileName: fileName || selectedFile.name,
          promptTokens: result.usage?.promptTokens,
          completionTokens: result.usage?.completionTokens,
          totalTokens: result.usage?.totalTokens,
        };
        settingsDb.addAiLog(log);
        setAiLogs(prev => [log, ...prev]);
        setAiHeaders(result.headers);
        setDiff(computeSimpleDiff(localHeaders, localRows, result.headers, result.rows));
        setVerifyMessage(`Análisis completado con ${result.model || 'Gemini'}`);
      } else if (selectedProvider === 'kimi') {
        const kimiKey = settingsDb.getKimiApiKey();
        if (!kimiKey) {
          setVerifyError('API Key de Kimi no configurada (Cuenta → Configuración)');
          return;
        }
        const result = await analyzePDFWithKimi(selectedFile, kimiKey, effectiveModelName, temperature, topP, {
          knownHeaders: headersToUse,
          onProgress: ({ totalParts, processedParts, headers, rows }) => {
            if (typeof totalParts === 'number') {
              setTotalParts(totalParts);
              setProcessedParts(processedParts);
            }
            if (headers) setAiHeaders(headers);
            if (rows) {
              setAiRows(prev => [...prev, ...rows]);
              setAiPageRowCounts(prev => [...prev, rows.length]);
            }
          },
        });
        if (!result.success || !result.headers || !result.rows) {
          setVerifyError(result.error || 'Error al analizar con Kimi');
          if (result.debugInfo) {
            setVerifyDebugLog(result.debugInfo);
          }
          return;
        }
        const log: AiExtractionLog = {
          id: `kimi-${Date.now()}`,
          timestamp: Date.now(),
          provider: 'kimi',
          model: result.model || effectiveModelName,
          fileName: fileName || selectedFile.name,
          promptTokens: result.usage?.promptTokens,
          completionTokens: result.usage?.completionTokens,
          totalTokens: result.usage?.totalTokens,
        };
        settingsDb.addAiLog(log);
        setAiLogs(prev => [log, ...prev]);
        setAiHeaders(result.headers);
        setVerifyMessage(`Análisis completado con ${result.model || 'Kimi'}`);
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

  const handleAnalyzeWithAI = async () => {
    if (!selectedFile) {
      setVerifyError('Selecciona un PDF primero');
      return;
    }
    if (!confirmedHeaders) {
      await runHeaderDetection();
      return;
    }
    await runFullAnalysisWithHeaders(confirmedHeaders);
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
    showLogs,
    setShowLogs,
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
    deleteColumnIndex,
    showDeleteColumnModal,
    selectedDates,
    descriptionFilter,
    isFilterPending,
    dateOptions,
    descriptionColIndex,
    invalidRows,
    visibleRowIndices,
    hasActiveFilters,
    missingSelectedDatesCount,
    handleChangeProvider,
    handleAnalyzeWithAI,
    addHeaderField,
    deleteHeaderField,
    updateHeaderField,
    confirmHeaderDraftAndAnalyze,
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

