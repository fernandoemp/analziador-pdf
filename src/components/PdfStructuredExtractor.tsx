import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
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
import { AiLogsDialog } from '@/components/pdf-structured-extractor/AiLogsDialog';
import { PdfValidatorDialog } from '@/components/pdf-structured-extractor/ComparePdfAiDialog';
import { AiAnalysisResumeBanner } from '@/components/pdf-structured-extractor/AiAnalysisResumeBanner';
import { AiHeaderCandidateEditor } from '@/components/pdf-structured-extractor/AiHeaderCandidateEditor';
import { AiProgressControls } from '@/components/pdf-structured-extractor/AiProgressControls';
import { AiResultsTable } from '@/components/pdf-structured-extractor/AiResultsTable';
import {
  AdvancedAiSettingsDialog,
  AiVerificationHeaderBar,
} from '@/components/pdf-structured-extractor/AdvancedAiSettingsDialog';
import { PdfLocalControls } from '@/components/pdf-structured-extractor/PdfLocalControls';
import { useAiPdfVerification } from '@/hooks/useAiPdfVerification';
import { useLocalPdfAnalysis } from '@/hooks/useLocalPdfAnalysis';
import { getFileFingerprint, loadValidatorState, normalizeValidatorState, removeValidatorState } from '@/lib/ai-analysis-persistence/storage';
import { showSuccess } from '@/utils/toast';

const ADVANCED_AI_SETTINGS_STORAGE_KEY = 'pdf-structured-extractor:advanced-ai-settings:v1';

const PdfStructuredExtractor: React.FC = () => {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  const [showValidatorModal, setShowValidatorModal] = useState<boolean>(false);
  const [validatorProgress, setValidatorProgress] = useState<{ validated: number; total: number } | null>(null);

  const pdfScrollRef = useRef<HTMLDivElement | null>(null);
  const aiScrollRef = useRef<HTMLDivElement | null>(null);

  const ai = useAiPdfVerification({
    selectedFile,
    localHeaders: headers,
    localRows: rows,
  });

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
    },
    onError: (message) => {
      ai.setVerifyError(message);
    },
  });

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const syncScroll = () => {
    const source = pdfScrollRef.current;
    const target = aiScrollRef.current;
    if (!source || !target) return;
    const sourceMax = source.scrollHeight - source.clientHeight || 1;
    const targetMax = target.scrollHeight - target.clientHeight;
    const ratio = sourceMax > 0 ? source.scrollTop / sourceMax : 0;
    target.scrollTop = ratio * targetMax;
  };

  const handleFile = async (file: File) => {
    if (selectedFile) {
      const prevFingerprint = getFileFingerprint(selectedFile);
      const nextFingerprint = getFileFingerprint(file);
      if (
        prevFingerprint.name !== nextFingerprint.name ||
        prevFingerprint.size !== nextFingerprint.size ||
        prevFingerprint.lastModified !== nextFingerprint.lastModified ||
        prevFingerprint.type !== nextFingerprint.type
      ) {
        removeValidatorState(prevFingerprint);
      }
    }
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);

    setHeaders([]);
    setRows([]);
    setFileName(file.name);
    setSelectedFile(file);

    const url = URL.createObjectURL(file);
    setPdfUrl(url);

    await ai.handleFileSelected(file);
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

  const aiResultsTableProps = {
    aiHeaders: ai.aiHeaders,
    aiRows: ai.aiRows,
    hasActiveFilters: ai.hasActiveFilters,
    isFilterPending: ai.isFilterPending,
    visibleRowIndices: ai.visibleRowIndices,
    descriptionFilter: ai.descriptionFilter,
    descriptionColIndex: ai.descriptionColIndex,
    onChangeDescriptionFilter: ai.handleDescriptionFilterChange,
    onClearFilters: ai.clearFilters,
    dateColIndex: ai.dateColIndex ?? null,
    dateOptions: ai.dateOptions,
    selectedDatesSet: ai.selectedDatesSet,
    normalizedQuery: ai.normalizedQuery,
    onToggleDateSelection: ai.toggleDateSelection,
    missingSelectedDatesCount: ai.missingSelectedDatesCount,
    invalidRows: ai.invalidRows,
    safeCurrentPage: ai.safeCurrentPage,
    totalPages: ai.totalPages,
    onPrevPage: () => ai.setCurrentPage(ai.safeCurrentPage - 1),
    onNextPage: () => ai.setCurrentPage(ai.safeCurrentPage + 1),
    dateFilterPresentation: 'popover' as const,
    onDownloadCsv: ai.handleDownloadAiCSV,
    onRequestDeleteColumn: ai.requestDeleteColumn,
    onAddRowAfter: ai.addRowAfter,
    onDeleteRow: ai.deleteRow,
    editingCell: ai.editingCell,
    onChangeEditingValue: ai.handleChangeEditingValue,
    onSaveEditCell: ai.saveEditCell,
    onCancelEditCell: ai.cancelEditCell,
    onStartEditCell: ai.startEditCell,
  };

  const validatorAiResultsTableProps = {
    ...aiResultsTableProps,
    showCsvExport: false,
    showDescriptionFilter: false,
    dateFilterPresentation: 'popover' as const,
    showPagination: false,
  };

  const selectedFileFingerprint = React.useMemo(() => (selectedFile ? getFileFingerprint(selectedFile) : null), [selectedFile]);
  const validatorFingerprint = React.useMemo(
    () => selectedFileFingerprint ?? ai.hydratedAiSession?.meta.file ?? null,
    [ai.hydratedAiSession?.meta.file, selectedFileFingerprint]
  );

  const validatorTotalPages = Math.max(0, Math.floor(ai.totalPages));
  const showAiSpinnerCentered = ai.isAnalyzing && ai.aiRows.length === 0;

  useEffect(() => {
    if (!validatorFingerprint || validatorTotalPages <= 0) {
      setValidatorProgress(null);
      return;
    }

    const compute = () => {
      const stored = loadValidatorState(validatorFingerprint);
      if (!stored) {
        setValidatorProgress({ validated: 0, total: validatorTotalPages });
        return;
      }
      const normalized = normalizeValidatorState(stored, validatorTotalPages);
      const validated = normalized.validatedPages.reduce((acc, v) => acc + (v ? 1 : 0), 0);
      setValidatorProgress({ validated, total: normalized.totalPages });
    };

    compute();

    if (!showValidatorModal) return;

    const intervalId = window.setInterval(compute, 500);
    return () => window.clearInterval(intervalId);
  }, [showValidatorModal, validatorFingerprint, validatorTotalPages]);

  const selectedMatchesStored =
    !!selectedFile && !!ai.hydratedAiSession && ai.matchesActiveFile(selectedFile);

  const storedHasProgress =
    selectedMatchesStored &&
    ai.hydratedAiSession?.meta.status !== 'completed' &&
    ((ai.hydratedAiSession?.meta.processedParts ?? 0) > 0 ||
      (ai.hydratedAiSession?.meta.savedPartIndices?.length ?? 0) > 0);

  const shouldShowProgressControls = ai.isAnalyzing || (!!selectedFile && (ai.aiAnalysisState !== 'idle' || storedHasProgress));

  const displayTotalParts =
    typeof ai.totalParts === 'number' && ai.totalParts > 0
      ? ai.totalParts
      : selectedMatchesStored
        ? ai.hydratedAiSession?.meta.totalParts ?? null
        : null;

  const displayProcessedParts =
    (ai.processedParts ?? 0) > 0 ? ai.processedParts : selectedMatchesStored ? ai.hydratedAiSession?.meta.processedParts ?? 0 : 0;

  const hasTotalParts = typeof displayTotalParts === 'number' && displayTotalParts > 0;

  const canRestart =
    !!selectedFile &&
    ((ai.confirmedHeaders && ai.confirmedHeaders.length > 0) ||
      (selectedMatchesStored && (ai.hydratedAiSession?.meta.confirmedHeaders?.length ?? 0) > 0));

  const isValidationComplete = !!validatorProgress && validatorProgress.total > 0 && validatorProgress.validated >= validatorProgress.total;
  const hasDetectedRecords = ai.aiRows.length > 0;

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
            onShowHistoryIa={() => ai.setShowHistoryIa(true)}
            onPause={pauseLocalAnalysis}
            onStop={stopLocalAnalysis}
            onResume={resumeOrContinueLocalAnalysis}
            onRestart={() => {
              if (selectedFile) void handleFile(selectedFile);
            }}
            onDownloadCsv={handleDownloadCSV}
          />

          {ai.hydratedAiSession &&
            !ai.isAnalyzing &&
            (ai.hydratedAiSession.meta.status === 'stopped' || ai.hydratedAiSession.meta.status === 'failed') && (
              <AiAnalysisResumeBanner
                meta={ai.hydratedAiSession.meta}
                selectedFileMatches={!!selectedFile && ai.matchesActiveFile(selectedFile)}
                onResume={() => {
                  void ai.handleResumeAiAnalysis();
                }}
                onDiscard={ai.handleDiscardSavedAiAnalysis}
              />
            )}

          {ai.hydratedAiSession && !ai.isAnalyzing && ai.hydratedAiSession.meta.status === 'completed' && (
            <div className="border rounded-md p-3 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">Análisis guardado</div>
                  <div className="text-xs text-muted-foreground truncate">Archivo: {ai.hydratedAiSession.meta.file.name}</div>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  Completado
                </Badge>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    ai.handleDiscardSavedAiAnalysis();
                    if (validatorFingerprint) {
                      removeValidatorState(validatorFingerprint);
                      setValidatorProgress(validatorTotalPages > 0 ? { validated: 0, total: validatorTotalPages } : null);
                    }
                  }}
                >
                  Descartar análisis guardado
                </Button>
              </div>
            </div>
          )}

          <div className="border rounded-md p-3 space-y-3">
            <AiVerificationHeaderBar onOpenAdvancedSettings={() => setShowAdvancedSettings(true)} />
            <div className="text-xs text-muted-foreground">
              Proveedor: {ai.selectedProvider === 'gemini' ? 'Gemini' : 'Kimi'} · Modelo: {ai.effectiveModelName}
            </div>
            <AdvancedAiSettingsDialog
              open={showAdvancedSettings}
              onOpenChange={setShowAdvancedSettings}
              settings={{
                temperature: ai.temperature,
                topP: typeof ai.topP === 'number' ? ai.topP : 1,
                stream: ai.stream,
              }}
              onSave={(next) => {
                try {
                  localStorage.setItem(ADVANCED_AI_SETTINGS_STORAGE_KEY, JSON.stringify(next));
                } catch {
                  return;
                }
                ai.setTemperature(next.temperature);
                ai.setTopP(next.topP);
                ai.setStream(next.stream);
                showSuccess('Configuración avanzada guardada');
              }}
            />
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={ai.handleAnalyzeWithAI} disabled={!selectedFile || ai.isAnalyzing}>
                  {ai.isAnalyzing
                    ? 'Analizando...'
                  : ai.confirmedHeaders
                    ? 'Analizar movimientos con IA'
                    : 'Detectar encabezado con IA'}
                </Button>
                {hasDetectedRecords && (
                  <Button
                    variant="outline"
                    onClick={() => setShowValidatorModal(true)}
                    disabled={ai.aiHeaders.length === 0}
                  >
                    Validador
                  </Button>
                )}
                {hasDetectedRecords && validatorProgress && ai.aiHeaders.length > 0 && (
                  <Badge
                    variant={isValidationComplete ? 'secondary' : 'outline'}
                    className="text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-2"
                  >
                    <span className={`h-2 w-2 rounded-full ${isValidationComplete ? 'bg-green-500' : 'bg-amber-500'}`} />
                    <span>
                      Validación: {validatorProgress.validated}/{validatorProgress.total || 1}
                    </span>
                  </Badge>
                )}
              </div>

              {ai.headerCandidate && !ai.confirmedHeaders && (
                <AiHeaderCandidateEditor
                  headerCandidate={ai.headerCandidate}
                  headerDraft={ai.headerDraft}
                  isAnalyzing={ai.isAnalyzing}
                  selectedFile={selectedFile}
                  onUpdateHeaderField={ai.updateHeaderField}
                  onDeleteHeaderField={ai.deleteHeaderField}
                  onAddHeaderField={ai.addHeaderField}
                  onConfirm={ai.confirmHeaderDraftAndAnalyze}
                />
              )}

              {shouldShowProgressControls && (
                <AiProgressControls
                  hasTotalParts={hasTotalParts}
                  displayProcessedParts={displayProcessedParts}
                  displayTotalParts={
                    typeof displayTotalParts === 'number' && displayTotalParts > 0
                      ? displayTotalParts
                      : Math.max(displayProcessedParts, 1)
                  }
                  isAnalyzing={ai.isAnalyzing}
                  aiAnalysisState={ai.aiAnalysisState}
                  canRestart={canRestart}
                  canViewDetail={!!ai.currentAiLogId}
                  onStop={ai.handleStopAiAnalysis}
                  onResume={ai.handleResumeAiAnalysis}
                  onRestart={ai.handleRestartAiAnalysis}
                  onCancel={ai.handleCancelAiAnalysis}
                  onViewDetail={ai.handleViewCurrentAiLogDetail}
                />
              )}
            </div>

            {ai.verifyMessage && <div className="text-sm text-green-600">{ai.verifyMessage}</div>}
            {ai.verifyError && <div className="text-sm text-destructive">{ai.verifyError}</div>}
            {ai.verifyDebugLog && (
              <div className="mt-2 text-xs bg-muted font-mono p-2 rounded max-h-40 overflow-auto whitespace-pre-wrap">
                {ai.verifyDebugLog}
              </div>
            )}

            <AiLogsDialog
              open={ai.showHistoryIa}
              onOpenChange={ai.setShowHistoryIa}
              aiLogs={ai.aiLogs}
              analysisRuns={analysisRuns}
              currentRunId={currentRunId}
              focusAiLogId={ai.focusAiLogId}
            />

            <PdfValidatorDialog
              open={showValidatorModal}
              onOpenChange={setShowValidatorModal}
              pdfUrl={pdfUrl}
              fileFingerprint={validatorFingerprint}
              aiTableProps={validatorAiResultsTableProps}
              onSetCurrentPage={ai.setCurrentPage}
              pdfScrollRef={pdfScrollRef}
              aiScrollRef={aiScrollRef}
              onPdfScroll={syncScroll}
            />

            {showAiSpinnerCentered && (
              <div className="flex items-center justify-center border rounded-md py-14">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              </div>
            )}

            {!showAiSpinnerCentered && ai.aiHeaders.length > 0 && (
              <AiResultsTable {...aiResultsTableProps} />
            )}

            <AlertDialog
              open={ai.showDeleteColumnModal}
              onOpenChange={(open) => {
                if (!open) ai.cancelDeleteColumn();
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar columna</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará la columna seleccionada y todos sus valores de la tabla de IA.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={ai.cancelDeleteColumn}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={ai.confirmDeleteColumn}>
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

