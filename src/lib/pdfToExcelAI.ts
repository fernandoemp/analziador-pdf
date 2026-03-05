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
  kind?: 'analyze_part';
  segmentId?: string;
  partIndex?: number;
  status?: 'in_progress' | 'completed' | 'failed';
  elapsedMs?: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  error?: string;
  rowCount?: number;
};

type PdfAnalysisOptions = {
  onProgress?: (progress: PdfAnalysisProgress) => void;
  knownHeaders?: string[];
  signal?: AbortSignal;
  startPartIndex?: number;
  initialProcessedParts?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
};

type PdfHeaderDetectionResult = {
  success: boolean;
  headers?: string[];
  error?: string;
  model?: string;
  debugInfo?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

type PdfTextItemRaw = { str?: unknown };

type GeminiUsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

type GeminiResponse = {
  text: () => string;
  usageMetadata?: GeminiUsageMetadata;
  modelVersion?: unknown;
};

type GeminiGenerateContentResult = {
  response: Promise<GeminiResponse>;
};

type GeminiStreamChunk = {
  text: () => string;
};

type GeminiStreamResult = {
  stream: AsyncIterable<GeminiStreamChunk>;
  response: Promise<GeminiResponse>;
};

// Importar pdfjs-dist de forma lazy
const getPdfJs = async () => {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  return pdfjsLib;
};

const itemsToText = (items: unknown): string => {
  if (!Array.isArray(items)) return '';
  return (items as PdfTextItemRaw[])
    .map(item => (typeof item?.str === 'string' ? item.str : ''))
    .filter(Boolean)
    .join(' ');
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
    const pageText = itemsToText((textContent as { items?: unknown })?.items);
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
    const pageText = itemsToText((textContent as { items?: unknown })?.items);
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

const parseRateLimitError = (error: unknown) => {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);
  const lowered = raw.toLowerCase();
  const isRateLimit =
    lowered.includes('resource_exhausted') ||
    lowered.includes('quota exceeded') ||
    lowered.includes('rate limit') ||
    lowered.includes('429') ||
    lowered.includes('generate_content_free_tier_requests');
  if (!isRateLimit) return null;
  const retryMatch = raw.match(/retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i) || raw.match(/retry in (\d+(?:\.\d+)?)s/i);
  const retrySeconds = retryMatch ? Number(retryMatch[1]) : null;
  const retryText = retrySeconds ? ` Reintenta en ${Math.ceil(retrySeconds)}s.` : ' Reintenta en unos segundos.';
  return {
    message: `Se alcanzó el límite de cuota (429) en Gemini.${retryText} Revisa tu plan y límites.`,
    debugInfo: raw,
  };
};

export const detectPdfHeadersWithGemini = async (
  pdfFile: File,
  apiKey: string,
  modelName = 'gemini-2.0-flash',
  temperature?: number,
  topP?: number,
  stream?: boolean
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
        temperature: typeof temperature === 'number' ? temperature : 0.1,
        topP: typeof topP === 'number' ? topP : 0.95,
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

    const shouldStream = !!stream;
    const modelWithStream = model as unknown as {
      generateContentStream?: (prompt: string) => Promise<GeminiStreamResult>;
    };
    let result: GeminiGenerateContentResult | GeminiStreamResult;
    try {
      result =
        shouldStream && typeof modelWithStream.generateContentStream === 'function'
          ? await modelWithStream.generateContentStream(prompt)
          : ((await model.generateContent(prompt)) as unknown as GeminiGenerateContentResult);
    } catch (error: unknown) {
      const rate = parseRateLimitError(error);
      if (rate) {
        return { success: false, error: rate.message, model: modelName, debugInfo: rate.debugInfo };
      }
      throw error;
    }
    const response = await result.response;
    let text = '';
    if (shouldStream && 'stream' in result) {
      for await (const chunk of (result as GeminiStreamResult).stream) {
        text += chunk.text();
      }
    } else {
      text = response.text();
    }

    const geminiMeta = response as unknown as { usageMetadata?: GeminiUsageMetadata; modelVersion?: unknown };
    const usageMeta = geminiMeta.usageMetadata;
    const usage = usageMeta
      ? {
          promptTokens: usageMeta.promptTokenCount ?? 0,
          completionTokens: usageMeta.candidatesTokenCount ?? 0,
          totalTokens: usageMeta.totalTokenCount ?? 0,
        }
      : undefined;
    const modelVersion = geminiMeta.modelVersion;

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

    return {
      success: true,
      headers: data.headers,
      model: typeof modelVersion === 'string' ? modelVersion : modelName,
      usage,
    };
  } catch (error: unknown) {
    const rate = parseRateLimitError(error);
    if (rate) {
      return { success: false, error: rate.message, model: modelName, debugInfo: rate.debugInfo };
    }
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
      error: error instanceof Error ? error.message : 'Error desconocido al detectar encabezados con Gemini',
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
        temperature: typeof options?.temperature === 'number' ? options.temperature : 0.1,
        topP: typeof options?.topP === 'number' ? options.topP : 0.95,
        topK: 40,
      },
    });

    const totalParts = chunks.length;
    let processedParts = typeof options?.initialProcessedParts === 'number' ? options.initialProcessedParts : 0;
    const startPartIndex = typeof options?.startPartIndex === 'number' ? options.startPartIndex : 0;

    let finalHeaders: string[] | undefined;
    const allRows: string[][] = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTotalTokens = 0;
    let finalModel = modelName;

    for (let index = startPartIndex; index < chunks.length; index++) {
      if (options?.signal?.aborted) {
        return { success: false, error: 'ABORTED', model: modelName };
      }
      const segmentId = `parte-${index + 1}`;
      const part = chunks[index];
      if (!part || part.trim().length < 10) {
        processedParts += 1;
        options?.onProgress?.({
          totalParts,
          processedParts,
          provider: 'gemini',
          kind: 'analyze_part',
          segmentId,
          partIndex: index + 1,
          status: 'completed',
          elapsedMs: 0,
          rowCount: 0,
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
        });
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

      const partStartedAt = Date.now();
      options?.onProgress?.({
        totalParts,
        processedParts,
        provider: 'gemini',
        kind: 'analyze_part',
        segmentId,
        partIndex: index + 1,
        status: 'in_progress',
      });

      const shouldStream = !!options?.stream;
      const modelWithStream = model as unknown as {
        generateContentStream?: (prompt: string) => Promise<GeminiStreamResult>;
      };
      let result: GeminiGenerateContentResult | GeminiStreamResult;
      try {
        result =
          shouldStream && typeof modelWithStream.generateContentStream === 'function'
            ? await modelWithStream.generateContentStream(prompt)
            : ((await model.generateContent(prompt)) as unknown as GeminiGenerateContentResult);
      } catch (error: unknown) {
        const rate = parseRateLimitError(error);
        if (rate) {
          return { success: false, error: rate.message, model: modelName, debugInfo: rate.debugInfo };
        }
        throw error;
      }
      const response = await result.response;
      let text = '';
      if (shouldStream && 'stream' in result) {
        for await (const chunk of (result as GeminiStreamResult).stream) {
          if (options?.signal?.aborted) {
            return { success: false, error: 'ABORTED', model: modelName };
          }
          text += chunk.text();
        }
      } else {
        text = response.text();
      }
      const partEndedAt = Date.now();
      const partElapsedMs = partEndedAt - partStartedAt;

      if (options?.signal?.aborted) {
        return { success: false, error: 'ABORTED', model: modelName };
      }

      const geminiMeta = response as unknown as { usageMetadata?: GeminiUsageMetadata; modelVersion?: unknown };
      const usage = geminiMeta.usageMetadata;
      const partUsage = usage
        ? {
            promptTokens: usage.promptTokenCount ?? 0,
            completionTokens: usage.candidatesTokenCount ?? 0,
            totalTokens: usage.totalTokenCount ?? 0,
          }
        : undefined;
      if (usage) {
        totalPromptTokens += usage.promptTokenCount ?? 0;
        totalCompletionTokens += usage.candidatesTokenCount ?? 0;
        totalTotalTokens += usage.totalTokenCount ?? 0;
      }
      const modelVersion = geminiMeta.modelVersion;
      if (modelVersion && typeof modelVersion === 'string') {
        finalModel = modelVersion;
      }

      const jsonText = extractJsonFromModelText(text);

      let data: { headers: string[]; rows: string[][] };
      try {
        data = JSON.parse(jsonText);
      } catch {
        processedParts += 1;
        options?.onProgress?.({
          totalParts,
          processedParts,
          provider: 'gemini',
          kind: 'analyze_part',
          segmentId,
          partIndex: index + 1,
          status: 'failed',
          elapsedMs: partElapsedMs,
          usage: partUsage,
          rowCount: 0,
          error: 'La IA no retornó un JSON válido. Intenta de nuevo.',
        });
        continue;
      }

      if (!data.headers || !Array.isArray(data.headers) || data.headers.length === 0) {
        processedParts += 1;
        options?.onProgress?.({
          totalParts,
          processedParts,
          provider: 'gemini',
          kind: 'analyze_part',
          segmentId,
          partIndex: index + 1,
          status: 'failed',
          elapsedMs: partElapsedMs,
          usage: partUsage,
          rowCount: 0,
          error: 'La IA no identificó correctamente las columnas',
        });
        continue;
      }

      if (!data.rows || !Array.isArray(data.rows) || data.rows.length === 0) {
        processedParts += 1;
        options?.onProgress?.({
          totalParts,
          processedParts,
          provider: 'gemini',
          kind: 'analyze_part',
          segmentId,
          partIndex: index + 1,
          status: 'completed',
          elapsedMs: partElapsedMs,
          usage: partUsage,
          rowCount: 0,
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
        kind: 'analyze_part',
        segmentId,
        partIndex: index + 1,
        status: 'completed',
        elapsedMs: partElapsedMs,
        usage: partUsage,
        rowCount: data.rows.length,
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
  } catch (error: unknown) {
    const rate = parseRateLimitError(error);
    if (rate) {
      return { success: false, error: rate.message, model: modelName, debugInfo: rate.debugInfo };
    }
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
      error: error instanceof Error ? error.message : 'Error desconocido al analizar PDF con Gemini',
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

    const payload: Record<string, unknown> = {
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
      let errorJson: unknown = null;
      try {
        errorJson = JSON.parse(text) as unknown;
      } catch (e) {
        errorJson = null;
      }
      if (errorJson && typeof errorJson === 'object') {
        const maybeMessage = (errorJson as { error?: { message?: unknown } })?.error?.message;
        if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
          message = maybeMessage;
        }
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

    const usage = data?.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? data.usage.promptTokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? data.usage.completionTokens ?? 0,
          totalTokens: data.usage.total_tokens ?? data.usage.totalTokens ?? 0,
        }
      : undefined;

    return {
      success: true,
      headers: parsed.headers,
      model: data?.model || modelName,
      usage,
    };
  } catch (error: unknown) {
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
      error: error instanceof Error ? error.message : 'Error desconocido al detectar encabezados con Kimi',
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
    let processedParts = typeof options?.initialProcessedParts === 'number' ? options.initialProcessedParts : 0;
    const startPartIndex = typeof options?.startPartIndex === 'number' ? options.startPartIndex : 0;

    let finalHeaders: string[] | undefined;
    const allRows: string[][] = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTotalTokens = 0;
    let finalModel = modelName;

    for (let index = startPartIndex; index < chunks.length; index++) {
      if (options?.signal?.aborted) {
        return { success: false, error: 'ABORTED', model: modelName };
      }
      const segmentId = `parte-${index + 1}`;
      const part = chunks[index];
      if (!part || part.trim().length < 10) {
        processedParts += 1;
        options?.onProgress?.({
          totalParts,
          processedParts,
          provider: 'kimi',
          kind: 'analyze_part',
          segmentId,
          partIndex: index + 1,
          status: 'completed',
          elapsedMs: 0,
          rowCount: 0,
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
        });
        continue;
      }

      if (index > 0) {
        await sleep(1100);
      }

      const knownHeaders = options?.knownHeaders;

      const headersLine = knownHeaders && knownHeaders.length > 0
        ? knownHeaders.map(h => `"${h}"`).join(', ')
        : '"Fecha", "Descripción", "Origen", "Crédito", "Débito", "Saldo"';

      const userPromptLines: string[] = [
        'Analiza el siguiente texto extraído de un extracto bancario en PDF y conviértelo a formato de tabla estructurada.',
        '',
        `Este texto corresponde a la parte ${index + 1} de ${chunks.length} de un extracto completo. Solo debes procesar las transacciones que aparezcan en este fragmento, sin inventar ni repetir movimientos de otras partes.`,
        '',
        'REQUISITOS DE ORDEN Y CONTENIDO:',
        '- Mantén el orden exacto en que aparecen las transacciones en el texto.',
        '- No reordenes filas por fecha ni por ningún otro criterio.',
        '- No combines ni separes transacciones: cada línea o movimiento del texto debe corresponder a una fila.',
        '- No corrijas ni modifiques textos, descripciones ni montos.',
        '- No agreges palabras, notas ni aclaraciones a las descripciones.',
        '',
        `TEXTO DEL PDF (PARTE ${index + 1}/${chunks.length}):`,
        part,
        '',
        'INSTRUCCIONES:',
        '1. Identifica las columnas del extracto bancario.',
      ];

      if (knownHeaders && knownHeaders.length > 0) {
        userPromptLines.push(
          'Las columnas detectadas previamente son estas y debes usarlas exactamente, en este mismo orden y sin cambiar los nombres:',
          `[${headersLine}]`,
          '',
        );
      }

      userPromptLines.push(
        '2. Extrae todas las transacciones/movimientos de ESTE FRAGMENTO manteniendo el mismo orden del texto',
        '3. Organiza los datos en formato de tabla',
        '4. Retorna SOLO un JSON con esta estructura exacta:',
        '{',
        `  "headers": [${headersLine}],`,
        '  "rows": [',
        '    ["01/12/2024", "Depósito", "ORIGEN", "1000.00", "", "1000.00"],',
        '    ["02/12/2024", "Compra", "ORIGEN", "", "50.00", "950.00"]',
        '  ]',
        '}',
        '',
        'REGLAS IMPORTANTES:',
        '- NO incluyas texto adicional, solo el JSON',
        '- No agregues explicaciones, títulos ni comentarios fuera del JSON',
        '- Mantén los valores numéricos como strings',
        '- Si una celda está vacía, usa string vacío ""',
        '- Incluye SOLO las transacciones que aparezcan explícitamente en este fragmento',
        '- NO inventes transacciones ni montos',
        '- No combines ni dividas movimientos: cada transacción del texto corresponde a una fila',
        '- Asegúrate de que cada fila tenga el mismo número de columnas que headers',
        '',
        'RESPONDE SOLO CON EL JSON, SIN EXPLICACIONES.',
      );

      const payload: Record<string, unknown> = {
        model: modelName,
        messages: [
          {
            role: 'system',
            content:
              'Eres un asistente que convierte extractos bancarios en tablas estructuradas. Devuelves únicamente JSON válido.',
          },
          {
            role: 'user',
            content: userPromptLines.join('\n'),
          },
        ],
      };

      if (typeof temperature === 'number') {
        payload.temperature = temperature;
      }
      if (typeof topP === 'number') {
        payload.top_p = topP;
      }

      const partStartedAt = Date.now();
      options?.onProgress?.({
        totalParts,
        processedParts,
        provider: 'kimi',
        kind: 'analyze_part',
        segmentId,
        partIndex: index + 1,
        status: 'in_progress',
      });

      const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify(payload),
        signal: options?.signal,
      });
      const partEndedAt = Date.now();
      const partElapsedMs = partEndedAt - partStartedAt;

      if (options?.signal?.aborted) {
        return { success: false, error: 'ABORTED', model: modelName };
      }

      if (!response.ok) {
        const text = await response.text();
        let message = text;
        try {
          const json = JSON.parse(text);
          message = json?.error?.message || text;
        } catch {
          message = text;
        }
        const debugInfo = `HTTP ${response.status} ${response.statusText}\n${text}`;
        processedParts += 1;
        options?.onProgress?.({
          totalParts,
          processedParts,
          provider: 'kimi',
          kind: 'analyze_part',
          segmentId,
          partIndex: index + 1,
          status: 'failed',
          elapsedMs: partElapsedMs,
          rowCount: 0,
          error: `Error de Kimi (${response.status}): ${message}`,
        });
        continue;
      }

      const data = await response.json();
      const content =
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.message?.content?.[0]?.text ||
        '';

      if (!content || typeof content !== 'string') {
        processedParts += 1;
        options?.onProgress?.({
          totalParts,
          processedParts,
          provider: 'kimi',
          kind: 'analyze_part',
          segmentId,
          partIndex: index + 1,
          status: 'failed',
          elapsedMs: partElapsedMs,
          rowCount: 0,
          error: 'La IA no retornó contenido de texto',
        });
        continue;
      }

      const jsonText = extractJsonFromModelText(content);

      let parsed: { headers: string[]; rows: string[][] };
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        processedParts += 1;
        options?.onProgress?.({
          totalParts,
          processedParts,
          provider: 'kimi',
          kind: 'analyze_part',
          segmentId,
          partIndex: index + 1,
          status: 'failed',
          elapsedMs: partElapsedMs,
          rowCount: 0,
          error: 'La IA no retornó un JSON válido. Intenta de nuevo.',
        });
        continue;
      }

      if (!parsed.headers || !Array.isArray(parsed.headers) || parsed.headers.length === 0) {
        processedParts += 1;
        options?.onProgress?.({
          totalParts,
          processedParts,
          provider: 'kimi',
          kind: 'analyze_part',
          segmentId,
          partIndex: index + 1,
          status: 'failed',
          elapsedMs: partElapsedMs,
          rowCount: 0,
          error: 'La IA no identificó correctamente las columnas',
        });
        continue;
      }
      if (!parsed.rows || !Array.isArray(parsed.rows) || parsed.rows.length === 0) {
        processedParts += 1;
        options?.onProgress?.({
          totalParts,
          processedParts,
          provider: 'kimi',
          kind: 'analyze_part',
          segmentId,
          partIndex: index + 1,
          status: 'completed',
          elapsedMs: partElapsedMs,
          rowCount: 0,
        });
        continue;
      }

      if (!finalHeaders) {
        finalHeaders = parsed.headers;
      }

      allRows.push(...parsed.rows);

      const usage = data?.usage;
      const partUsage = usage
        ? {
            promptTokens: usage.prompt_tokens ?? usage.promptTokens ?? 0,
            completionTokens: usage.completion_tokens ?? usage.completionTokens ?? 0,
            totalTokens: usage.total_tokens ?? usage.totalTokens ?? 0,
          }
        : undefined;
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
        kind: 'analyze_part',
        segmentId,
        partIndex: index + 1,
        status: 'completed',
        elapsedMs: partElapsedMs,
        usage: partUsage,
        rowCount: parsed.rows.length,
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
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { success: false, error: 'ABORTED', model: modelName };
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'ABORTED', model: modelName };
    }
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
    const errorMessage =
      error instanceof Error ? error.message : 'Error desconocido al analizar PDF con Kimi';
    return {
      success: false,
      error: errorMessage,
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

  } catch (error: unknown) {
    console.error('Error al convertir PDF con IA:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error desconocido al convertir PDF con IA',
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
