import { Badge } from '@/components/ui/badge';

const STEP_LABELS = [
  { id: 1, label: 'Carga de archivos' },
  { id: 2, label: 'Encabezados y análisis' },
  { id: 3, label: 'Extracción extracto' },
  { id: 4, label: 'Encabezados libro' },
  { id: 5, label: 'Extracción libro' },
  { id: 6, label: 'Configuración' },
  { id: 7, label: 'Resultados' },
];

export function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {STEP_LABELS.map(({ id, label }) => (
          <div key={id} className="flex items-center gap-2">
            <Badge variant={step === id ? 'default' : 'secondary'}>Paso {id}</Badge>
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
