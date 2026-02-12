import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BankReconciliationSteps } from './BankReconciliationSteps';
import { type BankReconciliationState } from '../hooks/useBankReconciliationState';

export const BankReconciliationView = ({ state }: { state: BankReconciliationState }) => {
  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <Card className="w-full mb-4">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Conciliación Bancaria</CardTitle>
          <CardDescription className="text-center">
            Compara extractos bancarios con libros contables para detectar coincidencias y discrepancias.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <BankReconciliationSteps state={state} />
        </CardContent>
      </Card>
    </div>
  );
};
