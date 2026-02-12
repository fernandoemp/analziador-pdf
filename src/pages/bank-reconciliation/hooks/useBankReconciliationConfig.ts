import { useState } from 'react';
import { BANK_OPTIONS, type MatchMode } from '../types';

export const useBankReconciliationConfig = () => {
  const [selectedBank, setSelectedBank] = useState<(typeof BANK_OPTIONS)[number]>('Banco Macro');
  const [saveBankConfig, setSaveBankConfig] = useState(false);
  const [matchMode, setMatchMode] = useState<MatchMode>('missing_in_ledger');
  const [toleranceDays, setToleranceDays] = useState(2);
  const [toleranceAmountPercent, setToleranceAmountPercent] = useState(0.5);
  const [useDescription, setUseDescription] = useState(false);
  const [descriptionThreshold, setDescriptionThreshold] = useState(80);

  return {
    selectedBank,
    setSelectedBank,
    saveBankConfig,
    setSaveBankConfig,
    matchMode,
    setMatchMode,
    toleranceDays,
    setToleranceDays,
    toleranceAmountPercent,
    setToleranceAmountPercent,
    useDescription,
    setUseDescription,
    descriptionThreshold,
    setDescriptionThreshold,
  };
};
