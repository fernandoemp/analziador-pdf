import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AiProgressControls } from '@/components/pdf-structured-extractor/AiProgressControls';
import { AiResultsTable } from '@/components/pdf-structured-extractor/AiResultsTable';
import { type useAiPdfVerification } from '@/hooks/useAiPdfVerification';

export function Step3BankExtraction({
  ai,
  bankFile,
  onBack,
  onContinue,
}: {
  ai: ReturnType<typeof useAiPdfVerification>;
  bankFile: File | null;
  onBack: () => void;
  onContinue: () => void;
}) {
  useEffect(() => {
    if (!bankFile) return;
    if (ai.aiRows.length > 0 || ai.isAnalyzing) return;
    if (!ai.confirmedHeaders || ai.confirmedHeaders.length === 0) return;
    if (ai.aiAnalysisState === 'idle' || ai.aiAnalysisState === 'failed') {
      ai.handleAnalyzeWithAI().catch(() => {});
    }
  }, [ai, bankFile]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Extracción completa del extracto bancario</div>
          <div className="text-sm text-muted-foreground">Extrayendo datos del extracto bancario...</div>
          {bankFile && (
            <div className="mt-2">
              <Badge variant="secondary" className="text-xs">
                {bankFile.name}
              </Badge>
            </div>
          )}
        </div>
        {ai.isAnalyzing && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      </div>

      {ai.isAnalyzing && (
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

      {ai.aiHeaders.length > 0 && ai.aiRows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Vista Previa - Extracto Bancario</div>
            <div className="text-sm text-muted-foreground">{ai.aiRows.length} transacciones</div>
          </div>
          <AiResultsTable
            aiHeaders={ai.aiHeaders}
            aiRows={ai.aiRows}
            hasActiveFilters={ai.hasActiveFilters}
            isFilterPending={ai.isFilterPending}
            visibleRowIndices={ai.visibleRowIndices}
            descriptionFilter={ai.descriptionFilter}
            descriptionColIndex={ai.descriptionColIndex}
            onChangeDescriptionFilter={ai.handleDescriptionFilterChange}
            onClearFilters={ai.clearFilters}
            dateColIndex={ai.dateColIndex}
            dateOptions={ai.dateOptions}
            selectedDatesSet={ai.selectedDatesSet}
            normalizedQuery={ai.normalizedQuery}
            onToggleDateSelection={ai.toggleDateSelection}
            missingSelectedDatesCount={ai.missingSelectedDatesCount}
            invalidRows={ai.invalidRows}
            safeCurrentPage={ai.safeCurrentPage}
            totalPages={ai.totalPages}
            onPrevPage={() => ai.setCurrentPage(ai.safeCurrentPage - 1)}
            onNextPage={() => ai.setCurrentPage(ai.safeCurrentPage + 1)}
            dateFilterPresentation="popover"
            onDownloadCsv={ai.handleDownloadAiCSV}
            onRequestDeleteColumn={ai.requestDeleteColumn}
            onAddRowAfter={ai.addRowAfter}
            onDeleteRow={ai.deleteRow}
            editingCell={ai.editingCell}
            onChangeEditingValue={ai.handleChangeEditingValue}
            onSaveEditCell={ai.saveEditCell}
            onCancelEditCell={ai.cancelEditCell}
            onStartEditCell={ai.startEditCell}
          />
        </div>
      )}

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Regresar
        </Button>
        <Button type="button" disabled={ai.aiAnalysisState !== 'completed' || ai.aiRows.length === 0} onClick={onContinue}>
          Continuar con Libro Contable
        </Button>
      </div>
    </div>
  );
}
