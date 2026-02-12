import { useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { normalizeHeader } from '../utils/textUtils';
import { type FieldMapping } from '../types';

export const useFieldMappingDefaults = ({
  bankHeaders,
  ledgerHeaders,
  setFieldMapping,
}: {
  bankHeaders: string[];
  ledgerHeaders: string[];
  setFieldMapping: Dispatch<SetStateAction<FieldMapping>>;
}) => {
  const bankHeadersOptions = useMemo(() => bankHeaders.filter(Boolean), [bankHeaders]);
  const ledgerHeadersOptions = useMemo(() => ledgerHeaders.filter(Boolean), [ledgerHeaders]);

  useEffect(() => {
    const pickHeader = (headers: string[], keywords: string[]) =>
      headers.find(header => keywords.some(keyword => normalizeHeader(header).includes(keyword))) || '';
    setFieldMapping(prev => ({
      bankDate: prev.bankDate || pickHeader(bankHeadersOptions, ['fecha', 'date']) || bankHeadersOptions[0] || '',
      ledgerDate: prev.ledgerDate || pickHeader(ledgerHeadersOptions, ['fecha', 'date']) || ledgerHeadersOptions[0] || '',
      bankAmount:
        prev.bankAmount || pickHeader(bankHeadersOptions, ['debe', 'debito', 'débito', 'monto', 'importe', 'amount']) || bankHeadersOptions[0] || '',
      ledgerAmount:
        prev.ledgerAmount || pickHeader(ledgerHeadersOptions, ['debe', 'debito', 'débito', 'monto', 'importe', 'amount']) || ledgerHeadersOptions[0] || '',
      bankCredit: prev.bankCredit || pickHeader(bankHeadersOptions, ['haber', 'credito', 'credit']) || '',
      ledgerCredit: prev.ledgerCredit || pickHeader(ledgerHeadersOptions, ['haber', 'credito', 'credit']) || '',
      bankDescription:
        prev.bankDescription || pickHeader(bankHeadersOptions, ['descripcion', 'descripción', 'concepto', 'detalle', 'desc']) || bankHeadersOptions[0] || '',
      ledgerDescription:
        prev.ledgerDescription || pickHeader(ledgerHeadersOptions, ['descripcion', 'descripción', 'concepto', 'detalle', 'desc']) || ledgerHeadersOptions[0] || '',
    }));
  }, [bankHeadersOptions, ledgerHeadersOptions, setFieldMapping]);

  return { bankHeadersOptions, ledgerHeadersOptions };
};
