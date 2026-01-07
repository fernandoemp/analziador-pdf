import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Filter, Search, FileText, XCircle, Calendar, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { localDb } from '@/lib/localDb';
import { FileRecord, Transaction, FileSourceType } from '@/types/finanzas';
import { formatMoney } from '@/lib/formatters';

const Analysis: React.FC = () => {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');

  useEffect(() => {
    // Cargar archivos y transacciones al montar el componente
    const loadedFiles = localDb.getFiles();
    const loadedTransactions = localDb.getTransactions();
    setFiles(loadedFiles);
    setAllTransactions(loadedTransactions);
  }, []);

  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    allTransactions.forEach(t => categories.add(t.category));
    return ['all', ...Array.from(categories).sort()];
  }, [allTransactions]);

  const uniqueSources = useMemo(() => {
    const sources = new Set<string>();
    allTransactions.forEach(t => sources.add(t.source));
    return ['all', ...Array.from(sources).sort()];
  }, [allTransactions]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allTransactions.forEach(t => {
      const year = new Date(t.date).getFullYear();
      years.add(year);
    });
    return ['all', ...Array.from(years).sort((a, b) => b - a).map(String)];
  }, [allTransactions]);

  const availableMonths = [
    { value: 'all', label: 'Todos los meses' },
    { value: '1', label: 'Enero' },
    { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' },
    { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
  ];

  const displayedTransactions = useMemo(() => {
    let filtered = allTransactions;

    // 1. Filtrar por archivo seleccionado
    if (selectedFileId !== 'all') {
      filtered = filtered.filter(t => t.file_id === selectedFileId);
    }

    // 2. Filtrar por término de búsqueda (descripción)
    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 3. Filtrar por categoría
    if (selectedCategoryFilter !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategoryFilter);
    }

    // 4. Filtrar por fuente
    if (selectedSourceFilter !== 'all') {
      filtered = filtered.filter(t => t.source === selectedSourceFilter);
    }

    // 5. Filtrar por año
    if (selectedYear !== 'all') {
      filtered = filtered.filter(t => {
        const year = new Date(t.date).getFullYear();
        return year === parseInt(selectedYear);
      });
    }

    // 6. Filtrar por mes
    if (selectedMonth !== 'all') {
      filtered = filtered.filter(t => {
        const month = new Date(t.date).getMonth() + 1;
        return month === parseInt(selectedMonth);
      });
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allTransactions, selectedFileId, searchTerm, selectedCategoryFilter, selectedSourceFilter, selectedYear, selectedMonth]);

  // Calcular métricas de las transacciones filtradas
  const metrics = useMemo(() => {
    const total = displayedTransactions.reduce((sum, t) => sum + t.amount, 0);
    const income = displayedTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const expenses = displayedTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const count = displayedTransactions.length;

    return { total, income, expenses, count };
  }, [displayedTransactions]);

  const handleClearFilters = () => {
    setSelectedFileId('all');
    setSearchTerm('');
    setSelectedCategoryFilter('all');
    setSelectedSourceFilter('all');
    setSelectedMonth('all');
    setSelectedYear('all');
  };

  return (
    <div className="container mx-auto p-4 min-h-[calc(100vh-64px)] flex flex-col">
      <h1 className="text-4xl font-bold text-center mb-4 text-primary">Análisis Detallado de Transacciones</h1>
      <p className="text-center text-lg text-muted-foreground mb-6">
        Explora y filtra tus transacciones para obtener información valiosa.
      </p>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" /> Balance Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatMoney(metrics.total)}
            </div>
            <p className="text-xs text-muted-foreground">{metrics.count} transacciones</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <TrendingUp className="h-4 w-4 mr-2 text-green-600" /> Ingresos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              +{formatMoney(metrics.income)}
            </div>
            <p className="text-xs text-muted-foreground">Filtro aplicado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <TrendingDown className="h-4 w-4 mr-2 text-red-600" /> Gastos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              -{formatMoney(metrics.expenses)}
            </div>
            <p className="text-xs text-muted-foreground">Filtro aplicado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <FileText className="h-4 w-4 mr-2 text-muted-foreground" /> Transacciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.count}
            </div>
            <p className="text-xs text-muted-foreground">
              de {allTransactions.length} totales
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <FileText className="h-4 w-4 mr-2 text-muted-foreground" /> Seleccionar Archivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select onValueChange={setSelectedFileId} value={selectedFileId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todos los archivos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las transacciones</SelectItem>
                {files.map(file => (
                  <SelectItem key={file.id} value={file.id}>
                    {file.name} ({file.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Search className="h-4 w-4 mr-2 text-muted-foreground" /> Búsqueda Rápida
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Buscar por descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" /> Filtrar por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select onValueChange={setSelectedCategoryFilter} value={selectedCategoryFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                {uniqueCategories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category === 'all' ? 'Todas las categorías' : category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" /> Filtrar por Fuente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select onValueChange={setSelectedSourceFilter} value={selectedSourceFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todas las fuentes" />
              </SelectTrigger>
              <SelectContent>
                {uniqueSources.map(source => (
                  <SelectItem key={source} value={source}>
                    {source === 'all' ? 'Todas las fuentes' : source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" /> Filtrar por Año
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select onValueChange={setSelectedYear} value={selectedYear}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todos los años" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year}>
                    {year === 'all' ? 'Todos los años' : year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" /> Filtrar por Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select onValueChange={setSelectedMonth} value={selectedMonth}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todos los meses" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map(month => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {(selectedFileId !== 'all' || searchTerm || selectedCategoryFilter !== 'all' || selectedSourceFilter !== 'all' || selectedYear !== 'all' || selectedMonth !== 'all') && (
        <div className="mb-6 text-right">
          <Button variant="outline" onClick={handleClearFilters} className="text-sm">
            <XCircle className="h-4 w-4 mr-2" /> Limpiar Filtros
          </Button>
        </div>
      )}

      <Card className="w-full max-w-full mx-auto flex-grow">
        <CardHeader>
          <CardTitle>Tabla de Transacciones</CardTitle>
          <CardDescription>Aquí se muestran tus transacciones filtradas.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-auto">
          {displayedTransactions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No hay transacciones para mostrar con los filtros actuales.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedTransactions.map(transaction => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">{transaction.date}</TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell>{transaction.category}</TableCell>
                    <TableCell>{transaction.source}</TableCell>
                    <TableCell className={`text-right font-semibold ${transaction.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatMoney(Math.abs(transaction.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <div className="mt-auto">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Analysis;