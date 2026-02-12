import { useEffect, useRef } from 'react';
import { showError } from '@/utils/toast';
import { findHeaderRowIndex } from '../utils/headerUtils';
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
  setLedgerSampleRows,
  ledgerHeaderRowIndex,
  setLedgerHeaderRowIndex,
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
  setLedgerSampleRows: (rows: string[][]) => void;
  ledgerHeaderRowIndex: number;
  setLedgerHeaderRowIndex: (index: number) => void;
  setLedgerHeaders: (headers: string[]) => void;
  setLedgerRows: (rows: string[][]) => void;
  setStep: (step: number) => void;
}) => {
  const pendingManualDetection = useRef(false);
  const lastLedgerFingerprint = useRef<string | null>(null);
  const rawLedgerRowsRef = useRef<string[][] | null>(null);
  const prevStepRef = useRef<number>(step);

  useEffect(() => {
    const prev = prevStepRef.current;
    prevStepRef.current = step;
    if (step !== 4) return;
    if (prev === 3 && ledgerFormat !== 'pdf') {
      setLedgerHeaderDraft([]);
      setLedgerPreviewRows([]);
    }
  }, [ledgerFormat, setLedgerHeaderDraft, setLedgerPreviewRows, step]);

  useEffect(() => {
    lastLedgerFingerprint.current = null;
    rawLedgerRowsRef.current = null;
    if (ledgerFormat !== 'pdf') {
      setLedgerSampleRows([]);
      setLedgerHeaderRowIndex(0);
      setLedgerPreviewRows([]);
      setLedgerHeaderDraft([]);
    }
  }, [
    ledgerFile,
    ledgerFormat,
    setLedgerHeaderDraft,
    setLedgerHeaderRowIndex,
    setLedgerPreviewRows,
    setLedgerSampleRows,
  ]);

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
        rawLedgerRowsRef.current = rows;
        const sample = rows.slice(0, 30);
        setLedgerSampleRows(sample);
        setLedgerHeaderRowIndex(findHeaderRowIndex(sample));
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
    setLedgerHeaderRowIndex,
    setLedgerPreviewRows,
    setLedgerSampleRows,
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
    }
  }, [activePdfRole, ai.aiHeaders, ai.aiRows, ledgerFormat, setLedgerHeaders, setLedgerRows, step]);

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
      const headerIndex = ledgerHeaderDraft.length > 0 ? ledgerHeaderRowIndex : findHeaderRowIndex(rows);
      const headers = ledgerHeaderDraft.length > 0 ? ledgerHeaderDraft : rows[headerIndex].map(cell => String(cell ?? '').trim());
      const dataRows = rows.slice(headerIndex + 1).map(row => headers.map((_, idx) => String(row[idx] ?? '')));
      setLedgerHeaders(headers);
      setLedgerRows(dataRows);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Error al leer el libro contable.');
    }
  };

  const handleDetectLedgerHeadersLocal = async () => {
    if (!ledgerFile) return;
    if (ledgerFormat === 'pdf') return;
    try {
      const rows =
        rawLedgerRowsRef.current || (ledgerFormat === 'excel' ? await parseExcelRows(ledgerFile) : await parseCSVRows(ledgerFile));
      rawLedgerRowsRef.current = rows;
      if (rows.length === 0) {
        showError('No se encontraron filas en el libro contable.');
        return;
      }
      const maxRows = Math.min(rows.length, 25);
      let headerIndex = -1;
      let bestScore = -Infinity;
      for (let i = 0; i < maxRows; i++) {
        const row = rows[i] || [];
        const trimmed = row.map(cell => String(cell ?? '').trim());
        const textCount = trimmed.filter(cell => cell && isNaN(Number(cell.replace(/[^\d.-]/g, '')))).length;
        const numericCount = trimmed.filter(cell => cell && !isNaN(Number(cell.replace(/[^\d.-]/g, '')))).length;
        const score = textCount * 2 - numericCount;
        if (textCount >= 2 && score > bestScore) {
          bestScore = score;
          headerIndex = i;
        }
      }
      if (headerIndex === -1) {
        headerIndex = findHeaderRowIndex(rows);
      }
      const headers = rows[headerIndex].map(cell => String(cell ?? '').trim());
      const dataRows = rows.slice(headerIndex + 1);
      setLedgerHeaderDraft(headers);
      setLedgerPreviewRows(dataRows.slice(0, 5));
      setLedgerHeaderRowIndex(headerIndex);
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

  return { handleConfirmLedgerHeaders, handleLoadLedgerRows, handleDetectLedgerHeaders, handleDetectLedgerHeadersLocal };
};
