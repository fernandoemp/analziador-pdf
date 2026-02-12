import { PdfValidatorDialog } from '@/components/pdf-structured-extractor/ComparePdfAiDialog';
import { type FileFingerprint } from '@/lib/ai-analysis-persistence/storage';
import { useSimpleTable } from '../hooks/useSimpleTable';

export function ValidatorDialog({
  open,
  onOpenChange,
  pdfUrl,
  fileFingerprint,
  validatorTable,
  pdfScrollRef,
  aiScrollRef,
  onPdfScroll,
  onSetCurrentPage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfUrl: string | null;
  fileFingerprint: FileFingerprint | null;
  validatorTable: ReturnType<typeof useSimpleTable>;
  pdfScrollRef: React.RefObject<HTMLDivElement>;
  aiScrollRef: React.RefObject<HTMLDivElement>;
  onPdfScroll: () => void;
  onSetCurrentPage: (page: number) => void;
}) {
  return (
    <PdfValidatorDialog
      open={open}
      onOpenChange={onOpenChange}
      pdfUrl={pdfUrl}
      fileFingerprint={fileFingerprint ?? undefined}
      aiTableProps={{
        aiHeaders: validatorTable.aiHeaders,
        aiRows: validatorTable.aiRows,
        hasActiveFilters: false,
        isFilterPending: false,
        visibleRowIndices: validatorTable.visibleRowIndices,
        descriptionFilter: '',
        descriptionColIndex: null,
        onChangeDescriptionFilter: () => {},
        onClearFilters: () => {},
        dateColIndex: null,
        dateOptions: [],
        selectedDatesSet: new Set(),
        normalizedQuery: '',
        onToggleDateSelection: () => {},
        missingSelectedDatesCount: 0,
        invalidRows: [],
        safeCurrentPage: validatorTable.safeCurrentPage,
        totalPages: validatorTable.totalPages,
        onPrevPage: validatorTable.onPrevPage,
        onNextPage: validatorTable.onNextPage,
        dateFilterPresentation: 'inline',
        onDownloadCsv: () => {},
        onRequestDeleteColumn: () => {},
        onAddRowAfter: () => {},
        onDeleteRow: () => {},
        editingCell: null,
        onChangeEditingValue: () => {},
        onSaveEditCell: () => {},
        onCancelEditCell: () => {},
        onStartEditCell: () => {},
        showPagination: true,
        showDescriptionFilter: false,
        showCsvExport: false,
      }}
      onSetCurrentPage={onSetCurrentPage}
      pdfScrollRef={pdfScrollRef}
      aiScrollRef={aiScrollRef}
      onPdfScroll={onPdfScroll}
    />
  );
}
