import { BankReconciliationView } from '@/pages/bank-reconciliation/components/BankReconciliationView';
import { useBankReconciliationState } from '@/pages/bank-reconciliation/hooks/useBankReconciliationState';

const BankReconciliation = () => {
  const state = useBankReconciliationState();
  return <BankReconciliationView state={state} />;
};

export default BankReconciliation;
