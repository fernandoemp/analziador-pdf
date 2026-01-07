# Conversión de PDF a Excel

## 🎯 Nueva Funcionalidad

Ahora puedes convertir archivos PDF a Excel antes de analizarlos, lo que mejora significativamente la precisión de la detección de columnas y el procesamiento de datos.

## ✨ Características

### 1. **Conversión Automática**
- Extrae texto del PDF usando PDF.js
- Detecta estructura tabular automáticamente
- Identifica encabezados y filas de datos
- Genera archivo Excel (.xlsx) con formato correcto
- Ajusta anchos de columna automáticamente

### 2. **Checkbox en Análisis**
- Aparece solo para formatos PDF
- Opción: "Convertir a Excel antes de analizar"
- Se puede activar/desactivar según necesidad

### 3. **Descarga del Excel**
- Botón "Descargar Excel Convertido" en el diálogo de resultados
- Archivo nombrado automáticamente: `[nombre_original]_convertido.xlsx`
- Listo para usar en otras aplicaciones

## 🚀 Cómo Usar

### Paso 1: Configurar Banco con PDF
1. Ve a **Cuenta → Bancos**
2. Edita o crea un banco
3. Agrega formato PDF en "Configuración por Tipo de Archivo"

### Paso 2: Analizar con Conversión
1. En el formato PDF, verás el checkbox: **"Convertir a Excel antes de analizar"**
2. Marca el checkbox si quieres convertir primero
3. Haz clic en **"Analizar Archivo"**
4. Selecciona tu archivo PDF

### Paso 3: Proceso de Conversión
El sistema:
1. Muestra "Convirtiendo PDF a Excel..."
2. Extrae texto del PDF
3. Detecta estructura tabular
4. Crea archivo Excel
5. Muestra "PDF convertido: X filas, Y columnas"
6. Analiza el Excel generado automáticamente

### Paso 4: Revisar Resultados
- Verás el análisis del Excel convertido
- Mensaje verde: "PDF convertido a Excel exitosamente"
- Botón **"Descargar Excel Convertido"** disponible

### Paso 5: Descargar Excel (Opcional)
- Haz clic en "Descargar Excel Convertido"
- El archivo se descarga a tu carpeta de descargas
- Puedes usarlo para otros propósitos

### Paso 6: Aplicar Configuración
- Revisa las columnas detectadas
- Haz clic en **"Aplicar Configuración"**
- Las columnas se guardan en el banco

## 📊 Ventajas de la Conversión

### Mayor Precisión
- ✅ Excel tiene estructura más clara que PDF
- ✅ Mejor detección de columnas
- ✅ Menos errores de parseo
- ✅ Valores numéricos más precisos

### Reutilización
- ✅ Descarga el Excel para otros usos
- ✅ Edita manualmente si es necesario
- ✅ Comparte con otros sistemas
- ✅ Archivo más portable

### Debugging
- ✅ Verifica visualmente la conversión
- ✅ Identifica problemas fácilmente
- ✅ Ajusta manualmente si es necesario

## 🔧 Detalles Técnicos

### Archivo: `src/lib/pdfToExcel.ts`

```typescript
export const convertPDFToExcel = async (pdfFile: File): Promise<ConversionResult>
```

**Proceso:**
1. Carga PDF.js dinámicamente
2. Extrae texto de todas las páginas
3. Busca línea de encabezados (palabras clave)
4. Divide columnas por espacios múltiples
5. Extrae filas de datos válidas
6. Crea workbook con XLSX
7. Ajusta anchos de columna
8. Genera archivo Blob
9. Retorna File object

**Retorna:**
```typescript
{
  success: boolean;
  excelFile?: File;
  error?: string;
  rowCount?: number;
  columnCount?: number;
}
```

### Integración en FileFormatsConfig

**Estados:**
```typescript
const [convertToExcel, setConvertToExcel] = useState<boolean>(false);
const [convertedExcelFile, setConvertedExcelFile] = useState<File | null>(null);
```

**Flujo:**
1. Usuario marca checkbox
2. Sube archivo PDF
3. Sistema detecta `convertToExcel === true`
4. Llama a `convertPDFToExcel()`
5. Guarda resultado en `convertedExcelFile`
6. Analiza el Excel generado
7. Muestra botón de descarga

## 📝 Ejemplo de Uso

### Caso 1: Análisis Directo de PDF
```
1. No marcar checkbox
2. Subir PDF
3. Sistema analiza PDF directamente
4. Puede tener menor precisión
```

### Caso 2: Conversión + Análisis
```
1. Marcar checkbox "Convertir a Excel"
2. Subir PDF
3. Sistema convierte a Excel
4. Analiza el Excel (mayor precisión)
5. Opción de descargar Excel
```

## ⚠️ Consideraciones

### Cuándo Usar Conversión
- ✅ PDFs con estructura compleja
- ✅ Cuando necesitas mayor precisión
- ✅ Si quieres el Excel para otros usos
- ✅ PDFs con muchas columnas

### Cuándo NO Usar Conversión
- ❌ PDFs muy simples (innecesario)
- ❌ Si ya tienes el Excel original
- ❌ PDFs escaneados (no funcionará)
- ❌ Cuando la velocidad es crítica

### Limitaciones
- Solo funciona con PDFs de texto (no imágenes)
- Requiere estructura tabular clara
- Columnas deben estar separadas por espacios
- Puede fallar con formatos muy irregulares

## 🎨 UI/UX

### Checkbox
- Aparece solo para formatos PDF
- Texto claro: "Convertir a Excel antes de analizar"
- Se puede cambiar antes de cada análisis
- Estado se mantiene durante la sesión

### Mensajes
- "Convirtiendo PDF a Excel..." (durante conversión)
- "PDF convertido: X filas, Y columnas" (éxito)
- "Error al convertir: [mensaje]" (error)
- "PDF convertido a Excel exitosamente" (en diálogo)

### Botón de Descarga
- Aparece solo si hay Excel convertido
- Icono de descarga + texto
- Posición: Izquierda del footer
- Estilo: Secondary button

## 🧪 Testing

### Probar Conversión
1. Genera PDF con `crear-pdf-ejemplo.html`
2. Ve a Cuenta → Bancos
3. Agrega formato PDF
4. Marca checkbox de conversión
5. Sube el PDF generado
6. Verifica conversión exitosa
7. Descarga el Excel
8. Abre en Excel/LibreOffice
9. Verifica estructura correcta

### Casos de Prueba
- ✅ PDF simple con pocas columnas
- ✅ PDF complejo con muchas columnas
- ✅ PDF con números y fechas
- ✅ PDF con caracteres especiales
- ❌ PDF escaneado (debe fallar)
- ❌ PDF sin estructura tabular (debe fallar)

## 📚 Archivos Relacionados

- `src/lib/pdfToExcel.ts` - Lógica de conversión
- `src/components/FileFormatsConfig.tsx` - UI y checkbox
- `src/lib/fileAnalyzer.ts` - Análisis de archivos
- `src/lib/pdfParser.ts` - Procesamiento de transacciones
- `public/pdf.worker.min.mjs` - Worker de PDF.js

## 🎯 Resultado

- ✅ Conversión PDF → Excel funcional
- ✅ Checkbox intuitivo en UI
- ✅ Descarga de Excel convertido
- ✅ Mayor precisión en análisis
- ✅ Mejor experiencia de usuario
- ✅ Reutilización de datos

---

**Estado**: ✅ Completado y Funcional
**Última actualización**: Diciembre 2024
