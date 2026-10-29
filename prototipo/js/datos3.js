// Datos de la fase 3 (demostración): compras, proveedores, gastos, citas y recordatorios.
// Las compras salen de lo capturado en cada orden (refacciones y TOT), así que cuadran con el Excel.
// Los gastos, los contactos de proveedores y las citas son DATOS DE MUESTRA para la demostración.
(() => {
  const { CONFIG, servicios } = window.FS;
  const AHORA = new Date(CONFIG.ahora);

  // ---------- compras ----------
  // estatus: por_comprar (sin fecha de compra), pendiente (comprada hace 3 días o menos, aún sin pagar al proveedor),
  // pagada, propio (consumo del almacén del taller: no se paga a nadie)
  const compras = [];
  servicios.forEach((s) => {
    [['Refacción', s.refacciones], ['TOT', s.tot]].forEach(([tipo, lista]) => lista.forEach((linea, i) => {
      const [concepto, costo, proveedor, factura, fecha] = linea;
      const dias = fecha ? (AHORA - new Date(fecha)) / 864e5 : null;
      const estatus = !fecha ? 'por_comprar' : proveedor === 'Almacén propio' ? 'propio' : dias <= 3 ? 'pendiente' : 'pagada';
      compras.push({ id: `${s.codigo}-${tipo[0]}${i}`, servicio: s.codigo, orden: s.orden, vehiculo: `${s.vehiculo.marca} ${s.vehiculo.modelo} ${s.vehiculo.anio}`, tipo, concepto, costo, proveedor: proveedor === '—' ? '' : proveedor, factura, fecha, estatus, linea });
    }));
  });

  const proveedoresInfo = {
    Morales: { tipo: 'Refacciones', tel: '55 5550 0141', contacto: 'Mostrador' },
    Puebla: { tipo: 'Refacciones', tel: '55 5550 0187', contacto: 'Mostrador' },
    SAYM: { tipo: 'Refacciones', tel: '55 5550 0122', contacto: 'Ventas' },
    'Hojalatería Ramírez': { tipo: 'Taller externo (TOT)', tel: '55 5550 0163', contacto: 'Sr. Ramírez' },
    Gasolinera: { tipo: 'Combustible', tel: '', contacto: '' },
    'Almacén propio': { tipo: 'Interno', tel: '', contacto: 'Consumo del taller' },
  };

  // ---------- gastos (muestra; en el Excel no existe esta captura) ----------
  const CATEGORIAS = ['Renta', 'Luz y agua', 'Nómina', 'Herramienta', 'Consumibles de taller', 'Limpieza', 'Publicidad'];
  const g = (fecha, categoria, concepto, monto, proveedor) => ({ fecha, categoria, concepto, monto, proveedor });
  const gastos = [
    g('2026-10-01', 'Renta', 'Renta del local', 12000, 'Arrendador'),
    g('2026-10-03', 'Luz y agua', 'Recibo de luz', 1560, 'CFE'),
    g('2026-10-05', 'Nómina', 'Quincena: técnicos y asesor', 9500, 'Nómina'),
    g('2026-10-08', 'Herramienta', 'Llave de torque', 1850, 'Herramientas del Norte'),
    g('2026-10-10', 'Consumibles de taller', 'Franelas y desengrasante', 690, 'Morales'),
    g('2026-10-12', 'Limpieza', 'Productos de limpieza', 420, 'Tienda local'),
    g('2026-10-15', 'Nómina', 'Quincena: técnicos y asesor', 9500, 'Nómina'),
    g('2026-10-17', 'Publicidad', 'Impulso de publicaciones', 900, 'Meta'),
    g('2026-10-20', 'Consumibles de taller', 'Aceite de transmisión para el taller', 1260, 'Puebla'),
    g('2026-10-22', 'Herramienta', 'Actualización anual del escáner', 2400, 'Autel'),
    g('2026-10-24', 'Luz y agua', 'Recibo de agua', 540, 'SACMEX'),
    g('2026-10-27', 'Limpieza', 'Retiro de residuos', 650, 'Servicio municipal'),
  ];

  gastos.forEach((x, i) => { x.id = `g${i + 1}`; });

  // ---------- citas y recordatorios internos (muestra) ----------
  const por = (placas) => servicios.find((x) => x.vehiculo.placas === placas);
  const de = (placas) => { const x = por(placas); return { cliente: x.cliente.nombre, vehiculo: `${x.vehiculo.marca} ${x.vehiculo.modelo} ${x.vehiculo.anio}`, placas, servicio: x.codigo, telefono: x.cliente.telefono }; };
  const nuevo = (cliente, vehiculo, placas, telefono) => ({ cliente, vehiculo, placas, servicio: null, telefono });
  let n = 0;
  const c = (fecha, hora, dur, motivo, estatus, quien, notas = '', asesor = 'pablo') => ({ id: `c${++n}`, titulo: `${motivo}: ${quien.cliente.split(' ')[0]}`, motivo, ...quien, fecha, hora, dur, estatus, notas, asesor });
  const citas = [
    c('2026-10-26', '10:00', 60, 'Diagnóstico', 'Atendida', nuevo('Fernanda Luna Prado', 'Mazda Mazda 2 2020', 'R14-ABF', null), 'Ruido al frenar.'),
    c('2026-10-27', '12:00', 60, 'Cotización', 'Atendida', de('NT-1428-B'), 'Revisión de suspensión.'),
    c('2026-10-28', '10:00', 60, 'Revisión', 'No atendida', nuevo('Luis Fernando Quiroz', 'Nissan Sentra 2016', 'PRS-205-C', null), 'No llegó; llamar para reagendar.'),
    c('2026-10-28', '17:30', 60, 'Diagnóstico', 'Por confirmar', nuevo('Patricia Beltrán Ochoa', 'Suzuki Swift 2021', 'NBC-504-A', '5512345678'), 'Revisión de frenos: vibra el volante al frenar.'),
    c('2026-10-29', '09:30', 30, 'Entrega', 'Confirmada', de('PKF-930-A'), 'Pasa por su Mazda 3.'),
    c('2026-10-29', '11:00', 30, 'Entrega', 'Por confirmar', de('NZG-152-C'), ''),
    c('2026-10-29', '16:00', 60, 'Cotización', 'Por confirmar', de('RBC-257-A'), 'Revisar la cotización con el cliente.'),
    c('2026-10-30', '10:00', 90, 'Servicio', 'Confirmada', nuevo('Gilberto Arriaga Mena', 'Honda Civic 2019', 'NLB-338-B', '5598123400'), 'Mantenimiento mayor.'),
    c('2026-10-31', '12:00', 60, 'Diagnóstico', 'Por confirmar', nuevo('Rosa María Cabrera', 'Chevrolet Spark 2018', 'PGZ-771-A', null), 'Falla de arranque.'),
    c('2026-11-02', '09:00', 120, 'Servicio', 'Confirmada', nuevo('Transportes Cuauhtémoc', 'Nissan NP300 2017', 'NE-7120-C', '5560981277'), 'Afinación de dos unidades.'),
    c('2026-11-04', '10:30', 60, 'Revisión', 'Por confirmar', nuevo('Elena Montiel', 'Kia Seltos 2022', 'PHA-209-D', null), 'Revisión de 40 mil km.'),
  ];
  const recordatorios = [
    { id: 'r1', texto: 'Avisar que el Mazda 3 y el CR-V están listos', fecha: '2026-10-28', hora: '16:00', asesor: 'pablo', cita: null, estado: 'Pendiente' },
    { id: 'r2', texto: 'Llamar a Patricia Beltrán para confirmar la cita de frenos', fecha: '2026-10-28', hora: '17:00', asesor: 'pablo', cita: 'c4', estado: 'Pendiente' },
    { id: 'r3', texto: 'Reagendar a Luis Fernando Quiroz (no llegó hoy)', fecha: '2026-10-29', hora: '09:00', asesor: 'pablo', cita: 'c3', estado: 'Pendiente' },
    { id: 'r4', texto: 'Confirmar las citas de entrega de mañana', fecha: '2026-10-28', hora: '18:00', asesor: 'pablo', cita: null, estado: 'Pendiente' },
    { id: 'r5', texto: 'Pedir la bomba de agua del Aveo', fecha: '2026-10-27', hora: '12:00', asesor: 'pablo', cita: null, estado: 'Hecho' },
  ];

  Object.assign(window.FS, { compras, proveedoresInfo, CATEGORIAS, gastos, citas, recordatorios });
})();
