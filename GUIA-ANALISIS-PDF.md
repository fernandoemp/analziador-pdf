# Guía de Análisis de Archivos PDF

## 🎯 Objetivo

El sistema puede analizar extractos bancarios en formato PDF y detectar automáticamente las columnas de transacciones.

## ✅ Requisitos del PDF

Para que el análisis funcione correctamente, el PDF debe cumplir:

### 1. Estructura Tabular
- Las transacciones deben estar organizadas en filas y columnas
- Las columnas deben estar separadas por espacios consistentes
- Debe haber una fila de encabezados clara

### 2. Encabezados Reconocibles
El sistema busca palabras clave como:
- **Fecha**: fecha, date, día, day
- **Concepto/Descripción**: concepto, descripción, movimiento, transacción, detalle
- **Crédito**: crédito, credit, abono, haber, ingreso
- **Débito**: débito, debit, cargo, debe, egreso
- **Monto**: monto, amount, importe, valor
- **Saldo**: saldo, balance

### 3. Formato de Texto
- El PDF debe contener texto seleccionable (no imágenes escaneadas)
- Los números deben estar en formato legible
- Las fechas deben seguir un patrón reconocible (DD/MM/YYYY, etc.)

## 🚀 Cómo Usar

### Paso 1: Generar PDF de Ejemplo
1. Abre el archivo `crear-pdf-ejemplo.html` en tu navegador
2. Haz clic en "Generar PDF de Ejemplo"
3. Se descargará `ejemplo-extracto-bancario.pdf`

### Paso 2: Configurar Banco
1. Ve a **Cuenta → Bancos**
2. Crea o edita un banco
3. En "Configuración por Tipo de Archivo", agrega un formato PDF

### Paso 3: Analizar el PDF
1. En el formato PDF, haz clic en **"Analizar Archivo"**
2. Selecciona tu archivo PDF
3. Espera el análisis (puede tomar unos segundos)

### Paso 4: Revisar Resultados
El sistema mostrará:
- **Columnas detectadas**: Lista de todas las columnas encontradas
- **Tipo sugerido**: Qué tipo de dato representa cada columna
- **Confianza**: Score de 0-100% de qué tan seguro está el sistema
- **Valores de muestra**: Ejemplos de datos de cada columna
- **Vista previa**: Primeras filas de datos

### Paso 5: Aplicar Configuración
- Si los resultados son correctos, haz clic en **"Aplicar Configuración"**
- Si necesitas ajustes, cierra el diálogo y configura manualmente

## 📊 Interpretación de Scores de Confianza

| Score | Badge | Significado |
|-------|-------|-------------|
| 90-100% | 🟢 Alta | El sistema está muy seguro de la detección |
| 70-89% | 🟡 Media | Detección probable, revisar valores de muestra |
| 0-69% | ⚪ Baja | Detección incierta, configurar manualmente |

**Nota**: Los PDFs tienen scores ligeramente más bajos que CSV/Excel debido a la complejidad de extracción.

## ⚠️ Limitaciones

### No Soportado:
- ❌ PDFs escaneados (imágenes)
- ❌ PDFs con tablas complejas o anidadas
- ❌ PDFs con múltiples tablas en una página
- ❌ PDFs protegidos o encriptados
- ❌ PDFs con formato muy irregular

### Recomendaciones:
- ✅ Usa CSV o Excel cuando sea posible (mayor precisión)
- ✅ Si el PDF no se analiza bien, exporta a CSV desde tu banco
- ✅ Verifica siempre los valores de muestra antes de aplicar
- ✅ Configura manualmente si el análisis automático falla

## 🔧 Solución de Problemas

### "No se pudo detectar la estructura de columnas"
**Causa**: El PDF no tiene una estructura tabular clara
**Solución**: 
- Intenta con otro formato (CSV/Excel)
- Configura las columnas manualmente
- Verifica que el PDF tenga texto seleccionable

### "No se pudo extraer suficiente texto"
**Causa**: El PDF está vacío o es una imagen escaneada
**Solución**:
- Verifica que puedas seleccionar texto en el PDF
- Si es un escaneo, usa software OCR primero
- Solicita el extracto en formato digital a tu banco

### Columnas detectadas incorrectamente
**Causa**: Formato irregular o palabras clave ambiguas
**Solución**:
- Revisa los valores de muestra
- Ajusta manualmente el mapeo de columnas
- Usa el análisis como punto de partida, no como resultado final

## 💡 Mejores Prácticas

1. **Prueba primero**: Usa el PDF de ejemplo para familiarizarte
2. **Verifica siempre**: Revisa los valores de muestra antes de aplicar
3. **Documenta**: Nombra descriptivamente cada formato ("Extracto Mensual PDF", etc.)
4. **Prefiere CSV/Excel**: Cuando tengas opción, usa estos formatos
5. **Mantén consistencia**: Si un banco cambia el formato, crea una nueva configuración

## 📞 Soporte

Si tienes problemas con el análisis de PDF:
1. Verifica que cumple los requisitos
2. Intenta con el PDF de ejemplo
3. Revisa los mensajes de error en la consola del navegador
4. Considera usar CSV o Excel como alternativa

---

**Última actualización**: Diciembre 2024
