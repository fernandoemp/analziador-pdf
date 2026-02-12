import { ManualMatchDialog } from './ManualMatchDialog';
import { ValidatorDialog } from './ValidatorDialog';
import { type BankReconciliationState } from '../hooks/useBankReconciliationState';

export const BankReconciliationDialogs = ({ state }: { state: BankReconciliationState }) => {
  const {
    showManualMatch,
    setShowManualMatch,
    manualBankIndex,
    manualLedgerIndex,
    reconciliation,
    bankRows,
    ledgerRows,
    bankHeaders,
    ledgerHeaders,
    fieldMapping,
    setManualBankIndex,
    setManualLedgerIndex,
    handleManualMatch,
    showValidator,
    setShowValidator,
    bankPdfUrl,
    validatorFingerprint,
    validatorTable,
    pdfScrollRef,
    aiScrollRef,
    syncScroll,
  } = state;

  return (
    <>
      <ManualMatchDialog
        open={showManualMatch}
        onOpenChange={setShowManualMatch}
        manualBankIndex={manualBankIndex}
        manualLedgerIndex={manualLedgerIndex}
        reconciliation={reconciliation}
        bankRows={bankRows}
        ledgerRows={ledgerRows}
        bankHeaders={bankHeaders}
        ledgerHeaders={ledgerHeaders}
        fieldMapping={fieldMapping}
        onSelectBankIndex={setManualBankIndex}
        onSelectLedgerIndex={setManualLedgerIndex}
        onConfirm={handleManualMatch}
      />
      <ValidatorDialog
        open={showValidator}
        onOpenChange={setShowValidator}
        pdfUrl={bankPdfUrl}
        fileFingerprint={validatorFingerprint}
        validatorTable={validatorTable}
        pdfScrollRef={pdfScrollRef}
        aiScrollRef={aiScrollRef}
        onPdfScroll={syncScroll}
        onSetCurrentPage={(page) => validatorTable.setCurrentPage(page)}
      />
    </>
  );
};
