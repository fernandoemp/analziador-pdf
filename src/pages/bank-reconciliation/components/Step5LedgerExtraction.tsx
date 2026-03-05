import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AiProgressControls } from '@/components/pdf-structured-extractor/AiProgressControls';
import { AiResultsTable } from '@/components/pdf-structured-extractor/AiResultsTable';
import { useAiPdfVerification } from '@/hooks/useAiPdfVerification';
import { useSimpleTable } from '../hooks/useSimpleTable';

export function Step5LedgerExtraction({
  ai,
  ledgerFile,
  ledgerFormat,
  ledgerRows,
  ledgerTable,
  onLoadLedgerRows,
  onBack,
  onContinue,
}: {
  ai: ReturnType<typeof useAiPdfVerification>;
  ledgerFile: File | null;
  ledgerFormat: string;
  ledgerRows: string[][];
  ledgerTable: ReturnType<typeof useSimpleTable>;
  onLoadLedgerRows: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  useEffect(() => {
    if (!ledgerFile) return;
    if (ledgerFormat !== 'pdf') {
      if (ledgerRows.length === 0) onLoadLedgerRows();
      return;
    }
    if (ai.aiRows.length > 0 || ai.isAnalyzing) return;
    if (!ai.confirmedHeaders || ai.confirmedHeaders.length === 0) return;
    if (ai.aiAnalysisState === 'idle' || ai.aiAnalysisState === 'failed') {
      ai.handleAnalyzeWithAI().catch(() => {});
    }
  }, [ai, ledgerFile, ledgerFormat, ledgerRows.length, onLoadLedgerRows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Extracción completa del libro contable</div>
          <div className="text-sm text-muted-foreground">Procesando libro contable...</div>
          {ledgerFile && (
            <div className="mt-2">
              <Badge variant="secondary" className="text-xs">
                {ledgerFile.name}
              </Badge>
            </div>
          )}
        </div>
        {ledgerFormat === 'pdf' && ai.isAnalyzing && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      </div>

      {ledgerFormat === 'pdf' && ai.isAnalyzing && (
        <AiProgressControls
          hasTotalParts={typeof ai.totalParts === 'number'}
          displayProcessedParts={ai.processedParts}
          displayTotalParts={
            typeof ai.totalParts === 'number' && ai.totalParts > 0 ? ai.totalParts : Math.max(ai.processedParts, 1)
          }
          isAnalyzing={ai.isAnalyzing}
          aiAnalysisState={ai.aiAnalysisState}
          canRestart={ai.aiAnalysisState === 'failed' || ai.aiAnalysisState === 'stopped'}
          canViewDetail={!!ai.currentAiLogId}
          onStop={ai.handleStopAiAnalysis}
          onResume={ai.handleResumeAiAnalysis}
          onRestart={ai.handleRestartAiAnalysis}
          onCancel={ai.handleCancelAiAnalysis}
          onViewDetail={ai.handleViewCurrentAiLogDetail}
        />
      )}

      {ledgerFormat !== 'pdf' && ledgerRows.length === 0 && (
        <Button type="button" onClick={onLoadLedgerRows}>
          Cargar datos del libro contable
        </Button>
      )}

      {ledgerTable.aiHeaders.length > 0 && ledgerTable.aiRows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Vista Previa - Libro Contable</div>
            <div className="text-sm text-muted-foreground">{ledgerTable.aiRows.length} registros</div>
          </div>
          <AiResultsTable
            aiHeaders={ledgerTable.aiHeaders}
            aiRows={ledgerTable.aiRows}
            hasActiveFilters={ledgerTable.hasActiveFilters}
            isFilterPending={ledgerTable.isFilterPending}
            visibleRowIndices={ledgerTable.visibleRowIndices}
            descriptionFilter={ledgerTable.descriptionFilter}
            descriptionColIndex={ledgerTable.descriptionColIndex}
            onChangeDescriptionFilter={ledgerTable.onChangeDescriptionFilter}
            onClearFilters={ledgerTable.onClearFilters}
            dateColIndex={ledgerTable.dateColIndex}
            dateOptions={ledgerTable.dateOptions}
            selectedDatesSet={ledgerTable.selectedDatesSet}
            normalizedQuery={ledgerTable.normalizedQuery}
            onToggleDateSelection={ledgerTable.onToggleDateSelection}
            missingSelectedDatesCount={ledgerTable.missingSelectedDatesCount}
            invalidRows={ledgerTable.invalidRows}
            safeCurrentPage={ledgerTable.safeCurrentPage}
            totalPages={ledgerTable.totalPages}
            onPrevPage={ledgerTable.onPrevPage}
            onNextPage={ledgerTable.onNextPage}
            dateFilterPresentation="popover"
            onDownloadCsv={ledgerTable.onDownloadCsv}
            onRequestDeleteColumn={ledgerTable.onRequestDeleteColumn}
            onAddRowAfter={ledgerTable.onAddRowAfter}
            onDeleteRow={ledgerTable.onDeleteRow}
            editingCell={ledgerTable.editingCell}
            onChangeEditingValue={ledgerTable.onChangeEditingValue}
            onSaveEditCell={ledgerTable.onSaveEditCell}
            onCancelEditCell={ledgerTable.onCancelEditCell}
            onStartEditCell={ledgerTable.onStartEditCell}
          />
        </div>
      )}

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Regresar
        </Button>
        <Button type="button" disabled={ledgerTable.aiRows.length === 0} onClick={onContinue}>
          Continuar a Configuración de Conciliación
        </Button>
      </div>
    </div>
  );
}
