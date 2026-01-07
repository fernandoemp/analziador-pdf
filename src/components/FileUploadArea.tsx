import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileSourceType, Bank } from '@/types/finanzas';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileText } from 'lucide-react';
import { localDb } from '@/lib/localDb';

interface FileUploadAreaProps {
  onFileUpload: (file: File, sourceType: FileSourceType, bankId: string) => void;
  isLoading: boolean;
}

const FileUploadArea: React.FC<FileUploadAreaProps> = ({ onFileUpload, isLoading }) => {
  const [selectedSourceType, setSelectedSourceType] = useState<FileSourceType | ''>('');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [banks, setBanks] = useState<Bank[]>([]);

  useEffect(() => {
    localDb.initializeDefaultBanks();
    const activeBanks = localDb.getActiveBanks();
    setBanks(activeBanks);
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0 && selectedSourceType && selectedBankId) {
      onFileUpload(acceptedFiles[0], selectedSourceType as FileSourceType, selectedBankId);
    }
  }, [onFileUpload, selectedSourceType, selectedBankId]);

  const acceptConfig = selectedSourceType === 'imagen'
    ? { 'image/*': ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.webp'] }
    : {
        'text/csv': ['.csv'],
        'application/vnd.ms-excel': ['.xls'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
        'application/pdf': ['.pdf']
      };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    multiple: false,
    accept: acceptConfig,
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0 && selectedSourceType && selectedBankId) {
      onFileUpload(event.target.files[0], selectedSourceType as FileSourceType, selectedBankId);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-card text-card-foreground shadow-sm">
      <div className="mb-4 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="source-type" className="mb-2 block">Tipo de fuente:</Label>
          <Select onValueChange={(value: FileSourceType) => setSelectedSourceType(value)} value={selectedSourceType}>
            <SelectTrigger id="source-type" className="w-full">
              <SelectValue placeholder="Tipo de fuente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="banco">Banco Local</SelectItem>
              <SelectItem value="exterior">Cuenta Exterior</SelectItem>
              <SelectItem value="inversion">Inversión</SelectItem>
              <SelectItem value="imagen">Origen Imagen</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="bank-name" className="mb-2 block">Banco/Institución:</Label>
          <Select onValueChange={(value: string) => setSelectedBankId(value)} value={selectedBankId}>
            <SelectTrigger id="bank-name" className="w-full">
              <SelectValue placeholder="Selecciona banco" />
            </SelectTrigger>
            <SelectContent>
              {banks.length === 0 ? (
                <SelectItem value="none" disabled>
                  No hay bancos activos
                </SelectItem>
              ) : (
                banks.map((bank) => (
                  <SelectItem key={bank.id} value={bank.id}>
                    {bank.name} ({bank.currency})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div
        {...getRootProps()}
        className={`w-full p-8 text-center border-2 rounded-lg cursor-pointer transition-colors ${
          isDragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/20 hover:border-primary/50'
        } ${!selectedSourceType || !selectedBankId ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} disabled={!selectedSourceType || !selectedBankId} />
        <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
        {isDragActive ? (
          <p className="text-muted-foreground">Suelta el archivo aquí...</p>
        ) : (
          <p className="text-muted-foreground">Arrastra y suelta un archivo aquí, o haz clic para seleccionar</p>
        )}
        <p className="text-sm text-muted-foreground mt-2">{selectedSourceType === 'imagen' ? '(Imagen: PNG, JPG, JPEG, BMP, TIFF, WEBP)' : '(CSV, Excel o PDF)'}</p>
      </div>

      <div className="my-4 flex items-center w-full">
        <div className="flex-grow border-t border-muted-foreground/20" />
        <span className="mx-4 text-muted-foreground text-sm">O</span>
        <div className="flex-grow border-t border-muted-foreground/20" />
      </div>

      <div className="w-full">
        <Label htmlFor="file-upload" className="sr-only">Seleccionar archivo</Label>
        <Input
          id="file-upload"
          type="file"
          accept={selectedSourceType === 'imagen' ? '.png,.jpg,.jpeg,.bmp,.tiff,.webp' : '.csv,.xls,.xlsx,.pdf'}
          onChange={handleFileChange}
          className="block w-full text-sm text-muted-foreground
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-primary file:text-primary-foreground
            hover:file:bg-primary/90
            cursor-pointer
          "
          disabled={!selectedSourceType || !selectedBankId || isLoading}
        />
      </div>
      {isLoading && (
        <div className="mt-4 flex items-center text-primary">
          <FileText className="animate-pulse mr-2" />
          <span>Procesando archivo...</span>
        </div>
      )}
    </div>
  );
};

export default FileUploadArea;
