import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfUrl: string | null;
  aiHeaders: string[];
  aiRows: string[][];
  pdfScrollRef: React.RefObject<HTMLDivElement>;
  aiScrollRef: React.RefObject<HTMLDivElement>;
  onPdfScroll: (event: React.UIEvent<HTMLDivElement>) => void;
};

export const ComparePdfAiDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  pdfUrl,
  aiHeaders,
  aiRows,
  pdfScrollRef,
  aiScrollRef,
  onPdfScroll,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Comparar PDF y resultado IA</DialogTitle>
        </DialogHeader>
        <div className="flex gap-4 h-[60vh] pt-2">
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
          <div ref={aiScrollRef} className="flex-1 border rounded-md overflow-auto bg-muted/40">
            {aiHeaders.length > 0 ? (
              <div className="p-2 min-w-full pb-8">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {aiHeaders.map((h, i) => (
                        <TableHead key={`aih-modal-${i}`}>{h || '-'}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aiRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={aiHeaders.length} className="text-center text-muted-foreground">
                          Sin filas
                        </TableCell>
                      </TableRow>
                    ) : (
                      aiRows.map((r, i) => (
                        <TableRow key={`air-modal-${i}`}>
                          {r.map((c, j) => (
                            <TableCell key={`aic-modal-${i}-${j}`}>{c || '-'}</TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">Ejecuta un análisis con IA para ver resultados.</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
