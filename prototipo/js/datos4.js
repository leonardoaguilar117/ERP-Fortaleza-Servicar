// Datos de la fase 4 (demostración): cuentas, movimientos, empleados y permisos por rol.
// Los INGRESOS salen de los pagos registrados en cada orden y los EGRESOS de las compras pagadas y los gastos de
// datos3.js, así que el flujo cuadra con lo que ya muestran el dashboard y los reportes.
// Los saldos iniciales, la cuenta de cada gasto y los empleados son DATOS DE MUESTRA.
(() => {
  const F = window.FS;
  const INICIO = '2026-10-01', HOY = '2026-10-28';

  const cuentas = [
    { id: 'caja', nombre: 'Caja del taller', tipo: 'Efectivo', saldoInicial: 8500, tono: 'green' },
    { id: 'bbva', nombre: 'BBVA Empresarial', tipo: 'Banco', saldoInicial: 42000, tono: 'blue' },
  ];
  const CUENTA_DE = { efectivo: 'caja' }; // el resto de los métodos entra al banco
  const GASTO_EN_CAJA = ['Herramienta', 'Consumibles de taller', 'Limpieza'];
  const cuentaGasto = (g) => g.cuenta || (GASTO_EN_CAJA.includes(g.categoria) ? 'caja' : 'bbva');
  // bitácora de cambios hechos en la demostración (en producción: módulo de auditoría)
  const auditoria = [];

  // movimientos capturados a mano en la demostración (depósitos, retiros y transferencias entre cuentas)
  const manuales = [
    { id: 'm1', fecha: '2026-10-09', cuenta: 'bbva', tipo: 'egreso', concepto: 'Retiro para caja chica', monto: 3000, interno: true, par: 'm2' },
    { id: 'm2', fecha: '2026-10-09', cuenta: 'caja', tipo: 'ingreso', concepto: 'Retiro para caja chica', monto: 3000, interno: true, par: 'm1' },
  ];

  // Lista completa y ordenada. `interno` = transferencia entre cuentas: mueve saldo, pero no cuenta como ingreso ni egreso.
  function movimientos() {
    const m = [];
    F.servicios.forEach((s) => s.pagos.forEach(([fecha, metodo, monto, comision, nota], i) => {
      const neto = Math.round((monto - comision) * 100) / 100;
      m.push({ id: `p-${s.codigo}-${i}`, fecha, cuenta: CUENTA_DE[metodo] || 'bbva', tipo: 'ingreso', concepto: `${nota || 'Pago'} · orden ${s.orden}`, detalle: `${s.vehiculo.marca} ${s.vehiculo.modelo} ${s.vehiculo.anio}`, monto: neto, comision, servicio: s.codigo, metodo, categoria: 'Cobros de servicio', origen: 'cobro' });
    }));
    F.compras.filter((c) => c.estatus === 'pagada' && c.fecha >= INICIO).forEach((c) => {
      m.push({ id: `c-${c.id}`, fecha: c.fecha, cuenta: c.proveedor === 'Gasolinera' ? 'caja' : 'bbva', tipo: 'egreso', concepto: c.concepto, detalle: `${c.proveedor || 'Sin proveedor'} · orden ${c.orden}`, monto: c.costo, servicio: c.servicio, categoria: 'Compras para órdenes', origen: 'compra', ref: c.id, editado: c.editado });
    });
    F.gastos.forEach((g) => m.push({ id: `g-${g.id}`, fecha: g.fecha, cuenta: cuentaGasto(g), tipo: 'egreso', concepto: g.concepto, detalle: g.proveedor || '', monto: g.monto, categoria: g.categoria, origen: 'gasto', ref: g.id, editado: g.editado }));
    manuales.forEach((x) => m.push({ ...x, categoria: x.interno ? 'Traspaso entre cuentas' : x.tipo === 'ingreso' ? 'Otros ingresos' : 'Otros egresos', origen: 'manual', ref: x.id }));
    return m.filter((x) => x.fecha >= INICIO && x.fecha <= HOY).sort((a, b) => b.fecha.localeCompare(a.fecha) || a.id.localeCompare(b.id));
  }
  const saldoDe = (id, lista = movimientos()) => {
    const c = cuentas.find((x) => x.id === id);
    return Math.round((c.saldoInicial + lista.filter((x) => x.cuenta === id).reduce((t, x) => t + (x.tipo === 'ingreso' ? x.monto : -x.monto), 0)) * 100) / 100;
  };

  // ---------- empleados ----------
  const empleados = [
    { id: 'admin', nombre: 'Administración (dueño)', rol: 'Administración', correo: 'admin@fortalezaservicar.mx', tel: '5576195812', activo: true, ingreso: '2020-01-06' },
    { id: 'pablo', nombre: 'Pablo', rol: 'Asesor', correo: 'pablo@fortalezaservicar.mx', tel: '5550010001', activo: true, ingreso: '2022-03-14' },
    { id: 'daniel', nombre: 'Daniel', rol: 'Técnico', correo: 'daniel@fortalezaservicar.mx', tel: '5550010002', activo: true, ingreso: '2021-08-02' },
    { id: 'christoper', nombre: 'Christoper', rol: 'Técnico', correo: 'christoper@fortalezaservicar.mx', tel: '5550010003', activo: true, ingreso: '2023-01-16' },
    { id: 'alexander', nombre: 'Alexander', rol: 'Técnico', correo: 'alexander@fortalezaservicar.mx', tel: '5550010004', activo: true, ingreso: '2024-05-20' },
  ];

  // ---------- permisos por rol ----------
  // Administración los cambia en Empleados y roles. La demostración los guarda en este navegador y la pantalla los
  // respeta; en producción viven en la base de datos y el servidor los aplica en cada endpoint (SEGURIDAD.md).
  const ROLES = ['Administración', 'Asesor', 'Técnico'];
  const PERMISOS = [
    ['Taller', [
      ['recepcion', 'Registrar recepciones', [1, 1, 1]],
      ['estatus', 'Avanzar el estatus del servicio', [1, 1, 1]],
      ['autorizar', 'Registrar la autorización del cliente', [1, 1, 0]],
      ['citas', 'Citas y recordatorios', [1, 1, 1]],
    ]],
    ['Dinero', [
      ['importes', 'Ver importes y saldos al cliente', [1, 1, 0]],
      ['pagos', 'Registrar pagos y entregar', [1, 1, 0]],
      ['costos', 'Ver costos, proveedores y utilidad', [1, 0, 0]],
      ['gastos', 'Gastos y compras', [1, 0, 0]],
      ['flujos', 'Balance, bancos y flujos', [1, 0, 0]],
      ['reportes', 'Reportes de rentabilidad', [1, 0, 0]],
    ]],
    ['Administración', [
      ['empleados', 'Empleados y roles', [1, 0, 0]],
    ]],
  ];
  // un permiso que necesita otro: al darlo se da también el requisito; al quitar el requisito se quitan los que dependen
  const REQUIERE = { pagos: ['importes'], costos: ['importes'], gastos: ['costos'], flujos: ['costos'], reportes: ['costos'] };
  // Administración conserva siempre Empleados y roles, para que nadie se quede sin poder corregir los permisos
  const FIJO = { 'Administración': ['empleados'] };
  const porDefecto = () => Object.fromEntries(ROLES.map((r, i) => [r, Object.fromEntries(PERMISOS.flatMap(([, fs]) => fs.map(([id, , v]) => [id, !!v[i]])))]));
  let guardados = {};
  try { guardados = JSON.parse(localStorage.getItem('fs-permisos') || '{}') || {}; } catch {}
  const permisos = porDefecto();
  ROLES.forEach((r) => Object.keys(permisos[r]).forEach((id) => { if (typeof guardados[r]?.[id] === 'boolean') permisos[r][id] = guardados[r][id]; }));
  Object.entries(FIJO).forEach(([r, ids]) => ids.forEach((id) => { permisos[r][id] = true; }));
  const guardar = () => { try { localStorage.setItem('fs-permisos', JSON.stringify(permisos)); } catch {} };
  const tiene = (rol, id) => !!permisos[rol]?.[id];
  const fijo = (rol, id) => (FIJO[rol] || []).includes(id);
  // cambia un permiso y sus dependencias; devuelve los otros permisos que se movieron con él
  function cambiarPermiso(rol, id, on) {
    if (fijo(rol, id)) return [];
    const extra = [];
    const poner = (k, v) => { if (permisos[rol][k] !== v && !fijo(rol, k)) { permisos[rol][k] = v; if (k !== id) extra.push(k); } };
    poner(id, on);
    if (on) { const req = (k) => (REQUIERE[k] || []).forEach((r) => { poner(r, true); req(r); }); req(id); }
    else { const dep = (k) => Object.entries(REQUIERE).forEach(([d, rs]) => { if (rs.includes(k)) { poner(d, false); dep(d); } }); dep(id); }
    guardar();
    return extra;
  }
  const restablecerPermisos = () => { const d = porDefecto(); ROLES.forEach((r) => Object.assign(permisos[r], d[r])); try { localStorage.removeItem('fs-permisos'); } catch {} };
  const nombrePermiso = (id) => PERMISOS.flatMap(([, fs]) => fs).find(([k]) => k === id)?.[1] || id;

  Object.assign(F, { cuentaGasto, auditoria, cuentas, manuales, movimientos, saldoDe, empleados, PERMISOS, ROLES, permisos, tiene, fijo, cambiarPermiso, restablecerPermisos, nombrePermiso, REQUIERE, FLUJO_INICIO: INICIO, FLUJO_HOY: HOY });
})();
