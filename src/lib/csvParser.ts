import { v4 as uuidv4 } from 'uuid';
import { Transaction, FileSourceType, BankColumnMapping } from '@/types/finanzas';

interface CSVRow {
  [key: string]: string;
}

// Función para detectar el delimitador del CSV
const detectDelimiter = (line: string): string => {
  const delimiters = [',', ';', '\t', '|'];
  let maxCount = 0;
  let detectedDelimiter = ',';

  delimiters.forEach(delimiter => {
    const count = line.split(delimiter).length;
    if (count > maxCount) {
      maxCount = count;
      detectedDelimiter = delimiter;
    }
  });

  return detectedDelimiter;
};

// Función para parsear una línea CSV respetando comillas
const parseCSVLine = (line: string, delimiter: string): string[] => {
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

// Función para normalizar nombres de columnas (elimina acentos, convierte a minúsculas, elimina espacios)
const normalizeColumnName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD') // Descompone caracteres con acentos
    .replace(/[\u0300-\u036f]/g, '') // Elimina los acentos
    .replace(/[^a-z0-9]/g, ''); // Elimina caracteres especiales
};

// Función para detectar el tipo de columna
const detectColumnType = (normalizedName: string): string | null => {
  const columnMappings: { [key: string]: string[] } = {
    date: ['fecha', 'date', 'dia', 'day'],
    dateValue: ['fechavalor', 'valordate'],
    description: ['concepto', 'descripcion', 'description', 'movimiento', 'transaccion'],
    detail: ['detalle', 'detail'],
    code: ['codigo', 'code'],
    document: ['numerodoc', 'documento', 'document', 'numerodocumento', 'nrodoc', 'numdoc', 'doc', 'nmerodocumento', 'nmero'],
    office: ['oficina', 'office', 'sucursal'],
    credit: ['credito', 'credit', 'abono', 'haber', 'crdito', 'crdto'],
    debit: ['debito', 'debit', 'cargo', 'debe', 'dbito', 'dbto'],
    category: ['categoria', 'category', 'tipo', 'type', 'clasificacion'],
  };

  for (const [type, keywords] of Object.entries(columnMappings)) {
    if (keywords.some(keyword => normalizedName.includes(keyword))) {
      return type;
    }
  }
  return null;
};

// Función para parsear una fecha en diferentes formatos
const parseDate = (dateStr: string): string => {
  if (!dateStr) return new Date().toISOString().split('T')[0];

  // Limpiar la fecha
  dateStr = dateStr.trim();

  // Intentar diferentes formatos
  const formats = [
    // DD/MM/YYYY o DD-MM-YYYY
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/,
    // YYYY/MM/DD o YYYY-MM-DD
    /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/,
    // MM/DD/YYYY
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/,
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let year: number, month: number, day: number;

      if (format === formats[0]) {
        // DD/MM/YYYY
        day = parseInt(match[1]);
        month = parseInt(match[2]);
        year = parseInt(match[3]);
      } else if (format === formats[1]) {
        // YYYY/MM/DD
        year = parseInt(match[1]);
        month = parseInt(match[2]);
        day = parseInt(match[3]);
      } else {
        // MM/DD/YYYY (asumiendo formato americano)
        month = parseInt(match[1]);
        day = parseInt(match[2]);
        year = parseInt(match[3]);
        if (year < 100) year += 2000;
      }

      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }

  // Si no se puede parsear, devolver fecha actual
  return new Date().toISOString().split('T')[0];
};

// Función para parsear un monto
const parseAmount = (amountStr: string): number => {
  if (!amountStr) return 0;

  // Limpiar el string
  let cleaned = amountStr.trim();
  
  // Remover símbolos de moneda
  cleaned = cleaned.replace(/[$€£¥₡]/g, '');
  
  // Manejar paréntesis como números negativos
  const isNegative = cleaned.includes('(') && cleaned.includes(')');
  cleaned = cleaned.replace(/[()]/g, '');
  
  // Reemplazar comas por puntos para decimales
  // Si hay múltiples puntos o comas, asumir que el último es el decimal
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  
  if (lastComma > lastDot) {
    // La coma es el separador decimal
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // El punto es el separador decimal
    cleaned = cleaned.replace(/,/g, '');
  }
  
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : (isNegative ? -Math.abs(amount) : amount);
};

// Función para categorizar automáticamente una transacción
const categorizeTransaction = (description: string, amount: number): string => {
  const desc = description.toLowerCase();
  
  if (desc.includes('salario') || desc.includes('nomina') || desc.includes('sueldo')) return 'Salario';
  if (desc.includes('alquiler') || desc.includes('renta')) return 'Alquiler';
  if (desc.includes('supermercado') || desc.includes('comida') || desc.includes('restaurante')) return 'Comida';
  if (desc.includes('gasolina') || desc.includes('transporte') || desc.includes('uber') || desc.includes('taxi')) return 'Transporte';
  if (desc.includes('luz') || desc.includes('agua') || desc.includes('internet') || desc.includes('telefono')) return 'Servicios';
  if (desc.includes('impuesto') || desc.includes('tax')) return 'Impuestos';
  if (desc.includes('inversion') || desc.includes('broker')) return 'Inversiones';
  if (desc.includes('entretenimiento') || desc.includes('cine') || desc.includes('netflix')) return 'Entretenimiento';
  
  return amount > 0 ? 'Ingreso' : 'Gasto';
};

export const parseCSVFile = async (
  file: File,
  fileId: string,
  sourceType: FileSourceType,
  bankName: string,
  columnMapping?: BankColumnMapping
): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        let text = event.target?.result as string;
        
        // Intentar detectar y corregir problemas de codificación
        // Si detectamos caracteres � (replacement character), intentar con otra codificación
        if (text.includes('�')) {
          console.warn('Detectado problema de codificación, intentando corregir...');
          // Recargar con codificación Windows-1252
          const readerRetry = new FileReader();
          readerRetry.onload = (e) => {
            text = e.target?.result as string;
            processCSV(text, fileId, sourceType, bankName, columnMapping, resolve, reject);
          };
          readerRetry.onerror = () => reject(new Error('Error al leer el archivo'));
          readerRetry.readAsText(file, 'windows-1252');
          return;
        }
        
        processCSV(text, fileId, sourceType, bankName, columnMapping, resolve, reject);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo'));
    };

    reader.readAsText(file, 'UTF-8');
  });
};

const processCSV = (
  text: string,
  fileId: string,
  sourceType: FileSourceType,
  bankName: string,
  columnMapping: BankColumnMapping | undefined,
  resolve: (value: Transaction[]) => void,
  reject: (reason?: unknown) => void
) => {
  try {
        const lines = text.split(/\r?\n/).filter(line => line.trim());

        if (lines.length < 2) {
          reject(new Error('El archivo CSV está vacío o no tiene datos'));
          return;
        }

        // Detectar delimitador
        const delimiter = detectDelimiter(lines[0]);

        // Parsear encabezados
        const headers = parseCSVLine(lines[0], delimiter);
        const normalizedHeaders = headers.map(normalizeColumnName);

        // Detectar columnas importantes
        const columnMap: { [key: string]: number } = {};
        
        // Si hay mapeo personalizado, usarlo primero
        if (columnMapping) {
          Object.entries(columnMapping).forEach(([key, columnName]) => {
            if (columnName) {
              const normalizedColumnName = normalizeColumnName(columnName);
              const index = normalizedHeaders.findIndex(h => h === normalizedColumnName);
              if (index !== -1) {
                columnMap[key] = index;
              }
            }
          });
        }
        
        // Detectar automáticamente las columnas que no están en el mapeo
        normalizedHeaders.forEach((header, index) => {
          const type = detectColumnType(header);
          if (type && !columnMap[type]) {
            columnMap[type] = index;
          }
        });

        // Debug: mostrar columnas detectadas
        console.log('Headers originales:', headers);
        console.log('Headers normalizados:', normalizedHeaders);
        console.log('Columnas detectadas:', columnMap);

        // Validar que al menos tengamos crédito o débito
        if (columnMap.credit === undefined && columnMap.debit === undefined) {
          reject(new Error(`No se pudieron detectar las columnas de Crédito o Débito en el CSV. Columnas encontradas: ${headers.join(', ')}`));
          return;
        }

        // Parsear transacciones
        const transactions: Transaction[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i], delimiter);
          
          if (values.length < headers.length - 1) continue; // Saltar líneas incompletas

          // Obtener descripción: priorizar Concepto, luego Detalle
          let description = '';
          if (columnMap.description !== undefined && values[columnMap.description]) {
            description = values[columnMap.description];
          } else if (columnMap.detail !== undefined && values[columnMap.detail]) {
            description = values[columnMap.detail];
          } else {
            description = `Transacción ${i}`;
          }

          // Calcular monto: Crédito es positivo, Débito es negativo
          let amount = 0;
          if (columnMap.credit !== undefined && values[columnMap.credit]) {
            const creditAmount = parseAmount(values[columnMap.credit]);
            if (creditAmount !== 0) amount = creditAmount;
          }
          if (columnMap.debit !== undefined && values[columnMap.debit]) {
            const debitAmount = parseAmount(values[columnMap.debit]);
            if (debitAmount !== 0) amount = -Math.abs(debitAmount);
          }

          // Si no hay monto, saltar esta transacción
          if (amount === 0) continue;
          
          // Obtener fecha: priorizar Fecha Valor, luego Fecha
          let date = '';
          if (columnMap.dateValue !== undefined && values[columnMap.dateValue]) {
            date = parseDate(values[columnMap.dateValue]);
          } else if (columnMap.date !== undefined && values[columnMap.date]) {
            date = parseDate(values[columnMap.date]);
          } else {
            date = new Date().toISOString().split('T')[0];
          }

          const category = columnMap.category !== undefined && values[columnMap.category]
            ? values[columnMap.category]
            : categorizeTransaction(description, amount);

          transactions.push({
            id: uuidv4(),
            date,
            description,
            category,
            amount,
            source: bankName,
            file_id: fileId,
          });
        }

        if (transactions.length === 0) {
          reject(new Error('No se pudieron extraer transacciones del archivo'));
          return;
        }

        resolve(transactions);
  } catch (error) {
    reject(error);
  }
};
