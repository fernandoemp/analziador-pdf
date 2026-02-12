import { useSimpleTable } from './useSimpleTable';

export const useBankReconciliationTables = ({
  bankHeaders,
  bankRows,
  setBankRows,
  ledgerHeaders,
  ledgerRows,
  setLedgerRows,
}: {
  bankHeaders: string[];
  bankRows: string[][];
  setBankRows: (rows: string[][]) => void;
  ledgerHeaders: string[];
  ledgerRows: string[][];
  setLedgerRows: (rows: string[][]) => void;
}) => {
  const bankTable = useSimpleTable({
    headers: bankHeaders,
    rows: bankRows,
    setRows: setBankRows,
    pageSize: 25,
  });

  const ledgerTable = useSimpleTable({
    headers: ledgerHeaders,
    rows: ledgerRows,
    setRows: setLedgerRows,
    pageSize: 25,
  });

  return { bankTable, ledgerTable };
};
