import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AiHeaderCandidateEditor } from '@/components/pdf-structured-extractor/AiHeaderCandidateEditor';
import { BANK_OPTIONS } from '../types';
import { useAiPdfVerification } from '@/hooks/useAiPdfVerification';

export function Step2BankHeaders({
  ai,
  bankFile,
  activePdfRole,
  selectedBank,
  saveBankConfig,
  savedBankHeaders,
  onSelectBank,
  onToggleSaveConfig,
  onApplySavedHeaders,
  onConfirm,
  onDetectHeaders,
  onBack,
}: {
  ai: ReturnType<typeof useAiPdfVerification>;
  bankFile: File | null;
  activePdfRole: 'bank' | 'ledger' | null;
  selectedBank: (typeof BANK_OPTIONS)[number];
  saveBankConfig: boolean;
  savedBankHeaders: string[] | null;
  onSelectBank: (value: (typeof BANK_OPTIONS)[number]) => void;
  onToggleSaveConfig: (value: boolean) => void;
  onApplySavedHeaders: () => void;
  onConfirm: () => Promise<void>;
  onDetectHeaders: () => void;
  onBack: () => void;
}) {
  const headerCandidate = activePdfRole === 'bank' ? ai.headerDraft || ai.headerCandidate || ai.confirmedHeaders : null;
  const detectLabel = ai.isAnalyzing
    ? 'Analizando...'
    : ai.confirmedHeaders
      ? 'Analizar movimientos con IA'
      : 'Detectar encabezado con IA';
  const canDetect = !!bankFile && activePdfRole === 'bank' && !ai.isAnalyzing;
  return (
    <div className="space-y-6">
      <div className="border rounded-md p-4 space-y-4">
        <div className="flex flex-col gap-2">
          <div className="font-semibold">Encabezados Detectados - Extracto Bancario</div>
          {bankFile && (
            <div>
              <Badge variant="secondary" className="text-xs">
                {bankFile.name}
              </Badge>
            </div>
          )}
          {headerCandidate ? (
            <AiHeaderCandidateEditor
              headerCandidate={headerCandidate}
              headerDraft={ai.headerDraft}
              isAnalyzing={ai.isAnalyzing}
              selectedFile={bankFile}
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
                disabled={!canDetect}
              >
                {detectLabel}
              </Button>
            </div>
          )}

          {ai.verifyMessage ? <div className="text-sm text-green-600">{ai.verifyMessage}</div> : null}
          {ai.verifyError ? <div className="text-sm text-destructive">{ai.verifyError}</div> : null}
        </div>
      </div>

      <div className="border rounded-md p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Entidad bancaria</Label>
            <Select value={selectedBank} onValueChange={onSelectBank}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecciona banco" />
              </SelectTrigger>
              <SelectContent>
                {['Banco Macro', 'Banco Nación', 'BBVA', 'Santander', 'Galicia', 'Otro'].map(option => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Checkbox id="save-config" checked={saveBankConfig} onCheckedChange={(v) => onToggleSaveConfig(!!v)} />
            <label htmlFor="save-config" className="text-sm">
              Guardar esta configuración para futuros extractos de {selectedBank}
            </label>
          </div>
        </div>
        {savedBankHeaders && savedBankHeaders.length > 0 && (
          <div className="flex items-center justify-between gap-2 border rounded-md p-3 bg-muted/20">
            <div className="text-sm">Hay una configuración guardada para {selectedBank}.</div>
            <Button type="button" variant="outline" size="sm" onClick={onApplySavedHeaders}>
              Aplicar configuración
            </Button>
          </div>
        )}
      </div>
      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Regresar
        </Button>
      </div>
    </div>
  );
}
