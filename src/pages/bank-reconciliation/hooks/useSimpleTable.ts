import { useEffect, useMemo, useState } from 'react';
import { type AiResultsTableEditingCell } from '@/components/pdf-structured-extractor/AiResultsTable';
import { findColumnByKeywords } from '../utils/headerUtils';
import { normalizeText } from '../utils/textUtils';

export const useSimpleTable = ({
  headers,
  rows,
  setRows,
  pageSize = 25,
  showFilters = true,
}: {
  headers: string[];
  rows: string[][];
  setRows: React.Dispatch<React.SetStateAction<string[][]>>;
  pageSize?: number;
  showFilters?: boolean;
}) => {
  const [descriptionFilter, setDescriptionFilter] = useState('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingCell, setEditingCell] = useState<AiResultsTableEditingCell | null>(null);

  const dateColIndex = useMemo(() => {
    const idx = findColumnByKeywords(headers, ['fecha', 'date']);
    return idx >= 0 ? idx : null;
  }, [headers]);

  const descriptionColIndex = useMemo(() => {
    const idx = findColumnByKeywords(headers, ['descripcion', 'concepto', 'detalle', 'desc']);
    return idx >= 0 ? idx : null;
  }, [headers]);

  const normalizedQuery = normalizeText(descriptionFilter);

  const filteredRowIndices = useMemo(() => {
    const indices = rows.map((_, idx) => idx);
    return indices.filter((idx) => {
      const row = rows[idx];
      if (!row) return false;
      if (showFilters && normalizedQuery && descriptionColIndex !== null) {
        const candidate = normalizeText(String(row[descriptionColIndex] ?? ''));
        if (!candidate.includes(normalizedQuery)) return false;
      }
      if (showFilters && selectedDates.length > 0 && dateColIndex !== null) {
        const value = String(row[dateColIndex] ?? '').trim();
        if (!selectedDates.includes(value)) return false;
      }
      return true;
    });
  }, [dateColIndex, descriptionColIndex, normalizedQuery, rows, selectedDates, showFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredRowIndices.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

  const visibleRowIndices = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredRowIndices.slice(start, start + pageSize);
  }, [filteredRowIndices, pageSize, safeCurrentPage]);

  const dateOptions = useMemo(() => {
    if (dateColIndex === null) return [];
    const counts = new Map<string, number>();
    rows.forEach(row => {
      const value = String(row[dateColIndex] ?? '').trim();
      if (!value) return;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([value, total]) => ({ value, total, matches: total }));
  }, [dateColIndex, rows]);

  const selectedDatesSet = useMemo(() => new Set(selectedDates), [selectedDates]);

  const missingSelectedDatesCount = useMemo(() => {
    const available = new Set(dateOptions.map(opt => opt.value));
    return selectedDates.filter(value => !available.has(value)).length;
  }, [dateOptions, selectedDates]);

  const hasActiveFilters = showFilters && (descriptionFilter.trim().length > 0 || selectedDates.length > 0);

  const toggleDateSelection = (value: string) => {
    setSelectedDates(prev => (prev.includes(value) ? prev.filter(d => d !== value) : [...prev, value]));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSelectedDates([]);
    setDescriptionFilter('');
  };

  const startEditCell = (rowIndex: number, colIndex: number) => {
    const current = rows[rowIndex]?.[colIndex] ?? '';
    setEditingCell({ rowIndex, colIndex, value: current });
  };

  const saveEditCell = () => {
    if (!editingCell) return;
    setRows(prev => {
      const next = prev.map(r => [...r]);
      if (!next[editingCell.rowIndex]) return next;
      next[editingCell.rowIndex][editingCell.colIndex] = editingCell.value;
      return next;
    });
    setEditingCell(null);
  };

  const addRowAfter = (rowIndex: number) => {
    if (headers.length === 0) return;
    const emptyRow = Array(headers.length).fill('');
    setRows(prev => {
      const next = [...prev];
      next.splice(rowIndex + 1, 0, emptyRow);
      return next;
    });
  };

  const deleteRow = (rowIndex: number) => {
    setRows(prev => prev.filter((_, idx) => idx !== rowIndex));
  };

  return {
    aiHeaders: headers,
    aiRows: rows,
    hasActiveFilters,
    isFilterPending: false,
    visibleRowIndices,
    descriptionFilter,
    descriptionColIndex,
    onChangeDescriptionFilter: setDescriptionFilter,
    onClearFilters: clearFilters,
    dateColIndex,
    dateOptions,
    selectedDatesSet,
    normalizedQuery,
    onToggleDateSelection: toggleDateSelection,
    missingSelectedDatesCount,
    invalidRows: [],
    safeCurrentPage,
    totalPages,
    onPrevPage: () => setCurrentPage(safeCurrentPage - 1),
    onNextPage: () => setCurrentPage(safeCurrentPage + 1),
    dateFilterPresentation: 'popover' as const,
    onDownloadCsv: () => {
      if (headers.length === 0 || rows.length === 0) return;
      const lines = [headers.map(h => `"${(h || '').replace(/"/g, '""')}"`).join(',')];
      for (const row of rows) {
        lines.push(row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','));
      }
      const csv = lines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tabla.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    onRequestDeleteColumn: (index: number) => {
      if (!window.confirm('¿Eliminar esta columna?')) return;
      setRows(prev => prev.map(row => row.filter((_, idx) => idx !== index)));
    },
    onAddRowAfter: addRowAfter,
    onDeleteRow: deleteRow,
    editingCell,
    onChangeEditingValue: (value: string) => setEditingCell(prev => (prev ? { ...prev, value } : prev)),
    onSaveEditCell: saveEditCell,
    onCancelEditCell: () => setEditingCell(null),
    onStartEditCell: startEditCell,
    setCurrentPage,
  };
};
