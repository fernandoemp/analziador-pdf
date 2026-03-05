import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from 'react';
import { showError } from '@/utils/toast';
import { defaultKeySelection } from '../utils/headerUtils';

export const useBankHeaderFlow = ({
  step,
  bankFile,
  selectedBank,
  saveBankConfig,
  ai,
  activePdfRole,
  setActivePdfRole,
  setStep,
  setBankHeaders,
  setBankRows,
  setFieldMapping,
}: {
  step: number;
  bankFile: File | null;
  selectedBank: string;
  saveBankConfig: boolean;
  ai: {
    headerDraft: string[] | null;
    aiAnalysisState: string;
    aiHeaders: string[];
    aiRows: string[][];
    handleAnalyzeWithAI: () => Promise<void>;
    confirmHeaderDraftAndAnalyze: () => Promise<void>;
    handleFileSelected: (file: File) => Promise<void>;
  };
  activePdfRole: 'bank' | 'ledger' | null;
  setActivePdfRole: (value: 'bank' | 'ledger' | null) => void;
  setStep: (step: number) => void;
  setBankHeaders: (headers: string[]) => void;
  setBankRows: (rows: string[][]) => void;
  setFieldMapping: Dispatch<
    SetStateAction<{
      bankDate: string;
      ledgerDate: string;
      bankAmount: string;
      ledgerAmount: string;
      bankDescription: string;
      ledgerDescription: string;
    }>
  >;
}) => {
  const selectedBankConfigKey = `bank-reconciliation:bank-config:${selectedBank}`;

  const savedBankHeaders = useMemo(() => {
    try {
      const raw = localStorage.getItem(selectedBankConfigKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed.filter((item) => typeof item === 'string');
    } catch {
      return null;
    }
  }, [selectedBankConfigKey]);

  const pendingManualDetection = useRef(false);

  useEffect(() => {
    if (step !== 2) return;
    if (!bankFile) return;
    if (activePdfRole !== 'bank') {
      setActivePdfRole('bank');
      ai.handleFileSelected(bankFile).catch(() => {});
      return;
    }
  }, [activePdfRole, ai, bankFile, setActivePdfRole, step]);

  useEffect(() => {
    if (step !== 2) return;
    if (activePdfRole !== 'bank') return;
    if (!pendingManualDetection.current) return;
    pendingManualDetection.current = false;
    ai.detectHeadersOnly().catch(() => {});
  }, [activePdfRole, ai, step]);

  useEffect(() => {
    if (step !== 3) return;
    if (activePdfRole !== 'bank') return;
    if (ai.aiHeaders.length > 0 && ai.aiRows.length > 0) {
      setBankHeaders(ai.aiHeaders);
      setBankRows(ai.aiRows);
      const defaults = defaultKeySelection(ai.aiHeaders);
      setFieldMapping(prev => ({
        ...prev,
        bankDate: prev.bankDate || defaults.dateColumn,
        bankAmount: prev.bankAmount || defaults.debitColumn,
        bankDescription: prev.bankDescription || defaults.descriptionColumn,
      }));
    }
  }, [activePdfRole, ai.aiHeaders, ai.aiRows, setBankHeaders, setBankRows, setFieldMapping, step]);

  const handleConfirmBankHeaders = async () => {
    if (saveBankConfig && ai.headerDraft) {
      try {
        localStorage.setItem(selectedBankConfigKey, JSON.stringify(ai.headerDraft));
      } catch {
        showError('No se pudo guardar la configuración en localStorage.');
      }
    }
    setStep(3);
    ai.confirmHeaderDraftAndAnalyze().catch(() => {});
  };

  const handleDetectBankHeaders = () => {
    if (!bankFile) return;
    if (activePdfRole !== 'bank') {
      pendingManualDetection.current = true;
      setActivePdfRole('bank');
      ai.handleFileSelected(bankFile).catch(() => {});
      return;
    }
    ai.detectHeadersOnly().catch(() => {});
  };

  return { savedBankHeaders, handleConfirmBankHeaders, handleDetectBankHeaders };
};
