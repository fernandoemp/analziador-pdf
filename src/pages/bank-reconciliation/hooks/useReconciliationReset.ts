import { type FieldMapping, type ReconciliationState } from '../types';

export const useReconciliationReset = ({
  setStep,
  setBankFile,
  setLedgerFile,
  setBankHeaders,
  setBankRows,
  setLedgerHeaders,
  setLedgerRows,
  setLedgerHeaderDraft,
  setLedgerPreviewRows,
  setLedgerSampleRows,
  setLedgerHeaderRowIndex,
  setFieldMapping,
  setReconciliation,
  setActivePdfRole,
  bankPdfUrl,
  ledgerPdfUrl,
  setBankPdfUrl,
  setLedgerPdfUrl,
}: {
  setStep: (step: number) => void;
  setBankFile: (file: File | null) => void;
  setLedgerFile: (file: File | null) => void;
  setBankHeaders: (headers: string[]) => void;
  setBankRows: (rows: string[][]) => void;
  setLedgerHeaders: (headers: string[]) => void;
  setLedgerRows: (rows: string[][]) => void;
  setLedgerHeaderDraft: (headers: string[]) => void;
  setLedgerPreviewRows: (rows: string[][]) => void;
  setLedgerSampleRows: (rows: string[][]) => void;
  setLedgerHeaderRowIndex: (index: number) => void;
  setFieldMapping: (value: FieldMapping) => void;
  setReconciliation: (value: ReconciliationState) => void;
  setActivePdfRole: (value: 'bank' | 'ledger' | null) => void;
  bankPdfUrl: string | null;
  ledgerPdfUrl: string | null;
  setBankPdfUrl: (value: string | null) => void;
  setLedgerPdfUrl: (value: string | null) => void;
}) => {
  const handleReset = () => {
    setStep(1);
    setBankFile(null);
    setLedgerFile(null);
    setBankHeaders([]);
    setBankRows([]);
    setLedgerHeaders([]);
    setLedgerRows([]);
    setLedgerHeaderDraft([]);
    setLedgerPreviewRows([]);
    setLedgerSampleRows([]);
    setLedgerHeaderRowIndex(0);
    setFieldMapping({
      bankDate: '',
      ledgerDate: '',
      bankAmount: '',
      ledgerAmount: '',
      bankCredit: '',
      ledgerCredit: '',
      bankDescription: '',
      ledgerDescription: '',
    });
    setReconciliation({ matches: [], discrepancies: [], onlyBank: [], onlyLedger: [] });
    setActivePdfRole(null);
    if (bankPdfUrl) URL.revokeObjectURL(bankPdfUrl);
    if (ledgerPdfUrl) URL.revokeObjectURL(ledgerPdfUrl);
    setBankPdfUrl(null);
    setLedgerPdfUrl(null);
  };

  return { handleReset };
};
