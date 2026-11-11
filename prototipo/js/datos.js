// =====================================================================================================================
// Datos base del prototipo: configuración, personal, servicios y cálculo de utilidad
// ---------------------------------------------------------------------------------------------------------------------
// Las órdenes 2752, 2824, 2825 y 2826 salen de excelOperacionEjemplo.xlsx con sus montos reales, pero con cliente,
// teléfono, placas y VIN ficticios (el Excel no se publica: tiene datos personales). El resto es muestra y debe
// sustituirse por datos reales. Todos los totales se calculan desde las filas (nunca se escriben a mano) y las
// fórmulas de utilidad son las del Excel, con sus parámetros en CONFIG.
//
// Estructura de un servicio (un carro dentro de una orden):
//   orden, codigo, estatus, ingreso / cotizado / terminado / entrega, cliente, vehiculo, tecnico, asesor, falla,
//   trabajos    [descripción, precio]
//   refacciones [descripción, costo, proveedor, factura, fecha de compra]
//   tot         [descripción, costo, proveedor, factura, fecha]            (trabajo en otro taller)
//   pagos       [fecha, método, monto, comisión, concepto]
//   calc        resultado de calcular(); nunca se captura a mano
//
//   pagos       [fecha, método, monto, comisión total (con IVA), concepto, { tasaBp, comision, iva, revertido, reversoDe }]
//                un monto negativo es el reverso de otro pago: los pagos no se borran (especificación §3.4)
//
// Expone window.FS = { CONFIG, PERSONAL, servicios, calcular, comisionDe, TABULADOS, c, p, HISTORICO }.
// =====================================================================================================================
(() => {
  // ---------------------------------------------------------------------------------------------------------------
  // Configuración del taller (en producción vive en BranchSetting)
  // ---------------------------------------------------------------------------------------------------------------
  const CONFIG = {
    taller: 'Fortaleza Servicar',
    sucursal: 'Matriz',
    // Datos fiscales y de contacto para el formato de la orden. Los captura Administración en Configuración;
    // aquí van vacíos a propósito: no se inventan datos del taller.
    tallerDatos: { razon: '', rfc: '', domicilio: '', telefono: '', horario: '' },
    margenRefacciones: 0.3, // utilidad de refacciones = 30 % del costo
    tarifaHoraMO: 400, // horas de mano de obra = utilidad MO ÷ $400
    // histórico: cobros con terminal anteriores a la plataforma (la plataforma ya no cobra); sostiene las utilidades del Excel
    comision: { tarjeta: 0.0348, msi: 0.0759, efectivo: 0, transferencia: 0 },
    // Métodos de pago vigentes (especificación §3.4): solo se registran, no se cobra desde la plataforma.
    // tasaBp en puntos base (290 = 2.9 %). `tarjeta` y `msi` quedan solo para leer los pagos históricos del Excel.
    iva: 0.16,
    metodos: {
      efectivo: { nombre: 'Efectivo', tasaBp: 0 },
      transferencia: { nombre: 'Transferencia', tasaBp: 0 },
      mercadopago: { nombre: 'MercadoPago', tasaBp: 290 },
      bbva: { nombre: 'Terminal BBVA', tasaBp: 210 },
      tarjeta: { nombre: 'Tarjeta', historico: true },
      msi: { nombre: 'Tarjeta a meses', historico: true },
    },
    ahora: '2026-10-28T16:20',
    siguienteOrden: 2836,
    whatsapp: '55 7619 5812',
  };

  // Personal que aparece en las órdenes; `tono` colorea su avatar cuando no tiene foto.
  const PERSONAL = {
    pablo: { nombre: 'Pablo', rol: 'Asesor de servicio', tono: 18 },
    daniel: { nombre: 'Daniel', rol: 'Técnico', tono: 210 },
    christoper: { nombre: 'Christoper', rol: 'Técnico', tono: 150 },
    alexander: { nombre: 'Alexander', rol: 'Técnico', tono: 280 },
  };

  // ---------------------------------------------------------------------------------------------------------------
  // Dinero en centavos: todo se suma en enteros para que los totales cuadren al peso
  // ---------------------------------------------------------------------------------------------------------------
  const c = (v) => Math.round(v * 100);
  const p = (cents) => cents / 100;

  // v(marca, modelo, año, versión, placas, color, km, carrocería)
  const v = (marca, modelo, anio, version, placas, color, km, carroceria, vin = null) => ({
    marca,
    modelo,
    anio,
    version,
    placas,
    color,
    km,
    carroceria,
    vin,
  });

  // ---------------------------------------------------------------------------------------------------------------
  // Órdenes del Excel, con todas sus partidas. `excelEsperado` guarda las cifras de la hoja para comprobarlas.
  // ---------------------------------------------------------------------------------------------------------------
  const excel = [
    {
      orden: 2752,
      codigo: 'FS-26-000398',
      estatus: 'ENTREGADO',
      ingreso: '2026-10-07T09:30',
      entrega: '2026-10-24T17:10',
      cliente: { nombre: 'Samuel Díaz Herrera', telefono: '5550012752' },
      vehiculo: v('Chevrolet', 'Sonic', 2015, 'LT 1.6L', 'XAA-101-A', 'Rojo', 141547, 'SEDAN', '3G1XX0000F000001'),
      tecnico: 'daniel',
      asesor: 'pablo',
      trabajos: [
        ['Servicio de mantenimiento mayor', 3600],
        ['Kit de distribución', 7585],
        ['Reemplazo de retenes de árboles', 1600],
        ['Reemplazo de retenes de cigüeñal delanteros', 1100],
        ['Reemplazo de junta de bomba de aceite', 1400],
        ['Empacar cárter', 1300],
        ['Reemplazo de junta de tapa de punterías', 1438],
        ['Servicio al sistema de enfriamiento', 1600],
        ['Reemplazo de depósito de anticongelante', 1956],
        ['Reemplazo de bobina', 3800],
        ['Reemplazo de sensor ABS', 2800],
        ['Reemplazo de depósito limpiaparabrisas', 1600],
      ],
      refacciones: [
        ['Kit de distribución TCKWP338', 4785, 'Morales', '50', '2026-10-08'],
        ['Retén RE99646VT', 96, 'Morales', '50', '2026-10-08'],
        ['Junta DJ81238', 405, 'Morales', '50', '2026-10-08'],
        ['Junta P531238', 438, 'Morales', '50', '2026-10-08'],
        ['Depósito 42609220', 758, 'Morales', '50', '2026-10-08'],
        ['Tapón 13502353', 698, 'Morales', '50', '2026-10-08'],
        ['Bobina 1C288', 2105, 'Morales', '50', '2026-10-08'],
        ['Retén RE99646VT', 96, 'Morales', '54', '2026-10-08'],
        ['Filtro de aceite 19471010', 140, 'Puebla', '5827', '2026-10-13'],
        ['Bujía 19336070', 220, 'Puebla', '5827', '2026-10-13'],
        ['Aceite 5W30', 1180, 'Puebla', '5827', '2026-10-13'],
        ['Filtro de aire F96A90', 150, 'Puebla', '5827', '2026-10-13'],
        ['Pieza 939643', 430, 'Morales', '41', '2026-10-14'],
        ['Anticongelante Dexcool 19433401', 425, 'Puebla', '2235', '2026-10-15'],
        ['Sensor de ABS ALS220', 1100, 'SAYM', '9850', '2026-10-15'],
        ['Tapa de punterías 55564395NG', 1050, 'Puebla', '1328', '2026-10-16'],
        ['Depósito limpiaparabrisas', 450, 'Puebla', '1328', '2026-10-16'],
      ],
      tot: [['Gasolina', 145, 'Gasolinera', '393228', '2026-10-14']],
      pagos: [
        ['2026-10-07', 'tarjeta', 10000, 348.0, 'Anticipo'],
        ['2026-10-24', 'tarjeta', 19779, 688.31, 'Liquidación'],
      ],
      excelEsperado: {
        ventaNeta: 28742.69,
        utilidadMO: 9713.89,
        utilidadRef: 4357.8,
        utilidad: 14071.69,
        horasMO: 24.28,
      },
    },
    {
      orden: 2824,
      codigo: 'FS-26-000470',
      estatus: 'ENTREGADO',
      ingreso: '2026-10-24T08:40',
      entrega: '2026-10-24T14:20',
      cliente: { nombre: 'Julia Martínez Orozco', telefono: '5550012824' },
      vehiculo: v('Mazda', 'Mazda 3', 2018, 'i Touring 2.0L', 'XAA-102-A', 'Rojo', 48896, 'SEDAN', 'JM1XX0000J0000002'),
      tecnico: 'daniel',
      asesor: 'pablo',
      trabajos: [['Servicio de mantenimiento mayor', 4500]],
      refacciones: [
        ['4 bujías LKAR7BIX', 1000, 'Puebla', '2310', '2026-10-24'],
        ['Filtro de aceite OF6607', 90, 'Puebla', '2310', '2026-10-24'],
        ['Filtro de aire PE07133', 120, 'Puebla', '2310', '2026-10-24'],
        ['Carbuclean', 90, 'Morales', '20', '2026-10-23'],
        ['Aceite 5 L', 450, 'Almacén propio', null, '2026-10-24'],
      ],
      tot: [],
      pagos: [['2026-10-24', 'tarjeta', 4500, 145.8, 'Liquidación']],
      excelEsperado: { ventaNeta: 4354.2, utilidadMO: 2079.2, utilidadRef: 525.0, utilidad: 2604.2, horasMO: 5.2 },
    },
    {
      orden: 2825,
      codigo: 'FS-26-000471',
      estatus: 'ENTREGADO',
      ingreso: '2026-10-24T09:05',
      entrega: '2026-10-24T16:45',
      cliente: { nombre: 'Vicente Aranda', telefono: '5550012825' },
      vehiculo: v(
        'Volkswagen',
        'Gol',
        2011,
        'Trendline 1.6L',
        'XAA-103-A',
        'Blanco',
        143512,
        'HATCHBACK',
        '9BWXX0000B0000003',
      ),
      tecnico: 'christoper',
      asesor: 'pablo',
      trabajos: [
        ['Servicio de mantenimiento mayor', 3400],
        ['Reemplazo de cables de bujías', 1300],
        ['Reemplazo de luces LED', 2100],
        ['Reemplazo de luces de niebla', 1500],
      ],
      refacciones: [
        ['Filtro de aire C2295', 120, 'Puebla', '2311', '2026-10-24'],
        ['Filtro de aceite W71253', 100, 'Puebla', '2311', '2026-10-24'],
        ['Filtro de gasolina WK58', 80, 'Puebla', '2311', '2026-10-24'],
        ['4 bujías', 840, 'Puebla', '2311', '2026-10-24'],
        ['Aceite 4 L', 360, 'Almacén propio', null, '2026-10-24'],
        ['Carbuclean', 90, 'Morales', '21', '2026-10-23'],
        ['Cables JG016', 972, 'Morales', '26', '2026-10-24'],
      ],
      tot: [],
      pagos: [['2026-10-24', 'msi', 8300, 629.97, 'Liquidación']],
      excelEsperado: { ventaNeta: 7670.03, utilidadMO: 4339.43, utilidadRef: 768.6, utilidad: 5108.03, horasMO: 10.85 },
    },
    {
      orden: 2826,
      codigo: 'FS-26-000472',
      estatus: 'ENTREGADO',
      ingreso: '2026-10-24T09:20',
      entrega: '2026-10-24T15:30',
      cliente: { nombre: 'Karina Lozano', telefono: '5550012826' },
      vehiculo: v(
        'Mazda',
        'Mazda 2',
        2019,
        'i Grand Touring 1.5L',
        'XAA-104-A',
        'Gris',
        102245,
        'SEDAN',
        '3MDXX0000K0000004',
      ),
      tecnico: 'alexander',
      asesor: 'pablo',
      trabajos: [['Servicio de mantenimiento mayor', 4500]],
      refacciones: [
        ['Carbuclean', 90, 'Morales', '22', '2026-10-23'],
        ['Filtro EFAWB001', 95, 'Morales', '1', '2026-10-24'],
        ['Filtro TLI4610', 55, 'Morales', '1', '2026-10-24'],
        ['4 bujías 1LKAR7L11', 992, 'Morales', '1', '2026-10-24'],
        ['Aceite 5 L', 450, 'Almacén propio', null, '2026-10-24'],
      ],
      tot: [],
      pagos: [['2026-10-24', 'msi', 4500, 341.55, 'Liquidación']],
      excelEsperado: { ventaNeta: 4158.45, utilidadMO: 1971.85, utilidadRef: 504.6, utilidad: 2476.45, horasMO: 4.93 },
    },
  ];

  // ---------------------------------------------------------------------------------------------------------------
  // Otros servicios entregados en octubre (muestra resumida: un trabajo y un concepto de refacciones)
  // ---------------------------------------------------------------------------------------------------------------
  // [orden, código, ingreso, entrega, marca, modelo, año, carrocería, placas, cliente, técnico, total, costo ref., TOT, método]
  const resumen = [
    [
      2731,
      'FS-26-000377',
      '2026-10-01T09:10',
      '2026-10-02T12:30',
      'Nissan',
      'Tsuru',
      2012,
      'SEDAN',
      'NWR-218-B',
      'Rogelio Vargas Peña',
      'daniel',
      3200,
      980,
      0,
      'efectivo',
    ],
    [
      2735,
      'FS-26-000381',
      '2026-10-02T10:00',
      '2026-10-03T13:15',
      'Volkswagen',
      'Vento',
      2018,
      'SEDAN',
      'P07-AKR',
      'Laura Patricia Sosa Gil',
      'christoper',
      5600,
      2140,
      0,
      'tarjeta',
    ],
    [
      2739,
      'FS-26-000385',
      '2026-10-05T08:45',
      '2026-10-06T11:00',
      'Chevrolet',
      'Spark',
      2017,
      'HATCHBACK',
      'MXT-552-C',
      'Óscar Delgado Ruiz',
      'alexander',
      2800,
      860,
      0,
      'transferencia',
    ],
    [
      2741,
      'FS-26-000387',
      '2026-10-05T09:30',
      '2026-10-08T17:40',
      'Ford',
      'Ranger',
      2020,
      'PICKUP',
      'NG-4517-B',
      'Agroinsumos del Bajío',
      'daniel',
      11800,
      5300,
      450,
      'transferencia',
    ],
    [
      2744,
      'FS-26-000390',
      '2026-10-06T10:15',
      '2026-10-07T12:20',
      'Nissan',
      'March',
      2019,
      'HATCHBACK',
      'PCN-903-A',
      'Gabriela Torres Núñez',
      'christoper',
      3400,
      1020,
      0,
      'tarjeta',
    ],
    [
      2748,
      'FS-26-000394',
      '2026-10-08T09:00',
      '2026-10-10T16:05',
      'Toyota',
      'Corolla',
      2018,
      'SEDAN',
      'MZB-471-D',
      'Arturo Medina Cano',
      'alexander',
      7200,
      2950,
      0,
      'msi',
    ],
    [
      2750,
      'FS-26-000396',
      '2026-10-09T08:30',
      '2026-10-09T15:50',
      'Honda',
      'Civic',
      2017,
      'SEDAN',
      'NBR-280-A',
      'Paola Jiménez Rocha',
      'daniel',
      2500,
      640,
      0,
      'efectivo',
    ],
    [
      2755,
      'FS-26-000401',
      '2026-10-12T09:20',
      '2026-10-14T13:30',
      'Chevrolet',
      'Aveo',
      2019,
      'SEDAN',
      'PDK-615-B',
      'Miguel Ángel Ruiz Soto',
      'christoper',
      6100,
      2420,
      0,
      'tarjeta',
    ],
    [
      2758,
      'FS-26-000404',
      '2026-10-13T08:50',
      '2026-10-13T17:10',
      'Nissan',
      'Versa',
      2021,
      'SEDAN',
      'RAJ-334-A',
      'Karla Montes de Oca',
      'alexander',
      3900,
      1180,
      0,
      'transferencia',
    ],
    [
      2761,
      'FS-26-000407',
      '2026-10-14T10:40',
      '2026-10-17T18:00',
      'Jeep',
      'Compass',
      2018,
      'SUV',
      'NPL-779-C',
      'Roberto Aguilar León',
      'daniel',
      14600,
      7120,
      1200,
      'msi',
    ],
    [
      2766,
      'FS-26-000412',
      '2026-10-16T09:00',
      '2026-10-16T16:40',
      'Mazda',
      'Mazda 2',
      2020,
      'HATCHBACK',
      'R14-ABF',
      'Fernanda Luna Prado',
      'christoper',
      3600,
      1050,
      0,
      'tarjeta',
    ],
    [
      2770,
      'FS-26-000416',
      '2026-10-19T08:35',
      '2026-10-21T14:25',
      'Volkswagen',
      'Jetta',
      2015,
      'SEDAN',
      'MVR-148-A',
      'Eduardo Navarro Fuentes',
      'alexander',
      8900,
      3870,
      0,
      'efectivo',
    ],
    [
      2774,
      'FS-26-000420',
      '2026-10-20T09:15',
      '2026-10-20T17:20',
      'Kia',
      'Rio',
      2019,
      'SEDAN',
      'PFW-602-B',
      'Sandra Elizondo Ríos',
      'daniel',
      3300,
      980,
      0,
      'tarjeta',
    ],
    [
      2779,
      'FS-26-000425',
      '2026-10-21T10:05',
      '2026-10-23T12:45',
      'Dodge',
      'Attitude',
      2016,
      'SEDAN',
      'NHT-913-A',
      'Raúl Castañeda Vela',
      'christoper',
      5200,
      2010,
      0,
      'transferencia',
    ],
    [
      2820,
      'FS-26-000466',
      '2026-10-26T09:10',
      '2026-10-27T13:30',
      'Nissan',
      'Sentra',
      2016,
      'SEDAN',
      'PRS-205-C',
      'Luis Fernando Quiroz',
      'alexander',
      4800,
      1650,
      0,
      'tarjeta',
    ],
    [
      2822,
      'FS-26-000468',
      '2026-10-27T08:40',
      '2026-10-28T11:15',
      'Chevrolet',
      'Tornado',
      2019,
      'PICKUP',
      'NJ-2894-A',
      'Abel Ramírez Toledo',
      'daniel',
      3700,
      1240,
      0,
      'efectivo',
    ],
  ].map(
    ([
      orden,
      codigo,
      ingreso,
      entrega,
      marca,
      modelo,
      anio,
      carroceria,
      placas,
      cliente,
      tecnico,
      total,
      ref,
      tot,
      metodo,
    ]) => ({
      orden,
      codigo,
      estatus: 'ENTREGADO',
      ingreso,
      entrega,
      resumido: true,
      cliente: { nombre: cliente, telefono: null },
      vehiculo: v(marca, modelo, anio, null, placas, null, null, carroceria),
      tecnico,
      asesor: 'pablo',
      trabajos: [['Servicio (detalle en el historial)', total]],
      refacciones: [['Refacciones (resumen)', ref, '—', null, entrega.slice(0, 10)]],
      tot: tot ? [['Trabajo en otro taller', tot, '—', null, entrega.slice(0, 10)]] : [],
      pagos: [[entrega.slice(0, 10), metodo, total, p(Math.round(c(total) * CONFIG.comision[metodo])), 'Liquidación']],
    }),
  );

  // ---------------------------------------------------------------------------------------------------------------
  // Servicios en piso hoy (muestra), uno por estatus. La orden 2829 tiene dos servicios: el número de orden se
  // repite y el código no.
  // ---------------------------------------------------------------------------------------------------------------
  const enPiso = [
    {
      orden: 2827,
      codigo: 'FS-26-000473',
      estatus: 'EN_REPARACION',
      ingreso: '2026-10-25T10:20',
      cliente: { nombre: 'Martha Elena Rivas Ortega', telefono: '5541278830' },
      vehiculo: v('Nissan', 'Versa', 2019, 'Advance 1.6L', 'NHK-412-A', 'Plata', 68210, 'SEDAN', '3N1CN7AD5KL823014'),
      tecnico: 'daniel',
      asesor: 'pablo',
      falla: 'Rechinido al frenar y servicio por kilometraje.',
      trabajos: [
        ['Afinación mayor', 2900],
        ['Balatas y rectificado de discos delanteros', 1950],
      ],
      refacciones: [
        ['Kit de afinación (bujías y filtros)', 1160, 'Puebla', '5901', '2026-10-26'],
        ['Balatas delanteras', 620, 'Morales', '88', '2026-10-26'],
        ['Aceite 5W30 4 L', 520, 'Almacén propio', null, '2026-10-26'],
      ],
      tot: [],
      pagos: [['2026-10-25', 'transferencia', 2000, 0, 'Anticipo']],
    },
    {
      orden: 2828,
      codigo: 'FS-26-000474',
      estatus: 'ESPERANDO_REFACCION',
      ingreso: '2026-10-26T09:05',
      espera: 'Bomba de agua: Puebla la entrega el jueves 29',
      cliente: { nombre: 'Jorge Luis Pacheco Mena', telefono: '5583316702' },
      vehiculo: v('Chevrolet', 'Aveo', 2021, 'LT 1.5L', 'PHG-718-B', 'Azul', 39540, 'SEDAN', '3G1TA5CF7ML102938'),
      tecnico: 'christoper',
      asesor: 'pablo',
      falla: 'Se calienta en el tráfico; fuga de anticongelante.',
      trabajos: [
        ['Reemplazo de bomba de agua', 2400],
        ['Servicio al sistema de enfriamiento', 1100],
      ],
      refacciones: [
        ['Bomba de agua (pedida)', 1380, 'Puebla', null, null],
        ['Anticongelante 2 L', 260, 'Almacén propio', null, '2026-10-26'],
      ],
      tot: [],
      pagos: [],
    },
    {
      orden: 2829,
      codigo: 'FS-26-000475',
      grupo: 'FS-26-000475', // orden con dos carros: este es el folio 1
      estatus: 'COTIZADO',
      ingreso: '2026-10-26T11:30',
      cotizado: '2026-10-26T18:05',
      cliente: { nombre: 'Ricardo Salgado Uribe', telefono: '5520467719' },
      vehiculo: v('Volkswagen', 'Jetta', 2016, 'Sport 1.4T', 'MSL-605-A', 'Negro', 97830, 'SEDAN', '3VWD17AJ1GM301245'),
      tecnico: 'alexander',
      asesor: 'pablo',
      falla: 'Golpeteo en suspensión delantera al pasar topes.',
      trabajos: [
        ['Reemplazo de amortiguadores delanteros', 3800],
        ['Reemplazo de horquillas', 2600],
        ['Alineación y balanceo', 650],
      ],
      refacciones: [
        ['Amortiguadores delanteros (cotizado)', 2200, 'SAYM', null, null],
        ['Horquillas (cotizado)', 1340, 'Morales', null, null],
      ],
      tot: [],
      pagos: [],
    },
    {
      orden: 2829,
      codigo: 'FS-26-000475-2', // folio 2 de la misma orden: otro carro del mismo cliente, con su propio estatus
      grupo: 'FS-26-000475',
      estatus: 'RECIBIDO',
      ingreso: '2026-10-26T11:30',
      cliente: { nombre: 'Ricardo Salgado Uribe', telefono: '5520467719' },
      vehiculo: v('Nissan', 'Versa', 2019, 'Advance 1.6', 'NTR-418-B', 'Blanco', 64210, 'SEDAN'),
      tecnico: null,
      asesor: 'pablo',
      falla: 'Rayón y abolladura en la defensa trasera.',
      trabajos: [['Pintura y reparación de defensa trasera', 3600]],
      refacciones: [],
      tot: [['Hojalatería y pintura', 2400, 'Hojalatería Ramírez', null, null]],
      pagos: [],
    },
    {
      orden: 2830,
      codigo: 'FS-26-000477',
      estatus: 'COTIZADO',
      ingreso: '2026-10-27T08:50',
      cotizado: '2026-10-27T12:30',
      cliente: { nombre: 'Materiales Hernández', telefono: '5550918842', rfc: 'MHE060315BR4' },
      vehiculo: v(
        'Nissan',
        'NP300',
        2018,
        'Estaquitas 2.5L',
        'NE-6631-C',
        'Blanco',
        188420,
        'PICKUP',
        '3N6AD35C8JK874221',
      ),
      tecnico: 'daniel',
      asesor: 'pablo',
      falla: 'El clutch patina con carga.',
      trabajos: [
        ['Reemplazo de clutch', 5200],
        ['Rectificado de volante', 900],
      ],
      refacciones: [['Kit de clutch (cotizado)', 3150, 'Morales', null, null]],
      tot: [],
      pagos: [],
    },
    {
      orden: 2831,
      codigo: 'FS-26-000478',
      estatus: 'COTIZADO',
      ingreso: '2026-10-28T09:15',
      cotizado: '2026-10-28T11:15',
      cliente: { nombre: 'Ana Sofía Méndez Lara', telefono: '5536224190' },
      vehiculo: v('Kia', 'Rio', 2020, 'EX 1.6L', 'RBC-257-A', 'Rojo', 51880, 'SEDAN', '3KPA24AD1LE298374'),
      tecnico: 'christoper',
      asesor: 'pablo',
      falla: 'Le cuesta arrancar por las mañanas.',
      trabajos: [
        ['Servicio de mantenimiento menor', 1600],
        ['Reemplazo de batería', 2900],
      ],
      refacciones: [
        ['Batería LTH 42-500 (cotizado)', 1950, 'SAYM', null, null],
        ['Aceite y filtro', 520, 'Almacén propio', null, null],
      ],
      tot: [],
      pagos: [],
      tracking: 'k7Qw2mZ9pL4xT8vR',
    },
    {
      orden: 2832,
      codigo: 'FS-26-000479',
      estatus: 'EN_DIAGNOSTICO',
      ingreso: '2026-10-28T08:50',
      cliente: { nombre: 'Fernando Ibarra Solís', telefono: '5547702215' },
      vehiculo: v(
        'Toyota',
        'Hilux',
        2020,
        'Doble cabina Diésel 2.8L',
        'NT-1428-B',
        'Gris',
        121300,
        'PICKUP',
        'MR0KA3CD6L0712460',
      ),
      tecnico: 'alexander',
      asesor: 'pablo',
      falla: 'Ruido en la suspensión delantera y luz de check engine encendida.',
      trabajos: [],
      refacciones: [],
      tot: [],
      pagos: [],
    },
    {
      orden: 2833,
      codigo: 'FS-26-000480',
      estatus: 'TERMINADO',
      ingreso: '2026-10-27T09:40',
      terminado: '2026-10-28T13:40',
      cliente: { nombre: 'Daniela Castro Pineda', telefono: '5568120453' },
      vehiculo: v(
        'Mazda',
        'Mazda 3',
        2017,
        'i Touring 2.0L',
        'PKF-930-A',
        'Blanco',
        74620,
        'HATCHBACK',
        '3MZBN1L74HM118265',
      ),
      tecnico: 'daniel',
      asesor: 'pablo',
      falla: 'Servicio por kilometraje.',
      trabajos: [['Servicio de mantenimiento mayor', 4500]],
      refacciones: [
        ['Kit de mantenimiento mayor', 1260, 'Puebla', '5933', '2026-10-27'],
        ['Aceite 5 L', 450, 'Almacén propio', null, '2026-10-27'],
      ],
      tot: [],
      pagos: [['2026-10-27', 'efectivo', 1500, 0, 'Anticipo']],
    },
    {
      orden: 2834,
      codigo: 'FS-26-000481',
      estatus: 'TERMINADO',
      ingreso: '2026-10-26T10:10',
      terminado: '2026-10-28T15:05',
      cliente: { nombre: 'Héctor Manuel Gil Arreola', telefono: '5591834467' },
      vehiculo: v('Honda', 'CR-V', 2015, 'EX 2.4L', 'NZG-152-C', 'Gris', 132760, 'SUV', '5J6RM4H54FL038219'),
      tecnico: 'christoper',
      asesor: 'pablo',
      falla: 'El aire acondicionado no enfría.',
      trabajos: [
        ['Reemplazo de compresor de A/C', 7800],
        ['Carga de gas refrigerante', 900],
      ],
      refacciones: [
        ['Compresor de A/C', 4650, 'SAYM', '9912', '2026-10-27'],
        ['Gas refrigerante R134a', 380, 'Morales', '93', '2026-10-27'],
      ],
      tot: [],
      pagos: [['2026-10-26', 'tarjeta', 5000, 174.0, 'Anticipo']],
    },
    {
      orden: 2835,
      codigo: 'FS-26-000482',
      estatus: 'RECIBIDO',
      ingreso: '2026-10-28T09:40',
      cliente: { nombre: 'Sergio Ortiz Ramos', telefono: '5579046318' },
      vehiculo: v('Nissan', 'Tsuru', 2014, 'GS I 1.6L', 'NXW-406-A', 'Blanco', 214980, 'SEDAN', '3N1EB31S6EK348120'),
      tecnico: null,
      asesor: 'pablo',
      falla: 'No enciende en frío; tarda varios intentos.',
      trabajos: [],
      refacciones: [],
      tot: [],
      pagos: [],
    },
  ];

  // ---------------------------------------------------------------------------------------------------------------
  // Cálculo de utilidad de un servicio (fórmulas del Excel; reglas vigentes en especificación §3.4)
  //   venta neta        = cobrado − comisión del cobro
  //   utilidad refacc.  = costo de refacciones × margen (30 %)
  //   utilidad MO       = venta neta − refacciones − TOT − utilidad de refacciones
  //   utilidad          = utilidad MO + utilidad de refacciones
  //   horas MO          = utilidad MO ÷ tarifa por hora ($400)
  // Todo se opera en centavos y se devuelve en pesos. Diferencia conocida con la regla vigente: el Excel resta la
  // comisión antes de calcular las horas; la especificación la resta al final y le suma su IVA.
  // ---------------------------------------------------------------------------------------------------------------
  const sum = (rows, i) => rows.reduce((s, r) => s + c(r[i]), 0); // suma la columna i de las partidas, en centavos
  function calcular(o) {
    const total = sum(o.trabajos, 1);
    const costoRef = sum(o.refacciones, 1);
    const costoTot = sum(o.tot, 1);
    const pagado = sum(o.pagos, 2);
    const comision = sum(o.pagos, 3);
    const ventaNeta = pagado - comision; // lo que realmente entró
    const utilidadRef = Math.round(costoRef * CONFIG.margenRefacciones);
    const utilidadMO = ventaNeta - costoRef - costoTot - utilidadRef;
    return {
      total: p(total),
      costoRef: p(costoRef),
      costoTot: p(costoTot),
      pagado: p(pagado),
      saldo: p(total - pagado),
      comision: p(comision),
      ventaNeta: p(ventaNeta),
      utilidadRef: p(utilidadRef),
      utilidadMO: p(utilidadMO),
      utilidad: p(utilidadMO + utilidadRef),
      horasMO: p(utilidadMO) / CONFIG.tarifaHoraMO,
    };
  }

  // Comisión de un pago según su método, en centavos enteros: la comisión y, aparte, su IVA (16 %).
  // Ejemplo de la especificación: $1,000 por MercadoPago dan $29.00 de comisión más $4.64 de IVA.
  function comisionDe(metodo, monto) {
    const tasaBp = CONFIG.metodos[metodo]?.tasaBp || 0;
    const comision = Math.round((c(monto) * tasaBp) / 10000);
    const iva = Math.round(comision * CONFIG.iva);
    return { tasaBp, comision: p(comision), iva: p(iva), total: p(comision + iva) };
  }
  console.assert(comisionDe('mercadopago', 1000).comision === 29 && comisionDe('mercadopago', 1000).iva === 4.64);

  // DATOS DE MUESTRA: servicios tabulados con su precio de referencia (especificación §3.4). La partida guarda el
  // precio tabulado de ese día y el precio real, que puede variar. Sustituir por el tabulador real del taller.
  const TABULADOS = [
    ['Afinación mayor', 2850],
    ['Afinación menor', 1650],
    ['Cambio de aceite y filtro', 950],
    ['Cambio de balatas delanteras', 1450],
    ['Cambio de balatas traseras', 1350],
    ['Rectificado de discos (par)', 700],
    ['Cambio de amortiguadores delanteros', 2400],
    ['Alineación y balanceo', 650],
    ['Diagnóstico con escáner', 450],
    ['Servicio de frenos completo', 3200],
    ['Cambio de banda de distribución', 4800],
    ['Cambio de clutch', 6500],
    ['Servicio de enfriamiento (anticongelante)', 900],
    ['Cambio de batería', 350],
  ];

  const servicios = [...excel, ...resumen, ...enPiso].map((o) => ({ ...o, calc: calcular(o) }));

  // Prueba al cargar: las órdenes del Excel deben dar exactamente las cifras de la hoja (ver la consola).
  for (const o of excel) {
    const k = o.calc ?? calcular(o),
      e = o.excelEsperado;
    console.assert(Math.abs(k.ventaNeta - e.ventaNeta) < 0.005, `venta neta ${o.orden}`, k.ventaNeta, e.ventaNeta);
    console.assert(Math.abs(k.utilidadMO - e.utilidadMO) < 0.005, `utilidad MO ${o.orden}`, k.utilidadMO, e.utilidadMO);
    console.assert(
      Math.abs(k.utilidadRef - e.utilidadRef) < 0.005,
      `utilidad ref ${o.orden}`,
      k.utilidadRef,
      e.utilidadRef,
    );
    console.assert(Math.abs(k.utilidad - e.utilidad) < 0.005, `utilidad ${o.orden}`, k.utilidad, e.utilidad);
    console.assert(Math.abs(k.horasMO - e.horasMO) < 0.01, `horas MO ${o.orden}`, k.horasMO, e.horasMO);
  }
  console.assert(new Set(servicios.map((s) => s.codigo)).size === servicios.length, 'el código de servicio es único');

  // Enlace de seguimiento de cada servicio. Prototipo: token de 16 caracteres derivado del código;
  // en producción son 128 bits aleatorios (CSPRNG) que se guardan con hash y vencen.
  const B62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const token = (str) => {
    let h = 2166136261 >>> 0,
      out = '';
    for (let i = 0; i < 16; i++) {
      for (const ch of str + i) {
        h ^= ch.charCodeAt(0);
        h = Math.imul(h, 16777619) >>> 0;
      }
      out += B62[h % 62];
    }
    return out;
  };
  // El enlace de seguimiento es de la orden: los folios de una misma orden comparten el token (§3.1).
  servicios.forEach((x) => {
    x.tracking = x.tracking || token(x.grupo || x.codigo);
  });

  // DATOS DE MUESTRA: cobrado mensual de los meses anteriores a octubre de 2026 (el Excel solo trae octubre).
  // Sustituir por el historial real al migrar; octubre sale siempre de los pagos de `servicios`.
  const HISTORICO = {
    2024: [71200, 66800, 82500, 88900, 93400, 87100, 98300, 101700, 96200, 104600, 111900, 129500],
    2025: [96500, 88200, 109400, 112800, 121300, 108900, 126700, 131200, 124500, 133800, 140200, 162400],
    2026: [118400, 102300, 131900, 126500, 139800, 121200, 147600, 152300, 143900],
  };

  window.FS = Object.assign(window.FS || {}, {
    CONFIG,
    PERSONAL,
    servicios,
    calcular,
    comisionDe,
    TABULADOS,
    c,
    p,
    HISTORICO,
  });
})();
