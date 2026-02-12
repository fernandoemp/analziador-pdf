import { exportReconciliationExcel } from '../utils/exportExcel';
import { exportReconciliationPdf } from '../utils/exportPdf';
import { type FieldMapping, type MatchMode, type ReconciliationState, type ReconciliationStats } from '../types';

export const useReconciliationExports = ({
  stats,
  matchMode,
  toleranceDays,
  toleranceAmountPercent,
  useDescription,
  descriptionThreshold,
  reconciliation,
  bankHeaders,
  bankRows,
  ledgerHeaders,
  ledgerRows,
  fieldMapping,
  selectedBank,
}: {
  stats: ReconciliationStats;
  matchMode: MatchMode;
  toleranceDays: number;
  toleranceAmountPercent: number;
  useDescription: boolean;
  descriptionThreshold: number;
  reconciliation: ReconciliationState;
  bankHeaders: string[];
  bankRows: string[][];
  ledgerHeaders: string[];
  ledgerRows: string[][];
  fieldMapping: FieldMapping;
  selectedBank: string;
}) => {
  const handleExportExcel = () => {
    exportReconciliationExcel({
      stats,
      matchMode,
      toleranceDays,
      toleranceAmountPercent,
      useDescription,
      descriptionThreshold,
      reconciliation,
      bankHeaders,
      bankRows,
      ledgerHeaders,
      ledgerRows,
      fieldMapping,
      selectedBank,
    });
  };

  const handleExportPdf = () => {
    exportReconciliationPdf({
      stats,
      reconciliation,
      bankHeaders,
      bankRows,
      ledgerHeaders,
      ledgerRows,
      fieldMapping,
      selectedBank,
    });
  };

  return { handleExportExcel, handleExportPdf };
};
