import { describe, expect, it } from 'vitest';
import { matchesSearchTokens, normalizeSearchText, tokenizeSearchQuery } from '@/lib/textSearch';

describe('textSearch', () => {
  it('normaliza a minúsculas, elimina acentos y colapsa espacios', () => {
    expect(normalizeSearchText('  DéPÓsito   en   CUENTA  ')).toBe('deposito en cuenta');
  });

  it('tokeniza ignorando espacios extra', () => {
    expect(tokenizeSearchQuery('  pago   servicio  ')).toEqual(['pago', 'servicio']);
  });

  it('hace coincidencia parcial tipo like (AND por tokens)', () => {
    const hay = normalizeSearchText('Pago de servicio de Internet');
    expect(matchesSearchTokens(hay, tokenizeSearchQuery('pago'))).toBe(true);
    expect(matchesSearchTokens(hay, tokenizeSearchQuery('serv'))).toBe(true);
    expect(matchesSearchTokens(hay, tokenizeSearchQuery('pago internet'))).toBe(true);
    expect(matchesSearchTokens(hay, tokenizeSearchQuery('pago luz'))).toBe(false);
  });

  it('maneja búsquedas vacías mostrando todo', () => {
    const hay = normalizeSearchText('Cualquier texto');
    expect(matchesSearchTokens(hay, tokenizeSearchQuery(''))).toBe(true);
    expect(matchesSearchTokens(hay, tokenizeSearchQuery('   '))).toBe(true);
  });

  it('no usa regex: caracteres especiales se comparan como texto', () => {
    const hay = normalizeSearchText('Transferencia #123-ABC');
    expect(matchesSearchTokens(hay, tokenizeSearchQuery('#123'))).toBe(true);
    expect(matchesSearchTokens(hay, tokenizeSearchQuery('123-abc'))).toBe(true);
  });
});

