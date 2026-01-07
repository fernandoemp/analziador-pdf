import React, { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileType, Plus, Trash2, Pencil, AlertTriangle } from 'lucide-react';
import { settingsDb, type AiModelConfig, type AiProviderId, type AiExtractionLog } from '@/lib/localDb';
import {
  analyzePDFWithGemini,
  analyzePDFWithKimi,
  detectPdfHeadersWithGemini,
  detectPdfHeadersWithKimi,
} from '@/lib/pdfToExcelAI';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';

type TextItem = { str: string; x: number; y: number; };

const loadPdfJs = async () => {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  return pdfjsLib;
};

const groupRows = (items: TextItem[]) => {
  const rows: TextItem[][] = [];
  const tol = 5;
  for (const it of items) {
    let row = rows.find(r => Math.abs(r[0].y - it.y) <= tol);
    if (!row) {
      row = [];
      rows.push(row);
    }
    row.push(it);
  }
  rows.forEach(r => r.sort((a, b) => a.x - b.x));
  rows.sort((a, b) => b[0].y - a[0].y);
  return rows;
};

const normalizeHeaderText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const detectAmountColumnsFromHeaders = (headers: string[]) => {
  let creditIndex = -1;
  let debitIndex = -1;

  headers.forEach((h, i) => {
    const n = normalizeHeaderText(h);
    if (n.includes('credito') || n.includes('haber') || n.includes('abono')) {
      if (creditIndex === -1) creditIndex = i;
    }
    if (n.includes('debito') || n.includes('debe') || n.includes('cargo')) {
      if (debitIndex === -1) debitIndex = i;
    }
  });

  if (creditIndex === -1 || debitIndex === -1) return null;
  return { creditIndex, debitIndex };
};

const computeInvalidAmountRows = (headers: string[], rows: string[][]) => {
  const cols = detectAmountColumnsFromHeaders(headers);
  if (!cols) return [];
  const { creditIndex, debitIndex } = cols;
  const invalid: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const creditValue = (row[creditIndex] || '').toString().trim();
    const debitValue = (row[debitIndex] || '').toString().trim();
    const bothFilled = creditValue !== '' && debitValue !== '';
    const bothEmpty = creditValue === '' && debitValue === '';
    if (bothFilled || bothEmpty) {
      invalid.push(i);
    }
  }
  return invalid;
};

const detectHeaderIndex = (rows: TextItem[][]) => {
  const keywords = ['fecha', 'date', 'concepto', 'descripcion', 'monto', 'amount', 'credito', 'debito', 'saldo', 'balance'];
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const line = rows[i].map(it => it.str).join(' ').toLowerCase();
    const matches = keywords.filter(k => line.includes(k)).length;
    if (matches >= 2) return i;
  }
  return -1;
};

const buildXBins = (rows: TextItem[][]) => {
  const bins: number[] = [];
  const tol = 10;
  for (const row of rows) {
    for (const it of row) {
      const idx = bins.findIndex(x => Math.abs(x - it.x) <= tol);
      if (idx === -1) bins.push(it.x);
    }
  }
  bins.sort((a, b) => a - b);
  return bins;
};

const dateRegex = /^(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{2,4})$/;
const looksLikeAmount = (s: string) => /^[\-\+]?(\d{1,3}(\.\d{3})*|\d+)(,\d{2})?$/.test(s) || /^[\-\+]?(\d{1,3}(,\d{3})*|\d+)(\.\d{2})?$/.test(s);

const nearestBinIndex = (x: number, xbins: number[]) => {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < xbins.length; i++) {
    const d = Math.abs(xbins[i] - x);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
};

const clusterRowByX = (row: TextItem[], tol: number) => {
  const sorted = [...row].sort((a, b) => a.x - b.x);
  const groups: TextItem[][] = [];
  for (const it of sorted) {
    const g = groups[groups.length - 1];
    if (!g) {
      groups.push([it]);
      continue;
    }
    const gx = g.reduce((s, v) => s + v.x, 0) / g.length;
    if (Math.abs(gx - it.x) <= tol) {
      g.push(it);
    } else {
      groups.push([it]);
    }
  }
  return groups;
};

const normalizeHeaderName = (name: string) => {
  const n = name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const pairs: [string[], string][] = [
    [['fecha','dia','date'], 'Fecha'],
    [['descripcion','concepto','movimiento','detalle','desc'], 'Descripción'],
    [['origen','origin'], 'Origen'],
    [['credito','cr','haber','abono'], 'Crédito'],
    [['debito','de','cargo','debe'], 'Débito'],
    [['saldo','balance'], 'Saldo'],
  ];
  for (const [keys, canon] of pairs) {
    if (keys.some(k => n.includes(k))) return canon;
  }
  return '';
};

const labelsAndPositionsFromHeaderRow = (row: TextItem[]) => {
  const groups = clusterRowByX(row, 20);
  const raw = groups.map(g => ({ 
    label: g.map(t => t.str).join(' ').trim(), 
    pos: Math.round(g.reduce((s, v) => s + v.x, 0) / g.length)
  }));
  const filtered = raw
    .map(r => ({ label: normalizeHeaderName(r.label), pos: r.pos }))
    .filter(r => r.label && r.label !== '-' && r.label !== '—');
  const unique: { label: string; pos: number }[] = [];
  const seen = new Set<string>();
  for (const r of filtered) {
    if (!seen.has(r.label)) {
      unique.push(r);
      seen.add(r.label);
    }
  }
  const labels = unique.map(u => u.label);
  const positions = unique.map(u => u.pos);
  return { labels, positions };
};

const nearestHeaderIndex = (x: number, headerPositions: number[]) => {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < headerPositions.length; i++) {
    const d = Math.abs(headerPositions[i] - x);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
};

const buildBinToHeaderMap = (xbins: number[], headerPositions: number[], headerCount: number) => {
  const map: number[] = [];
  for (let i = 0; i < xbins.length; i++) {
    if (headerPositions.length > 0) {
      let bestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let j = 0; j < headerPositions.length; j++) {
        const d = Math.abs(headerPositions[j] - xbins[i]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = j;
        }
      }
      map.push(bestIdx);
    } else {
      const idx = Math.min(i, headerCount - 1);
      map.push(idx);
    }
  }
  return map;
};

const foldByDate = (
  grouped: TextItem[][],
  xbins: number[],
  headers: string[],
  binToHeaderMap?: number[],
  headerPositions?: number[]
) => {
  const lowerHeaders = headers.map(h => h.toLowerCase());
  let dateIndex = lowerHeaders.findIndex(h => h.includes('fecha') || h.includes('date'));
  if (dateIndex === -1) dateIndex = 0;
  let descIndex = lowerHeaders.findIndex(h => h.includes('desc') || h.includes('concepto') || h.includes('descripcion'));
  if (descIndex === -1) descIndex = Math.min(1, headers.length - 1);
  const creditIndex = lowerHeaders.findIndex(h => h.includes('cr'));
  const debitIndex = lowerHeaders.findIndex(h => h.includes('de'));
  const saldoIndex = lowerHeaders.findIndex(h => h.includes('sal'));
  const originIndex = lowerHeaders.findIndex(h => h.includes('orig'));

  const out: string[][] = [];
  let current: string[] | null = null;
  const isNoiseToken = (s: string) => {
    const t = s.trim();
    if (!t) return true;
    if (t === '-' || t === '—') return true;
    if (/^[\.\,]$/.test(t)) return true;
    return false;
  };

  for (const row of grouped) {
    const rowText = row.map(it => it.str).join(' ').trim();
    let tokenDate = '';
    for (const it of row) {
      if (dateRegex.test(it.str.trim())) {
        tokenDate = it.str.trim();
        break;
      }
    }
    if (!tokenDate) {
      const m = rowText.match(/(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{2,4})/);
      if (m) tokenDate = m[1];
    }

    if (tokenDate) {
      current = Array(headers.length).fill('');
      current[dateIndex] = tokenDate;
      for (const it of row) {
        if (it.str.trim() === tokenDate) continue;
        if (isNoiseToken(it.str)) continue;
        let idx: number;
        if (headerPositions && headerPositions.length > 0) {
          idx = nearestHeaderIndex(it.x, headerPositions);
        } else {
          const bin = nearestBinIndex(it.x, xbins);
          idx = binToHeaderMap && binToHeaderMap[bin] !== undefined ? binToHeaderMap[bin] : Math.min(bin, headers.length - 1);
        }
        if (idx === descIndex || idx === originIndex) {
          current[idx] = current[idx] ? `${current[idx]}\n${it.str}` : it.str;
        } else if (idx === creditIndex || idx === debitIndex || idx === saldoIndex) {
          if (isNoiseToken(it.str)) continue;
          if (!current[idx]) current[idx] = it.str;
        } else {
          current[idx] = current[idx] ? `${current[idx]}\n${it.str}` : it.str;
        }
      }
      out.push(current.map(c => c.trim()));
    } else if (current) {
      for (const it of row) {
        if (isNoiseToken(it.str)) continue;
        if (looksLikeAmount(it.str)) {
          let idx: number;
          if (headerPositions && headerPositions.length > 0) {
            idx = nearestHeaderIndex(it.x, headerPositions);
          } else {
            const bin = nearestBinIndex(it.x, xbins);
            idx = binToHeaderMap && binToHeaderMap[bin] !== undefined ? binToHeaderMap[bin] : Math.min(bin, headers.length - 1);
          }
          if (idx === creditIndex || idx === debitIndex || idx === saldoIndex) {
            if (!current[idx]) current[idx] = it.str;
            continue;
          }
        }
        {
          const v = it.str;
          current[descIndex] = current[descIndex] ? `${current[descIndex]}\n${v}` : v;
        }
      }
      out[out.length - 1] = current.map((c) => (c || '').trim());
    }
  }
  return out;
};

const cleanColumns = (headers: string[], rows: string[][]) => {
  const canonOrder = ['Fecha', 'Descripción', 'Origen', 'Crédito', 'Débito', 'Saldo'];
  const headerMap = headers.map(h => normalizeHeaderName(h)).map(h => h || '');
  const idxByCanon: Record<string, number> = {};
  for (let i = 0; i < headerMap.length; i++) {
    const h = headerMap[i];
    if (h && idxByCanon[h] === undefined) idxByCanon[h] = i;
  }
  const finalHeaders = canonOrder.filter(h => idxByCanon[h] !== undefined);
  const finalRows = rows.map(r => finalHeaders.map(h => {
    const idx = idxByCanon[h];
    const v = idx !== undefined ? r[idx] || '' : '';
    return v;
  }));
  return { finalHeaders, finalRows };
};

const computeSimpleDiff = (localHeaders: string[], localRows: string[][], aiHeaders: string[], aiRows: string[][]) => {
  const findIdx = (hs: string[], keys: string[]) => {
    const lower = hs.map(h => (h || '').toLowerCase());
    return lower.findIndex(h => keys.some(k => h.includes(k)));
  };
  const dateIdxLocal = findIdx(localHeaders, ['fecha', 'date']);
  const dateIdxAI = findIdx(aiHeaders, ['fecha', 'date']);
  const descIdxLocal = findIdx(localHeaders, ['desc', 'concepto', 'descripcion']);
  const descIdxAI = findIdx(aiHeaders, ['desc', 'concepto', 'descripcion']);
  const amountIdxLocal = ['credito', 'crédito', 'debito', 'débito', 'saldo', 'balance']
    .map(k => findIdx(localHeaders, [k]))
    .filter(i => i >= 0);
  const amountIdxAI = ['credito', 'crédito', 'debito', 'débito', 'saldo', 'balance']
    .map(k => findIdx(aiHeaders, [k]))
    .filter(i => i >= 0);

  const makeKey = (row: string[], dateIdx: number, descIdx: number) => {
    const date = dateIdx >= 0 ? (row[dateIdx] || '') : '';
    const desc = descIdx >= 0 ? (row[descIdx] || '') : (row[1] || '');
    return `${date}|${desc}`;
  };

  const localKeys = new Set(localRows.map(r => makeKey(r, dateIdxLocal, descIdxLocal)));
  const aiKeys = new Set(aiRows.map(r => makeKey(r, dateIdxAI, descIdxAI)));
  let missingRows = 0;
  let extraRows = 0;
  localKeys.forEach(k => { if (!aiKeys.has(k)) missingRows++; });
  aiKeys.forEach(k => { if (!localKeys.has(k)) extraRows++; });

  let mismatchedAmounts = 0;
  const aiMap = new Map<string, string[]>();
  aiRows.forEach(r => aiMap.set(makeKey(r, dateIdxAI, descIdxAI), r));
  localRows.forEach(r => {
    const ai = aiMap.get(makeKey(r, dateIdxLocal, descIdxLocal));
    if (!ai) return;
    const lAmounts = amountIdxLocal.map(i => r[i] || '').join('|');
    const aAmounts = amountIdxAI.map(i => ai[i] || '').join('|');
    if (lAmounts !== aAmounts) mismatchedAmounts++;
  });

  return { missingRows, extraRows, mismatchedAmounts };
};

const PdfStructuredExtractor: React.FC = () => {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [processed, setProcessed] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyError, setVerifyError] = useState<string>('');
  const [verifyMessage, setVerifyMessage] = useState<string>('');
  const [verifyDebugLog, setVerifyDebugLog] = useState<string>('');
  const [aiHeaders, setAiHeaders] = useState<string[]>([]);
  const [aiRows, setAiRows] = useState<string[][]>([]);
  const [diff, setDiff] = useState<{ missingRows: number; extraRows: number; mismatchedAmounts: number } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [selectedProvider, setSelectedProvider] = useState<AiProviderId>('gemini');
  const [models, setModels] = useState<AiModelConfig[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [customModel, setCustomModel] = useState<string>('');
  const [temperature, setTemperature] = useState<number>(0.1);
  const [topP, setTopP] = useState<number | undefined>(undefined);
  const [stream, setStream] = useState<boolean>(false);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [aiLogs, setAiLogs] = useState<AiExtractionLog[]>([]);
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [totalParts, setTotalParts] = useState<number | null>(null);
  const [processedParts, setProcessedParts] = useState<number>(0);
  const [headerCandidate, setHeaderCandidate] = useState<string[] | null>(null);
  const [confirmedHeaders, setConfirmedHeaders] = useState<string[] | null>(null);
  const [headerDraft, setHeaderDraft] = useState<string[] | null>(null);
  const [deleteColumnIndex, setDeleteColumnIndex] = useState<number | null>(null);
  const [showDeleteColumnModal, setShowDeleteColumnModal] = useState<boolean>(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [descriptionFilter, setDescriptionFilter] = useState<string>('');
  const deferredDescriptionFilter = useDeferredValue(descriptionFilter);
  const [isFilterPending, startFilterTransition] = useTransition();

  const pdfScrollRef = useRef<HTMLDivElement | null>(null);
  const aiScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef<boolean>(false);

  useEffect(() => {
    const initialModels = settingsDb.getAiModels();
    setModels(initialModels);
    const firstGemini = initialModels.find(m => m.provider === 'gemini');
    const firstKimi = initialModels.find(m => m.provider === 'kimi');
    if (firstGemini) {
      setSelectedModelId(firstGemini.id);
    } else if (firstKimi) {
      setSelectedProvider('kimi');
      setSelectedModelId(firstKimi.id);
    }
    const initialLogs = settingsDb.getAiLogs();
    setAiLogs(initialLogs);
  }, []);

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const handleFile = async (file: File) => {
    setIsProcessing(false);
    setProcessed(false);
    setHeaders([]);
    setRows([]);
    setFileName(file.name);
    setSelectedFile(file);
    setAiHeaders([]);
    setAiRows([]);
    setDiff(null);
    setVerifyError('');
    setVerifyMessage('');
    setTotalParts(null);
    setProcessedParts(0);
    setHeaderCandidate(null);
    setConfirmedHeaders(null);
    setHeaderDraft(null);
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
  };

  const handleDownloadCSV = () => {
    const lines = [];
    lines.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));
    for (const r of rows) {
      lines.push(r.map(c => `"${c.replace(/"/g, '""')}"`).join(','));
    }
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (fileName ? fileName.replace(/\.pdf$/i, '') : 'tabla') + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAiCSV = () => {
    if (!aiHeaders.length || !aiRows.length) return;
    const lines: string[] = [];
    lines.push(aiHeaders.map(h => `"${(h || '').replace(/"/g, '""')}"`).join(','));
    for (const r of aiRows) {
      lines.push(r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(','));
    }
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (fileName ? fileName.replace(/\.pdf$/i, '') : 'tabla_ia') + '_ia.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentModel = models.find(m => m.id === selectedModelId && m.provider === selectedProvider);
  const effectiveModelName =
    (customModel && customModel.trim()) || currentModel?.model || (selectedProvider === 'gemini' ? 'gemini-2.0-flash' : 'moonshot-v1-8k');

  const handleChangeProvider = (provider: AiProviderId) => {
    setSelectedProvider(provider);
    const first = models.find(m => m.provider === provider);
    if (first) {
      setSelectedModelId(first.id);
    } else {
      setSelectedModelId('');
    }
  };

  const runHeaderDetection = async () => {
    if (!selectedFile) {
      setVerifyError('Selecciona un PDF primero');
      return;
    }
    setIsAnalyzing(true);
    setIsVerifying(true);
    setVerifyError('');
    setVerifyMessage('');
    setVerifyDebugLog('');
    setHeaderCandidate(null);
    setConfirmedHeaders(null);
    setHeaderDraft(null);
    try {
      if (selectedProvider === 'gemini') {
        const geminiKey = settingsDb.getGeminiApiKey();
        if (!geminiKey) {
          setVerifyError('API Key de Gemini no configurada (Cuenta → Configuración)');
          return;
        }
        const result = await detectPdfHeadersWithGemini(selectedFile, geminiKey, effectiveModelName);
        if (!result.success || !result.headers) {
          setVerifyError(result.error || 'Error al detectar encabezado con Gemini');
          if (result.debugInfo) {
            setVerifyDebugLog(result.debugInfo);
          }
          return;
        }
        setHeaderCandidate(result.headers);
        setHeaderDraft(result.headers);
        setVerifyMessage('Encabezado detectado. Revísalo y confirma para continuar.');
      } else {
        const kimiKey = settingsDb.getKimiApiKey();
        if (!kimiKey) {
          setVerifyError('API Key de Kimi no configurada (Cuenta → Configuración)');
          return;
        }
        const result = await detectPdfHeadersWithKimi(selectedFile, kimiKey, effectiveModelName, temperature, topP);
        if (!result.success || !result.headers) {
          setVerifyError(result.error || 'Error al detectar encabezado con Kimi');
          if (result.debugInfo) {
            setVerifyDebugLog(result.debugInfo);
          }
          return;
        }
        setHeaderCandidate(result.headers);
        setHeaderDraft(result.headers);
        setVerifyMessage('Encabezado detectado. Revísalo y confirma para continuar.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      setVerifyError(msg);
      try {
        if (e instanceof Error && e.stack) {
          setVerifyDebugLog(e.stack);
        } else if (typeof e === 'string') {
          setVerifyDebugLog(e);
        } else {
          setVerifyDebugLog(JSON.stringify(e));
        }
      } catch {
        setVerifyDebugLog(String(e));
      }
    } finally {
      setIsAnalyzing(false);
      setIsVerifying(false);
    }
  };

  const runFullAnalysisWithHeaders = async (headersToUse: string[]) => {
    if (!selectedFile) {
      setVerifyError('Selecciona un PDF primero');
      return;
    }
    setIsAnalyzing(true);
    setIsVerifying(true);
    setVerifyError('');
    setVerifyMessage('');
    setVerifyDebugLog('');
    setAiHeaders([]);
    setAiRows([]);
    setDiff(null);
    setTotalParts(null);
    setProcessedParts(0);
    try {
      if (selectedProvider === 'gemini') {
        const geminiKey = settingsDb.getGeminiApiKey();
        if (!geminiKey) {
          setVerifyError('API Key de Gemini no configurada (Cuenta → Configuración)');
          return;
        }
        const result = await analyzePDFWithGemini(selectedFile, geminiKey, effectiveModelName, {
          knownHeaders: headersToUse,
          onProgress: ({ totalParts, processedParts, headers, rows }) => {
            if (typeof totalParts === 'number') {
              setTotalParts(totalParts);
              setProcessedParts(processedParts);
            }
            if (headers && rows && rows.length > 0) {
              setAiHeaders(headers);
              setAiRows(prev => [...prev, ...rows]);
            }
          },
        });
        if (!result.success || !result.headers || !result.rows) {
          setVerifyError(result.error || 'Error al analizar con Gemini');
          if (result.debugInfo) {
            setVerifyDebugLog(result.debugInfo);
          }
          return;
        }
        const log: AiExtractionLog = {
          id: `gemini-${Date.now()}`,
          timestamp: Date.now(),
          provider: 'gemini',
          model: result.model || effectiveModelName,
          fileName: fileName || selectedFile.name,
          promptTokens: result.usage?.promptTokens,
          completionTokens: result.usage?.completionTokens,
          totalTokens: result.usage?.totalTokens,
        };
        settingsDb.addAiLog(log);
        setAiLogs(prev => [log, ...prev]);
        setAiHeaders(result.headers);
        setDiff(computeSimpleDiff(headers, rows, result.headers, result.rows));
        setVerifyMessage(`Análisis completado con ${result.model || 'Gemini'}`);
      } else if (selectedProvider === 'kimi') {
        const kimiKey = settingsDb.getKimiApiKey();
        if (!kimiKey) {
          setVerifyError('API Key de Kimi no configurada (Cuenta → Configuración)');
          return;
        }
        const result = await analyzePDFWithKimi(selectedFile, kimiKey, effectiveModelName, temperature, topP, {
          knownHeaders: headersToUse,
          onProgress: ({ totalParts, processedParts, headers, rows }) => {
            if (typeof totalParts === 'number') {
              setTotalParts(totalParts);
              setProcessedParts(processedParts);
            }
            if (headers && rows && rows.length > 0) {
              setAiHeaders(headers);
              setAiRows(prev => [...prev, ...rows]);
            }
          },
        });
        if (!result.success || !result.headers || !result.rows) {
          setVerifyError(result.error || 'Error al analizar con Kimi');
          if (result.debugInfo) {
            setVerifyDebugLog(result.debugInfo);
          }
          return;
        }
        const log: AiExtractionLog = {
          id: `kimi-${Date.now()}`,
          timestamp: Date.now(),
          provider: 'kimi',
          model: result.model || effectiveModelName,
          fileName: fileName || selectedFile.name,
          promptTokens: result.usage?.promptTokens,
          completionTokens: result.usage?.completionTokens,
          totalTokens: result.usage?.totalTokens,
        };
        settingsDb.addAiLog(log);
        setAiLogs(prev => [log, ...prev]);
        setAiHeaders(result.headers);
        setVerifyMessage(`Análisis completado con ${result.model || 'Kimi'}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      setVerifyError(msg);
      try {
        if (e instanceof Error && e.stack) {
          setVerifyDebugLog(e.stack);
        } else if (typeof e === 'string') {
          setVerifyDebugLog(e);
        } else {
          setVerifyDebugLog(JSON.stringify(e));
        }
      } catch {
        setVerifyDebugLog(String(e));
      }
    } finally {
      setIsAnalyzing(false);
      setIsVerifying(false);
    }
  };

  const addHeaderField = () => {
    setHeaderDraft(prev => {
      if (!prev || prev.length === 0) return [''];
      return [...prev, ''];
    });
  };

  const deleteHeaderField = (index: number) => {
    setHeaderDraft(prev => {
      if (!prev) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateHeaderField = (index: number, value: string) => {
    setHeaderDraft(prev => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleAnalyzeWithAI = async () => {
    if (!selectedFile) {
      setVerifyError('Selecciona un PDF primero');
      return;
    }
    if (!confirmedHeaders) {
      await runHeaderDetection();
      return;
    }
    await runFullAnalysisWithHeaders(confirmedHeaders);
  };

const syncScroll = () => {
    const source = pdfScrollRef.current;
    const target = aiScrollRef.current;
    if (!source || !target) return;
    const sourceMax = source.scrollHeight - source.clientHeight || 1;
    const targetMax = target.scrollHeight - target.clientHeight;
    const ratio = sourceMax > 0 ? source.scrollTop / sourceMax : 0;
    target.scrollTop = ratio * targetMax;
  };

  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    colIndex: number;
    value: string;
  } | null>(null);

  const invalidRows = useMemo(
    () => (aiHeaders.length > 0 && aiRows.length > 0 ? computeInvalidAmountRows(aiHeaders, aiRows) : []),
    [aiHeaders, aiRows],
  );

  const headerNormalized = useMemo(() => aiHeaders.map(h => normalizeHeaderText(h || '')), [aiHeaders]);

  const dateColIndex = useMemo(() => {
    const idx = headerNormalized.findIndex(h => h.includes('fecha') || h.includes('date'));
    return idx >= 0 ? idx : null;
  }, [headerNormalized]);

  const descriptionColIndex = useMemo(() => {
    const idx = headerNormalized.findIndex(
      h =>
        h.includes('descripcion') ||
        h.includes('descripción') ||
        h.includes('concepto') ||
        h.includes('desc'),
    );
    return idx >= 0 ? idx : null;
  }, [headerNormalized]);

  const normalizedQuery = useMemo(() => deferredDescriptionFilter.trim().toLowerCase(), [deferredDescriptionFilter]);

  const dateOptions = useMemo(() => {
    if (dateColIndex === null) return [];
    const totals = new Map<string, number>();
    const matches = new Map<string, number>();
    const hasQuery = normalizedQuery.length > 0;
    for (const r of aiRows) {
      const raw = (r?.[dateColIndex] ?? '').trim();
      if (!raw) continue;
      totals.set(raw, (totals.get(raw) || 0) + 1);
      if (!hasQuery) continue;
      const hay = (descriptionColIndex !== null ? (r?.[descriptionColIndex] ?? '') : (r || []).join(' ')).toLowerCase();
      if (hay.includes(normalizedQuery)) {
        matches.set(raw, (matches.get(raw) || 0) + 1);
      }
    }

    const parseDateForSort = (value: string) => {
      const v = value.trim();
      const iso = /^(\d{4})-(\d{2})-(\d{2})/;
      const latam = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/;
      const m1 = v.match(iso);
      if (m1) return new Date(Number(m1[1]), Number(m1[2]) - 1, Number(m1[3])).getTime();
      const m2 = v.match(latam);
      if (m2) {
        const day = Number(m2[1]);
        const month = Number(m2[2]);
        let year = Number(m2[3]);
        if (year < 100) year += 2000;
        return new Date(year, month - 1, day).getTime();
      }
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
    };

    return Array.from(totals.entries())
      .map(([value, total]) => ({ value, total, matches: matches.get(value) || 0, sortKey: parseDateForSort(value) }))
      .sort((a, b) => (a.sortKey !== b.sortKey ? a.sortKey - b.sortKey : a.value.localeCompare(b.value, 'es')))
      .map(({ value, total, matches }) => ({ value, total, matches }));
  }, [aiRows, dateColIndex, descriptionColIndex, normalizedQuery]);

  const selectedDatesSet = useMemo(() => new Set(selectedDates), [selectedDates]);

  const missingSelectedDatesCount = useMemo(() => {
    if (selectedDates.length === 0) return 0;
    const available = new Set(dateOptions.map(o => o.value));
    return selectedDates.filter(d => !available.has(d)).length;
  }, [selectedDates, dateOptions]);

  const filteredRowIndices = useMemo(() => {
    const indices: number[] = [];
    const hasDateFilter = selectedDates.length > 0 && dateColIndex !== null;
    const hasQuery = normalizedQuery.length > 0;

    for (let i = 0; i < aiRows.length; i++) {
      const r = aiRows[i];
      if (!r) continue;

      if (hasDateFilter) {
        const raw = (r[dateColIndex!] ?? '').trim();
        if (!selectedDatesSet.has(raw)) continue;
      }

      if (hasQuery) {
        const hay = (descriptionColIndex !== null ? (r[descriptionColIndex] ?? '') : r.join(' ')).toLowerCase();
        if (!hay.includes(normalizedQuery)) continue;
      }

      indices.push(i);
    }

    return indices;
  }, [aiRows, dateColIndex, descriptionColIndex, normalizedQuery, selectedDates, selectedDatesSet]);

  const hasActiveFilters = selectedDates.length > 0 || descriptionFilter.trim().length > 0;

  const toggleDateSelection = (value: string) => {
    startFilterTransition(() => {
      setSelectedDates(prev => (prev.includes(value) ? prev.filter(d => d !== value) : [...prev, value]));
    });
  };

  const handleDescriptionFilterChange = (value: string) => {
    const next = value.length > 200 ? value.slice(0, 200) : value;
    setDescriptionFilter(next);
  };

  const clearFilters = () => {
    startFilterTransition(() => {
      setSelectedDates([]);
      setDescriptionFilter('');
    });
  };

  const startEditCell = (rowIndex: number, colIndex: number) => {
    const current = aiRows[rowIndex]?.[colIndex] ?? '';
    setEditingCell({ rowIndex, colIndex, value: current });
  };

  const cancelEditCell = () => {
    setEditingCell(null);
  };

  const saveEditCell = () => {
    if (!editingCell) return;
    const { rowIndex, colIndex, value } = editingCell;
    setAiRows(prev => {
      const next = prev.map(r => [...r]);
      if (!next[rowIndex]) return next;
      next[rowIndex][colIndex] = value;
      return next;
    });
    setEditingCell(null);
  };

  const handleChangeEditingValue = (value: string) => {
    setEditingCell(prev => (prev ? { ...prev, value } : prev));
  };

  const addRowAfter = (rowIndex: number) => {
    if (aiHeaders.length === 0) return;
    const emptyRow = Array(aiHeaders.length).fill('');
    setAiRows(prev => {
      const next = [...prev];
      next.splice(rowIndex + 1, 0, emptyRow);
      return next;
    });
  };

  const deleteRow = (rowIndex: number) => {
    setAiRows(prev => prev.filter((_, index) => index !== rowIndex));
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Extractor PDF Estructurado</CardTitle>
        <CardDescription>Detecta columnas y filas usando posiciones del texto.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="pdf-file">Selecciona PDF</Label>
              <Input id="pdf-file" type="file" accept=".pdf,application/pdf" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }} />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                <FileType className="h-4 w-4 mr-1" />
                {fileName || 'Sin archivo'}
              </Badge>
              {processed && (
                <Badge variant="default">
                  {rows.length} filas
                </Badge>
              )}
              <Button onClick={handleDownloadCSV} disabled={!processed || headers.length === 0}>Descargar CSV</Button>
            </div>
          </div>

          <div className="border rounded-md p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Verificación con IA</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLogs(true)}
              >
                Ver historial IA
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Proveedor</Label>
                    <Select value={selectedProvider} onValueChange={(val) => handleChangeProvider(val as AiProviderId)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecciona proveedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini">Gemini</SelectItem>
                        <SelectItem value="kimi">Kimi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Modelo</Label>
                    <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecciona modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        {models
                          .filter(m => m.provider === selectedProvider)
                          .map(m => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.label} ({m.model})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="custom-model">Modelo personalizado</Label>
                  <Input
                    id="custom-model"
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder={selectedProvider === 'gemini' ? 'gemini-2.0-flash' : 'kimi-k2-turbo-preview'}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Temperature</Label>
                    <div className="mt-2">
                      <Slider
                        value={[temperature]}
                        onValueChange={(vals) => setTemperature(Number(vals[0]))}
                        min={0}
                        max={2}
                        step={0.05}
                      />
                    </div>
                    <Input
                      className="mt-2"
                      type="number"
                      step="0.05"
                      min={0}
                      max={2}
                      value={temperature}
                      onChange={(e) => setTemperature(Math.max(0, Math.min(2, Number(e.target.value))))}
                    />
                  </div>
                  <div>
                    <Label>Top P</Label>
                    <div className="mt-2">
                      <Slider
                        value={[typeof topP === 'number' ? topP : 1]}
                        onValueChange={(vals) => setTopP(Number(vals[0]))}
                        min={0}
                        max={1}
                        step={0.05}
                      />
                    </div>
                    <Input
                      className="mt-2"
                      type="number"
                      step="0.05"
                      min={0}
                      max={1}
                      value={typeof topP === 'number' ? topP : 1}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setTopP(Math.max(0, Math.min(1, v)));
                      }}
                    />
                  </div>
                  <div className="flex flex-col">
                    <Label>Stream</Label>
                    <div className="mt-2 flex items-center gap-2">
                      <Switch checked={stream} onCheckedChange={setStream} />
                      <span className="text-sm text-muted-foreground">{stream ? 'On' : 'Off'}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="mt-4 text-xs text-muted-foreground">
                  La configuración de API Keys se realiza en Mi Cuenta → Configuración
                  (Gemini y Kimi).
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-end gap-2">
                <Button
                  variant="secondary"
                  onClick={handleAnalyzeWithAI}
                  disabled={!selectedFile || isAnalyzing}
                >
                  {isAnalyzing
                    ? 'Analizando...'
                    : confirmedHeaders
                    ? 'Analizar movimientos con IA'
                    : 'Detectar encabezado con IA'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCompareModal(true)}
                  disabled={!selectedFile || aiHeaders.length === 0}
                >
                  Ver PDF vs resultado IA
                </Button>
              </div>
              {headerCandidate && !confirmedHeaders && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Encabezado detectado por IA. Revísalo y confirma para continuar.
                  </div>
                  <div className="border rounded-md overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {(headerDraft || headerCandidate || []).map((h, i) => (
                            <TableHead key={`header-candidate-${i}`} className="align-middle">
                              {headerDraft ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    className="h-8 text-xs"
                                    value={headerDraft[i] ?? ''}
                                    onChange={e => updateHeaderField(i, e.target.value)}
                                  />
                                  {headerDraft.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => deleteHeaderField(i)}
                                      className="text-muted-foreground hover:text-destructive transition"
                                      title="Eliminar campo"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                h || '-'
                              )}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                    </Table>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={addHeaderField}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar campo
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        const source = headerDraft || headerCandidate;
                        if (!source) return;
                        const cleaned = source.map(h => (h || '').trim()).filter(h => h !== '');
                        if (cleaned.length === 0) {
                          setVerifyError('Define al menos un nombre de columna antes de continuar.');
                          return;
                        }
                        setConfirmedHeaders(cleaned);
                        await runFullAnalysisWithHeaders(cleaned);
                      }}
                      disabled={isAnalyzing || !selectedFile}
                    >
                      Confirmar encabezado y analizar movimientos
                    </Button>
                  </div>
                </div>
              )}
              {isAnalyzing && totalParts && totalParts > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      Progreso del análisis: {processedParts}/{totalParts} partes
                    </span>
                    <span>
                      {Math.round((processedParts / totalParts) * 100)}%
                    </span>
                  </div>
                  <Progress value={(processedParts / totalParts) * 100} />
                </div>
              )}
            </div>
            {verifyMessage && (
              <div className="text-sm text-green-600">{verifyMessage}</div>
            )}
            {verifyError && (
              <div className="text-sm text-destructive">{verifyError}</div>
            )}
            {verifyDebugLog && (
              <div className="mt-2 text-xs bg-muted font-mono p-2 rounded max-h-40 overflow-auto whitespace-pre-wrap">
                {verifyDebugLog}
              </div>
            )}

            <Dialog open={showLogs} onOpenChange={setShowLogs}>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Historial de procesamientos IA</DialogTitle>
                </DialogHeader>
                <div className="text-xs text-muted-foreground mb-2">
                  Sólo se registran las ejecuciones realizadas con Kimi.
                </div>
                <div className="border rounded-md max-h-72 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Archivo</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Modelo</TableHead>
                        <TableHead className="text-right">Tokens prompt</TableHead>
                        <TableHead className="text-right">Tokens respuesta</TableHead>
                        <TableHead className="text-right">Tokens totales</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aiLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-xs text-muted-foreground text-center">
                            Aún no hay procesamientos registrados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        aiLogs.map(log => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs">
                              {new Date(log.timestamp).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-xs">
                              {log.fileName}
                            </TableCell>
                            <TableCell className="text-xs capitalize">
                              {log.provider}
                            </TableCell>
                            <TableCell className="text-xs">
                              {log.model}
                            </TableCell>
                            <TableCell className="text-xs text-right">
                              {typeof log.promptTokens === 'number' ? log.promptTokens : '-'}
                            </TableCell>
                            <TableCell className="text-xs text-right">
                              {typeof log.completionTokens === 'number' ? log.completionTokens : '-'}
                            </TableCell>
                            <TableCell className="text-xs text-right">
                              {typeof log.totalTokens === 'number' ? log.totalTokens : '-'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={showCompareModal} onOpenChange={setShowCompareModal}>
              <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Comparar PDF y resultado IA</DialogTitle>
                </DialogHeader>
                <div className="flex gap-4 h-[60vh] pt-2">
                  <div
                    ref={pdfScrollRef}
                    className="flex-1 border rounded-md overflow-auto bg-muted/40"
                    onScroll={syncScroll}
                  >
                    {pdfUrl ? (
                      <iframe src={pdfUrl} className="w-full h-full" title="PDF" />
                    ) : (
                      <div className="p-4 text-sm text-muted-foreground">
                        Selecciona un PDF para visualizarlo.
                      </div>
                    )}
                  </div>
                  <div
                    ref={aiScrollRef}
                    className="flex-1 border rounded-md overflow-auto bg-muted/40"
                  >
                    {aiHeaders.length > 0 ? (
                      <div className="p-2 min-w-full pb-8">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {aiHeaders.map((h, i) => (
                                <TableHead key={`aih-modal-${i}`}>{h || '-'}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {aiRows.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={aiHeaders.length} className="text-center text-muted-foreground">
                                  Sin filas
                                </TableCell>
                              </TableRow>
                            ) : (
                              aiRows.map((r, i) => (
                                <TableRow key={`air-modal-${i}`}>
                                  {r.map((c, j) => (
                                    <TableCell key={`aic-modal-${i}-${j}`}>{c || '-'}</TableCell>
                                  ))}
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="p-4 text-sm text-muted-foreground">
                        Ejecuta un análisis con IA para ver resultados.
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {aiHeaders.length > 0 && (
              <div className="border rounded-md p-3 overflow-auto max-h-[75vh]">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">Tabla detectada por IA</div>
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="text-xs">
                        Filtros activos
                      </Badge>
                    )}
                    {isFilterPending && (
                      <Badge variant="outline" className="text-xs">
                        Filtrando...
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadAiCSV}
                      disabled={aiHeaders.length === 0 || aiRows.length === 0}
                    >
                      Exportar CSV IA
                    </Button>
                  </div>
                </div>
                <div className="mb-3 grid gap-3 md:grid-cols-3">
                  <div className="md:col-span-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="ai-desc-filter">Filtro por descripción</Label>
                      <div className="text-xs text-muted-foreground">
                        Mostrando {filteredRowIndices.length} de {aiRows.length}
                      </div>
                    </div>
                    <Input
                      id="ai-desc-filter"
                      value={descriptionFilter}
                      onChange={e => handleDescriptionFilterChange(e.target.value)}
                      placeholder="Buscar (coincidencias parciales)…"
                      aria-label="Buscar por descripción"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">
                        {descriptionColIndex === null ? 'No se detectó columna de descripción; se busca en toda la fila.' : ''}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                        disabled={!hasActiveFilters}
                      >
                        Limpiar filtros
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Filtro por fecha</Label>
                      {dateColIndex === null && (
                        <span className="text-xs text-muted-foreground">Sin columna fecha</span>
                      )}
                    </div>
                    <div className="border rounded-md p-2 max-h-44 overflow-auto">
                      {dateColIndex === null ? (
                        <div className="text-xs text-muted-foreground">No se pudo detectar la columna de fecha.</div>
                      ) : dateOptions.length === 0 ? (
                        <div className="text-xs text-muted-foreground">Aún no hay fechas detectadas.</div>
                      ) : (
                        <div className="space-y-1">
                          {dateOptions.map((opt, idx) => {
                            const id = `ai-date-${idx}`;
                            const checked = selectedDatesSet.has(opt.value);
                            const countLabel = normalizedQuery.length > 0 ? `${opt.matches}/${opt.total}` : String(opt.total);
                            return (
                              <div key={opt.value} className="flex items-center gap-2">
                                <Checkbox
                                  id={id}
                                  checked={checked}
                                  onCheckedChange={() => toggleDateSelection(opt.value)}
                                />
                                <label htmlFor={id} className="text-xs select-none cursor-pointer flex-1 truncate">
                                  {opt.value}
                                </label>
                                <Badge variant="outline" className="text-[10px]">
                                  {countLabel}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {missingSelectedDatesCount > 0 && (
                      <div className="text-[10px] text-amber-600">
                        {missingSelectedDatesCount} fecha(s) seleccionada(s) no están en los datos actuales.
                      </div>
                    )}
                  </div>
                </div>
                {invalidRows.length > 0 && (
                  <div className="mb-2 text-xs text-red-600">
                    Hay {invalidRows.length} filas con montos inválidos (crédito/débito vacíos o ambos con valor).
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      {aiHeaders.map((h, i) => (
                        <TableHead key={`aih-${i}`} className="relative">
                          <span>{h || '-'}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteColumnIndex(i);
                              setShowDeleteColumnModal(true);
                            }}
                            className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive transition"
                            title="Eliminar columna"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aiRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={aiHeaders.length + 1} className="text-center text-muted-foreground">
                          Sin filas
                        </TableCell>
                      </TableRow>
                    ) : filteredRowIndices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={aiHeaders.length + 1} className="text-center text-muted-foreground">
                          Sin coincidencias
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRowIndices.map(rowIndex => {
                        const r = aiRows[rowIndex] || [];
                        const isInvalid = invalidRows.includes(rowIndex);
                        return (
                          <TableRow key={`air-${rowIndex}`} className="group">
                            <TableCell className="p-1 align-middle">
                              <div className="flex flex-col items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => addRowAfter(rowIndex)}
                                  className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition"
                                  title="Agregar fila debajo"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteRow(rowIndex)}
                                  className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed text-destructive opacity-0 group-hover:opacity-100 hover:bg-muted transition"
                                  title="Eliminar fila"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </TableCell>
                            {r.map((c, j) => {
                              const isEditing =
                                editingCell &&
                                editingCell.rowIndex === rowIndex &&
                                editingCell.colIndex === j;
                              return (
                                <TableCell
                                  key={`aic-${rowIndex}-${j}`}
                                  className={`relative group/cell ${isInvalid ? 'bg-red-50' : ''}`}
                                >
                                  {isEditing ? (
                                    <div className="flex items-center gap-2">
                                      <Input
                                        autoFocus
                                        value={editingCell.value}
                                        onChange={e => handleChangeEditingValue(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            saveEditCell();
                                          }
                                          if (e.key === 'Escape') {
                                            e.preventDefault();
                                            cancelEditCell();
                                          }
                                        }}
                                      />
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-green-600"
                                        type="button"
                                        onClick={saveEditCell}
                                      >
                                        ✓
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-destructive"
                                        type="button"
                                        onClick={cancelEditCell}
                                      >
                                        ✕
                                      </Button>
                                    </div>
                                  ) : (
                                    <>
                                      <span>{c || '-'}</span>
                                      <button
                                        type="button"
                                        onClick={() => startEditCell(rowIndex, j)}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/cell:opacity-100 text-muted-foreground hover:text-foreground transition"
                                        title="Editar celda"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </button>
                                      {isInvalid && (
                                        <AlertTriangle className="absolute left-1 top-1/2 -translate-y-1/2 h-3 w-3 text-amber-500" />
                                      )}
                                    </>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
            <AlertDialog open={showDeleteColumnModal} onOpenChange={setShowDeleteColumnModal}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar columna</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará la columna seleccionada y todos sus valores de la tabla de IA.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    onClick={() => {
                      setShowDeleteColumnModal(false);
                      setDeleteColumnIndex(null);
                    }}
                  >
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => {
                      if (deleteColumnIndex === null) {
                        setShowDeleteColumnModal(false);
                        return;
                      }
                      setAiHeaders(prev => prev.filter((_, idx) => idx !== deleteColumnIndex));
                      setAiRows(prev =>
                        prev.map(row => row.filter((_, idx) => idx !== deleteColumnIndex)),
                      );
                      setDeleteColumnIndex(null);
                      setShowDeleteColumnModal(false);
                    }}
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PdfStructuredExtractor;
