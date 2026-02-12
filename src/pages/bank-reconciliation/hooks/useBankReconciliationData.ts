import { useState } from 'react';
import { type FieldMapping, type KeyFieldSelection, type ReconciliationState } from '../types';

export const useBankReconciliationData = () => {
  const [bankHeaders, setBankHeaders] = useState<string[]>([]);
  const [bankRows, setBankRows] = useState<string[][]>([]);
  const [ledgerHeaders, setLedgerHeaders] = useState<string[]>([]);
  const [ledgerRows, setLedgerRows] = useState<string[][]>([]);
  const [ledgerHeaderDraft, setLedgerHeaderDraft] = useState<string[]>([]);
  const [ledgerPreviewRows, setLedgerPreviewRows] = useState<string[][]>([]);
  const [ledgerKeyFields, setLedgerKeyFields] = useState<KeyFieldSelection>({
    dateColumn: '',
    debitColumn: '',
    creditColumn: '',
    descriptionColumn: '',
  });
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({
    bankDate: '',
    ledgerDate: '',
    bankAmount: '',
    ledgerAmount: '',
    bankCredit: '',
    ledgerCredit: '',
    bankDescription: '',
    ledgerDescription: '',
  });
  const [reconciliation, setReconciliation] = useState<ReconciliationState>({
    matches: [],
    discrepancies: [],
    onlyBank: [],
    onlyLedger: [],
  });

  return {
    bankHeaders,
    setBankHeaders,
    bankRows,
    setBankRows,
    ledgerHeaders,
    setLedgerHeaders,
    ledgerRows,
    setLedgerRows,
    ledgerHeaderDraft,
    setLedgerHeaderDraft,
    ledgerPreviewRows,
    setLedgerPreviewRows,
    ledgerKeyFields,
    setLedgerKeyFields,
    fieldMapping,
    setFieldMapping,
    reconciliation,
    setReconciliation,
  };
};
