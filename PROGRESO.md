# PROGRESO — bandera de reinicio de sesión

> **Una sesión nueva lee este archivo primero.** Dice en qué se quedó el trabajo y cuál es el siguiente paso exacto. Al terminar cada tarea, actualízalo. Las decisiones de negocio **no** van aquí: viven en `docs/especificacion.md` §3.

**Última actualización:** 2026-10-29.
**Estado:** fase 0. Documentación consolidada (una sola fuente por tema), esquema de datos reescrito y validado, y prototipo navegable con todas las pantallas.

## 1. Hecho

| Entregable | Ruta | Estado |
|---|---|---|
| Alcance, reglas de negocio, arquitectura, hosting, preguntas abiertas | `docs/especificacion.md` | ✅ Consolidado el 2026-10-29 |
| Esquema de datos | `docs/schema.prisma` | ✅ Orden 1─N Folio, permisos, cuentas, gastos, citas, servicios tabulados. Pasa `prisma validate` 6.19 |
| Reglas → tablas y restricciones SQL | `docs/modelo-de-datos.md` | ✅ |
| Seguridad | `SEGURIDAD.md` | ✅ Alineado: sin facturación ni fotos de vehículo, permisos editables, firma en trazos |
| Reglas de desarrollo | `CLAUDE.md` | ✅ |
| Catálogo de vehículos (416 modelos, 255 con versiones) | `data/vehiculos/` | ✅ |
| Prototipo sin backend | `prototipo/` | ✅ Pantallas y rutas en especificación §7.2 |

**Respaldo** de la documentación anterior a la consolidación: `../Fortaleza Servicar - respaldo docs 2026-10-29/`, fuera del proyecto. Incluye el informe `decisiones-arquitectura.md`, ya integrado en especificación §4, y `prototipo/js/charts.js`, que ya no se usaba.

## 2. Siguiente paso exacto (retomar aquí)

1. **Alinear el prototipo con el modelo de especificación §3** (con datos fijos):
   - una orden con dos folios y estatus por carro;
   - varios técnicos por folio;
   - pantalla de firma del técnico en la recepción (trazos);
   - pagos con MercadoPago 2.9 % y BBVA 2.1 % más el IVA de la comisión, y la comisión como egreso en Bancos;
   - catálogo de servicios tabulados en la cotización;
   - editar o revertir pagos dentro de la orden;
   - pantalla para consultar la bitácora de cambios (`FS.auditoria`).
2. Revisar el prototipo a 360 px (Galaxy A11): Balance, Bancos, Empleados, Citas y el panel de notificaciones.
3. Respuestas del cliente a especificación §6, sobre todo: número de orden, horas tabuladoras, reparto de pagos entre folios, hosting y categorías de gasto.
4. Después: fase 1 (monorepo, Docker, CI, auth y permisos). Copiar `docs/schema.prisma` a `apps/api/prisma/` y escribir las restricciones de `docs/modelo-de-datos.md` §4.

**En espera por decisión del usuario:** recordatorio de servicio por correo (requiere aprobar un proveedor de correo).

## 3. Prototipo: cómo correrlo y probarlo

- **Servir:** `cd prototipo && python -m http.server 8765 --bind 127.0.0.1`, y abrir `http://127.0.0.1:8765/index.html`.
- **Portal de prueba:**
  - `portal.html#k7Qw2mZ9pL4xT8vR`, código `482913`.
  - Otros estatus: `#QaZN4gbzMO4TXqmL` (por autorizar), `#M0Z9imt1uwMPPyuP` (diagnóstico), `#YUDhukplQmyTnuqn` (reparación), `#Tw6N5SENFQlNcOF1` (esperando refacción), `#BAmvVKMpZohrqO1Z` (listo) y `#dUYLLu0vZABVUg7x` (entregado).
- **Archivos:**
  - `js/datos.js`: las 4 órdenes del Excel, con `console.assert` de sus utilidades.
  - `js/datos3.js`: compras, gastos y citas.
  - `js/datos4.js`: cuentas, movimientos, empleados y permisos.
  - `js/app.js`: router, dashboard, órdenes, detalle, recepción y notificaciones.
  - `js/fase3.js`: citas, gastos y compras, y reportes.
  - `js/fase4.js`: balance, bancos y empleados.
  - `css/fase4.css`: secciones del menú, colores del dinero (`.v-pos`, `.v-neg`, `--eg-*`) y Administración.
- **Inspección visual:**
  - `node ~/.claude/skills/taste-skill/scripts/inspect.mjs --app "<url>" --out .taste-skill/<nombre>`.
  - Corre **una pantalla a la vez**: el usuario canceló una corrida larga.
  - Para pruebas de clic sin Playwright, usar `~/.claude/skills/taste-skill/scripts/lib/cdp.mjs`.
- **Datos guardados en el navegador:** `fs-permisos`, `fs-foto-<id>`, `fs-tema` y `fs-rol` en `localStorage`.

## 4. Notas de entorno

- Python: `L:/Python/python.exe` (tiene graphify). Node v24. Prisma se valida con `npx -y prisma@6.19.0 validate --schema docs/schema.prisma` (requiere `DATABASE_URL` de prueba).
- Herramientas de diseño: taste-skill en `~/.claude/skills/taste-skill`.
- El proyecto **no es un repositorio git**: antes de reescribir documentos, respaldar fuera del proyecto.
- En la herramienta Bash, los heredoc de Python con comillas invertidas fallan. Escribir el script a un archivo del scratchpad y ejecutarlo.
