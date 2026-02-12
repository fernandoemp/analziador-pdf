import { normalizeHeader } from './textUtils';

export const findHeaderRowIndex = (rows: string[][]) => {
  let bestIndex = 0;
  let bestScore = -1;
  const maxRows = Math.min(rows.length, 20);
  for (let i = 0; i < maxRows; i++) {
    const row = rows[i] || [];
    const textCount = row.filter(cell => cell && isNaN(Number(cell.replace(/[^\d.-]/g, '')))).length;
    const numericCount = row.filter(cell => cell && !isNaN(Number(cell.replace(/[^\d.-]/g, '')))).length;
    const nextRow = rows[i + 1] || [];
    const nextNumeric = nextRow.filter(cell => cell && !isNaN(Number(cell.replace(/[^\d.-]/g, '')))).length;
    const score = textCount * 2 + nextNumeric - numericCount;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
};

export const findColumnByKeywords = (headers: string[], keywords: string[]) => {
  const normalized = headers.map(h => normalizeHeader(h));
  return normalized.findIndex(h => keywords.some(k => h.includes(k)));
};

export const defaultKeySelection = (headers: string[]) => {
  const dateIdx = findColumnByKeywords(headers, ['fecha', 'date']);
  const debitIdx = findColumnByKeywords(headers, ['debe', 'debito', 'debit']);
  const creditIdx = findColumnByKeywords(headers, ['haber', 'credito', 'credit']);
  const descIdx = findColumnByKeywords(headers, ['descripcion', 'concepto', 'detalle', 'desc']);
  return {
    dateColumn: headers[dateIdx] ?? '',
    debitColumn: headers[debitIdx] ?? '',
    creditColumn: headers[creditIdx] ?? '',
    descriptionColumn: headers[descIdx] ?? '',
  };
};
