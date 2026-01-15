import { beforeEach, describe, expect, it } from 'vitest';
import {
  cleanupValidatorStates,
  loadValidatorState,
  normalizeValidatorState,
  saveValidatorState,
  type PersistedValidatorStateV1,
} from '@/lib/ai-analysis-persistence/storage';

beforeEach(() => {
  localStorage.clear();
});

describe('ai-analysis-persistence/validator', () => {
  it('saves and loads a validator state', () => {
    const state: PersistedValidatorStateV1 = {
      version: 1,
      updatedAt: 10,
      file: { name: 'a.pdf', size: 10, lastModified: 20, type: 'application/pdf' },
      totalPages: 3,
      currentPage: 2,
      validatedPages: [false, true, false],
    };

    saveValidatorState(state);
    const loaded = loadValidatorState(state.file);
    expect(loaded).not.toBeNull();
    expect(loaded?.currentPage).toBe(2);
    expect(loaded?.validatedPages).toEqual([false, true, false]);
  });

  it('normalizes validatedPages length and clamps currentPage', () => {
    const state: PersistedValidatorStateV1 = {
      version: 1,
      updatedAt: 10,
      file: { name: 'a.pdf', size: 10, lastModified: 20, type: 'application/pdf' },
      totalPages: 2,
      currentPage: 10,
      validatedPages: [true],
    };

    const normalized = normalizeValidatorState(state, 5);
    expect(normalized.totalPages).toBe(5);
    expect(normalized.currentPage).toBe(5);
    expect(normalized.validatedPages).toEqual([true, false, false, false, false]);
  });

  it('cleans up old validator states by age and max entries', () => {
    const old: PersistedValidatorStateV1 = {
      version: 1,
      updatedAt: 100,
      file: { name: 'old.pdf', size: 10, lastModified: 20, type: 'application/pdf' },
      totalPages: 1,
      currentPage: 1,
      validatedPages: [false],
    };
    const recent: PersistedValidatorStateV1 = {
      version: 1,
      updatedAt: 190,
      file: { name: 'recent.pdf', size: 11, lastModified: 21, type: 'application/pdf' },
      totalPages: 1,
      currentPage: 1,
      validatedPages: [true],
    };

    saveValidatorState(old);
    saveValidatorState(recent);

    cleanupValidatorStates({ maxEntries: 1, maxAgeMs: 20, now: 200 });

    expect(loadValidatorState(old.file)).toBeNull();
    expect(loadValidatorState(recent.file)).not.toBeNull();
  });
});

