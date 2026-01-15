import { FileRecord, Transaction, FileStatus, Bank, BankStatus } from '@/types/finanzas';

const LOCAL_STORAGE_FILES_KEY = 'finanzas360_files';
const LOCAL_STORAGE_TRANSACTIONS_KEY = 'finanzas360_transactions';
const LOCAL_STORAGE_BANKS_KEY = 'finanzas360_banks';
const LOCAL_STORAGE_SETTINGS_KEY = 'finanzas360_settings';

// Helper para obtener datos de localStorage
const getFromLocalStorage = <T>(key: string): T[] => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : [];
  } catch (error) {
    console.error(`Error al leer de localStorage para la clave ${key}:`, error);
    return [];
  }
};

// Helper para guardar datos en localStorage
const saveToLocalStorage = <T>(key: string, data: T[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error al guardar en localStorage para la clave ${key}:`, error);
  }
};

export const localDb = {
  // Archivos
  getFiles: (): FileRecord[] => {
    return getFromLocalStorage<FileRecord>(LOCAL_STORAGE_FILES_KEY);
  },

  addFile: (file: FileRecord): void => {
    const files = localDb.getFiles();
    files.push(file);
    saveToLocalStorage(LOCAL_STORAGE_FILES_KEY, files);
  },

  updateFileStatus: (fileId: string, status: FileStatus): void => {
    const files = localDb.getFiles();
    const updatedFiles = files.map(f => f.id === fileId ? { ...f, status } : f);
    saveToLocalStorage(LOCAL_STORAGE_FILES_KEY, updatedFiles);
  },

  // Transacciones
  getTransactions: (): Transaction[] => {
    return getFromLocalStorage<Transaction>(LOCAL_STORAGE_TRANSACTIONS_KEY);
  },

  addTransactions: (newTransactions: Transaction[]): void => {
    const transactions = localDb.getTransactions();
    transactions.push(...newTransactions);
    saveToLocalStorage(LOCAL_STORAGE_TRANSACTIONS_KEY, transactions);
  },

  getTransactionsByFileId: (fileId: string): Transaction[] => {
    const transactions = localDb.getTransactions();
    return transactions.filter(t => t.file_id === fileId);
  },

  // Eliminar archivo
  deleteFile: (fileId: string): void => {
    const files = localDb.getFiles();
    const updatedFiles = files.filter(f => f.id !== fileId);
    saveToLocalStorage(LOCAL_STORAGE_FILES_KEY, updatedFiles);
  },

  // Eliminar transacciones por archivo
  deleteTransactionsByFileId: (fileId: string): void => {
    const transactions = localDb.getTransactions();
    const updatedTransactions = transactions.filter(t => t.file_id !== fileId);
    saveToLocalStorage(LOCAL_STORAGE_TRANSACTIONS_KEY, updatedTransactions);
  },

  // Eliminar archivo y todas sus transacciones
  deleteFileAndTransactions: (fileId: string): void => {
    localDb.deleteFile(fileId);
    localDb.deleteTransactionsByFileId(fileId);
  },

  // ========== BANCOS ==========
  
  // Obtener todos los bancos
  getBanks: (): Bank[] => {
    return getFromLocalStorage<Bank>(LOCAL_STORAGE_BANKS_KEY);
  },

  // Obtener bancos activos
  getActiveBanks: (): Bank[] => {
    return localDb.getBanks().filter(b => b.status === 'active');
  },

  // Obtener banco por ID
  getBankById: (bankId: string): Bank | undefined => {
    const banks = localDb.getBanks();
    return banks.find(b => b.id === bankId);
  },

  // Agregar banco
  addBank: (bank: Bank): void => {
    const banks = localDb.getBanks();
    banks.push(bank);
    saveToLocalStorage(LOCAL_STORAGE_BANKS_KEY, banks);
  },

  // Actualizar banco
  updateBank: (bankId: string, updates: Partial<Bank>): void => {
    const banks = localDb.getBanks();
    const updatedBanks = banks.map(b => 
      b.id === bankId ? { ...b, ...updates, updated_date: new Date().toISOString() } : b
    );
    saveToLocalStorage(LOCAL_STORAGE_BANKS_KEY, updatedBanks);
  },

  // Cambiar estado del banco
  toggleBankStatus: (bankId: string): void => {
    const banks = localDb.getBanks();
    const updatedBanks = banks.map(b => {
      if (b.id === bankId) {
        return {
          ...b,
          status: b.status === 'active' ? 'inactive' as BankStatus : 'active' as BankStatus,
          updated_date: new Date().toISOString()
        };
      }
      return b;
    });
    saveToLocalStorage(LOCAL_STORAGE_BANKS_KEY, updatedBanks);
  },

  // Eliminar banco (solo si no tiene transacciones)
  deleteBank: (bankId: string): boolean => {
    const files = localDb.getFiles();
    const hasFiles = files.some(f => f.bank_id === bankId);
    
    if (hasFiles) {
      return false; // No se puede eliminar si tiene archivos asociados
    }

    const banks = localDb.getBanks();
    const updatedBanks = banks.filter(b => b.id !== bankId);
    saveToLocalStorage(LOCAL_STORAGE_BANKS_KEY, updatedBanks);
    return true;
  },

  // Contar transacciones por banco
  countTransactionsByBank: (bankId: string): number => {
    const files = localDb.getFiles().filter(f => f.bank_id === bankId);
    const fileIds = files.map(f => f.id);
    const transactions = localDb.getTransactions();
    return transactions.filter(t => fileIds.includes(t.file_id)).length;
  },

  // Inicializar bancos por defecto
  initializeDefaultBanks: (): void => {
    const existingBanks = localDb.getBanks();
    if (existingBanks.length === 0) {
      const defaultBanks: Bank[] = [
        {
          id: 'bbva',
          name: 'BBVA',
          country: 'Costa Rica',
          currency: 'CRC',
          status: 'active',
          columnMapping: {
            date: 'Fecha',
            dateValue: 'Fecha Valor',
            description: 'Concepto',
            detail: 'Detalle',
            code: 'Codigo',
            document: 'Número Documento',
            office: 'Oficina',
            credit: 'Crédito',
            debit: 'Débito',
          },
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
        },
        {
          id: 'banco-pata',
          name: 'Banco Pata',
          country: 'Costa Rica',
          currency: 'CRC',
          status: 'active',
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
        },
        {
          id: 'banco-gato',
          name: 'Banco Gato',
          country: 'Costa Rica',
          currency: 'CRC',
          status: 'active',
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
        },
      ];
      saveToLocalStorage(LOCAL_STORAGE_BANKS_KEY, defaultBanks);
    }
  },
};


// Settings / Configuración
export type AiProviderId = 'gemini' | 'kimi';

export type AiModelConfig = {
  id: string;
  provider: AiProviderId;
  label: string;
  model: string;
};

export type AiRequestLogKind = 'header_detect' | 'analyze_part';
export type AiRequestLogStatus = 'in_progress' | 'completed' | 'failed';

export type AiRequestLog = {
  id: string;
  kind: AiRequestLogKind;
  segmentId: string;
  partIndex?: number;
  totalParts?: number;
  status: AiRequestLogStatus;
  startedAt: number;
  endedAt?: number;
  elapsedMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  rowCount?: number;
  error?: string;
  warnings?: string[];
};

export type AiExtractionLog = {
  id: string;
  timestamp: number;
  provider: AiProviderId;
  model: string;
  fileName: string;
  fileSizeBytes?: number;
  fileType?: string;
  status?: 'in_progress' | 'completed' | 'failed' | 'stopped' | 'canceled';
  startedAt?: number;
  endedAt?: number;
  totalParts?: number;
  processedParts?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  requests?: AiRequestLog[];
};

export type PdfAnalysisStageStatus = 'pending' | 'in_progress' | 'completed' | 'paused' | 'stopped' | 'failed';

export type PdfAnalysisStage = {
  id: string;
  label: string;
  status: PdfAnalysisStageStatus;
  startedAt?: number;
  endedAt?: number;
  elapsedMs?: number;
  etaMs?: number;
  message?: string;
  error?: string;
  page?: number;
  totalPages?: number;
  part?: number;
  totalParts?: number;
};

export type PdfAnalysisRunStatus = 'in_progress' | 'paused' | 'stopped' | 'failed' | 'completed';

export type PdfAnalysisRun = {
  id: string;
  fileName: string;
  mode: 'local' | 'ai';
  status: PdfAnalysisRunStatus;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  currentStageId?: string;
  stages: PdfAnalysisStage[];
  resume?: {
    nextPage?: number;
    totalPages?: number;
    nextPart?: number;
    totalParts?: number;
  };
};

interface AppSettings {
  geminiApiKey?: string;
  kimiApiKey?: string;
  aiModels?: AiModelConfig[];
  aiLogs?: AiExtractionLog[];
  pdfAnalysisRuns?: PdfAnalysisRun[];
}

const getDefaultAiModels = (): AiModelConfig[] => [
  { id: 'gemini-3-pro-preview', provider: 'gemini', label: 'Gemini 3 Pro (preview)', model: 'gemini-3-pro-preview' },
  { id: 'gemini-3-flash-preview', provider: 'gemini', label: 'Gemini 3 Flash (preview)', model: 'gemini-3-flash-preview' },
  { id: 'gemini-2.5-pro', provider: 'gemini', label: 'Gemini 2.5 Pro', model: 'gemini-2.5-pro' },
  { id: 'gemini-2.5-flash', provider: 'gemini', label: 'Gemini 2.5 Flash', model: 'gemini-2.5-flash' },
  { id: 'gemini-2.5-flash-lite', provider: 'gemini', label: 'Gemini 2.5 Flash-Lite', model: 'gemini-2.5-flash-lite' },
  { id: 'gemini-2.0-flash', provider: 'gemini', label: 'Gemini 2.0 Flash', model: 'gemini-2.0-flash' },
  { id: 'gemini-2.0-flash-lite', provider: 'gemini', label: 'Gemini 2.0 Flash-Lite', model: 'gemini-2.0-flash-lite' },
  { id: 'kimi-k2-0711-preview', provider: 'kimi', label: 'Kimi k2-0711-preview', model: 'kimi-k2-0711-preview' },
  { id: 'kimi-k2-0905-preview', provider: 'kimi', label: 'Kimi k2-0905-preview', model: 'kimi-k2-0905-preview' },
  { id: 'kimi-k2-turbo-preview', provider: 'kimi', label: 'Kimi k2-turbo-preview · Recomendado', model: 'kimi-k2-turbo-preview' },
  { id: 'kimi-k2-thinking', provider: 'kimi', label: 'Kimi k2-thinking', model: 'kimi-k2-thinking' },
  { id: 'kimi-k2-thinking-turbo', provider: 'kimi', label: 'Kimi k2-thinking-turbo', model: 'kimi-k2-thinking-turbo' },
];

export const settingsDb = {
  getSettings: (): AppSettings => {
    try {
      const item = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
      return item ? JSON.parse(item) : {};
    } catch (error) {
      console.error('Error al leer configuración:', error);
      return {};
    }
  },

  saveSettings: (settings: AppSettings) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error al guardar configuración:', error);
    }
  },

  getGeminiApiKey: (): string | undefined => {
    const settings = settingsDb.getSettings();
    return settings.geminiApiKey;
  },

  saveGeminiApiKey: (apiKey: string) => {
    const settings = settingsDb.getSettings();
    settings.geminiApiKey = apiKey;
    settingsDb.saveSettings(settings);
  },

  clearGeminiApiKey: () => {
    const settings = settingsDb.getSettings();
    delete settings.geminiApiKey;
    settingsDb.saveSettings(settings);
  },

  getKimiApiKey: (): string | undefined => {
    const settings = settingsDb.getSettings();
    return settings.kimiApiKey;
  },

  saveKimiApiKey: (apiKey: string) => {
    const settings = settingsDb.getSettings();
    settings.kimiApiKey = apiKey;
    settingsDb.saveSettings(settings);
  },

  clearKimiApiKey: () => {
    const settings = settingsDb.getSettings();
    delete settings.kimiApiKey;
    settingsDb.saveSettings(settings);
  },

  getAiModels: (): AiModelConfig[] => {
    const settings = settingsDb.getSettings();
    const models = settings.aiModels;
    if (!models || !Array.isArray(models) || models.length === 0) return getDefaultAiModels();
    return models;
  },

  saveAiModels: (models: AiModelConfig[]) => {
    const settings = settingsDb.getSettings();
    settings.aiModels = models;
    settingsDb.saveSettings(settings);
  },

  resetAiModels: () => {
    const settings = settingsDb.getSettings();
    settings.aiModels = getDefaultAiModels();
    settingsDb.saveSettings(settings);
  },

  getAiLogs: (): AiExtractionLog[] => {
    const settings = settingsDb.getSettings();
    const logs = settings.aiLogs;
    if (!logs || !Array.isArray(logs) || logs.length === 0) return [];
    return logs;
  },

  addAiLog: (log: AiExtractionLog) => {
    const settings = settingsDb.getSettings();
    const existing = settings.aiLogs && Array.isArray(settings.aiLogs) ? settings.aiLogs : [];
    settings.aiLogs = [log, ...existing].slice(0, 200);
    settingsDb.saveSettings(settings);
  },

  upsertAiLog: (log: AiExtractionLog) => {
    const settings = settingsDb.getSettings();
    const existing = settings.aiLogs && Array.isArray(settings.aiLogs) ? settings.aiLogs : [];
    const next = [log, ...existing.filter(l => l.id !== log.id)].slice(0, 200);
    settings.aiLogs = next;
    settingsDb.saveSettings(settings);
  },

  removeAiLog: (logId: string) => {
    const settings = settingsDb.getSettings();
    const existing = settings.aiLogs && Array.isArray(settings.aiLogs) ? settings.aiLogs : [];
    settings.aiLogs = existing.filter(l => l.id !== logId);
    settingsDb.saveSettings(settings);
  },

  clearAiLogs: () => {
    const settings = settingsDb.getSettings();
    settings.aiLogs = [];
    settingsDb.saveSettings(settings);
  },

  getPdfAnalysisRuns: (): PdfAnalysisRun[] => {
    const settings = settingsDb.getSettings();
    const runs = settings.pdfAnalysisRuns;
    if (!runs || !Array.isArray(runs) || runs.length === 0) return [];
    return runs;
  },

  savePdfAnalysisRuns: (runs: PdfAnalysisRun[]) => {
    const settings = settingsDb.getSettings();
    settings.pdfAnalysisRuns = runs;
    settingsDb.saveSettings(settings);
  },

  upsertPdfAnalysisRun: (run: PdfAnalysisRun) => {
    const settings = settingsDb.getSettings();
    const existing = settings.pdfAnalysisRuns && Array.isArray(settings.pdfAnalysisRuns) ? settings.pdfAnalysisRuns : [];
    const next = [run, ...existing.filter(r => r.id !== run.id)].slice(0, 50);
    settings.pdfAnalysisRuns = next;
    settingsDb.saveSettings(settings);
  },

  clearPdfAnalysisRuns: () => {
    const settings = settingsDb.getSettings();
    settings.pdfAnalysisRuns = [];
    settingsDb.saveSettings(settings);
  },
};
