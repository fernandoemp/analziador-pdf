import { showError, showSuccess } from '@/utils/toast';
import { type FieldMapping, type ReconciliationState, type ReconciliationStats } from '../types';
import { getMappedAmountDisplay } from './reconciliationEngine';

export const exportReconciliationPdf = ({
  stats,
  reconciliation,
  bankHeaders,
  bankRows,
  ledgerHeaders,
  ledgerRows,
  fieldMapping,
  selectedBank,
}: {
  stats: ReconciliationStats;
  reconciliation: ReconciliationState;
  bankHeaders: string[];
  bankRows: string[][];
  ledgerHeaders: string[];
  ledgerRows: string[][];
  fieldMapping: FieldMapping;
  selectedBank: string;
}) => {
  const html = `
    <html>
      <head>
        <title>Reporte de Conciliación Bancaria</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          h1 { margin-bottom: 8px; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #ddd; padding: 6px; font-size: 12px; }
          th { background: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>Reporte de Conciliación Bancaria</h1>
        <div>Banco: ${selectedBank}</div>
        <div>Generado: ${new Date().toLocaleString()}</div>
        <div class="grid">
          <div class="card">Total Extracto Bancario: ${stats.totalBank}</div>
          <div class="card">Total Libro Contable: ${stats.totalLedger}</div>
          <div class="card">Coincidencias: ${stats.matchCount}</div>
          <div class="card">Discrepancias: ${stats.discrepancyCount}</div>
          <div class="card">Sin emparejar Extracto: ${stats.unmatchedBank}</div>
          <div class="card">Sin emparejar Libro: ${stats.unmatchedLedger}</div>
          <div class="card">Tasa de Conciliación: ${stats.rate}%</div>
        </div>
        <h2>Coincidencias</h2>
        <table>
          <thead>
            <tr>
              <th>Score</th>
              <th>Fecha Extracto</th>
              <th>Fecha Libro</th>
              <th>Monto Extracto</th>
              <th>Monto Libro</th>
              <th>Tipo</th>
            </tr>
          </thead>
          <tbody>
            ${reconciliation.matches
              .slice(0, 50)
              .map(match => `
              <tr>
                <td>${match.score}%</td>
                <td>${bankRows[match.bankIndex]?.[bankHeaders.findIndex(h => h === fieldMapping.bankDate)] ?? ''}</td>
                <td>${ledgerRows[match.ledgerIndex]?.[ledgerHeaders.findIndex(h => h === fieldMapping.ledgerDate)] ?? ''}</td>
                <td>${getMappedAmountDisplay(
                  bankRows[match.bankIndex] || [],
                  bankHeaders,
                  fieldMapping.bankAmount,
                  fieldMapping.bankCredit,
                )}</td>
                <td>${getMappedAmountDisplay(
                  ledgerRows[match.ledgerIndex] || [],
                  ledgerHeaders,
                  fieldMapping.ledgerAmount,
                  fieldMapping.ledgerCredit,
                )}</td>
                <td>${match.type}</td>
              </tr>
            `)
              .join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;
  const win = window.open('', '_blank');
  if (!win) {
    showError('No se pudo abrir la ventana de impresión.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.print();
  showSuccess('Reporte PDF generado.');
};
