// Máquina de estados del servicio (especificación §3.2).
//
// Patrón: máquina de estados declarativa. Cada estatus se describe una sola vez (etiqueta, color, paso de la barra de
// avance) y las transiciones permitidas viven en una tabla. Ninguna pantalla decide por su cuenta cuál es el siguiente
// estatus ni qué fecha se sella: todas llaman a `avanzar()`, `autorizar()` o `entregar()` de este módulo.
//
// Lo usan el ERP (app.js, fase3.js) y el portal del cliente (portal.js). Pendiente respecto a la especificación:
// el estatus CANCELADO y el reparto por folio (el prototipo trabaja un carro por servicio).
(() => {
  // ---------- catálogo de estatus ----------
  // label: texto en la UI · pill: variante de color de la etiqueta · paso: posición en la barra de avance (PASOS)
  const ESTATUS = {
    RECIBIDO: { label: 'Recibido', pill: '', paso: 0 },
    EN_DIAGNOSTICO: { label: 'En diagnóstico', pill: 'info', paso: 1 },
    COTIZADO: { label: 'Por autorizar', pill: 'warn', paso: 2 },
    AUTORIZADO: { label: 'Autorizado', pill: 'info', paso: 3 },
    EN_REPARACION: { label: 'En reparación', pill: 'info', paso: 4 },
    ESPERANDO_REFACCION: { label: 'Esperando refacción', pill: 'warn', paso: 4 },
    TERMINADO: { label: 'Listo para entregar', pill: 'pos', paso: 5 },
    ENTREGADO: { label: 'Entregado', pill: '', paso: 6 },
  };

  // Barra de avance del detalle de la orden: un paso por etapa visible (EN_REPARACION y ESPERANDO_REFACCION comparten).
  const PASOS = ['Recibido', 'Diagnóstico', 'Cotización', 'Autorizado', 'Reparación', 'Terminado', 'Entregado'];

  // ---------- transiciones ----------
  // Tabla completa de lo permitido. EN_REPARACION ⇄ ESPERANDO_REFACCION es el único ciclo.
  const TRANSICIONES = {
    RECIBIDO: ['EN_DIAGNOSTICO'],
    EN_DIAGNOSTICO: ['COTIZADO'],
    COTIZADO: ['AUTORIZADO'],
    AUTORIZADO: ['EN_REPARACION'],
    EN_REPARACION: ['TERMINADO', 'ESPERANDO_REFACCION'],
    ESPERANDO_REFACCION: ['EN_REPARACION'],
    TERMINADO: ['ENTREGADO'],
    ENTREGADO: [],
  };

  // Avance "normal" que ofrece el botón principal del detalle. COTIZADO y TERMINADO no avanzan con este botón:
  // el primero espera la autorización del cliente y el segundo se cierra con el cobro y la entrega.
  const AVANCE = {
    RECIBIDO: 'EN_DIAGNOSTICO',
    EN_DIAGNOSTICO: 'COTIZADO',
    AUTORIZADO: 'EN_REPARACION',
    EN_REPARACION: 'TERMINADO',
    ESPERANDO_REFACCION: 'EN_REPARACION',
  };

  // Fecha que se sella al entrar a cada estatus (alimenta avisos de 24 h, tiempos en taller y el portal).
  const SELLO = { COTIZADO: 'cotizado', TERMINADO: 'terminado', ENTREGADO: 'entrega' };

  // Orden de atención en el piso del taller: primero lo que está detenido esperando a alguien.
  const PRIORIDAD = {
    COTIZADO: 0,
    ESPERANDO_REFACCION: 1,
    TERMINADO: 2,
    EN_REPARACION: 3,
    EN_DIAGNOSTICO: 4,
    AUTORIZADO: 4,
    RECIBIDO: 5,
    ENTREGADO: 6,
  };

  // ---------- consultas ----------
  const etiqueta = (estatus) => ESTATUS[estatus]?.label ?? estatus;
  const puedeIr = (de, a) => (TRANSICIONES[de] || []).includes(a);
  const siguiente = (estatus) => AVANCE[estatus] || null;
  const abierto = (servicio) => servicio.estatus !== 'ENTREGADO';

  // ---------- cambios de estatus ----------
  // Único punto donde un servicio cambia de estatus. Rechaza saltos que la tabla no permite.
  function cambiar(servicio, destino, ahora) {
    if (!puedeIr(servicio.estatus, destino)) {
      throw new Error(`Transición no permitida: ${servicio.estatus} → ${destino}`);
    }
    servicio.estatus = destino;
    if (SELLO[destino]) servicio[SELLO[destino]] = ahora;
    return servicio;
  }

  const avanzar = (servicio, ahora) => {
    const destino = siguiente(servicio.estatus);
    return destino ? cambiar(servicio, destino, ahora) : null;
  };
  const autorizar = (servicio, ahora) => cambiar(servicio, 'AUTORIZADO', ahora);
  const entregar = (servicio, ahora) => cambiar(servicio, 'ENTREGADO', ahora);

  // ---------- comprobaciones al cargar ----------
  // Cada avance del botón principal debe ser una transición válida.
  Object.entries(AVANCE).forEach(([de, a]) => console.assert(puedeIr(de, a), `avance inválido ${de} → ${a}`));

  window.FS = window.FS || {};
  window.FS.Estados = {
    ESTATUS,
    PASOS,
    TRANSICIONES,
    PRIORIDAD,
    etiqueta,
    puedeIr,
    siguiente,
    abierto,
    cambiar,
    avanzar,
    autorizar,
    entregar,
  };
})();
