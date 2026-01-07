import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FileText, FileSpreadsheet, FileType, Trash2, Eye, Building2, AlertTriangle } from 'lucide-react';
import { localDb } from '@/lib/localDb';
import { FileRecord, Transaction } from '@/types/finanzas';
import { formatMoney } from '@/lib/formatters';
import { showSuccess, showError } from '@/utils/toast';

const Files: React.FC = () => {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const loadedFiles = localDb.getFiles();
    const loadedTransactions = localDb.getTransactions();
    setFiles(loadedFiles);
    setTransactions(loadedTransactions);
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return <FileType className="h-5 w-5 text-red-500" />;
      case 'xlsx':
      case 'xls':
        return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
      case 'csv':
        return <FileText className="h-5 w-5 text-blue-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Completado</Badge>;
      case 'processing':
        return <Badge variant="secondary">Procesando</Badge>;
      case 'failed':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getFileTransactions = (fileId: string) => {
    return transactions.filter(t => t.file_id === fileId);
  };

  const getFilePeriod = (fileId: string) => {
    const fileTransactions = getFileTransactions(fileId);
    if (fileTransactions.length === 0) return '-';

    const dates = fileTransactions.map(t => new Date(t.date));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    const formatMonth = (date: Date) => {
      return date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
    };

    if (minDate.getMonth() === maxDate.getMonth() && minDate.getFullYear() === maxDate.getFullYear()) {
      return formatMonth(minDate);
    }

    return `${formatMonth(minDate)} - ${formatMonth(maxDate)}`;
  };

  const getFileSize = (fileName: string) => {
    // Simulado - en producción esto vendría del archivo real
    return `${Math.floor(Math.random() * 500 + 50)} KB`;
  };

  const handleDeleteFile = (fileId: string, fileName: string) => {
    setFileToDelete({ id: fileId, name: fileName });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!fileToDelete) return;

    try {
      localDb.deleteFileAndTransactions(fileToDelete.id);
      showSuccess(`Archivo "${fileToDelete.name}" eliminado correctamente`);
      loadData(); // Recargar datos
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    } catch (error) {
      showError('Error al eliminar el archivo');
      console.error('Error deleting file:', error);
    }
  };

  const handleViewFile = (fileId: string) => {
    // Redirigir a análisis con filtro del archivo
    window.location.href = `/analysis?file=${fileId}`;
  };

  return (
    <div className="container mx-auto p-4 min-h-[calc(100vh-64px)]">
      <h1 className="text-4xl font-bold text-center mb-4 text-primary">Listado de Archivos</h1>
      <p className="text-center text-lg text-muted-foreground mb-8">
        Gestiona todos tus archivos cargados y sus transacciones
      </p>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Archivos Cargados</CardTitle>
          <CardDescription>
            {files.length} archivo{files.length !== 1 ? 's' : ''} con {transactions.length} transacciones totales
          </CardDescription>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No hay archivos cargados</p>
              <p className="text-sm">Sube tu primer archivo en la sección de Carga de Datos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Tipo</TableHead>
                    <TableHead>Nombre del Archivo</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Building2 className="h-4 w-4" />
                        Banco
                      </div>
                    </TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-center">Transacciones</TableHead>
                    <TableHead>Tamaño</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => {
                    const fileTransactions = getFileTransactions(file.id);
                    return (
                      <TableRow key={file.id}>
                        <TableCell>{getFileIcon(file.name)}</TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{file.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(file.upload_date).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {file.bank_id ? localDb.getBankById(file.bank_id)?.name || 'Desconocido' : 'No especificado'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{getFilePeriod(file.id)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{fileTransactions.length}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {getFileSize(file.name)}
                        </TableCell>
                        <TableCell>{getStatusBadge(file.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewFile(file.id)}
                              title="Ver transacciones"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteFile(file.id, file.name)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Eliminar archivo"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              ¿Eliminar archivo?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Estás a punto de eliminar <strong>"{fileToDelete?.name}"</strong>
              </p>
              {fileToDelete && (
                <div className="bg-muted p-3 rounded-md text-sm">
                  <p className="font-semibold mb-1">Esto eliminará:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>El archivo del sistema</li>
                    <li>{getFileTransactions(fileToDelete.id).length} transacciones asociadas</li>
                  </ul>
                </div>
              )}
              <p className="text-red-600 font-semibold">
                ⚠️ Esta acción no se puede deshacer
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Files;
