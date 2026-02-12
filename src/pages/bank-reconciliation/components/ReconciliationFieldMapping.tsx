import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type FieldMapping } from '../types';

export function ReconciliationFieldMapping({
  fieldMapping,
  bankHeadersOptions,
  ledgerHeadersOptions,
  onChangeFieldMapping,
}: {
  fieldMapping: FieldMapping;
  bankHeadersOptions: string[];
  ledgerHeadersOptions: string[];
  onChangeFieldMapping: (value: FieldMapping) => void;
}) {
  return (
    <div className="border rounded-md p-4 space-y-4">
      <div className="text-sm font-medium">Mapeo de Campos</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campo Requerido</TableHead>
            <TableHead>Columna en Extracto</TableHead>
            <TableHead>Columna en Libro</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Fecha</TableCell>
            <TableCell>
              <Select value={fieldMapping.bankDate} onValueChange={(value) => onChangeFieldMapping({ ...fieldMapping, bankDate: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona columna" />
                </SelectTrigger>
                <SelectContent>
                  {bankHeadersOptions.map((header) => (
                    <SelectItem key={`bank-date-${header}`} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Select value={fieldMapping.ledgerDate} onValueChange={(value) => onChangeFieldMapping({ ...fieldMapping, ledgerDate: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona columna" />
                </SelectTrigger>
                <SelectContent>
                  {ledgerHeadersOptions.map((header) => (
                    <SelectItem key={`ledger-date-${header}`} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Debe</TableCell>
            <TableCell>
              <Select value={fieldMapping.bankAmount} onValueChange={(value) => onChangeFieldMapping({ ...fieldMapping, bankAmount: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona columna" />
                </SelectTrigger>
                <SelectContent>
                  {bankHeadersOptions.map((header) => (
                    <SelectItem key={`bank-amount-${header}`} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Select value={fieldMapping.ledgerAmount} onValueChange={(value) => onChangeFieldMapping({ ...fieldMapping, ledgerAmount: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona columna" />
                </SelectTrigger>
                <SelectContent>
                  {ledgerHeadersOptions.map((header) => (
                    <SelectItem key={`ledger-amount-${header}`} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Haber</TableCell>
            <TableCell>
              <Select value={fieldMapping.bankCredit} onValueChange={(value) => onChangeFieldMapping({ ...fieldMapping, bankCredit: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona columna" />
                </SelectTrigger>
                <SelectContent>
                  {bankHeadersOptions.map((header) => (
                    <SelectItem key={`bank-credit-${header}`} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Select
                value={fieldMapping.ledgerCredit}
                onValueChange={(value) => onChangeFieldMapping({ ...fieldMapping, ledgerCredit: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona columna" />
                </SelectTrigger>
                <SelectContent>
                  {ledgerHeadersOptions.map((header) => (
                    <SelectItem key={`ledger-credit-${header}`} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Descripción</TableCell>
            <TableCell>
              <Select
                value={fieldMapping.bankDescription}
                onValueChange={(value) => onChangeFieldMapping({ ...fieldMapping, bankDescription: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona columna" />
                </SelectTrigger>
                <SelectContent>
                  {bankHeadersOptions.map((header) => (
                    <SelectItem key={`bank-desc-${header}`} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Select
                value={fieldMapping.ledgerDescription}
                onValueChange={(value) => onChangeFieldMapping({ ...fieldMapping, ledgerDescription: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona columna" />
                </SelectTrigger>
                <SelectContent>
                  {ledgerHeadersOptions.map((header) => (
                    <SelectItem key={`ledger-desc-${header}`} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
