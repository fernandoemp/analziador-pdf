import { ReconciliationActions } from './ReconciliationActions';
import { ReconciliationStats } from './ReconciliationStats';
import { ReconciliationTabs } from './ReconciliationTabs';
import { type FieldMapping, type ReconciliationState, type ReconciliationStats as ReconciliationStatsType } from '../types';

export function Step7ReconciliationResults({
  reconciliation,
  stats,
  isReconciling,
  bankHeaders,
  ledgerHeaders,
  bankRows,
  ledgerRows,
  fieldMapping,
  onToggleMatchVerified,
  onAcceptDiscrepancy,
  onSaveSession,
  onShowValidator,
  canShowValidator,
  onShowManualMatch,
  onExportExcel,
  onExportPdf,
  onReset,
  validatorProgress,
}: {
  reconciliation: ReconciliationState;
  stats: ReconciliationStatsType;
  isReconciling: boolean;
  bankHeaders: string[];
  ledgerHeaders: string[];
  bankRows: string[][];
  ledgerRows: string[][];
  fieldMapping: FieldMapping;
  onToggleMatchVerified: (matchId: string, checked: boolean) => void;
  onAcceptDiscrepancy: (matchId: string) => void;
  onSaveSession: () => void;
  onShowValidator: () => void;
  canShowValidator: boolean;
  onShowManualMatch: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onReset: () => void;
  validatorProgress: { validated: number; total: number } | null;
}) {
  return (
    <div className="space-y-6">
      <ReconciliationStats stats={stats} isReconciling={isReconciling} />
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <ReconciliationTabs
            reconciliation={reconciliation}
            bankHeaders={bankHeaders}
            ledgerHeaders={ledgerHeaders}
            bankRows={bankRows}
            ledgerRows={ledgerRows}
            fieldMapping={fieldMapping}
            onToggleMatchVerified={onToggleMatchVerified}
            onAcceptDiscrepancy={onAcceptDiscrepancy}
          />
        </div>
        <div className="space-y-4">
          <ReconciliationActions
            onSaveSession={onSaveSession}
            onShowValidator={onShowValidator}
            canShowValidator={canShowValidator}
            onShowManualMatch={onShowManualMatch}
            onExportExcel={onExportExcel}
            onExportPdf={onExportPdf}
            onReset={onReset}
            validatorProgress={validatorProgress}
          />
        </div>
      </div>
    </div>
  );
}
