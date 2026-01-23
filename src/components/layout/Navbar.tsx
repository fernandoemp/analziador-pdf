import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LocalStorageMonitor } from '@/components/pdf-structured-extractor/LocalStorageMonitor';
import GeminiApiKeyConfig from '@/components/GeminiApiKeyConfig';
import { settingsDb, type AiProviderId } from '@/lib/localDb';
import { LogOut, Settings } from 'lucide-react';

type Props = {
  authStorageKey: string;
};

const AI_PREFS_STORAGE_KEY = 'pdf-structured-extractor:ai-preferences:v1';

type AiPrefs = {
  provider: AiProviderId;
  modelId: string;
  customModel: string;
};

function getSessionEmail(authStorageKey: string) {
  const raw = localStorage.getItem(authStorageKey);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "email" in parsed &&
      typeof (parsed as { email: unknown }).email === "string"
    ) {
      return (parsed as { email: string }).email;
    }
    return null;
  } catch {
    return null;
  }
}

function readAiPrefs(): AiPrefs | null {
  const raw = localStorage.getItem(AI_PREFS_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as { provider?: unknown; modelId?: unknown; customModel?: unknown };
    if (p.provider !== 'gemini' && p.provider !== 'kimi') return null;
    return {
      provider: p.provider,
      modelId: typeof p.modelId === 'string' ? p.modelId : '',
      customModel: typeof p.customModel === 'string' ? p.customModel : '',
    };
  } catch {
    return null;
  }
}

function resolveDefaultModelId(models: Array<{ id: string; provider: AiProviderId }>, provider: AiProviderId) {
  if (models.length === 0) return '';
  if (provider === 'gemini') {
    const preferred = models.find((m) => m.provider === 'gemini' && m.id === 'gemini-2.5-pro');
    if (preferred) return preferred.id;
  }
  const firstForProvider = models.find((m) => m.provider === provider);
  if (firstForProvider) return firstForProvider.id;
  return models[0]?.id ?? '';
}

const Navbar: React.FC<Props> = ({ authStorageKey }) => {
  const navigate = useNavigate();
  const email = getSessionEmail(authStorageKey);
  const [openSettings, setOpenSettings] = useState(false);

  const models = useMemo(() => settingsDb.getAiModels(), []);
  const [provider, setProvider] = useState<AiProviderId>('gemini');
  const [modelId, setModelId] = useState<string>('');
  const [customModel, setCustomModel] = useState<string>('');

  useEffect(() => {
    const prefs = readAiPrefs();
    const initialProvider = prefs?.provider ?? 'gemini';
    const initialModelId = prefs?.modelId ?? '';
    const resolvedModelId =
      models.some((m) => m.provider === initialProvider && m.id === initialModelId)
        ? initialModelId
        : resolveDefaultModelId(models, initialProvider);

    setProvider(initialProvider);
    setModelId(resolvedModelId);
    setCustomModel(prefs?.customModel ?? '');
  }, [models]);

  useEffect(() => {
    try {
      localStorage.setItem(
        AI_PREFS_STORAGE_KEY,
        JSON.stringify({ provider, modelId, customModel } satisfies AiPrefs),
      );
    } catch {
      return;
    }
  }, [provider, modelId, customModel]);

  useEffect(() => {
    if (models.length === 0) return;
    const available = models.filter((m) => m.provider === provider);
    if (available.length === 0) return;
    const exists = available.some((m) => m.id === modelId);
    if (!exists) setModelId(resolveDefaultModelId(models, provider));
  }, [models, modelId, provider]);

  const handleLogout = () => {
    localStorage.removeItem(authStorageKey);
    navigate("/login", { replace: true });
  };

  return (
    <nav className="bg-primary text-primary-foreground p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center gap-4">
        <div className="text-2xl font-bold">Finanzas 360</div>
        <div className="flex items-center gap-3">
          {email ? <div className="text-sm text-primary-foreground/90">{email}</div> : null}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setOpenSettings(true)}
            aria-label="Configuración"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
      <Dialog open={openSettings} onOpenChange={setOpenSettings}>
        <DialogContent className="max-w-2xl w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configuración</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <LocalStorageMonitor defaultOpen />
            <GeminiApiKeyConfig />

            <div className="border rounded-md p-3 space-y-3">
              <div className="font-semibold">Verificación con IA</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Proveedor</Label>
                  <Select
                    value={provider}
                    onValueChange={(val) => {
                      const nextProvider = val as AiProviderId;
                      setProvider(nextProvider);
                      setCustomModel('');
                      setModelId(resolveDefaultModelId(models, nextProvider));
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecciona proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini">Gemini</SelectItem>
                      <SelectItem value="kimi">Kimi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Modelo</Label>
                  <Select value={modelId || undefined} onValueChange={setModelId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecciona modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {models
                        .filter((m) => m.provider === provider)
                        .map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.label} ({m.model})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="custom-model-navbar">Modelo personalizado</Label>
                <Input
                  id="custom-model-navbar"
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder={provider === 'gemini' ? 'gemini-2.5-pro' : 'kimi-k2-turbo-preview'}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </nav>
  );
};

export default Navbar;
