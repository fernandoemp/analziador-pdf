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
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { InvoiceData } from '@/types/finanzas';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  onCancel: () => void;
  invoiceData: InvoiceData | null;
  imageUrl: string | null;
  fileName?: string;
}

const InvoiceReviewDialog: React.FC<Props> = ({ isOpen, onClose, onApprove, onCancel, invoiceData, imageUrl, fileName }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-[90vw] h-[92vh] max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Revisar Factura{fileName ? `: ${fileName}` : ''}</DialogTitle>
          <DialogDescription>
            Verifica la información extraída de la imagen de la factura.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow my-4 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto">
          <Card className="border-2">
            <CardContent className="p-4 flex items-center justify-center overflow-auto">
              {imageUrl ? (
                <img src={imageUrl} alt="Factura escaneada" className="max-h-[80vh] max-w-full w-auto rounded-md border" />
              ) : (
                <div className="text-center text-muted-foreground">Sin imagen</div>
              )}
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardContent className="p-6 space-y-4 overflow-auto">
              {invoiceData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Emisor</div>
                      <div className="text-sm font-medium">{invoiceData.issuerName || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">RUC/NIF Emisor</div>
                      <div className="text-sm font-medium">{invoiceData.issuerTaxId || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Cliente</div>
                      <div className="text-sm font-medium">{invoiceData.customerName || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">RUC/NIF Cliente</div>
                      <div className="text-sm font-medium">{invoiceData.customerTaxId || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">N° Factura</div>
                      <div className="text-sm font-medium">{invoiceData.invoiceNumber || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Fecha</div>
                      <div className="text-sm font-medium">{invoiceData.issueDate || '-'}</div>
                    </div>
                  </div>

                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="w-[90px]">Cantidad</TableHead>
                          <TableHead className="w-[110px]">Precio Unitario</TableHead>
                          <TableHead className="w-[110px]">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(invoiceData.items || []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">Sin ítems detectados</TableCell>
                          </TableRow>
                        ) : (
                          (invoiceData.items || []).map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{item.description}</TableCell>
                              <TableCell>{item.quantity ?? '-'}</TableCell>
                              <TableCell>{item.unitPrice != null ? item.unitPrice.toFixed(2) : '-'}</TableCell>
                              <TableCell>{item.total != null ? item.total.toFixed(2) : '-'}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Subtotal</div>
                      <div className="text-sm font-medium">{invoiceData.subtotal != null ? invoiceData.subtotal.toFixed(2) : '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Impuesto</div>
                      <div className="text-sm font-medium">{invoiceData.tax != null ? invoiceData.tax.toFixed(2) : '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Total</div>
                      <div className="text-sm font-medium">{invoiceData.total != null ? invoiceData.total.toFixed(2) : '-'}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">Sin datos extraídos</div>
              )}
            </CardContent>
          </Card>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={onApprove}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceReviewDialog;
