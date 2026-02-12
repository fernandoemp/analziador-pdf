import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

export function ReconciliationTolerances({
  toleranceDays,
  toleranceAmountPercent,
  useDescription,
  descriptionThreshold,
  onChangeToleranceDays,
  onChangeToleranceAmountPercent,
  onToggleDescription,
  onChangeDescriptionThreshold,
}: {
  toleranceDays: number;
  toleranceAmountPercent: number;
  useDescription: boolean;
  descriptionThreshold: number;
  onChangeToleranceDays: (value: number) => void;
  onChangeToleranceAmountPercent: (value: number) => void;
  onToggleDescription: (value: boolean) => void;
  onChangeDescriptionThreshold: (value: number) => void;
}) {
  return (
    <>
      <div className="border rounded-md p-4 space-y-4">
        <div className="text-sm font-medium">Tolerancias</div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Tolerancia en fechas (días)</Label>
            <Input type="number" value={toleranceDays} onChange={(e) => onChangeToleranceDays(Number(e.target.value))} className="mt-1" />
            <div className="text-xs text-muted-foreground mt-1">Permite emparejar transacciones con hasta X días de diferencia</div>
          </div>
          <div>
            <Label>Tolerancia en montos (%)</Label>
            <Input
              type="number"
              value={toleranceAmountPercent}
              onChange={(e) => onChangeToleranceAmountPercent(Number(e.target.value))}
              className="mt-1"
            />
            <div className="text-xs text-muted-foreground mt-1">Permite emparejar montos con hasta X% de diferencia</div>
          </div>
        </div>
      </div>

      <div className="border rounded-md p-4 space-y-4">
        <div className="text-sm font-medium">Campos a Comparar</div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox checked id="compare-date" />
            <label htmlFor="compare-date" className="text-sm">
              Comparar fechas
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked id="compare-amount" />
            <label htmlFor="compare-amount" className="text-sm">
              Comparar montos
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={useDescription} onCheckedChange={(v) => onToggleDescription(!!v)} id="compare-desc" />
            <label htmlFor="compare-desc" className="text-sm">
              Usar descripción para mejorar emparejamiento
            </label>
          </div>
          {useDescription && (
            <div className="space-y-2">
              <div className="text-sm">Umbral de similitud de texto: {descriptionThreshold}%</div>
              <Slider value={[descriptionThreshold]} min={50} max={100} step={1} onValueChange={(value) => onChangeDescriptionThreshold(value[0] ?? 80)} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
