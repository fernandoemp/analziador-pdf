import { useMemo } from 'react';
import { type ReconciliationState, type ReconciliationStats } from '../types';

export const useReconciliationStats = ({
  bankRows,
  ledgerRows,
  reconciliation,
}: {
  bankRows: string[][];
  ledgerRows: string[][];
  reconciliation: ReconciliationState;
}) => {
  const stats = useMemo<ReconciliationStats>(() => {
    const totalBank = bankRows.length;
    const totalLedger = ledgerRows.length;
    const matchCount = reconciliation.matches.length;
    const discrepancyCount = reconciliation.discrepancies.length;
    const unmatchedBank = reconciliation.onlyBank.length;
    const unmatchedLedger = reconciliation.onlyLedger.length;
    const rate = totalBank === 0 ? 0 : Math.round((matchCount / totalBank) * 100);
    return {
      totalBank,
      totalLedger,
      matchCount,
      discrepancyCount,
      unmatchedBank,
      unmatchedLedger,
      rate,
    };
  }, [bankRows.length, ledgerRows.length, reconciliation]);

  return { stats };
};
