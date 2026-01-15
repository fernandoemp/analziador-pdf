import { useEffect, useRef, useState } from 'react';
import { settingsDb, type PdfAnalysisRun, type PdfAnalysisStage } from '@/lib/localDb';
import {
  type LocalExtractContext,
  loadPdfJs,
  groupRows,
  detectHeaderIndex,
  buildXBins,
  labelsAndPositionsFromHeaderRow,
  buildBinToHeaderMap,
  foldByDate,
  cleanColumns,
} from '@/lib/pdfStructuredExtractorUtils';

export type LocalProgress = {
  stageLabel: string;
  current: number;
  total: number;
  startedAt: number;
  elapsedMs: number;
  etaMs?: number;
};

type Params = {
  setIsProcessing: (next: boolean) => void;
  onResult: (headers: string[], rows: string[][]) => void;
  onError: (message: string) => void;
};

type PdfTextItemRaw = { str?: unknown; transform?: unknown };
type PdfTextContent = { items?: unknown };

export const useLocalPdfAnalysis = ({ setIsProcessing, onResult, onError }: Params) => {
  const [analysisRuns, setAnalysisRuns] = useState<PdfAnalysisRun[]>([]);
  const [localAnalysisState, setLocalAnalysisState] = useState<
    'idle' | 'running' | 'paused' | 'stopped' | 'failed' | 'completed'
  >('idle');
  const [localProgress, setLocalProgress] = useState<LocalProgress | null>(null);

  const localControlRef = useRef<'running' | 'paused' | 'stopped'>('running');
  const localPauseResolverRef = useRef<(() => void) | null>(null);
  const localContextRef = useRef<LocalExtractContext | null>(null);
  const currentLocalRunRef = useRef<PdfAnalysisRun | null>(null);

  useEffect(() => {
    setAnalysisRuns(settingsDb.getPdfAnalysisRuns());
  }, []);

  const upsertAnalysisRun = (run: PdfAnalysisRun) => {
    settingsDb.upsertPdfAnalysisRun(run);
    setAnalysisRuns(settingsDb.getPdfAnalysisRuns());
  };

  const updateRunStage = (run: PdfAnalysisRun, stageId: string, updates: Partial<PdfAnalysisStage>) => {
    const nextStages = run.stages.map(s => (s.id === stageId ? { ...s, ...updates } : s));
    return { ...run, stages: nextStages };
  };

  const appendRunStage = (run: PdfAnalysisRun, stage: PdfAnalysisStage) => {
    return { ...run, currentStageId: stage.id, stages: [...run.stages, stage] };
  };

  const pauseLocalAnalysis = () => {
    if (localAnalysisState !== 'running') return;
    localControlRef.current = 'paused';
  };

  const stopLocalAnalysis = () => {
    localControlRef.current = 'stopped';
    if (localPauseResolverRef.current) {
      localPauseResolverRef.current();
      localPauseResolverRef.current = null;
    }
  };

  const resumeLocalAnalysis = () => {
    if (localControlRef.current !== 'paused') return;
    localControlRef.current = 'running';
    if (localPauseResolverRef.current) {
      localPauseResolverRef.current();
      localPauseResolverRef.current = null;
    }
  };

  const runLocalExtraction = async (context: LocalExtractContext, run: PdfAnalysisRun) => {
    const STOP = Symbol('stop');

    const waitIfPausedOrStopped = async () => {
      while (true) {
        const control = localControlRef.current;
        if (control === 'stopped') throw STOP;
        if (control !== 'paused') return;

        setIsProcessing(false);
        setLocalAnalysisState('paused');
        const base = currentLocalRunRef.current || run;
        const pausedRun: PdfAnalysisRun = {
          ...base,
          status: 'paused',
          resume: { nextPage: context.nextPage, totalPages: context.numPages },
        };
        currentLocalRunRef.current = pausedRun;
        upsertAnalysisRun(pausedRun);

        await new Promise<void>(resolve => {
          localPauseResolverRef.current = resolve;
        });
        localPauseResolverRef.current = null;

        const nextControl = localControlRef.current;
        if (nextControl === 'stopped') throw STOP;
        if (nextControl === 'paused') continue;

        setIsProcessing(true);
        setLocalAnalysisState('running');
        return;
      }
    };

    try {
      let activeRun: PdfAnalysisRun = {
        ...run,
        status: 'in_progress',
        startedAt: run.startedAt ?? Date.now(),
        endedAt: undefined,
      };
      currentLocalRunRef.current = activeRun;
      upsertAnalysisRun(activeRun);

      const detectId = `local-detect-${Date.now()}`;
      activeRun = appendRunStage(activeRun, {
        id: detectId,
        label: 'Detección de columnas',
        status: 'in_progress',
        startedAt: Date.now(),
      });
      currentLocalRunRef.current = activeRun;
      upsertAnalysisRun(activeRun);

      const pageTimes: number[] = [];
      for (let pageNumber = context.nextPage; pageNumber <= context.numPages; pageNumber++) {
        await waitIfPausedOrStopped();

        const stageId = `local-page-${pageNumber}-${Date.now()}`;
        const stageLabel = `Procesando página ${pageNumber}/${context.numPages}`;
        const startedAt = Date.now();

        activeRun = appendRunStage(activeRun, {
          id: stageId,
          label: stageLabel,
          status: 'in_progress',
          startedAt,
          page: pageNumber,
          totalPages: context.numPages,
        });
        activeRun.resume = { nextPage: pageNumber, totalPages: context.numPages };
        currentLocalRunRef.current = activeRun;
        upsertAnalysisRun(activeRun);

        const elapsedSinceStart = Date.now() - context.startedAt;
        const avgMs = pageTimes.length > 0 ? pageTimes.reduce((a, b) => a + b, 0) / pageTimes.length : undefined;
        const remaining = context.numPages - pageNumber + 1;
        const etaMs = avgMs ? Math.round(avgMs * remaining) : undefined;
        setLocalProgress({
          stageLabel,
          current: pageNumber,
          total: context.numPages,
          startedAt,
          elapsedMs: elapsedSinceStart,
          etaMs,
        });

        const pageStart = Date.now();
        const page = await context.pdf.getPage(pageNumber);
        const text = (await page.getTextContent()) as PdfTextContent;
        const rawItems = Array.isArray(text.items) ? (text.items as PdfTextItemRaw[]) : [];
        const items = rawItems
          .map(it => {
            const str = typeof it.str === 'string' ? it.str : '';
            const t = Array.isArray(it.transform) ? it.transform : null;
            const x = t && typeof t[4] === 'number' ? t[4] : 0;
            const y = t && typeof t[5] === 'number' ? t[5] : 0;
            return { str, x, y };
          })
          .filter(it => (it.str || '').trim() !== '');
        context.items.push(
          ...items.map(it => ({ ...it, y: it.y + (context.numPages - pageNumber) * context.pageGap })),
        );
        context.nextPage = pageNumber + 1;

        const pageEnd = Date.now();
        pageTimes.push(pageEnd - pageStart);

        const stageEndedAt = Date.now();
        activeRun = updateRunStage(activeRun, stageId, {
          status: 'completed',
          endedAt: stageEndedAt,
          elapsedMs: stageEndedAt - startedAt,
          message: `Página ${pageNumber}/${context.numPages} procesada`,
        });
        currentLocalRunRef.current = activeRun;
        upsertAnalysisRun(activeRun);
      }

      const grouped = groupRows(context.items);
      const xbins = buildXBins(grouped);

      let baseHeaders: string[] = [];
      let headerPositions: number[] = [];
      let startIndex = 0;

      const headerIndex = detectHeaderIndex(grouped);
      if (headerIndex >= 0) {
        const headerInfo = labelsAndPositionsFromHeaderRow(grouped[headerIndex] || []);
        baseHeaders = headerInfo.labels;
        headerPositions = headerInfo.positions;
        startIndex = headerIndex + 1;
      }

      if (baseHeaders.length === 0) {
        baseHeaders = ['Fecha', 'Descripción', 'Origen', 'Crédito', 'Débito', 'Saldo'];
        headerPositions = [];
        startIndex = 0;
      }

      const detectEndedAt = Date.now();
      activeRun = updateRunStage(activeRun, detectId, {
        status: 'completed',
        endedAt: detectEndedAt,
        elapsedMs: detectEndedAt - (activeRun.stages.find(s => s.id === detectId)?.startedAt || detectEndedAt),
        message: `Columnas detectadas: ${baseHeaders.join(', ')}`,
      });
      currentLocalRunRef.current = activeRun;
      upsertAnalysisRun(activeRun);

      const buildId = `local-build-${Date.now()}`;
      activeRun = appendRunStage(activeRun, {
        id: buildId,
        label: 'Construcción de filas y limpieza',
        status: 'in_progress',
        startedAt: Date.now(),
      });
      currentLocalRunRef.current = activeRun;
      upsertAnalysisRun(activeRun);

      const binToHeaderMap = buildBinToHeaderMap(xbins, headerPositions, baseHeaders.length);
      const rawRows = foldByDate(grouped.slice(startIndex), xbins, baseHeaders, binToHeaderMap, headerPositions);
      const cleaned = cleanColumns(baseHeaders, rawRows);
      const finalHeaders = cleaned.finalHeaders.length > 0 ? cleaned.finalHeaders : baseHeaders;
      const finalRows = cleaned.finalRows.filter(r => r.some(c => (c || '').trim() !== ''));

      const buildEndedAt = Date.now();
      activeRun = updateRunStage(activeRun, buildId, {
        status: 'completed',
        endedAt: buildEndedAt,
        elapsedMs: buildEndedAt - (activeRun.stages.find(s => s.id === buildId)?.startedAt || buildEndedAt),
        message: `Filas generadas: ${finalRows.length}`,
      });

      activeRun.status = 'completed';
      activeRun.endedAt = Date.now();
      activeRun.resume = { nextPage: context.numPages + 1, totalPages: context.numPages };
      currentLocalRunRef.current = activeRun;
      upsertAnalysisRun(activeRun);

      onResult(finalHeaders, finalRows);
      setLocalAnalysisState('completed');
      setIsProcessing(false);
      setLocalProgress(null);
      localContextRef.current = null;
    } catch (e: unknown) {
      if (e === STOP) {
        const active = currentLocalRunRef.current;
        if (active) {
          const stoppedRun: PdfAnalysisRun = {
            ...active,
            status: 'stopped',
            endedAt: Date.now(),
            resume: { nextPage: context.nextPage, totalPages: context.numPages },
          };
          currentLocalRunRef.current = stoppedRun;
          upsertAnalysisRun(stoppedRun);
        }
        setLocalAnalysisState('stopped');
        setIsProcessing(false);
        return;
      }
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      onError(`No se pudo extraer la tabla localmente: ${msg}`);
      setLocalAnalysisState('failed');
      setIsProcessing(false);
    }
  };

  const startLocalAnalysis = async (file: File) => {
    setIsProcessing(true);
    setLocalAnalysisState('running');
    setLocalProgress(null);
    localControlRef.current = 'running';
    localContextRef.current = null;
    currentLocalRunRef.current = null;

    try {
      const runId = `local-${Date.now()}`;
      let run: PdfAnalysisRun = {
        id: runId,
        fileName: file.name,
        mode: 'local',
        status: 'in_progress',
        createdAt: Date.now(),
        startedAt: Date.now(),
        stages: [],
        resume: { nextPage: 1 },
      };
      currentLocalRunRef.current = run;
      upsertAnalysisRun(run);

      const loadId = `local-load-${Date.now()}`;
      run = appendRunStage(run, {
        id: loadId,
        label: 'Carga del PDF',
        status: 'in_progress',
        startedAt: Date.now(),
        message: 'Preparando documento',
      });
      currentLocalRunRef.current = run;
      upsertAnalysisRun(run);

      const pdfjsLib = await loadPdfJs();
      const data = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data });
      const pdf = (await loadingTask.promise) as LocalExtractContext['pdf'];

      const loadEndedAt = Date.now();
      run = updateRunStage(run, loadId, {
        status: 'completed',
        endedAt: loadEndedAt,
        elapsedMs: loadEndedAt - (run.stages.find(s => s.id === loadId)?.startedAt || loadEndedAt),
        message: `Documento listo (${pdf.numPages} páginas)`,
      });
      currentLocalRunRef.current = run;
      upsertAnalysisRun(run);

      const context: LocalExtractContext = {
        runId,
        file,
        data,
        pdf,
        numPages: pdf.numPages,
        pageGap: 10000,
        items: [],
        nextPage: 1,
        startedAt: Date.now(),
      };
      localContextRef.current = context;
      await runLocalExtraction(context, run);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      onError(`No se pudo extraer la tabla localmente: ${msg}`);
      setLocalAnalysisState('failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const resumeOrContinueLocalAnalysis = async () => {
    const context = localContextRef.current;
    const run = currentLocalRunRef.current;
    if (!context || !run) return;
    if (localControlRef.current === 'paused') {
      resumeLocalAnalysis();
      return;
    }
    if (localAnalysisState === 'stopped' || localAnalysisState === 'failed') {
      localControlRef.current = 'running';
      setIsProcessing(true);
      setLocalAnalysisState('running');
      await runLocalExtraction(context, run);
    }
  };

  return {
    analysisRuns,
    localAnalysisState,
    localProgress,
    pauseLocalAnalysis,
    stopLocalAnalysis,
    resumeOrContinueLocalAnalysis,
    startLocalAnalysis,
    currentRunId: currentLocalRunRef.current?.id ?? null,
  };
};
