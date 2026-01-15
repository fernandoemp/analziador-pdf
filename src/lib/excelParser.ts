import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { Transaction, FileSourceType, BankColumnMapping } from '@/types/finanzas';

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
const parseDate = (dateValue: unknown): string => {
  if (!dateValue) return new Date().toISOString().split('T')[0];

  // Si es un número (fecha de Excel)
  if (typeof dateValue === 'number') {
    const date = XLSX.SSF.parse_date_code(dateValue);
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }

  // Si es una fecha de JavaScript
  if (dateValue instanceof Date) {
    return dateValue.toISOString().split('T')[0];
  }

  // Si es un string
  const dateStr = String(dateValue).trim();

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
const parseAmount = (amountValue: unknown): number => {
  if (amountValue === null || amountValue === undefined || amountValue === '') return 0;

  // Si ya es un número
  if (typeof amountValue === 'number') {
    return amountValue;
  }

  // Si es un string
  const amountStr = String(amountValue).trim();
  
  // Remover símbolos de moneda
  let cleaned = amountStr.replace(/[$€£¥₡]/g, '');
  
  // Manejar paréntesis como números negativos
  const isNegative = cleaned.includes('(') && cleaned.includes(')');
  cleaned = cleaned.replace(/[()]/g, '');
  
  // Reemplazar comas por puntos para decimales
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

export const parseExcelFile = async (
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
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });

        // Obtener la primera hoja
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convertir a JSON
        const jsonData: unknown[] = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1, 
          raw: false,
          defval: '' 
        });

        if (jsonData.length < 2) {
          reject(new Error('El archivo Excel está vacío o no tiene datos'));
          return;
        }

        // Parsear encabezados
        const headers = jsonData[0] as string[];
        const normalizedHeaders = headers.map(h => normalizeColumnName(String(h)));

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
          reject(new Error(`No se pudieron detectar las columnas de Crédito o Débito en el archivo. Columnas encontradas: ${headers.join(', ')}`));
          return;
        }

        // Parsear transacciones
        const transactions: Transaction[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as unknown[];
          
          if (!row || row.length < headers.length - 1) continue; // Saltar líneas incompletas

          // Obtener descripción: priorizar Concepto, luego Detalle
          let description = '';
          if (columnMap.description !== undefined && row[columnMap.description]) {
            description = String(row[columnMap.description]);
          } else if (columnMap.detail !== undefined && row[columnMap.detail]) {
            description = String(row[columnMap.detail]);
          } else {
            description = `Transacción ${i}`;
          }

          // Calcular monto: Crédito es positivo, Débito es negativo
          let amount = 0;
          if (columnMap.credit !== undefined && row[columnMap.credit]) {
            const creditAmount = parseAmount(row[columnMap.credit]);
            if (creditAmount !== 0) amount = creditAmount;
          }
          if (columnMap.debit !== undefined && row[columnMap.debit]) {
            const debitAmount = parseAmount(row[columnMap.debit]);
            if (debitAmount !== 0) amount = -Math.abs(debitAmount);
          }

          // Si no hay monto, saltar esta transacción
          if (amount === 0) continue;
          
          // Obtener fecha: priorizar Fecha Valor, luego Fecha
          let date = '';
          if (columnMap.dateValue !== undefined && row[columnMap.dateValue]) {
            date = parseDate(row[columnMap.dateValue]);
          } else if (columnMap.date !== undefined && row[columnMap.date]) {
            date = parseDate(row[columnMap.date]);
          } else {
            date = new Date().toISOString().split('T')[0];
          }

          const category = columnMap.category !== undefined && row[columnMap.category]
            ? String(row[columnMap.category])
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

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo'));
    };

    reader.readAsBinaryString(file);
  });
};
