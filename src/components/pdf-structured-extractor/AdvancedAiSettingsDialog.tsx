import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Settings } from 'lucide-react';

export type AdvancedAiSettings = {
  temperature: number;
  topP: number;
  stream: boolean;
};

export const AiVerificationHeaderBar = ({ onOpenAdvancedSettings }: { onOpenAdvancedSettings: () => void }) => {
  return (
    <div className="flex items-center justify-between">
      <div className="font-semibold">Verificación con IA</div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onOpenAdvancedSettings}
        aria-label="Configuración avanzada"
      >
        <Settings className="h-4 w-4" />
      </Button>
    </div>
  );
};

export const AdvancedAiSettingsDialog = ({
  open,
  onOpenChange,
  settings,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AdvancedAiSettings;
  onSave: (next: AdvancedAiSettings) => void;
}) => {
  const [draftTemperature, setDraftTemperature] = useState<string>(String(settings.temperature));
  const [draftTopP, setDraftTopP] = useState<string>(String(settings.topP));
  const [draftStream, setDraftStream] = useState<boolean>(settings.stream);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setDraftTemperature(String(settings.temperature));
    setDraftTopP(String(settings.topP));
    setDraftStream(settings.stream);
    setError('');
  }, [open, settings.temperature, settings.topP, settings.stream]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100%-2rem)]">
        <DialogHeader>
          <DialogTitle>Configuración avanzada</DialogTitle>
          <DialogDescription>Ajusta parámetros del modelo y guarda tus preferencias.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label>Temperature</Label>
            <div className="mt-2">
              <Slider
                value={[
                  Number.isFinite(Number(draftTemperature))
                    ? Math.max(0, Math.min(1, Number(draftTemperature)))
                    : settings.temperature,
                ]}
                onValueChange={(vals) => setDraftTemperature(String(vals[0] ?? 0))}
                min={0}
                max={1}
                step={0.05}
              />
            </div>
            <Input
              className="mt-2"
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={draftTemperature}
              onChange={(e) => setDraftTemperature(e.target.value)}
            />
          </div>
          <div>
            <Label>Top P</Label>
            <div className="mt-2">
              <Slider
                value={[
                  Number.isFinite(Number(draftTopP)) ? Math.max(0, Math.min(1, Number(draftTopP))) : settings.topP,
                ]}
                onValueChange={(vals) => setDraftTopP(String(vals[0] ?? 1))}
                min={0}
                max={1}
                step={0.05}
              />
            </div>
            <Input
              className="mt-2"
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={draftTopP}
              onChange={(e) => setDraftTopP(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">Stream</div>
              <div className="text-xs text-muted-foreground">{draftStream ? 'On' : 'Off'}</div>
            </div>
            <Switch checked={draftStream} onCheckedChange={setDraftStream} />
          </div>
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setError('');
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const nextTemperature = Number(draftTemperature);
              if (!Number.isFinite(nextTemperature) || nextTemperature < 0 || nextTemperature > 1) {
                setError('Temperature debe estar entre 0 y 1.');
                return;
              }
              const nextTopP = Number(draftTopP);
              if (!Number.isFinite(nextTopP) || nextTopP < 0 || nextTopP > 1) {
                setError('Top P debe estar entre 0 y 1.');
                return;
              }
              onSave({ temperature: nextTemperature, topP: nextTopP, stream: draftStream });
              setError('');
              onOpenChange(false);
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

