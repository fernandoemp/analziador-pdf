import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { AiResultsTable, type AiResultsTableProps } from '@/components/pdf-structured-extractor/AiResultsTable';
import {
  cleanupValidatorStates,
  isQuotaExceededError,
  loadValidatorState,
  normalizeValidatorState,
  saveValidatorState,
  type FileFingerprint,
  type PersistedValidatorStateV1,
} from '@/lib/ai-analysis-persistence/storage';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfUrl: string | null;
  fileFingerprint: FileFingerprint | null;
  aiTableProps: AiResultsTableProps;
  onSetCurrentPage: (page: number) => void;
  pdfScrollRef: React.RefObject<HTMLDivElement>;
  aiScrollRef: React.RefObject<HTMLDivElement>;
  onPdfScroll: (event: React.UIEvent<HTMLDivElement>) => void;
};

export const PdfValidatorDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  pdfUrl,
  fileFingerprint,
  aiTableProps,
  onSetCurrentPage,
  pdfScrollRef,
  aiScrollRef,
  onPdfScroll,
}) => {
  const fingerprint = useMemo(() => fileFingerprint, [fileFingerprint]);
  const [validatedPages, setValidatedPages] = useState<boolean[]>([]);
  const [saveFeedback, setSaveFeedback] = useState<{ kind: 'saved' | 'error'; at: number; message?: string } | null>(
    null
  );
  const feedbackTimeoutRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  const safeTotalPages = Math.max(0, Math.floor(aiTableProps.totalPages));
  const safeCurrentPage = Math.max(1, Math.min(safeTotalPages || 1, Math.floor(aiTableProps.safeCurrentPage)));

  const validatedCount = useMemo(() => validatedPages.reduce((acc, v) => acc + (v ? 1 : 0), 0), [validatedPages]);

  const applyFeedback = useCallback((next: { kind: 'saved' | 'error'; message?: string }) => {
    const now = Date.now();
    setSaveFeedback({ kind: next.kind, at: now, message: next.message });
    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = window.setTimeout(() => setSaveFeedback(null), 1600);
  }, []);

  const persistState = useCallback(
    (nextValidatedPages: boolean[], nextCurrentPage: number, options?: { showFeedback?: boolean }) => {
      if (!fingerprint) return;
      try {
        cleanupValidatorStates({ maxEntries: 25, maxAgeMs: 1000 * 60 * 60 * 24 * 30 });
        const state: PersistedValidatorStateV1 = normalizeValidatorState(
          {
            version: 1,
            updatedAt: Date.now(),
            file: fingerprint,
            totalPages: safeTotalPages,
            currentPage: nextCurrentPage,
            validatedPages: nextValidatedPages,
          },
          safeTotalPages
        );
        saveValidatorState(state);
        if (options?.showFeedback) applyFeedback({ kind: 'saved' });
      } catch (error: unknown) {
        const msg = isQuotaExceededError(error) ? 'No hay espacio en localStorage.' : 'No se pudo guardar en localStorage.';
        if (options?.showFeedback) applyFeedback({ kind: 'error', message: msg });
      }
    },
    [applyFeedback, fingerprint, safeTotalPages]
  );

  useEffect(() => {
    if (!open) return;
    if (!fingerprint) return;
    cleanupValidatorStates({ maxEntries: 25, maxAgeMs: 1000 * 60 * 60 * 24 * 30 });
    const stored = loadValidatorState(fingerprint);
    if (!stored) {
      setValidatedPages(Array.from({ length: safeTotalPages }, () => false));
      return;
    }
    const normalized = normalizeValidatorState(stored, safeTotalPages);
    setValidatedPages(normalized.validatedPages);
    if (normalized.currentPage !== safeCurrentPage) {
      onSetCurrentPage(normalized.currentPage);
    }
  }, [fingerprint, onSetCurrentPage, open, safeCurrentPage, safeTotalPages]);

  useEffect(() => {
    if (!open) return;
    if (!fingerprint) return;
    setValidatedPages(prev => {
      if (prev.length === safeTotalPages) return prev;
      const next = prev.slice(0, safeTotalPages);
      while (next.length < safeTotalPages) next.push(false);
      return next;
    });
  }, [open, fingerprint, safeTotalPages]);

  useEffect(() => {
    if (!open) return;
    if (!fingerprint) return;
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      persistState(validatedPages, safeCurrentPage);
    }, 250);
  }, [fingerprint, open, persistState, safeCurrentPage, validatedPages]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) window.clearTimeout(feedbackTimeoutRef.current);
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const currentPageChecked = validatedPages[safeCurrentPage - 1] ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[96vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Validador</DialogTitle>
        </DialogHeader>
        <div className="flex gap-4 h-[90vh] pt-2">
          <div
            ref={pdfScrollRef}
            className="flex-1 border rounded-md overflow-auto bg-muted/40"
            onScroll={onPdfScroll}
          >
            {pdfUrl ? (
              <iframe src={pdfUrl} className="w-full h-full" title="PDF" />
            ) : (
              <div className="p-4 text-sm text-muted-foreground">Selecciona un PDF para visualizarlo.</div>
            )}
          </div>
          <div className="flex-1 border rounded-md bg-muted/40 p-2 flex flex-col min-h-0">
            {aiTableProps.aiHeaders.length > 0 ? (
              <>
                <div className="bg-muted/30 border rounded-md p-3 mb-2 flex flex-col gap-2 flex-none">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="validator-page-toggle"
                        checked={currentPageChecked}
                        onCheckedChange={() => {
                          const next = validatedPages.slice();
                          next[safeCurrentPage - 1] = !currentPageChecked;
                          setValidatedPages(next);
                          persistState(next, safeCurrentPage, { showFeedback: true });
                        }}
                      />
                      <label
                        htmlFor="validator-page-toggle"
                        className="text-sm font-medium cursor-pointer select-none flex items-center gap-2"
                      >
                        {currentPageChecked ? (
                          <span className="text-green-600">Página {safeCurrentPage} validada</span>
                        ) : (
                          <span>Marcar página {safeCurrentPage} como validada</span>
                        )}
                      </label>
                    </div>
                    {saveFeedback?.kind === 'saved' && (
                      <div className="text-xs text-green-600 font-medium">Guardado</div>
                    )}
                    {saveFeedback?.kind === 'error' && (
                      <div className="text-xs text-destructive">{saveFeedback.message || 'Error al guardar'}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <Progress
                      value={safeTotalPages > 0 ? (validatedCount / safeTotalPages) * 100 : 0}
                      className="h-2 flex-1"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {validatedCount} de {safeTotalPages} completadas
                    </span>
                  </div>
                </div>
                <div ref={aiScrollRef} className="flex-1 overflow-auto min-h-0">
                  <AiResultsTable {...aiTableProps} />
                </div>
                {!aiTableProps.hasActiveFilters && safeTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2 flex-none">
                    <div className="text-xs text-muted-foreground">
                      Página {safeCurrentPage} de {safeTotalPages || 1}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => {
                        const nextPage = Math.max(1, safeCurrentPage - 1);
                        onSetCurrentPage(nextPage);
                        persistState(validatedPages, nextPage);
                      }}
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={safeCurrentPage >= (safeTotalPages || 1)}
                      onClick={() => {
                        const nextPage = Math.min(safeTotalPages || 1, safeCurrentPage + 1);
                        onSetCurrentPage(nextPage);
                        persistState(validatedPages, nextPage);
                      }}
                    >
                      Siguiente
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">Ejecuta un análisis con IA para ver resultados.</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
