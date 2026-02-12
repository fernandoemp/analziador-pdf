export const normalizeHeader = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const textSimilarity = (a: string, b: string) => {
  const tokensA = new Set(normalizeText(a).split(' ').filter(Boolean));
  const tokensB = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let common = 0;
  tokensA.forEach(token => {
    if (tokensB.has(token)) common += 1;
  });
  return (common * 2) / (tokensA.size + tokensB.size);
};

export const parseDateValue = (value: string) => {
  const raw = value.trim();
  if (!raw) return null;
  const match =
    raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/) || raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return null;
  let year: number;
  let month: number;
  let day: number;
  if (match[1].length === 4) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
    if (year < 100) year += 2000;
  }
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const normalizeAmount = (value: string) => {
  if (!value) return 0;
  let cleaned = value.trim().replace(/[$€£¥₡]/g, '');
  const isNegative = cleaned.includes('(') && cleaned.includes(')');
  cleaned = cleaned.replace(/[()]/g, '');
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  if (lastComma > lastDot) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }
  const amount = Number.parseFloat(cleaned);
  if (Number.isNaN(amount)) return 0;
  return isNegative ? -Math.abs(amount) : amount;
};
