import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BankColumnMapping } from '@/types/finanzas';
import { Info } from 'lucide-react';

interface ColumnMappingConfigProps {
  mapping: BankColumnMapping;
  onChange: (mapping: BankColumnMapping) => void;
}

const ColumnMappingConfig: React.FC<ColumnMappingConfigProps> = ({ mapping, onChange }) => {
  const handleChange = (field: keyof BankColumnMapping, value: string) => {
    onChange({
      ...mapping,
      [field]: value.trim() || undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Info className="h-5 w-5" />
          Configuración de Columnas
        </CardTitle>
        <CardDescription>
          Define los nombres exactos de las columnas en los archivos de este banco.
          Deja en blanco las que no apliquen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date">Fecha</Label>
            <Input
              id="date"
              placeholder="Ej: Fecha, Date"
              value={mapping.date || ''}
              onChange={(e) => handleChange('date', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateValue">Fecha Valor</Label>
            <Input
              id="dateValue"
              placeholder="Ej: Fecha Valor, Value Date"
              value={mapping.dateValue || ''}
              onChange={(e) => handleChange('dateValue', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción/Concepto *</Label>
            <Input
              id="description"
              placeholder="Ej: Concepto, Descripción"
              value={mapping.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="detail">Detalle</Label>
            <Input
              id="detail"
              placeholder="Ej: Detalle, Detail"
              value={mapping.detail || ''}
              onChange={(e) => handleChange('detail', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="credit">Crédito *</Label>
            <Input
              id="credit"
              placeholder="Ej: Crédito, Abono, Credit"
              value={mapping.credit || ''}
              onChange={(e) => handleChange('credit', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="debit">Débito *</Label>
            <Input
              id="debit"
              placeholder="Ej: Débito, Cargo, Debit"
              value={mapping.debit || ''}
              onChange={(e) => handleChange('debit', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Monto (alternativo)</Label>
            <Input
              id="amount"
              placeholder="Ej: Monto, Amount"
              value={mapping.amount || ''}
              onChange={(e) => handleChange('amount', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Solo si usa una columna única en lugar de Crédito/Débito
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoría</Label>
            <Input
              id="category"
              placeholder="Ej: Categoría, Tipo"
              value={mapping.category || ''}
              onChange={(e) => handleChange('category', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Código</Label>
            <Input
              id="code"
              placeholder="Ej: Código, Code"
              value={mapping.code || ''}
              onChange={(e) => handleChange('code', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="document">Número Documento</Label>
            <Input
              id="document"
              placeholder="Ej: Número Doc, Document"
              value={mapping.document || ''}
              onChange={(e) => handleChange('document', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="office">Oficina</Label>
            <Input
              id="office"
              placeholder="Ej: Oficina, Office"
              value={mapping.office || ''}
              onChange={(e) => handleChange('office', e.target.value)}
            />
          </div>
        </div>

        <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-800">
          <p className="font-semibold mb-1">💡 Consejos:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Los nombres deben coincidir exactamente con los del archivo</li>
            <li>No distingue mayúsculas/minúsculas ni acentos</li>
            <li>Campos marcados con * son recomendados</li>
            <li>Si no configuras columnas, se usará detección automática</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ColumnMappingConfig;
