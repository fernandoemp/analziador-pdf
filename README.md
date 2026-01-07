# Finanzas 360 - Sistema de Análisis Financiero

Sistema completo de gestión y análisis de transacciones financieras con soporte para múltiples bancos y formatos de archivo.

## 🚀 Características Principales

### 📊 Dashboard Interactivo
- KPIs en tiempo real: Balance Total, Ingresos, Gastos
- Gráficos de evolución mensual
- Distribución por banco
- Comparativas con períodos anteriores

### 🏦 Gestión de Bancos
- CRUD completo de bancos
- Configuración de múltiples formatos de archivo por banco
- Mapeo personalizado de columnas
- Estados activo/inactivo

### 📁 Soporte Multi-Formato
- **CSV**: Archivos de texto delimitados
- **Excel (XLSX/XLS)**: Hojas de cálculo
- **PDF**: Extractos bancarios en PDF

### 🤖 Análisis Inteligente de Archivos
- Detección automática de columnas con IA
- Scores de confianza para cada columna detectada
- Vista previa de datos antes de aplicar configuración
- Sugerencias automáticas de mapeo

### 📈 Análisis Avanzado
- Filtros por fecha, banco, categoría
- Búsqueda de transacciones
- Métricas calculadas en tiempo real
- Exportación de datos

### 👥 Gestión de Usuarios
- Roles: Admin, Usuario, Visor
- Control de acceso
- Historial de actividad

## 🛠️ Instalación

```bash
# Instalar dependencias
pnpm install

# Iniciar servidor de desarrollo
pnpm run dev
```

El servidor estará disponible en `http://localhost:8080`

## 📖 Uso

### 1. Configurar un Banco

1. Ve a **Cuenta → Bancos**
2. Crea un nuevo banco con nombre, país y moneda
3. Agrega formatos de archivo (CSV, Excel, PDF)

### 2. Analizar Formato de Archivo

Para cada formato de archivo:

1. Haz clic en **"Analizar Archivo"**
2. Sube un archivo de ejemplo
3. Revisa las columnas detectadas y sus scores de confianza
4. Aplica la configuración sugerida o ajusta manualmente

### 3. Cargar Transacciones

1. Ve a **Cargar Datos**
2. Selecciona el banco
3. Arrastra o selecciona el archivo
4. Revisa las transacciones detectadas
5. Confirma para guardar

### 4. Analizar Datos

- **Dashboard**: Vista general con KPIs y gráficos
- **Análisis**: Tabla detallada con filtros avanzados
- **Archivos**: Gestión de archivos cargados

## 🎯 Análisis de PDF

El sistema puede analizar extractos bancarios en PDF:

### Requisitos del PDF:
- Debe tener estructura tabular
- Columnas claramente separadas
- Encabezados con palabras clave (Fecha, Concepto, Crédito, Débito, etc.)

### Generar PDF de Ejemplo:
1. Abre `crear-pdf-ejemplo.html` en tu navegador
2. Haz clic en "Generar PDF de Ejemplo"
3. Usa el PDF generado para probar el análisis

### Limitaciones:
- PDFs escaneados (imágenes) no son soportados
- PDFs con formato complejo pueden requerir configuración manual
- Se recomienda usar CSV o Excel para mejor precisión

## 🔧 Tecnologías

- **Frontend**: React + TypeScript + Vite
- **UI**: Shadcn UI + Tailwind CSS
- **Gráficos**: Recharts
- **Parsers**: 
  - `papaparse` para CSV
  - `xlsx` para Excel
  - `pdfjs-dist` para PDF
- **Storage**: LocalStorage (IndexedDB en futuro)

## 📝 Estructura de Datos

### Banco
```typescript
{
  id: string;
  name: string;
  country: string;
  currency: string;
  status: 'active' | 'inactive';
  fileFormats: [
    {
      format: 'csv' | 'xlsx' | 'pdf';
      name: string;
      columnMapping: {
        date?: string;
        description?: string;
        credit?: string;
        debit?: string;
        // ... más campos
      }
    }
  ]
}
```

### Transacción
```typescript
{
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  source: string; // Nombre del banco
  file_id: string;
}
```

## 🚧 Próximas Características

- [ ] Exportación a Excel/PDF
- [ ] Categorización automática con ML
- [ ] Presupuestos y alertas
- [ ] Sincronización en la nube
- [ ] App móvil
- [ ] OCR para PDFs escaneados

## 📄 Licencia

MIT
