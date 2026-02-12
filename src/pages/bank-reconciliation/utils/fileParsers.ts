import * as XLSX from 'xlsx';

export type LedgerFormat = 'pdf' | 'csv' | 'excel' | null;

export const detectLedgerFormat = (file: File | null): LedgerFormat => {
  if (!file) return null;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'excel';
  return null;
};

const detectDelimiter = (line: string) => {
  const delimiters = [',', ';', '\t', '|'];
  let best = ',';
  let bestCount = 0;
  for (const delimiter of delimiters) {
    const count = line.split(delimiter).length;
    if (count > bestCount) {
      bestCount = count;
      best = delimiter;
    }
  }
  return best;
};

const parseCSVLine = (line: string, delimiter: string) => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

export const parseCSVRows = async (file: File) => {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return [];
  const delimiter = detectDelimiter(lines[0]);
  return lines.map(line => parseCSVLine(line, delimiter));
};

export const parseExcelRows = async (file: File) => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' }) as string[][];
  return rows.map(row => row.map(cell => String(cell ?? '')));
};
