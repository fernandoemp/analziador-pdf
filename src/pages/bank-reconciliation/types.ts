export const BANK_OPTIONS = ['Banco Macro', 'Banco Nación', 'BBVA', 'Santander', 'Galicia', 'Otro'] as const;

export type MatchMode = 'missing_in_ledger' | 'missing_in_bank';

export type MatchType = 'exact' | 'date_flexible' | 'description' | 'discrepancy';

export type ReconciliationMatch = {
  id: string;
  bankIndex: number;
  ledgerIndex: number;
  score: number;
  type: MatchType;
  dateDiffDays: number;
  amountDiff: number;
  verified: boolean;
};

export type ReconciliationState = {
  matches: ReconciliationMatch[];
  discrepancies: ReconciliationMatch[];
  onlyBank: number[];
  onlyLedger: number[];
};

export type FieldMapping = {
  bankDate: string;
  ledgerDate: string;
  bankAmount: string;
  ledgerAmount: string;
  bankCredit: string;
  ledgerCredit: string;
  bankDescription: string;
  ledgerDescription: string;
};

export type ReconciliationStats = {
  totalBank: number;
  totalLedger: number;
  matchCount: number;
  discrepancyCount: number;
  unmatchedBank: number;
  unmatchedLedger: number;
  rate: number;
};
