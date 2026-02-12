import { parseDateValue, normalizeAmount, textSimilarity } from './textUtils';
import { type FieldMapping, type MatchType, type ReconciliationMatch, type ReconciliationState } from '../types';

export const getMappedAmountValue = (
  row: string[],
  headers: string[],
  debitField: string,
  creditField: string,
) => {
  const debitIdx = headers.findIndex(h => h === debitField);
  const creditIdx = headers.findIndex(h => h === creditField);
  const debitCell = debitIdx >= 0 ? String(row[debitIdx] ?? '') : '';
  const creditCell = creditIdx >= 0 ? String(row[creditIdx] ?? '') : '';
  if (debitIdx >= 0 && creditIdx >= 0) {
    return normalizeAmount(creditCell) - normalizeAmount(debitCell);
  }
  if (creditIdx >= 0) return normalizeAmount(creditCell);
  if (debitIdx >= 0) return normalizeAmount(debitCell);
  return 0;
};

export const getMappedAmountDisplay = (
  row: string[],
  headers: string[],
  debitField: string,
  creditField: string,
) => {
  const debitIdx = headers.findIndex(h => h === debitField);
  const creditIdx = headers.findIndex(h => h === creditField);
  const debitCell = debitIdx >= 0 ? String(row[debitIdx] ?? '') : '';
  const creditCell = creditIdx >= 0 ? String(row[creditIdx] ?? '') : '';
  if (debitIdx >= 0 && creditIdx >= 0) {
    const value = normalizeAmount(creditCell) - normalizeAmount(debitCell);
    return Number.isFinite(value) ? value.toFixed(2) : '';
  }
  if (creditIdx >= 0) return creditCell;
  if (debitIdx >= 0) return debitCell;
  return '';
};

export const buildReconciliationState = ({
  bankHeaders,
  bankRows,
  ledgerHeaders,
  ledgerRows,
  fieldMapping,
  toleranceDays,
  toleranceAmountPercent,
  useDescription,
  descriptionThreshold,
}: {
  bankHeaders: string[];
  bankRows: string[][];
  ledgerHeaders: string[];
  ledgerRows: string[][];
  fieldMapping: FieldMapping;
  toleranceDays: number;
  toleranceAmountPercent: number;
  useDescription: boolean;
  descriptionThreshold: number;
}): ReconciliationState => {
  const safeToleranceDays = Math.max(0, toleranceDays);
  const safeToleranceAmountPercent = Math.max(0, toleranceAmountPercent);
  const bankDateIdx = bankHeaders.findIndex(h => h === fieldMapping.bankDate);
  const ledgerDateIdx = ledgerHeaders.findIndex(h => h === fieldMapping.ledgerDate);
  const bankAmountIdx = bankHeaders.findIndex(h => h === fieldMapping.bankAmount);
  const ledgerAmountIdx = ledgerHeaders.findIndex(h => h === fieldMapping.ledgerAmount);
  const bankDescIdx = bankHeaders.findIndex(h => h === fieldMapping.bankDescription);
  const ledgerDescIdx = ledgerHeaders.findIndex(h => h === fieldMapping.ledgerDescription);

  const bankEntries = bankRows.map((row, idx) => ({
    index: idx,
    date: parseDateValue(String(row[bankDateIdx] ?? '')),
    amount:
      fieldMapping.bankCredit
        ? getMappedAmountValue(row, bankHeaders, fieldMapping.bankAmount, fieldMapping.bankCredit)
        : normalizeAmount(String(row[bankAmountIdx] ?? '')),
    description: String(row[bankDescIdx] ?? ''),
  }));
  const ledgerEntries = ledgerRows.map((row, idx) => ({
    index: idx,
    date: parseDateValue(String(row[ledgerDateIdx] ?? '')),
    amount:
      fieldMapping.ledgerCredit
        ? getMappedAmountValue(row, ledgerHeaders, fieldMapping.ledgerAmount, fieldMapping.ledgerCredit)
        : normalizeAmount(String(row[ledgerAmountIdx] ?? '')),
    description: String(row[ledgerDescIdx] ?? ''),
  }));

  const unmatchedBank = new Set(bankEntries.map(e => e.index));
  const unmatchedLedger = new Set(ledgerEntries.map(e => e.index));
  const matches: ReconciliationMatch[] = [];

  const amountTolerance = (bankAmount: number, ledgerAmount: number) => {
    const base = Math.max(Math.abs(bankAmount), Math.abs(ledgerAmount));
    return base * (safeToleranceAmountPercent / 100);
  };

  const tryMatch = (
    predicate: (bank: typeof bankEntries[number], ledger: typeof ledgerEntries[number]) => boolean,
    score: number,
    type: MatchType,
  ) => {
    bankEntries.forEach(bank => {
      if (!unmatchedBank.has(bank.index)) return;
      let best: { ledger: typeof ledgerEntries[number]; dateDiff: number; amountDiff: number } | null = null;
      ledgerEntries.forEach(ledger => {
        if (!unmatchedLedger.has(ledger.index)) return;
        if (!predicate(bank, ledger)) return;
        const dateDiff = bank.date && ledger.date ? Math.abs(bank.date.getTime() - ledger.date.getTime()) / (1000 * 60 * 60 * 24) : 999;
        const amountDiff = Math.abs(bank.amount - ledger.amount);
        if (!best || amountDiff < best.amountDiff) {
          best = { ledger, dateDiff, amountDiff };
        }
      });
      if (best) {
        unmatchedBank.delete(bank.index);
        unmatchedLedger.delete(best.ledger.index);
        matches.push({
          id: `${bank.index}-${best.ledger.index}-${type}`,
          bankIndex: bank.index,
          ledgerIndex: best.ledger.index,
          score,
          type,
          dateDiffDays: best.dateDiff,
          amountDiff: best.amountDiff,
          verified: false,
        });
      }
    });
  };

  const isSameDay = (a: Date | null, b: Date | null) =>
    !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  tryMatch(
    (bank, ledger) =>
      isSameDay(bank.date, ledger.date) && Math.abs(bank.amount - ledger.amount) <= amountTolerance(bank.amount, ledger.amount),
    100,
    'exact',
  );

  tryMatch(
    (bank, ledger) =>
      !!bank.date &&
      !!ledger.date &&
      Math.abs(bank.amount - ledger.amount) <= amountTolerance(bank.amount, ledger.amount) &&
      Math.abs(bank.date.getTime() - ledger.date.getTime()) / (1000 * 60 * 60 * 24) <= safeToleranceDays,
    80,
    'date_flexible',
  );

  if (useDescription) {
    tryMatch(
      (bank, ledger) =>
        Math.abs(bank.amount - ledger.amount) <= amountTolerance(bank.amount, ledger.amount) &&
        textSimilarity(bank.description, ledger.description) * 100 >= descriptionThreshold,
      60,
      'description',
    );
  }

  const discrepancies = matches.filter(match => {
    if (match.type === 'exact') return false;
    const bankAmount = bankEntries[match.bankIndex]?.amount ?? 0;
    const ledgerAmount = ledgerEntries[match.ledgerIndex]?.amount ?? 0;
    if (match.amountDiff > 0 && match.amountDiff <= amountTolerance(bankAmount, ledgerAmount)) return true;
    if (match.dateDiffDays > 0 && match.dateDiffDays <= safeToleranceDays) return true;
    return false;
  });

  return {
    matches,
    discrepancies,
    onlyBank: Array.from(unmatchedBank),
    onlyLedger: Array.from(unmatchedLedger),
  };
};
