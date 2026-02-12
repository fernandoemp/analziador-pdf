import { Loader2 } from 'lucide-react';
import { type ReconciliationStats } from '../types';

export function ReconciliationStats({
  stats,
  isReconciling,
}: {
  stats: ReconciliationStats;
  isReconciling: boolean;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Estadísticas de Conciliación</div>
          <div className="text-sm text-muted-foreground">Resultados consolidados</div>
        </div>
        {isReconciling && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="border rounded-md p-4">
          <div className="text-xs text-muted-foreground">Total Extracto Bancario</div>
          <div className="text-2xl font-semibold">{stats.totalBank}</div>
        </div>
        <div className="border rounded-md p-4">
          <div className="text-xs text-muted-foreground">Total Libro Contable</div>
          <div className="text-2xl font-semibold">{stats.totalLedger}</div>
        </div>
        <div className="border rounded-md p-4">
          <div className="text-xs text-muted-foreground">Coincidencias</div>
          <div className="text-2xl font-semibold">{stats.matchCount}</div>
        </div>
        <div className="border rounded-md p-4">
          <div className="text-xs text-muted-foreground">Discrepancias menores</div>
          <div className="text-2xl font-semibold">{stats.discrepancyCount}</div>
        </div>
        <div className="border rounded-md p-4">
          <div className="text-xs text-muted-foreground">Sin emparejar en Extracto</div>
          <div className="text-2xl font-semibold">{stats.unmatchedBank}</div>
        </div>
        <div className="border rounded-md p-4">
          <div className="text-xs text-muted-foreground">Sin emparejar en Libro</div>
          <div className="text-2xl font-semibold">{stats.unmatchedLedger}</div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-sm font-medium">Tasa de Conciliación: {stats.rate}%</div>
        <div className="h-3 w-full rounded-full overflow-hidden bg-muted">
          <div className="bg-green-500 h-full" style={{ width: `${stats.rate}%` }} />
        </div>
      </div>
    </>
  );
}
