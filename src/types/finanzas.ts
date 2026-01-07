export type FileStatus = 'processing' | 'completed' | 'failed';
export type FileSourceType = 'banco' | 'exterior' | 'inversion' | 'imagen';
export type BankStatus = 'active' | 'inactive';
export type UserRole = 'admin' | 'user' | 'viewer';
export type UserStatus = 'active' | 'inactive';

export interface BankColumnMapping {
  date?: string;
  dateValue?: string;
  description?: string;
  detail?: string;
  code?: string;
  document?: string;
  office?: string;
  credit?: string;
  debit?: string;
  category?: string;
  amount?: string;
}

export type FileFormatType = 'csv' | 'xlsx' | 'pdf';

export interface FileFormatConfig {
  format: FileFormatType;
  name: string; // Nombre descriptivo del formato (ej: "Extracto Mensual", "Movimientos Diarios")
  columnMapping: BankColumnMapping;
}

export interface Bank {
  id: string;
  name: string;
  country: string;
  currency: string; // ISO code (USD, EUR, CRC, etc.)
  status: BankStatus;
  columnMapping?: BankColumnMapping; // Mapeo por defecto (retrocompatibilidad)
  fileFormats?: FileFormatConfig[]; // Configuraciones por tipo de archivo
  totalTransactions?: number;
  created_date: string;
  updated_date: string;
}

export interface FileRecord {
  id: string;
  name: string;
  type: FileSourceType;
  bank_id?: string; // ID del banco en lugar de nombre
  upload_date: string; // ISO date string
  status: FileStatus;
  uploaded_by?: string; // ID del usuario que lo cargó
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_date: string;
  last_login?: string;
}

export interface Transaction {
  id: string;
  date: string; // ISO date string
  description: string;
  category: string;
  amount: number;
  source: string;
  file_id: string;
}

export interface InvoiceItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
}

export interface InvoiceData {
  issuerName?: string;
  issuerTaxId?: string;
  invoiceNumber?: string;
  issueDate?: string;
  customerName?: string;
  customerTaxId?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  currency?: string;
  items?: InvoiceItem[];
  rawText?: string;
}
