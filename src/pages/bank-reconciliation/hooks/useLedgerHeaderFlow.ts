import { useEffect, useRef } from 'react';
import { showError } from '@/utils/toast';
import { defaultKeySelection, findHeaderRowIndex } from '../utils/headerUtils';
import { parseCSVRows, parseExcelRows, type LedgerFormat } from '../utils/fileParsers';

export const useLedgerHeaderFlow = ({
  step,
  ledgerFile,
  ledgerFormat,
  ai,
  activePdfRole,
  setActivePdfRole,
  ledgerHeaderDraft,
  setLedgerHeaderDraft,
  setLedgerPreviewRows,
  ledgerKeyFields,
  setLedgerKeyFields,
  setLedgerHeaders,
  setLedgerRows,
  setStep,
}: {
  step: number;
  ledgerFile: File | null;
  ledgerFormat: LedgerFormat;
  ai: {
    aiAnalysisState: string;
    aiHeaders: string[];
    aiRows: string[][];
    handleAnalyzeWithAI: () => Promise<void>;
    handleFileSelected: (file: File) => Promise<void>;
    confirmHeaderDraftAndAnalyze: () => Promise<void>;
  };
  activePdfRole: 'bank' | 'ledger' | null;
  setActivePdfRole: (value: 'bank' | 'ledger' | null) => void;
  ledgerHeaderDraft: string[];
  setLedgerHeaderDraft: (headers: string[]) => void;
  setLedgerPreviewRows: (rows: string[][]) => void;
  ledgerKeyFields: { dateColumn: string; debitColumn: string; creditColumn: string; descriptionColumn: string };
  setLedgerKeyFields: (value: { dateColumn: string; debitColumn: string; creditColumn: string; descriptionColumn: string }) => void;
  setLedgerHeaders: (headers: string[]) => void;
  setLedgerRows: (rows: string[][]) => void;
  setStep: (step: number) => void;
}) => {
  const pendingManualDetection = useRef(false);
  const lastLedgerFingerprint = useRef<string | null>(null);

  useEffect(() => {
    lastLedgerFingerprint.current = null;
  }, [ledgerFile, ledgerFormat]);

  useEffect(() => {
    if (step !== 4) return;
    if (!ledgerFile) return;
    if (ledgerFormat === 'pdf') {
      const fingerprint = `${ledgerFile.name}-${ledgerFile.size}-${ledgerFile.lastModified}-${ledgerFile.type}`;
      if (activePdfRole !== 'ledger') {
        setActivePdfRole('ledger');
        ai.handleFileSelected(ledgerFile).catch(() => {});
        lastLedgerFingerprint.current = fingerprint;
        return;
      }
      if (lastLedgerFingerprint.current !== fingerprint) {
        lastLedgerFingerprint.current = fingerprint;
        ai.handleFileSelected(ledgerFile).catch(() => {});
      }
      return;
    }
    const run = async () => {
      try {
        const rows = ledgerFormat === 'excel' ? await parseExcelRows(ledgerFile) : await parseCSVRows(ledgerFile);
        if (rows.length === 0) {
          showError('No se encontraron filas en el libro contable.');
          return;
        }
        const headerIndex = findHeaderRowIndex(rows);
        const headers = rows[headerIndex].map(cell => String(cell ?? '').trim());
        const dataRows = rows.slice(headerIndex + 1);
        setLedgerHeaderDraft(headers);
        setLedgerPreviewRows(dataRows.slice(0, 5));
        setLedgerKeyFields(defaultKeySelection(headers));
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Error al leer el libro contable.');
      }
    };
    run();
  }, [
    activePdfRole,
    ai,
    ledgerFile,
    ledgerFormat,
    setActivePdfRole,
    setLedgerHeaderDraft,
    setLedgerKeyFields,
    setLedgerPreviewRows,
    step,
  ]);

  useEffect(() => {
    if (step !== 4) return;
    if (ledgerFormat !== 'pdf') return;
    if (!ledgerFile) return;
    if (activePdfRole !== 'ledger') return;
    if (!pendingManualDetection.current) return;
    pendingManualDetection.current = false;
    ai.handleAnalyzeWithAI().catch(() => {});
  }, [activePdfRole, ai, ledgerFile, ledgerFormat, step]);

  useEffect(() => {
    if (step !== 5) return;
    if (ledgerFormat === 'pdf' && activePdfRole === 'ledger' && ai.aiHeaders.length > 0 && ai.aiRows.length > 0) {
      setLedgerHeaders(ai.aiHeaders);
      setLedgerRows(ai.aiRows);
      const defaults = defaultKeySelection(ai.aiHeaders);
      setLedgerKeyFields({
        dateColumn: ledgerKeyFields.dateColumn || defaults.dateColumn,
        debitColumn: ledgerKeyFields.debitColumn || defaults.debitColumn,
        creditColumn: ledgerKeyFields.creditColumn || defaults.creditColumn,
        descriptionColumn: ledgerKeyFields.descriptionColumn || defaults.descriptionColumn,
      });
    }
  }, [
    activePdfRole,
    ai.aiHeaders,
    ai.aiRows,
    ledgerFormat,
    ledgerKeyFields,
    setLedgerHeaders,
    setLedgerKeyFields,
    setLedgerRows,
    step,
  ]);

  const handleConfirmLedgerHeaders = async () => {
    if (ledgerFormat === 'pdf') {
      setStep(5);
      ai.confirmHeaderDraftAndAnalyze().catch(() => {});
      return;
    }
    const cleaned = ledgerHeaderDraft.map(h => h.trim()).filter(Boolean);
    setLedgerHeaders(cleaned);
    setStep(5);
  };

  const handleLoadLedgerRows = async () => {
    if (!ledgerFile) return;
    try {
      const rows = ledgerFormat === 'excel' ? await parseExcelRows(ledgerFile) : await parseCSVRows(ledgerFile);
      if (rows.length === 0) {
        showError('No se encontraron filas en el libro contable.');
        return;
      }
      const headerIndex = findHeaderRowIndex(rows);
      const headers = ledgerHeaderDraft.length > 0 ? ledgerHeaderDraft : rows[headerIndex].map(cell => String(cell ?? '').trim());
      const dataRows = rows.slice(headerIndex + 1).map(row => headers.map((_, idx) => String(row[idx] ?? '')));
      setLedgerHeaders(headers);
      setLedgerRows(dataRows);
      setLedgerKeyFields(defaultKeySelection(headers));
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Error al leer el libro contable.');
    }
  };

  const handleDetectLedgerHeaders = () => {
    if (!ledgerFile) return;
    if (ledgerFormat !== 'pdf') return;
    if (activePdfRole !== 'ledger') {
      pendingManualDetection.current = true;
      setActivePdfRole('ledger');
      ai.handleFileSelected(ledgerFile).catch(() => {});
      lastLedgerFingerprint.current = `${ledgerFile.name}-${ledgerFile.size}-${ledgerFile.lastModified}-${ledgerFile.type}`;
      return;
    }
    ai.handleAnalyzeWithAI().catch(() => {});
  };

  return { handleConfirmLedgerHeaders, handleLoadLedgerRows, handleDetectLedgerHeaders };
};
