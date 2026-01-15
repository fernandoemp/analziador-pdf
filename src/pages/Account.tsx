import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { Building2, Users, Plus, Edit, Mail, Shield, Calendar, Trash2 } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import Banks from './Banks';
import GeminiApiKeyConfig from '@/components/GeminiApiKeyConfig';
import { settingsDb, type AiModelConfig, type AiProviderId } from '@/lib/localDb';
import { Key, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';

// Simulación de localStorage para usuarios
const USERS_KEY = 'finanzas360_users';

type UserRole = 'admin' | 'user' | 'viewer';

type StoredUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  created_date: string;
};

const getUsers = (): StoredUser[] => {
  try {
    const data = localStorage.getItem(USERS_KEY);
    if (!data) return [];
    const parsed: unknown = JSON.parse(data);
    return Array.isArray(parsed) ? (parsed as StoredUser[]) : [];
  } catch {
    return [];
  }
};

const saveUsers = (users: StoredUser[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const Account: React.FC = () => {
  const [activeTab, setActiveTab] = useState('banks');

  return (
    <div className="container mx-auto p-4 min-h-[calc(100vh-64px)]">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-primary mb-2">Mi Cuenta</h1>
        <p className="text-lg text-muted-foreground">
          Gestiona tus bancos, usuarios y configuración
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="banks" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Bancos
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Configuración
          </TabsTrigger>
        </TabsList>

        <TabsContent value="banks" className="mt-6">
          <Banks />
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <UsersManagement />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GeminiApiKeyConfig />
            <KimiApiKeyConfig />
            <AiModelsConfig />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Componente de gestión de usuarios
const UsersManagement: React.FC = () => {
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StoredUser | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'user' as UserRole,
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = () => {
    const loadedUsers = getUsers();
    setUsers(loadedUsers);
  };

  const handleOpenDialog = (user?: StoredUser) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        email: '',
        role: 'user',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      showError('Nombre y email son requeridos');
      return;
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      showError('Email inválido');
      return;
    }

    const allUsers = getUsers();

    if (editingUser) {
      // Actualizar
      const updatedUsers = allUsers.map(u =>
        u.id === editingUser.id
          ? { ...u, ...formData }
          : u
      );
      saveUsers(updatedUsers);
      showSuccess(`Usuario "${formData.name}" actualizado`);
    } else {
      // Crear
      const newUser: StoredUser = {
        id: uuidv4(),
        ...formData,
        status: 'active',
        created_date: new Date().toISOString(),
      };
      allUsers.push(newUser);
      saveUsers(allUsers);
      showSuccess(`Usuario "${formData.name}" creado`);
    }

    loadUsers();
    setDialogOpen(false);
  };

  const handleToggleStatus = (user: StoredUser) => {
    const allUsers = getUsers();
    const updatedUsers = allUsers.map(u =>
      u.id === user.id
        ? { ...u, status: (u.status === 'active' ? 'inactive' : 'active') as StoredUser['status'] }
        : u
    );
    saveUsers(updatedUsers);
    showSuccess(`Usuario ${user.status === 'active' ? 'desactivado' : 'activado'}`);
    loadUsers();
  };

  const getRoleBadge = (role: UserRole) => {
    const colors: Record<UserRole, string> = {
      admin: 'bg-purple-600',
      user: 'bg-blue-600',
      viewer: 'bg-gray-600',
    };
    const labels: Record<UserRole, string> = {
      admin: 'Administrador',
      user: 'Usuario',
      viewer: 'Visualizador',
    };
    return <Badge className={colors[role]}>{labels[role]}</Badge>;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-primary">Gestión de Usuarios</h2>
          <p className="text-muted-foreground mt-1">
            Administra los usuarios del sistema
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Nuevo Usuario
        </Button>
      </div>

      {users.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">No hay usuarios registrados</p>
            <p className="text-sm text-muted-foreground mb-4">
              Crea tu primer usuario para comenzar
            </p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Usuario
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((user) => (
            <Card key={user.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{user.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{user.email}</span>
                    </div>
                  </div>
                  <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                    {user.status === 'active' ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  {getRoleBadge(user.role)}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Creado: {new Date(user.created_date).toLocaleDateString()}
                </div>
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={user.status === 'active'}
                      onCheckedChange={() => handleToggleStatus(user)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {user.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenDialog(user)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Diálogo de crear/editar usuario */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Modifica la información del usuario'
                : 'Completa los datos del nuevo usuario'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre Completo *</Label>
              <Input
                id="name"
                placeholder="Ej: Juan Pérez"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@ejemplo.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rol *</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="user">Usuario</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Admin: acceso total | Usuario: carga y análisis | Visualizador: solo lectura
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const KimiApiKeyConfig: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isConfigured, setIsConfigured] = useState<boolean>(false);

  useEffect(() => {
    const savedKey = settingsDb.getKimiApiKey();
    if (savedKey) {
      setApiKey(savedKey);
      setIsConfigured(true);
    }
  }, []);

  const handleSave = () => {
    if (!apiKey || apiKey.trim() === '') {
      showError('Por favor ingresa una API Key válida para Kimi');
      return;
    }
    settingsDb.saveKimiApiKey(apiKey.trim());
    setIsConfigured(true);
    showSuccess('API Key de Kimi guardada correctamente');
  };

  const handleClear = () => {
    settingsDb.clearKimiApiKey();
    setApiKey('');
    setIsConfigured(false);
    showSuccess('API Key de Kimi eliminada');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-purple-500" />
            <CardTitle>Configuración de Kimi K2</CardTitle>
          </div>
          {isConfigured && (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Configurado
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Configura tu API Key de Kimi K2 para usar los modelos kimi-k2-0711-preview,
          kimi-k2-0905-preview, kimi-k2-turbo-preview, kimi-k2-thinking y
          kimi-k2-thinking-turbo en el análisis de PDFs.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="kimi-api-key">API Key de Kimi</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="kimi-api-key"
                type={showKey ? 'text' : 'password'}
                placeholder="KIMI_API_KEY"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Tu API Key se guarda localmente en tu navegador y nunca se envía a nuestros
            servidores.
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={!apiKey}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Guardar
          </Button>
          {isConfigured && (
            <Button variant="destructive" onClick={handleClear}>
              Eliminar
            </Button>
          )}
        </div>

        <div className="bg-purple-50 p-4 rounded-lg space-y-2 text-sm text-purple-900">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-purple-600 mt-0.5" />
            <div>
              <p className="font-semibold">Modelos recomendados</p>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>
                  <span className="font-medium">kimi-k2-turbo-preview</span> · recomendado, alta velocidad,
                  256k contexto.
                </li>
                <li>
                  <span className="font-medium">kimi-k2-thinking</span> · análisis profundo y
                  automatización de interpretación financiera.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const AiModelsConfig: React.FC = () => {
  const [models, setModels] = useState<AiModelConfig[]>([]);
  const [newModelProvider, setNewModelProvider] = useState<AiProviderId>('gemini');
  const [newModelLabel, setNewModelLabel] = useState<string>('');
  const [newModelName, setNewModelName] = useState<string>('');

  useEffect(() => {
    const initialModels = settingsDb.getAiModels();
    setModels(initialModels);
  }, []);

  const handleUpdateModelField = (id: string, field: keyof AiModelConfig, value: string) => {
    setModels(prev =>
      prev.map(m =>
        m.id === id
          ? {
              ...m,
              [field]: field === 'provider' ? (value as AiProviderId) : value,
            }
          : m
      )
    );
  };

  const handleDeleteModel = (id: string) => {
    setModels(prev => prev.filter(m => m.id !== id));
  };

  const handleAddModel = () => {
    if (!newModelLabel.trim() || !newModelName.trim()) return;
    const id = `${newModelProvider}-${Date.now()}`;
    const model: AiModelConfig = {
      id,
      provider: newModelProvider,
      label: newModelLabel.trim(),
      model: newModelName.trim(),
    };
    setModels(prev => [...prev, model]);
    setNewModelLabel('');
    setNewModelName('');
  };

  const handleSaveModels = () => {
    settingsDb.saveAiModels(models);
    showSuccess('Modelos guardados correctamente');
  };

  const handleResetModels = () => {
    settingsDb.resetAiModels();
    const reset = settingsDb.getAiModels();
    setModels(reset);
    showSuccess('Modelos restablecidos a los valores por defecto');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modelos IA configurados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          Gestiona los modelos disponibles para Gemini y Kimi que podrás seleccionar en el
          extractor de PDF.
        </div>
        <div className="border rounded-md p-2 max-h-60 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead>Nombre visible</TableHead>
                <TableHead>Identificador de modelo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-xs text-muted-foreground">
                    Sin modelos configurados
                  </TableCell>
                </TableRow>
              ) : (
                models.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Select
                        value={m.provider}
                        onValueChange={(val) => handleUpdateModelField(m.id, 'provider', val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gemini">Gemini</SelectItem>
                          <SelectItem value="kimi">Kimi</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 text-xs"
                        value={m.label}
                        onChange={(e) => handleUpdateModelField(m.id, 'label', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 text-xs"
                        value={m.model}
                        onChange={(e) => handleUpdateModelField(m.id, 'model', e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteModel(m.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div>
            <Label>Proveedor</Label>
            <Select
              value={newModelProvider}
              onValueChange={(val) => setNewModelProvider(val as AiProviderId)}
            >
              <SelectTrigger className="mt-1 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="kimi">Kimi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nombre visible</Label>
            <Input
              className="mt-1 h-8 text-xs"
              value={newModelLabel}
              onChange={(e) => setNewModelLabel(e.target.value)}
              placeholder="Mi modelo"
            />
          </div>
          <div>
            <Label>Identificador de modelo</Label>
            <Input
              className="mt-1 h-8 text-xs"
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              placeholder="gemini-2.0-flash, kimi-k2-turbo-preview"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={handleAddModel}
              disabled={!newModelLabel.trim() || !newModelName.trim()}
            >
              Agregar
            </Button>
            <Button variant="outline" size="sm" className="mt-1" onClick={handleSaveModels}>
              Guardar modelos
            </Button>
            <Button variant="outline" size="sm" className="mt-1" onClick={handleResetModels}>
              Restablecer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Account;
