export type TextItem = { str: string; x: number; y: number };

type PdfTextItemRaw = { str?: unknown; transform?: unknown };
type PdfTextContent = { items: PdfTextItemRaw[] };
type PdfPage = { getTextContent: () => Promise<PdfTextContent> };
export type PdfDocument = { numPages: number; getPage: (pageNumber: number) => Promise<PdfPage> };

export type LocalExtractContext = {
  runId: string;
  file: File;
  data: ArrayBuffer;
  pdf: PdfDocument;
  numPages: number;
  pageGap: number;
  items: TextItem[];
  nextPage: number;
  startedAt: number;
};

export const loadPdfJs = async () => {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  return pdfjsLib;
};

export const groupRows = (items: TextItem[]) => {
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

export const normalizeHeaderText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const detectAmountColumnsFromHeaders = (headers: string[]) => {
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

const parseAmountValue = (value: string) => {
  if (!value) return 0;
  let cleaned = value.trim().replace(/[$€£¥₡]/g, '');
  const isNegative = cleaned.includes('(') && cleaned.includes(')');
  cleaned = cleaned.replace(/[()]/g, '');
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  if (lastComma > lastDot) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }
  const amount = Number.parseFloat(cleaned);
  if (Number.isNaN(amount)) return 0;
  return isNegative ? -Math.abs(amount) : amount;
};

export const computeInvalidAmountRows = (headers: string[], rows: string[][]) => {
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
    if (bothFilled) {
      const creditAmount = parseAmountValue(creditValue);
      const debitAmount = parseAmountValue(debitValue);
      const oneIsZero = creditAmount === 0 || debitAmount === 0;
      if (!oneIsZero) invalid.push(i);
      continue;
    }
    if (bothEmpty) {
      invalid.push(i);
    }
  }
  return invalid;
};

export const detectHeaderIndex = (rows: TextItem[][]) => {
  const keywords = [
    'fecha',
    'date',
    'concepto',
    'descripcion',
    'monto',
    'amount',
    'credito',
    'debito',
    'saldo',
    'balance',
  ];
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const line = rows[i].map(it => it.str).join(' ').toLowerCase();
    const matches = keywords.filter(k => line.includes(k)).length;
    if (matches >= 2) return i;
  }
  return -1;
};

export const buildXBins = (rows: TextItem[][]) => {
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

const dateRegex = /^(\d{2})[/.-](\d{2})[/.-](\d{2,4})$/;
const looksLikeAmount = (s: string) =>
  /^[+-]?(\d{1,3}(\.\d{3})*|\d+)(,\d{2})?$/.test(s) || /^[+-]?(\d{1,3}(,\d{3})*|\d+)(\.\d{2})?$/.test(s);

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
    [['fecha', 'dia', 'date'], 'Fecha'],
    [['descripcion', 'concepto', 'movimiento', 'detalle', 'desc'], 'Descripción'],
    [['origen', 'origin'], 'Origen'],
    [['credito', 'cr', 'haber', 'abono'], 'Crédito'],
    [['debito', 'de', 'cargo', 'debe'], 'Débito'],
    [['saldo', 'balance'], 'Saldo'],
  ];
  for (const [keys, canon] of pairs) {
    if (keys.some(k => n.includes(k))) return canon;
  }
  return '';
};

export const labelsAndPositionsFromHeaderRow = (row: TextItem[]) => {
  const groups = clusterRowByX(row, 20);
  const raw = groups.map(g => ({
    label: g.map(t => t.str).join(' ').trim(),
    pos: Math.round(g.reduce((s, v) => s + v.x, 0) / g.length),
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

export const buildBinToHeaderMap = (xbins: number[], headerPositions: number[], headerCount: number) => {
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

export const foldByDate = (
  grouped: TextItem[][],
  xbins: number[],
  headers: string[],
  binToHeaderMap?: number[],
  headerPositions?: number[],
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
    if (/^[.,]$/.test(t)) return true;
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
      const m = rowText.match(/(\d{2}[/.-]\d{2}[/.-]\d{2,4})/);
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
          idx =
            binToHeaderMap && binToHeaderMap[bin] !== undefined
              ? binToHeaderMap[bin]
              : Math.min(bin, headers.length - 1);
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
            idx =
              binToHeaderMap && binToHeaderMap[bin] !== undefined
                ? binToHeaderMap[bin]
                : Math.min(bin, headers.length - 1);
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
      out[out.length - 1] = current.map(c => (c || '').trim());
    }
  }
  return out;
};

export const cleanColumns = (headers: string[], rows: string[][]) => {
  const canonOrder = ['Fecha', 'Descripción', 'Origen', 'Crédito', 'Débito', 'Saldo'];
  const headerMap = headers.map(h => normalizeHeaderName(h)).map(h => h || '');
  const idxByCanon: Record<string, number> = {};
  for (let i = 0; i < headerMap.length; i++) {
    const h = headerMap[i];
    if (h && idxByCanon[h] === undefined) idxByCanon[h] = i;
  }
  const finalHeaders = canonOrder.filter(h => idxByCanon[h] !== undefined);
  const finalRows = rows.map(r =>
    finalHeaders.map(h => {
      const idx = idxByCanon[h];
      const v = idx !== undefined ? r[idx] || '' : '';
      return v;
    }),
  );
  return { finalHeaders, finalRows };
};

export const computeSimpleDiff = (localHeaders: string[], localRows: string[][], aiHeaders: string[], aiRows: string[][]) => {
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
  localKeys.forEach(k => {
    if (!aiKeys.has(k)) missingRows++;
  });
  aiKeys.forEach(k => {
    if (!localKeys.has(k)) extraRows++;
  });

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

