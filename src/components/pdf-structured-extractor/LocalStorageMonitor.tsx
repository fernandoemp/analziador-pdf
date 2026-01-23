import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const DEFAULT_LOCALSTORAGE_QUOTA_BYTES = 5 * 1024 * 1024;

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
};

const estimateLocalStorageBytesUsed = () => {
  if (typeof localStorage === 'undefined') return 0;
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const value = localStorage.getItem(key) ?? '';
    total += (key.length + value.length) * 2;
  }
  return total;
};

export const LocalStorageMonitor = ({ defaultOpen = false }: { defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [usedBytes, setUsedBytes] = useState(0);
  const [keyCount, setKeyCount] = useState(0);

  useEffect(() => {
    if (!open) return;

    const update = () => {
      try {
        setUsedBytes(estimateLocalStorageBytesUsed());
        setKeyCount(typeof localStorage !== 'undefined' ? localStorage.length : 0);
      } catch {
        setUsedBytes(0);
        setKeyCount(0);
      }
    };

    update();
    const intervalId = window.setInterval(update, 500);
    const handleStorage = () => update();
    window.addEventListener('storage', handleStorage);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('storage', handleStorage);
    };
  }, [open]);

  const percent = Math.min(100, Math.round((usedBytes / DEFAULT_LOCALSTORAGE_QUOTA_BYTES) * 100));

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">Almacenamiento local</div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(v => !v)}>
          {open ? 'Ocultar' : 'Mostrar'}
        </Button>
      </div>
      {open && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatBytes(usedBytes)} usados</span>
            <span>
              {percent}% de {formatBytes(DEFAULT_LOCALSTORAGE_QUOTA_BYTES)}
            </span>
          </div>
          <Progress value={percent} />
          <div className="text-xs text-muted-foreground">Claves: {keyCount}</div>
        </div>
      )}
    </div>
  );
};

