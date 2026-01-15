import { z } from 'zod';

const STORAGE_PREFIX = 'pdfStructuredExtractor.aiAnalysis';
const ACTIVE_SESSION_ID_KEY = `${STORAGE_PREFIX}.activeSessionId`;
const VALIDATOR_PREFIX = 'pdfStructuredExtractor.validator';

const fileFingerprintSchema = z.object({
  name: z.string(),
  size: z.number().nonnegative(),
  lastModified: z.number().nonnegative(),
  type: z.string().optional(),
});

export type FileFingerprint = z.infer<typeof fileFingerprintSchema>;

export const getFileFingerprint = (file: Pick<File, 'name' | 'size' | 'lastModified' | 'type'>): FileFingerprint => ({
  name: file.name,
  size: file.size,
  lastModified: file.lastModified,
  type: file.type || undefined,
});

export const isSameFingerprint = (a: FileFingerprint, b: FileFingerprint) =>
  a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

const aiAnalysisStateSchema = z.enum(['idle', 'running', 'stopped', 'failed', 'completed']);

export type PersistedAiAnalysisMetaV1 = z.infer<typeof persistedAiAnalysisMetaV1Schema>;
export type PersistedAiAnalysisPartV1 = z.infer<typeof persistedAiAnalysisPartV1Schema>;
export type PersistedAiAnalysisLocalResultV1 = z.infer<typeof persistedAiAnalysisLocalResultV1Schema>;

const persistedAiAnalysisPartV1Schema = z.object({
  version: z.literal(1),
  sessionId: z.string().min(1),
  partIndex: z.number().int().nonnegative(),
  storedAt: z.number().nonnegative(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

const persistedAiAnalysisLocalResultV1Schema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

const persistedAiAnalysisMetaV1Schema = z.object({
  version: z.literal(1),
  sessionId: z.string().min(1),
  createdAt: z.number().nonnegative(),
  updatedAt: z.number().nonnegative(),
  file: fileFingerprintSchema,
  provider: z.enum(['gemini', 'kimi']),
  model: z.string().min(1),
  status: aiAnalysisStateSchema,
  confirmedHeaders: z.array(z.string()),
  totalParts: z.number().int().nonnegative().nullable(),
  processedParts: z.number().int().nonnegative(),
  nextPartIndex: z.number().int().nonnegative(),
  savedPartIndices: z.array(z.number().int().nonnegative()),
  currentAiLogId: z.string().nullable().optional(),
  localResult: persistedAiAnalysisLocalResultV1Schema.nullable().optional(),
});

export type PersistedAiAnalysisHydratedV1 = {
  meta: PersistedAiAnalysisMetaV1;
  parts: PersistedAiAnalysisPartV1[];
};

const sessionMetaKey = (sessionId: string) => `${STORAGE_PREFIX}.session.${sessionId}.meta`;
const sessionPartKey = (sessionId: string, partIndex: number) =>
  `${STORAGE_PREFIX}.session.${sessionId}.part.${partIndex}`;

const safeParseJson = (raw: string) => {
  try {
    return { ok: true as const, value: JSON.parse(raw) };
  } catch (error) {
    return { ok: false as const, error };
  }
};

const getStorage = (): Storage | null => {
  if (typeof globalThis === 'undefined') return null;
  const ls = (globalThis as unknown as { localStorage?: Storage }).localStorage;
  return ls || null;
};

export const getActiveSessionId = (): string | null => {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return storage.getItem(ACTIVE_SESSION_ID_KEY);
  } catch {
    return null;
  }
};

export const setActiveSessionId = (sessionId: string) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(ACTIVE_SESSION_ID_KEY, sessionId);
};

export const clearActiveSessionId = () => {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(ACTIVE_SESSION_ID_KEY);
};

export const saveSessionMeta = (meta: PersistedAiAnalysisMetaV1) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(sessionMetaKey(meta.sessionId), JSON.stringify(meta));
};

export const loadSessionMeta = (sessionId: string): PersistedAiAnalysisMetaV1 | null => {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(sessionMetaKey(sessionId));
  if (!raw) return null;
  const parsed = safeParseJson(raw);
  if (!parsed.ok) return null;
  const validated = persistedAiAnalysisMetaV1Schema.safeParse(parsed.value);
  return validated.success ? validated.data : null;
};

export const saveSessionPart = (part: PersistedAiAnalysisPartV1) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(sessionPartKey(part.sessionId, part.partIndex), JSON.stringify(part));
};

export const loadSessionPart = (sessionId: string, partIndex: number): PersistedAiAnalysisPartV1 | null => {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(sessionPartKey(sessionId, partIndex));
  if (!raw) return null;
  const parsed = safeParseJson(raw);
  if (!parsed.ok) return null;
  const validated = persistedAiAnalysisPartV1Schema.safeParse(parsed.value);
  return validated.success ? validated.data : null;
};

export const removeSessionMeta = (sessionId: string) => {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(sessionMetaKey(sessionId));
};

export const removeSessionPart = (sessionId: string, partIndex: number) => {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(sessionPartKey(sessionId, partIndex));
};

export const loadActiveSessionHydrated = (): PersistedAiAnalysisHydratedV1 | null => {
  const sessionId = getActiveSessionId();
  if (!sessionId) return null;
  const meta = loadSessionMeta(sessionId);
  if (!meta) return null;
  const parts: PersistedAiAnalysisPartV1[] = [];
  for (const idx of meta.savedPartIndices) {
    const p = loadSessionPart(sessionId, idx);
    if (!p) return null;
    parts.push(p);
  }
  parts.sort((a, b) => a.partIndex - b.partIndex);
  return { meta, parts };
};

export const isQuotaExceededError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { name?: unknown; code?: unknown };
  return maybe.name === 'QuotaExceededError' || maybe.code === 22;
};

const persistedValidatorStateV1Schema = z.object({
  version: z.literal(1),
  updatedAt: z.number().nonnegative(),
  file: fileFingerprintSchema,
  totalPages: z.number().int().nonnegative(),
  currentPage: z.number().int().nonnegative(),
  validatedPages: z.array(z.boolean()),
});

export type PersistedValidatorStateV1 = z.infer<typeof persistedValidatorStateV1Schema>;

const validatorKey = (fingerprint: FileFingerprint) => {
  const safeName = encodeURIComponent(fingerprint.name);
  const safeType = encodeURIComponent(fingerprint.type || '');
  return `${VALIDATOR_PREFIX}.v1.${safeName}.${fingerprint.size}.${fingerprint.lastModified}.${safeType}`;
};

export const normalizeValidatorState = (
  state: PersistedValidatorStateV1,
  totalPages: number
): PersistedValidatorStateV1 => {
  const safeTotalPages = Math.max(0, Math.floor(totalPages));
  const nextValidated = state.validatedPages.slice(0, safeTotalPages);
  while (nextValidated.length < safeTotalPages) nextValidated.push(false);
  const safeCurrentPage = Math.max(1, Math.min(safeTotalPages || 1, Math.floor(state.currentPage || 1)));
  return {
    ...state,
    totalPages: safeTotalPages,
    currentPage: safeCurrentPage,
    validatedPages: nextValidated,
  };
};

export const loadValidatorState = (fingerprint: FileFingerprint): PersistedValidatorStateV1 | null => {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(validatorKey(fingerprint));
    if (!raw) return null;
    const parsed = safeParseJson(raw);
    if (!parsed.ok) return null;
    const validated = persistedValidatorStateV1Schema.safeParse(parsed.value);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
};

export const saveValidatorState = (state: PersistedValidatorStateV1) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(validatorKey(state.file), JSON.stringify(state));
};

export const removeValidatorState = (fingerprint: FileFingerprint) => {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(validatorKey(fingerprint));
};

export const cleanupValidatorStates = ({
  maxEntries,
  maxAgeMs,
  now,
}: {
  maxEntries: number;
  maxAgeMs: number;
  now?: number;
}) => {
  const storage = getStorage();
  if (!storage) return;
  const safeNow = typeof now === 'number' && Number.isFinite(now) ? now : Date.now();
  const safeMaxEntries = Math.max(0, Math.floor(maxEntries));
  const safeMaxAgeMs = Math.max(0, Math.floor(maxAgeMs));
  const prefix = `${VALIDATOR_PREFIX}.v1.`;

  const entries: Array<{ key: string; updatedAt: number }> = [];
  const toDelete: string[] = [];

  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const raw = storage.getItem(key);
    if (!raw) {
      toDelete.push(key);
      continue;
    }
    const parsed = safeParseJson(raw);
    if (!parsed.ok) {
      toDelete.push(key);
      continue;
    }
    const validated = persistedValidatorStateV1Schema.safeParse(parsed.value);
    if (!validated.success) {
      toDelete.push(key);
      continue;
    }
    const updatedAt = validated.data.updatedAt;
    if (!Number.isFinite(updatedAt) || updatedAt < 0) {
      toDelete.push(key);
      continue;
    }
    if (safeMaxAgeMs > 0 && updatedAt < safeNow - safeMaxAgeMs) {
      toDelete.push(key);
      continue;
    }
    entries.push({ key, updatedAt });
  }

  entries.sort((a, b) => b.updatedAt - a.updatedAt);
  if (safeMaxEntries > 0 && entries.length > safeMaxEntries) {
    for (const e of entries.slice(safeMaxEntries)) {
      toDelete.push(e.key);
    }
  }

  for (const key of toDelete) {
    try {
      storage.removeItem(key);
    } catch {
      continue;
    }
  }
};
