import { useDropzone } from 'react-dropzone';
import { FileSpreadsheet, FileText, FileType, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <FileType className="h-5 w-5 text-red-500" />;
  if (ext === 'xlsx' || ext === 'xls') return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
  if (ext === 'csv') return <FileText className="h-5 w-5 text-blue-500" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
};

export function Step1Upload({
  bankDropzone,
  ledgerDropzone,
  bankFile,
  ledgerFile,
  ledgerFormat,
  onClearBankFile,
  onClearLedgerFile,
  onContinue,
}: {
  bankDropzone: ReturnType<typeof useDropzone>;
  ledgerDropzone: ReturnType<typeof useDropzone>;
  bankFile: File | null;
  ledgerFile: File | null;
  ledgerFormat: string;
  onClearBankFile: () => void;
  onClearLedgerFile: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="border rounded-lg p-4 space-y-3">
          <div className="font-semibold">Extracto Bancario</div>
          <div
            {...bankDropzone.getRootProps()}
            className={`w-full p-6 text-center border-2 rounded-lg cursor-pointer transition-colors ${
              bankDropzone.isDragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/20 hover:border-primary/50'
            }`}
          >
            <input {...bankDropzone.getInputProps()} />
            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Arrastra y suelta un PDF aquí, o haz clic para seleccionar</p>
            <p className="text-sm text-muted-foreground mt-2">(Solo PDF)</p>
          </div>
          {bankFile && (
            <div className="flex items-center justify-between gap-2 border rounded-md p-3">
              <div className="flex items-center gap-2">
                {getFileIcon(bankFile.name)}
                <div>
                  <div className="text-sm font-medium">{bankFile.name}</div>
                  <div className="text-xs text-muted-foreground">{formatFileSize(bankFile.size)}</div>
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={onClearBankFile}>
                Quitar
              </Button>
            </div>
          )}
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <div className="font-semibold">Libro Contable</div>
          <div
            {...ledgerDropzone.getRootProps()}
            className={`w-full p-6 text-center border-2 rounded-lg cursor-pointer transition-colors ${
              ledgerDropzone.isDragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/20 hover:border-primary/50'
            }`}
          >
            <input {...ledgerDropzone.getInputProps()} />
            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Arrastra y suelta un PDF, Excel o CSV aquí, o haz clic para seleccionar</p>
            <p className="text-sm text-muted-foreground mt-2">(PDF, XLSX, XLS, CSV)</p>
          </div>
          {ledgerFile && (
            <div className="flex items-center justify-between gap-2 border rounded-md p-3">
              <div className="flex items-center gap-2">
                {getFileIcon(ledgerFile.name)}
                <div>
                  <div className="text-sm font-medium">{ledgerFile.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatFileSize(ledgerFile.size)} · {ledgerFormat.toUpperCase()}
                  </div>
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={onClearLedgerFile}>
                Quitar
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between">
        <div />
        <Button type="button" onClick={onContinue} disabled={!bankFile || !ledgerFile}>
          Continuar con Encabezados
        </Button>
      </div>
    </div>
  );
}
