// =====================================================================================================================
// Almacén del prototipo: guarda el estado en este navegador y lo comparte entre el ERP y el portal
// ---------------------------------------------------------------------------------------------------------------------
// Sin backend, lo capturado se perdía al recargar y el portal no veía lo que pasaba en el ERP. Este módulo:
//   1. guarda una copia del estado (servicios, compras, gastos, citas, movimientos, empleados y bitácora) en
//      localStorage, bajo una sola llave con versión;
//   2. la restaura al cargar, sobre los mismos arreglos que ya usan los demás módulos (no cambia referencias);
//   3. avisa a las otras pestañas (evento `storage`): lo que el cliente autoriza en el portal aparece en el ERP;
//   4. expone la bitácora común `FS.auditar()` (especificación §3.7).
//
// Lo que se lee de localStorage se trata como dato no confiable: se valida su forma antes de usarlo y todo se
// sigue escapando al pintar. En producción esto lo sustituyen la API y PostgreSQL (especificación §4).
//
// Se carga después de los datos (datos.js … datos4.js) y antes de las pantallas (app.js, portal.js).
// =====================================================================================================================
(() => {
  const F = window.FS;
  const LLAVE = 'fs-datos';
  // Sube este número cuando cambien los datos de muestra o su forma: descarta lo guardado con la versión anterior.
  const VERSION = 2;
  const MAX_BITACORA = 500;

  // Arreglos que se guardan si existen en esta página (el portal solo carga servicios).
  const COLECCIONES = [
    'servicios',
    'compras',
    'gastos',
    'citas',
    'recordatorios',
    'manuales',
    'empleados',
    'auditoria',
  ];

  F.auditoria = F.auditoria || [];

  // ---------------------------------------------------------------------------------------------------------------
  // Serialización
  // Una compra apunta a su renglón dentro de la orden (`linea`, la misma referencia que s.refacciones o s.tot).
  // JSON no guarda referencias: se guarda la posición del renglón y se vuelve a enlazar al restaurar.
  // ---------------------------------------------------------------------------------------------------------------
  const listaDe = (s, tipo) => (tipo === 'TOT' ? s.tot : s.refacciones);
  const sinCalculo = ({ calc, ...s }) => s; // la utilidad nunca se guarda: se recalcula
  const compraPlana = ({ linea, ...c }) => {
    const s = F.servicios.find((x) => x.codigo === c.servicio);
    return { ...c, pos: s && linea ? listaDe(s, c.tipo).indexOf(linea) : -1 };
  };

  function foto() {
    const datos = { v: VERSION, siguienteOrden: F.CONFIG.siguienteOrden, taller: F.CONFIG.tallerDatos };
    COLECCIONES.forEach((k) => {
      if (!Array.isArray(F[k])) return;
      datos[k] = k === 'servicios' ? F[k].map(sinCalculo) : k === 'compras' ? F[k].map(compraPlana) : F[k];
    });
    return datos;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Validación de lo guardado (dato no confiable)
  // ---------------------------------------------------------------------------------------------------------------
  const esLista = Array.isArray;
  const esTexto = (v) => typeof v === 'string';
  const ID = /^[\w-]{1,48}$/;
  const diagnosticoValido = (d) =>
    d &&
    esTexto(d.fecha) &&
    d.puntos &&
    typeof d.puntos === 'object' &&
    Object.entries(d.puntos).every(([k, v]) => /^[a-z]{1,24}:\d{1,2}$/.test(k) && esLista(v) && esTexto(v[0]));
  // La firma se dibuja como SVG a partir de sus trazos: solo se aceptan números, y un sello hexadecimal o ninguno.
  const recepcionValida = (r) =>
    r &&
    ID.test(r.tecnico) &&
    esTexto(r.hora) &&
    F.Firma.valida(r.trazos) &&
    (r.hash === null || /^[0-9a-f]{64}$/.test(r.hash));
  const servicioValido = (s) =>
    s &&
    esTexto(s.codigo) &&
    /^[A-Z0-9-]{3,24}$/.test(s.codigo) &&
    Number.isFinite(+s.orden) &&
    Object.hasOwn(F.Estados.ESTATUS, s.estatus) &&
    s.cliente &&
    esTexto(s.cliente.nombre) &&
    s.vehiculo &&
    esTexto(s.vehiculo.marca) &&
    (s.tracking === undefined || /^[A-Za-z0-9]{16,64}$/.test(s.tracking)) &&
    (s.tecnico == null || ID.test(s.tecnico)) &&
    (s.grupo === undefined || /^[A-Z0-9-]{3,24}$/.test(s.grupo)) &&
    (s.apoyo === undefined || (esLista(s.apoyo) && s.apoyo.every((x) => ID.test(x)))) &&
    (s.cancelado === undefined || (s.cancelado && esTexto(s.cancelado.motivo))) &&
    (s.recepcion === undefined || recepcionValida(s.recepcion)) &&
    (s.diagnostico === undefined || diagnosticoValido(s.diagnostico)) &&
    [s.trabajos, s.refacciones, s.tot, s.pagos].every(esLista) &&
    [...s.trabajos, ...s.refacciones, ...s.tot].every((r) => esLista(r) && Number.isFinite(+r[1])) &&
    s.pagos.every((r) => esLista(r) && Number.isFinite(+r[2]) && Number.isFinite(+r[3]));

  function leer() {
    try {
      const d = JSON.parse(localStorage.getItem(LLAVE) || 'null');
      if (!d || d.v !== VERSION || !esLista(d.servicios) || !d.servicios.every(servicioValido)) return null;
      if (COLECCIONES.some((k) => d[k] !== undefined && !esLista(d[k]))) return null;
      // Los identificadores se usan en atributos y enlaces: solo letras, números, guion y guion bajo.
      const idValido = (x) => x && typeof x === 'object' && (x.id === undefined || /^[\w-]{1,48}$/.test(String(x.id)));
      if (COLECCIONES.some((k) => k !== 'servicios' && k !== 'auditoria' && d[k] && !d[k].every(idValido))) return null;
      return d;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Restaurar: vacía cada arreglo y lo vuelve a llenar, para que los módulos conserven su referencia
  // ---------------------------------------------------------------------------------------------------------------
  const rellenar = (destino, origen) => {
    destino.length = 0;
    destino.push(...origen);
  };

  function restaurar(d) {
    rellenar(
      F.servicios,
      d.servicios.map((s) => ({ ...s, orden: +s.orden, calc: F.calcular(s) })),
    );
    COLECCIONES.forEach((k) => {
      if (k === 'servicios' || !esLista(F[k]) || !esLista(d[k])) return;
      rellenar(F[k], d[k]);
    });
    (F.compras || []).forEach((c) => {
      const s = F.servicios.find((x) => x.codigo === c.servicio);
      c.linea = s && c.pos >= 0 ? listaDe(s, c.tipo)[c.pos] : undefined;
      delete c.pos;
    });
    if (Number.isFinite(+d.siguienteOrden)) F.CONFIG.siguienteOrden = +d.siguienteOrden;
    if (d.taller && typeof d.taller === 'object')
      Object.keys(F.CONFIG.tallerDatos).forEach((k) => {
        if (esTexto(d.taller[k])) F.CONFIG.tallerDatos[k] = d.taller[k].slice(0, 200);
      });
    // Las pantallas buscan a cada persona en PERSONAL: se agregan los empleados dados de alta en la demostración y
    // se suelta la asignación a alguien que ya no existe, para que ninguna orden apunte a un desconocido.
    (F.empleados || []).forEach((e) => {
      if (!F.PERSONAL[e.id]) F.PERSONAL[e.id] = { nombre: String(e.nombre || ''), rol: String(e.rol || ''), tono: 200 };
    });
    F.servicios.forEach((s) => {
      if (s.tecnico && !F.PERSONAL[s.tecnico]) s.tecnico = null;
      if (s.apoyo) s.apoyo = s.apoyo.filter((x) => F.PERSONAL[x] && x !== s.tecnico);
      if (!F.PERSONAL[s.asesor]) s.asesor = 'pablo';
    });
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Guardar
  // Lo que esta página no carga (por ejemplo, las compras en el portal) se conserva tal como estaba guardado.
  // ---------------------------------------------------------------------------------------------------------------
  let ultimo = '';
  function guardar() {
    try {
      const txt = JSON.stringify({ ...(leer() || {}), ...foto() });
      if (txt === ultimo) return;
      localStorage.setItem(LLAVE, txt);
      ultimo = txt;
    } catch {
      // Sin espacio o en modo privado: la demostración sigue funcionando en memoria.
    }
  }

  // Cualquier captura termina en un clic, un cambio o un envío de formulario: se guarda poco después.
  let espera = 0;
  const programar = () => {
    clearTimeout(espera);
    espera = setTimeout(guardar, 350);
  };
  ['click', 'change', 'submit'].forEach((ev) => document.addEventListener(ev, programar, true));
  addEventListener('pagehide', guardar);

  // Otra pestaña guardó (el portal autorizó, el ERP avanzó el estatus): se restaura y se avisa a la pantalla.
  addEventListener('storage', (e) => {
    if (e.key !== LLAVE) return;
    const d = leer();
    if (!d) return;
    restaurar(d);
    ultimo = e.newValue || '';
    F.alCambiarAlmacen?.();
  });

  // ---------------------------------------------------------------------------------------------------------------
  // Bitácora común (especificación §3.7): quién, cuándo, qué había y qué quedó. Nunca se edita ni se borra.
  // ---------------------------------------------------------------------------------------------------------------
  function auditar(quien, accion, antes = null, despues = null, servicio = null) {
    F.auditoria.unshift({ fecha: new Date().toISOString(), quien, accion, antes, despues, servicio });
    if (F.auditoria.length > MAX_BITACORA) F.auditoria.length = MAX_BITACORA;
    programar();
  }

  // Vuelve a los datos de muestra. Conserva tema, rol, permisos y fotos (son otras llaves).
  function reiniciar() {
    try {
      localStorage.removeItem(LLAVE);
    } catch {}
    location.reload();
  }

  // Enlace de seguimiento para un servicio nuevo: 16 caracteres al azar con el generador criptográfico del navegador.
  // En producción son 128 bits, se guarda solo su hash y vence (SEGURIDAD.md).
  const B62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  function tokenNuevo() {
    let out = '';
    while (out.length < 16) {
      const [b] = crypto.getRandomValues(new Uint8Array(1));
      if (b < 248) out += B62[b % 62]; // 248 = 62 × 4: se descarta el resto para no sesgar
    }
    return out;
  }

  const guardado = leer();
  if (guardado) restaurar(guardado);
  ultimo = guardado ? localStorage.getItem(LLAVE) : '';

  Object.assign(F, { guardar, reiniciar, auditar, tokenNuevo, hayDatosGuardados: () => !!leer() });
})();
