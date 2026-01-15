import { v4 as uuidv4 } from 'uuid';
import { Transaction, FileRecord, FileSourceType } from '@/types/finanzas';

const categories = ['Ventas', 'Alquiler', 'Impuestos', 'Salario', 'Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Inversiones'];
const sources: Record<FileSourceType, string[]> = {
  banco: ['Banco Pata', 'Banco Gato'],
  exterior: ['Payo', 'Wise'],
  inversion: ['Broker X', 'Fondo Y'],
  imagen: ['Factura'],
};

const getRandomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const generateMockTransactions = (
  fileId: string,
  fileName: string,
  fileType: FileSourceType,
  numTransactions: number = 10
): Transaction[] => {
  const transactions: Transaction[] = [];
  const selectedSources = sources[fileType];

  for (let i = 0; i < numTransactions; i++) {
    const date = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Last 30 days
    const amount = parseFloat((Math.random() * 2000 - 1000).toFixed(2)); // -1000 to 1000
    const category = getRandomItem(categories);
    const source = getRandomItem(selectedSources);

    transactions.push({
      id: uuidv4(),
      date: date.toISOString().split('T')[0], // YYYY-MM-DD
      description: `Transacción simulada ${i + 1} - ${category}`,
      category,
      amount,
      source,
      file_id: fileId,
    });
  }
  return transactions;
};
