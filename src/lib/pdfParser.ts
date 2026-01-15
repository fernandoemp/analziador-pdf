import { v4 as uuidv4 } from 'uuid';
import { Transaction, FileSourceType, BankColumnMapping } from '@/types/finanzas';

// Importar pdfjs-dist de forma lazy
const getPdfJs = async () => {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  return pdfjsLib;
};

// Función para normalizar nombres de columnas
const normalizeColumnName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
};

// Función para detectar columnas en el PDF
const detectColumns = (
  headers: string[],
  customMapping?: BankColumnMapping
): { [key: string]: number } => {
  const normalizedHeaders = headers.map(h => normalizeColumnName(h));
  console.log('Headers originales:', headers);
  console.log('Headers normalizados:', normalizedHeaders);

  const columns: { [key: string]: number } = {};

  // Si hay mapeo personalizado, usarlo primero
  if (customMapping) {
    Object.entries(customMapping).forEach(([key, columnName]) => {
      if (columnName) {
        const normalizedCustom = normalizeColumnName(columnName);
        const index = normalizedHeaders.findIndex(h => h === normalizedCustom);
        if (index !== -1) {
          columns[key] = index;
          console.log(`Columna ${key} mapeada a índice ${index} (${headers[index]}) usando configuración personalizada`);
        }
      }
    });
  }

  // Detectar columnas automáticamente si no están en el mapeo personalizado
  const columnPatterns: { [key: string]: string[] } = {
    date: ['fecha', 'date', 'dia', 'day'],
    dateValue: ['fechavalor', 'valordate', 'fechavlr'],
    description: ['concepto', 'descripcion', 'description', 'movimiento', 'transaccion'],
    detail: ['detalle', 'detail', 'observacion'],
    code: ['codigo', 'code', 'cod'],
    document: ['numerodoc', 'documento', 'document', 'numerodocumento', 'nrodoc', 'numdoc', 'doc', 'nmerodocumento', 'nmero'],
    office: ['oficina', 'office', 'sucursal', 'agencia'],
    credit: ['credito', 'credit', 'abono', 'haber', 'crdito', 'crdto', 'ingreso'],
    debit: ['debito', 'debit', 'cargo', 'debe', 'dbito', 'dbto', 'egreso'],
    amount: ['monto', 'amount', 'importe', 'valor', 'value', 'cantidad'],
    category: ['categoria', 'category', 'tipo', 'type', 'clasificacion'],
  };

  Object.entries(columnPatterns).forEach(([key, patterns]) => {
    if (columns[key] === undefined) {
      for (const pattern of patterns) {
        const index = normalizedHeaders.findIndex(h => h.includes(pattern));
        if (index !== -1) {
          columns[key] = index;
          console.log(`Columna ${key} detectada en índice ${index} (${headers[index]})`);
          break;
        }
      }
    }
  });

  console.log('Columnas detectadas:', columns);
  return columns;
};

// Función para parsear fecha
const parseDate = (dateStr: string): string => {
  if (!dateStr || dateStr.trim() === '') return new Date().toISOString();

  const cleaned = dateStr.trim();

  // Intentar varios formatos
  const formats = [
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/, // DD/MM/YYYY o DD-MM-YYYY
    /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/, // YYYY/MM/DD o YYYY-MM-DD
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/,  // DD/MM/YY o DD-MM-YY
  ];

  for (const format of formats) {
    const match = cleaned.match(format);
    if (match) {
      let day: number, month: number, year: number;

      if (format === formats[0] || format === formats[2]) {
        // DD/MM/YYYY o DD/MM/YY
        day = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        year = parseInt(match[3]);
        if (year < 100) year += 2000;
      } else {
        // YYYY/MM/DD
        year = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        day = parseInt(match[3]);
      }

      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }

  return new Date().toISOString();
};

// Función para parsear monto
const parseAmount = (amountStr: string): number => {
  if (!amountStr || amountStr.trim() === '') return 0;

  const cleaned = amountStr
    .replace(/[^\d,.\-()]/g, '')
    .replace(/,/g, '');

  if (cleaned.includes('(') || cleaned.includes(')')) {
    return -Math.abs(parseFloat(cleaned.replace(/[()]/g, '')));
  }

  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : amount;
};

// Función para categorizar transacción
const categorizeTransaction = (description: string, amount: number): string => {
  const desc = description.toLowerCase();

  if (amount > 0) {
    if (desc.includes('salario') || desc.includes('nomina') || desc.includes('sueldo')) return 'Salario';
    if (desc.includes('deposito') || desc.includes('abono')) return 'Depósito';
    if (desc.includes('transferencia')) return 'Transferencia Recibida';
    return 'Ingreso';
  } else {
    if (desc.includes('supermercado') || desc.includes('compra')) return 'Compras';
    if (desc.includes('restaurante') || desc.includes('comida')) return 'Alimentación';
    if (desc.includes('gasolina') || desc.includes('combustible')) return 'Transporte';
    if (desc.includes('alquiler') || desc.includes('renta')) return 'Vivienda';
    if (desc.includes('luz') || desc.includes('agua') || desc.includes('internet')) return 'Servicios';
    if (desc.includes('tarjeta')) return 'Pago Tarjeta';
    if (desc.includes('retiro') || desc.includes('cajero')) return 'Retiro';
    return 'Gasto';
  }
};

export const parsePDFFile = async (
  file: File,
  fileId: string,
  sourceType: FileSourceType,
  bankName: string,
  customMapping?: BankColumnMapping
): Promise<Transaction[]> => {
  try {
    const pdfjsLib = await getPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    // Extraer texto de todas las páginas
    for (let i = 1; i <= pdf.numPages; i++) {
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
      throw new Error('No se pudo extraer suficiente texto del PDF');
    }

    // Buscar líneas que parezcan encabezados
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

    // Dividir el encabezado en columnas
    const headers = headerLine
      .split(/\s{2,}/)
      .map(h => h.trim())
      .filter(h => h.length > 0);

    if (headers.length < 2) {
      throw new Error('No se pudieron detectar suficientes columnas en el PDF');
    }

    // Detectar columnas
    const columns = detectColumns(headers, customMapping);

    // Verificar que tengamos al menos fecha y descripción
    if (columns.date === undefined) {
      throw new Error('No se pudo detectar la columna de Fecha en el PDF');
    }

    // Extraer filas de datos
    const dataLines = lines.slice(headerIndex + 1);
    const transactions: Transaction[] = [];

    for (const line of dataLines) {
      const values = line.split(/\s{2,}/).map(v => v.trim());
      
      // Verificar que la línea tenga suficientes valores
      if (values.length < 2) continue;

      // Verificar que parezca una fila de datos (tiene fecha)
      const dateValue = values[columns.date];
      if (!dateValue || !/\d/.test(dateValue)) continue;

      // Extraer valores
      const date = parseDate(dateValue);
      const dateValueCol = columns.dateValue !== undefined ? parseDate(values[columns.dateValue]) : date;
      
      let description = '';
      if (columns.description !== undefined) {
        description = values[columns.description] || '';
      } else if (columns.detail !== undefined) {
        description = values[columns.detail] || '';
      }

      // Calcular monto
      let amount = 0;
      if (columns.credit !== undefined && columns.debit !== undefined) {
        const credit = parseAmount(values[columns.credit] || '0');
        const debit = parseAmount(values[columns.debit] || '0');
        amount = credit - debit;
      } else if (columns.amount !== undefined) {
        amount = parseAmount(values[columns.amount] || '0');
      }

      // Si no hay descripción o monto, saltar
      if (!description || amount === 0) continue;

      const category = categorizeTransaction(description, amount);

      const transaction: Transaction = {
        id: uuidv4(),
        date: dateValueCol || date,
        description: description.substring(0, 200),
        category,
        amount,
        source: bankName,
        file_id: fileId,
      };

      transactions.push(transaction);
    }

    if (transactions.length === 0) {
      throw new Error('No se encontraron transacciones válidas en el PDF');
    }

    console.log(`PDF procesado: ${transactions.length} transacciones encontradas`);
    return transactions;

  } catch (error: unknown) {
    console.error('Error al procesar PDF:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    throw new Error(`Error al procesar PDF: ${message}`);
  }
};
