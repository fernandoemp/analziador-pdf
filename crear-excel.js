import XLSX from 'xlsx';

// Crear datos como array de objetos
const data = [
  {
    'Fecha': '01/12/2024',
    'Fecha Valor': '01/12/2024',
    'Concepto': 'Compra con tarjeta',
    'Codigo': '001',
    'Número Doc': '12345',
    'Oficina': 'Central',
    'Crédito': '',
    'Débito': 150.50,
    'Detalle': 'Supermercado La Colonia'
  },
  {
    'Fecha': '05/12/2024',
    'Fecha Valor': '05/12/2024',
    'Concepto': 'Depósito salario',
    'Codigo': '002',
    'Número Doc': '12346',
    'Oficina': 'Central',
    'Crédito': 2500.00,
    'Débito': '',
    'Detalle': 'Salario mensual empresa XYZ'
  },
  {
    'Fecha': '10/12/2024',
    'Fecha Valor': '10/12/2024',
    'Concepto': 'Transferencia enviada',
    'Codigo': '003',
    'Número Doc': '12347',
    'Oficina': 'Central',
    'Crédito': '',
    'Débito': 800.00,
    'Detalle': 'Pago alquiler apartamento'
  },
  {
    'Fecha': '12/12/2024',
    'Fecha Valor': '12/12/2024',
    'Concepto': 'Compra con tarjeta',
    'Codigo': '004',
    'Número Doc': '12348',
    'Oficina': 'Central',
    'Crédito': '',
    'Débito': 45.75,
    'Detalle': 'Gasolina Estación Shell'
  },
  {
    'Fecha': '15/12/2024',
    'Fecha Valor': '15/12/2024',
    'Concepto': 'Pago automático',
    'Codigo': '005',
    'Número Doc': '12349',
    'Oficina': 'Central',
    'Crédito': '',
    'Débito': 12.99,
    'Detalle': 'Netflix suscripción mensual'
  },
  {
    'Fecha': '18/12/2024',
    'Fecha Valor': '18/12/2024',
    'Concepto': 'Compra con tarjeta',
    'Codigo': '006',
    'Número Doc': '12350',
    'Oficina': 'Central',
    'Crédito': '',
    'Débito': 85.30,
    'Detalle': 'Restaurante El Buen Sabor'
  },
  {
    'Fecha': '20/12/2024',
    'Fecha Valor': '20/12/2024',
    'Concepto': 'Débito automático',
    'Codigo': '007',
    'Número Doc': '12351',
    'Oficina': 'Central',
    'Crédito': '',
    'Débito': 65.00,
    'Detalle': 'Pago servicio eléctrico'
  },
  {
    'Fecha': '22/12/2024',
    'Fecha Valor': '22/12/2024',
    'Concepto': 'Compra con tarjeta',
    'Codigo': '008',
    'Número Doc': '12352',
    'Oficina': 'Central',
    'Crédito': '',
    'Débito': 15.50,
    'Detalle': 'Uber viaje al centro'
  },
  {
    'Fecha': '25/12/2024',
    'Fecha Valor': '25/12/2024',
    'Concepto': 'Compra con tarjeta',
    'Codigo': '009',
    'Número Doc': '12353',
    'Oficina': 'Central',
    'Crédito': '',
    'Débito': 120.80,
    'Detalle': 'Supermercado Walmart'
  },
  {
    'Fecha': '28/12/2024',
    'Fecha Valor': '28/12/2024',
    'Concepto': 'Transferencia recibida',
    'Codigo': '010',
    'Número Doc': '12354',
    'Oficina': 'Central',
    'Crédito': 500.00,
    'Débito': '',
    'Detalle': 'Pago freelance proyecto web'
  }
];

// Crear hoja de trabajo desde JSON
const ws = XLSX.utils.json_to_sheet(data);

// Crear libro de trabajo
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Transacciones');

// Guardar archivo
XLSX.writeFile(wb, 'ejemplo-transacciones.xlsx');

console.log('Archivo Excel creado exitosamente: ejemplo-transacciones.xlsx');
