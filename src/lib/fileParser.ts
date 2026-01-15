import { Transaction, FileSourceType, BankColumnMapping, Bank, FileFormatType } from '@/types/finanzas';
import { parseCSVFile } from './csvParser';
import { parseExcelFile } from './excelParser';
import { parsePDFFile } from './pdfParser';

export const parseFile = async (
  file: File,
  fileId: string,
  sourceType: FileSourceType,
  bankName: string,
  bank: Bank
): Promise<Transaction[]> => {
  const fileName = file.name.toLowerCase();
  const fileExtension = fileName.split('.').pop() || '';

  console.log('Procesando archivo:', fileName, 'Extensión:', fileExtension, 'Tipo MIME:', file.type, 'Banco:', bankName);

  // Determinar el mapeo de columnas a usar
  let columnMapping: BankColumnMapping | undefined;

  // 1. Buscar configuración específica para este tipo de archivo
  if (bank.fileFormats && bank.fileFormats.length > 0) {
    const formatConfig = bank.fileFormats.find(f => f.format === fileExtension);
    if (formatConfig) {
      console.log(`Usando configuración específica para ${fileExtension}:`, formatConfig.name);
      columnMapping = formatConfig.columnMapping;
    }
  }

  // 2. Si no hay configuración específica, usar la configuración por defecto
  if (!columnMapping && bank.columnMapping) {
    console.log('Usando configuración por defecto del banco');
    columnMapping = bank.columnMapping;
  }

  // Detectar por extensión y tipo MIME
  if (fileExtension === 'csv' || file.type === 'text/csv' || file.type === 'application/csv') {
    console.log('Usando parser CSV');
    return parseCSVFile(file, fileId, sourceType, bankName, columnMapping);
  } else if (fileExtension === 'xlsx' || fileExtension === 'xls' || 
             file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
             file.type === 'application/vnd.ms-excel') {
    console.log('Usando parser Excel');
    return parseExcelFile(file, fileId, sourceType, bankName, columnMapping);
  } else if (fileExtension === 'pdf' || file.type === 'application/pdf') {
    console.log('Usando parser PDF');
    return parsePDFFile(file, fileId, sourceType, bankName, columnMapping);
  } else {
    throw new Error(`Formato de archivo no soportado: ${fileExtension}. Por favor, usa CSV o Excel.`);
  }
};
