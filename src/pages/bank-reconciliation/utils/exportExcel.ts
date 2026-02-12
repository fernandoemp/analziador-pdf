import * as XLSX from 'xlsx';
import { showError, showSuccess } from '@/utils/toast';
import { type FieldMapping, type MatchMode, type ReconciliationState, type ReconciliationStats } from '../types';
import { getMappedAmountDisplay } from './reconciliationEngine';

export const exportReconciliationExcel = ({
  stats,
  matchMode,
  toleranceDays,
  toleranceAmountPercent,
  useDescription,
  descriptionThreshold,
  reconciliation,
  bankHeaders,
  bankRows,
  ledgerHeaders,
  ledgerRows,
  fieldMapping,
  selectedBank,
}: {
  stats: ReconciliationStats;
  matchMode: MatchMode;
  toleranceDays: number;
  toleranceAmountPercent: number;
  useDescription: boolean;
  descriptionThreshold: number;
  reconciliation: ReconciliationState;
  bankHeaders: string[];
  bankRows: string[][];
  ledgerHeaders: string[];
  ledgerRows: string[][];
  fieldMapping: FieldMapping;
  selectedBank: string;
}) => {
  try {
    const workbook = XLSX.utils.book_new();
    const addSheet = (name: string, rows: Array<Record<string, unknown>>) => {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, name);
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      worksheet['!cols'] = Array.from({ length: range.e.c + 1 }).map(() => ({ wch: 20 }));
    };

    addSheet('Resumen Ejecutivo', [
      {
        'Total Extracto Bancario': stats.totalBank,
        'Total Libro Contable': stats.totalLedger,
        Coincidencias: stats.matchCount,
        'Discrepancias menores': stats.discrepancyCount,
        'Sin emparejar en Extracto': stats.unmatchedBank,
        'Sin emparejar en Libro': stats.unmatchedLedger,
        'Tasa de Conciliación': `${stats.rate}%`,
        'Modo de análisis': matchMode === 'missing_in_ledger' ? 'Falta en Libro Contable' : 'Falta en Extracto Bancario',
        'Tolerancia días': toleranceDays,
        'Tolerancia montos (%)': toleranceAmountPercent,
        'Usa descripción': useDescription ? 'Sí' : 'No',
        'Umbral descripción (%)': descriptionThreshold,
        Generado: new Date().toLocaleString(),
      },
    ]);

    const matchesRows = reconciliation.matches.map(match => ({
      Score: `${match.score}%`,
      'Fecha Extracto': bankRows[match.bankIndex]?.[bankHeaders.findIndex(h => h === fieldMapping.bankDate)] ?? '',
      'Fecha Libro': ledgerRows[match.ledgerIndex]?.[ledgerHeaders.findIndex(h => h === fieldMapping.ledgerDate)] ?? '',
      'Monto Extracto': getMappedAmountDisplay(
        bankRows[match.bankIndex] || [],
        bankHeaders,
        fieldMapping.bankAmount,
        fieldMapping.bankCredit,
      ),
      'Monto Libro': getMappedAmountDisplay(
        ledgerRows[match.ledgerIndex] || [],
        ledgerHeaders,
        fieldMapping.ledgerAmount,
        fieldMapping.ledgerCredit,
      ),
      'Descripción Extracto': bankRows[match.bankIndex]?.[bankHeaders.findIndex(h => h === fieldMapping.bankDescription)] ?? '',
      'Descripción Libro': ledgerRows[match.ledgerIndex]?.[ledgerHeaders.findIndex(h => h === fieldMapping.ledgerDescription)] ?? '',
      Tipo: match.type,
    }));
    addSheet('Coincidencias', matchesRows);

    const discrepancyRows = reconciliation.discrepancies.map(match => ({
      'Fecha Extracto': bankRows[match.bankIndex]?.[bankHeaders.findIndex(h => h === fieldMapping.bankDate)] ?? '',
      'Fecha Libro': ledgerRows[match.ledgerIndex]?.[ledgerHeaders.findIndex(h => h === fieldMapping.ledgerDate)] ?? '',
      'Monto Extracto': getMappedAmountDisplay(
        bankRows[match.bankIndex] || [],
        bankHeaders,
        fieldMapping.bankAmount,
        fieldMapping.bankCredit,
      ),
      'Monto Libro': getMappedAmountDisplay(
        ledgerRows[match.ledgerIndex] || [],
        ledgerHeaders,
        fieldMapping.ledgerAmount,
        fieldMapping.ledgerCredit,
      ),
      'Diferencia Monto': match.amountDiff,
      'Diferencia Fecha (días)': match.dateDiffDays,
      'Descripción Extracto': bankRows[match.bankIndex]?.[bankHeaders.findIndex(h => h === fieldMapping.bankDescription)] ?? '',
      'Descripción Libro': ledgerRows[match.ledgerIndex]?.[ledgerHeaders.findIndex(h => h === fieldMapping.ledgerDescription)] ?? '',
    }));
    addSheet('Discrepancias', discrepancyRows);

    const onlyBankRows = reconciliation.onlyBank.map(index => {
      const row: Record<string, unknown> = {};
      bankHeaders.forEach((header, idx) => {
        row[header] = bankRows[index]?.[idx] ?? '';
      });
      return row;
    });
    addSheet('Solo en Extracto', onlyBankRows);

    const onlyLedgerRows = reconciliation.onlyLedger.map(index => {
      const row: Record<string, unknown> = {};
      ledgerHeaders.forEach((header, idx) => {
        row[header] = ledgerRows[index]?.[idx] ?? '';
      });
      return row;
    });
    addSheet('Solo en Libro', onlyLedgerRows);

    const extractoRows = bankRows.map(row => {
      const record: Record<string, unknown> = {};
      bankHeaders.forEach((header, idx) => {
        record[header] = row[idx] ?? '';
      });
      return record;
    });
    addSheet('Extracto Completo', extractoRows);

    const libroRows = ledgerRows.map(row => {
      const record: Record<string, unknown> = {};
      ledgerHeaders.forEach((header, idx) => {
        record[header] = row[idx] ?? '';
      });
      return record;
    });
    addSheet('Libro Completo', libroRows);

    const name = `Conciliacion_${selectedBank}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, name);
    showSuccess('Reporte Excel generado.');
  } catch (error) {
    showError(error instanceof Error ? error.message : 'No se pudo exportar a Excel.');
  }
};
