import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PersistedAiAnalysisMetaV1 } from '@/lib/ai-analysis-persistence/storage';

export const AiAnalysisResumeBanner: React.FC<{
  meta: PersistedAiAnalysisMetaV1;
  selectedFileMatches: boolean;
  onResume?: () => void;
  onDiscard: () => void;
}> = ({ meta, selectedFileMatches, onResume, onDiscard }) => {
  const label =
    meta.status === 'running'
      ? 'En progreso'
      : meta.status === 'stopped'
        ? 'Pendiente'
      : meta.status === 'failed'
        ? 'Fallido'
        : meta.status === 'completed'
          ? 'Completado'
          : 'Idle';

  const progressText =
    typeof meta.totalParts === 'number' && meta.totalParts > 0
      ? `${meta.processedParts}/${meta.totalParts} partes`
      : `${meta.processedParts} partes`;

  const canResume =
    selectedFileMatches &&
    (meta.status === 'stopped' || meta.status === 'failed') &&
    (typeof meta.totalParts !== 'number' || meta.processedParts < meta.totalParts);

  const helperText = selectedFileMatches
    ? meta.status === 'completed'
      ? 'Análisis completado guardado. Puedes revisarlo o descartarlo.'
      : meta.status === 'stopped'
        ? 'Listo para continuar desde donde quedó.'
        : meta.status === 'running'
          ? 'Análisis en progreso.'
          : 'Análisis guardado disponible.'
    : meta.status === 'completed'
      ? 'Selecciona el mismo PDF para ver el análisis guardado.'
      : 'Selecciona el mismo PDF para poder continuar el análisis.';

  return (
    <div className="border rounded-md p-3 bg-muted/20 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">Se detectó un análisis guardado</div>
          <div className="text-xs text-muted-foreground truncate">
            Archivo: {meta.file.name} • {progressText}
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {label}
        </Badge>
      </div>

      <div className="text-xs text-muted-foreground">
        {helperText}
      </div>

      <div className="flex items-center justify-end gap-2">
        {canResume && onResume && (
          <Button size="sm" variant="secondary" onClick={onResume}>
            Continuar análisis
          </Button>
        )}
        <Button size="sm" variant="destructive" onClick={onDiscard}>
          Descartar análisis guardado
        </Button>
      </div>
    </div>
  );
};
