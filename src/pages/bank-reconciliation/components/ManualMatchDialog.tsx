import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { type FieldMapping, type ReconciliationState } from '../types';

export function ManualMatchDialog({
  open,
  manualBankIndex,
  manualLedgerIndex,
  reconciliation,
  bankRows,
  ledgerRows,
  bankHeaders,
  ledgerHeaders,
  fieldMapping,
  onOpenChange,
  onSelectBankIndex,
  onSelectLedgerIndex,
  onConfirm,
}: {
  open: boolean;
  manualBankIndex: number | null;
  manualLedgerIndex: number | null;
  reconciliation: ReconciliationState;
  bankRows: string[][];
  ledgerRows: string[][];
  bankHeaders: string[];
  ledgerHeaders: string[];
  fieldMapping: FieldMapping;
  onOpenChange: (open: boolean) => void;
  onSelectBankIndex: (value: number | null) => void;
  onSelectLedgerIndex: (value: number | null) => void;
  onConfirm: () => void;
}) {
  const bankDescIndex = bankHeaders.findIndex(h => h === fieldMapping.bankDescription);
  const ledgerDescIndex = ledgerHeaders.findIndex(h => h === fieldMapping.ledgerDescription);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Emparejamiento Manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-2">Transacción en Extracto Bancario</div>
            <Select
              value={manualBankIndex?.toString() ?? ''}
              onValueChange={(value) => onSelectBankIndex(value ? Number(value) : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona transacción" />
              </SelectTrigger>
              <SelectContent>
                {reconciliation.onlyBank.map(idx => (
                  <SelectItem key={`bank-${idx}`} value={idx.toString()}>
                    {bankRows[idx]?.[bankDescIndex] || bankRows[idx]?.[0] || `Movimiento ${idx + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div>
            <div className="text-sm font-medium mb-2">Transacción en Libro Contable</div>
            <Select
              value={manualLedgerIndex?.toString() ?? ''}
              onValueChange={(value) => onSelectLedgerIndex(value ? Number(value) : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona transacción" />
              </SelectTrigger>
              <SelectContent>
                {reconciliation.onlyLedger.map(idx => (
                  <SelectItem key={`ledger-${idx}`} value={idx.toString()}>
                    {ledgerRows[idx]?.[ledgerDescIndex] || ledgerRows[idx]?.[0] || `Movimiento ${idx + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm} disabled={manualBankIndex === null || manualLedgerIndex === null}>
            Confirmar Emparejamiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
