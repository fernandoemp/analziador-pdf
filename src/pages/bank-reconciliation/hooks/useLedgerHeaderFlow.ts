import { useEffect, useRef } from 'react';
import { settingsDb, type AiProviderId } from '@/lib/localDb';
import { showError, showSuccess } from '@/utils/toast';
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
    detectHeadersOnly: () => Promise<void>;
    effectiveModelName: string;
    selectedProvider: AiProviderId;
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

  const filterEmptyRows = (rows: string[][]) =>
    rows.filter(row => row.some(cell => String(cell ?? '').trim() !== ''));

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
    ai.detectHeadersOnly().catch(() => {});
  }, [activePdfRole, ai, ledgerFile, ledgerFormat, step]);

  useEffect(() => {
    if (step !== 5) return;
    if (ledgerFormat === 'pdf' && activePdfRole === 'ledger' && ai.aiHeaders.length > 0 && ai.aiRows.length > 0) {
      setLedgerHeaders(ai.aiHeaders);
      setLedgerRows(filterEmptyRows(ai.aiRows));
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
      setLedgerRows(filterEmptyRows(dataRows));
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Error al leer el libro contable.');
    }
  };

  const handleDetectLedgerHeadersLocal = async () => {
    if (!ledgerFile) return;
    if (ledgerFormat === 'pdf') return;
    try {
      setLedgerHeaderDraft([]);
      setLedgerPreviewRows([]);
      setLedgerHeaderRowIndex(0);
      const rows =
        rawLedgerRowsRef.current || (ledgerFormat === 'excel' ? await parseExcelRows(ledgerFile) : await parseCSVRows(ledgerFile));
      rawLedgerRowsRef.current = rows;
      if (rows.length === 0) {
        showError('No se encontraron filas en el libro contable.');
        return;
      }
      const sampleRows = rows.slice(0, 30).map((row, idx) => {
        const cells = (row || []).slice(0, 20).map(cell => String(cell ?? '').replace(/\s+/g, ' ').trim());
        return `${idx + 1}: ${cells.join(' | ')}`;
      });
      const prompt = `Analiza estas filas de un libro contable (CSV/Excel) y detecta la fila de encabezados.

Devuelve SOLO un JSON con esta estructura exacta:
{
  "headerRowIndex": 1,
  "headers": ["Col1", "Col2", "Col3"]
}

Reglas:
- "headerRowIndex" es el índice 1-based en la lista de filas.
- "headers" debe contener los textos de la fila de encabezados en el mismo orden.
- Si hay celdas vacías en el encabezado, usa "" para esa posición.
- No uses datos de transacciones como encabezados.

Filas:
${sampleRows.join('\n')}`;
      let rawText = '';
      if (ai.selectedProvider === 'gemini') {
        const geminiKey = settingsDb.getGeminiApiKey();
        if (!geminiKey) {
          showError('API Key de Gemini no configurada (Cuenta → Configuración)');
          return;
        }
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(geminiKey.trim());
        const model = genAI.getGenerativeModel({ model: ai.effectiveModelName || 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        rawText = response.text();
      } else {
        const kimiKey = settingsDb.getKimiApiKey();
        if (!kimiKey) {
          showError('API Key de Kimi no configurada (Cuenta → Configuración)');
          return;
        }
        const payload: Record<string, unknown> = {
          model: ai.effectiveModelName || 'kimi-k2-turbo-preview',
          messages: [
            {
              role: 'system',
              content: 'Eres un asistente que analiza libros contables y devuelve únicamente JSON válido.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        };
        const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${kimiKey.trim()}`,
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const text = await response.text();
          showError(`Error de Kimi (${response.status}): ${text}`);
          return;
        }
        const data = await response.json();
        rawText =
          data?.choices?.[0]?.message?.content ||
          data?.choices?.[0]?.message?.content?.[0]?.text ||
          '';
      }
      let jsonText = rawText.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```[\s\S]*?\n/, '').replace(/```/g, '').trim();
      }
      const start = jsonText.indexOf('{');
      const end = jsonText.lastIndexOf('}');
      if (start >= 0 && end > start) {
        jsonText = jsonText.slice(start, end + 1);
      }
      let parsed: { headerRowIndex?: number; headers?: string[] };
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        showError('La IA no retornó un JSON válido para los encabezados.');
        return;
      }
      const headerIndex = typeof parsed.headerRowIndex === 'number' ? parsed.headerRowIndex - 1 : -1;
      const headersFromRow =
        headerIndex >= 0 && headerIndex < rows.length
          ? rows[headerIndex].map(cell => String(cell ?? '').trim())
          : null;
      const headers = Array.isArray(parsed.headers) && parsed.headers.length > 0 ? parsed.headers : headersFromRow;
      if (!headers || headers.length === 0) {
        showError('La IA no retornó encabezados válidos.');
        return;
      }
      setLedgerHeaderDraft(headers);
      setLedgerHeaderRowIndex(headerIndex >= 0 ? headerIndex : findHeaderRowIndex(rows));
      showSuccess('Encabezados detectados. Revisa y confirma para continuar.');
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
    ai.detectHeadersOnly().catch(() => {});
  };

  return { handleConfirmLedgerHeaders, handleLoadLedgerRows, handleDetectLedgerHeaders, handleDetectLedgerHeadersLocal };
};
