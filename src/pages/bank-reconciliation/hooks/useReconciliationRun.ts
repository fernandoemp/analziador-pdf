import { showError } from '@/utils/toast';
import { buildReconciliationState } from '../utils/reconciliationEngine';
import { type FieldMapping, type ReconciliationState } from '../types';

export const useReconciliationRun = ({
  bankHeaders,
  bankRows,
  ledgerHeaders,
  ledgerRows,
  fieldMapping,
  toleranceDays,
  toleranceAmountPercent,
  useDescription,
  descriptionThreshold,
  setReconciliation,
  setIsReconciling,
  setStep,
}: {
  bankHeaders: string[];
  bankRows: string[][];
  ledgerHeaders: string[];
  ledgerRows: string[][];
  fieldMapping: FieldMapping;
  toleranceDays: number;
  toleranceAmountPercent: number;
  useDescription: boolean;
  descriptionThreshold: number;
  setReconciliation: (value: ReconciliationState) => void;
  setIsReconciling: (value: boolean) => void;
  setStep: (step: number) => void;
}) => {
  const handleExecuteReconciliation = async () => {
    if (bankRows.length === 0 || ledgerRows.length === 0) {
      showError('Necesitas cargar ambos conjuntos de datos.');
      return;
    }
    setIsReconciling(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    const nextState = buildReconciliationState({
      bankHeaders,
      bankRows,
      ledgerHeaders,
      ledgerRows,
      fieldMapping,
      toleranceDays,
      toleranceAmountPercent,
      useDescription,
      descriptionThreshold,
    });
    setReconciliation(nextState);
    setIsReconciling(false);
    setStep(7);
  };

  return { handleExecuteReconciliation };
};
