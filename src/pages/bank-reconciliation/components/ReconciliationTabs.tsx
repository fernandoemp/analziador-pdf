import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type FieldMapping, type ReconciliationState } from '../types';
import { getMappedAmountDisplay } from '../utils/reconciliationEngine';

export function ReconciliationTabs({
  reconciliation,
  bankHeaders,
  ledgerHeaders,
  bankRows,
  ledgerRows,
  fieldMapping,
  onToggleMatchVerified,
  onAcceptDiscrepancy,
}: {
  reconciliation: ReconciliationState;
  bankHeaders: string[];
  ledgerHeaders: string[];
  bankRows: string[][];
  ledgerRows: string[][];
  fieldMapping: FieldMapping;
  onToggleMatchVerified: (matchId: string, checked: boolean) => void;
  onAcceptDiscrepancy: (matchId: string) => void;
}) {
  const bankDateIndex = bankHeaders.findIndex(h => h === fieldMapping.bankDate);
  const ledgerDateIndex = ledgerHeaders.findIndex(h => h === fieldMapping.ledgerDate);

  return (
    <Tabs defaultValue="matches">
      <TabsList>
        <TabsTrigger value="matches">✅ Coincidencias ({reconciliation.matches.length})</TabsTrigger>
        <TabsTrigger value="discrepancies">⚠️ Discrepancias ({reconciliation.discrepancies.length})</TabsTrigger>
        <TabsTrigger value="only-bank">❌ Solo en Extracto ({reconciliation.onlyBank.length})</TabsTrigger>
        <TabsTrigger value="only-ledger">❌ Solo en Libro ({reconciliation.onlyLedger.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="matches" className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Score</TableHead>
              <TableHead>Fecha Extracto</TableHead>
              <TableHead>Fecha Libro</TableHead>
              <TableHead>Monto Extracto</TableHead>
              <TableHead>Monto Libro</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Verificado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reconciliation.matches.map(match => (
              <TableRow key={match.id}>
                <TableCell>{match.score}%</TableCell>
                <TableCell>{bankRows[match.bankIndex]?.[bankDateIndex]}</TableCell>
                <TableCell>{ledgerRows[match.ledgerIndex]?.[ledgerDateIndex]}</TableCell>
                <TableCell>
                  {getMappedAmountDisplay(
                    bankRows[match.bankIndex] || [],
                    bankHeaders,
                    fieldMapping.bankAmount,
                    fieldMapping.bankCredit,
                  )}
                </TableCell>
                <TableCell>
                  {getMappedAmountDisplay(
                    ledgerRows[match.ledgerIndex] || [],
                    ledgerHeaders,
                    fieldMapping.ledgerAmount,
                    fieldMapping.ledgerCredit,
                  )}
                </TableCell>
                <TableCell>{match.type}</TableCell>
                <TableCell>
                  <Checkbox checked={match.verified} onCheckedChange={(v) => onToggleMatchVerified(match.id, !!v)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TabsContent>
      <TabsContent value="discrepancies" className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha Extracto</TableHead>
              <TableHead>Fecha Libro</TableHead>
              <TableHead>Monto Extracto</TableHead>
              <TableHead>Monto Libro</TableHead>
              <TableHead>Diferencia</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reconciliation.discrepancies.map(match => (
              <TableRow key={`disc-${match.id}`}>
                <TableCell>{bankRows[match.bankIndex]?.[bankDateIndex]}</TableCell>
                <TableCell>{ledgerRows[match.ledgerIndex]?.[ledgerDateIndex]}</TableCell>
                <TableCell>
                  {getMappedAmountDisplay(
                    bankRows[match.bankIndex] || [],
                    bankHeaders,
                    fieldMapping.bankAmount,
                    fieldMapping.bankCredit,
                  )}
                </TableCell>
                <TableCell>
                  {getMappedAmountDisplay(
                    ledgerRows[match.ledgerIndex] || [],
                    ledgerHeaders,
                    fieldMapping.ledgerAmount,
                    fieldMapping.ledgerCredit,
                  )}
                </TableCell>
                <TableCell>
                  {match.amountDiff.toFixed(2)} / {match.dateDiffDays} días
                </TableCell>
                <TableCell>
                  <Button type="button" size="sm" variant="outline" onClick={() => onAcceptDiscrepancy(match.id)}>
                    Aceptar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TabsContent>
      <TabsContent value="only-bank" className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              {bankHeaders.map(header => (
                <TableHead key={`only-bank-${header}`}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {reconciliation.onlyBank.map(idx => (
              <TableRow key={`only-bank-row-${idx}`}>
                {bankHeaders.map((_, colIdx) => (
                  <TableCell key={`only-bank-cell-${idx}-${colIdx}`}>{bankRows[idx]?.[colIdx]}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TabsContent>
      <TabsContent value="only-ledger" className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              {ledgerHeaders.map(header => (
                <TableHead key={`only-ledger-${header}`}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {reconciliation.onlyLedger.map(idx => (
              <TableRow key={`only-ledger-row-${idx}`}>
                {ledgerHeaders.map((_, colIdx) => (
                  <TableCell key={`only-ledger-cell-${idx}-${colIdx}`}>{ledgerRows[idx]?.[colIdx]}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TabsContent>
    </Tabs>
  );
}
