import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LocalProgress } from '@/hooks/useLocalPdfAnalysis';

type Props = {
  localProgress: LocalProgress | null;
  localAnalysisState: 'idle' | 'running' | 'paused' | 'stopped' | 'failed' | 'completed';
  isProcessing: boolean;
  selectedFile: File | null;
  canDownloadCsv: boolean;
  onSelectFile: (file: File) => void;
  onShowHistoryIa: () => void;
  onPause: () => void;
  onStop: () => void;
  onResume: () => void;
  onRestart: () => void;
  onDownloadCsv: () => void;
};

const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
};

export const PdfLocalControls: React.FC<Props> = ({
  localProgress,
  localAnalysisState,
  isProcessing,
  selectedFile,
  canDownloadCsv,
  onSelectFile,
  onShowHistoryIa,
  onPause,
  onStop,
  onResume,
  onRestart,
  onDownloadCsv,
}) => {
  const showPauseStop =
    !!selectedFile &&
    (localAnalysisState === 'running' ||
      (isProcessing &&
        localAnalysisState !== 'paused' &&
        localAnalysisState !== 'stopped' &&
        localAnalysisState !== 'failed' &&
        localAnalysisState !== 'completed'));

  const showResume = localAnalysisState === 'paused' || localAnalysisState === 'stopped' || localAnalysisState === 'failed';

  const showRestart =
    !!selectedFile &&
    (localAnalysisState === 'paused' ||
      localAnalysisState === 'stopped' ||
      localAnalysisState === 'failed' ||
      localAnalysisState === 'completed');

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2">
        <Label htmlFor="pdf-file">Selecciona PDF</Label>
        <Input
          id="pdf-file"
          className="mt-1"
          type="file"
          accept=".pdf,application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onSelectFile(f);
          }}
        />
      </div>
      <div className="flex flex-col gap-2 min-w-0 justify-end">
        {localProgress && (
          <div className="text-[11px] text-muted-foreground">
            {localProgress.stageLabel} · {formatDuration(Date.now() - localProgress.startedAt)}
            {typeof localProgress.etaMs === 'number' ? ` · ETA ${formatDuration(localProgress.etaMs)}` : ''}
          </div>
        )}
        <div className="flex flex-wrap">
          <Button variant="outline" size="sm" onClick={onShowHistoryIa}>
            Ver historial IA
          </Button>
        </div>
      </div>
    </div>
  );
};
