import { Step1Upload } from './Step1Upload';
import { Step2BankHeaders } from './Step2BankHeaders';
import { Step3BankExtraction } from './Step3BankExtraction';
import { Step4LedgerHeaders } from './Step4LedgerHeaders';
import { Step5LedgerExtraction } from './Step5LedgerExtraction';
import { Step6ReconciliationConfig } from './Step6ReconciliationConfig';
import { Step7ReconciliationResults } from './Step7ReconciliationResults';
import { StepIndicator } from './StepIndicator';
import { type BankReconciliationState } from '../hooks/useBankReconciliationState';

export const BankReconciliationSteps = ({ state }: { state: BankReconciliationState }) => {
  const {
    step,
    setStep,
    bankFile,
    setBankFile,
    ledgerFile,
    setLedgerFile,
    bankHeaders,
    bankRows,
    setBankHeaders,
    setBankRows,
    ledgerHeaders,
    ledgerRows,
    ledgerHeaderDraft,
    setLedgerHeaderDraft,
    ledgerPreviewRows,
    fieldMapping,
    setFieldMapping,
    selectedBank,
    setSelectedBank,
    saveBankConfig,
    setSaveBankConfig,
    matchMode,
    setMatchMode,
    toleranceDays,
    setToleranceDays,
    toleranceAmountPercent,
    setToleranceAmountPercent,
    useDescription,
    setUseDescription,
    descriptionThreshold,
    setDescriptionThreshold,
    isReconciling,
    reconciliation,
    setReconciliation,
    activePdfRole,
    ai,
    ledgerFormat,
    bankDropzone,
    ledgerDropzone,
    ledgerTable,
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
  } = state;

  return (
    <>
      <StepIndicator step={step} />
      {step === 1 && (
        <Step1Upload
          bankDropzone={bankDropzone}
          ledgerDropzone={ledgerDropzone}
          bankFile={bankFile}
          ledgerFile={ledgerFile}
          ledgerFormat={ledgerFormat}
          onClearBankFile={() => setBankFile(null)}
          onClearLedgerFile={() => setLedgerFile(null)}
          onContinue={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <Step2BankHeaders
          ai={ai}
          bankFile={bankFile}
          activePdfRole={activePdfRole}
          selectedBank={selectedBank}
          saveBankConfig={saveBankConfig}
          savedBankHeaders={savedBankHeaders}
          onSelectBank={(value) => setSelectedBank(value as typeof selectedBank)}
          onToggleSaveConfig={setSaveBankConfig}
          onApplySavedHeaders={() => ai.setHeaderDraft(savedBankHeaders || [])}
          onConfirm={handleConfirmBankHeaders}
          onDetectHeaders={handleDetectBankHeaders}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <Step3BankExtraction
          ai={ai}
          bankFile={bankFile}
          onBack={() => setStep(2)}
          onContinue={() => {
            setBankHeaders(ai.aiHeaders);
            setBankRows(ai.aiRows);
            setStep(4);
          }}
        />
      )}
      {step === 4 && (
        <Step4LedgerHeaders
          ai={ai}
          ledgerFile={ledgerFile}
          ledgerFormat={ledgerFormat}
          activePdfRole={activePdfRole}
          ledgerHeaderDraft={ledgerHeaderDraft}
          ledgerPreviewRows={ledgerPreviewRows}
          onChangeHeader={(index, value) =>
            setLedgerHeaderDraft(prev => prev.map((item, i) => (i === index ? value : item)))
          }
          onRemoveHeader={(index) => setLedgerHeaderDraft(prev => prev.filter((_, i) => i !== index))}
          onAddHeader={() => setLedgerHeaderDraft(prev => [...prev, ''])}
          onConfirm={handleConfirmLedgerHeaders}
          onDetectHeaders={handleDetectLedgerHeaders}
          onDetectLocalHeaders={handleDetectLedgerHeadersLocal}
          onBack={() => setStep(3)}
        />
      )}
      {step === 5 && (
        <Step5LedgerExtraction
          ai={ai}
          ledgerFile={ledgerFile}
          ledgerFormat={ledgerFormat}
          ledgerRows={ledgerRows}
          ledgerTable={ledgerTable}
          onLoadLedgerRows={handleLoadLedgerRows}
          onBack={() => setStep(4)}
          onContinue={() => setStep(6)}
        />
      )}
      {step === 6 && (
        <Step6ReconciliationConfig
          toleranceDays={toleranceDays}
          toleranceAmountPercent={toleranceAmountPercent}
          useDescription={useDescription}
          descriptionThreshold={descriptionThreshold}
          fieldMapping={fieldMapping}
          bankHeadersOptions={bankHeadersOptions}
          ledgerHeadersOptions={ledgerHeadersOptions}
          onChangeToleranceDays={setToleranceDays}
          onChangeToleranceAmountPercent={setToleranceAmountPercent}
          onToggleDescription={setUseDescription}
          onChangeDescriptionThreshold={setDescriptionThreshold}
          onChangeFieldMapping={setFieldMapping}
          onBack={() => setStep(5)}
          onExecute={handleExecuteReconciliation}
        />
      )}
      {step === 7 && (
        <Step7ReconciliationResults
          stats={stats}
          isReconciling={isReconciling}
          reconciliation={reconciliation}
          bankHeaders={bankHeaders}
          ledgerHeaders={ledgerHeaders}
          bankRows={bankRows}
          ledgerRows={ledgerRows}
          fieldMapping={fieldMapping}
          onToggleMatchVerified={(matchId, checked) =>
            setReconciliation(prev => ({
              ...prev,
              matches: prev.matches.map(m => (m.id === matchId ? { ...m, verified: checked } : m)),
            }))
          }
          onAcceptDiscrepancy={(matchId) =>
            setReconciliation(prev => ({
              ...prev,
              discrepancies: prev.discrepancies.filter(m => m.id !== matchId),
            }))
          }
          onBackToConfig={() => setStep(6)}
          onExportExcel={handleExportExcel}
          onExportPdf={handleExportPdf}
          onReset={handleReset}
        />
      )}
    </>
  );
};
