import * as XLSX from 'xlsx';

// Importar pdfjs-dist de forma lazy
const getPdfJs = async () => {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  return pdfjsLib;
};

interface ConversionResult {
  success: boolean;
  excelFile?: File;
  error?: string;
  rowCount?: number;
  columnCount?: number;
}

/**
 * Convierte un archivo PDF a Excel extrayendo el texto y detectando estructura tabular
 */
export const convertPDFToExcel = async (pdfFile: File): Promise<ConversionResult> => {
  try {
    const pdfjsLib = await getPdfJs();
    const arrayBuffer = await pdfFile.arrayBuffer();
    
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
      return {
        success: false,
        error: 'No se pudo extraer suficiente texto del PDF'
      };
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
      return {
        success: false,
        error: 'No se pudo detectar la estructura de columnas en el PDF'
      };
    }

    // Dividir el encabezado en columnas (por múltiples espacios)
    const headers = headerLine
      .split(/\s{2,}/)
      .map(h => h.trim())
      .filter(h => h.length > 0);

    if (headers.length < 2) {
      return {
        success: false,
        error: 'No se pudieron detectar suficientes columnas en el PDF'
      };
    }

    // Extraer filas de datos
    const dataLines = lines.slice(headerIndex + 1);
    const rows: string[][] = [];

    // Agregar encabezados como primera fila
    rows.push(headers);

    // Procesar cada línea de datos
    for (const line of dataLines) {
      const values = line.split(/\s{2,}/).map(v => v.trim());
      
      // Verificar que la línea tenga suficientes valores
      if (values.length < 2) continue;
      
      // Verificar que parezca una fila de datos (no es un subtítulo o pie de página)
      const hasNumbers = values.some(v => /\d/.test(v));
      if (!hasNumbers) continue;

      // Ajustar el número de columnas al número de headers
      const row = new Array(headers.length).fill('');
      for (let i = 0; i < Math.min(values.length, headers.length); i++) {
        row[i] = values[i];
      }
      
      rows.push(row);
    }

    if (rows.length <= 1) {
      return {
        success: false,
        error: 'No se encontraron filas de datos válidas en el PDF'
      };
    }

    // Crear workbook de Excel
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');

    // Ajustar ancho de columnas automáticamente
    const maxWidths = headers.map((_, colIndex) => {
      const columnValues = rows.map(row => String(row[colIndex] || ''));
      const maxLength = Math.max(...columnValues.map(val => val.length));
      return { wch: Math.min(maxLength + 2, 50) }; // Máximo 50 caracteres
    });
    worksheet['!cols'] = maxWidths;

    // Convertir a buffer
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    
    // Crear archivo Excel
    const excelBlob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    const originalName = pdfFile.name.replace(/\.pdf$/i, '');
    const excelFile = new File([excelBlob], `${originalName}_convertido.xlsx`, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    console.log(`PDF convertido a Excel: ${rows.length - 1} filas, ${headers.length} columnas`);

    return {
      success: true,
      excelFile,
      rowCount: rows.length - 1, // Sin contar encabezados
      columnCount: headers.length
    };

  } catch (error: unknown) {
    console.error('Error al convertir PDF a Excel:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error desconocido al convertir PDF'
    };
  }
};

/**
 * Descarga un archivo Excel generado
 */
export const downloadExcelFile = (file: File) => {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
