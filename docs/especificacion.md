# Fortaleza Servicar ERP · Especificación

ERP a la medida para **Fortaleza Servicar**, taller de servicio automotriz. Sustituye la hoja de cálculo con la que opera hoy (`excelOperacionEjemplo.xlsx`) y el intento fallido con **MecanicaMX**. Cubre el ciclo del carro en el taller, la administración del dinero y un **portal de seguimiento** para el cliente.

> **Manda el Excel, no MecanicaMX.** De MecanicaMX solo se toman elementos sueltos (flujo de recepción, formato PROFECO, seguimiento por enlace). Lo demás se diseña sobre lo que el taller ya mide.

**Estado:** fase 0 (análisis). Hay un prototipo navegable sin backend (`prototipo/`); todavía no hay código de producción.

**Documentos y su papel (cada tema vive en un solo lugar):**

| Documento | Contenido |
|---|---|
| `docs/especificacion.md` | Este documento: alcance, **reglas de negocio (§3, única fuente)**, arquitectura, hosting, hoja de ruta y preguntas abiertas |
| `README.md` | Presentación del repositorio y cómo correr el prototipo |
| `docs/schema.prisma` | Esquema de la base de datos. Pasa `prisma validate` (Prisma 6.19) |
| `docs/modelo-de-datos.md` | Cómo cada regla de §3 queda en las tablas y qué restricciones van en SQL |
| `SEGURIDAD.md` | Requisitos de seguridad, obligatorios desde la fase 1 |
| `CLAUDE.md` | Reglas para desarrollar en este repositorio |
| `PROGRESO.md` | Bandera de reinicio: qué está hecho y el siguiente paso exacto |

---

## 1. Contexto

### 1.1 Cómo opera hoy el taller (Excel)

Una sola hoja donde **cada orden ocupa un bloque de filas**: la fila principal lleva cliente, vehículo y totales, y las sub-filas cada trabajo o refacción.

| Grupo | Columnas | Observaciones |
|---|---|---|
| Identificación | ORDEN, FECHA INGRESO, DÍAS EN TALLER, FECHA DE ENTREGA | Número consecutivo (el último es 2826). Días = entrega − ingreso, mínimo 1 |
| Cliente | NOMBRE, TELÉFONO | Sin RFC, correo ni dirección |
| Vehículo | MARCA, MODELO, AÑO, COLOR, SERIE (VIN), PLACAS, KM | |
| Trabajo | TRABAJO A REALIZAR, TRABAJOS AUTORIZADOS, COSTO DE LOS SERVICIOS, TOTAL SERVICIO, STATUS | Trabajos en texto libre |
| Refacciones | REFACCIÓN (descripción + nº de parte), COSTO, FACTURA/REMISIÓN, PROVEEDOR, FECHA COMPRA | Proveedores: MORALES, PUEBLA, SAYM y ALMACÉN (refacciones propias) |
| TOT | TOT, COSTO, FACTURA, PROVEEDOR, FECHA | Trabajo en otro taller o gasto externo, p. ej. "GASOLINA $145" |
| Personal | TÉCNICO, ASESOR | Técnicos: Daniel, Christoper, Alexander. Asesor: Pablo |
| Cobro | VENTA DEPÓSITO/TRANSFERENCIA, VENTA EFECTIVO, COMISIÓN TARJETA, OBSERVACIONES | Los anticipos van en observaciones |
| Rentabilidad | HORAS TABULADORAS (vacía), HORAS MO, UTILIDAD MO, UTILIDAD REFACCIONES, UTILIDAD | Fórmulas en §3.4 |

**Dolores:** sin historial por cliente ni por carro, captura duplicada, fechas y columnas inconsistentes, anticipos sin control, sin catálogo de proveedores, sin comunicación con el cliente y fórmulas frágiles.

### 1.2 MecanicaMX: qué se toma y qué no

Se analizaron 21 capturas (`screenshotsFuncionamiento/`).

- **Se toma el flujo:** cita → recepción → diagnóstico → cotización → autorización → reparación → terminado → entrega.
- **También:** recepción con inventario y diagrama de daños, formato PROFECO, tablero por estatus, seguimiento por enlace, citas con acciones pendientes, compras ligadas a la orden.
- **Errores que no se repiten:**
  1. Estados duplicados (Borrador/Orden, Status, Autorizado, Cerrar, tareas aprobadas). Aquí hay una sola máquina de estados.
  2. Dos identificadores sin reglas claras. Aquí cada uno tiene su función (§3.1).
  3. Sin validación (VIN "7" aceptado, versión no ligada al modelo).
  4. Checklist que arranca en "Bien".
  5. Diagrama de daños que siempre muestra un sedán.
  6. Idiomas mezclados, gráficas vacías con eje negativo, banners y chat flotante.
  7. PDF PROFECO con datos del prestador incompletos.
  8. Guardar deshabilitado sin decir qué falta.
  9. Funciones genéricas que no reflejan la rentabilidad que el dueño mide en su Excel.

### 1.3 Fuera de alcance

Decisiones del cliente que no se reabren:

- **Inventario** y **venta de productos**. Las refacciones son un concepto dentro del folio; "Almacén propio" es un proveedor más, sin existencias.
- **Facturación** en la plataforma (CFDI), **cobro con terminal** y **paquetes de precios**.
- **Fotos** de recepción, diagnóstico y avance. La única imagen del sistema es la foto de perfil del empleado.
- **Mensajes por WhatsApp** más allá del enlace de seguimiento.

### 1.4 Identidad visual

- El taller se llama **Fortaleza Servicar**. *Lugo Servicar* es el nombre anterior y no aparece en ningún lado. Las imágenes `img/6-8` llevan la marca anterior: solo sirven como referencia de estilo.
- **Paleta oficial** (`color/color1.png`): rojo vino `#9C2327`, carbón `#232222` y hueso `#F2F1EF`.
- El layout del ERP sigue `color/fortaleza_servicar_dashboard.html`: barra lateral oscura, cabecera blanca, acción primaria roja y tres temas (Rojo, Oscuro, Claro). Los tokens, los contrastes y las reglas de uso están en `CLAUDE.md`, "Design system".

**Contrastes que deciden reglas (WCAG 2.1):**

| Combinación | Ratio | Consecuencia |
|---|---|---|
| Blanco sobre `#9C2327` | 7.83 | Botón primario rojo con texto blanco |
| `#9C2327` sobre `#F2F1EF` | 6.93 | El rojo sirve como texto sobre claro |
| `#9C2327` sobre `#232222` | **2.03** | Nunca texto rojo sobre oscuro: ahí se usa `#F26B6F` (5.37) |
| Blanco sobre `#D97706` | 3.19 | La advertencia es `#B45309` (5.02) |
| Blanco `#FFFFFF` sobre hueso | 1.13 | Las tarjetas blancas siempre llevan borde |

**Tipografía:** Inter o Poppins en la UI, Oswald en acentos y cifras, Cinzel en marca, PDF y portal. **Contacto del taller:** WhatsApp 55 7619 5812.

---

## 2. Módulos

Monolito modular: cada módulo es dueño de sus tablas y se comunica con los demás por servicios públicos o eventos.

| # | Módulo | Responsabilidad | Fase |
|---|---|---|---|
| M01 | Auth, usuarios y permisos | Login, sesiones, MFA, roles y **permisos editables por rol**, sucursal | 1 |
| M02 | Configuración | Datos del prestador (PROFECO), IVA, margen de refacciones, tarifa por hora, comisiones, límites de avisos, intervalo del recordatorio, consecutivo sugerido | 1 |
| M03 | Clientes y vehículos | Cliente con sus carros; catálogo Marca → Modelo → Versión (`data/vehiculos/`); historial de servicios | 2 |
| M04 | Órdenes y folios *(núcleo)* | Orden con uno o varios folios, máquina de estados por folio, asignación de técnicos, tablero | 2 |
| M05 | Recepción | Inventario de accesorios, km, combustible, diagrama de daños por carrocería, falla reportada, **firma del técnico**, formato PROFECO | 2 |
| M06 | Diagnóstico | Plantillas por sistema, resultado por punto y nota | 2 |
| M07 | Cotización | Mano de obra desde el **catálogo de servicios tabulados**, refacciones y TOT como concepto; autorización en el taller o en el portal | 2 |
| M08 | Pagos | Anticipos y liquidaciones registrados por método, con su comisión; reversos | 2 |
| M09 | Portal del cliente | Seguimiento por enlace: estatus de cada carro, cotización, autorización, pagos e historial | 2 |
| M10 | Citas y avisos | Agenda, recordatorios internos, entrega ligada al folio, avisos de carros detenidos, recordatorio por correo | 3 |
| M11 | Gastos y compras | Compras de cada folio (por comprar, pendiente, pagada), gastos del taller, proveedores | 3 |
| M12 | Reportes y dashboard | Indicadores del Excel, rentabilidad por orden, técnico y proveedor, exportar a Excel | 3 |
| M13 | Administración | Balance, bancos y flujos por periodo, movimientos editables, empleados | 4 |
| M14 | Auditoría | Bitácora de precios, estatus, pagos, gastos, permisos y cancelaciones | 1 (transversal) |

---

## 3. Reglas de negocio

> **Única fuente.** Ningún otro documento repite estas reglas: las referencian.

### 3.1 Entes e identificadores

```
Cliente 1─N Vehículo
Cliente 1─N Orden (el servicio completo) 1─N Folio (cada carro)
Folio N─1 Vehículo          Orden 1─N Pago          Orden 1─1 Enlace de seguimiento vigente
```

- **Cliente:** se registra una vez y conserva todos sus carros y servicios.
- **Orden:** el servicio completo. Puede llevar **varios carros**. Tiene los pagos y el enlace del portal.
- **Folio:** **cada carro** dentro de la orden. Tiene el estatus, la recepción, el diagnóstico, la cotización, los técnicos, la utilidad y las horas de mano de obra.
- **Carro nuevo de un cliente que ya existe:** se agrega el vehículo al cliente y se abre una orden nueva con su folio. Si trae varios carros a la vez, van como folios de la misma orden.
- La orden **no tiene estatus propio**: muestra su avance a partir de sus folios ("2 de 3 carros listos").

| Identificador | Dónde | Regla |
|---|---|---|
| `orderNumber` | Orden | El número del Excel. Se sugiere el consecutivo (el siguiente es ~2827), es editable y **puede repetirse**. Nunca es llave de acceso |
| `serviceCode` | Orden | `FS-26-000123`, generado por el sistema y único. Es la llave de negocio en búsquedas, PDF y portal |
| `folioCode` | Folio | `FS-26-000123-2`: el código de la orden más el número del carro |
| `trackingToken` | Orden | Token aleatorio del portal, aparte de los anteriores |

### 3.2 Estatus del folio

Una sola máquina de estados, aplicada a cada carro:

```
RECIBIDO ─► EN_DIAGNÓSTICO ─► COTIZADO ─► AUTORIZADO ─► EN_REPARACIÓN ⇄ ESPERANDO_REFACCIÓN
                                                              │
                                                              ▼
                                                         TERMINADO ─► ENTREGADO
Cualquier estatus antes de ENTREGADO ─► CANCELADO (con motivo, también si el cliente rechaza toda la cotización)
```

- No existen banderas paralelas (borrador, cerrado, autorizado). Las **partidas no tienen estatus**: lo autorizado queda como trabajo autorizado y lo rechazado se retira de la cotización y queda en el historial.
- Cada cambio guarda quién, cuándo y cuánto tiempo estuvo en el estatus anterior.
- **Entrega ligada a la cita:** al entregar un folio, su cita de entrega queda como atendida. En la agenda, una cita de entrega se atiende entregando el carro, nunca por separado. Un folio terminado sin cita ofrece agendar la entrega.

### 3.3 Personas, permisos y firma

- **Roles:** Administración (dueño), Asesor y Técnico. **Administración edita qué puede hacer cada rol**: recepción, avanzar estatus, autorizar, citas, ver importes, registrar pagos, ver costos y utilidad, gastos y compras, flujos y reportes.
  - Si un permiso necesita otro, se ajustan juntos. Por ejemplo, Reportes requiere ver costos, que requiere ver importes.
  - Administración conserva siempre "Empleados y roles", para que nadie se quede sin poder corregir los permisos.
  - Cada cambio de permiso va a auditoría.
  - Por defecto, el técnico no ve importes, costos, utilidad, proveedores ni pagos, y el asesor no ve costos ni utilidad.
- **Técnico:** una sola asignación activa a la vez; un folio puede tener **varios técnicos**. Si el carro espera una refacción, la asignación se cierra y se reabre después; el historial la conserva. Por ahora, quien revisa es quien repara.
- **Recepción:** la firma **el técnico que recibe el carro**. "PROFECO" es solo el nombre del formato; no se exige la firma del cliente.
- **Firma como trazos, no como imagen:**
  - Se guardan los puntos de cada trazo como enteros, con diferencias entre puntos y comprimidos (≈ 0.5–1 KB), en la base de datos.
  - Se suma un hash SHA-256 de los trazos, el folio, el técnico y la hora, para detectar alteraciones.
  - Se dibuja como SVG o PNG al mostrarla en pantalla o en el PDF.
  - Se descartaron el SVG en texto (2–4 KB y fácil de editar) y el PNG en almacenamiento de archivos (10–30 KB y obliga a manejar archivos). El valor de los trazos está en la integridad, no en el espacio.
- **Empleados:** alta, cambio de rol y baja lógica. No se da de baja ni se cambia de rol a un técnico con folios abiertos sin reasignarlos antes. La foto de perfil se recorta a 256 px.

### 3.4 Dinero

- **Parámetros fijos del negocio, guardados en configuración:** utilidad de refacciones **30 % del costo** y mano de obra **$400 MXN por hora**.
- **Pagos:** solo se registran; no se cobra desde la plataforma.
  - Métodos: efectivo, transferencia, **MercadoPago (2.9 %)** y **BBVA (2.1 %)**.
  - Cada pago guarda su **fecha**, la tasa vigente ese día, la comisión y **el IVA de la comisión (16 %)**. Así queda registrado cuándo se generó cada comisión. Ejemplo: $1,000 por MercadoPago dan $29.00 de comisión más $4.64 de IVA.
  - Un pago no se borra: se revierte con otro movimiento.
- **La comisión es un gasto del taller:** se resta de la utilidad y no se descuenta al técnico.
- **Fórmulas** (en `packages/shared/src/finance/`; front y back usan la misma función):

  ```
  total                 = suma de la mano de obra vigente del folio
  utilidad_refacciones  = costo_refacciones × 30 %
  utilidad_MO           = cobrado − costo_refacciones − costo_TOT − utilidad_refacciones
  horas_MO              = utilidad_MO ÷ $400              # antes de restar la comisión
  comisión_total        = comisión + IVA de la comisión
  utilidad              = utilidad_MO + utilidad_refacciones − comisión_total
  días_en_taller        = max(1, entrega − ingreso)
  ```

  Los pagos son de la orden y la utilidad es de cada folio. Con varios carros, *cobrado* y la comisión se reparten entre los folios en proporción a su total (**propuesta**, §6).

  En el Excel la comisión se restaba **antes** de calcular las horas, así que las 4 órdenes de ejemplo (2752, 2824, 2825 y 2826) dan más horas con la regla vigente. Las pruebas documentan la diferencia por orden. El prototipo reproduce la fórmula del Excel para validar sus cifras (la 2752 da $14,071.69 y 24.28 h).
- **Servicios tabulados:** catálogo con precio de referencia. Cada partida guarda el precio tabulado de ese día y el precio real, porque pueden variar ligeramente. **Sin paquetes de precios.**
- **Dinero en centavos enteros** y tasas en puntos base (290 = 2.9 %). Nunca `float`.

### 3.5 Administración

- **Cuentas:** caja (efectivo) y bancos, cada una con saldo inicial y fecha de apertura.
- **Ingresos:**
  - los pagos de las órdenes, neto de comisión, en la cuenta donde entraron;
  - los ingresos capturados a mano.
- **Egresos:**
  - las compras pagadas al proveedor;
  - los gastos del taller;
  - los egresos capturados a mano.
- **Traspasos** entre cuentas: mueven el saldo, pero no cuentan como ingreso ni egreso.
- **Compras** (refacciones y TOT de cada folio):
  - *por comprar*: sin fecha de compra;
  - *pendiente de pago*;
  - *pagada*;
  - *consumo propio*: "Almacén propio", no genera pago.
- **Balance por periodo** (hoy, 7 días, mes o fechas elegidas): ingresos, egresos, flujo neto, saldo en cuentas, egresos por categoría y resultado.
  - **Resultado** = utilidad de los folios entregados − gastos del taller. Las compras no se restan otra vez, porque ya están dentro de la utilidad.
  - "Situación a hoy" (caja, bancos, por cobrar y por pagar) no depende del periodo.
- **Lo capturado en Administración se edita** (gastos, compras y movimientos manuales) y queda en auditoría con el valor anterior y el nuevo. Editar una compra recalcula la utilidad de su folio. "Eliminar" es una anulación lógica. Los cobros se corrigen en su orden, con reverso.

### 3.6 Avisos, citas y recordatorios

- **Avisos internos:**
  - carros con **más de 3 días** en el taller;
  - carros que cumplen 3 días hoy;
  - cotizaciones **sin respuesta por más de 24 h**.
  - Los límites están en configuración.
- **Citas:** por confirmar, confirmada, atendida, no llegó y cancelada.
  - Los recordatorios de las citas son internos para el asesor, no mensajes al cliente.
  - La entrega se liga al folio (§3.2).
- **WhatsApp:** solo se envía el enlace de seguimiento, por `wa.me`. El código para autorizar en el portal llega por SMS.
- **Recordatorio de servicio por correo** (*en espera por decisión del usuario*):
  - El intervalo va de 3 a 6 meses: 6 por defecto y cambiable por vehículo.
  - Un trabajo diario a las 9:00 (hora de México) revisa qué vehículos ya lo cumplieron desde su última entrega. Una llave única vehículo + fecha evita duplicados.
  - El envío necesita un proveedor de correo por API, porque Render bloquea SMTP en sus planes gratuitos. Es un servicio nuevo: hay que aprobarlo antes.
  - Cada correo lleva un enlace para darse de baja, y se guarda el consentimiento (LFPDPPP).

### 3.7 Historial que no se pierde

- **Nada se borra:**
  - clientes anonimizados (derechos ARCO);
  - empleados, proveedores y servicios tabulados dados de baja;
  - partidas retiradas;
  - gastos y movimientos anulados;
  - pagos revertidos.
- La auditoría es **de solo inserción**: precios, estatus, pagos, gastos, compras, permisos, cancelaciones, inicios de sesión y autorizaciones del portal.
- El vehículo guarda la referencia al catálogo **y** una copia del texto (marca, modelo, versión, motor), así que cambiar el catálogo no altera el historial.
- La base garantiza la coherencia: llaves foráneas compuestas (el cliente de la orden, del folio y del vehículo es el mismo), `CHECK` de montos y tasas, e índice único parcial para la asignación activa. Detalle en `docs/modelo-de-datos.md`.

### 3.8 Portal del cliente

- **Un enlace por orden:** muestra cada uno de sus carros con su estatus, la cotización, los pagos y el saldo, y el historial de servicios del cliente.
- Nunca muestra costos, utilidad, proveedores ni datos de otros clientes.
- Autorizar exige un código de un solo uso (5 minutos, 5 intentos).

---

## 4. Arquitectura

### 4.1 Criterio

El sistema es **chico en tráfico y grande en reglas**: unos 15 usuarios internos y 60 clientes en el portal en el peor momento, con decenas de órdenes por semana. Cada decisión responde tres preguntas:

1. ¿Las reglas se escriben una sola vez?
2. ¿Agrega un servicio que se paga cada mes?
3. ¿Lo mantiene una persona sola?

### 4.2 Stack

| Capa | Tecnología | Por qué |
|---|---|---|
| Lenguaje | **TypeScript** de punta a punta | Los cálculos de §3.4 se escriben una vez y los usan API, ERP y portal |
| Repositorio | **pnpm workspaces** | Tres apps y paquetes compartidos. Turborepo solo si el build se vuelve lento |
| API | **NestJS 11** (Node 22 LTS) | Sus módulos y guards encajan con el monolito modular y los permisos por rol y por campo |
| Base de datos | **PostgreSQL 16** + **Prisma** | Dominio relacional con integridad fuerte. Lo que Prisma no declara (índice parcial, `CHECK`, permisos de auditoría) va en la migración con `--create-only` y una prueba verifica que exista |
| Validación | **Zod** en `packages/shared` | La misma validación en el formulario y en la API |
| Colas y cron | **pg-boss** dentro de la API | PDF, correos, recordatorios y respaldos **sin Redis** ni worker aparte |
| Actualización en pantalla | Refresco cada 15–20 s con TanStack Query | Con 15 personas se siente en vivo y reutiliza los mismos permisos. Si hace falta tiempo real, Server-Sent Events. Sin Socket.IO |
| ERP | **React 19 + Vite + TanStack Router/Query + Tailwind 4 + shadcn/ui** | Sitio estático, gratis en Render |
| Portal | **React + Vite**, app aparte | Bundle pequeño para celular y ningún código del ERP expuesto |
| PDF | **@react-pdf/renderer** | Plantillas en React **sin Chromium** en la imagen |
| Archivos | **Cloudflare R2**, bucket privado | Respaldos y fotos de perfil (procesadas con **sharp**). Render borra el disco en cada despliegue |
| Auth | JWT corto + refresh rotativo en cookie httpOnly, Argon2id, TOTP | Sin servicios externos (`SEGURIDAD.md` §2) |
| Correo | Proveedor por API (Resend, Brevo o similar) | Solo para el recordatorio de servicio; pendiente de aprobar |
| Observabilidad | Pino, Sentry, `/health` | |
| Pruebas y CI | Vitest, Supertest, Playwright; GitHub Actions con lint, typecheck, test, gitleaks y Trivy | |

**Descartados:** Next.js full-stack (mezcla ERP y portal sin beneficio), Django o Laravel (dos lenguajes), microservicios (sobran para 75 usuarios), Firebase o Supabase (permisos por campo difíciles de auditar). Drizzle se evaluó frente a Prisma: declara mejor las restricciones, pero Prisma es más cómodo para un ERP de formularios. Sigue Prisma salvo que el usuario decida lo contrario (§6).

### 4.3 Repositorio objetivo

```
fortaleza-servicar/
├── apps/
│   ├── api/                 # NestJS: src/modules/<modulo>/ (con domain/ puro), src/jobs/ (pg-boss), prisma/
│   ├── web/                 # ERP del personal
│   └── portal/              # portal del cliente
├── packages/
│   ├── shared/              # Zod, enums, permisos y cálculos financieros (src/finance/)
│   ├── ui/                  # tokens y componentes
│   └── config/              # tsconfig, eslint, prettier
├── data/vehiculos/          # catálogo de vehículos (CSV fuente, JSON generado, build_catalog.py)
├── docker/                  # api.Dockerfile (node:22-slim, no root) y static.Dockerfile (Caddy)
├── docker-compose.yml       # postgres, minio, mailpit, api, web, portal
└── render.yaml
```

Una sola imagen de backend (~200 MB, sin Chromium ni Redis) con migraciones al arrancar (`prisma migrate deploy`) y healthcheck. El mismo Dockerfile sirve para Render, Railway o un VPS.

### 4.4 Hosting, respaldos y capacidad

La base de datos **nunca** va en el mismo contenedor que la API: Render borra el disco en cada despliegue, y reiniciar la API reiniciaría la base.

| | Render (recomendado) | Railway | VPS de Hostinger |
|---|---|---|---|
| Servicios | API + Postgres administrado + 2 sitios estáticos | API + Postgres en contenedor con volumen | `docker compose`: api, postgres con volumen, caddy y backup |
| Costo | ≈ 47 USD/mes, fijo | ≈ 22–30 USD/mes, variable | ≈ 6–10 USD/mes |
| Respaldos | Recuperación a un punto en el tiempo + volcado diario | Volcado diario propio | Volcado diario propio; restaurar a mano toma 1–2 h |
| Mantenimiento | Casi nulo | Bajo | Alto (parches, firewall, caídas) |

- **Render**, una sola factura con estos renglones:
  - workspace Hobby: $0;
  - API Standard (2 GB, 1 CPU): $25;
  - Postgres Basic-1gb: $19 más disco;
  - ERP y portal como sitios estáticos: $0.
  - No usar el plan Free: la API se duerme y la base gratuita se borra a los 30 días.
- **Pendiente:** el cliente decide entre Render y el VPS (§6). *Precios consultados en octubre de 2026; confirmarlos antes de contratar.*
- **Respaldos:**
  - cada noche, `pg_dump` comprimido y cifrado con `age`, subido a R2;
  - se conservan 30 diarios y 12 mensuales;
  - una restauración de prueba corre cada mes y avisa si falla.
- **Capacidad** (sin fotos de vehículo):
  - cada folio ocupa ≈ 10–15 KB con índices;
  - 3 talleres con ≈ 25,000 folios caben en ≈ 0.4 GB, con un crecimiento de ≈ 270 MB al año;
  - los respaldos ocupan ≈ 3.5 GB en R2, dentro de su plan gratuito.
- **Varias sucursales:** un solo despliegue y una sola base, con `branchId` en cada registro. Si crece la carga, se agregan copias de la API.
- **Búsqueda por nombre o placas:** índice `pg_trgm` sobre texto normalizado (sin acentos, espacios ni guiones), 150 ms de espera entre teclas y un máximo de 20 resultados.

### 4.5 Migración del Excel

1. Un script lee el `.xlsx` directo.
2. Genera CSV normalizados por entidad: clientes, vehículos, órdenes, folios, partidas y pagos.
3. Valida y entrega un reporte de errores (placas, duplicados por teléfono, montos vacíos).
4. Se corrige en el Excel y se repite. La carga es idempotente y los CSV quedan como constancia.

Falta el Excel completo: el de ejemplo trae 4 órdenes.

---

## 5. Hoja de ruta

| Fase | Entregable |
|---|---|
| **0. Análisis** *(actual)* | Esta especificación, `SEGURIDAD.md`, `CLAUDE.md`, esquema de datos, catálogo de vehículos y prototipo navegable |
| **1. Fundaciones** | Monorepo, Docker, CI con escaneos, auth y permisos por rol, configuración, design system, seed del catálogo, despliegue |
| **2. Operación del taller** | Clientes y vehículos, órdenes y folios, recepción con firma, diagnóstico, cotización con servicios tabulados, pagos, portal, importación del Excel |
| **3. Gestión** | Citas y avisos, gastos y compras, reportes de rentabilidad, recordatorio por correo (si se aprueba el proveedor) |
| **4. Administración** | Balance, bancos y flujos, movimientos editables, empleados y permisos; nuevas sucursales si el taller crece |

---

## 6. Preguntas abiertas

Son **supuestos pendientes**: si una decisión depende de ellos, se señala en lugar de inventar la respuesta.

1. ¿Se conserva el número de orden del Excel, ahora que existen el código de la orden y el del folio?
2. ¿Qué son las "horas tabuladoras"? La columna viene vacía. Si son las horas de referencia de cada servicio, van en el catálogo tabulado.
3. ¿Qué estatus usan hoy además de "TERMINADO"? Se necesita para mapear la importación.
4. ¿El cliente autoriza desde el portal o solo consulta? El prototipo autoriza.
5. ¿Qué pasa con la comisión si se devuelve un pago con tarjeta? Depende del contrato con MercadoPago y BBVA.
6. ¿Qué regla de redondeo se usa? Propuesta: medio centavo hacia arriba, por pago; la comisión y su IVA por separado.
7. ¿Qué categorías de gasto usan, qué cuentas bancarias tienen y con qué saldos arrancan?
8. ¿Se pagan comisiones a técnicos o asesores por orden?
9. ¿Cuántas órdenes históricas hay que migrar y desde qué año?
10. ¿Qué textos legales lleva su formato PROFECO?
11. Hosting: ¿Render (≈ 47 USD) o VPS de Hostinger (≈ 6–10 USD, con mantenimiento a su cargo)?
12. ¿Prisma o Drizzle? Por defecto, Prisma.
13. ¿Se aprueba un proveedor de correo para el recordatorio de servicio?
14. En una orden con varios carros, ¿los pagos y la comisión se reparten entre los folios en proporción a su total? Es la propuesta de §3.4.

---

## 7. Material de referencia

| Ruta | Contenido |
|---|---|
| `excelOperacionEjemplo.xlsx` | Hoja operativa actual (4 órdenes de ejemplo). **No se publica**: tiene datos de clientes |
| `screenshotsFuncionamiento/` | 21 capturas de MecanicaMX (referencia funcional, no visual). **No se publican** |
| `color/`, `img/` | Paletas, layout de referencia (`fortaleza_servicar_dashboard.html`) y piezas de marca |
| `data/vehiculos/` | Catálogo de vehículos del mercado mexicano (§7.1) |
| `prototipo/` | Prototipo navegable sin backend (§7.2) |
| `graphify-out/` | Grafo de conocimiento del proyecto. **No se publica**: incluye el Excel convertido a texto |

### 7.1 Catálogo de vehículos (`data/vehiculos/`)

| Archivo | Contenido |
|---|---|
| `catalogo_vehiculos_mx.csv` | 45 marcas y **416 modelos** con años de venta en México, carrocerías y alias (Vocho, Lobo = F-150…) |
| `versiones_vehiculos_mx.csv` | **255 modelos** con versiones, motor, cilindros, combustible, transmisiones y rendimiento combinado (km/l) |
| `catalogo_vehiculos_mx.json` | Seed generado. **No se edita a mano** |
| `build_catalog.py` | Valida los dos CSV y genera el JSON: `python -I build_catalog.py . versiones_vehiculos_mx.csv` |

Sirve para:

- autocompletar marca, modelo, año y versión en la recepción;
- elegir el diagrama de daños por carrocería;
- mostrar el **rendimiento de referencia** (valores de la CONUEE, no garantizados) y detectar consumos anormales.

Los modelos salen de los rankings de ventas AMIA/INEGI. El taller puede corregir y ampliar el catálogo.

### 7.2 Prototipo (`prototipo/`)

HTML, CSS y JavaScript sin backend, para validar el flujo con el cliente. Se sirve con `python -m http.server 8765 --bind 127.0.0.1` dentro de `prototipo/` y se abre `index.html`.

| Pantalla | Ruta | Qué demuestra |
|---|---|---|
| Dashboard | `#/dashboard` | Indicadores por periodo, cobrado, flujo por estatus, pendientes; cada elemento lleva a su detalle |
| Órdenes | `#/ordenes` | Lista y tablero por estatus; filtros por estatus, días en taller y técnico |
| Detalle | `#/orden/FS-26-000398` | La orden 2752 del Excel con la cascada cobro → utilidad, la cita de entrega y la entrega |
| Recepción | `#/recepcion` | Catálogo real de vehículos, diagrama de daños por carrocería, inventario sin revisar |
| Citas | `#/citas` | Calendario, acciones pendientes, entrega ligada al folio |
| Gastos y compras | `#/compras` | Compras de las órdenes, gastos, proveedores; todo editable |
| Reportes | `#/reportes` | Rentabilidad por orden, técnico, proveedor y gastos |
| Balance | `#/balance` | Ingresos, egresos, flujo, situación a hoy y resultado por periodo |
| Bancos y flujos | `#/bancos` | Cuentas, movimientos, traspasos; editar y anular |
| Empleados y roles | `#/empleados` | Equipo, foto de perfil y matriz de permisos editable |
| Portal | `portal.html#k7Qw2mZ9pL4xT8vR` | Estatus, cotización sin costos internos y autorización con código `482913` |

- **Notificaciones:** se abren con la campana de la cabecera.
- **"Ver como":** cambia entre Administración, Asesor y Técnico para mostrar los permisos aplicados.
- **Simplificaciones:**
  - cada orden tiene un solo folio;
  - las 4 órdenes del Excel usan su fórmula original para validar las cifras;
  - los permisos, las fotos y los cambios se guardan solo en el navegador;
  - los datos son de muestra; las 4 órdenes del Excel (`js/datos.js`) conservan sus montos, con cliente, placas y VIN ficticios.
