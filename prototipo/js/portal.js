// =====================================================================================================================
// Portal del cliente (prototipo)
// ---------------------------------------------------------------------------------------------------------------------
// Se abre con el enlace de seguimiento que llega por WhatsApp (portal.html#<token>). Solo muestra precios al cliente:
// nunca costos, utilidad, proveedores ni notas internas (especificación §3.8).
// Pestañas: Estado, Cotización (con autorización por código de un solo uso), Vehículo e Historial.
// Los nombres de estatus salen de js/estados.js; aquí solo se agregan los textos dirigidos al cliente.
// =====================================================================================================================
(() => {
  const { CONFIG, servicios, Estados } = window.FS;
  const root = document.getElementById('p');
  const esc = (v) =>
    String(v ?? '').replace(
      /[&<>"']/g,
      (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
    );
  const money = (v) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(v);
  const fecha = (iso) =>
    new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(iso)).replace('.', '');
  const fh = (iso) => `${fecha(iso)}, ${new Date(iso).toTimeString().slice(0, 5)}`;
  const AHORA = new Date(CONFIG.ahora);
  const calmo = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wa = `https://wa.me/52${CONFIG.whatsapp.replace(/\s/g, '')}`;

  // ---------------------------------------------------------------------------------------------------------------
  // Tema de color (el mismo del ERP)
  // ---------------------------------------------------------------------------------------------------------------
  const TEMAS = [
    ['deportivo', 'Rojo'],
    ['oscuro', 'Oscuro'],
    ['clasico', 'Claro'],
  ];
  let tema = document.documentElement.getAttribute('data-theme') || 'deportivo';
  const pintarTema = () => {
    document.getElementById('tema-n').textContent = (TEMAS.find((t) => t[0] === tema) || TEMAS[0])[1];
  };
  pintarTema();
  document.getElementById('tema').addEventListener('click', () => {
    tema = TEMAS[(TEMAS.findIndex((t) => t[0] === tema) + 1) % 3][0];
    const aplicar = () => {
      document.documentElement.setAttribute('data-theme', tema);
      try {
        localStorage.setItem('fs-tema', tema);
      } catch {}
      pintarTema();
    };
    document.startViewTransition && !calmo() ? document.startViewTransition(aplicar) : aplicar();
  });

  // ---------------------------------------------------------------------------------------------------------------
  // Acceso por token: si no corresponde a ningún servicio, la respuesta no revela si existe
  // ---------------------------------------------------------------------------------------------------------------
  const token = location.hash.slice(1);
  // El enlace es de la orden: si trae varios carros, el cliente elige cuál ver (cada uno con su estatus).
  const mios = () => servicios.filter((x) => x.tracking && x.tracking === token);
  let s = mios()[0];
  if (!s) {
    // respuesta uniforme ante un token inválido: no da pistas de si existe
    root.innerHTML = `<section class="card-p"><h1 style="font-size:22px;font-weight:650">Enlace no disponible</h1><p class="vacio">Este enlace de seguimiento no es válido o ya venció. Pide uno nuevo al taller.</p></section>
      <a class="wa" style="margin-top:14px" href="${wa}" target="_blank" rel="noopener">Escribir al taller por WhatsApp</a>`;
    document.getElementById('aviso-link').addEventListener('click', (e) => e.preventDefault());
    return;
  }

  // Etapas que ve el cliente (más simples que la máquina interna) e índice de cada estatus en ellas.
  const ETAPAS = [
    ['RECIBIDO', 'Recibido'],
    ['EN_DIAGNOSTICO', 'Diagnóstico'],
    ['COTIZADO', 'Cotización'],
    ['EN_REPARACION', 'Reparación'],
    ['TERMINADO', 'Listo para entregar'],
  ];
  const IDX = {
    RECIBIDO: 0,
    EN_DIAGNOSTICO: 1,
    COTIZADO: 2,
    AUTORIZADO: 3,
    EN_REPARACION: 3,
    ESPERANDO_REFACCION: 3,
    TERMINADO: 4,
    ENTREGADO: 4,
    CANCELADO: 0,
  };
  // Mensaje principal para el cliente en cada estatus: [título, detalle, tono].
  const NOW = {
    RECIBIDO: ['Recibimos tu vehículo', 'Un técnico lo revisará hoy.', ''],
    EN_DIAGNOSTICO: ['Estamos revisando tu vehículo', 'Verás la cotización aquí al terminar el diagnóstico.', ''],
    COTIZADO: ['Tu cotización está lista', 'Revísala y autorízala para empezar la reparación.', 'warn'],
    AUTORIZADO: ['Autorizaste la reparación', 'Ya pedimos las refacciones. Aquí verás cuándo esté listo.', ''],
    EN_REPARACION: ['Estamos reparando tu vehículo', 'Aquí verás cuándo esté listo.', ''],
    ESPERANDO_REFACCION: ['Esperamos una refacción', 'En cuanto llegue seguimos con la reparación.', 'warn'],
    TERMINADO: ['Tu vehículo está listo', 'Puedes pasar por él en horario del taller.', 'pos'],
    ENTREGADO: ['Entregado', 'Gracias por tu confianza.', 'neu'],
    CANCELADO: ['Este servicio se canceló', 'Si tienes dudas, escríbele al taller.', 'neu'],
  };
  // Etiqueta corta de cada estatus: la misma del ERP.
  const PILL = Object.fromEntries(Object.keys(Estados.ESTATUS).map((k) => [k, Estados.etiqueta(k)]));
  const DANO = {
    rayon: ['R', 'Rayón', 'rayon'],
    golpe: ['G', 'Golpe o abolladura', 'golpe'],
    estrellado: ['E', 'Estrellado o roto', 'estrellado'],
    faltante: ['F', 'Faltante', 'faltante'],
  };
  const tel = s.cliente.telefono;
  const telMask = tel ? `${tel.slice(0, 2)} •••• ${tel.slice(-4)}` : 'el teléfono que registraste';
  const total = () => s.trabajos.reduce((t, [, v]) => t + v, 0);
  const rel = () => {
    const f = [s.ingreso, s.cotizado, s.terminado, s.entrega]
      .filter(Boolean)
      .map((x) => new Date(x))
      .sort((a, b) => b - a)[0];
    const h = Math.floor((AHORA - f) / 3600e3);
    return h < 1 ? 'hace unos minutos' : h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
  };

  // ---------------------------------------------------------------------------------------------------------------
  // Pantallas del portal (una función por pestaña, despachadas por la tabla VISTAS)
  // ---------------------------------------------------------------------------------------------------------------
  const TABS = [
    ['est', 'Estado'],
    ['cot', 'Cotización'],
    ['veh', 'Vehículo'],
    ['his', 'Historial'],
  ];
  let tab = 'est',
    autorizadoAhora = false;

  function hero() {
    const i = IDX[s.estatus],
      [now, sub] = NOW[s.estatus],
      pct = s.estatus === 'ENTREGADO' ? 100 : Math.max(6, (i / 4) * 100),
      cls = NOW[s.estatus][2];
    return `<section class="p-hero" aria-labelledby="h1">
      <div class="p-hero-top"><div>
        <p class="hi">Hola ${esc(s.cliente.nombre.split(' ')[0])}</p>
        <h1 id="h1">${esc(s.vehiculo.marca)} ${esc(s.vehiculo.modelo)} ${esc(s.vehiculo.anio)}</h1>
        <p class="veh">Placas ${esc(s.vehiculo.placas)} · orden ${esc(s.orden)}</p>
      </div><div id="emblema-sitio"></div></div>
      <span class="p-pill ${cls}">${PILL[s.estatus]}</span>
      ${
        s.estatus === 'CANCELADO'
          ? ''
          : `<div class="p-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="Avance del servicio"><i style="--w:${pct}%"></i></div>
      <div class="p-steps" aria-hidden="true"><span>Recibido</span><span>Reparación</span><span>Listo</span></div>`
      }
      <p class="p-now">${now}</p><p class="p-sub">${sub}${s.estatus === 'ESPERANDO_REFACCION' && s.espera ? ` ${esc(s.espera)}.` : ''}</p>
      <p class="p-upd">Actualizado ${rel()}</p>
    </section>`;
  }

  function vistaEstado() {
    const i = IDX[s.estatus],
      fechas = { 0: s.ingreso, 1: s.ingreso, 2: s.cotizado, 4: s.terminado };
    return `<section class="card-p" aria-labelledby="t-h"><h2 id="t-h">Avance de tu servicio</h2>
      <ol class="tl">${ETAPAS.map(([, l], k) => `<li class="${k < i || (k === i && s.estatus === 'ENTREGADO') ? 'done' : k === i ? 'cur' : ''}" style="--i:${k}"${k === i ? ' aria-current="step"' : ''}><i aria-hidden="true"></i><span>${l}</span>${k <= i && fechas[k] ? `<time>${fh(fechas[k])}</time>` : ''}</li>`).join('')}</ol>
    </section>
    <section class="card-p" aria-labelledby="d-h"><h2 id="d-h">Lo que nos dijiste</h2><p class="said">“${esc(s.falla)}”</p></section>`;
  }

  function vistaCotizacion() {
    if (!s.trabajos.length)
      return `<section class="card-p"><h2>Cotización</h2><p class="vacio">Todavía no hay cotización. Aparecerá aquí cuando termine el diagnóstico.</p></section>`;
    const pagado = s.pagos.reduce((t, [, , v]) => t + v, 0),
      saldo = Math.max(0, total() - pagado);
    return `<section class="card-p" aria-labelledby="q-h">
      <h2 id="q-h">${s.estatus === 'COTIZADO' ? 'Cotización por autorizar' : 'Trabajos autorizados'}</h2>
      ${s.trabajos.map(([d, v]) => `<div class="q-row"><span>${esc(d)}</span><span class="num">${money(v)}</span></div>`).join('')}
      <div class="q-total"><span>Total</span><span class="num" id="q-tot">${money(total())}</span></div>
      <p class="q-note">Precio con refacciones y mano de obra incluidas.</p>
      ${s.estatus === 'COTIZADO' ? `<button class="btn primary big-btn" type="button" id="auth">Autorizar ${money(total())}</button>` : ''}
      ${autorizadoAhora ? `<div class="ok" role="status"><svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="14" cy="14" r="11"/><path d="m8.5 14.5 3.8 3.8 7.2-8"/></svg><span>Autorizaste la reparación el ${fh(CONFIG.ahora)}. Puedes volver a este enlace para ver cuándo esté listo.</span></div>` : ''}
    </section>
    ${s.pagos.length ? `<section class="card-p"><h2>Tus pagos</h2>${s.pagos.map(([f, , v, , c]) => `<div class="pago"><span>${esc(c)}</span><small>${fecha(f)}</small><span class="num">${money(v)}</span></div>`).join('')}<div class="saldo"><span>${saldo ? 'Saldo por pagar' : 'Liquidado'}</span><span class="num">${money(saldo)}</span></div></section>` : ''}`;
  }

  function vistaVehiculo() {
    const v = s.vehiculo,
      danos = s.danos || [];
    return `<section class="card-p" aria-labelledby="v-h"><h2 id="v-h">Tu vehículo</h2>
      <dl class="datos">
        <div><dt>Vehículo</dt><dd>${esc(v.marca)} ${esc(v.modelo)} ${esc(v.anio)}</dd></div>
        <div><dt>Placas</dt><dd>${esc(v.placas)}</dd></div>
        ${v.color ? `<div><dt>Color</dt><dd>${esc(v.color)}</dd></div>` : ''}
        ${v.km ? `<div><dt>Kilometraje al ingresar</dt><dd>${new Intl.NumberFormat('es-MX').format(v.km)} km</dd></div>` : ''}
        <div><dt>Ingresó</dt><dd>${fh(s.ingreso)}</dd></div>
        <div><dt>Recibió</dt><dd>${esc(window.FS.PERSONAL[s.asesor]?.nombre || 'Fortaleza Servicar')}</dd></div>
      </dl></section>
    <section class="card-p" aria-labelledby="dm-h"><h2 id="dm-h">Daños registrados al recibirlo</h2>
      ${
        danos.length
          ? `<div class="dmg-l">${danos
              .map((d) => {
                const [l, n, k] = DANO[d.tipo];
                return `<div class="t-${k}"><span class="dot">${l}</span><span>${n}${d.nota ? ` · ${esc(d.nota)}` : ''}</span></div>`;
              })
              .join('')}</div>`
          : '<p class="vacio">Sin daños anotados en la recepción.</p>'
      }
    </section>`;
  }

  function vistaHistorial() {
    const otros = servicios.filter((x) => x.cliente.nombre === s.cliente.nombre && x.codigo !== s.codigo);
    return `<section class="card-p" aria-labelledby="hi-h"><h2 id="hi-h">Tus otros servicios</h2>
      ${otros.length ? otros.map((x) => `<div class="h-row"><b>${esc(x.vehiculo.marca)} ${esc(x.vehiculo.modelo)} ${esc(x.vehiculo.anio)}</b><small>${fecha(x.ingreso)} · ${PILL[x.estatus]}</small>${x.trabajos.length ? `<span class="num">${money(x.trabajos.reduce((t, [, v]) => t + v, 0))}</span>` : ''}</div>`).join('') : '<p class="vacio">Este es tu primer servicio con nosotros. Aquí aparecerán los siguientes.</p>'}
    </section>`;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Emblema del servicio: el escudo con un anillo que marca el avance
  // El contenedor se crea una sola vez y se vuelve a colocar en cada pintado, así el lienzo 3D no se reinicia.
  // Arranca con un SVG estático (escudo y arco de avance); js/escena3d.js lo sustituye por la versión 3D solo en
  // equipos que pueden con ella. El dato ya lo anuncia la barra de progreso: el emblema es decorativo.
  // ---------------------------------------------------------------------------------------------------------------
  const avance = () => (s.estatus === 'ENTREGADO' ? 1 : IDX[s.estatus] / 4);
  const R_ARCO = 41,
    LARGO = 2 * Math.PI * R_ARCO;
  const emblema = document.createElement('div');
  emblema.className = 'p-emblema';
  emblema.setAttribute('aria-hidden', 'true');
  emblema.innerHTML = `<svg viewBox="0 0 96 96" fill="none">
    <circle class="pista" cx="48" cy="48" r="${R_ARCO}" stroke-width="4"/>
    <circle class="arco" cx="48" cy="48" r="${R_ARCO}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${LARGO}" transform="rotate(-90 48 48)"/>
    <g transform="translate(29 26) scale(1.46)"><path class="escudo" d="M13 1 24.5 5v9.2c0 7-4.9 12.6-11.5 14.8C6.4 26.8 1.5 21.2 1.5 14.2V5Z"/><path class="efe" d="M9 8.5h8.6v2.8h-5.6v2.6h4.8v2.8h-4.8v5.8H9Z"/></g></svg>`;
  let emblema3d = null,
    emblemaPedido = false;
  function colocarEmblema(festejo = false) {
    document.getElementById('emblema-sitio')?.replaceWith(emblema);
    emblema.querySelector('.arco').style.strokeDashoffset = LARGO * (1 - avance());
    emblema3d?.actualizar({ avance: avance(), festejo });
    if (emblemaPedido) return;
    emblemaPedido = true;
    // Se pide después del primer pintado: el portal nunca espera a three.js para mostrar el estado del vehículo.
    const pedir = () =>
      import('./escena3d.js')
        .then((m) => m.montarEmblema(emblema, { avance: avance() }))
        .then((api) => {
          emblema3d = api;
        })
        .catch(() => {});
    'requestIdleCallback' in window ? requestIdleCallback(pedir, { timeout: 1500 }) : setTimeout(pedir, 300);
  }

  const VISTAS = { est: vistaEstado, cot: vistaCotizacion, veh: vistaVehiculo, his: vistaHistorial };

  function pintarTab(anima = true) {
    const cont = document.getElementById('p-tab');
    cont.innerHTML = VISTAS[tab]();
    document.getElementById('auth')?.addEventListener('click', abrir);
    if (anima && !calmo())
      cont.animate(
        [
          { opacity: 0, transform: 'translateY(8px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 260, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
      );
    const tot = document.getElementById('q-tot');
    if (tot && anima && !calmo()) {
      const fin = total(),
        t0 = performance.now();
      const paso = (t) => {
        const k = Math.min(1, (t - t0) / 700);
        tot.textContent = money(fin * (1 - (1 - k) ** 3));
        if (k < 1) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    }
  }

  function render(festejo = false) {
    const carros = mios();
    root.innerHTML = `${
      carros.length > 1
        ? `<nav class="p-carros" aria-label="Tus vehículos en esta orden"><p>Esta orden trae ${carros.length} vehículos</p><div>${carros.map((c) => `<button type="button" data-carro="${esc(c.codigo)}" aria-pressed="${c === s}"><b>${esc(c.vehiculo.marca)} ${esc(c.vehiculo.modelo)}</b><span>${esc(c.vehiculo.placas)} · ${PILL[c.estatus]}</span></button>`).join('')}</div></nav>`
        : ''
    }<div class="p-grid">
      <aside class="p-side">${hero()}<a class="wa" href="${wa}?text=${encodeURIComponent(`Hola, tengo una duda sobre mi ${s.vehiculo.modelo} (orden ${s.orden}).`)}" target="_blank" rel="noopener">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M2.5 13.5 3.3 11A5.5 5.5 0 1 1 5 12.7Z"/></svg>Tengo dudas: escribir al taller</a></aside>
      <section class="p-main">
        <div class="seg2 full" role="tablist" aria-label="Secciones"><i class="ind"></i>${TABS.map(([k, l]) => `<button type="button" role="tab" data-v="${k}" aria-selected="${k === tab}">${l}${k === 'cot' && s.estatus === 'COTIZADO' ? '<span class="badge" aria-label="por autorizar"></span>' : ''}</button>`).join('')}</div>
        <div id="p-tab" role="tabpanel"></div>
      </section></div>`;
    root.querySelectorAll('[data-carro]').forEach((b) =>
      b.addEventListener('click', () => {
        const otro = mios().find((c) => c.codigo === b.dataset.carro);
        if (!otro || otro === s) return;
        s = otro;
        tab = 'est';
        render();
      }),
    );
    const seg = root.querySelector('.seg2'),
      ind = seg.querySelector('.ind'),
      bs = [...seg.querySelectorAll('button')];
    const ubicar = (anima = true) => {
      const b = bs.find((x) => x.getAttribute('aria-selected') === 'true');
      ind.style.transition = anima ? '' : 'none';
      ind.style.width = `${b.offsetWidth}px`;
      ind.style.transform = `translateX(${b.offsetLeft}px)`;
    };
    bs.forEach((b) =>
      b.addEventListener('click', () => {
        if (b.dataset.v === tab) return;
        tab = b.dataset.v;
        bs.forEach((x) => x.setAttribute('aria-selected', x === b));
        ubicar();
        pintarTab();
      }),
    );
    requestAnimationFrame(() => ubicar(false));
    addEventListener('resize', () => ubicar(false));
    pintarTab(false);
    colocarEmblema(festejo);
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Autorización con código de un solo uso (en producción llega por SMS; 5 minutos, 5 intentos)
  // ---------------------------------------------------------------------------------------------------------------
  const sheet = document.getElementById('otp'),
    inp = document.getElementById('otp-in'),
    hint = document.getElementById('otp-hint');
  let intentos = 0,
    origen;
  function abrir(e) {
    origen = e.currentTarget;
    document.getElementById('otp-p').textContent = `Enviamos un código de 6 dígitos a ${telMask}.`;
    inp.value = '';
    inp.setAttribute('aria-invalid', 'false');
    hint.textContent = '6 dígitos';
    hint.className = 'otp-hint';
    sheet.classList.add('open');
    setTimeout(() => inp.focus(), 50);
  }
  function cerrar() {
    sheet.classList.remove('open');
    origen?.focus();
  }
  document.getElementById('otp-cancel').addEventListener('click', cerrar);
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) cerrar();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet.classList.contains('open')) cerrar();
  });
  inp.addEventListener('input', () => {
    inp.value = inp.value.replace(/\D/g, '');
  });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmar();
  });
  document.getElementById('otp-ok').addEventListener('click', confirmar);
  function confirmar() {
    if (inp.value.length !== 6) {
      hint.textContent = 'Escribe los 6 dígitos';
      hint.className = 'otp-hint err';
      inp.setAttribute('aria-invalid', 'true');
      return;
    }
    if (inp.value !== '482913') {
      intentos++;
      const quedan = 5 - intentos;
      hint.textContent =
        quedan > 0
          ? `Código incorrecto. Te quedan ${quedan} intentos.`
          : 'Demasiados intentos. Pide un código nuevo al taller.';
      hint.className = 'otp-hint err';
      inp.setAttribute('aria-invalid', 'true');
      if (quedan <= 0) document.getElementById('otp-ok').disabled = true;
      return;
    }
    Estados.autorizar(s, CONFIG.ahora);
    window.FS.auditar(
      'Cliente (portal)',
      'Autorizó la cotización con código de un solo uso',
      { estatus: 'COTIZADO' },
      { estatus: 'AUTORIZADO', total: total() },
      s.codigo,
    );
    window.FS.guardar();
    autorizadoAhora = true;
    sheet.classList.remove('open');
    tab = 'cot';
    render(true); // el emblema da una vuelta: la autorización quedó registrada
  }
  document.getElementById('aviso-link').addEventListener('click', (e) => {
    e.preventDefault();
    alert(
      'Aviso de privacidad (borrador): Fortaleza Servicar usa tu nombre, teléfono y los datos de tu vehículo solo para darte el servicio y su seguimiento. Puedes ejercer tus derechos ARCO escribiendo al taller.',
    );
  });
  render();

  // El taller cambió algo en el ERP (otra pestaña de este navegador): el portal se actualiza solo.
  window.FS.alCambiarAlmacen = () => {
    s = mios().find((x) => x.codigo === s.codigo) || mios()[0] || s;
    if (!sheet.classList.contains('open')) render();
  };
})();
