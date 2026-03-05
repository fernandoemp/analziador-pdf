import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AiHeaderCandidateEditor } from '@/components/pdf-structured-extractor/AiHeaderCandidateEditor';
import { useAiPdfVerification } from '@/hooks/useAiPdfVerification';

export function Step4LedgerHeaders({
  ai,
  ledgerFile,
  ledgerFormat,
  activePdfRole,
  ledgerHeaderDraft,
  ledgerPreviewRows,
  onChangeHeader,
  onRemoveHeader,
  onAddHeader,
  onConfirm,
  onDetectHeaders,
  onDetectLocalHeaders,
  onBack,
}: {
  ai: ReturnType<typeof useAiPdfVerification>;
  ledgerFile: File | null;
  ledgerFormat: string;
  activePdfRole: 'bank' | 'ledger' | null;
  ledgerHeaderDraft: string[];
  ledgerPreviewRows: string[][];
  onChangeHeader: (index: number, value: string) => void;
  onRemoveHeader: (index: number) => void;
  onAddHeader: () => void;
  onConfirm: () => Promise<void>;
  onDetectHeaders: () => void;
  onDetectLocalHeaders: () => Promise<void>;
  onBack: () => void;
}) {
  const [isDetectingLocal, setIsDetectingLocal] = useState(false);
  const pdfHeaderCandidate =
    activePdfRole === 'ledger' ? ai.headerDraft || ai.headerCandidate || ai.confirmedHeaders : null;
  const headerCandidate = ledgerFormat === 'pdf' ? pdfHeaderCandidate : ledgerHeaderDraft;
  const headerDraft = ledgerFormat === 'pdf' && activePdfRole === 'ledger' ? ai.headerDraft : ledgerHeaderDraft;
  const canShowHeaders = headerCandidate && headerCandidate.length > 0;
  const detectLabel = ai.isAnalyzing
    ? 'Analizando...'
    : ai.confirmedHeaders
      ? 'Analizar movimientos con IA'
      : 'Detectar encabezado con IA';
  const canDetectPdf = ledgerFormat === 'pdf' && !!ledgerFile && activePdfRole === 'ledger' && !ai.isAnalyzing;
  const canDetectLocal = ledgerFormat !== 'pdf' && !!ledgerFile;
  const hasLocalHeaders = ledgerFormat !== 'pdf' && ledgerHeaderDraft.some(h => h.trim() !== '');

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
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-fit"
                onClick={async () => {
                  setIsDetectingLocal(true);
                  try {
                    await onDetectLocalHeaders();
                  } finally {
                    setIsDetectingLocal(false);
                  }
                }}
                disabled={!canDetectLocal || isDetectingLocal}
              >
                {isDetectingLocal
                  ? 'Detectando...'
                  : ledgerHeaderDraft.length > 0
                    ? 'Volver a detectar encabezados'
                    : 'Detectar encabezados'}
              </Button>
              {!hasLocalHeaders ? (
                <div className="text-sm text-muted-foreground">
                  Presiona “Detectar encabezados” para cargar el encabezado.
                </div>
              ) : null}
            </div>

            {hasLocalHeaders ? (
              <>
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
              </>
            ) : null}
          </div>
        )}

        {ledgerFormat === 'pdf' && activePdfRole === 'ledger' && ai.verifyMessage ? (
          <div className="text-sm text-green-600">{ai.verifyMessage}</div>
        ) : null}
        {ledgerFormat === 'pdf' && activePdfRole === 'ledger' && ai.verifyError ? (
          <div className="text-sm text-destructive">{ai.verifyError}</div>
        ) : null}
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Regresar al extracto
        </Button>
        <Button type="button" onClick={onConfirm} disabled={ledgerFormat !== 'pdf' && !hasLocalHeaders}>
          Confirmar encabezado y analizar movimientos
        </Button>
      </div>
    </div>
  );
}
