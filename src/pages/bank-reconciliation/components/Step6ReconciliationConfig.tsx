import { Button } from '@/components/ui/button';
import { type FieldMapping } from '../types';
import { ReconciliationFieldMapping } from './ReconciliationFieldMapping';
import { ReconciliationTolerances } from './ReconciliationTolerances';

export function Step6ReconciliationConfig({
  toleranceDays,
  toleranceAmountPercent,
  useDescription,
  descriptionThreshold,
  fieldMapping,
  bankHeadersOptions,
  ledgerHeadersOptions,
  onChangeToleranceDays,
  onChangeToleranceAmountPercent,
  onToggleDescription,
  onChangeDescriptionThreshold,
  onChangeFieldMapping,
  onBack,
  onExecute,
}: {
  toleranceDays: number;
  toleranceAmountPercent: number;
  useDescription: boolean;
  descriptionThreshold: number;
  fieldMapping: FieldMapping;
  bankHeadersOptions: string[];
  ledgerHeadersOptions: string[];
  onChangeToleranceDays: (value: number) => void;
  onChangeToleranceAmountPercent: (value: number) => void;
  onToggleDescription: (value: boolean) => void;
  onChangeDescriptionThreshold: (value: number) => void;
  onChangeFieldMapping: (value: FieldMapping) => void;
  onBack: () => void;
  onExecute: () => void;
}) {
  return (
    <div className="space-y-6">
      <ReconciliationTolerances
        toleranceDays={toleranceDays}
        toleranceAmountPercent={toleranceAmountPercent}
        useDescription={useDescription}
        descriptionThreshold={descriptionThreshold}
        onChangeToleranceDays={onChangeToleranceDays}
        onChangeToleranceAmountPercent={onChangeToleranceAmountPercent}
        onToggleDescription={onToggleDescription}
        onChangeDescriptionThreshold={onChangeDescriptionThreshold}
      />

      <ReconciliationFieldMapping
        fieldMapping={fieldMapping}
        bankHeadersOptions={bankHeadersOptions}
        ledgerHeadersOptions={ledgerHeadersOptions}
        onChangeFieldMapping={onChangeFieldMapping}
      />

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Regresar
        </Button>
        <Button type="button" onClick={onExecute}>
          🔍 Ejecutar Conciliación
        </Button>
      </div>
    </div>
  );
}
