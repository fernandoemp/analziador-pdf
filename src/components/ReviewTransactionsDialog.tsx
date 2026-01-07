import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { FileRecord, Transaction } from '@/types/finanzas';

interface ReviewTransactionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (file: FileRecord, transactions: Transaction[]) => void;
  onCancel: () => void;
  fileRecord: FileRecord | null;
  transactions: Transaction[];
}

const ReviewTransactionsDialog: React.FC<ReviewTransactionsDialogProps> = ({
  isOpen,
  onClose,
  onApprove,
  onCancel,
  fileRecord,
  transactions,
}) => {
  if (!fileRecord) return null;

  const handleApprove = () => {
    onApprove(fileRecord, transactions);
    onClose();
  };

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Revisar Transacciones de "{fileRecord.name}"</DialogTitle>
          <DialogDescription>
            Por favor, revisa las transacciones detectadas antes de guardarlas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto my-4">
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No se encontraron transacciones para revisar.</p>
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
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">{transaction.date}</TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell>{transaction.category}</TableCell>
                    <TableCell>{transaction.source}</TableCell>
                    <TableCell className={`text-right ${transaction.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {transaction.amount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <DialogFooter className="flex justify-between mt-4">
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleApprove} disabled={transactions.length === 0}>
            Aprobar y Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewTransactionsDialog;