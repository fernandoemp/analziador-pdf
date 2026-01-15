import * as XLSX from 'xlsx';
import { BankColumnMapping } from '@/types/finanzas';

// Importar pdfjs-dist de forma lazy
const getPdfJs = async () => {
  const pdfjsLib = await import('pdfjs-dist');
  // Usar worker local desde public
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  return pdfjsLib;
};

interface ColumnAnalysis {
  columnName: string;
  suggestedType: string | null;
  confidence: number; // 0-100
  sampleValues: string[];
}

interface FileAnalysisResult {
  headers: string[];
  columnAnalysis: ColumnAnalysis[];
  suggestedMapping: BankColumnMapping;
  rowCount: number;
  preview: Record<string, unknown>[];
}

// Función para normalizar nombres de columnas
const normalizeColumnName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
};

// Función para detectar el tipo de columna con confianza
const detectColumnTypeWithConfidence = (columnName: string, sampleValues: string[]): { type: string | null; confidence: number } => {
  const normalized = normalizeColumnName(columnName);
  
  const patterns: { [key: string]: { keywords: string[]; weight: number } } = {
    date: { keywords: ['fecha', 'date', 'dia', 'day'], weight: 100 },
    dateValue: { keywords: ['fechavalor', 'valordate', 'fechavlr'], weight: 100 },
    description: { keywords: ['concepto', 'descripcion', 'description', 'movimiento', 'transaccion', 'detalle'], weight: 90 },
    detail: { keywords: ['detalle', 'detail', 'observacion'], weight: 80 },
    code: { keywords: ['codigo', 'code', 'cod'], weight: 90 },
    document: { keywords: ['numerodoc', 'documento', 'document', 'numerodocumento', 'nrodoc', 'numdoc', 'doc', 'nmerodocumento', 'nmero'], weight: 85 },
    office: { keywords: ['oficina', 'office', 'sucursal', 'agencia'], weight: 85 },
    credit: { keywords: ['credito', 'credit', 'abono', 'haber', 'crdito', 'crdto', 'ingreso'], weight: 95 },
    debit: { keywords: ['debito', 'debit', 'cargo', 'debe', 'dbito', 'dbto', 'egreso'], weight: 95 },
    amount: { keywords: ['monto', 'amount', 'importe', 'valor', 'value', 'cantidad', 'total'], weight: 90 },
    category: { keywords: ['categoria', 'category', 'tipo', 'type', 'clasificacion'], weight: 85 },
  };

  let bestMatch: { type: string | null; confidence: number } = { type: null, confidence: 0 };

  for (const [type, { keywords, weight }] of Object.entries(patterns)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        const confidence = weight;
        if (confidence > bestMatch.confidence) {
          bestMatch = { type, confidence };
        }
      }
    }
  }

  // Validar con valores de muestra para aumentar confianza
  if (bestMatch.type && sampleValues.length > 0) {
    const validation = validateColumnType(bestMatch.type, sampleValues);
    if (validation) {
      bestMatch.confidence = Math.min(100, bestMatch.confidence + 10);
    } else {
      bestMatch.confidence = Math.max(0, bestMatch.confidence - 20);
    }
  }

  return bestMatch;
};

// Validar que los valores de muestra coincidan con el tipo detectado
const validateColumnType = (type: string, sampleValues: string[]): boolean => {
  const nonEmptyValues = sampleValues.filter(v => v && v.trim());
  if (nonEmptyValues.length === 0) return false;

  switch (type) {
    case 'date':
    case 'dateValue':
      // Verificar si parece una fecha
      return nonEmptyValues.some(v => /\d{1,4}[/-]\d{1,2}[/-]\d{1,4}/.test(v));
    
    case 'credit':
    case 'debit':
    case 'amount':
      // Verificar si parece un número
      return nonEmptyValues.some(v => /^[\d\s,.()$€£¥₡-]+$/.test(v.trim()));
    
    case 'description':
    case 'detail':
      // Verificar si tiene texto descriptivo
      return nonEmptyValues.some(v => v.length > 5);
    
    default:
      return true;
  }
};

// Analizar archivo CSV
const analyzeCSV = async (file: File): Promise<FileAnalysisResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim());

        if (lines.length < 2) {
          reject(new Error('El archivo está vacío o no tiene suficientes datos'));
          return;
        }

        // Detectar delimitador
        const delimiters = [',', ';', '\t', '|'];
        let delimiter = ',';
        let maxCount = 0;
        delimiters.forEach(d => {
          const count = lines[0].split(d).length;
          if (count > maxCount) {
            maxCount = count;
            delimiter = d;
          }
        });

        // Parsear encabezados
        const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));

        // Obtener valores de muestra (primeras 5 filas)
        const sampleRows = lines.slice(1, Math.min(6, lines.length)).map(line => 
          line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''))
        );

        // Analizar cada columna
        const columnAnalysis: ColumnAnalysis[] = headers.map((header, index) => {
          const sampleValues = sampleRows.map(row => row[index] || '');
          const { type, confidence } = detectColumnTypeWithConfidence(header, sampleValues);
          
          return {
            columnName: header,
            suggestedType: type,
            confidence,
            sampleValues: sampleValues.slice(0, 3),
          };
        });

        // Crear mapeo sugerido
        const suggestedMapping: BankColumnMapping = {};
        columnAnalysis.forEach(analysis => {
          if (analysis.suggestedType && analysis.confidence >= 70) {
            suggestedMapping[analysis.suggestedType as keyof BankColumnMapping] = analysis.columnName;
          }
        });

        // Crear preview
        const preview = sampleRows.slice(0, 5).map(row => {
          const obj: Record<string, unknown> = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        });

        resolve({
          headers,
          columnAnalysis,
          suggestedMapping,
          rowCount: lines.length - 1,
          preview,
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsText(file);
  });
};

// Analizar archivo Excel
const analyzeExcel = async (file: File): Promise<FileAnalysisResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData: unknown[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          reject(new Error('El archivo está vacío o no tiene suficientes datos'));
          return;
        }

        const headers = (jsonData[0] as unknown[]).map((h) => String(h ?? '').trim());
        const sampleRows = jsonData.slice(1, Math.min(6, jsonData.length)) as unknown[];

        // Analizar cada columna
        const columnAnalysis: ColumnAnalysis[] = headers.map((header: string, index: number) => {
          const sampleValues = sampleRows.map((row) => {
            const rowArray = Array.isArray(row) ? row : [];
            return String(rowArray[index] ?? '');
          });
          const { type, confidence } = detectColumnTypeWithConfidence(header, sampleValues);
          
          return {
            columnName: header,
            suggestedType: type,
            confidence,
            sampleValues: sampleValues.slice(0, 3),
          };
        });

        // Crear mapeo sugerido
        const suggestedMapping: BankColumnMapping = {};
        columnAnalysis.forEach(analysis => {
          if (analysis.suggestedType && analysis.confidence >= 70) {
            suggestedMapping[analysis.suggestedType as keyof BankColumnMapping] = analysis.columnName;
          }
        });

        // Crear preview
        const preview = sampleRows.slice(0, 5).map((row) => {
          const obj: Record<string, unknown> = {};
          const rowArray = Array.isArray(row) ? row : [];
          headers.forEach((header: string, index: number) => {
            obj[header] = rowArray[index] ?? '';
          });
          return obj;
        });

        resolve({
          headers,
          columnAnalysis,
          suggestedMapping,
          rowCount: jsonData.length - 1,
          preview,
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsArrayBuffer(file);
  });
};

// Analizar archivo PDF
const analyzePDF = async (file: File): Promise<FileAnalysisResult> => {
  try {
    const pdfjsLib = await getPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    // Extraer texto de todas las páginas (máximo 5 para análisis)
    const maxPages = Math.min(pdf.numPages, 5);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = (textContent.items as unknown[])
        .map((item) => {
          if (typeof item !== 'object' || item === null) return '';
          const maybeStr = (item as { str?: unknown }).str;
          return typeof maybeStr === 'string' ? maybeStr : '';
        })
        .join(' ');
      fullText += pageText + '\n';
    }

    // Intentar detectar estructura tabular
    const lines = fullText.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('No se pudo extraer suficiente texto del PDF. Intenta con CSV o Excel.');
    }

    // Buscar líneas que parezcan encabezados (palabras clave comunes)
    const headerKeywords = ['fecha', 'date', 'concepto', 'descripcion', 'monto', 'amount', 'credito', 'debito', 'saldo', 'balance'];
    let headerLine = '';
    let headerIndex = -1;

    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const line = lines[i].toLowerCase();
      const matchCount = headerKeywords.filter(keyword => line.includes(keyword)).length;
      if (matchCount >= 2) {
        headerLine = lines[i];
        headerIndex = i;
        break;
      }
    }

    if (!headerLine) {
      throw new Error('No se pudo detectar la estructura de columnas en el PDF. Intenta con un archivo CSV o Excel.');
    }

    // Dividir el encabezado en columnas (por múltiples espacios)
    const headers = headerLine
      .split(/\s{2,}/)
      .map(h => h.trim())
      .filter(h => h.length > 0);

    if (headers.length < 2) {
      throw new Error('No se pudieron detectar suficientes columnas en el PDF');
    }

    // Extraer filas de muestra
    const sampleLines = lines.slice(headerIndex + 1, Math.min(headerIndex + 6, lines.length));
    const sampleRows = sampleLines.map(line => {
      // Intentar dividir por múltiples espacios
      return line.split(/\s{2,}/).map(v => v.trim());
    });

    // Analizar cada columna
    const columnAnalysis: ColumnAnalysis[] = headers.map((header, index) => {
      const sampleValues = sampleRows
        .map(row => row[index] || '')
        .filter(v => v.length > 0);
      const { type, confidence } = detectColumnTypeWithConfidence(header, sampleValues);
      
      return {
        columnName: header,
        suggestedType: type,
        confidence: confidence > 0 ? confidence - 10 : 0, // Reducir confianza para PDF
        sampleValues: sampleValues.slice(0, 3),
      };
    });

    // Crear mapeo sugerido (con umbral más bajo para PDF)
    const suggestedMapping: BankColumnMapping = {};
    columnAnalysis.forEach(analysis => {
      if (analysis.suggestedType && analysis.confidence >= 60) {
        suggestedMapping[analysis.suggestedType as keyof BankColumnMapping] = analysis.columnName;
      }
    });

    // Crear preview
    const preview = sampleRows.slice(0, 5).map(row => {
      const obj: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });

    return {
      headers,
      columnAnalysis,
      suggestedMapping,
      rowCount: sampleLines.length,
      preview,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo analizar el PDF';
    throw new Error(`Error al procesar PDF: ${message}`);
  }
};

// Función principal de análisis
export const analyzeFile = async (file: File): Promise<FileAnalysisResult> => {
  const fileName = file.name.toLowerCase();
  const extension = fileName.split('.').pop();

  if (extension === 'csv') {
    return analyzeCSV(file);
  } else if (extension === 'xlsx' || extension === 'xls') {
    return analyzeExcel(file);
  } else if (extension === 'pdf') {
    return analyzePDF(file);
  } else {
    throw new Error('Formato de archivo no soportado. Solo CSV, Excel y PDF.');
  }
};
