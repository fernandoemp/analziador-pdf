import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AiHeaderCandidateEditor } from '@/components/pdf-structured-extractor/AiHeaderCandidateEditor';
import { useAiPdfVerification } from '@/hooks/useAiPdfVerification';
import { type KeyFieldSelection } from '../types';

export function Step4LedgerHeaders({
  ai,
  ledgerFile,
  ledgerFormat,
  activePdfRole,
  ledgerHeaderDraft,
  ledgerPreviewRows,
  ledgerKeyFields,
  onChangeHeader,
  onRemoveHeader,
  onAddHeader,
  onChangeKeyFields,
  onConfirm,
  onDetectHeaders,
  onBack,
}: {
  ai: ReturnType<typeof useAiPdfVerification>;
  ledgerFile: File | null;
  ledgerFormat: string;
  activePdfRole: 'bank' | 'ledger' | null;
  ledgerHeaderDraft: string[];
  ledgerPreviewRows: string[][];
  ledgerKeyFields: KeyFieldSelection;
  onChangeHeader: (index: number, value: string) => void;
  onRemoveHeader: (index: number) => void;
  onAddHeader: () => void;
  onChangeKeyFields: (value: KeyFieldSelection) => void;
  onConfirm: () => Promise<void>;
  onDetectHeaders: () => void;
  onBack: () => void;
}) {
  const headerCandidate = ledgerFormat === 'pdf' ? ai.headerDraft || ai.headerCandidate || ai.confirmedHeaders : ledgerHeaderDraft;
  const headerDraft = ledgerFormat === 'pdf' ? ai.headerDraft : ledgerHeaderDraft;
  const selectableHeaders = (headerCandidate || []).filter(header => header.trim() !== '');
  const canShowHeaders = headerCandidate && headerCandidate.length > 0;
  const detectLabel = ai.isAnalyzing
    ? 'Analizando...'
    : ai.confirmedHeaders
      ? 'Analizar movimientos con IA'
      : 'Detectar encabezado con IA';
  const canDetectPdf = ledgerFormat === 'pdf' && !!ledgerFile && activePdfRole === 'ledger' && !ai.isAnalyzing;

  return (
    <div className="space-y-6">
      <div className="border rounded-md p-4 space-y-4">
        <div className="font-semibold">Encabezados Detectados - Libro Contable</div>
        {ledgerFile && (
          <div>
            <Badge variant="secondary" className="text-xs">
              {ledgerFile.name}
            </Badge>
          </div>
        )}
        {ledgerFormat === 'pdf' ? (
          canShowHeaders ? (
            <AiHeaderCandidateEditor
              headerCandidate={headerCandidate}
              headerDraft={headerDraft}
              isAnalyzing={ai.isAnalyzing}
              selectedFile={ledgerFile}
              onUpdateHeaderField={ai.updateHeaderField}
              onDeleteHeaderField={ai.deleteHeaderField}
              onAddHeaderField={ai.addHeaderField}
              onConfirm={onConfirm}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {ai.isAnalyzing ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Detectando encabezados...</span>
                </div>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-fit"
                onClick={onDetectHeaders}
                disabled={!canDetectPdf}
              >
                {detectLabel}
              </Button>
            </div>
          )
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {ledgerHeaderDraft.map((header, idx) => (
                <div key={`${header}-${idx}`} className="flex items-center gap-2">
                  <Input value={header} onChange={(e) => onChangeHeader(idx, e.target.value)} className="h-8 w-44" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveHeader(idx)}>
                    Quitar
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={onAddHeader}>
                Agregar columna
              </Button>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-2">Vista previa (primeras 5 filas)</div>
              <div className="border rounded-md overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {ledgerHeaderDraft.map((header, idx) => (
                        <TableHead key={`header-${idx}`}>{header || '-'}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerPreviewRows.map((row, idx) => (
                      <TableRow key={`row-${idx}`}>
                        {ledgerHeaderDraft.map((_, colIdx) => (
                          <TableCell key={`cell-${idx}-${colIdx}`}>{row[colIdx] ?? ''}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {ai.verifyMessage ? <div className="text-sm text-green-600">{ai.verifyMessage}</div> : null}
        {ai.verifyError ? <div className="text-sm text-destructive">{ai.verifyError}</div> : null}
      </div>

      <div className="border rounded-md p-4 space-y-4">
        <div className="font-semibold">Identificación de Campos Clave</div>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <Label>Columna de Fecha</Label>
            <Select value={ledgerKeyFields.dateColumn} onValueChange={(value) => onChangeKeyFields({ ...ledgerKeyFields, dateColumn: value })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecciona columna" />
              </SelectTrigger>
              <SelectContent>
                {selectableHeaders.map((header, idx) => (
                  <SelectItem key={`date-${idx}`} value={header}>
                    {header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Columna de Debe</Label>
            <Select value={ledgerKeyFields.debitColumn} onValueChange={(value) => onChangeKeyFields({ ...ledgerKeyFields, debitColumn: value })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecciona columna" />
              </SelectTrigger>
              <SelectContent>
                {selectableHeaders.map((header, idx) => (
                  <SelectItem key={`debit-${idx}`} value={header}>
                    {header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Columna de Haber</Label>
            <Select value={ledgerKeyFields.creditColumn} onValueChange={(value) => onChangeKeyFields({ ...ledgerKeyFields, creditColumn: value })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecciona columna" />
              </SelectTrigger>
              <SelectContent>
                {selectableHeaders.map((header, idx) => (
                  <SelectItem key={`credit-${idx}`} value={header}>
                    {header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Columna de Descripción</Label>
            <Select
              value={ledgerKeyFields.descriptionColumn}
              onValueChange={(value) => onChangeKeyFields({ ...ledgerKeyFields, descriptionColumn: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecciona columna" />
              </SelectTrigger>
              <SelectContent>
                {selectableHeaders.map((header, idx) => (
                  <SelectItem key={`desc-${idx}`} value={header}>
                    {header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Regresar al extracto
        </Button>
        <Button type="button" onClick={onConfirm}>
          Confirmar y Continuar
        </Button>
      </div>
    </div>
  );
}
