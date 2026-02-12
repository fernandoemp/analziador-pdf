import { useState } from 'react';

export const useBankReconciliationUi = () => {
  const [step, setStep] = useState(1);
  const [isReconciling, setIsReconciling] = useState(false);

  return {
    step,
    setStep,
    isReconciling,
    setIsReconciling,
  };
};
