import React from 'react';
import { Table, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';

type Props = {
  headerCandidate: string[];
  headerDraft: string[] | null;
  isAnalyzing: boolean;
  selectedFile: File | null;
  onUpdateHeaderField: (index: number, value: string) => void;
  onDeleteHeaderField: (index: number) => void;
  onAddHeaderField: () => void;
  onConfirm: () => Promise<void>;
};

export const AiHeaderCandidateEditor: React.FC<Props> = ({
  headerCandidate,
  headerDraft,
  isAnalyzing,
  selectedFile,
  onUpdateHeaderField,
  onDeleteHeaderField,
  onAddHeaderField,
  onConfirm,
}) => {
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">Encabezado detectado por IA. Revísalo y confirma para continuar.</div>
      <div className="border rounded-md overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {(headerDraft || headerCandidate || []).map((h, i) => (
                <TableHead key={`header-candidate-${i}`} className="align-middle">
                  {headerDraft ? (
                    <div className="flex items-center gap-2">
                      <Input
                        className="h-8 text-xs"
                        value={headerDraft[i] ?? ''}
                        onChange={e => onUpdateHeaderField(i, e.target.value)}
                      />
                      {headerDraft.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeleteHeaderField(i)}
                          className="text-muted-foreground hover:text-destructive transition"
                          title="Eliminar campo"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ) : (
                    h || '-'
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" type="button" onClick={onAddHeaderField}>
          <Plus className="h-3 w-3 mr-1" />
          Agregar campo
        </Button>
        <Button size="sm" variant="secondary" onClick={onConfirm} disabled={isAnalyzing || !selectedFile}>
          Confirmar encabezado y analizar movimientos
        </Button>
      </div>
    </div>
  );
};

