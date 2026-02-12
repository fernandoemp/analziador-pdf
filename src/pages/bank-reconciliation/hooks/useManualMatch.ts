import { type ReconciliationMatch, type ReconciliationState } from '../types';

export const useManualMatch = ({
  reconciliation,
  setReconciliation,
  setManualBankIndex,
  setManualLedgerIndex,
  setShowManualMatch,
}: {
  reconciliation: ReconciliationState;
  setReconciliation: (value: ReconciliationState) => void;
  setManualBankIndex: (value: number | null) => void;
  setManualLedgerIndex: (value: number | null) => void;
  setShowManualMatch: (value: boolean) => void;
}) => {
  const applyManualMatch = (manualBankIndex: number | null, manualLedgerIndex: number | null) => {
    if (manualBankIndex === null || manualLedgerIndex === null) return;
    const newMatch: ReconciliationMatch = {
      id: `manual-${manualBankIndex}-${manualLedgerIndex}`,
      bankIndex: manualBankIndex,
      ledgerIndex: manualLedgerIndex,
      score: 70,
      type: 'description',
      dateDiffDays: 0,
      amountDiff: 0,
      verified: true,
    };
    setReconciliation({
      ...reconciliation,
      matches: [...reconciliation.matches, newMatch],
      onlyBank: reconciliation.onlyBank.filter(idx => idx !== manualBankIndex),
      onlyLedger: reconciliation.onlyLedger.filter(idx => idx !== manualLedgerIndex),
    });
    setManualBankIndex(null);
    setManualLedgerIndex(null);
    setShowManualMatch(false);
  };

  return { applyManualMatch };
};
