import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Key, Eye, EyeOff, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { settingsDb } from '@/lib/localDb';
import { showSuccess, showError } from '@/utils/toast';

const GeminiApiKeyConfig: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [testModelId, setTestModelId] = useState<string>('');
  const [testCustomModel, setTestCustomModel] = useState<string>('');

  useEffect(() => {
    const savedKey = settingsDb.getGeminiApiKey();
    if (savedKey) {
      setApiKey(savedKey);
      setIsConfigured(true);
    }
    try {
      const GEMINI_TEST_PREFS_KEY = 'pdf-structured-extractor:gemini-test-model:v1';
      const models = settingsDb.getAiModels().filter(m => m.provider === 'gemini');
      let initialId = models[0]?.id || '';
      const raw = localStorage.getItem(GEMINI_TEST_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { modelId?: string; customModel?: string };
        const custom = typeof parsed.customModel === 'string' ? parsed.customModel.trim() : '';
        if (custom) {
          setTestCustomModel(custom);
          initialId = '';
        } else if (typeof parsed.modelId === 'string' && models.some(m => m.id === parsed.modelId)) {
          initialId = parsed.modelId;
        }
      }
      setTestModelId(initialId);
    } catch {
      setTestModelId('');
    }
  }, []);

  useEffect(() => {
    try {
      const GEMINI_TEST_PREFS_KEY = 'pdf-structured-extractor:gemini-test-model:v1';
      localStorage.setItem(
        GEMINI_TEST_PREFS_KEY,
        JSON.stringify({ modelId: testModelId, customModel: testCustomModel }),
      );
    } catch {
      return;
    }
  }, [testModelId, testCustomModel]);

  const handleSave = () => {
    if (!apiKey || apiKey.trim() === '') {
      showError('Por favor ingresa una API Key válida');
      return;
    }

    settingsDb.saveGeminiApiKey(apiKey.trim());
    setIsConfigured(true);
    showSuccess('API Key de Gemini guardada correctamente');
  };

  const handleClear = () => {
    settingsDb.clearGeminiApiKey();
    setApiKey('');
    setIsConfigured(false);
    showSuccess('API Key eliminada');
  };

  const handleTest = async () => {
    if (!apiKey || apiKey.trim() === '') {
      showError('Por favor ingresa una API Key primero');
      return;
    }

    try {
      const models = settingsDb.getAiModels().filter(m => m.provider === 'gemini');
      const custom = testCustomModel.trim();
      const effectiveModel =
        custom ||
        (models.find(m => m.id === testModelId)?.model || '') ||
        'gemini-2.5-flash';

      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey.trim());
      const model = genAI.getGenerativeModel({ model: effectiveModel });
      
      const result = await model.generateContent('Di "Hola" en una palabra');
      const response = await result.response;
      const text = response.text();
      
      if (text) {
        showSuccess('✅ API Key válida y funcionando');
      } else {
        showError('La API Key no retornó una respuesta válida');
      }
    } catch (error: unknown) {
      console.error('Error al probar API Key:', error);
      const rawMessage = error instanceof Error ? error.message : String(error);
      const isQuota = /\b429\b/.test(rawMessage) || /Quota exceeded/i.test(rawMessage);
      const isPermission = /\b403\b/.test(rawMessage) || /PERMISSION_DENIED/i.test(rawMessage);
      if (isQuota) {
        showError(
          'Límite excedido o cuota 0 para el modelo seleccionado. Cambia el modelo en Configuración → Verificación con IA o vincula facturación en Google AI Studio. Más info: https://ai.google.dev/gemini-api/docs/rate-limits',
        );
      } else if (isPermission) {
        showError(
          'Permiso denegado. Verifica que la API Key sea válida y que el proyecto tenga acceso al Gemini API.',
        );
      } else {
        showError(`Error: ${rawMessage}`);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-blue-500" />
            <CardTitle>Configuración de Gemini AI</CardTitle>
          </div>
          {isConfigured && (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Configurado
            </Badge>
          )}
        </div>
        <CardDescription>
          Configura tu API Key de Google Gemini para usar IA avanzada en la conversión de PDFs a Excel
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* API Key Input */}
        <div className="space-y-2">
          <Label htmlFor="gemini-api-key">API Key de Gemini</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="gemini-api-key"
                type={showKey ? 'text' : 'password'}
                placeholder="AIzaSy..."
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
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Tu API Key se guarda localmente en tu navegador y nunca se envía a nuestros servidores
          </p>
        </div>

        <div className="space-y-2">
          <Label>Modelo de prueba</Label>
          <Select
            value={testModelId || undefined}
            onValueChange={(val) => {
              setTestModelId(val);
              setTestCustomModel('');
            }}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecciona modelo de prueba" />
            </SelectTrigger>
            <SelectContent>
              {settingsDb
                .getAiModels()
                .filter((m) => m.provider === 'gemini')
                .map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label} ({m.model})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <div className="mt-2">
            <Label htmlFor="custom-model-test">Modelo personalizado</Label>
            <Input
              id="custom-model-test"
              type="text"
              value={testCustomModel}
              onChange={(e) => setTestCustomModel(e.target.value)}
              placeholder="gemini-2.5-pro"
            />
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={!apiKey}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Guardar
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={!apiKey}>
            Probar Conexión
          </Button>
          {isConfigured && (
            <Button variant="destructive" onClick={handleClear}>
              Eliminar
            </Button>
          )}
        </div>

        {/* Información */}
        <div className="bg-blue-50 p-4 rounded-lg space-y-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-2 text-sm text-blue-900">
              <p className="font-semibold">¿Cómo obtener tu API Key?</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Ve a Google AI Studio</li>
                <li>Inicia sesión con tu cuenta de Google</li>
                <li>Haz clic en "Get API Key"</li>
                <li>Copia la clave y pégala aquí</li>
              </ol>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
              >
                Ir a Google AI Studio
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Advertencia de costos */}
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-900">
              <p className="font-semibold mb-1">Nota sobre costos:</p>
              <p>
                Gemini 2.0 Flash tiene una cuota gratuita generosa: 15 RPM, 1M TPM, 1,500 requests/día.
                Cada conversión de PDF consume tokens según el tamaño del archivo. 
                Revisa los límites en Google AI Studio.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GeminiApiKeyConfig;
