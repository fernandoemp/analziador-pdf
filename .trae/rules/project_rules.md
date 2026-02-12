# Criterios de aceptación (mantenibilidad y buenas prácticas)

## Alcance
- Aplica a cualquier cambio de código (feature, bugfix, refactor).
- Objetivo: mantener el código fácil de entender, modificar y testear, sin regresiones.

## Calidad de diseño
- Mantener responsabilidades claras: componentes UI solo presentan; hooks/servicios manejan lógica.
- Evitar duplicación: si una lógica se repite en ≥2 lugares, extraer a hook/utilidad existente o nueva.
- Mantener APIs estables: evitar cambios innecesarios en props/exports; si se cambia, hacerlo consistente en todo el proyecto.
- Evitar acoplamiento innecesario: dependencias explícitas; no acceder a globales desde utilidades salvo necesidad.

## Tamaño y estructura
- Archivos “orquestadores” (pantallas/containers) deben mantenerse pequeños: ideal <= 300 líneas.
- Subcomponentes/hook nuevos: ideal < 150–200 líneas.
- Preferir editar archivos existentes antes de crear nuevos; crear archivos solo si reduce complejidad o evita duplicación.

## TypeScript y React
- Sin `any` salvo casos estrictamente justificados; preferir tipos explícitos y `unknown` + narrowing.
- Mantener hooks puros y predecibles: evitar efectos colaterales ocultos.
- Dependencias correctas en `useEffect/useMemo/useCallback`; evitar dependencias omitidas.
- No agregar comentarios salvo que el usuario los pida explícitamente.

## UX, errores y seguridad
- Manejo de errores consistente: mensajes claros para el usuario y logs técnicos solo donde corresponda.
- No exponer/registrar llaves, tokens, secretos ni datos sensibles.
- Mantener accesibilidad básica: `aria-label` donde aplique, botones deshabilitados cuando corresponda.

## Verificación obligatoria (Definition of Done)
- `npm run lint` sin errores.
- `npx tsc --noEmit` sin errores.
- Si existen tests relevantes, ejecutarlos (`npm test`).
- Validación manual de front-end levantando el proyecto en 4200:
  - Comando recomendado en este repo: `npm run dev -- --port 4200 --strictPort --open`.
  - Si el puerto 4200 está ocupado, detener el proceso activo que lo usa y volver a levantar en 4200.

