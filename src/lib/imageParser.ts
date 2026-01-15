import { InvoiceData, InvoiceItem } from '@/types/finanzas';

interface TesseractModule {
  recognize: (image: string | Blob, lang: string, options?: unknown) => Promise<{ data?: { text?: string } }>;
}

declare global {
  interface Window {
    Tesseract?: TesseractModule;
  }
}

const loadTesseract = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/tesseract.js@4.0.2/dist/tesseract.min.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Tesseract.js'));
    document.head.appendChild(script);
  });
};

const preprocessImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const maxW = 1800;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const w = Math.floor(img.width * scale);
      const h = Math.floor(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo inicializar el contexto del canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = r * 0.299 + g * 0.587 + b * 0.114;
        sum += gray;
      }
      const avg = sum / (data.length / 4);
      const threshold = Math.min(255, Math.max(100, avg + 10));
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        let gray = r * 0.299 + g * 0.587 + b * 0.114;
        gray = Math.min(255, Math.max(0, (gray - avg) * 1.2 + avg));
        const bw = gray > threshold ? 255 : 0;
        data[i] = bw;
        data[i + 1] = bw;
        data[i + 2] = bw;
      }
      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) resolve(blob); else reject(new Error('No se pudo crear blob de imagen'));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo cargar la imagen'));
    };
    img.src = url;
  });
};

const parseMoney = (s: string): number | undefined => {
  const cleaned = s.replace(/[\s$€₡]/g, '').replace(/\./g, '').replace(/,/g, '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
};

const extractField = (text: string, patterns: RegExp[]): string | undefined => {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[2]) return m[2].trim();
    if (m && m[1]) return m[1].trim();
  }
  return undefined;
};

const parseItems = (lines: string[]): InvoiceItem[] => {
  const items: InvoiceItem[] = [];
  for (const line of lines) {
    const m = line.match(/(.+?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)/);
    if (m) {
      const description = m[1].trim();
      const quantity = parseMoney(m[2]);
      const unitPrice = parseMoney(m[3]);
      const total = parseMoney(m[4]);
      items.push({ description, quantity, unitPrice, total });
    }
  }
  return items;
};

export const extractInvoiceDataFromImage = async (file: File): Promise<InvoiceData> => {
  await loadTesseract();
  const preprocessed = await preprocessImage(file);
  let ocrText = '';
  try {
    const resultSpa = await window.Tesseract!.recognize(preprocessed, 'spa', { logger: () => {}, dpi: 300 });
    ocrText = resultSpa?.data?.text || '';
  } catch {
    const resultEng = await window.Tesseract!.recognize(preprocessed, 'eng', { logger: () => {}, dpi: 300 });
    ocrText = resultEng?.data?.text || '';
  }
  

  const text = ocrText;
  const lower = text.toLowerCase();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const invoiceNumber = extractField(text, [
    /(factura(?:\s*no\.?|\s*n[ºo]?|\s*n[úu]mero)?[:\s]*)([A-Z0-9-]+)/i,
    /(invoice(?:\s*no\.|\s*number)?[:\s]*)([A-Z0-9-]+)/i,
    /(comprobante[:\s]*)([A-Z0-9-]+)/i,
  ]);

  const issueDate = extractField(text, [
    /(fecha[:\s]*)(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /(date[:\s]*)(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /(\d{4}[/-]\d{1,2}[/-]\d{1,2})/i,
  ]);

  const subtotalStr = extractField(text, [
    /(subtotal[:\s]*)([$€₡]?\s*[\d.,]+)/i,
  ]);
  const taxStr = extractField(text, [
    /(iva|impuesto|tax)[:\s]*([$€₡]?\s*[\d.,]+)/i,
  ]);
  const totalStr = extractField(text, [
    /(total[:\s]*)([$€₡]?\s*[\d.,]+)/i,
  ]);

  const currency = lower.includes('crc') || /₡/.test(text) ? 'CRC'
    : lower.includes('usd') || /\$/.test(text) ? 'USD'
    : lower.includes('eur') || /€/.test(text) ? 'EUR'
    : lower.includes('pen') || /s\.?/.test(lower) ? 'PEN'
    : lower.includes('ars') ? 'ARS'
    : lower.includes('mxn') ? 'MXN'
    : lower.includes('cop') ? 'COP'
    : lower.includes('clp') ? 'CLP'
    : undefined;

  const issuerName = extractField(text, [
    /(proveedor|empresa|emisor|issuer|raz[óo]n social|compa[ñn][íi]a)[:\s]*(.+)/i,
  ]) || lines[0];
  const issuerTaxId = extractField(text, [
    /(ruc|rnc|nif|cuit|rut|tax id|c[ée]dula)[:\s]*([A-Z0-9.-]+)/i,
  ]);
  const customerName = extractField(text, [
    /(cliente|customer|destinatario)[:\s]*(.+)/i,
  ]);
  const customerTaxId = extractField(text, [
    /(ruc|rnc|nif|cuit|rut|tax id|c[ée]dula)[:\s]*([A-Z0-9.-]+)/i,
  ]);

  const items = parseItems(lines);
  const fallbackSubtotal = extractField(text, [/(sub\s*total|subtotal)[:\s]*([$€₡S./]?\s*[\d.,]+)/i]);
  const fallbackTax = extractField(text, [/(iva|igv|impuesto)[:\s]*([$€₡S./]?\s*[\d.,]+)/i]);
  const fallbackTotal = extractField(text, [/(total(?:\s*a\s*pagar)?|total\s*factura)[:\s]*([$€₡S./]?\s*[\d.,]+)/i]);

  const data: InvoiceData = {
    issuerName,
    issuerTaxId,
    invoiceNumber,
    issueDate,
    customerName,
    customerTaxId,
    subtotal: subtotalStr ? parseMoney(subtotalStr) : (fallbackSubtotal ? parseMoney(fallbackSubtotal) : undefined),
    tax: taxStr ? parseMoney(taxStr) : (fallbackTax ? parseMoney(fallbackTax) : undefined),
    total: totalStr ? parseMoney(totalStr) : (fallbackTotal ? parseMoney(fallbackTotal) : undefined),
    currency,
    items: items.length ? items : undefined,
    rawText: text,
  };

  return data;
};
