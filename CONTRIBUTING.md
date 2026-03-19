# Guía de Contribución — NewFenixBrands

## Flujo de trabajo

```
main (protegida) ← PR ← tu-rama-feature
```

**Nadie pushea directo a `main`.** Todo cambio entra por Pull Request.

---

## 1. Configurar tu entorno (solo la primera vez)

```bash
# Clonar el repo
git clone https://github.com/calcarazgre646/NewFenixBrands.git
cd NewFenixBrands

# Instalar dependencias
npm install

# Copiar variables de entorno (pedir valores al equipo)
cp .env.example .env.local

# Verificar que todo funciona
npm run dev          # App en http://localhost:5173
npm run lint         # 0 errores
npm run typecheck    # 0 errores
npx vitest run       # 848+ tests pasan
```

---

## 2. Crear tu rama

Siempre parte de `main` actualizado:

```bash
git checkout main
git pull origin main
git checkout -b tipo/descripcion-corta
```

### Convención de nombres de rama

| Prefijo      | Uso                        | Ejemplo                        |
|--------------|----------------------------|--------------------------------|
| `feat/`      | Feature nueva              | `feat/settings-page`           |
| `fix/`       | Bug fix                    | `fix/kpi-sparkline-crash`      |
| `refactor/`  | Refactoring sin cambio funcional | `refactor/extract-form-hook` |
| `docs/`      | Documentación              | `docs/api-endpoints`           |
| `test/`      | Solo tests                 | `test/calendar-edge-cases`     |
| `chore/`     | Config, deps, CI           | `chore/update-dependencies`    |

---

## 3. Desarrollar

```bash
# Trabajar en tu feature...
# Commits pequeños y descriptivos:
git add src/features/settings/SettingsPage.tsx
git commit -m "feat: add settings page skeleton"

# Mantener tu rama actualizada con main:
git checkout main
git pull origin main
git checkout tu-rama
git rebase main
```

### Reglas de commits

- **Idioma:** español o inglés, pero consistente dentro del PR
- **Formato:** `tipo: descripción corta`
  - `feat:` nueva funcionalidad
  - `fix:` corrección de bug
  - `refactor:` reestructuración sin cambio funcional
  - `test:` agregar o modificar tests
  - `chore:` tareas de mantenimiento
  - `docs:` documentación
- **Tamaño:** commits pequeños y atómicos (1 cambio lógico = 1 commit)

---

## 4. Antes de abrir PR

Ejecutar los 4 checks:

```bash
npm run lint         # ESLint
npm run typecheck    # TypeScript
npx vitest run       # Tests
npm run build        # Build de producción
```

**Los 4 deben pasar.** El CI los corre automáticamente pero ahorras tiempo revisando local.

---

## 5. Abrir Pull Request

```bash
git push origin tu-rama
```

Ir a GitHub → "Compare & pull request" → llenar el template.

### Reglas del PR

- **Título corto** (< 70 chars): `feat: add settings page`
- **Descripción:** usar el template (qué, por qué, cómo probar)
- **Tamaño:** PRs chicos (< 400 líneas). Si es grande, dividir en PRs secuenciales.
- **Review requerido:** mínimo 1 aprobación antes de merge
- **CI debe pasar:** los checks verdes son obligatorios

---

## 6. Code Review

Como reviewer:
- Revisar el código, no solo que pase CI
- Comentar con sugerencias constructivas
- Aprobar explícitamente cuando esté listo

Como autor:
- Responder todos los comentarios
- Hacer los cambios pedidos en commits nuevos (no amend)
- Re-solicitar review después de cambios

---

## 7. Merge

- Solo Carlos (calcarazgre646) mergea a `main`
- Método: **Squash and merge** (1 commit limpio en main)
- Borrar la rama después del merge

---

## Reglas de arquitectura (NO negociar)

1. **Queries** en `src/queries/` → solo fetch + normalización
2. **Cálculos** en `src/domain/` → funciones puras, testeables
3. **Hooks** en `src/features/[feature]/hooks/`
4. **Componentes** en `src/features/[feature]/components/` → solo UI
5. **Filtros** via `useFilters()` → nunca estado local de filtros
6. **Períodos** via `resolvePeriod()` → nunca calcular meses manual
7. **Tests** obligatorios para toda lógica de dominio nueva

---

## Estructura del proyecto

```
src/
├── api/          → Clientes Supabase + normalización ERP
├── context/      → Providers globales (Auth, Filters, Sidebar, Theme)
├── domain/       → Lógica de negocio pura (sin React, sin IO)
├── features/     → Módulos por feature (pages + components + hooks)
├── queries/      → Data fetching (TanStack Query)
├── components/   → Componentes UI compartidos
├── hooks/        → Hooks compartidos
├── icons/        → SVG como React components
├── lib/          → Config (queryClient, sentry)
└── utils/        → Utilidades de formato
```

---

## ¿Problemas?

- **Build falla:** verificar `.env.local` tiene las 4 variables
- **Tests fallan:** `npx vitest run --reporter=verbose` para ver detalles
- **Conflictos en rebase:** resolver manualmente, correr los 4 checks después
