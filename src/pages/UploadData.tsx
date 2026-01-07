import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import FileUploadArea from '@/components/FileUploadArea';
import { FileRecord, FileSourceType, Transaction, InvoiceData } from '@/types/finanzas';
import { parseFile } from '@/lib/fileParser';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { localDb } from '@/lib/localDb';
import ReviewTransactionsDialog from '@/components/ReviewTransactionsDialog';
import InvoiceReviewDialog from '@/components/InvoiceReviewDialog';
import { extractInvoiceDataFromImage } from '@/lib/imageParser';

const UploadData: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [pendingFileRecord, setPendingFileRecord] = useState<FileRecord | null>(null);
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [pendingInvoiceData, setPendingInvoiceData] = useState<InvoiceData | null>(null);
  const [pendingInvoiceImageUrl, setPendingInvoiceImageUrl] = useState<string | null>(null);

  const handleFileUpload = async (file: File, sourceType: FileSourceType, bankId: string) => {
    if (!file || !sourceType || !bankId) {
      showError('Por favor, selecciona un archivo, tipo de fuente y banco.');
      return;
    }

    setIsLoading(true);
    const loadingToastId = showLoading('Procesando archivo...');

    try {
      // Obtener información del banco
      const bank = localDb.getBankById(bankId);
      if (!bank) {
        showError('Banco no encontrado');
        setIsLoading(false);
        dismissToast(loadingToastId);
        return;
      }

      const newFileRecord: FileRecord = {
        id: uuidv4(),
        name: file.name,
        type: sourceType,
        bank_id: bankId,
        upload_date: new Date().toISOString(),
        status: 'processing',
      };

      if (file.type.startsWith('image/')) {
        dismissToast(loadingToastId);
        const imageToastId = showLoading('Reconociendo imagen de factura...');
        try {
          const data = await extractInvoiceDataFromImage(file);
          setPendingFileRecord(newFileRecord);
          setPendingInvoiceData(data);
          const url = URL.createObjectURL(file);
          setPendingInvoiceImageUrl(url);
          setShowInvoiceDialog(true);
          dismissToast(imageToastId);
          showSuccess('Factura reconocida. Revisa la información antes de confirmar.');
        } catch (err: unknown) {
          dismissToast(imageToastId);
          const msg = err instanceof Error ? err.message : String(err);
          showError(`Error al reconocer la imagen: ${msg || 'Intenta con una imagen nítida'}`);
        }
      } else {
        const transactions = await parseFile(file, newFileRecord.id, sourceType, bank.name, bank);
        setPendingFileRecord(newFileRecord);
        setPendingTransactions(transactions);
        setShowReviewDialog(true);
        dismissToast(loadingToastId);
        showSuccess(`Archivo procesado. Se encontraron ${transactions.length} transacciones. Por favor, revisa antes de guardar.`);
      }

    } catch (error: unknown) {
      dismissToast(loadingToastId);
      const msg = error instanceof Error ? error.message : String(error);
      showError(`Error al procesar el archivo: ${msg}`);
      console.error('Error during file upload and processing:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveAndSave = (fileRecord: FileRecord, transactions: Transaction[]) => {
    // Guardar el archivo y las transacciones solo después de la aprobación
    localDb.addFile({ ...fileRecord, status: 'completed' }); // Marcar como completado al guardar
    localDb.addTransactions(transactions);
    showSuccess('Transacciones guardadas con éxito y disponibles en Análisis!');
    // Limpiar el estado pendiente
    setPendingFileRecord(null);
    setPendingTransactions([]);
  };

  const handleCancelReview = () => {
    showError('Procesamiento de archivo cancelado.');
    // Limpiar el estado pendiente
    setPendingFileRecord(null);
    setPendingTransactions([]);
  };

  const handleApproveInvoice = () => {
    if (pendingFileRecord) {
      localDb.addFile({ ...pendingFileRecord, status: 'completed' });
      showSuccess('Factura guardada.');
    }
    setShowInvoiceDialog(false);
    if (pendingInvoiceImageUrl) {
      URL.revokeObjectURL(pendingInvoiceImageUrl);
    }
    setPendingInvoiceImageUrl(null);
    setPendingInvoiceData(null);
    setPendingFileRecord(null);
  };

  const handleCancelInvoice = () => {
    showError('Reconocimiento de factura cancelado.');
    setShowInvoiceDialog(false);
    if (pendingInvoiceImageUrl) {
      URL.revokeObjectURL(pendingInvoiceImageUrl);
    }
    setPendingInvoiceImageUrl(null);
    setPendingInvoiceData(null);
    setPendingFileRecord(null);
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Carga de Datos</CardTitle>
          <CardDescription className="text-center">
            Sube tus extractos bancarios o de inversión para consolidar tu información financiera.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploadArea onFileUpload={handleFileUpload} isLoading={isLoading} />
        </CardContent>
      </Card>

      <ReviewTransactionsDialog
        isOpen={showReviewDialog}
        onClose={() => setShowReviewDialog(false)}
        onApprove={handleApproveAndSave}
        onCancel={handleCancelReview}
        fileRecord={pendingFileRecord}
        transactions={pendingTransactions}
      />

      <InvoiceReviewDialog
        isOpen={showInvoiceDialog}
        onClose={() => setShowInvoiceDialog(false)}
        onApprove={handleApproveInvoice}
        onCancel={handleCancelInvoice}
        invoiceData={pendingInvoiceData}
        imageUrl={pendingInvoiceImageUrl}
        fileName={pendingFileRecord?.name}
      />
    </div>
  );
};

export default UploadData;
