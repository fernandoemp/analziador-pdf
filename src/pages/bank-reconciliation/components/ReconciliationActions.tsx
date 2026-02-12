import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export function ReconciliationActions({
  onBackToConfig,
  hasResults,
  onExportExcel,
  onExportPdf,
  onReset,
}: {
  onBackToConfig: () => void;
  hasResults: boolean;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onReset: () => void;
}) {
  return (
    <div className="border rounded-md p-4 space-y-3">
      <div className="font-semibold">Acciones Rápidas</div>
      {hasResults ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline">
              Volver a Configuración
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Volver a configuración</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción puede descartar cambios no guardados en los resultados actuales.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onBackToConfig}>Volver</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button type="button" variant="outline" onClick={onBackToConfig}>
          Volver a Configuración
        </Button>
      )}
      <Button type="button" variant="outline" onClick={onExportExcel}>
        Exportar Excel
      </Button>
      <Button type="button" variant="outline" onClick={onExportPdf}>
        Exportar PDF
      </Button>
      <Button type="button" variant="destructive" onClick={onReset}>
        Reiniciar proceso
      </Button>
    </div>
  );
}
