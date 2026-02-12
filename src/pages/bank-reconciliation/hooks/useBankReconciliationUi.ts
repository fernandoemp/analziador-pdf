import { useState } from 'react';

export const useBankReconciliationUi = () => {
  const [step, setStep] = useState(1);
  const [isReconciling, setIsReconciling] = useState(false);
  const [showValidator, setShowValidator] = useState(false);
  const [showManualMatch, setShowManualMatch] = useState(false);
  const [manualBankIndex, setManualBankIndex] = useState<number | null>(null);
  const [manualLedgerIndex, setManualLedgerIndex] = useState<number | null>(null);

  return {
    step,
    setStep,
    isReconciling,
    setIsReconciling,
    showValidator,
    setShowValidator,
    showManualMatch,
    setShowManualMatch,
    manualBankIndex,
    setManualBankIndex,
    manualLedgerIndex,
    setManualLedgerIndex,
  };
};
