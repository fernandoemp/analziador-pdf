import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileFormatConfig, FileFormatType, BankColumnMapping } from '@/types/finanzas';
import { Plus, Trash2, FileText, FileSpreadsheet, FileType, Upload, Sparkles, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import ColumnMappingConfig from './ColumnMappingConfig';
import { analyzeFile } from '@/lib/fileAnalyzer';
import { convertPDFToExcel, downloadExcelFile } from '@/lib/pdfToExcel';
import { convertPDFToExcelWithAI } from '@/lib/pdfToExcelAI';
import { settingsDb } from '@/lib/localDb';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';

interface FileFormatsConfigProps {
  formats: FileFormatConfig[];
  onChange: (formats: FileFormatConfig[]) => void;
}

type FileAnalysisColumn = {
  columnName: string;
  suggestedType: string | null;
  confidence: number;
  sampleValues: string[];
};

type FileAnalysisResult = {
  headers: string[];
  columnAnalysis: FileAnalysisColumn[];
  suggestedMapping: BankColumnMapping;
  rowCount: number;
  preview: Record<string, unknown>[];
};

const FileFormatsConfig: React.FC<FileFormatsConfigProps> = ({ formats, onChange }) => {
  const [expandedFormat, setExpandedFormat] = useState<string>('');
  const [analyzingIndex, setAnalyzingIndex] = useState<number | null>(null);
  const [analysisResult, setAnalysisResult] = useState<FileAnalysisResult | null>(null);
  const [convertToExcel, setConvertToExcel] = useState<boolean>(false);
  const [convertedExcelFile, setConvertedExcelFile] = useState<File | null>(null);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const analysisAbortRef = useRef<AbortController | null>(null);
  const analysisToastIdRef = useRef<string | number | null>(null);

  const cancelAnalysis = () => {
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    if (analysisToastIdRef.current) {
      dismissToast(analysisToastIdRef.current as string);
      analysisToastIdRef.current = null;
    }
    setAnalyzingIndex(null);
    showError('Análisis cancelado');
  };

  const getFormatIcon = (format: FileFormatType) => {
    switch (format) {
      case 'csv':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'xlsx':
        return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
      case 'pdf':
        return <FileType className="h-4 w-4 text-red-500" />;
    }
  };

  const getFormatLabel = (format: FileFormatType) => {
    switch (format) {
      case 'csv':
        return 'CSV';
      case 'xlsx':
        return 'Excel';
      case 'pdf':
        return 'PDF';
    }
  };

  const handleAddFormat = () => {
    const newFormat: FileFormatConfig = {
      format: 'csv',
      name: 'Nuevo Formato',
      columnMapping: {},
    };
    onChange([...formats, newFormat]);
  };

  const handleRemoveFormat = (index: number) => {
    const newFormats = formats.filter((_, i) => i !== index);
    onChange(newFormats);
  };

  const handleUpdateFormat = (index: number, updates: Partial<FileFormatConfig>) => {
    const newFormats = formats.map((format, i) =>
      i === index ? { ...format, ...updates } : format
    );
    onChange(newFormats);
  };

  const handleUpdateColumnMapping = (index: number, mapping: BankColumnMapping) => {
    handleUpdateFormat(index, { columnMapping: mapping });
  };

  const handleFileUpload = async (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isPDF = file.name.toLowerCase().endsWith('.pdf');
    setAnalyzingIndex(index);
    analysisAbortRef.current?.abort();
    const abortController = new AbortController();
    analysisAbortRef.current = abortController;
    
    let fileToAnalyze = file;
    let toastId: string | number;

    try {
      if (abortController.signal.aborted) {
        setAnalyzingIndex(null);
        return;
      }
      // Si es PDF y se debe convertir a Excel
      if (isPDF && convertToExcel) {
        // Verificar si hay API Key de Gemini configurada
        const geminiApiKey = settingsDb.getGeminiApiKey();
        
        if (geminiApiKey) {
          // Usar conversión con IA
          toastId = showLoading('Convirtiendo PDF a Excel con IA...');
          analysisToastIdRef.current = toastId;
          
          const conversionResult = await convertPDFToExcelWithAI(file, geminiApiKey);
          if (abortController.signal.aborted) {
            dismissToast(toastId as string);
            analysisToastIdRef.current = null;
            setAnalyzingIndex(null);
            return;
          }
          
          if (!conversionResult.success || !conversionResult.excelFile) {
            dismissToast(toastId as string);
            analysisToastIdRef.current = null;
            showError(`Error al convertir con IA: ${conversionResult.error}`);
            setAnalyzingIndex(null);
            return;
          }

          dismissToast(toastId as string);
          analysisToastIdRef.current = null;
          showSuccess(`✨ PDF convertido con IA: ${conversionResult.rowCount} filas, ${conversionResult.columnCount} columnas`);
          
          fileToAnalyze = conversionResult.excelFile;
          setConvertedExcelFile(conversionResult.excelFile);
        } else {
          // Usar conversión tradicional
          toastId = showLoading('Convirtiendo PDF a Excel...');
          analysisToastIdRef.current = toastId;
          
          const conversionResult = await convertPDFToExcel(file);
          if (abortController.signal.aborted) {
            dismissToast(toastId as string);
            analysisToastIdRef.current = null;
            setAnalyzingIndex(null);
            return;
          }
          
          if (!conversionResult.success || !conversionResult.excelFile) {
            dismissToast(toastId as string);
            analysisToastIdRef.current = null;
            showError(`Error al convertir: ${conversionResult.error}`);
            setAnalyzingIndex(null);
            return;
          }

          dismissToast(toastId as string);
          analysisToastIdRef.current = null;
          showSuccess(`PDF convertido: ${conversionResult.rowCount} filas, ${conversionResult.columnCount} columnas`);
          
          fileToAnalyze = conversionResult.excelFile;
          setConvertedExcelFile(conversionResult.excelFile);
        }
      }

      if (abortController.signal.aborted) {
        setAnalyzingIndex(null);
        return;
      }
      // Analizar el archivo (original o convertido)
      toastId = showLoading('Analizando archivo...');
      analysisToastIdRef.current = toastId;
      const result = await analyzeFile(fileToAnalyze);
      if (abortController.signal.aborted) {
        dismissToast(toastId as string);
        analysisToastIdRef.current = null;
        setAnalyzingIndex(null);
        return;
      }
      setAnalysisResult(result as FileAnalysisResult);
      setShowAnalysisDialog(true);
      dismissToast(toastId as string);
      analysisToastIdRef.current = null;
      showSuccess(`Archivo analizado: ${result.headers.length} columnas detectadas`);
    } catch (error: unknown) {
      if (analysisToastIdRef.current) {
        dismissToast(analysisToastIdRef.current as string);
        analysisToastIdRef.current = null;
      }
      const message = error instanceof Error ? error.message : 'Error desconocido';
      showError(`Error al analizar: ${message}`);
      setAnalyzingIndex(null);
    } finally {
      if (analysisAbortRef.current === abortController) {
        analysisAbortRef.current = null;
      }
      // Reset file input
      if (fileInputRefs.current[index]) {
        fileInputRefs.current[index]!.value = '';
      }
    }
  };

  const handleApplySuggestions = () => {
    if (analyzingIndex !== null && analysisResult) {
      handleUpdateColumnMapping(analyzingIndex, analysisResult.suggestedMapping);
      handleCloseDialog();
      showSuccess('Configuración aplicada correctamente');
    }
  };

  const handleDownloadExcel = () => {
    if (convertedExcelFile) {
      downloadExcelFile(convertedExcelFile);
      showSuccess('Archivo Excel descargado');
    }
  };

  const handleCloseDialog = () => {
    setShowAnalysisDialog(false);
    setConvertedExcelFile(null);
    setAnalysisResult(null);
    setAnalyzingIndex(null);
  };

  const triggerFileUpload = (index: number) => {
    fileInputRefs.current[index]?.click();
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) {
      return <Badge className="bg-green-500">Alta ({confidence}%)</Badge>;
    } else if (confidence >= 70) {
      return <Badge className="bg-yellow-500">Media ({confidence}%)</Badge>;
    } else {
      return <Badge variant="outline">Baja ({confidence}%)</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg">Configuración por Tipo de Archivo</CardTitle>
            <CardDescription>
              Define configuraciones específicas para cada formato de archivo que usa este banco
            </CardDescription>
          </div>
          <Button onClick={handleAddFormat} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Agregar Formato
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {formats.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="mb-2">No hay formatos configurados</p>
            <p className="text-sm mb-4">
              Agrega configuraciones para CSV, Excel o PDF según los formatos que use este banco
            </p>
            <Button onClick={handleAddFormat} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Primer Formato
            </Button>
          </div>
        ) : (
          <Accordion type="single" collapsible value={expandedFormat} onValueChange={setExpandedFormat}>
            {formats.map((format, index) => (
              <AccordionItem key={index} value={`format-${index}`}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 flex-1">
                    {getFormatIcon(format.format)}
                    <div className="flex-1 text-left">
                      <div className="font-medium">{format.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Tipo: {getFormatLabel(format.format)}
                      </div>
                    </div>
                    <Badge variant="outline">
                      {Object.keys(format.columnMapping).length} columnas
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`format-type-${index}`}>Tipo de Archivo</Label>
                        <Select
                          value={format.format}
                          onValueChange={(value: FileFormatType) =>
                            handleUpdateFormat(index, { format: value })
                          }
                        >
                          <SelectTrigger id={`format-type-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="csv">CSV</SelectItem>
                            <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                            <SelectItem value="pdf">PDF</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`format-name-${index}`}>Nombre Descriptivo</Label>
                        <Input
                          id={`format-name-${index}`}
                          placeholder="Ej: Extracto Mensual, Movimientos Diarios"
                          value={format.name}
                          onChange={(e) => handleUpdateFormat(index, { name: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-sm font-medium">Mapeo de Columnas</h4>
                        <div className="flex flex-col gap-2 items-end">
                          {format.format === 'pdf' && (
                            <>
                              <div className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  id={`convert-to-excel-${index}`}
                                  checked={convertToExcel}
                                  onCheckedChange={(checked) => setConvertToExcel(checked as boolean)}
                                />
                                <label
                                  htmlFor={`convert-to-excel-${index}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                Convertir a Excel antes de analizar
                              </label>
                            </div>
                            {convertToExcel && settingsDb.getGeminiApiKey() && (
                              <Badge variant="default" className="bg-purple-500 text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Usará IA
                              </Badge>
                            )}
                          </>
                          )}
                          <div className="flex gap-2">
                            <input
                              ref={(el) => (fileInputRefs.current[index] = el)}
                              type="file"
                              accept={format.format === 'csv' ? '.csv' : format.format === 'xlsx' ? '.xlsx,.xls' : '.pdf'}
                              onChange={(e) => handleFileUpload(index, e)}
                              className="hidden"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => triggerFileUpload(index)}
                              disabled={analyzingIndex === index}
                            >
                              <Sparkles className="h-4 w-4 mr-2" />
                              {analyzingIndex === index ? 'Analizando...' : 'Analizar Archivo'}
                            </Button>
                            {analyzingIndex === index && (
                              <Button variant="destructive" size="sm" onClick={cancelAnalysis}>
                                Detener
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      <ColumnMappingConfig
                        mapping={format.columnMapping}
                        onChange={(mapping) => handleUpdateColumnMapping(index, mapping)}
                      />
                    </div>

                    <div className="flex justify-end pt-4 border-t">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveFormat(index)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar Formato
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-800 mt-4">
          <p className="font-semibold mb-1">💡 ¿Por qué configurar múltiples formatos?</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Un banco puede tener diferentes formatos de extracto (mensual, diario, etc.)</li>
            <li>Los archivos CSV, Excel y PDF pueden tener columnas diferentes</li>
            <li>Cada formato puede tener su propia configuración de columnas</li>
            <li>El sistema detectará automáticamente qué configuración usar</li>
          </ul>
        </div>
      </CardContent>

      {/* Dialog de Análisis */}
      <Dialog open={showAnalysisDialog} onOpenChange={(open) => {
        if (!open) handleCloseDialog();
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              Análisis de Archivo Completado
            </DialogTitle>
            <DialogDescription>
              Se detectaron {analysisResult?.headers.length || 0} columnas en el archivo.
              Revisa las sugerencias y aplica la configuración automática.
              {convertedExcelFile && (
                <div className="mt-2 flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>PDF convertido a Excel exitosamente</span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {analysisResult && (
            <div className="space-y-6">
              {/* Resumen */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{analysisResult.headers.length}</div>
                    <div className="text-sm text-muted-foreground">Columnas detectadas</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{analysisResult.rowCount}</div>
                    <div className="text-sm text-muted-foreground">Filas de datos</div>
                  </CardContent>
                </Card>
              </div>

              {/* Tabla de análisis */}
              <div>
                <h4 className="text-sm font-medium mb-3">Columnas Detectadas y Sugerencias</h4>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Columna Original</TableHead>
                        <TableHead>Tipo Sugerido</TableHead>
                        <TableHead>Confianza</TableHead>
                        <TableHead>Valores de Muestra</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysisResult.columnAnalysis.map((col: FileAnalysisColumn, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{col.columnName}</TableCell>
                          <TableCell>
                            {col.suggestedType ? (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="capitalize">{col.suggestedType}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <AlertCircle className="h-4 w-4" />
                                <span>No detectado</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{getConfidenceBadge(col.confidence)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {col.sampleValues.slice(0, 2).join(', ')}
                            {col.sampleValues.length > 2 && '...'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Preview de datos */}
              <div>
                <h4 className="text-sm font-medium mb-3">Vista Previa de Datos</h4>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {analysisResult.headers.map((header: string, idx: number) => (
                          <TableHead key={idx}>{header}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysisResult.preview.map((row: Record<string, unknown>, idx: number) => (
                        <TableRow key={idx}>
                          {analysisResult.headers.map((header: string, colIdx: number) => (
                            <TableCell key={colIdx} className="text-sm">
                              {String(row[header] ?? '-')}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Mapeo sugerido */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium mb-2 text-blue-900">Configuración Sugerida</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(analysisResult.suggestedMapping).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="capitalize text-blue-900">{key}:</span>
                      <span className="font-medium text-blue-700">{value as string}</span>
                    </div>
                  ))}
                </div>
                {Object.keys(analysisResult.suggestedMapping).length === 0 && (
                  <p className="text-sm text-blue-700">
                    No se detectaron columnas con suficiente confianza. Configura manualmente.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex-1">
              {convertedExcelFile && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadExcel}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Excel Convertido
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button
                onClick={handleApplySuggestions}
                disabled={!analysisResult || Object.keys(analysisResult.suggestedMapping).length === 0}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Aplicar Configuración
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default FileFormatsConfig;
