# CLAUDE.md — Fortaleza Servicar ERP

Reglas para Claude (y cualquier dev) al trabajar en este repositorio.

- **Reglas de negocio:** `docs/especificacion.md` §3, que es la **única fuente**. No las repitas en otros documentos ni en comentarios: referéncialas.
- **Alcance, stack y hosting:** el resto de `docs/especificacion.md`; la presentación del repositorio, en `README.md`.
- **Seguridad:** `SEGURIDAD.md`, **obligatorio**. Si un cambio toca auth, permisos, portal, archivos, secretos o datos personales, revísalo contra ese documento.
- **Tablas:** `docs/schema.prisma` y `docs/modelo-de-datos.md`.

## Estado del proyecto

> **Al iniciar sesión, lee primero `PROGRESO.md`.** Es la bandera de reinicio: dice qué está hecho y cuál es el siguiente paso exacto. Actualízalo al terminar cada tarea.

- **Fase 0 (análisis):** hay un prototipo sin backend en `prototipo/`, pero no hay código de producción. No lo generes si el usuario no lo pide explícitamente; avanzamos por partes.
- **Material fuente:**
  - `excelOperacionEjemplo.xlsx`: la operación real.
  - `screenshotsFuncionamiento/`: MecanicaMX, referencia **funcional**, no visual.
  - `color/` e `img/`: identidad de marca.

## graphify

Este proyecto tiene un grafo de conocimiento en `graphify-out/`.

- Para preguntas sobre el material o el código, corre primero `graphify query "<pregunta>"`. Usa `graphify path "<A>" "<B>"` para relaciones y `graphify explain "<concepto>"`.
- Usa `graphify-out/GRAPH_REPORT.md` solo para revisiones amplias.
- Después de modificar código, corre `graphify update .`.

## Stack (resumen; detalle en especificación §4)

- **Base:** TypeScript en todo · pnpm workspaces · **NestJS 11** + **Prisma** + **PostgreSQL 16**.
- **Colas:** **pg-boss**, sobre PostgreSQL y dentro del proceso de la API. **Sin Redis.**
- **Front:** **React 19 + Vite + TanStack Router/Query + Tailwind 4 + shadcn/ui**. Refresco periódico; **sin Socket.IO**.
- **Compartido y servicios:**
  - Zod compartido entre API y formularios.
  - **@react-pdf/renderer** para PDF, **sin Chromium**.
  - R2 para respaldos y fotos de perfil (sharp).
  - Docker → Render o VPS (pendiente de decisión del cliente).

El objetivo es **una sola imagen de backend** y sitios estáticos para el ERP y el portal. No agregues dependencias ni servicios de infraestructura (Redis, workers separados, Chromium, colas externas, proveedores de correo o SMS) sin justificarlo y sin avisar al usuario: cada servicio cuesta dinero cada mes.

## Arquitectura: reglas obligatorias

1. **Monolito modular.** Cada módulo vive en `apps/api/src/modules/<modulo>/` y es dueño de sus tablas (módulos en especificación §2).
   - Un módulo **no** consulta las tablas de otro con Prisma: usa el servicio público exportado del otro módulo o un evento de dominio (`@nestjs/event-emitter`; un job de pg-boss si el trabajo es asíncrono o pesado).
   - No se permiten dependencias circulares entre módulos.
2. **Lógica de dominio pura** en `domain/` (máquina de estados, cálculos) o en `packages/shared`, sin depender de Nest ni de Prisma, y con pruebas unitarias.
3. **Cálculos financieros** (especificación §3.4) viven **solo** en `packages/shared/src/finance/`. Front y back importan la misma función.
   - Dinero en **centavos como enteros**, nunca `float`.
   - Los parámetros (30 %, $400/h, comisiones, IVA) salen de `BranchSetting`, nunca hardcodeados.
4. **Una sola máquina de estados, aplicada a cada folio** (especificación §3.2).
   - La orden no tiene estatus: lo calcula de sus folios.
   - No se agregan banderas paralelas ("autorizado", "cerrado", "borrador").
   - Las partidas no tienen estatus.
5. **Alcance acotado** (especificación §1.3). No se construyen:
   - inventario ni venta de productos;
   - facturación, cobro con terminal ni paquetes de precios;
   - fotos de vehículos;
   - mensajes por WhatsApp más allá del enlace.
   - Tampoco ningún módulo fuera de especificación §2 sin aprobación del usuario.
6. **Varias sucursales:** toda entidad operativa lleva `branchId`, y las consultas se filtran por la sucursal del usuario (guard o extensión de Prisma).
7. **Validación con Zod** en `packages/shared`, reutilizada en la API (pipe) y en los formularios (react-hook-form + zodResolver).
8. **Auditoría:** los cambios de precio, estatus, pagos, gastos, compras, movimientos, permisos y cancelaciones se registran en el módulo de auditoría. Nada se borra: baja lógica, anulación o reverso (especificación §3.7).
9. **Permisos editables:** cada endpoint declara el permiso que exige, y el servidor lo valida contra `RolePermission` (especificación §3.3).
10. **Portal del cliente:**
    - endpoints bajo `/public/*`, con token de seguimiento por orden y OTP;
    - nunca exponen costo, utilidad, proveedor ni datos de otros clientes.
11. **Archivos:**
    - solo fotos de perfil y respaldos, en R2 con URLs firmadas, nunca en el disco del contenedor;
    - la firma de recepción va en la base como trazos con hash, no como imagen.
12. **Tareas lentas** (PDF, correo, recordatorios, procesamiento de fotos de perfil, respaldos) van a un job de **pg-boss** (`apps/api/src/jobs/`), con concurrencia limitada, nunca dentro del request HTTP.
13. **Seguridad por defecto** (detalle en `SEGURIDAD.md`):
    - Las respuestas se arman según los permisos del rol: sin "ver costos" no se recibe costo, utilidad ni proveedor.
    - Los IDs en URL son UUID. El `orderNumber` nunca se usa como llave de acceso.
    - Prohibido `$queryRawUnsafe` y `dangerouslySetInnerHTML` con datos de usuario.
    - Logs y Sentry sin contraseñas, tokens, OTP ni datos personales.

## Convenciones

- **Idioma:**
  - Código, identificadores, tablas y commits en **inglés**.
  - Toda la UI y los mensajes al usuario en **español de México**, centralizados en archivos i18n. Nada de strings sueltos en los componentes.
  - Fechas con `date-fns`, locale `es` y zona `America/Mexico_City`. No mezcles idiomas.
- **Marca:** el taller se llama **Fortaleza Servicar**. "Lugo Servicar" nunca aparece en UI, PDF, portal, seeds ni mensajes.
- **Glosario** (inglés en código → español en UI):

  | Código | UI |
  |---|---|
  | `Customer` | Cliente |
  | `ServiceOrder` | Orden de servicio (el servicio completo; puede tener varios carros) |
  | `Folio` | Folio (**cada carro**) |
  | `FolioAssignment` | Asignación de técnico |
  | `Reception` | Recepción (la firma el **técnico** que recibe) |
  | `Inspection` / `InspectionTemplate` | Diagnóstico / Plantilla |
  | `QuoteLine` · `LineType = LABOR \| PART \| SUBLET` | Partida · Mano de obra / Refacción / TOT |
  | `ServiceCatalogItem` | Servicio tabulado |
  | `Payment` | Pago / Anticipo |
  | `CashAccount` · `Expense` · `AccountMovement` | Cuenta · Gasto · Movimiento (ingreso o egreso) |
  | `Appointment` · `InternalReminder` | Cita · Recordatorio |
  | `RolePermission` | Permiso del rol |
  | `Supplier` · `Branch` | Proveedor · Sucursal |
  | `TrackingToken` | Enlace de seguimiento |
  | Roles `ADMIN` / `ADVISOR` / `TECHNICIAN` | Administración / Asesor / Técnico |

- **Nombres:**
  - Archivos en `kebab-case`; clases y componentes en `PascalCase`; variables en `camelCase`.
  - Tablas de Prisma en `snake_case` plural con `@@map`.
- **Identificadores** (`orderNumber`, `serviceCode`, `folioCode`, `trackingToken`): reglas en especificación §3.1. `orderNumber` **nunca** lleva `@unique`.
- **Catálogo de vehículos** (`data/vehiculos/`):
  - Fuentes editables: `catalogo_vehiculos_mx.csv` y `versiones_vehiculos_mx.csv`.
  - `build_catalog.py` las valida y genera `catalogo_vehiculos_mx.json`. Se corre dentro de `data/vehiculos`: `python -I build_catalog.py . versiones_vehiculos_mx.csv`. **Nunca edites el JSON a mano.**
  - Seed de Prisma: `VehicleMake` → `VehicleModel` (`bodyTypes`, `aliases`) → `VehicleVersion`.
  - El vehículo guarda la referencia **y** una copia del texto.
  - `bodyTypes` decide el diagrama de daños.
  - El km/l se rotula como "rendimiento de referencia".
- **Validaciones de dominio mexicano:**
  - VIN: 17 caracteres, sin I, O ni Q.
  - Teléfono: 10 dígitos.
  - Placas en mayúsculas.
  - RFC: solo el del taller (12 o 13 caracteres).
- **API:**
  - REST bajo `/api/v1`.
  - Errores con forma `{ code, message, details }`.
  - Paginación por cursor en listados grandes.
  - OpenAPI con `@nestjs/swagger`.
- **Migraciones:** siempre con `prisma migrate dev --name <descripcion>`. Las restricciones que Prisma no declara van con `--create-only` y llevan prueba (`docs/modelo-de-datos.md` §4). Nunca edites una migración ya aplicada.

## Design system

- Los tokens se definen en `packages/ui` como variables CSS y en el tema de Tailwind:
  - `--brand-red: #9C2327` (primario)
  - `--charcoal: #232222` (texto)
  - `--bone: #F2F1EF` (fondo)
  - `--brand-red-hover: #7A0C12`, `--brand-red-light: #B8292E`, `--brand-red-subtle: #FBEAEA`, `--brand-red-on-dark: #F26B6F`
  - Contrastes clave en especificación §1.4.
- Los colores semánticos son independientes del rojo de marca: éxito `#15803D`, advertencia `#B45309` (no `#D97706`, que no da contraste con texto blanco), error `#DC2626`, info `#2563EB`.
- **Dinero:** la utilidad va en verde (positivo) y todo egreso en rojo. Las gráficas de egresos usan solo rojos y naranjas distinguibles entre sí (`--eg-1`…`--eg-8`). Lo cobrado es un ingreso y nunca va en rojo.
- **Reglas de contraste (WCAG AA mínimo):**
  - `#9C2327` **nunca** como texto sobre oscuro (2.03:1). Sobre oscuro, el rojo va como relleno o barra indicadora, o se usa `--brand-red-on-dark`.
  - Las tarjetas blancas sobre `bone` siempre llevan borde (`#E3E1DD`).
  - Los estados nunca dependen solo del color: siempre llevan ícono y texto.
  - Proporción de uso 60/30/10 (bone y blanco / charcoal / rojo). El rojo se reserva para la acción principal de cada pantalla.
- **Tipografía:** Inter o Poppins en la UI; Oswald en acentos y KPIs; Cinzel en marca, PDF y portal.
- **Layout del ERP** (referencia del cliente: `color/fortaleza_servicar_dashboard.html`; implementado en `prototipo/`):
  - **Barra lateral oscura** (`#1E1E1E`) con tarjeta de usuario y foto, y grupos de navegación resaltados, cada uno con su color: Principal, Taller, Gestión, Administración y Próximamente. Ítem activo: fondo translúcido + barra a la izquierda.
  - **Cabecera blanca** con búsqueda, campana de notificaciones, estado del taller y la acción primaria **roja** (Nueva recepción).
  - Trabajo en una hoja blanca con borde de 1px sobre `bone`; tarjetas de indicadores con ícono, borde sutil y sin sombra.
  - En el dashboard, los paneles de cada fila tienen la misma altura, sin huecos, y cada elemento lleva a su detalle.
  - **Tres temas** por `data-theme`: Rojo (por defecto, `#9C2327`), Oscuro (`#0D0D0D`, primario `#C52A36`) y Claro (`#C0392B`). Todo color sale de variables CSS; nunca hardcodeado en componentes.
  - El botón primario es **rojo** (blanco sobre `#9C2327` da 7.8:1); el carbón queda para la tinta y la barra lateral.
  - **Diagrama de daños:** 5 vistas SVG por carrocería (lados, superior, frente y atrás) y 4 tipos de daño (rayón, golpe, estrellado y faltante), cada uno con color **y letra**. El inventario de daños exige marcar zonas o confirmar "sin daños".
- **Uso en la tablet del taller** (recepción y diagnóstico): botones táctiles de al menos 44 px. El dispositivo de prueba es un Galaxy A11 (360 px).
- Prohibido:
  - Banners promocionales y elementos flotantes que tapen contenido.
  - Botones deshabilitados que no expliquen qué falta.
  - Checklists que arranquen ya marcados como "Bien".
  - Gráficas sin estado vacío.

## Comandos

Hoy existe uno: `docker compose up --build -d`, que levanta la versión de prueba del prototipo en http://localhost:8080 (`docker/prototipo.Dockerfile`). Estos son los planeados para la fase 1:

```bash
pnpm install
docker compose up -d            # postgres, minio, mailpit
pnpm dev                        # api + web + portal en paralelo
pnpm --filter api prisma migrate dev
pnpm lint && pnpm typecheck && pnpm test
docker compose up --build       # stack completo en contenedores
```

Mantén esta sección al día en cuanto existan los scripts reales.

## Flujo de trabajo con Claude

- Trabajamos **por partes**: una fase o módulo por vez. Propón el plan antes de escribir mucho código.
- Antes de crear un módulo nuevo, revisa especificación §2 y confirma su responsabilidad y sus dependencias.
- **Pruebas:**
  - Toda regla de negocio nueva lleva su prueba unitaria, sobre todo los cálculos financieros.
  - Fixtures: las 4 órdenes del Excel (2752, 2824, 2825 y 2826).
    - Con la fórmula del Excel deben dar sus utilidades exactas.
    - Con la regla vigente (horas antes de la comisión, comisión con IVA) se documenta la diferencia por orden.
- Las preguntas abiertas de especificación §6 son **supuestos pendientes**. Si una decisión depende de ellas, señálalo en lugar de inventar la respuesta.
- No hagas commit ni push sin que el usuario lo pida.
