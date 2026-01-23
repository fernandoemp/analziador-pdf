export const normalizeSearchText = (value: string) => {
  return (value ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const tokenizeSearchQuery = (value: string) => {
  const normalized = normalizeSearchText(value);
  if (!normalized) return [];
  return normalized.split(' ').filter(Boolean);
};

export const matchesSearchTokens = (haystackNormalized: string, tokens: string[]) => {
  if (tokens.length === 0) return true;
  if (!haystackNormalized) return false;
  for (const token of tokens) {
    if (!haystackNormalized.includes(token)) return false;
  }
  return true;
};

