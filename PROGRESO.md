# PROGRESO — bandera de reinicio de sesión

> **Una sesión nueva lee este archivo primero.** Dice en qué se quedó el trabajo y cuál es el siguiente paso exacto. Al terminar cada tarea, actualízalo. Las decisiones de negocio **no** van aquí: viven en `docs/especificacion.md` §3.

**Última actualización:** 2026-11-11.
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
| Prototipo sin backend | `prototipo/` | ✅ Pantallas y rutas en especificación §7.2. 2026-10-30: formateado con Prettier (ancho 120, comillas simples), comentado por secciones, máquina de estados en `js/estados.js`, registro de rutas con permiso y acciones del detalle como tabla de comandos |
| Diagrama de la lógica de negocio | `docs/diagrama-logica-negocio.html` | ✅ Ilustra §3; lo genera un script fuera del repo (SVG con coordenadas calculadas) |

**Respaldo** de la documentación anterior a la consolidación: `../Fortaleza Servicar - respaldo docs 2026-10-29/`, fuera del proyecto. Incluye el informe `decisiones-arquitectura.md`, ya integrado en especificación §4, y `prototipo/js/charts.js`, que ya no se usaba.

**2026-11-11:** el flujo de la orden ya se opera de punta a punta en el prototipo (cotización con tabulados, pagos MercadoPago/BBVA con IVA de la comisión, reversos, técnico, espera de refacción), con guardado en el navegador y sincronía ERP ↔ portal (`js/almacen.js`), bitácora (`#/bitacora`), CSP estricta en `docker/Caddyfile` y emblema 3D en el portal (`js/escena3d.js`, three.js r186 en `prototipo/vendor/three/`). Detalle en `docs/documentacion-tecnica.md`; versión para el taller en `docs/guia-cliente.md`.

**2026-11-11 (segunda parte):** el prototipo ya cubre lo que la hoja de ruta llama fase 2, salvo la importación del Excel:

- una orden con varios carros (`grupo`), avance calculado de sus folios y un solo enlace de seguimiento; el portal deja elegir vehículo;
- técnico responsable y técnicos de apoyo por folio;
- recepción firmada por el técnico (`js/firma.js`: trazos + sello SHA-256, verificado en la orden);
- estatus `CANCELADO` con motivo;
- diagnóstico por sistemas (`#/diagnostico/<folio>`), Clientes (`#/clientes`), Configuración (`#/configuracion`) y hoja imprimible de la orden (`js/fase5.js`, `css/fase5.css`);
- 15 pantallas revisadas a 360 px: sin desborde y con botones de 44 px.

`VERSION` del almacén subió a 2: lo guardado antes en el navegador se descarta solo.

## 2. Siguiente paso exacto (retomar aquí)

1. **Confirmar que Render desplegó bien.** El `Caddyfile` no se pudo validar en local (no hay Docker) y no se conoce la URL del servicio.
2. **Decidir qué hacer con `color/` e `img/`:** están borradas en disco pero siguen en git; el borrado no se ha incluido en ningún commit.
3. **Respuestas del cliente a especificación §6.** Las que hoy frenan algo concreto:
   - reparto de un pago entre los carros de una orden (el prototipo lo anota por carro);
   - reparto de horas entre varios técnicos (los reportes cuentan al responsable);
   - texto del contrato PROFECO (la hoja impresa no lleva cláusulas);
   - mapeo de estatus para importar el Excel;
   - número de orden, hosting y categorías de gasto.
4. **Fase 1** (monorepo, Docker, CI, auth y permisos). Copiar `docs/schema.prisma` a `apps/api/prisma/` y escribir las restricciones de `docs/modelo-de-datos.md` §4. Llevar los tres recorridos de prueba (hoy scripts locales fuera del repo) a Playwright.

**Datos de muestra que el taller debe sustituir:** precios del tabulador, plantillas de diagnóstico y datos fiscales (Configuración llega vacía a propósito).

**En espera por decisión del usuario:** recordatorio de servicio por correo (requiere aprobar un proveedor de correo).

## 3. Prototipo: cómo correrlo y probarlo

- **Repositorio:** https://github.com/leonardoaguilar117/ERP-Fortaleza-Servicar (público).
  - Primera carga: 25 commits el 2026-10-29.
  - Sin datos reales: `.gitignore` deja fuera el Excel, las capturas de MecanicaMX, `graphify-out/`, `.taste-skill/` y `.claude/`.
  - Las 4 órdenes del Excel en `js/datos.js` tienen cliente, teléfono, placas y VIN ficticios.
  - **Nunca subas datos reales de clientes.**
  - La especificación vive en `docs/especificacion.md`; `README.md` es la presentación del repositorio.
- **Docker (versión de prueba):** `docker compose up --build -d` → http://localhost:8080.
  - Caddy sin root, salud en `/healthz`, puerto en `$PORT`.
  - Archivos: `docker/prototipo.Dockerfile`, `docker/Caddyfile` y `docker-compose.yml`.
  - **Pendiente:** probar el build; en esta máquina no hay Docker.
- **Render:** Blueprint en `render.yaml` (web service Docker, plan free, región ohio, health check `/healthz`).
  - Se crea con New → Blueprint.
  - Pendiente: que el usuario haga el primer despliegue y confirme que levanta.
- **Servir sin Docker:** `cd prototipo && python -m http.server 8765 --bind 127.0.0.1`, y abrir `http://127.0.0.1:8765/index.html`.
- **Portal de prueba:**
  - `portal.html#k7Qw2mZ9pL4xT8vR`, código `482913`.
  - Otros estatus: `#QaZN4gbzMO4TXqmL` (por autorizar), `#M0Z9imt1uwMPPyuP` (diagnóstico), `#YUDhukplQmyTnuqn` (reparación), `#Tw6N5SENFQlNcOF1` (esperando refacción), `#BAmvVKMpZohrqO1Z` (listo) y `#dUYLLu0vZABVUg7x` (entregado).
- **Archivos:**
  - `js/datos.js`: las 4 órdenes del Excel, con `console.assert` de sus utilidades.
  - `js/datos3.js`: compras, gastos y citas.
  - `js/datos4.js`: cuentas, movimientos, empleados y permisos.
  - `js/estados.js`: máquina de estados (catálogo de estatus, transiciones, `avanzar`, `autorizar`, `entregar`). Único lugar donde cambia un estatus; lo usan el ERP y el portal.
  - `js/app.js`: núcleo, dashboard, órdenes, detalle, recepción, notificaciones y router. Las pantallas se registran con `FSApp.registrarRuta(nombre, render, { permiso, titulo })` y el router valida el permiso.
  - `js/fase3.js`: citas, gastos y compras, y reportes.
  - `js/fase4.js`: balance, bancos, empleados y bitácora.
  - `js/firma.js`: firma del técnico (trazos, SVG y sello).
  - `js/fase5.js`: clientes, diagnóstico, configuración y hoja imprimible.
  - `js/almacen.js`: guardado en el navegador y sincronía ERP ↔ portal.
  - `css/fase4.css`: secciones del menú, colores del dinero (`.v-pos`, `.v-neg`, `--eg-*`) y Administración.
- **Inspección visual:**
  - `node ~/.claude/skills/taste-skill/scripts/inspect.mjs --app "<url>" --out .taste-skill/<nombre>`.
  - Corre **una pantalla a la vez**: el usuario canceló una corrida larga.
  - Para pruebas de clic sin Playwright, usar `~/.claude/skills/taste-skill/scripts/lib/cdp.mjs`.
- **Datos guardados en el navegador:** `fs-datos` (todo lo capturado), `fs-permisos`, `fs-foto-<id>`, `fs-tema` y `fs-rol` en `localStorage`.
- **Orden con dos carros para probar:** `#/orden/FS-26-000475` (orden 2829).

## 4. Notas de entorno

- Python: `L:/Python/python.exe` (tiene graphify). Node v24. Prisma se valida con `npx -y prisma@6.19.0 validate --schema docs/schema.prisma` (requiere `DATABASE_URL` de prueba).
- Herramientas de diseño: taste-skill en `~/.claude/skills/taste-skill`.
- En la herramienta Bash, los heredoc de Python con comillas invertidas fallan. Escribir el script a un archivo del scratchpad y ejecutarlo.
