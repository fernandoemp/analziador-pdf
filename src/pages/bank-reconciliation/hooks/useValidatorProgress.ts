import { useEffect, useMemo, useState } from 'react';
import { getFileFingerprint, loadValidatorState, normalizeValidatorState } from '@/lib/ai-analysis-persistence/storage';

export const useValidatorProgress = ({
  bankFile,
  bankRows,
  showValidator,
  validatorTable,
}: {
  bankFile: File | null;
  bankRows: string[][];
  showValidator: boolean;
  validatorTable: { totalPages: number };
}) => {
  const [validatorProgress, setValidatorProgress] = useState<{ validated: number; total: number } | null>(null);
  const validatorFingerprint = useMemo(() => (bankFile ? getFileFingerprint(bankFile) : null), [bankFile]);

  useEffect(() => {
    if (!validatorFingerprint || bankRows.length === 0) {
      setValidatorProgress(null);
      return;
    }
    const total = Math.max(1, validatorTable.totalPages);
    const compute = () => {
      const stored = loadValidatorState(validatorFingerprint);
      if (!stored) {
        setValidatorProgress({ validated: 0, total });
        return;
      }
      const normalized = normalizeValidatorState(stored, total);
      const validated = normalized.validatedPages.reduce((acc, v) => acc + (v ? 1 : 0), 0);
      setValidatorProgress({ validated, total: normalized.totalPages });
    };
    compute();
    if (!showValidator) return;
    const intervalId = window.setInterval(compute, 500);
    return () => window.clearInterval(intervalId);
  }, [bankRows.length, showValidator, validatorFingerprint, validatorTable.totalPages]);

  return { validatorProgress, validatorFingerprint, setValidatorProgress };
};
