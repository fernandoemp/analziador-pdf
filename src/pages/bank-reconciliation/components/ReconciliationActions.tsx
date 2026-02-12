import { Button } from '@/components/ui/button';

export function ReconciliationActions({
  onSaveSession,
  onShowValidator,
  canShowValidator,
  onShowManualMatch,
  onExportExcel,
  onExportPdf,
  onReset,
  validatorProgress,
}: {
  onSaveSession: () => void;
  onShowValidator: () => void;
  canShowValidator: boolean;
  onShowManualMatch: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onReset: () => void;
  validatorProgress: { validated: number; total: number } | null;
}) {
  return (
    <div className="border rounded-md p-4 space-y-3">
      <div className="font-semibold">Acciones Rápidas</div>
      <Button type="button" variant="outline" onClick={onSaveSession}>
        Guardar sesión
      </Button>
      <Button type="button" variant="outline" onClick={onShowValidator} disabled={!canShowValidator}>
        Validar emparejamientos
      </Button>
      <Button type="button" variant="outline" onClick={onShowManualMatch}>
        Emparejar manualmente
      </Button>
      <Button type="button" variant="outline" onClick={onExportExcel}>
        Exportar Excel
      </Button>
      <Button type="button" variant="outline" onClick={onExportPdf}>
        Exportar PDF
      </Button>
      <Button type="button" variant="destructive" onClick={onReset}>
        Reiniciar proceso
      </Button>
      {validatorProgress && (
        <div className="text-xs text-muted-foreground">
          Validación: {validatorProgress.validated}/{validatorProgress.total} páginas
        </div>
      )}
    </div>
  );
}
