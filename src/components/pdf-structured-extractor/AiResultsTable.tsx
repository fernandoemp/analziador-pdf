import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Pencil, Plus, Trash2, X } from 'lucide-react';

type DateOption = { value: string; total: number; matches: number };

export type AiResultsTableEditingCell = { rowIndex: number; colIndex: number; value: string } | null;

type DateFilterPresentation = 'inline' | 'popover';

type Props = {
  aiHeaders: string[];
  aiRows: string[][];
  hasActiveFilters: boolean;
  isFilterPending: boolean;
  visibleRowIndices: number[];
  descriptionFilter: string;
  descriptionColIndex: number | null;
  onChangeDescriptionFilter: (value: string) => void;
  onClearFilters: () => void;
  dateColIndex: number | null;
  dateOptions: DateOption[];
  selectedDatesSet: Set<string>;
  normalizedQuery: string;
  onToggleDateSelection: (value: string) => void;
  missingSelectedDatesCount: number;
  invalidRows: number[];
  safeCurrentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onDownloadCsv: () => void;
  onRequestDeleteColumn: (colIndex: number) => void;
  onAddRowAfter: (rowIndex: number) => void;
  onDeleteRow: (rowIndex: number) => void;
  editingCell: AiResultsTableEditingCell;
  onChangeEditingValue: (value: string) => void;
  onSaveEditCell: () => void;
  onCancelEditCell: () => void;
  onStartEditCell: (rowIndex: number, colIndex: number) => void;
  showCsvExport?: boolean;
  showDescriptionFilter?: boolean;
  dateFilterPresentation?: DateFilterPresentation;
  showPagination?: boolean;
};

export type AiResultsTableProps = Props;

export const AiResultsTable: React.FC<Props> = ({
  aiHeaders,
  aiRows,
  hasActiveFilters,
  isFilterPending,
  visibleRowIndices,
  descriptionFilter,
  descriptionColIndex,
  onChangeDescriptionFilter,
  onClearFilters,
  dateColIndex,
  dateOptions,
  selectedDatesSet,
  normalizedQuery,
  onToggleDateSelection,
  missingSelectedDatesCount,
  invalidRows,
  safeCurrentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  onDownloadCsv,
  onRequestDeleteColumn,
  onAddRowAfter,
  onDeleteRow,
  editingCell,
  onChangeEditingValue,
  onSaveEditCell,
  onCancelEditCell,
  onStartEditCell,
  showCsvExport = true,
  showDescriptionFilter = true,
  dateFilterPresentation = 'inline',
  showPagination = true,
}) => {
  if (aiHeaders.length === 0) return null;
  const selectedDatesCount = selectedDatesSet.size;
  return (
    <div className="border rounded-md">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 p-3 border-b space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-sm text-muted-foreground truncate">Tabla detectada por IA</div>
            {hasActiveFilters && (
              <Badge variant="secondary" className="text-xs shrink-0">
                Filtros activos
              </Badge>
            )}
            {isFilterPending && (
              <Badge variant="outline" className="text-xs shrink-0">
                Filtrando...
              </Badge>
            )}
            {!showDescriptionFilter && (
              <div className="text-xs text-muted-foreground shrink-0">
                Mostrando {visibleRowIndices.length} de {aiRows.length}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {dateFilterPresentation === 'popover' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" type="button">
                    Filtro por fecha
                    {selectedDatesCount > 0 && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        {selectedDatesCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="end" className="w-[360px] p-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">Fechas</div>
                      {dateColIndex === null && <span className="text-xs text-muted-foreground">Sin columna fecha</span>}
                    </div>
                    <div className="border rounded-md p-2 max-h-56 overflow-auto">
                      {dateColIndex === null ? (
                        <div className="text-xs text-muted-foreground">No se pudo detectar la columna de fecha.</div>
                      ) : dateOptions.length === 0 ? (
                        <div className="text-xs text-muted-foreground">Aún no hay fechas detectadas.</div>
                      ) : (
                        <div className="space-y-1">
                          {dateOptions.map((opt, idx) => {
                            const id = `ai-date-${idx}`;
                            const checked = selectedDatesSet.has(opt.value);
                            const countLabel = normalizedQuery.length > 0 ? `${opt.matches}/${opt.total}` : String(opt.total);
                            return (
                              <div key={opt.value} className="flex items-center gap-2">
                                <Checkbox id={id} checked={checked} onCheckedChange={() => onToggleDateSelection(opt.value)} />
                                <label htmlFor={id} className="text-xs select-none cursor-pointer flex-1 truncate">
                                  {opt.value}
                                </label>
                                <Badge variant="outline" className="text-[10px]">
                                  {countLabel}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {missingSelectedDatesCount > 0 && (
                      <div className="text-[10px] text-amber-600">
                        {missingSelectedDatesCount} fecha(s) seleccionada(s) no están en los datos actuales.
                      </div>
                    )}
                    <div className="flex items-center justify-end">
                      <Button type="button" variant="outline" size="sm" onClick={onClearFilters} disabled={!hasActiveFilters}>
                        Limpiar filtros
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {showCsvExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDownloadCsv}
                disabled={aiHeaders.length === 0 || aiRows.length === 0}
              >
                Exportar CSV IA
              </Button>
            )}
          </div>
        </div>

        {selectedDatesCount > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs text-muted-foreground shrink-0">Fechas seleccionadas:</div>
            <div className="flex flex-wrap gap-2">
              {Array.from(selectedDatesSet).map(value => (
                <Badge key={value} variant="secondary" className="gap-1 pr-1">
                  <span className="truncate max-w-[200px]">{value}</span>
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-background/40"
                    aria-label={`Quitar fecha ${value}`}
                    onClick={() => onToggleDateSelection(value)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {(showDescriptionFilter || dateFilterPresentation === 'inline') && (
          <div className="grid gap-3 md:grid-cols-3">
            {showDescriptionFilter && (
              <div className="md:col-span-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="ai-desc-filter">Filtro por descripción</Label>
                  <div className="text-xs text-muted-foreground">
                    Mostrando {visibleRowIndices.length} de {aiRows.length}
                  </div>
                </div>
                <Input
                  id="ai-desc-filter"
                  value={descriptionFilter}
                  onChange={e => onChangeDescriptionFilter(e.target.value)}
                  placeholder="Buscar (coincidencias parciales)…"
                  aria-label="Buscar por descripción"
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    {descriptionColIndex === null ? 'No se detectó columna de descripción; se busca en toda la fila.' : ''}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={onClearFilters} disabled={!hasActiveFilters}>
                    Limpiar filtros
                  </Button>
                </div>
              </div>
            )}
            {dateFilterPresentation === 'inline' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Filtro por fecha</Label>
                  {dateColIndex === null && <span className="text-xs text-muted-foreground">Sin columna fecha</span>}
                </div>
                <div className="border rounded-md p-2 max-h-44 overflow-auto">
                  {dateColIndex === null ? (
                    <div className="text-xs text-muted-foreground">No se pudo detectar la columna de fecha.</div>
                  ) : dateOptions.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Aún no hay fechas detectadas.</div>
                  ) : (
                    <div className="space-y-1">
                      {dateOptions.map((opt, idx) => {
                        const id = `ai-date-${idx}`;
                        const checked = selectedDatesSet.has(opt.value);
                        const countLabel = normalizedQuery.length > 0 ? `${opt.matches}/${opt.total}` : String(opt.total);
                        return (
                          <div key={opt.value} className="flex items-center gap-2">
                            <Checkbox id={id} checked={checked} onCheckedChange={() => onToggleDateSelection(opt.value)} />
                            <label htmlFor={id} className="text-xs select-none cursor-pointer flex-1 truncate">
                              {opt.value}
                            </label>
                            <Badge variant="outline" className="text-[10px]">
                              {countLabel}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {missingSelectedDatesCount > 0 && (
                  <div className="text-[10px] text-amber-600">
                    {missingSelectedDatesCount} fecha(s) seleccionada(s) no están en los datos actuales.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {invalidRows.length > 0 && (
          <div className="text-xs text-red-600">Hay {invalidRows.length} filas con montos inválidos (crédito/débito vacíos o ambos con valor).</div>
        )}
      </div>

      <div className="overflow-auto max-h-[70vh] p-3">
        <table className="w-full caption-bottom text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              {aiHeaders.map((h, i) => (
                <TableHead key={`aih-${i}`} className="relative">
                  <span>{h || '-'}</span>
                  <button
                    type="button"
                    onClick={() => onRequestDeleteColumn(i)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive transition"
                    title="Eliminar columna"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {aiRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={aiHeaders.length + 1} className="text-center text-muted-foreground">
                  Sin filas
                </TableCell>
              </TableRow>
            ) : hasActiveFilters && visibleRowIndices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={aiHeaders.length + 1} className="text-center text-muted-foreground">
                  Sin coincidencias
                </TableCell>
              </TableRow>
            ) : (
              visibleRowIndices.map(rowIndex => {
                const r = aiRows[rowIndex] || [];
                const isInvalid = invalidRows.includes(rowIndex);
                return (
                  <TableRow key={`air-${rowIndex}`} className="group">
                    <TableCell className="p-1 align-middle">
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onAddRowAfter(rowIndex)}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition"
                          title="Agregar fila debajo"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRow(rowIndex)}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed text-destructive opacity-0 group-hover:opacity-100 hover:bg-muted transition"
                          title="Eliminar fila"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </TableCell>
                    {r.map((c, j) => {
                      const isEditing = editingCell && editingCell.rowIndex === rowIndex && editingCell.colIndex === j;
                      return (
                        <TableCell key={`aic-${rowIndex}-${j}`} className={`relative group/cell ${isInvalid ? 'bg-red-50' : ''}`}>
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <Input
                                autoFocus
                                value={editingCell.value}
                                onChange={e => onChangeEditingValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    onSaveEditCell();
                                  }
                                  if (e.key === 'Escape') {
                                    e.preventDefault();
                                    onCancelEditCell();
                                  }
                                }}
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-green-600"
                                type="button"
                                onClick={onSaveEditCell}
                              >
                                ✓
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                type="button"
                                onClick={onCancelEditCell}
                              >
                                ✕
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span>{c || '-'}</span>
                              <button
                                type="button"
                                onClick={() => onStartEditCell(rowIndex, j)}
                                className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/cell:opacity-100 text-muted-foreground hover:text-foreground transition"
                                title="Editar celda"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              {isInvalid && (
                                <AlertTriangle className="absolute left-1 top-1/2 -translate-y-1/2 h-3 w-3 text-amber-500" />
                              )}
                            </>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </table>
      </div>

      {showPagination && !hasActiveFilters && aiRows.length > 0 && totalPages > 1 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-2 text-xs text-muted-foreground p-3 border-t">
          <span>
            Página {safeCurrentPage} de {totalPages}
          </span>
          <Button variant="outline" size="xs" disabled={safeCurrentPage <= 1} onClick={onPrevPage}>
            Anterior
          </Button>
          <Button variant="outline" size="xs" disabled={safeCurrentPage >= totalPages} onClick={onNextPage}>
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
};
