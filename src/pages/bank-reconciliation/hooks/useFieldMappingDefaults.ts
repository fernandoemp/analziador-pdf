import { useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { normalizeHeader } from '../utils/textUtils';
import { type FieldMapping } from '../types';

export const useFieldMappingDefaults = ({
  bankHeaders,
  ledgerHeaders,
  ledgerKeyFields,
  setFieldMapping,
}: {
  bankHeaders: string[];
  ledgerHeaders: string[];
  ledgerKeyFields: { dateColumn: string; debitColumn: string; creditColumn: string; descriptionColumn: string };
  setFieldMapping: Dispatch<SetStateAction<FieldMapping>>;
}) => {
  const bankHeadersOptions = useMemo(() => bankHeaders.filter(Boolean), [bankHeaders]);
  const ledgerHeadersOptions = useMemo(() => ledgerHeaders.filter(Boolean), [ledgerHeaders]);

  useEffect(() => {
    const pickHeader = (headers: string[], keywords: string[]) =>
      headers.find(header => keywords.some(keyword => normalizeHeader(header).includes(keyword))) || '';
    setFieldMapping(prev => ({
      bankDate: prev.bankDate || bankHeadersOptions[0] || '',
      ledgerDate: prev.ledgerDate || ledgerKeyFields.dateColumn || ledgerHeadersOptions[0] || '',
      bankAmount: prev.bankAmount || bankHeadersOptions[0] || '',
      ledgerAmount: prev.ledgerAmount || ledgerKeyFields.debitColumn || ledgerHeadersOptions[0] || '',
      bankCredit: prev.bankCredit || pickHeader(bankHeadersOptions, ['haber', 'credito', 'credit']) || '',
      ledgerCredit: prev.ledgerCredit || ledgerKeyFields.creditColumn || pickHeader(ledgerHeadersOptions, ['haber', 'credito', 'credit']) || '',
      bankDescription: prev.bankDescription || bankHeadersOptions[0] || '',
      ledgerDescription: prev.ledgerDescription || ledgerKeyFields.descriptionColumn || ledgerHeadersOptions[0] || '',
    }));
  }, [bankHeadersOptions, ledgerHeadersOptions, ledgerKeyFields, setFieldMapping]);

  return { bankHeadersOptions, ledgerHeadersOptions };
};
