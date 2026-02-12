import { useBankReconciliationConfig } from './useBankReconciliationConfig';
import { useBankReconciliationData } from './useBankReconciliationData';
import { useBankReconciliationFiles } from './useBankReconciliationFiles';
import { useBankReconciliationTables } from './useBankReconciliationTables';
import { useBankReconciliationUi } from './useBankReconciliationUi';
import { useBankHeaderFlow } from './useBankHeaderFlow';
import { useFieldMappingDefaults } from './useFieldMappingDefaults';
import { useLedgerHeaderFlow } from './useLedgerHeaderFlow';
import { useReconciliationExports } from './useReconciliationExports';
import { useReconciliationReset } from './useReconciliationReset';
import { useReconciliationRun } from './useReconciliationRun';
import { useReconciliationStats } from './useReconciliationStats';

export const useBankReconciliationState = () => {
  const ui = useBankReconciliationUi();
  const data = useBankReconciliationData();
  const config = useBankReconciliationConfig();
  const files = useBankReconciliationFiles();
  const tables = useBankReconciliationTables({
    bankHeaders: data.bankHeaders,
    bankRows: data.bankRows,
    setBankRows: data.setBankRows,
    ledgerHeaders: data.ledgerHeaders,
    ledgerRows: data.ledgerRows,
    setLedgerRows: data.setLedgerRows,
  });

  const { savedBankHeaders, handleConfirmBankHeaders, handleDetectBankHeaders } = useBankHeaderFlow({
    step: ui.step,
    bankFile: files.bankFile,
    selectedBank: config.selectedBank,
    saveBankConfig: config.saveBankConfig,
    ai: files.ai,
    activePdfRole: files.activePdfRole,
    setActivePdfRole: files.setActivePdfRole,
    setStep: ui.setStep,
    setBankHeaders: data.setBankHeaders,
    setBankRows: data.setBankRows,
    setFieldMapping: data.setFieldMapping,
  });

  const { handleConfirmLedgerHeaders, handleLoadLedgerRows, handleDetectLedgerHeaders, handleDetectLedgerHeadersLocal } =
    useLedgerHeaderFlow({
    step: ui.step,
    ledgerFile: files.ledgerFile,
    ledgerFormat: files.ledgerFormat,
    ai: files.ai,
    activePdfRole: files.activePdfRole,
    setActivePdfRole: files.setActivePdfRole,
    ledgerHeaderDraft: data.ledgerHeaderDraft,
    setLedgerHeaderDraft: data.setLedgerHeaderDraft,
    setLedgerPreviewRows: data.setLedgerPreviewRows,
    setLedgerSampleRows: data.setLedgerSampleRows,
    ledgerHeaderRowIndex: data.ledgerHeaderRowIndex,
    setLedgerHeaderRowIndex: data.setLedgerHeaderRowIndex,
    setLedgerHeaders: data.setLedgerHeaders,
    setLedgerRows: data.setLedgerRows,
    setStep: ui.setStep,
  });

  const { bankHeadersOptions, ledgerHeadersOptions } = useFieldMappingDefaults({
    bankHeaders: data.bankHeaders,
    ledgerHeaders: data.ledgerHeaders,
    setFieldMapping: data.setFieldMapping,
  });

  const { stats } = useReconciliationStats({
    bankRows: data.bankRows,
    ledgerRows: data.ledgerRows,
    reconciliation: data.reconciliation,
  });

  const { handleExecuteReconciliation } = useReconciliationRun({
    bankHeaders: data.bankHeaders,
    bankRows: data.bankRows,
    ledgerHeaders: data.ledgerHeaders,
    ledgerRows: data.ledgerRows,
    fieldMapping: data.fieldMapping,
    toleranceDays: config.toleranceDays,
    toleranceAmountPercent: config.toleranceAmountPercent,
    useDescription: config.useDescription,
    descriptionThreshold: config.descriptionThreshold,
    setReconciliation: data.setReconciliation,
    setIsReconciling: ui.setIsReconciling,
    setStep: ui.setStep,
  });

  const { handleExportExcel, handleExportPdf } = useReconciliationExports({
    stats,
    matchMode: config.matchMode,
    toleranceDays: config.toleranceDays,
    toleranceAmountPercent: config.toleranceAmountPercent,
    useDescription: config.useDescription,
    descriptionThreshold: config.descriptionThreshold,
    reconciliation: data.reconciliation,
    bankHeaders: data.bankHeaders,
    bankRows: data.bankRows,
    ledgerHeaders: data.ledgerHeaders,
    ledgerRows: data.ledgerRows,
    fieldMapping: data.fieldMapping,
    selectedBank: config.selectedBank,
  });

  const { handleReset } = useReconciliationReset({
    setStep: ui.setStep,
    setBankFile: files.setBankFile,
    setLedgerFile: files.setLedgerFile,
    setBankHeaders: data.setBankHeaders,
    setBankRows: data.setBankRows,
    setLedgerHeaders: data.setLedgerHeaders,
    setLedgerRows: data.setLedgerRows,
    setLedgerHeaderDraft: data.setLedgerHeaderDraft,
    setLedgerPreviewRows: data.setLedgerPreviewRows,
    setLedgerSampleRows: data.setLedgerSampleRows,
    setLedgerHeaderRowIndex: data.setLedgerHeaderRowIndex,
    setFieldMapping: data.setFieldMapping,
    setReconciliation: data.setReconciliation,
    setActivePdfRole: files.setActivePdfRole,
    bankPdfUrl: files.bankPdfUrl,
    ledgerPdfUrl: files.ledgerPdfUrl,
    setBankPdfUrl: files.setBankPdfUrl,
    setLedgerPdfUrl: files.setLedgerPdfUrl,
  });

  return {
    ...ui,
    ...data,
    ...config,
    ...files,
    ...tables,
    savedBankHeaders,
    bankHeadersOptions,
    ledgerHeadersOptions,
    handleConfirmBankHeaders,
    handleDetectBankHeaders,
    handleConfirmLedgerHeaders,
    handleLoadLedgerRows,
    handleDetectLedgerHeaders,
    handleDetectLedgerHeadersLocal,
    handleExecuteReconciliation,
    handleExportExcel,
    handleExportPdf,
    handleReset,
    stats,
  };
};

export type BankReconciliationState = ReturnType<typeof useBankReconciliationState>;
