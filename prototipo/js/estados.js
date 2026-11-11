// Máquina de estados del servicio (especificación §3.2).
//
// Patrón: máquina de estados declarativa. Cada estatus se describe una sola vez (etiqueta, color, paso de la barra de
// avance) y las transiciones permitidas viven en una tabla. Ninguna pantalla decide por su cuenta cuál es el siguiente
// estatus ni qué fecha se sella: todas llaman a `avanzar()`, `autorizar()` o `entregar()` de este módulo.
//
// Lo usan el ERP (app.js, fase3.js) y el portal del cliente (portal.js). Cada servicio del prototipo es un folio
// (un carro); los folios de una misma orden comparten `grupo`. Pendiente respecto a la especificación: el reparto
// de un pago entre folios (pregunta abierta, §6).
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
    CANCELADO: { label: 'Cancelado', pill: 'neg', paso: 0 },
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
    CANCELADO: [],
  };
  // Cualquier estatus anterior a ENTREGADO puede cancelarse (con motivo).
  Object.keys(TRANSICIONES)
    .filter((k) => !['ENTREGADO', 'CANCELADO'].includes(k))
    .forEach((k) => TRANSICIONES[k].push('CANCELADO'));

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
    CANCELADO: 7,
  };

  // ---------- consultas ----------
  const etiqueta = (estatus) => ESTATUS[estatus]?.label ?? estatus;
  const puedeIr = (de, a) => (TRANSICIONES[de] || []).includes(a);
  const siguiente = (estatus) => AVANCE[estatus] || null;
  const abierto = (servicio) => !['ENTREGADO', 'CANCELADO'].includes(servicio.estatus);

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
  // Cancelar exige motivo y recuerda en qué estatus estaba (también cuando el cliente rechaza toda la cotización).
  function cancelar(servicio, ahora, motivo) {
    if (!String(motivo || '').trim()) throw new Error('La cancelación exige un motivo');
    const desde = servicio.estatus;
    cambiar(servicio, 'CANCELADO', ahora);
    servicio.cancelado = { fecha: ahora, motivo: String(motivo).trim(), desde };
    return servicio;
  }

  // El avance de la orden se calcula de sus folios: la orden no tiene estatus propio (§3.1).
  const resumenOrden = (folios) => {
    const vivos = folios.filter((f) => f.estatus !== 'CANCELADO');
    const de = (e) => vivos.filter((f) => f.estatus === e).length;
    const n = vivos.length,
      carros = (x) => `${x} de ${n} ${n === 1 ? 'carro' : 'carros'}`;
    if (!n) return 'Orden cancelada';
    if (de('ENTREGADO') === n) return n === 1 ? 'Entregado' : `${n} carros entregados`;
    if (de('ENTREGADO') + de('TERMINADO') === n) return `${carros(de('TERMINADO'))} listos para entregar`;
    if (de('TERMINADO') + de('ENTREGADO')) return `${carros(de('TERMINADO') + de('ENTREGADO'))} listos`;
    if (de('COTIZADO')) return `${carros(de('COTIZADO'))} por autorizar`;
    return `${carros(n - de('RECIBIDO'))} en proceso`;
  };

  // ---------- comprobaciones al cargar ----------
  // Cada avance del botón principal debe ser una transición válida.
  Object.entries(AVANCE).forEach(([de, a]) => console.assert(puedeIr(de, a), `avance inválido ${de} → ${a}`));
  console.assert(puedeIr('TERMINADO', 'CANCELADO') && !puedeIr('ENTREGADO', 'CANCELADO'), 'cancelación');
  console.assert(
    resumenOrden([{ estatus: 'TERMINADO' }, { estatus: 'EN_REPARACION' }, { estatus: 'CANCELADO' }]) ===
      '1 de 2 carros listos',
    'avance de la orden',
  );

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
    cancelar,
    resumenOrden,
  };
})();
