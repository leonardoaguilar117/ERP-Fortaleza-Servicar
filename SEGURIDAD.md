# Seguridad — Fortaleza Servicar ERP

Consideraciones de seguridad que deben estar resueltas **antes de escribir código**. Cada punto explica *qué protege*, *por qué importa en este taller* y *cómo se implementa*. Las reglas de negocio están en `docs/especificacion.md` §3 y las reglas de desarrollo en `CLAUDE.md`.
---

## 0. Resumen: las 10 prioridades
| # | Prioridad | Riesgo que evita |
|---|---|---|
| 1 | **Autorización en el servidor según los permisos de cada rol y la sucursal**, incluso por campo (por defecto, el técnico no ve costos ni utilidad) | Que un empleado vea o cambie lo que no le corresponde |
| 2 | **Portal del cliente con token aleatorio + OTP para autorizar** | Que alguien adivine un enlace y vea o autorice el servicio de otro |
| 3 | **Contraseñas con Argon2id, sesiones cortas y MFA para Administración** | Robo de cuentas, sobre todo en tablets compartidas |
| 4 | **Datos personales conforme a la LFPDPPP** (aviso de privacidad, consentimiento, derechos ARCO) | Sanciones de la autoridad de protección de datos (desde 2025, la Secretaría Anticorrupción y Buen Gobierno, que sustituyó al INAI) y pérdida de confianza |
| 5 | **Archivos privados** (fotos de perfil y respaldos) con URLs firmadas de corta duración y sin metadatos GPS; **firma de recepción íntegra** (trazos con hash) | Fuga de fotos o de la ubicación de los empleados, y firmas alteradas |
| 6 | **Respaldos automáticos y probados** (PITR + volcado diario cifrado) | Pérdida de la operación del taller |
| 7 | **Secretos fuera del repositorio** y BD sin acceso público | Toma de control total del sistema |
| 8 | **Bitácora de auditoría inmutable** de precios, pagos, gastos, permisos y cancelaciones | Fraude interno y discusiones sin evidencia |
| 9 | **Cabeceras y defensas web** (CSP, HSTS, CSRF, CORS, rate limiting) | XSS, secuestro de sesión y fuerza bruta |
| 10 | **Dependencias e imágenes Docker actualizadas** y escaneadas en CI | Vulnerabilidades conocidas de terceros |
---

## 1. Modelo de amenazas
**Qué protegemos (activos)**
- Datos personales de clientes: nombre, teléfono y correo. Datos de empleados: contacto, foto de perfil y firma de recepción.
- Datos del vehículo: VIN, placas e historial de servicios.
- Información financiera: precios, costos, utilidad, pagos, comisiones, gastos y saldos de las cuentas.
- Documentos: formato PROFECO y recepción firmada por el técnico.
- La disponibilidad del sistema: si se cae, el taller no puede recibir autos.

**De quién lo protegemos**
| Actor | Ejemplo |
|---|---|
| Atacante externo | Bots que prueban contraseñas o explotan vulnerabilidades conocidas |
| Cliente curioso | Cambia el token del enlace de seguimiento para ver otros autos |
| Empleado con permisos de más | Un técnico consulta la utilidad, o alguien borra un pago |
| Dispositivo perdido o compartido | Tablet del taller olvidada con la sesión abierta |
| Tercero que reenvía un enlace | El cliente reenvía su enlace o su QR impreso termina en el auto |
---

## 2. Autenticación del personal
- **Contraseñas** con **Argon2id** (memoria ≥ 19 MiB, t=2, p=1). Mínimo 10 caracteres y verificación contra listas de contraseñas filtradas (k-anonymity de HIBP o lista local). No se fuerzan rotaciones periódicas.
- **MFA (TOTP)** obligatorio para *Administración* y opcional para los demás roles. Se entregan códigos de recuperación de un solo uso.
- **Sesiones**:
  - Access token JWT de **15 minutos**, solo en memoria del navegador.
  - Refresh token de **7 días** en cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`. Es **rotativo**: si se detecta reuso de un refresh token viejo, se invalida toda la familia de sesiones.
  - Los refresh tokens se guardan **hasheados** en la BD, así que se pueden revocar desde "cerrar sesión en todos los dispositivos".
- **Tablets compartidas** en recepción y diagnóstico:
  - Bloqueo por **inactividad a los 10 min** con reingreso rápido por PIN de 6 dígitos ligado al usuario.
  - Cada acción queda a nombre de quien la hizo. No existen usuarios genéricos ("taller", "recepción").
- **Fuerza bruta**:
  - Rate limiting por IP y por usuario.
  - Bloqueo progresivo: 5 intentos fallidos llevan a esperas crecientes.
  - Mensaje genérico "usuario o contraseña incorrectos".
- **Alta y baja de personal**: al dar de baja a un empleado se revocan sus sesiones de inmediato. Nunca se borra el usuario, se desactiva, para conservar la auditoría.

## 3. Autorización (lo más importante)

- **Permisos en el servidor**: guard de NestJS por endpoint con permisos explícitos (`folios.status`, `payments.create`, `finance.costs`…). La UI oculta botones, pero **la seguridad la decide la API**.
- **Permisos editables**: Administración decide qué puede hacer cada rol (tabla `RolePermission`). El servidor lee esa tabla en cada petición (con caché corta), respeta las dependencias entre permisos y nunca le quita a Administración "Empleados y roles". Cada cambio va a la auditoría con el valor anterior y el nuevo.
- **Aislamiento por sucursal**:
  - Toda consulta filtra por `branchId` mediante un interceptor o *Prisma client extension*.
  - Una prueba automatizada verifica que ningún endpoint devuelve datos de otra sucursal.
- **Seguridad por campo**: los DTO de respuesta se arman según los permisos del rol. Sin "ver costos" se omiten costo, utilidad y proveedor; sin "ver importes", también precios y pagos.
  - No basta con "ocultarlo en el front": el JSON no debe traer esos campos.
- **IDOR (acceso por ID ajeno)**:
  - Los IDs internos son UUID/ULID, no consecutivos.
  - Siempre se valida que el recurso pertenezca a la sucursal y, en el portal, al cliente del token.
  - El `orderNumber` repetible **nunca** se usa como llave de acceso.
- **Acciones críticas** que requieren permiso especial y **motivo obligatorio**:
  - Descuentos mayores a X %.
  - Cancelar una orden.
  - Reabrir una orden cerrada.
  - Revertir un pago.
  - Editar precios ya autorizados.
  - Anular un gasto o un movimiento, o editar la compra de un folio entregado.

## 4. Portal del cliente

- **Token de seguimiento**:
  - Se genera con 128 bits o más de aleatoriedad criptográfica (`crypto.randomBytes`) en base62.
  - Se guarda **hasheado** (SHA-256) en la BD, así que una fuga de la BD no expone enlaces válidos.
  - Caduca **30 días después de la entrega** y se puede **revocar o regenerar** desde la orden (por ejemplo, si el cliente perdió el QR impreso).
- **Lectura y acción son niveles distintos**:
  - Con el enlace se puede **ver** el estatus de cada carro de la orden, la cotización y los pagos.
  - Para **autorizar** la cotización se pide un **OTP de 6 dígitos** enviado por SMS al teléfono registrado. Vale 5 minutos, admite 5 intentos y se registra en la auditoría con IP y user-agent.
- **Datos mínimos**:
  - El portal nunca muestra costos internos, utilidad, proveedor, notas internas ni datos de otros clientes.
  - El teléfono y el email aparecen enmascarados (`55•••••812`).
- **Cabeceras propias del portal**:
  - `X-Robots-Tag: noindex` y `Referrer-Policy: no-referrer`, para que el token no se filtre a sitios externos.
  - El token se intercambia en la primera carga por una cookie de sesión del portal y se retira de la URL visible.
- **Rate limiting estricto** en `/public/*`: por IP y por token, con respuesta 404 uniforme ante tokens inválidos para no dar pistas.

## 5. Datos personales y cumplimiento legal (México)

- **LFPDPPP**: la Ley Federal de Protección de Datos Personales en Posesión de los Particulares es la versión vigente desde marzo de 2025.
  - **Aviso de privacidad** (integral y simplificado) visible en el portal y en el contrato de recepción. Debe indicar finalidades, transferencias y medios para ejercer derechos.
  - **Consentimiento** para enviar el enlace por WhatsApp y el recordatorio por correo. Se registra con fecha y canal, y el cliente puede revocarlo.
  - **Derechos ARCO** (acceso, rectificación, cancelación, oposición): el administrador debe poder exportar los datos de un cliente y **anonimizarlos**. Se anonimizan en lugar de borrarse cuando hay obligaciones fiscales de conservación.
  - **Minimización**: solo se capturan los datos que el taller usa. No se piden RFC ni dirección del cliente, porque no hay facturación.
- **Conservación**: los registros de pagos, gastos y compras se conservan **5 años** (Código Fiscal de la Federación, art. 30).
- **PROFECO (NOM-174-SCFI-2007)**: el contrato de adhesión debe incluir los datos completos del prestador (RFC, domicilio, teléfono, horarios). El sistema **impide emitirlo** mientras falten esos datos en la configuración.

## 6. Seguridad de la aplicación web y la API

| Amenaza | Defensa |
|---|---|
| Inyección SQL | Prisma con consultas parametrizadas. Prohibido `$queryRawUnsafe`; `$queryRaw` solo con *tagged templates* |
| Entrada maliciosa o incompleta | Validación **Zod** en cada endpoint (body, query, params). Límites de tamaño: 1 MB en JSON |
| XSS | React escapa por defecto. Prohibido `dangerouslySetInnerHTML` con datos de usuario. **CSP** estricta (`default-src 'self'`, sin `unsafe-inline` en scripts) |
| CSRF | Cookies `SameSite=Strict` + token anti-CSRF (double submit) en los endpoints autenticados por cookie |
| CORS | Lista blanca explícita: solo los dominios del ERP y del portal |
| Cabeceras | `helmet`: HSTS (1 año, includeSubDomains), `X-Content-Type-Options`, `frame-ancestors 'none'` (anti-clickjacking) |
| Fuerza bruta y abuso | `@nestjs/throttler` global, con límites más estrictos en login, OTP y `/public/*` |
| Fuga de información en errores | Respuestas `{ code, message }` sin stack traces. El detalle va solo a los logs |
| Enumeración | Mensajes uniformes en login, recuperación de contraseña y tokens inválidos |
| PDF malicioso | Los PDF se generan en el servidor desde plantillas propias. El texto del usuario se inserta como texto, nunca como HTML |

## 7. Archivos y firma

- No hay fotos de vehículos (especificación §1.3). Los únicos archivos son las **fotos de perfil** de los empleados y los **respaldos**.
- Bucket **privado** en R2: nada es público.
- **Subida directa con URL prefirmada** (PUT) que limita el tipo MIME (`image/jpeg`, `image/png`, `image/webp`), el tamaño (≤ 5 MB) y caduca en 5 min.
- Después de subir, un job (pg-boss) **valida los bytes reales** (*magic bytes*), **re-codifica** con `sharp` a 256 px (neutraliza archivos manipulados) y **elimina EXIF/GPS**.
- La descarga es con **URL firmada de corta duración** (≤ 10 min), emitida solo tras verificar los permisos.
- **Firma de recepción:** se guarda en la base como trazos comprimidos, con hash SHA-256 de trazos + folio + técnico + hora (especificación §3.3). No se puede modificar; al leerla se recalcula el hash y, si no coincide, se marca como alterada.
- Los PDF (formato PROFECO) se generan al pedirlos, desde los datos; no se almacenan.

## 8. Secretos e infraestructura

- **Secretos** solo en variables de entorno del proveedor: JWT, BD, R2, proveedor de correo y de SMS, Sentry.
  - Nunca en el repo: `.env` va en `.gitignore`, y `.env.example` lleva solo nombres y valores ficticios.
  - Escaneo de secretos en CI (gitleaks).
- **Entornos separados**: *staging* y *producción* no comparten BD, bucket ni secretos.
- **Base de datos**:
  - Sin acceso público: se conecta por la red interna del proveedor.
  - Si hay que habilitar la conexión externa para soporte, se restringe por IP y se cierra al terminar.
  - El usuario de la app no es superusuario.
- **TLS en todo**: HTTPS forzado (Render/Railway emiten el certificado) y HSTS.
- **Docker**:
  - Imagen base mínima (`node:22-slim` con versión fija) y build multi-etapa sin herramientas de compilación en la imagen final.
  - El proceso corre como usuario **no root**, con `NODE_ENV=production`.
- **Dependencias**:
  - `pnpm audit` y Dependabot/Renovate semanal.
  - Escaneo de la imagen (Trivy) en CI.
  - Lockfile versionado.
  - Las dependencias nuevas requieren justificación (ver `CLAUDE.md`).

## 9. Respaldos y continuidad

- **PITR administrado** del proveedor: 3 días en Render Hobby, 7 en Render Pro.
- **Volcado diario** (`pg_dump`) **cifrado** (age) a un bucket de R2 **distinto** del de fotos de perfil. Retención: 30 diarios + 12 mensuales.
- **Versionado** del bucket de respaldos, para recuperarse de un borrado accidental.
- **Prueba de restauración mensual** en staging. Un respaldo que nunca se ha restaurado no cuenta.
- Objetivos: **RPO ≤ 24 h** (≤ minutos con PITR) y **RTO ≤ 4 h**.

## 10. Auditoría, monitoreo y fraude interno

- **Bitácora de auditoría** *append-only* (sin UPDATE ni DELETE para el usuario de la app). Registra quién, cuándo, desde dónde, el valor anterior y el nuevo, y el motivo, en:
  - precios y descuentos;
  - cambios de estatus;
  - pagos y reversos;
  - gastos, compras y movimientos (edición y anulación);
  - cancelaciones;
  - cambios de permisos;
  - inicios de sesión (exitosos y fallidos);
  - autorizaciones desde el portal.
- **El dinero no se borra**: los pagos se revierten con un movimiento contrario; los gastos y los movimientos se anulan con motivo y siguen en la base.
- **Monitoreo**:
  - Sentry para errores, con **depuración de datos personales** (scrubbing de teléfono, email, RFC y tokens).
  - Logs JSON (Pino) sin contraseñas, tokens ni OTP.
  - Alertas por picos de logins fallidos, errores 5xx y caída del healthcheck.

## 11. Mensajes al cliente

- **WhatsApp:** solo el enlace de seguimiento, por `wa.me`. Sin datos sensibles ni montos.
- **SMS:** solo el código para autorizar en el portal.
- **Correo** (recordatorio de servicio, en espera): con **SPF, DKIM y DMARC** en el dominio y un enlace para darse de baja.
- Siempre se usa **el mismo dominio**, comunicado al cliente, para que reconozca enlaces falsos.
---

## 12. Checklist antes de salir a producción

- [ ] Pruebas automatizadas de autorización: un rol sin permiso recibe 403, otra sucursal recibe 404 y el técnico no recibe campos financieros.
- [ ] Portal: el token inválido da 404 uniforme; el OTP es obligatorio para autorizar; hay rate limiting.
- [ ] MFA activo en todas las cuentas de Administración.
- [ ] Aviso de privacidad publicado y consentimiento de notificaciones capturado.
- [ ] Datos del prestador completos (razón social, RFC, domicilio, teléfono, horarios) antes de emitir PROFECO.
- [ ] Bucket privado, URLs firmadas y EXIF eliminado de las fotos de perfil (verificado con una foto real con GPS).
- [ ] Un cambio de permisos se aplica en el servidor y queda en la auditoría; Administración no puede quitarse "Empleados y roles".
- [ ] Cabeceras revisadas (securityheaders.com en A o superior) y CSP sin `unsafe-inline` en scripts.
- [ ] Secretos rotados respecto a staging y gitleaks en verde.
- [ ] Respaldo diario funcionando y **una restauración probada**.
- [ ] Imagen Docker no root, sin vulnerabilidades críticas (Trivy).
- [ ] Sentry con scrubbing de datos personales y alertas configuradas.

## 13. Respuesta a incidentes (mínima)

1. **Contener**: revocar sesiones y enlaces del portal afectados, rotar secretos y, si es necesario, poner la app en mantenimiento.
2. **Evaluar** con la bitácora de auditoría y los logs: qué datos, cuántos clientes, desde cuándo.
3. **Notificar**: la LFPDPPP obliga a informar a los titulares cuando una vulneración afecte de forma significativa sus derechos. Hay que preparar una plantilla de aviso.
4. **Corregir y documentar** la causa raíz en `docs/incidentes/`.