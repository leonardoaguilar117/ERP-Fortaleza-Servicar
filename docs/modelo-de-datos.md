# Modelo de datos

Cómo las reglas de negocio quedan en la base de datos. Las reglas en sí están en **especificación §3** (única fuente) y no se repiten aquí. El esquema es [`schema.prisma`](schema.prisma): pasa `prisma validate` (Prisma 6.19) y se copiará a `apps/api/prisma/` en la fase 1.

## 1. Mapa de tablas

```
Branch ─┬─ BranchSetting · ServiceCounter · RolePermission
        ├─ User ── RefreshToken
        ├─ Customer ─┬─ Consent
        │            ├─ Vehicle ── ServiceReminder           (→ VehicleModel → VehicleVersion)
        │            └─ ServiceOrder ─┬─ Payment ──→ CashAccount
        │                             ├─ TrackingToken ── OtpChallenge
        │                             └─ Folio ─┬─ Reception ── ReceptionCheck   (firma del técnico)
        │                                       ├─ FolioAssignment            (varios técnicos)
        │                                       ├─ Inspection ── InspectionResult
        │                                       ├─ QuoteLine ──→ ServiceCatalogItem · Supplier · CashAccount
        │                                       ├─ Authorization · StatusHistory
        │                                       └─ Appointment (entrega) ── InternalReminder
        ├─ Supplier · ServiceCatalogItem · InspectionTemplate
        └─ CashAccount ─┬─ Expense
                        └─ AccountMovement
Notification · AuditLog (solo inserción)
```

## 2. Dónde queda cada regla

| Regla (especificación) | En la base |
|---|---|
| Orden con varios carros (§3.1) | `ServiceOrder` 1─N `Folio`, con `@@unique([orderId, seq])` |
| Mismo cliente en orden, folio y vehículo (§3.7) | `Folio.customerId` se repite a propósito y entra en dos llaves compuestas: `(orderId, customerId)` → `ServiceOrder(id, customerId)` y `(vehicleId, customerId)` → `Vehicle(id, customerId)` |
| `orderNumber` repetible y códigos únicos (§3.1) | `orderNumber` sin `@unique`, solo indexado; `serviceCode` y `folioCode` con `@unique`. El consecutivo sale de `ServiceCounter` (sucursal + año) dentro de una transacción |
| Estatus por folio, sin banderas paralelas (§3.2) | `Folio.status` es el único estado. `ServiceOrder` y `QuoteLine` no tienen columna de estatus. Cada cambio va a `StatusHistory` |
| Partidas rechazadas (§3.2) | `QuoteLine.removedAt` y `removedReason`; lo aprobado, en `Authorization.lineIds` |
| Entrega ligada a la cita (§3.2) | `Appointment.folioId` con `reason = DELIVERY`; la API marca la cita al entregar, en la misma transacción |
| Permisos editables (§3.3) | `RolePermission (branchId, role, permission, granted)`. Las claves y sus dependencias viven en `packages/shared` |
| Un técnico, una asignación activa (§3.3) | `FolioAssignment.endedAt` nulo = activa, más el índice único parcial (§4) |
| Firma como trazos (§3.3) | `Reception.signatureStrokes` (`bytea`), `signatureHash` y `signedAt`, todos obligatorios |
| Parámetros del dinero (§3.4) | `BranchSetting`: `partsMarginBp` 3000, `laborRateCents` 40000, `mercadopagoFeeBp` 290, `bbvaFeeBp` 210, `ivaRateBp` 1600 |
| Fecha y monto de cada comisión (§3.4) | `Payment.paidAt`, `feeRateBp`, `feeCents` y `feeIvaCents`, guardados al cobrar |
| Pagos que no se borran (§3.4) | `PaymentKind.REVERSAL` con `reversesId` único: un pago solo se revierte una vez |
| Servicios tabulados (§3.4) | `ServiceCatalogItem.referencePriceCents`; la partida guarda `tabulatedPriceCents` (copia del día) y `priceCents` (real) |
| Cuentas, gastos y movimientos (§3.5) | `CashAccount` (saldo inicial y fecha), `Expense`, `AccountMovement`. Un traspaso son dos movimientos con el mismo `transferGroupId` |
| Estado de una compra (§3.5) | Se deriva de `QuoteLine`: sin `purchasedAt` = por comprar; sin `supplierPaidAt` = pendiente; con ambos = pagada; `Supplier.isOwnStock` = consumo propio |
| Anular en vez de borrar (§3.5, §3.7) | `removedAt` y `removedReason` en `Expense`, `AccountMovement` y `QuoteLine`; `isActive` en catálogos y usuarios; `Customer.anonymizedAt` |
| Recordatorio sin duplicados (§3.6) | `ServiceReminder @@unique([vehicleId, dueOn])` |
| Historial del vehículo intacto (§3.7) | `Vehicle.makeText`, `modelText`, `versionText` y `engineText`, además de la referencia al catálogo |
| Un enlace por orden (§3.8) | `TrackingToken.orderId`; el token se guarda como hash SHA-256 |

## 3. Del Excel a las tablas

Cada bloque de filas del Excel se importa como **una orden con un folio**.

| Columnas del Excel | Destino |
|---|---|
| ORDEN | `ServiceOrder.orderNumber` |
| FECHA INGRESO / FECHA DE ENTREGA | `Folio.receivedAt` / `deliveredAt`. Los días en taller se calculan |
| NOMBRE, TELÉFONO | `Customer` (se agrupa por teléfono) |
| MARCA, MODELO, AÑO, COLOR, SERIE, PLACAS, KM | `Vehicle` (con copia del texto) y `Folio.mileageKm` |
| TRABAJO A REALIZAR | `Folio.reportedFault` |
| TRABAJOS AUTORIZADOS, COSTO DE LOS SERVICIOS | `QuoteLine` tipo `LABOR` con `priceCents`, más su `Authorization` |
| REFACCIÓN, COSTO, FACTURA/REMISIÓN, PROVEEDOR, FECHA COMPRA | `QuoteLine` tipo `PART`: `description`, `costCents`, `invoiceRef`, `supplierId`, `purchasedAt` |
| TOT, COSTO, PROVEEDOR, FECHA | `QuoteLine` tipo `SUBLET` |
| TÉCNICO, ASESOR | `FolioAssignment` (cerrada a la fecha de entrega) y `ServiceOrder.advisorId` |
| VENTA DEPÓSITO/TRANSFERENCIA, VENTA EFECTIVO, COMISIÓN TARJETA | `Payment` con su método, monto, tasa, comisión e IVA. Los anticipos se leen de OBSERVACIONES |
| STATUS | `Folio.status`: "TERMINADO" con fecha de entrega se importa como `DELIVERED` (especificación §6, pregunta 3) |
| HORAS TABULADORAS | Vacía hoy. Si se confirma qué es, `ServiceCatalogItem.referenceHours` |

## 4. Restricciones que van en SQL

Prisma no las declara. Se escriben en la migración con `prisma migrate dev --create-only`, y una prueba de integración verifica que existan (consulta `pg_indexes` y `pg_constraint`), para que no se pierdan si alguien regenera las migraciones:

```sql
CREATE UNIQUE INDEX one_active_folio_per_technician ON folio_assignments (technician_id) WHERE ended_at IS NULL;
ALTER TABLE payments           ADD CHECK (amount_cents > 0 AND fee_rate_bp BETWEEN 0 AND 10000);
ALTER TABLE expenses           ADD CHECK (amount_cents > 0);
ALTER TABLE account_movements  ADD CHECK (amount_cents > 0);
ALTER TABLE branch_settings    ADD CHECK (reminder_months BETWEEN 3 AND 6);
ALTER TABLE appointments       ADD CHECK (reason <> 'DELIVERY' OR folio_id IS NOT NULL);
CREATE INDEX customers_name_trgm ON customers USING gin (name gin_trgm_ops);  -- requiere pg_trgm
REVOKE UPDATE, DELETE ON audit_log FROM app_user;                              -- auditoría de solo inserción
```

## 5. Lo que se calcula y no se guarda

Totales, utilidad, horas de mano de obra, días en taller, avance de la orden, saldo de la orden, saldo de cada cuenta y estado de cada compra. Las fórmulas están en especificación §3.4 y el código en `packages/shared/src/finance/`; guardarlos los dejaría desactualizados.

## 6. Convenciones

- Dinero en centavos enteros (`*Cents`, `Int`, hasta unos $21 millones por importe) y tasas en puntos base (`*Bp`).
- IDs UUID, nunca consecutivos en URL. Tablas en `snake_case` plural con `@@map`.
- `ServiceOrder.version` y `Folio.version` para control de concurrencia optimista: dos tablets pueden editar el mismo servicio.
- Toda consulta filtra por `branchId` (guard o extensión de Prisma).
- Las respuestas se arman por permiso: quien no tiene "ver costos" no recibe `costCents`, `supplierId` ni utilidad (`SEGURIDAD.md` §3).
