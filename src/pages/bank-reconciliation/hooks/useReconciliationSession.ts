import { showError, showSuccess } from '@/utils/toast';
import { type FieldMapping, type ReconciliationState, type ReconciliationStats } from '../types';

export const useReconciliationSession = ({
  bankHeaders,
  bankRows,
  ledgerHeaders,
  ledgerRows,
  fieldMapping,
  reconciliation,
  stats,
}: {
  bankHeaders: string[];
  bankRows: string[][];
  ledgerHeaders: string[];
  ledgerRows: string[][];
  fieldMapping: FieldMapping;
  reconciliation: ReconciliationState;
  stats: ReconciliationStats;
}) => {
  const handleSaveSession = () => {
    try {
      const payload = {
        bankHeaders,
        bankRows,
        ledgerHeaders,
        ledgerRows,
        fieldMapping,
        reconciliation,
        stats,
        updatedAt: Date.now(),
      };
      localStorage.setItem('bank-reconciliation:session', JSON.stringify(payload));
      showSuccess('Sesión guardada.');
    } catch {
      showError('No se pudo guardar la sesión.');
    }
  };

  return { handleSaveSession };
};
