import React from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, RotateCcw, Square, Trash2 } from 'lucide-react';

type Props = {
  hasTotalParts: boolean;
  displayProcessedParts: number;
  displayTotalParts: number;
  isAnalyzing: boolean;
  aiAnalysisState: 'idle' | 'running' | 'stopped' | 'failed' | 'completed';
  canRestart: boolean;
  canViewDetail: boolean;
  onStop: () => void;
  onResume: () => void;
  onRestart: () => void;
  onCancel: () => void;
  onViewDetail: () => void;
};

export const AiProgressControls: React.FC<Props> = ({
  hasTotalParts,
  displayProcessedParts,
  displayTotalParts,
  isAnalyzing,
  aiAnalysisState,
  canRestart,
  canViewDetail,
  onStop,
  onResume,
  onRestart,
  onCancel,
  onViewDetail,
}) => {
  const percent = hasTotalParts ? Math.round((displayProcessedParts / displayTotalParts) * 100) : null;
  const canShowResume = aiAnalysisState === 'stopped' || aiAnalysisState === 'failed';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <div className="flex justify-between text-xs text-muted-foreground flex-1">
          <span>
            Progreso del análisis:{' '}
            {hasTotalParts ? `${displayProcessedParts}/${displayTotalParts} partes` : `${displayProcessedParts} partes`}
          </span>
          {typeof percent === 'number' && <span>{percent}%</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="destructive" onClick={onStop} disabled={!isAnalyzing}>
            <Square className="h-4 w-4 mr-1" />
            Parar
          </Button>
          {canShowResume && (
            <Button size="sm" variant="secondary" onClick={onResume} disabled={isAnalyzing}>
              <Play className="h-4 w-4 mr-1" />
              Continuar
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onRestart} disabled={!canRestart}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Reiniciar
          </Button>
          <Button size="sm" variant="destructive" onClick={onCancel} disabled={aiAnalysisState === 'completed'}>
            <Trash2 className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
          <Button size="sm" variant="outline" onClick={onViewDetail} disabled={!canViewDetail}>
            Ver detalle
          </Button>
        </div>
      </div>
      {hasTotalParts && <Progress value={(displayProcessedParts / displayTotalParts) * 100} />}
    </div>
  );
};

