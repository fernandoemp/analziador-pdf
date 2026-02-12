import { useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAiPdfVerification } from '@/hooks/useAiPdfVerification';
import { detectLedgerFormat, type LedgerFormat } from '../utils/fileParsers';

export const useBankReconciliationFiles = () => {
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [ledgerFile, setLedgerFile] = useState<File | null>(null);
  const [bankPdfUrl, setBankPdfUrl] = useState<string | null>(null);
  const [ledgerPdfUrl, setLedgerPdfUrl] = useState<string | null>(null);
  const [activePdfRole, setActivePdfRole] = useState<'bank' | 'ledger' | null>(null);

  const ai = useAiPdfVerification({
    selectedFile: activePdfRole === 'bank' ? bankFile : activePdfRole === 'ledger' ? ledgerFile : null,
    localHeaders: [],
    localRows: [],
  });

  const ledgerFormat: LedgerFormat = detectLedgerFormat(ledgerFile);

  const bankDropzone = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    onDrop: (files) => {
      const file = files[0];
      if (!file) return;
      if (bankPdfUrl) URL.revokeObjectURL(bankPdfUrl);
      setBankFile(file);
      setBankPdfUrl(URL.createObjectURL(file));
      setActivePdfRole('bank');
      ai.handleFileSelected(file).catch(() => {});
    },
  });

  const ledgerDropzone = useDropzone({
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/pdf': ['.pdf'],
    },
    multiple: false,
    onDrop: (files) => {
      const file = files[0];
      if (!file) return;
      if (ledgerPdfUrl) URL.revokeObjectURL(ledgerPdfUrl);
      setLedgerFile(file);
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        setLedgerPdfUrl(URL.createObjectURL(file));
        setActivePdfRole('ledger');
      } else {
        setLedgerPdfUrl(null);
        setActivePdfRole(null);
      }
    },
  });

  useEffect(() => {
    return () => {
      if (bankPdfUrl) URL.revokeObjectURL(bankPdfUrl);
      if (ledgerPdfUrl) URL.revokeObjectURL(ledgerPdfUrl);
    };
  }, [bankPdfUrl, ledgerPdfUrl]);

  return {
    bankFile,
    setBankFile,
    ledgerFile,
    setLedgerFile,
    bankPdfUrl,
    setBankPdfUrl,
    ledgerPdfUrl,
    setLedgerPdfUrl,
    activePdfRole,
    setActivePdfRole,
    ai,
    ledgerFormat,
    bankDropzone,
    ledgerDropzone,
  };
};
