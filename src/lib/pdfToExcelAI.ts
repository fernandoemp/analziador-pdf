import { GoogleGenerativeAI } from '@google/generative-ai';
import * as XLSX from 'xlsx';

interface ConversionResult {
  success: boolean;
  excelFile?: File;
  error?: string;
  rowCount?: number;
  columnCount?: number;
  method?: 'ai' | 'traditional';
}

type PdfTableAnalysisResult = {
  success: boolean;
  headers?: string[];
  rows?: string[][];
  error?: string;
  model?: string;
  debugInfo?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

type PdfAnalysisProgress = {
  totalParts: number;
  processedParts: number;
  provider: 'gemini' | 'kimi';
  headers?: string[];
  rows?: string[][];
};

type PdfAnalysisOptions = {
  onProgress?: (progress: PdfAnalysisProgress) => void;
  knownHeaders?: string[];
};

type PdfHeaderDetectionResult = {
  success: boolean;
  headers?: string[];
  error?: string;
  model?: string;
  debugInfo?: string;
};

// Importar pdfjs-dist de forma lazy
const getPdfJs = async () => {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  return pdfjsLib;
};

const extractTextFromPDF = async (pdfFile: File): Promise<string> => {
  const pdfjsLib = await getPdfJs();
  const arrayBuffer = await pdfFile.arrayBuffer();
  
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  
  // Extraer texto de todas las páginas
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += `\n--- Página ${i} ---\n${pageText}\n`;
  }

  return fullText;
};

const extractTextChunksFromPDF = async (pdfFile: File, maxPagesPerChunk = 1): Promise<string[]> => {
  const pdfjsLib = await getPdfJs();
  const arrayBuffer = await pdfFile.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const chunks: string[] = [];
  let current = '';
  let pageCount = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    const pageBlock = `\n--- Página ${i} ---\n${pageText}\n`;
    current += pageBlock;
    pageCount += 1;

    if (pageCount >= maxPagesPerChunk) {
      if (current.trim().length > 0) {
        chunks.push(current);
      }
      current = '';
      pageCount = 0;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current);
  }

  return chunks;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const extractJsonFromModelText = (text: string) => {
  let jsonText = text.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```\n?/g, '');
  }
  return jsonText.trim();
};

export const detectPdfHeadersWithGemini = async (
  pdfFile: File,
  apiKey: string,
  modelName = 'gemini-2.0-flash'
): Promise<PdfHeaderDetectionResult> => {
  try {
    if (!apiKey || apiKey.trim() === '') {
      return { success: false, error: 'API Key de Gemini no configurada', model: modelName };
    }

    const chunks = await extractTextChunksFromPDF(pdfFile, 3);
    if (!chunks.length || !chunks[0] || chunks[0].trim().length < 50) {
      return { success: false, error: 'No se pudo extraer suficiente texto de las primeras páginas', model: modelName };
    }

    const sampleText = chunks[0];

    const genAI = new GoogleGenerativeAI(apiKey.trim());
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.1,
        topP: 0.95,
        topK: 40,
      },
    });

    const prompt = `Analiza el siguiente texto extraído de las primeras páginas de un extracto bancario en PDF.

Tu tarea es únicamente identificar el encabezado de la tabla de movimientos/transacciones.

REQUISITOS:
- Identifica las columnas tal y como aparecen en el extracto.
- Respeta el orden exacto de las columnas.
- No inventes ni agregues columnas nuevas.
- No corrijas ni modifiques los nombres de las columnas.

TEXTO DEL PDF (PRIMERAS PÁGINAS):
${sampleText}

Devuelve únicamente un JSON con esta estructura:
{
  "headers": ["columna1", "columna2", "columna3"]
}

REGLAS IMPORTANTES:
- NO incluyas texto adicional, solo el JSON.
- No agregues explicaciones ni comentarios fuera del JSON.

RESPONDE SOLO CON EL JSON, SIN EXPLICACIONES.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonText = extractJsonFromModelText(text);

    let data: { headers: string[] };
    try {
      data = JSON.parse(jsonText);
    } catch {
      return { success: false, error: 'La IA no retornó un JSON válido al detectar encabezados', model: modelName };
    }

    if (!data.headers || !Array.isArray(data.headers) || data.headers.length === 0) {
      return { success: false, error: 'La IA no identificó correctamente el encabezado de columnas', model: modelName };
    }

    return { success: true, headers: data.headers, model: modelName };
  } catch (error: any) {
    let debugInfo: string | undefined;
    try {
      if (error instanceof Error) {
        debugInfo = error.stack || error.message;
      } else {
        debugInfo = JSON.stringify(error);
      }
    } catch {
      debugInfo = String(error);
    }
    return {
      success: false,
      error: error?.message || 'Error desconocido al detectar encabezados con Gemini',
      model: modelName,
      debugInfo,
    };
  }
};

export const analyzePDFWithGemini = async (
  pdfFile: File,
  apiKey: string,
  modelName = 'gemini-2.0-flash',
  options?: PdfAnalysisOptions
): Promise<PdfTableAnalysisResult> => {
  try {
    if (!apiKey || apiKey.trim() === '') {
      return { success: false, error: 'API Key de Gemini no configurada', model: modelName };
    }

    const chunks = await extractTextChunksFromPDF(pdfFile, 1);

    if (!chunks.length || !chunks[0] || chunks[0].trim().length < 50) {
      return { success: false, error: 'No se pudo extraer suficiente texto del PDF', model: modelName };
    }

    const genAI = new GoogleGenerativeAI(apiKey.trim());
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.1,
        topP: 0.95,
        topK: 40,
      },
    });

    const totalParts = chunks.length;
    let processedParts = 0;

    let finalHeaders: string[] | undefined;
    const allRows: string[][] = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTotalTokens = 0;
    let finalModel = modelName;

    for (let index = 0; index < chunks.length; index++) {
      const part = chunks[index];
      if (!part || part.trim().length < 10) {
        continue;
      }

      const knownHeaders = options?.knownHeaders;

      const headersLine = knownHeaders && knownHeaders.length > 0
        ? knownHeaders.map(h => `"${h}"`).join(', ')
        : '"Fecha", "Descripción", "Origen", "Crédito", "Débito", "Saldo"';

      const prompt = `Analiza el siguiente texto extraído de un extracto bancario en PDF y conviértelo a formato de tabla estructurada.

Este texto corresponde a la parte ${index + 1} de ${chunks.length} de un extracto completo. Solo debes procesar las transacciones que aparezcan en este fragmento, sin inventar ni repetir movimientos de otras partes.

REQUISITOS DE ORDEN Y CONTENIDO:
- Mantén el orden exacto en que aparecen las transacciones en el texto.
- No reordenes filas por fecha ni por ningún otro criterio.
- No combines ni separes transacciones: cada línea o movimiento del texto debe corresponder a una fila.
- No corrijas ni modifiques textos, descripciones ni montos.
- No agregues palabras, notas ni aclaraciones a las descripciones.

TEXTO DEL PDF (PARTE ${index + 1}/${chunks.length}):
${part}

INSTRUCCIONES:
1. Identifica las columnas del extracto bancario.
${knownHeaders && knownHeaders.length > 0 ? `Las columnas detectadas previamente son estas y debes usarlas exactamente, en este mismo orden y sin cambiar los nombres:\n[${headersLine}]\n` : ''}
2. Extrae todas las transacciones/movimientos de ESTE FRAGMENTO manteniendo el mismo orden del texto
3. Organiza los datos en formato de tabla
4. Retorna SOLO un JSON con esta estructura exacta:
{
  "headers": [${headersLine}],
  "rows": [
    ["01/12/2024", "Depósito", "ORIGEN", "1000.00", "", "1000.00"],
    ["02/12/2024", "Compra", "ORIGEN", "", "50.00", "950.00"]
  ]
}

REGLAS IMPORTANTES:
- NO incluyas texto adicional, solo el JSON
- No agregues explicaciones, títulos ni comentarios fuera del JSON
- Mantén los valores numéricos como strings
- Si una celda está vacía, usa string vacío ""
- Incluye SOLO las transacciones que aparezcan explícitamente en este fragmento
- NO inventes transacciones ni montos
- No combines ni dividas movimientos: cada transacción del texto corresponde a una fila
- Asegúrate de que cada fila tenga el mismo número de columnas que headers

RESPONDE SOLO CON EL JSON, SIN EXPLICACIONES.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const usage = (response as any).usageMetadata;
      if (usage) {
        totalPromptTokens += usage.promptTokenCount ?? 0;
        totalCompletionTokens += usage.candidatesTokenCount ?? 0;
        totalTotalTokens += usage.totalTokenCount ?? 0;
      }
      const modelVersion = (response as any).modelVersion;
      if (modelVersion && typeof modelVersion === 'string') {
        finalModel = modelVersion;
      }

      const jsonText = extractJsonFromModelText(text);

      let data: { headers: string[]; rows: string[][] };
      try {
        data = JSON.parse(jsonText);
      } catch {
        return { success: false, error: 'La IA no retornó un JSON válido. Intenta de nuevo.', model: modelName };
      }

      if (!data.headers || !Array.isArray(data.headers) || data.headers.length === 0) {
        return { success: false, error: 'La IA no identificó correctamente las columnas', model: modelName };
      }

      if (!data.rows || !Array.isArray(data.rows) || data.rows.length === 0) {
        processedParts += 1;
        options?.onProgress?.({
          totalParts,
          processedParts,
          provider: 'gemini',
        });
        continue;
      }

      if (!finalHeaders) {
        finalHeaders = data.headers;
      }

      allRows.push(...data.rows);

      processedParts += 1;
      options?.onProgress?.({
        totalParts,
        processedParts,
        provider: 'gemini',
        headers: finalHeaders,
        rows: data.rows,
      });
    }

    if (!finalHeaders || allRows.length === 0) {
      return { success: false, error: 'La IA no encontró transacciones en el PDF', model: modelName };
    }

    return {
      success: true,
      headers: finalHeaders,
      rows: allRows,
      model: finalModel,
      usage: {
        promptTokens: totalPromptTokens || undefined,
        completionTokens: totalCompletionTokens || undefined,
        totalTokens: totalTotalTokens || undefined,
      },
    };
  } catch (error: any) {
    let debugInfo: string | undefined;
    try {
      if (error instanceof Error) {
        debugInfo = error.stack || error.message;
      } else {
        debugInfo = JSON.stringify(error);
      }
    } catch {
      debugInfo = String(error);
    }
    return {
      success: false,
      error: error?.message || 'Error desconocido al analizar PDF con Gemini',
      model: modelName,
      debugInfo,
    };
  }
};

type KimiChunkResult = {
  headers: string[];
  rows: string[][];
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  model?: string;
} | null;

export const detectPdfHeadersWithKimi = async (
  pdfFile: File,
  apiKey: string,
  modelName = 'kimi-k2-turbo-preview',
  temperature?: number,
  topP?: number
): Promise<PdfHeaderDetectionResult> => {
  try {
    if (!apiKey || apiKey.trim() === '') {
      return { success: false, error: 'API Key de Kimi no configurada', model: modelName };
    }

    const chunks = await extractTextChunksFromPDF(pdfFile, 3);
    if (!chunks.length || !chunks[0] || chunks[0].trim().length < 50) {
      return { success: false, error: 'No se pudo extraer suficiente texto de las primeras páginas', model: modelName };
    }

    const sampleText = chunks[0];

    const payload: any = {
      model: modelName,
      messages: [
        {
          role: 'system',
          content:
            'Eres un asistente que analiza extractos bancarios y devuelve únicamente JSON válido.',
        },
        {
          role: 'user',
          content: `Analiza el siguiente texto extraído de las primeras páginas de un extracto bancario en PDF.\n\nTu tarea es únicamente identificar el encabezado de la tabla de movimientos/transacciones.\n\nREQUISITOS:\n- Identifica las columnas tal y como aparecen en el extracto.\n- Respeta el orden exacto de las columnas.\n- No inventes ni agregues columnas nuevas.\n- No corrijas ni modifiques los nombres de las columnas.\n\nTEXTO DEL PDF (PRIMERAS PÁGINAS):\n${sampleText}\n\nDevuelve únicamente un JSON con esta estructura:\n{\n  "headers": ["columna1", "columna2", "columna3"]\n}\n\nREGLAS IMPORTANTES:\n- NO incluyas texto adicional, solo el JSON.\n- No agregues explicaciones ni comentarios fuera del JSON.\n\nRESPONDE SOLO CON EL JSON, SIN EXPLICACIONES.`,
        },
      ],
    };

    if (typeof temperature === 'number') {
      payload.temperature = temperature;
    }
    if (typeof topP === 'number') {
      payload.top_p = topP;
    }

    const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      let message = text;
      try {
        const json = JSON.parse(text);
        message = json?.error?.message || text;
      } catch {
      }
      const debugInfo = `HTTP ${response.status} ${response.statusText}\n${text}`;
      return {
        success: false,
        error: `Error de Kimi (${response.status}): ${message}`,
        model: modelName,
        debugInfo,
      };
    }

    const data = await response.json();
    const content =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.message?.content?.[0]?.text ||
      '';

    if (!content || typeof content !== 'string') {
      return { success: false, error: 'La IA no retornó contenido de texto al detectar encabezados', model: modelName };
    }

    const jsonText = extractJsonFromModelText(content);

    let parsed: { headers: string[] };
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return { success: false, error: 'La IA no retornó un JSON válido al detectar encabezados', model: modelName };
    }

    if (!parsed.headers || !Array.isArray(parsed.headers) || parsed.headers.length === 0) {
      return { success: false, error: 'La IA no identificó correctamente el encabezado de columnas', model: modelName };
    }

    return {
      success: true,
      headers: parsed.headers,
      model: data?.model || modelName,
    };
  } catch (error: any) {
    let debugInfo: string | undefined;
    try {
      if (error instanceof Error) {
        debugInfo = error.stack || error.message;
      } else {
        debugInfo = JSON.stringify(error);
      }
    } catch {
      debugInfo = String(error);
    }
    return {
      success: false,
      error: error?.message || 'Error desconocido al detectar encabezados con Kimi',
      model: modelName,
      debugInfo,
    };
  }
};

export const analyzePDFWithKimi = async (
  pdfFile: File,
  apiKey: string,
  modelName = 'kimi-k2-turbo-preview',
  temperature?: number,
  topP?: number,
  options?: PdfAnalysisOptions
): Promise<PdfTableAnalysisResult> => {
  try {
    if (!apiKey || apiKey.trim() === '') {
      return { success: false, error: 'API Key de Kimi no configurada', model: modelName };
    }

    const chunks = await extractTextChunksFromPDF(pdfFile, 1);

    if (!chunks.length || !chunks[0] || chunks[0].trim().length < 50) {
      return { success: false, error: 'No se pudo extraer suficiente texto del PDF', model: modelName };
    }

    const totalParts = chunks.length;
    let processedParts = 0;

    let finalHeaders: string[] | undefined;
    const allRows: string[][] = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTotalTokens = 0;
    let finalModel = modelName;

    for (let index = 0; index < chunks.length; index++) {
      const part = chunks[index];
      if (!part || part.trim().length < 10) {
        continue;
      }

      if (index > 0) {
        await sleep(1100);
      }

      const knownHeaders = options?.knownHeaders;

      const headersLine = knownHeaders && knownHeaders.length > 0
        ? knownHeaders.map(h => `"${h}"`).join(', ')
        : '"Fecha", "Descripción", "Origen", "Crédito", "Débito", "Saldo"';

      const payload: any = {
        model: modelName,
        messages: [
          {
            role: 'system',
            content:
              'Eres un asistente que convierte extractos bancarios en tablas estructuradas. Devuelves únicamente JSON válido.',
          },
          {
            role: 'user',
            content: `Analiza el siguiente texto extraído de un extracto bancario en PDF y conviértelo a formato de tabla estructurada.\n\nEste texto corresponde a la parte ${index + 1} de ${chunks.length} de un extracto completo. Solo debes procesar las transacciones que aparezcan en este fragmento, sin inventar ni repetir movimientos de otras partes.\n\nREQUISITOS DE ORDEN Y CONTENIDO:\n- Mantén el orden exacto en que aparecen las transacciones en el texto.\n- No reordenes filas por fecha ni por ningún otro criterio.\n- No combines ni separes transacciones: cada línea o movimiento del texto debe corresponder a una fila.\n- No corrijas ni modifiques textos, descripciones ni montos.\n- No agreges palabras, notas ni aclaraciones a las descripciones.\n\nTEXTO DEL PDF (PARTE ${index + 1}/${chunks.length}):\n${part}\n\nINSTRUCCIONES:\n1. Identifica las columnas del extracto bancario.\n${knownHeaders && knownHeaders.length > 0 ? `Las columnas detectadas previamente son estas y debes usarlas exactamente, en este mismo orden y sin cambiar los nombres:\n[${headersLine}]\n` : ''}2. Extrae todas las transacciones/movimientos de ESTE FRAGMENTO manteniendo el mismo orden del texto\n3. Organiza los datos en formato de tabla\n4. Retorna SOLO un JSON con esta estructura exacta:\n{\n  "headers": [${headersLine}],\n  "rows": [\n    ["01/12/2024", "Depósito", "ORIGEN", "1000.00", "", "1000.00"],\n    ["02/12/2024", "Compra", "ORIGEN", "", "50.00", "950.00"]\n  ]\n}\n\nREGLAS IMPORTANTES:\n- NO incluyas texto adicional, solo el JSON\n- No agregues explicaciones, títulos ni comentarios fuera del JSON\n- Mantén los valores numéricos como strings\n- Si una celda está vacía, usa string vacío \"\"\n- Incluye SOLO las transacciones que aparezcan explícitamente en este fragmento\n- NO inventes transacciones ni montos\n- No combines ni dividas movimientos: cada transacción del texto corresponde a una fila\n- Asegúrate de que cada fila tenga el mismo número de columnas que headers\n\nRESPONDE SOLO CON EL JSON, SIN EXPLICACIONES.`,
          },
        ],
      };

      if (typeof temperature === 'number') {
        payload.temperature = temperature;
      }
      if (typeof topP === 'number') {
        payload.top_p = topP;
      }

      const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        let message = text;
        try {
          const json = JSON.parse(text);
          message = json?.error?.message || text;
        } catch {
        }
        const debugInfo = `HTTP ${response.status} ${response.statusText}\n${text}`;
        return {
          success: false,
          error: `Error de Kimi (${response.status}): ${message}`,
          model: modelName,
          debugInfo,
        };
      }

      const data = await response.json();
      const content =
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.message?.content?.[0]?.text ||
        '';

      if (!content || typeof content !== 'string') {
        return { success: false, error: 'La IA no retornó contenido de texto', model: modelName };
      }

      const jsonText = extractJsonFromModelText(content);

      let parsed: { headers: string[]; rows: string[][] };
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        return { success: false, error: 'La IA no retornó un JSON válido. Intenta de nuevo.', model: modelName };
      }

      if (!parsed.headers || !Array.isArray(parsed.headers) || parsed.headers.length === 0) {
        return { success: false, error: 'La IA no identificó correctamente las columnas', model: modelName };
      }
      if (!parsed.rows || !Array.isArray(parsed.rows) || parsed.rows.length === 0) {
        processedParts += 1;
        options?.onProgress?.({
          totalParts,
          processedParts,
          provider: 'kimi',
        });
        continue;
      }

      if (!finalHeaders) {
        finalHeaders = parsed.headers;
      }

      allRows.push(...parsed.rows);

      const usage = data?.usage;
      if (usage) {
        totalPromptTokens += usage.prompt_tokens ?? usage.promptTokens ?? 0;
        totalCompletionTokens += usage.completion_tokens ?? usage.completionTokens ?? 0;
        totalTotalTokens += usage.total_tokens ?? usage.totalTokens ?? 0;
      }
      if (data?.model) {
        finalModel = data.model;
      }

      processedParts += 1;
      options?.onProgress?.({
        totalParts,
        processedParts,
        provider: 'kimi',
        headers: finalHeaders,
        rows: parsed.rows,
      });
    }

    if (!finalHeaders || allRows.length === 0) {
      return { success: false, error: 'La IA no encontró transacciones en el PDF', model: modelName };
    }

    return {
      success: true,
      headers: finalHeaders,
      rows: allRows,
      model: finalModel,
      usage: {
        promptTokens: totalPromptTokens || undefined,
        completionTokens: totalCompletionTokens || undefined,
        totalTokens: totalTotalTokens || undefined,
      },
    };
  } catch (error: any) {
    let debugInfo: string | undefined;
    try {
      if (error instanceof Error) {
        debugInfo = error.stack || error.message;
      } else {
        debugInfo = JSON.stringify(error);
      }
    } catch {
      debugInfo = String(error);
    }
    return {
      success: false,
      error: error?.message || 'Error desconocido al analizar PDF con Kimi',
      model: modelName,
      debugInfo,
    };
  }
};

/**
 * Convierte un archivo PDF a Excel usando Gemini AI
 */
export const convertPDFToExcelWithAI = async (
  pdfFile: File,
  apiKey: string
): Promise<ConversionResult> => {
  try {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('API Key de Gemini no configurada');
    }

    // Extraer texto del PDF
    console.log('Extrayendo texto del PDF...');
    const pdfText = await extractTextFromPDF(pdfFile);

    if (!pdfText || pdfText.trim().length < 50) {
      throw new Error('No se pudo extraer suficiente texto del PDF');
    }

    console.log(`Texto extraído: ${pdfText.length} caracteres`);

    // Inicializar Gemini AI con modelo estable y optimizado
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.1, // Baja temperatura para mayor precisión
        topP: 0.95,
        topK: 40,
      }
    });

    // Prompt para Gemini
    const prompt = `Analiza el siguiente texto extraído de un extracto bancario en PDF y conviértelo a formato de tabla estructurada.

TEXTO DEL PDF:
${pdfText}

INSTRUCCIONES:
1. Identifica las columnas del extracto bancario (Fecha, Concepto/Descripción, Crédito, Débito, Saldo, etc.)
2. Extrae todas las transacciones/movimientos
3. Organiza los datos en formato de tabla
4. Retorna SOLO un JSON con esta estructura exacta:
{
  "headers": ["Fecha", "Concepto", "Crédito", "Débito", "Saldo"],
  "rows": [
    ["01/12/2024", "Depósito", "1000.00", "", "1000.00"],
    ["02/12/2024", "Compra", "", "50.00", "950.00"]
  ]
}

REGLAS IMPORTANTES:
- NO incluyas texto adicional, solo el JSON
- Usa los nombres de columna exactos que aparecen en el PDF
- Mantén los valores numéricos como strings
- Si una celda está vacía, usa string vacío ""
- Incluye TODAS las transacciones que encuentres
- Asegúrate de que cada fila tenga el mismo número de columnas que headers

RESPONDE SOLO CON EL JSON, SIN EXPLICACIONES.`;

    console.log('Enviando a Gemini AI...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('Respuesta de Gemini:', text.substring(0, 200) + '...');

    // Limpiar la respuesta (remover markdown si existe)
    const jsonText = extractJsonFromModelText(text);

    // Parsear JSON
    let data: { headers: string[]; rows: string[][] };
    try {
      data = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Error al parsear JSON:', parseError);
      console.error('Texto recibido:', jsonText);
      throw new Error('La IA no retornó un JSON válido. Intenta de nuevo.');
    }

    // Validar estructura
    if (!data.headers || !Array.isArray(data.headers) || data.headers.length === 0) {
      throw new Error('La IA no identificó correctamente las columnas');
    }

    if (!data.rows || !Array.isArray(data.rows) || data.rows.length === 0) {
      throw new Error('La IA no encontró transacciones en el PDF');
    }

    console.log(`IA procesó: ${data.rows.length} filas, ${data.headers.length} columnas`);

    // Crear array de datos para Excel (headers + rows)
    const excelData = [data.headers, ...data.rows];

    // Crear workbook de Excel
    const worksheet = XLSX.utils.aoa_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');

    // Ajustar ancho de columnas automáticamente
    const maxWidths = data.headers.map((_, colIndex) => {
      const columnValues = excelData.map(row => String(row[colIndex] || ''));
      const maxLength = Math.max(...columnValues.map(val => val.length));
      return { wch: Math.min(maxLength + 2, 50) };
    });
    worksheet['!cols'] = maxWidths;

    // Aplicar formato a encabezados
    const headerRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!worksheet[cellAddress]) continue;
      worksheet[cellAddress].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'CCCCCC' } }
      };
    }

    // Convertir a buffer
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    
    // Crear archivo Excel
    const excelBlob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    const originalName = pdfFile.name.replace(/\.pdf$/i, '');
    const excelFile = new File([excelBlob], `${originalName}_AI.xlsx`, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    console.log(`✅ PDF convertido exitosamente con IA`);

    return {
      success: true,
      excelFile,
      rowCount: data.rows.length,
      columnCount: data.headers.length,
      method: 'ai'
    };

  } catch (error: any) {
    console.error('Error al convertir PDF con IA:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al convertir PDF con IA',
      method: 'ai'
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
