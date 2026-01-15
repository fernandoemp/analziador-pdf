import React, { useEffect, useMemo, useState } from 'react';
import type { AiExtractionLog, PdfAnalysisRun, PdfAnalysisStage } from '@/lib/localDb';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aiLogs: AiExtractionLog[];
  analysisRuns: PdfAnalysisRun[];
  currentRunId?: string | null;
  focusAiLogId?: string | null;
};

const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
};

const formatRunStatus = (status: PdfAnalysisRun['status']) => {
  switch (status) {
    case 'in_progress':
      return 'En progreso';
    case 'paused':
      return 'Pausado';
    case 'stopped':
      return 'Detenido';
    case 'failed':
      return 'Fallido';
    case 'completed':
      return 'Completado';
    default:
      return status;
  }
};

const formatStageStatus = (status: PdfAnalysisStage['status']) => {
  switch (status) {
    case 'in_progress':
      return 'En progreso';
    case 'pending':
      return 'Pendiente';
    case 'completed':
      return 'Completado';
    case 'paused':
      return 'Pausado';
    case 'stopped':
      return 'Detenido';
    case 'failed':
      return 'Fallido';
    default:
      return status;
  }
};

const getStatusBadgeVariant = (
  status: PdfAnalysisRun['status'],
): 'default' | 'secondary' | 'outline' | 'destructive' => {
  switch (status) {
    case 'completed':
      return 'secondary';
    case 'failed':
      return 'destructive';
    case 'paused':
    case 'stopped':
      return 'outline';
    case 'in_progress':
    default:
      return 'default';
  }
};

export const AiLogsDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  aiLogs,
  analysisRuns,
  currentRunId,
  focusAiLogId,
}) => {
  const [expandedAiLogId, setExpandedAiLogId] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const safeAiLogs = useMemo(() => (Array.isArray(aiLogs) ? aiLogs : []), [aiLogs]);
  const safeAnalysisRuns = useMemo(() => (Array.isArray(analysisRuns) ? analysisRuns : []), [analysisRuns]);

  const formatAiLogStatus = (status: AiExtractionLog['status']) => {
    switch (status) {
      case 'in_progress':
        return 'En progreso';
      case 'completed':
        return 'Completado';
      case 'failed':
        return 'Fallido';
      case 'stopped':
        return 'Detenido';
      case 'canceled':
        return 'Cancelado';
      default:
        return status || '-';
    }
  };

  useEffect(() => {
    if (!open) return;
    if (!focusAiLogId) return;
    setExpandedAiLogId(focusAiLogId);
  }, [focusAiLogId, open]);

  const getAiLogTokens = (log: AiExtractionLog) => {
    const hasSummary =
      typeof log.totalTokens === 'number' ||
      typeof log.promptTokens === 'number' ||
      typeof log.completionTokens === 'number';
    if (hasSummary) {
      return {
        prompt: typeof log.promptTokens === 'number' ? log.promptTokens : 0,
        completion: typeof log.completionTokens === 'number' ? log.completionTokens : 0,
        total: typeof log.totalTokens === 'number' ? log.totalTokens : 0,
      };
    }
    const reqs = log.requests && Array.isArray(log.requests) ? log.requests : [];
    return reqs.reduce(
      (acc, r) => {
        acc.prompt += typeof r.promptTokens === 'number' ? r.promptTokens : 0;
        acc.completion += typeof r.completionTokens === 'number' ? r.completionTokens : 0;
        acc.total += typeof r.totalTokens === 'number' ? r.totalTokens : 0;
        return acc;
      },
      { prompt: 0, completion: 0, total: 0 },
    );
  };

  const aiTotals = useMemo(() => {
    return safeAiLogs.reduce(
      (acc, log) => {
        const tokens = getAiLogTokens(log);
        acc.total += tokens.total;
        acc.prompt += tokens.prompt;
        acc.completion += tokens.completion;
        return acc;
      },
      { total: 0, prompt: 0, completion: 0 },
    );
  }, [safeAiLogs]);

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setExpandedAiLogId(null);
          setExpandedRunId(null);
        }
      }}
    >
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Historial IA</DialogTitle>
        </DialogHeader>

        <div className="border rounded-md overflow-hidden flex-1 flex flex-col">
          <div className="p-3 border-b bg-muted/30">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="border rounded-md bg-background p-2">
                  <div className="text-xs text-muted-foreground">Procesamientos IA</div>
                  <div className="text-sm font-medium">{safeAiLogs.length}</div>
                </div>
                <div className="border rounded-md bg-background p-2">
                  <div className="text-xs text-muted-foreground">Análisis local</div>
                  <div className="text-sm font-medium">{safeAnalysisRuns.length}</div>
                </div>
              <div className="border rounded-md bg-background p-2">
                <div className="text-xs text-muted-foreground">Tokens IA acumulados</div>
                <div className="text-sm font-medium">{aiTotals.total || 0}</div>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Los tokens se muestran cuando el proveedor reporta uso (por ejemplo, Kimi).
            </div>
          </div>

          <div className="flex-1 overflow-auto divide-y">
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Procesamientos IA</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Prompt {aiTotals.prompt}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Respuesta {aiTotals.completion}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Total {aiTotals.total}
                  </Badge>
                </div>
              </div>

              {safeAiLogs.length === 0 ? (
                <div className="text-sm text-muted-foreground">Aún no hay procesamientos IA registrados.</div>
              ) : (
                <div className="space-y-2">
                  {safeAiLogs.map(log => {
                    const isExpanded = expandedAiLogId === log.id;
                    const tokens = getAiLogTokens(log);
                    const requests = log.requests && Array.isArray(log.requests) ? log.requests : [];
                    const sortedRequests = [...requests].sort((a, b) => {
                      const aT = typeof a.startedAt === 'number' ? a.startedAt : 0;
                      const bT = typeof b.startedAt === 'number' ? b.startedAt : 0;
                      return aT - bT;
                    });
                    return (
                      <div key={log.id} className="border rounded-md p-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-xs capitalize">
                                {log.provider}
                              </Badge>
                              {log.status && (
                                <Badge
                                  variant={
                                    log.status === 'failed'
                                      ? 'destructive'
                                      : log.status === 'completed'
                                        ? 'secondary'
                                        : 'outline'
                                  }
                                  className="text-xs"
                                >
                                  {formatAiLogStatus(log.status)}
                                </Badge>
                              )}
                              <div className="text-sm font-medium truncate">{log.fileName}</div>
                              <div className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Modelo: {log.model}
                              {tokens.total ? ` · Tokens: ${tokens.total}` : ''}
                              {typeof log.processedParts === 'number' && typeof log.totalParts === 'number'
                                ? ` · Partes: ${log.processedParts}/${log.totalParts}`
                                : ''}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setExpandedAiLogId(prev => (prev === log.id ? null : log.id))}
                          >
                            {isExpanded ? 'Ocultar detalle' : 'Ver detalle'}
                          </Button>
                        </div>

                        {isExpanded && (
                          <div className="mt-2 space-y-2">
                            <div className="border rounded-md overflow-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Campo</TableHead>
                                    <TableHead>Valor</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  <TableRow>
                                    <TableCell className="text-xs">Archivo</TableCell>
                                    <TableCell className="text-xs">{log.fileName}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell className="text-xs">Proveedor</TableCell>
                                    <TableCell className="text-xs capitalize">{log.provider}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell className="text-xs">Modelo</TableCell>
                                    <TableCell className="text-xs">{log.model}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell className="text-xs">Tokens prompt</TableCell>
                                    <TableCell className="text-xs">{tokens.prompt || '-'}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell className="text-xs">Tokens respuesta</TableCell>
                                    <TableCell className="text-xs">{tokens.completion || '-'}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell className="text-xs">Tokens totales</TableCell>
                                    <TableCell className="text-xs">{tokens.total || '-'}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell className="text-xs">Partes</TableCell>
                                    <TableCell className="text-xs">
                                      {typeof log.processedParts === 'number' && typeof log.totalParts === 'number'
                                        ? `${log.processedParts}/${log.totalParts}`
                                        : '-'}
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </div>

                            <div className="border rounded-md overflow-auto">
                              <div className="p-2 text-xs font-medium">Detalle por parte</div>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Parte</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Tiempo</TableHead>
                                    <TableHead className="text-right">Prompt</TableHead>
                                    <TableHead className="text-right">Respuesta</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Filas</TableHead>
                                    <TableHead>Error</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {sortedRequests.length === 0 ? (
                                    <TableRow>
                                      <TableCell colSpan={8} className="text-xs text-muted-foreground text-center">
                                        Sin partes registradas.
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    sortedRequests.map(req => (
                                      <TableRow key={req.id}>
                                        <TableCell className="text-xs">
                                          {typeof req.partIndex === 'number' && typeof req.totalParts === 'number'
                                            ? `${req.partIndex}/${req.totalParts}`
                                            : req.segmentId}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                          {req.status === 'in_progress'
                                            ? 'En progreso'
                                            : req.status === 'completed'
                                              ? 'Completado'
                                              : 'Fallido'}
                                        </TableCell>
                                        <TableCell className="text-xs text-right">
                                          {typeof req.elapsedMs === 'number' ? formatDuration(req.elapsedMs) : '-'}
                                        </TableCell>
                                        <TableCell className="text-xs text-right">
                                          {typeof req.promptTokens === 'number' ? req.promptTokens : '-'}
                                        </TableCell>
                                        <TableCell className="text-xs text-right">
                                          {typeof req.completionTokens === 'number' ? req.completionTokens : '-'}
                                        </TableCell>
                                        <TableCell className="text-xs text-right">
                                          {typeof req.totalTokens === 'number' ? req.totalTokens : '-'}
                                        </TableCell>
                                        <TableCell className="text-xs text-right">
                                          {typeof req.rowCount === 'number' ? req.rowCount : '-'}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                          {req.error ? <span className="text-destructive">{req.error}</span> : '-'}
                                        </TableCell>
                                      </TableRow>
                                    ))
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Análisis local</div>
              </div>

              {safeAnalysisRuns.length === 0 ? (
                <div className="text-sm text-muted-foreground">Aún no hay análisis locales registrados.</div>
              ) : (
                <div className="space-y-2">
                  {safeAnalysisRuns.map(run => {
                    const isExpanded = expandedRunId === run.id;
                    const durationMs =
                      typeof run.startedAt === 'number' && typeof run.endedAt === 'number'
                        ? run.endedAt - run.startedAt
                        : undefined;
                    const isCurrent = currentRunId ? currentRunId === run.id : false;

                    return (
                      <div key={run.id} className="border rounded-md p-2 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-xs capitalize">
                                {run.mode}
                              </Badge>
                              <Badge variant={getStatusBadgeVariant(run.status)} className="text-xs">
                                {formatRunStatus(run.status)}
                              </Badge>
                              {isCurrent && (
                                <Badge variant="outline" className="text-xs">
                                  Actual
                                </Badge>
                              )}
                              <div className="text-sm font-medium truncate">{run.fileName}</div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(run.createdAt).toLocaleString()}
                              {typeof durationMs === 'number' ? ` · ${formatDuration(durationMs)}` : ''}
                              {run.resume?.nextPage && run.resume?.totalPages
                                ? ` · Reanudar en página ${run.resume.nextPage}/${run.resume.totalPages}`
                                : ''}
                              {run.resume?.nextPart && run.resume?.totalParts
                                ? ` · Reanudar en parte ${run.resume.nextPart}/${run.resume.totalParts}`
                                : ''}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setExpandedRunId(prev => (prev === run.id ? null : run.id))}
                          >
                            {isExpanded ? 'Ocultar etapas' : 'Ver etapas'}
                          </Button>
                        </div>

                        {isExpanded && (
                          <div className="border rounded-md overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Etapa</TableHead>
                                  <TableHead>Estado</TableHead>
                                  <TableHead className="text-right">Tiempo</TableHead>
                                  <TableHead className="text-right">ETA</TableHead>
                                  <TableHead>Detalle</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {run.stages.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={5} className="text-xs text-muted-foreground text-center">
                                      Sin etapas registradas.
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  run.stages.map(stage => {
                                    const stageElapsed =
                                      typeof stage.elapsedMs === 'number'
                                        ? stage.elapsedMs
                                        : typeof stage.startedAt === 'number' && typeof stage.endedAt === 'number'
                                          ? stage.endedAt - stage.startedAt
                                          : undefined;
                                    return (
                                      <TableRow key={stage.id}>
                                        <TableCell className="text-xs">{stage.label}</TableCell>
                                        <TableCell className="text-xs">{formatStageStatus(stage.status)}</TableCell>
                                        <TableCell className="text-xs text-right">
                                          {typeof stageElapsed === 'number' ? formatDuration(stageElapsed) : '-'}
                                        </TableCell>
                                        <TableCell className="text-xs text-right">
                                          {typeof stage.etaMs === 'number' ? formatDuration(stage.etaMs) : '-'}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                          {stage.error ? (
                                            <span className="text-destructive">{stage.error}</span>
                                          ) : (
                                            stage.message || '-'
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
