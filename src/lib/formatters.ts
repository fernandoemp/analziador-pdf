/**
 * Formatea un número con separadores de miles y decimales
 * @param value - El número a formatear
 * @param decimals - Número de decimales (por defecto 2)
 * @returns String formateado con separadores de miles
 */
export const formatCurrency = (value: number, decimals: number = 2): string => {
  return value.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Formatea un número como moneda con símbolo $
 * @param value - El número a formatear
 * @param decimals - Número de decimales (por defecto 2)
 * @returns String formateado como $1,234.56
 */
export const formatMoney = (value: number, decimals: number = 2): string => {
  return `$${formatCurrency(value, decimals)}`;
};
