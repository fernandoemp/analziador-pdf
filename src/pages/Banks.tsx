import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Building2, Plus, Edit, Trash2, AlertTriangle, Globe, DollarSign, Settings } from 'lucide-react';
import { localDb } from '@/lib/localDb';
import { Bank, BankColumnMapping, FileFormatConfig } from '@/types/finanzas';
import { showSuccess, showError } from '@/utils/toast';
import ColumnMappingConfig from '@/components/ColumnMappingConfig';
import FileFormatsConfig from '@/components/FileFormatsConfig';

const COUNTRIES = [
  'Costa Rica',
  'Estados Unidos',
  'México',
  'España',
  'Colombia',
  'Argentina',
  'Chile',
  'Perú',
  'Otro',
];

const CURRENCIES = [
  { code: 'CRC', name: 'Colón Costarricense' },
  { code: 'USD', name: 'Dólar Estadounidense' },
  { code: 'EUR', name: 'Euro' },
  { code: 'MXN', name: 'Peso Mexicano' },
  { code: 'COP', name: 'Peso Colombiano' },
  { code: 'ARS', name: 'Peso Argentino' },
  { code: 'CLP', name: 'Peso Chileno' },
  { code: 'PEN', name: 'Sol Peruano' },
];

const Banks: React.FC = () => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [bankToDelete, setBankToDelete] = useState<Bank | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    country: '',
    currency: '',
  });

  const [columnMapping, setColumnMapping] = useState<BankColumnMapping>({});
  const [fileFormats, setFileFormats] = useState<FileFormatConfig[]>([]);

  useEffect(() => {
    localDb.initializeDefaultBanks();
    loadBanks();
  }, []);

  const loadBanks = () => {
    const loadedBanks = localDb.getBanks();
    // Actualizar contador de transacciones
    const banksWithCounts = loadedBanks.map(bank => ({
      ...bank,
      totalTransactions: localDb.countTransactionsByBank(bank.id),
    }));
    setBanks(banksWithCounts);
  };

  const handleOpenDialog = (bank?: Bank) => {
    if (bank) {
      setEditingBank(bank);
      setFormData({
        name: bank.name,
        country: bank.country,
        currency: bank.currency,
      });
      setColumnMapping(bank.columnMapping || {});
      setFileFormats(bank.fileFormats || []);
    } else {
      setEditingBank(null);
      setFormData({
        name: '',
        country: '',
        currency: '',
      });
      setColumnMapping({});
      setFileFormats([]);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingBank(null);
    setFormData({ name: '', country: '', currency: '' });
    setColumnMapping({});
    setFileFormats([]);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      showError('El nombre del banco es requerido');
      return;
    }

    if (!formData.country) {
      showError('Selecciona un país');
      return;
    }

    if (!formData.currency) {
      showError('Selecciona una moneda');
      return;
    }

    // Validar nombre único
    const existingBank = banks.find(
      b => b.name.toLowerCase() === formData.name.toLowerCase() && b.id !== editingBank?.id
    );
    if (existingBank) {
      showError('Ya existe un banco con ese nombre');
      return;
    }

    if (editingBank) {
      // Actualizar
      localDb.updateBank(editingBank.id, {
        name: formData.name.trim(),
        country: formData.country,
        currency: formData.currency,
        columnMapping: Object.keys(columnMapping).length > 0 ? columnMapping : undefined,
        fileFormats: fileFormats.length > 0 ? fileFormats : undefined,
      });
      showSuccess(`Banco "${formData.name}" actualizado correctamente`);
    } else {
      // Crear nuevo
      const newBank: Bank = {
        id: uuidv4(),
        name: formData.name.trim(),
        country: formData.country,
        currency: formData.currency,
        status: 'active',
        columnMapping: Object.keys(columnMapping).length > 0 ? columnMapping : undefined,
        fileFormats: fileFormats.length > 0 ? fileFormats : undefined,
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      };
      localDb.addBank(newBank);
      showSuccess(`Banco "${formData.name}" creado correctamente`);
    }

    loadBanks();
    handleCloseDialog();
  };

  const handleToggleStatus = (bank: Bank) => {
    localDb.toggleBankStatus(bank.id);
    showSuccess(
      `Banco "${bank.name}" ${bank.status === 'active' ? 'desactivado' : 'activado'} correctamente`
    );
    loadBanks();
  };

  const handleDeleteClick = (bank: Bank) => {
    setBankToDelete(bank);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!bankToDelete) return;

    const success = localDb.deleteBank(bankToDelete.id);
    if (success) {
      showSuccess(`Banco "${bankToDelete.name}" eliminado correctamente`);
      loadBanks();
    } else {
      showError('No se puede eliminar el banco porque tiene archivos asociados');
    }

    setDeleteDialogOpen(false);
    setBankToDelete(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-primary">Gestión de Bancos</h2>
          <p className="text-muted-foreground mt-1">
            Administra los bancos e instituciones financieras
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Nuevo Banco
        </Button>
      </div>

      {banks.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">No hay bancos registrados</p>
            <p className="text-sm text-muted-foreground mb-4">
              Crea tu primer banco para comenzar
            </p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Banco
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {banks.map((bank) => (
            <Card key={bank.id} className="relative">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-xl">{bank.name}</CardTitle>
                  </div>
                  <Badge variant={bank.status === 'active' ? 'default' : 'secondary'}>
                    {bank.status === 'active' ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">País:</span>
                    <span className="font-medium">{bank.country}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Moneda:</span>
                    <span className="font-medium">{bank.currency}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Transacciones:</span>
                    <Badge variant="outline">{bank.totalTransactions || 0}</Badge>
                  </div>
                  {((bank.columnMapping && Object.keys(bank.columnMapping).length > 0) || 
                    (bank.fileFormats && bank.fileFormats.length > 0)) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Settings className="h-4 w-4 text-green-600" />
                      <span className="text-green-600 font-medium">
                        {bank.fileFormats && bank.fileFormats.length > 0 
                          ? `${bank.fileFormats.length} formato(s) configurado(s)`
                          : 'Columnas configuradas'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={bank.status === 'active'}
                      onCheckedChange={() => handleToggleStatus(bank)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {bank.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDialog(bank)}
                      title="Editar banco"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(bank)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Eliminar banco"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Diálogo de crear/editar banco */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBank ? 'Editar Banco' : 'Nuevo Banco'}
            </DialogTitle>
            <DialogDescription>
              {editingBank
                ? 'Modifica la información del banco y configura las columnas de sus archivos'
                : 'Completa los datos del nuevo banco y configura las columnas de sus archivos'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Banco *</Label>
              <Input
                id="name"
                placeholder="Ej: BBVA, Banco Nacional"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">País *</Label>
              <Select value={formData.country} onValueChange={(value) => setFormData({ ...formData, country: value })}>
                <SelectTrigger id="country">
                  <SelectValue placeholder="Selecciona un país" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Moneda Principal *</Label>
              <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Selecciona una moneda" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-2">Configuración por Defecto</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Esta configuración se usará si no hay un formato específico configurado
              </p>
              <ColumnMappingConfig mapping={columnMapping} onChange={setColumnMapping} />
            </div>

            <div className="border-t pt-4">
              <FileFormatsConfig formats={fileFormats} onChange={setFileFormats} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingBank ? 'Guardar Cambios' : 'Crear Banco'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              ¿Eliminar banco?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Estás a punto de eliminar <strong>"{bankToDelete?.name}"</strong>
              </p>
              {bankToDelete && bankToDelete.totalTransactions && bankToDelete.totalTransactions > 0 ? (
                <div className="bg-red-50 p-3 rounded-md text-sm text-red-800">
                  <p className="font-semibold">⚠️ No se puede eliminar</p>
                  <p>
                    Este banco tiene {bankToDelete.totalTransactions} transacciones asociadas.
                    Elimina primero los archivos relacionados.
                  </p>
                </div>
              ) : (
                <p className="text-red-600 font-semibold">
                  Esta acción no se puede deshacer
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {(!bankToDelete?.totalTransactions || bankToDelete.totalTransactions === 0) && (
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700"
              >
                Eliminar
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Banks;
