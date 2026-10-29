// Fortaleza Servicar · prototipo del ERP (sin backend). Rutas por hash: #/dashboard, #/ordenes, #/orden/<código>, #/recepcion.
(() => {
  const { CONFIG, PERSONAL, servicios, calcular, c, p } = window.FS;
  const view = document.getElementById('view');
  const AHORA = new Date(CONFIG.ahora);
  const HORA = 3600e3, DIA = 24 * HORA;

  // ---------- formato ----------
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const nfMoney = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
  const money = (v) => nfMoney.format(v);
  const int = (v) => new Intl.NumberFormat('es-MX').format(v);
  const dec = (v, d = 1) => new Intl.NumberFormat('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  const fecha = (iso) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(iso)).replace('.', '');
  const fechaHora = (iso) => `${fecha(iso)}, ${new Date(iso).toTimeString().slice(0, 5)}`;
  const horasDesde = (iso) => Math.floor((AHORA - new Date(iso)) / HORA);
  const diasCal = (a, b) => Math.round((new Date(b.slice(0, 10)) - new Date(a.slice(0, 10))) / DIA);
  const telMask = (t) => (t ? `${t.slice(0, 2)} •••• ${t.slice(-4)}` : '—');
  const dash = '<span class="dash">—</span>';

  // ---------- rol (seguridad por campo: el técnico no recibe importes; el asesor no ve costos ni utilidad) ----------
  let rol = 'admin';
  try { rol = localStorage.getItem('fs-rol') || 'admin'; } catch {}
  const ROL_NOMBRE = { admin: 'Administración', asesor: 'Asesor', tecnico: 'Técnico' };
  const tiene = (permiso) => window.FS.tiene(ROL_NOMBRE[rol], permiso);
  const puede = { importes: () => tiene('importes'), costos: () => tiene('costos'), tiene };
  const roleSel = document.getElementById('role');
  roleSel.value = rol;
  const QUIEN = { admin: ['Administración', 'A', 'Dueño · acceso total'], asesor: ['Pablo', 'P', 'Asesor de servicio'], tecnico: ['Daniel', 'D', 'Técnico'] };
  const ID_ROL = { admin: 'admin', asesor: 'pablo', tecnico: 'daniel' };

  // ---------- fotografía de usuario ----------
  // Prototipo: se recorta a un cuadrado de 256 px, se comprime a JPEG y queda en este navegador. En producción
  // se procesa con sharp (EXIF fuera, 256 px), se guarda en S3/R2 y se sirve con URL firmada.
  const fotoDe = (id) => { try { return localStorage.getItem(`fs-foto-${id}`); } catch { return null; } };
  function pedirFoto(id, alCambiar) {
    const inp = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/png,image/jpeg,image/webp' });
    inp.addEventListener('change', () => {
      const f = inp.files[0];
      if (!f) return;
      if (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > 8e6) { toast('Elige una imagen PNG, JPG o WebP de máximo 8 MB.'); return; }
      const url = URL.createObjectURL(f), img = new Image();
      img.onload = () => {
        const L = Math.min(img.width, img.height), cv = Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
        cv.getContext('2d').drawImage(img, (img.width - L) / 2, (img.height - L) / 2, L, L, 0, 0, 256, 256);
        URL.revokeObjectURL(url);
        try { localStorage.setItem(`fs-foto-${id}`, cv.toDataURL('image/jpeg', 0.82)); } catch { toast('No se pudo guardar la foto en este navegador.'); return; }
        toast('Foto actualizada.'); alCambiar();
      };
      img.onerror = () => { URL.revokeObjectURL(url); toast('No se pudo leer esa imagen.'); };
      img.src = url;
    });
    inp.click();
  }
  const quitarFoto = (id) => { try { localStorage.removeItem(`fs-foto-${id}`); } catch {} };
  // círculo con la foto o, si no hay, la inicial
  const avatar = (id, inicial, tono = 18, cls = '') => { const f = fotoDe(id); return `<span class="avatar ${cls}" style="${f ? `background-image:url(${f});background-size:cover;background-position:center` : `background:hsl(${tono} 55% 88%)`}" aria-hidden="true">${f ? '' : esc(inicial)}</span>`; };

  const pintarQuien = () => {
    document.querySelectorAll('[data-need]').forEach((x) => { x.hidden = !tiene(x.dataset.need); });
    // un grupo del menú sin opciones visibles se oculta completo
    document.querySelectorAll('.nav-group').forEach((g) => { const items = g.querySelectorAll('.nav-item'); g.hidden = items.length > 0 && [...items].every((i) => i.hidden); });
    const [n, i, t] = QUIEN[rol], av = document.getElementById('av'), f = fotoDe(ID_ROL[rol]);
    document.getElementById('who-name').textContent = n; document.getElementById('who-sub').textContent = t;
    av.textContent = f ? '' : i; av.style.backgroundImage = f ? `url(${f})` : ''; av.classList.toggle('con-foto', !!f);
    av.setAttribute('aria-label', f ? 'Cambiar mi foto de perfil' : 'Agregar mi foto de perfil');
  };
  pintarQuien();
  document.getElementById('av').addEventListener('click', () => pedirFoto(ID_ROL[rol], () => { pintarQuien(); render(false); }));
  roleSel.addEventListener('change', () => { rol = roleSel.value; try { localStorage.setItem('fs-rol', rol); } catch {} pintarQuien(); render(); });

  // ---------- tema: Rojo (por defecto), Oscuro y Claro ----------
  const temaBtns = document.querySelectorAll('[data-tema]');
  const pintarTema = (t) => temaBtns.forEach((b) => b.setAttribute('aria-pressed', b.dataset.tema === t));
  pintarTema(document.documentElement.getAttribute('data-theme') || 'deportivo');
  temaBtns.forEach((b) => b.addEventListener('click', () => transicion(() => {
    document.documentElement.setAttribute('data-theme', b.dataset.tema);
    try { localStorage.setItem('fs-tema', b.dataset.tema); } catch {}
    pintarTema(b.dataset.tema); render(false);
  })));

  // ---------- transiciones: fundido entre pantallas y elementos compartidos ----------
  const calmo = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const transicion = (fn) => (document.startViewTransition && !calmo() ? document.startViewTransition(fn) : fn());
  let ultimo = null; // servicio abierto: su nombre viaja de la lista al detalle y de vuelta
  const compartir = (el) => {
    view.querySelectorAll('[data-vt]').forEach((x) => { x.style.viewTransitionName = ''; x.removeAttribute('data-vt'); });
    if (el) { el.style.viewTransitionName = 'orden'; el.dataset.vt = ''; }
  };
  // Por WhatsApp solo viaja el enlace de seguimiento; todo lo demás (cotización, autorización, estatus) vive en el portal.
  const enlaceSeguimiento = (sv) => `https://seguimiento.fortalezaservicar.mx/s/${sv.tracking || 'k7Qw2mZ9pL4xT8vR'}`;
  const waUrl = (sv) => `https://wa.me/${sv.cliente.telefono ? `52${sv.cliente.telefono}` : ''}?text=${encodeURIComponent(enlaceSeguimiento(sv))}`;
  const RUTAS = {};
  const FMT = { money, int, dec1: (v) => dec(v) };
  function contar(raiz) {
    if (calmo()) return;
    raiz.querySelectorAll('[data-count]').forEach((n) => {
      const fin = +n.dataset.count, f = FMT[n.dataset.fmt], t0 = performance.now();
      const paso = (t) => { const k = Math.min(1, (t - t0) / 650); n.textContent = f(fin * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(paso); };
      requestAnimationFrame(paso);
    });
  }
  // Control segmentado con indicador que se desliza entre opciones
  function seg2(root, cambio) {
    const ind = root.querySelector('.ind'), bs = [...root.querySelectorAll('button')];
    const ubicar = (anima = true) => {
      const b = bs.find((x) => x.getAttribute('aria-selected') === 'true');
      ind.style.transition = anima ? '' : 'none';
      ind.style.width = `${b.offsetWidth}px`; ind.style.transform = `translateX(${b.offsetLeft}px)`;
    };
    bs.forEach((b) => b.addEventListener('click', () => { bs.forEach((x) => x.setAttribute('aria-selected', x === b)); ubicar(); cambio(b.dataset.v); }));
    requestAnimationFrame(() => ubicar(false));
    return ubicar;
  }
  const segHtml = (opts, sel, etq) => `<div class="seg2" role="tablist" aria-label="${etq}"><i class="ind"></i>${opts.map(([k, l]) => `<button type="button" role="tab" data-v="${k}" aria-selected="${k === sel}">${l}</button>`).join('')}</div>`;

  // ---------- ventana de cobros: se abre encima del dashboard, que sigue ahí detrás ----------
  const MES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIA_C = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const suma = (a) => Math.round(a.reduce((t, v) => t + v, 0) * 100) / 100;
  const tickMoney = (v) => (v >= 1000 ? `$${+(v / 1000).toFixed(1)} mil` : `$${Math.round(v)}`);
  function cobrosPor(vista, anio) {
    const m = mes(), H = window.FS.HISTORICO, oct = [...H[2026], m.cobros];
    let labels, tips, values, unidad, extra;
    if (vista === 'dia') {
      labels = m.dias.map((x) => String(+x.slice(8)));
      tips = m.dias.map((x) => `${DIA_C[new Date(x).getUTCDay()]} ${+x.slice(8)} de octubre`);
      values = m.cobroDia; unidad = 'día';
    } else if (vista === 'mes') {
      const v = anio === 2026 ? oct : H[anio];
      labels = v.map((_, i) => MES_C[i]); tips = v.map((_, i) => `${MES_L[i]} ${anio}`); values = v; unidad = 'mes';
    } else {
      const ys = [2024, 2025, 2026];
      values = ys.map((y) => suma(y === 2026 ? oct : H[y])); labels = ys.map(String); tips = ys.map((y) => (y === 2026 ? '2026 (a la fecha)' : String(y))); unidad = 'año';
    }
    const total = suma(values), mejor = values.indexOf(Math.max(...values)), n = values.length;
    const conCobro = values.filter((v) => v > 0).length;
    extra = vista === 'dia' ? ['Días con cobros', `${conCobro} de ${n}`] : (() => { const u = values[n - 1], a = values[n - 2]; const dl = a ? (u - a) / a * 100 : 0; return [`Frente al ${unidad} anterior`, `${dl >= 0 ? '▲' : '▼'} ${dec(Math.abs(dl))} %`]; })();
    return { labels, tips, values, unidad, total, prom: total / (vista === 'dia' ? Math.max(1, conCobro) : n), mejor: [tips[mejor], values[mejor]], extra };
  }
  let vistaC = 'dia', anioC = 2026, dlg = null;
  function abrirCobros() {
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.className = 'dlg'; dlg.setAttribute('aria-labelledby', 'dlg-t'); document.body.append(dlg);
      dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-cerrar]')) cerrarCobros(); });
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); cerrarCobros(); });
    }
    dlg.innerHTML = `<div class="dlg-card">
      <header class="dlg-head"><div><h2 id="dlg-t">${ICO.dollar}Cobros</h2><p>Dinero recibido: anticipos y liquidaciones</p></div>
        <button class="icon-btn" type="button" data-cerrar aria-label="Cerrar"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></header>
      <div class="dlg-tools">${segHtml([['dia', 'Día'], ['mes', 'Mes'], ['anio', 'Año']], vistaC, 'Periodo')}<div class="chips" id="dlg-anios">${[2024, 2025, 2026].map((y) => `<button type="button" class="chip-b" data-y="${y}" aria-pressed="${y === anioC}">${y}</button>`).join('')}</div></div>
      <div id="dlg-cuerpo"></div></div>`;
    const root = dlg.querySelector('.seg2');
    seg2(root, (k) => { vistaC = k; pintarCobros(); });
    dlg.querySelectorAll('[data-y]').forEach((b) => b.addEventListener('click', () => { anioC = +b.dataset.y; dlg.querySelectorAll('[data-y]').forEach((x) => x.setAttribute('aria-pressed', x === b)); pintarCobros(); }));
    dlg.showModal();
    dlg.querySelector('.dlg-card').setAttribute('tabindex', '-1'); dlg.querySelector('.dlg-card').focus({ preventScroll: true });
    pintarCobros();
  }
  function cerrarCobros() {
    if (calmo()) { dlg.close(); return; }
    dlg.classList.add('sale');
    setTimeout(() => { dlg.close(); dlg.classList.remove('sale'); }, 170);
  }
  function pintarCobros() {
    const d = cobrosPor(vistaC, anioC), cuerpo = dlg.querySelector('#dlg-cuerpo');
    dlg.querySelector('#dlg-anios').hidden = vistaC !== 'mes';
    const stat = (t, v) => `<div class="stat"><span>${t}</span><b>${v}</b></div>`;
    const titulo = { dia: 'Octubre de 2026, por día', mes: `${anioC}, por mes`, anio: 'Por año' }[vistaC];
    const maxV = Math.max(...d.values, 1);
    const filas = d.tips.map((t, i) => ({ t, v: d.values[i] })).filter((f) => vistaC !== 'dia' || f.v > 0);
    if (vistaC === 'dia') filas.reverse();
    cuerpo.innerHTML = `
      <div class="dlg-stats">${stat('Total', money(d.total))}${stat(`Promedio por ${d.unidad}${vistaC === 'dia' ? ' con cobro' : ''}`, money(d.prom))}${stat(`Mejor ${d.unidad}`, `${money(d.mejor[1])}<small>${d.mejor[0]}</small>`)}${stat(d.extra[0], d.extra[1])}</div>
      <div class="chart-head"><h3>${titulo}</h3></div>
      <div id="dlg-chart" class="g-host"></div>
      ${vistaC !== 'dia' && (vistaC === 'anio' || anioC === 2026) ? '<p class="note">Los meses y años anteriores a octubre de 2026 son datos de muestra; octubre sale de los pagos registrados.</p>' : ''}
      <div class="table-wrap"><table><thead><tr><th>Periodo</th><th class="n">Cobrado</th><th>Proporción</th></tr></thead><tbody>${filas.map((f) => `<tr><td>${f.t}</td><td class="n">${money(f.v)}</td><td><span class="pbar"><i style="width:${f.v / maxV * 100}%"></i></span></td></tr>`).join('')}</tbody></table></div>`;
    const host = cuerpo.querySelector('#dlg-chart');
    if (vistaC === 'dia') Graficas.area(host, { labels: d.labels, tips: d.tips, height: 300, series: [{ label: 'Cobrado', values: d.values, color: 'var(--positive)', format: money, tick: tickMoney }] });
    else Graficas.columnas(host, { labels: d.labels, tips: d.tips, values: d.values, format: money, tick: tickMoney, height: 300, color: 'var(--positive)' });
    if (!calmo()) cuerpo.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  }

  const entrada = () => view.querySelectorAll('[data-rise]').forEach((n, i) => n.style.setProperty('--i', Math.min(i, 12)));

  const svg = (d) => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${d}</svg>`;
  const ICO = {
    auto: svg('<path d="M2 10.5V8.2l1.6-3.4A1.5 1.5 0 0 1 5 4h6a1.5 1.5 0 0 1 1.4.8L14 8.2v2.3a1 1 0 0 1-1 1h-.5M3.5 11.5H3a1 1 0 0 1-1-1"/><circle cx="5" cy="11.5" r="1.5"/><circle cx="11" cy="11.5" r="1.5"/>'),
    firma: svg('<path d="M3 13.5h10M4 10.5 10.5 4a1.4 1.4 0 0 1 2 2L6 12.5 3.5 13z"/>'),
    espera: svg('<circle cx="8" cy="8" r="5.5"/><path d="M8 4.8V8l2.2 1.4"/>'),
    ok: svg('<circle cx="8" cy="8" r="5.5"/><path d="m5.6 8.2 1.8 1.8 3.2-3.6"/>'),
    chat: svg('<path d="M2.5 3.5h11v7h-6L4.5 13v-2.5h-2z"/>'),
    users: svg('<circle cx="6" cy="5.5" r="2.5"/><path d="M1.5 13.5c.6-2.4 2.3-3.6 4.5-3.6s3.9 1.2 4.5 3.6M11 3.5a2.2 2.2 0 0 1 0 4.2M12.5 10.2c1 .5 1.7 1.6 2 3.3"/>'),
    dollar: svg('<path d="M8 2v12M10.8 5C10.3 4 9.3 3.6 8 3.6c-1.6 0-2.8.8-2.8 2s1 1.8 2.8 2.2 2.8 1 2.8 2.3S9.6 12.4 8 12.4c-1.4 0-2.5-.5-3-1.6"/>'),
    cash: svg('<rect x="1.5" y="4" width="13" height="8" rx="1.5"/><circle cx="8" cy="8" r="1.8"/>'),
    alert: svg('<path d="M8 2.5 14 13H2z"/><path d="M8 6.8v3M8 11.5v.1"/>'),
    chev: svg('<path d="m6 3.5 4.5 4.5L6 12.5"/>'),
    cal: svg('<rect x="2" y="3.5" width="12" height="10.5" rx="1.5"/><path d="M2 7h12M5.5 2v3M10.5 2v3"/>'),
    expand: svg('<path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9"/>'),
    refresh: svg('<path d="M13.5 8a5.5 5.5 0 1 1-1.8-4.1M13.5 2.5v3h-3"/>'),
    flow: svg('<path d="M2 13.5h12M4 11V7.5M8 11V3.5M12 11V6"/>'),
  };

  // ---------- estatus: una sola máquina de estados ----------
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
  const PASOS = ['Recibido', 'Diagnóstico', 'Cotización', 'Autorizado', 'Reparación', 'Terminado', 'Entregado'];
  const pill = (e) => `<span class="pill ${ESTATUS[e].pill}">${ESTATUS[e].label}</span>`;
  const enPiso = () => servicios.filter((s) => s.estatus !== 'ENTREGADO');
  const autosEnPiso = () => new Set(enPiso().map((s) => s.vehiculo.placas)).size;

  const persona = (id) => {
    if (!id) return dash;
    const per = PERSONAL[id];
    return `<span class="who">${avatar(id, per.nombre[0], per.tono)}${esc(per.nombre)}</span>`;
  };
  const MARCA_CORTA = { Volkswagen: 'VW', 'Mercedes-Benz': 'Mercedes' };
  const vehiculoTxt = (veh) => `${MARCA_CORTA[veh.marca] || veh.marca} ${veh.modelo} ${veh.anio}`;

  // promedio de días en taller de lo entregado en octubre (mínimo 1 día, como el Excel)
  const entregadosOct = () => servicios.filter((s) => s.estatus === 'ENTREGADO' && s.entrega.startsWith('2026-10'));
  const promedioDias = () => { const e = entregadosOct(); return e.reduce((t, s) => t + Math.max(1, diasCal(s.ingreso, s.entrega)), 0) / e.length; };

  // ---------- navegación ----------
  const setTitle = (t) => { document.title = `${t} · Fortaleza Servicar`; document.getElementById('mobile-title').textContent = t; };
  function markNav(route) {
    document.querySelectorAll('.nav-item[data-route]').forEach((a) => {
      if (a.dataset.route === route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.getElementById('nav-count').textContent = servicios.filter((s) => s.estatus === 'COTIZADO').length || '';
    document.getElementById('nav-count').title = 'Servicios por autorizar';
    pintarAvisos();
  }

  // ---------- notificaciones: carros con más de 3 días en el taller ----------
  function avisos() {
    const piso = enPiso();
    const pasan = piso.filter((s) => diasEnTaller(s) > UMBRAL_DIAS).sort((a, b) => diasEnTaller(b) - diasEnTaller(a));
    const cumplen = piso.filter((s) => diasEnTaller(s) === UMBRAL_DIAS);
    const sinRespuesta = piso.filter((s) => s.estatus === 'COTIZADO' && horasDesde(s.cotizado) >= 24);
    return { pasan, cumplen, sinRespuesta, total: pasan.length + cumplen.length + sinRespuesta.length };
  }
  const panelAv = document.createElement('div');
  panelAv.className = 'notif-panel'; panelAv.id = 'notif'; panelAv.hidden = true; panelAv.setAttribute('role', 'region'); panelAv.setAttribute('aria-label', 'Notificaciones');
  document.body.append(panelAv);
  function pintarAvisos() {
    const a = avisos();
    document.querySelectorAll('[data-bell]').forEach((b) => {
      b.querySelector('.badge').textContent = a.total || ''; b.querySelector('.badge').hidden = !a.total;
      b.setAttribute('aria-label', a.total ? `Notificaciones: ${a.total} pendientes` : 'Notificaciones: sin pendientes');
    });
    const fila = (s, cls, txt, sub) => `<a class="nt" href="#/orden/${s.codigo}"><span class="s-ico ${cls}">${ICO[cls === 'neg' ? 'alert' : cls === 'warn' ? 'espera' : 'firma']}</span><span><b>${esc(vehiculoTxt(s.vehiculo))} · ${esc(s.vehiculo.placas)}</b><small>${txt}${sub ? ` · ${sub}` : ''}</small></span><span class="pill ${cls === 'neg' ? '' : cls}">${diasEnTaller(s)} d</span></a>`;
    const grupo = (t, l, cuerpo, href) => (l.length ? `<section><h3>${t}<span>${l.length}</span></h3>${cuerpo}${href ? `<a class="btn-link ver" href="${href}">Ver en Órdenes</a>` : ''}</section>` : '');
    panelAv.innerHTML = `<header><h2>${ICO.alert}Notificaciones</h2><button class="icon-btn" type="button" data-cerrar-av aria-label="Cerrar notificaciones"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></header>
      <div class="nt-body">${a.total ? [
        grupo(`Llevan más de ${UMBRAL_DIAS} días en el taller`, a.pasan, a.pasan.map((s) => fila(s, 'neg', `Lleva ${diasEnTaller(s)} días`, ESTATUS[s.estatus].label)).join(''), '#/ordenes?f=demorados'),
        grupo(`Cumplirán más de ${UMBRAL_DIAS} días mañana`, a.cumplen, a.cumplen.map((s) => fila(s, 'warn', `Hoy cumple ${UMBRAL_DIAS} días`, ESTATUS[s.estatus].label)).join(''), ''),
        grupo('Cotización sin respuesta por más de 24 h', a.sinRespuesta, a.sinRespuesta.map((s) => fila(s, 'info', `Espera la autorización desde hace ${horasDesde(s.cotizado)} h`, '')).join(''), '#/ordenes?f=autorizar'),
      ].join('') : '<div class="empty">Sin pendientes. Ningún carro rebasa los 3 días.</div>'}</div>
      <footer>El aviso cuenta días naturales desde el ingreso. El límite (${UMBRAL_DIAS} días) se cambia en Configuración.</footer>`;
  }
  const abrirAv = (b) => { const abre = panelAv.hidden; panelAv.hidden = !abre; document.querySelectorAll('[data-bell]').forEach((x) => x.setAttribute('aria-expanded', abre && x === b)); if (abre) panelAv.querySelector('[data-cerrar-av]').focus({ preventScroll: true }); };
  document.querySelectorAll('[data-bell]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); abrirAv(b); }));
  panelAv.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar-av]')) { panelAv.hidden = true; document.querySelector('[data-bell]').focus(); } else if (e.target.closest('a')) panelAv.hidden = true; });
  document.addEventListener('click', (e) => { if (!panelAv.hidden && !e.target.closest('#notif')) panelAv.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panelAv.hidden) { panelAv.hidden = true; document.querySelector('[data-bell]').focus(); } });
  const sidebar = document.getElementById('sidebar');
  document.querySelector('[data-open-menu]').addEventListener('click', () => sidebar.classList.add('open'));
  document.querySelector('[data-close-menu]').addEventListener('click', () => sidebar.classList.remove('open'));
  sidebar.addEventListener('click', (e) => { if (e.target.closest('a')) sidebar.classList.remove('open'); });
  document.getElementById('clock').textContent = `Miércoles 28 de octubre · 16:20`;

  // ---------- aviso ----------
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function toast(html) {
    toastEl.innerHTML = html; toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 5200);
  }

  // ---------- búsqueda ----------
  const q = document.getElementById('q'), results = document.getElementById('results');
  // Índice en memoria: una cadena normalizada por servicio (sin acentos, minúsculas; placas sin guiones ni espacios),
  // calculada una sola vez y rehecha solo si cambia el número de servicios. Buscar es recorrer cadenas cortas con
  // includes(): para 25,000 folios tarda unos milisegundos. En producción lo hace PostgreSQL con pg_trgm (especificación §4.4).
  const norm = (x) => String(x ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const compacto = (x) => norm(x).replace(/[\s-]/g, '');
  let indice = [], indiceN = -1;
  const idx = () => {
    if (indiceN !== servicios.length) {
      indice = servicios.map((s) => ({ s, k: `${norm(`${s.cliente.nombre} ${s.vehiculo.marca} ${s.vehiculo.modelo}`)} ${compacto(s.vehiculo.placas)} ${s.orden} ${norm(s.codigo)}` }));
      indiceN = servicios.length;
    }
    return indice;
  };
  const tokens = (term) => norm(term).split(/\s+/).map((t) => t.replace(/-/g, '')).filter(Boolean);
  function buscar(term, limite = 6) {
    const ts = tokens(term), out = [];
    if (!ts.length) return out;
    for (const e of idx()) {
      if (ts.every((t) => e.k.includes(t))) { out.push(e.s); if (out.length >= limite) break; }
    }
    return out;
  }
  // resalta lo que coincidió sin perder acentos ni mayúsculas del texto original
  function marcar(txt, ts) {
    const src = [...String(txt)], plano = src.map((ch) => compacto(ch));
    const on = new Array(src.length).fill(false);
    ts.forEach((t) => {
      for (let i = 0; i < src.length; i++) {
        let j = i, acc = '';
        while (j < src.length && acc.length < t.length) { acc += plano[j]; j++; }
        if (acc.startsWith(t) && plano[i]) { for (let k = i; k < j; k++) on[k] = true; break; }
      }
    });
    return src.map((ch, i) => (on[i] && !on[i - 1] ? '<mark>' : '') + esc(ch) + (on[i] && !on[i + 1] ? '</mark>' : '')).join('');
  }
  const espera = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  q.addEventListener('input', espera(() => {
    const r = buscar(q.value), ts = tokens(q.value);
    results.innerHTML = r.length
      ? r.map((s) => `<a href="#/orden/${s.codigo}" role="option"><span>${esc(vehiculoTxt(s.vehiculo))} · ${marcar(s.vehiculo.placas, ts)}<span class="sub" style="display:block">${marcar(s.cliente.nombre, ts)}</span></span><span class="sub">Orden ${s.orden}</span></a>`).join('')
      : (q.value.trim() ? '<div class="empty" style="min-height:44px;border:0">Sin coincidencias</div>' : '');
    results.classList.toggle('open', !!q.value.trim());
  }, 120));
  results.addEventListener('click', () => { results.classList.remove('open'); q.value = ''; });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); }
    if (e.key === 'Escape') { results.classList.remove('open'); sidebar.classList.remove('open'); }
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search')) results.classList.remove('open'); });

  // ---------- filas de tabla clicables ----------
  view.addEventListener('click', (e) => {
    const tr = e.target.closest('tr.link');
    if (tr && !e.target.closest('a,button')) { ultimo = tr.dataset.href.split('/').pop(); compartir(tr.querySelector('.id')); location.hash = tr.dataset.href; return; }
    const a = e.target.closest('a[href^="#/orden/"]');
    if (a) { ultimo = a.getAttribute('href').split('/').pop(); compartir(a.querySelector('.t, b')); }
  });
  const irA = (e) => { const g = e.target.closest('[data-go]'); if (g) location.hash = g.dataset.go; };
  view.addEventListener('click', irA);
  view.addEventListener('keydown', (e) => { if (e.key === 'Enter') irA(e); });
  view.addEventListener('keydown', (e) => {
    const tr = e.target.closest('tr.link');
    if (tr && e.key === 'Enter') { ultimo = tr.dataset.href.split('/').pop(); compartir(tr.querySelector('.id')); location.hash = tr.dataset.href; }
  });

  // ===================== TALLER HOY =====================
  function diasCelda(s) {
    const d = Math.max(0, diasCal(s.ingreso, CONFIG.ahora));
    const prom = promedioDias(), escala = 6;
    const w = Math.min(1, d / escala) * 100, m = Math.min(1, prom / escala) * 100;
    return `<div class="days" title="${d} días en taller; promedio de octubre ${dec(prom)} días"><span class="n">${d === 0 ? 'Hoy' : `${d} d`}</span><span class="bar"><i class="${d > prom ? 'over' : ''}" style="width:${w}%"></i><b style="left:${m}%"></b></span></div>`;
  }
  const UMBRAL_DIAS = 3; // aviso: un carro que cumple más de 3 días en el taller
  const diasEnTaller = (s) => Math.max(0, diasCal(s.ingreso, CONFIG.ahora));
  const PRIORIDAD = { COTIZADO: 0, ESPERANDO_REFACCION: 1, TERMINADO: 2, EN_REPARACION: 3, EN_DIAGNOSTICO: 4, AUTORIZADO: 4, RECIBIDO: 5 };

  function conCarga() {
    if (calmo()) { render(false); return; }
    view.classList.add('cargando');
    setTimeout(() => { render(false); view.classList.remove('cargando'); }, 380);
  }

  function renderHoy() {
    setTitle('Dashboard');
    const importes = puede.importes();
    const piso = enPiso();
    const porAutorizar = piso.filter((s) => s.estatus === 'COTIZADO').sort((a, b) => new Date(a.cotizado) - new Date(b.cotizado));
    const viejos = porAutorizar.filter((s) => horasDesde(s.cotizado) >= 24);
    const esperando = piso.filter((s) => s.estatus === 'ESPERANDO_REFACCION');
    const listos = piso.filter((s) => s.estatus === 'TERMINADO');
    const hoy = piso.filter((s) => s.ingreso.startsWith('2026-10-28'));
    const orden = [...piso].sort((a, b) => PRIORIDAD[a.estatus] - PRIORIDAD[b.estatus] || new Date(a.ingreso) - new Date(b.ingreso));
    const m = periodo(rango), etiqueta = rangoTxt(rango);
    const ingresados = servicios.filter((s) => enRango(s.ingreso, rango));
    const clientes = new Set(ingresados.map((s) => s.cliente.nombre)).size;
    const porCobrar = piso.reduce((t, s) => t + c(Math.max(0, s.calc.saldo)), 0);

    const tarjeta = (lbl, ico, val, cap, href, tono, num = null, spark = null) => `<a class="kpi" data-rise href="${href}" style="--tono:var(--c-${tono})"><div class="kpi-top"><div class="kpi-label">${lbl}</div><span class="kpi-ico">${ICO[ico]}</span></div><div class="kpi-value num"${num ? ` data-count="${num[0]}" data-fmt="${num[1]}"` : ''}>${val}</div><div class="cap">${cap}</div>${spark ? `<div class="spark" data-spark="${spark.join(',')}" data-tono="${tono}"></div>` : ''}</a>`;
    const ingresosSemana = SEMANAS.map(([, a, b]) => servicios.filter((x) => x.ingreso.slice(0, 10) >= a && x.ingreso.slice(0, 10) <= b).length);
    const kpis = [
      tarjeta('Clientes', 'users', clientes, `con servicio ${etiqueta}`, '#/ordenes?f=todos', 'teal', [clientes, 'int'], ingresosSemana),
      tarjeta('Servicios abiertos', 'auto', piso.length, `${autosEnPiso()} autos en piso`, '#/ordenes?f=piso', 'blue', [piso.length, 'int']),
      importes ? tarjeta('Cobrado', 'dollar', money(m.cobrado), `${m.n} entregados ${etiqueta}`, '#/bancos?tipo=ingreso', 'green', [m.cobrado, 'money'], m.porSemana('pagado')) : tarjeta('Entregados', 'ok', m.n, etiqueta, '#/ordenes?f=entregados', 'green', [m.n, 'int'], m.conteoSemana),
      importes ? tarjeta('Por cobrar', 'cash', money(p(porCobrar)), `${listos.length} listos para entregar`, '#/ordenes?f=listos', 'amber', [p(porCobrar), 'money']) : tarjeta('Listos para entregar', 'ok', listos.length, 'avisar al cliente', '#/ordenes?f=listos', 'amber', [listos.length, 'int']),
      tarjeta('Días en taller', 'espera', m.n ? dec(m.prom) : dash, m.n ? 'promedio de lo entregado' : 'sin entregas en el periodo', '#/ordenes?f=entregados', 'plum', m.n ? [m.prom, 'dec1'] : null),
    ].join('');

    const tira = (cls, ico, n, txt, sub, href, extra = '') => `<a class="strip-item ${extra}" data-rise href="${href}"><span class="s-ico ${cls}">${ICO[ico]}</span><span class="s-txt"><b>${n} ${txt}</b><small>${sub}</small></span>${ICO.chev}</a>`;
    const estado = [
      tira('info', 'auto', autosEnPiso(), 'autos en piso', `${piso.length} servicios abiertos`, '#/ordenes?f=piso'),
      tira('warn', 'firma', porAutorizar.length, 'por autorizar', viejos.length ? `${viejos.length} con más de 24 h` : 'ninguno detenido', '#/ordenes?f=autorizar', viejos.length ? 'alert' : ''),
      tira('warn', 'espera', esperando.length, 'esperando refacción', esperando[0] ? esc(esperando[0].espera) : 'ninguno', '#/ordenes?f=reparacion'),
      tira('pos', 'ok', listos.length, 'listos para entregar', importes ? `${money(p(porCobrar))} por cobrar` : 'avisar al cliente', '#/ordenes?f=listos'),
    ].join('');

    // flujo por estatus: la tabla de órdenes, valor y proporción
    const flujo = Object.keys(ESTATUS).map((k) => { const l = ingresados.filter((x) => x.estatus === k); return { k, n: l.length, v: l.reduce((t, x) => t + c(x.calc.total), 0) }; });
    const totN = ingresados.length || 1, totV = flujo.reduce((t, f) => t + f.v, 0);
    const tablaFlujo = `<div class="table-wrap"><table class="wf"><thead><tr><th>Estatus</th><th class="n">Órdenes</th>${importes ? '<th class="n">Valor</th>' : ''}<th>% de las órdenes</th></tr></thead>
      <tbody>${flujo.map((f) => `<tr class="link" tabindex="0" data-href="#/ordenes?f=e_${f.k}"><td>${pill(f.k)}</td><td class="n">${f.n}</td>${importes ? `<td class="n">${money(p(f.v))}</td>` : ''}<td><span class="pbar" style="--c:var(--st-${f.k.toLowerCase()})"><i style="width:${f.n / totN * 100}%"></i></span><span class="pct">${dec(f.n / totN * 100, 0)} %</span></td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td><td class="n">${ingresados.length}</td>${importes ? `<td class="n">${money(p(totV))}</td>` : ''}<td></td></tr></tfoot></table></div>`;

    const atencion = [
      ...viejos.map((s) => ({ s, cls: 'neg', ico: 'alert', d: `Espera la autorización desde hace ${horasDesde(s.cotizado)} h` })),
      ...esperando.map((s) => ({ s, cls: 'warn', ico: 'espera', d: s.espera })),
      ...listos.map((s) => ({ s, cls: 'pos', ico: 'ok', d: `Terminado ${fechaHora(s.terminado)}; avisar al cliente` })),
    ];
    const listaAtencion = atencion.length ? atencion.map(({ s, cls, ico, d }) => `<a class="attn" href="#/orden/${s.codigo}"><span class="s-ico ${cls}">${ICO[ico]}</span><span><b>${esc(vehiculoTxt(s.vehiculo))} · ${esc(s.vehiculo.placas)}</b><small>${esc(d)}</small></span></a>`).join('')
      : `<div class="empty">Todo en orden</div>`;

    // antigüedad de lo que está en el piso
    const tramos = [['0 a 1 día', 0, 1], ['2 a 3 días', 2, 3], ['4 a 7 días', 4, 7], ['8 días o más', 8, 9999]];
    const tablaEdad = `<div class="table-wrap"><table><thead><tr><th>Tiempo en taller</th><th class="n">Órdenes</th>${importes ? '<th class="n">Valor</th>' : ''}<th class="n">Clientes</th></tr></thead><tbody>${tramos.map(([t, a, b]) => {
      const l = piso.filter((x) => { const d = Math.max(0, diasCal(x.ingreso, CONFIG.ahora)); return d >= a && d <= b; });
      return `<tr class="link" tabindex="0" data-href="#/ordenes?f=d_${a}"><td>${t}</td><td class="n">${l.length}</td>${importes ? `<td class="n">${money(p(l.reduce((tt, x) => tt + c(x.calc.total), 0)))}</td>` : ''}<td class="n">${new Set(l.map((x) => x.cliente.nombre)).size}</td></tr>`;
    }).join('')}</tbody></table></div>`;

    view.innerHTML = `
      <div class="title-row">
        <div><h1>Dashboard</h1><p class="sub"><strong>${autosEnPiso()} autos en piso</strong> con ${piso.length} servicios abiertos · resumen de servicios, clientes y pendientes del taller</p></div>
        <div class="actions periodo">${segHtml([['hoy', 'Hoy'], ['7d', '7 días'], ['mes', 'Este mes'], ['otro', 'Otro']], rango.k, 'Periodo del resumen')}
          <div class="fechas" ${rango.k === 'otro' ? '' : 'hidden'}><label><span class="sr">Desde</span><input type="date" id="f-desde" value="${rango.desde}" min="${PRIMER_DIA}" max="${HOY}"></label><span aria-hidden="true">–</span><label><span class="sr">Hasta</span><input type="date" id="f-hasta" value="${rango.hasta}" min="${PRIMER_DIA}" max="${HOY}"></label></div>
          <button class="btn icon-only" type="button" data-refresh aria-label="Actualizar el dashboard" title="Actualizar">${ICO.refresh}</button></div>
      </div>
      <div class="quick" role="group" aria-label="Accesos rápidos">
        ${tiene('recepcion') ? `<a class="btn" href="#/recepcion">${ICO.auto}Recepción de vehículo</a>` : ''}
        <a class="btn btn-listos" href="#/ordenes?f=listos">${ICO.ok}Listos para entregar${listos.length ? `<span class="c">${listos.length}</span>` : ''}</a>
      </div>
      <section class="kpis" aria-label="Indicadores">${kpis}</section>
      <section class="strip" aria-label="Estado del piso">${estado}</section>
      <div class="dgrid w21 parejo">
        <section class="panel" data-rise><header><h2>${ICO.flow}Flujo de trabajo por estatus</h2><span class="meta">ingresos ${etiqueta}</span></header>${tablaFlujo}</section>
        <section class="panel" data-rise><header><h2>${ICO.alert}Requieren atención</h2><span class="meta">${atencion.length || ''}</span></header><div class="attn-lista">${listaAtencion}</div></section>
      </div>
      ${renderMes(m)}
      <div class="dgrid parejo">
        <section class="panel" data-rise><header><h2>${ICO.users}Servicios abiertos por técnico</h2><span class="meta">toca un técnico para ver sus servicios</span></header><div id="chart-tec"></div></section>
        <section class="panel" data-rise><header><h2>${ICO.cal}Antigüedad en el piso</h2><span class="meta">días desde el ingreso</span></header>${tablaEdad}</section>
      </div>
      <section class="panel flush" aria-labelledby="piso-h">
        <header><h2 id="piso-h">Piso del taller</h2><span class="meta">Primero lo detenido · la marca vertical es el promedio de octubre (${dec(promedioDias())} días)</span></header>
        <div class="table-wrap"><table class="respond">
          <thead><tr><th>Vehículo</th><th>Cliente</th><th>Estatus</th><th class="n">Días en taller</th><th>Técnico</th>${importes ? '<th class="n">Total</th>' : ''}</tr></thead>
          <tbody>${orden.map((s) => `
            <tr class="link" tabindex="0" data-href="#/orden/${s.codigo}">
              <td class="nowrap"><span class="id">${esc(vehiculoTxt(s.vehiculo))}</span><span class="sub">${esc(s.vehiculo.placas)} · orden ${s.orden}</span></td>
              <td class="m-line2"><span class="truncate client">${esc(s.cliente.nombre)}</span></td>
              <td class="m-right">${pill(s.estatus)}</td>
              <td class="n m-hide">${diasCelda(s)}</td>
              <td class="m-hide">${persona(s.tecnico)}</td>
              ${importes ? `<td class="n m-hide">${s.calc.total ? money(s.calc.total) : dash}</td>` : ''}
            </tr>`).join('')}
          </tbody>
        </table></div>
      </section>`;

    view.querySelector('[data-refresh]')?.addEventListener('click', (e) => { e.currentTarget.classList.add('gira'); conCarga(); });
    // periodo: los indicadores, el flujo y lo cobrado se recalculan; el piso siempre muestra el estado actual
    const fechas = view.querySelector('.fechas'), fd = view.querySelector('#f-desde'), fh = view.querySelector('#f-hasta');
    seg2(view.querySelector('.periodo .seg2'), (k) => {
      if (k === 'otro') { fechas.hidden = false; rango.k = 'otro'; fd.focus(); return; }
      const [desde, hasta] = PRESETS[k](); rango = { k, desde, hasta }; conCarga();
    });
    const cambiarFechas = () => {
      if (!fd.value || !fh.value) return;
      const [desde, hasta] = fd.value <= fh.value ? [fd.value, fh.value] : [fh.value, fd.value];
      rango = { k: 'otro', desde, hasta }; conCarga();
    };
    fd.addEventListener('change', cambiarFechas); fh.addEventListener('change', cambiarFechas);
    const TONO_TEC = ['blue', 'amber', 'plum', 'teal'];
    Graficas.barras(document.getElementById('chart-tec'), Object.keys(PERSONAL).filter((k) => PERSONAL[k].rol === 'Técnico').map((k, n) => ({ label: PERSONAL[k].nombre, href: `#/ordenes?f=piso&t=${k}`, value: piso.filter((x) => x.tecnico === k).length, color: `var(--c-${TONO_TEC[n % 4]})` })).sort((a, b) => b.value - a.value), { format: (v) => `${v} ${v === 1 ? 'servicio' : 'servicios'}` });
    view.querySelectorAll('[data-cobros]').forEach((b) => b.addEventListener('click', abrirCobros));
    const cm = document.getElementById('chart-mes');
    if (cm && importes) { cm.addEventListener('click', abrirCobros); cm.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirCobros(); } }); }
    view.querySelectorAll('[data-spark]').forEach((n) => Graficas.chispa(n, n.dataset.spark.split(',').map(Number), `var(--c-${n.dataset.tono})`));
    contar(view); entrada();
    drawMes(m);
  }

  // ---- octubre: lo cobrado y la utilidad, desde los servicios entregados ----
  const SEMANAS = [['28 sep', '2026-09-28', '2026-10-04'], ['5 oct', '2026-10-05', '2026-10-11'], ['12 oct', '2026-10-12', '2026-10-18'], ['19 oct', '2026-10-19', '2026-10-25'], ['26 oct', '2026-10-26', '2026-11-01']];
  // ---- periodo del dashboard: lo cobrado y lo entregado entre dos fechas (incluidas) ----
  const RANGO_MES = { k: 'mes', desde: '2026-10-01', hasta: '2026-10-28' };
  const PRIMER_DIA = '2026-09-01', HOY = '2026-10-28';
  const enRango = (iso, r) => !!iso && iso.slice(0, 10) >= r.desde && iso.slice(0, 10) <= r.hasta;
  const sumaDias = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DIA).toISOString().slice(0, 10);
  const PRESETS = { hoy: () => [HOY, HOY], '7d': () => [sumaDias(HOY, -6), HOY], mes: () => ['2026-10-01', HOY] };
  const fechaL = (iso) => `${+iso.slice(8)} ${MES_C[+iso.slice(5, 7) - 1]}`;
  const rangoTxt = (r) => (r.desde === r.hasta ? `el ${fechaL(r.desde)}` : r.desde.slice(0, 7) === r.hasta.slice(0, 7) ? `del ${+r.desde.slice(8)} al ${fechaL(r.hasta)}` : `del ${fechaL(r.desde)} al ${fechaL(r.hasta)}`);
  let rango = { ...RANGO_MES };
  function periodo(r) {
    const e = servicios.filter((s) => s.estatus === 'ENTREGADO' && enRango(s.entrega, r));
    const tot = (k) => p(e.reduce((t, s) => t + c(s.calc[k]), 0));
    const porSemana = (k) => SEMANAS.map(([, a, b]) => p(e.filter((s) => s.entrega.slice(0, 10) >= a && s.entrega.slice(0, 10) <= b).reduce((t, s) => t + c(s.calc[k]), 0)));
    const porTecnico = Object.keys(PERSONAL).filter((k) => PERSONAL[k].rol === 'Técnico').map((k) => ({ label: PERSONAL[k].nombre, value: e.filter((s) => s.tecnico === k).length }));
    const pagos = servicios.flatMap((s) => s.pagos.map(([f, , v]) => [f, v]));
    const dias = [];
    for (let d = r.desde; d <= r.hasta; d = sumaDias(d, 1)) dias.push(d);
    const cobroDia = dias.map((x) => p(pagos.filter(([f]) => f === x).reduce((t, [, v]) => t + c(v), 0)));
    const entregaDia = dias.map((x) => e.filter((s) => s.entrega.slice(0, 10) === x).length);
    const prom = e.length ? e.reduce((t, s) => t + Math.max(1, diasCal(s.ingreso, s.entrega)), 0) / e.length : 0;
    return { e, prom, n: e.length, cobrado: tot('pagado'), utilidad: tot('utilidad'), horas: e.reduce((t, s) => t + s.calc.horasMO, 0), porSemana, porTecnico, dias, cobroDia, entregaDia, cobros: p(cobroDia.reduce((t, v) => t + c(v), 0)) };
  }
  const mes = () => periodo(RANGO_MES); // la ventana de cobros sigue mostrando octubre completo
  function renderMes(m) {
    if (!puede.importes()) {
      return `<section class="panel hero" data-rise><header><h2>${ICO.ok}Servicios entregados</h2><span class="meta">${rangoTxt(rango)} · ${m.n} servicios</span></header><div id="chart-mes"></div></section>`;
    }
    const admin = puede.costos();
    return `<section class="panel hero" data-rise aria-labelledby="mes-h">
      <header>
        <div><h2 id="mes-h">${ICO.dollar}Cobrado</h2><span class="meta">dinero recibido, anticipos y liquidaciones · ${rangoTxt(rango)}</span></div>
        <button class="btn" type="button" data-cobros>${ICO.expand}Ver por día, mes y año</button>
      </header>
      <div class="hero-big"><span class="num" data-count="${m.cobros}" data-fmt="money">${money(m.cobros)}</span><span class="hero-sub">${m.n} servicios entregados</span></div>
      <div class="hero-chart"><div id="chart-mes" class="chart-click" role="button" tabindex="0" aria-label="Abrir el detalle de cobros por día, mes y año"></div></div>
      <div class="hero-stats">
        <div class="hs" data-go="#/bancos?tipo=ingreso" role="link" tabindex="0"><span>Cobrado en entregados</span><b class="num">${money(m.cobrado)}</b></div>
        ${admin ? `<div class="hs" data-go="#/reportes" role="link" tabindex="0"><span>Utilidad</span><b class="num v-pos">${money(m.utilidad)}</b><small>${m.cobrado ? `${dec(m.utilidad / m.cobrado * 100)} % de lo cobrado` : 'sin entregas en el periodo'}</small></div>
        <div class="hs" data-go="#/reportes" role="link" tabindex="0"><span>Horas de mano de obra</span><b class="num">${dec(m.horas)} h</b><small>utilidad MO ÷ ${money(CONFIG.tarifaHoraMO)}/h</small></div>` : ''}
      </div>
    </section>`;
  }
  function drawMes(m) {
    const el = document.getElementById('chart-mes');
    if (!el) return;
    // estado vacío: con un solo día no hay línea que trazar, y sin movimientos no hay nada que comparar
    const vacio = m.dias.length < 2 ? 'Elige un periodo de dos días o más para ver la tendencia; el total está arriba.'
      : !m.cobroDia.some(Boolean) && !m.entregaDia.some(Boolean) ? `Sin cobros ni entregas ${rangoTxt(rango)}.` : '';
    if (vacio) { el.innerHTML = `<div class="empty">${vacio}</div>`; el.classList.remove('chart-click'); return; }
    const labels = m.dias.map((x) => String(+x.slice(8)));
    const tips = m.dias.map((x) => `${DIA_C[new Date(x).getUTCDay()]} ${+x.slice(8)} de ${MES_L[+x.slice(5, 7) - 1]}`);
    const entregados = { label: 'Servicios entregados', values: m.entregaDia, color: 'var(--c-blue)', format: (v) => `${v}`, tick: (v) => `${+v.toFixed(1)}` };
    if (!puede.importes()) { Graficas.area(el, { labels, tips, series: [{ ...entregados, color: 'var(--c-red)' }], height: 240 }); return; }
    Graficas.area(el, { labels, tips, height: 300, series: [{ label: 'Cobrado', values: m.cobroDia, color: 'var(--positive)', format: money, tick: tickMoney }, entregados] });
  }

  // ===================== ÓRDENES =====================
  const FILTROS = {
    todos: { label: 'Todos', fn: () => true },
    piso: { label: 'En piso', fn: (s) => s.estatus !== 'ENTREGADO' },
    autorizar: { label: 'Por autorizar', fn: (s) => s.estatus === 'COTIZADO' },
    reparacion: { label: 'En reparación', fn: (s) => ['AUTORIZADO', 'EN_REPARACION', 'ESPERANDO_REFACCION'].includes(s.estatus) },
    listos: { label: 'Listos para entregar', fn: (s) => s.estatus === 'TERMINADO' },
    entregados: { label: 'Entregados', fn: (s) => s.estatus === 'ENTREGADO' },
    // filtros a los que se llega desde el dashboard y las notificaciones (solo salen como pestaña cuando están activos)
    demorados: { label: `Más de ${UMBRAL_DIAS} días en taller`, oculto: true, fn: (s) => s.estatus !== 'ENTREGADO' && diasEnTaller(s) >= UMBRAL_DIAS },
  };
  Object.entries(ESTATUS).forEach(([k, e]) => { FILTROS[`e_${k}`] = { label: e.label, oculto: true, fn: (s) => s.estatus === k }; });
  [['0 a 1 día', 0, 1], ['2 a 3 días', 2, 3], ['4 a 7 días', 4, 7], ['8 días o más', 8, 9999]]
    .forEach(([l, a, b]) => { FILTROS[`d_${a}`] = { label: `En piso: ${l}`, oculto: true, fn: (s) => s.estatus !== 'ENTREGADO' && diasEnTaller(s) >= a && diasEnTaller(s) <= b }; });
  let vista = 'lista';
  function renderOrdenes(params) {
    setTitle('Órdenes');
    const f = FILTROS[params.get('f')] ? params.get('f') : 'piso';
    const term = params.get('q') || '';
    const tec = PERSONAL[params.get('t')] ? params.get('t') : '';
    const importes = puede.importes();
    const lista = (t) => {
      const hits = t.trim() ? new Set(buscar(t, Infinity)) : null;
      return servicios.filter((s) => FILTROS[f].fn(s) && (!tec || s.tecnico === tec) && (!hits || hits.has(s))).sort((a, b) => new Date(b.ingreso) - new Date(a.ingreso));
    };
    const fila = (s, ts) => `
          <tr class="link" tabindex="0" data-href="#/orden/${s.codigo}">
            <td class="m-hide"><span class="id num">${s.orden}</span><span class="sub mono">${s.codigo}</span></td>
            <td><span class="id">${esc(vehiculoTxt(s.vehiculo))}</span><span class="sub">${marcar(s.vehiculo.placas, ts)}</span></td>
            <td class="m-line2">${marcar(s.cliente.nombre, ts)}</td>
            <td class="m-right">${pill(s.estatus)}</td>
            <td class="n m-hide">${fecha(s.ingreso)}</td>
            ${importes ? `<td class="n m-hide">${s.calc.total ? money(s.calc.total) : dash}</td><td class="n m-hide">${s.calc.total ? (s.calc.saldo ? money(s.calc.saldo) : money(0)) : dash}</td>` : `<td class="m-hide">${persona(s.tecnico)}</td>`}
          </tr>`;
    const cuerpo = (t) => { const l = lista(t), ts = tokens(t); return [l.length, l.map((s) => fila(s, ts)).join('') || `<tr><td colspan="7"><div class="empty">${t.trim() ? `Nada coincide con «${esc(t.trim())}». Prueba con las placas sin guiones o con un solo apellido.` : 'No hay servicios con este filtro.'}</div></td></tr>`]; };
    const [nFilas, htmlFilas] = cuerpo(term);
    const cuenta = (n) => `${n} ${n === 1 ? 'servicio' : 'servicios'}`;
    const totalOct = servicios.filter((s) => s.ingreso.startsWith('2026-10')).length;

    view.innerHTML = `
      <div class="title-row">
        <div><h1>Órdenes</h1><p class="sub">${totalOct} servicios con ingreso en octubre · ${enPiso().length} abiertos</p></div>
        <div class="actions">
          <div class="seg" role="group" aria-label="Vista"><button type="button" data-vista="lista" aria-pressed="${vista === 'lista'}">Lista</button><button type="button" data-vista="tablero" aria-pressed="${vista === 'tablero'}">Tablero</button></div>
        </div>
      </div>
      ${vista === 'lista' ? `
      <nav class="tabs" aria-label="Estatus">${Object.entries(FILTROS).filter(([k, v]) => !v.oculto || k === f).map(([k, v]) => `<a href="#/ordenes?f=${k}" aria-selected="${k === f}">${v.label}<span class="c">${servicios.filter(v.fn).length}</span></a>`).join('')}</nav>
      ${tec ? `<p class="chips-f"><a class="chip-b" href="#/ordenes?f=${f}">Técnico: ${esc(PERSONAL[tec].nombre)} ✕</a></p>` : ''}
      <div class="toolbar">
        <label class="filtro">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>
          <input type="search" id="filtro" value="${esc(term)}" placeholder="Nombre, placas u orden" aria-label="Filtrar servicios por nombre, placas u orden" autocomplete="off" spellcheck="false">
          <kbd aria-hidden="true">Esc</kbd>
        </label>
        <span class="spacer"></span><span class="count" aria-live="polite">${cuenta(nFilas)}</span>
      </div>
      <div class="table-wrap"><table class="respond">
        <thead><tr><th>Orden</th><th>Vehículo</th><th>Cliente</th><th>Estatus</th><th class="n">Ingreso</th>${importes ? '<th class="n">Total</th><th class="n">Saldo</th>' : '<th>Técnico</th>'}</tr></thead>
        <tbody id="filas">${htmlFilas}</tbody>
      </table></div>` : renderTablero()}`;

    view.querySelectorAll('[data-vista]').forEach((b) => b.addEventListener('click', () => { vista = b.dataset.vista; render(); }));
    // filtra en el lugar mientras se escribe: no redibuja la pantalla ni pierde el foco; la URL guarda el término
    const input = view.querySelector('#filtro');
    if (input) {
      const aplicar = () => {
        const [n, html] = cuerpo(input.value);
        view.querySelector('#filas').innerHTML = html; view.querySelector('.toolbar .count').textContent = cuenta(n);
        history.replaceState(null, '', `#/ordenes?f=${f}${tec ? `&t=${tec}` : ''}${input.value.trim() ? `&q=${encodeURIComponent(input.value.trim())}` : ''}`);
      };
      input.addEventListener('input', espera(aplicar, 150));
      input.addEventListener('keydown', (e) => { if (e.key === 'Escape' && input.value) { e.stopPropagation(); input.value = ''; aplicar(); } });
    }
  }
  // Carrocería según el catálogo (marca + modelo o alias). Si el modelo no está en el catálogo, ilustración genérica.
  const CARROC = new Map();
  window.CATALOGO.makes.forEach((mk) => mk.models.forEach((md) => [md.name, ...md.aliases].forEach((n) => CARROC.set(`${norm(mk.name)}|${norm(n)}`, md.bodyTypes[0]))));
  const NOMBRE_CARROC = { SEDAN: 'sedán', COUPE: 'cupé', CONVERTIBLE: 'convertible', HATCHBACK: 'hatchback', WAGON: 'guayín', SUV: 'SUV', PICKUP: 'pickup', VAN: 'van', MINIVAN: 'minivan' };
  function siluetaCard(veh) {
    const tipo = CARROC.get(`${norm(veh.marca)}|${norm(veh.modelo)}`);
    const t = tipo ? `Silueta de ${NOMBRE_CARROC[tipo] || 'auto'} (${veh.marca} ${veh.modelo})` : 'Modelo fuera del catálogo: ilustración genérica';
    return `<div class="card-car" title="${esc(t)}">${Diagrama.silueta(tipo)}</div>`;
  }
  function renderTablero() {
    const cols = [
      ['Recibido y diagnóstico', (s) => ['RECIBIDO', 'EN_DIAGNOSTICO'].includes(s.estatus)],
      ['Por autorizar', (s) => s.estatus === 'COTIZADO'],
      ['En reparación', (s) => ['AUTORIZADO', 'EN_REPARACION', 'ESPERANDO_REFACCION'].includes(s.estatus)],
      ['Listo para entregar', (s) => s.estatus === 'TERMINADO'],
      ['Entregado esta semana', (s) => s.estatus === 'ENTREGADO' && s.entrega >= '2026-10-26'],
    ];
    const importes = puede.importes();
    return `<div class="board" style="margin-top:8px">${cols.map(([t, fn]) => {
      const items = servicios.filter(fn);
      return `<section class="col" aria-label="${t}"><h3>${t}<span>${items.length}</span></h3>${items.map((s) => `
        <a class="card" href="#/orden/${s.codigo}" style="--st:var(--st-${s.estatus.toLowerCase()})">
          ${siluetaCard(s.vehiculo)}
          <div class="t">${esc(vehiculoTxt(s.vehiculo))}</div>
          <div class="s">${esc(s.vehiculo.placas)} · orden ${s.orden} · ${esc(s.cliente.nombre.split(' ').slice(0, 2).join(' '))}</div>
          <div class="f">${s.estatus === 'ESPERANDO_REFACCION' ? '<span class="pill warn">Esperando refacción</span>' : s.estatus === 'COTIZADO' ? `<span class="${horasDesde(s.cotizado) >= 24 ? '' : ''}" style="color:${horasDesde(s.cotizado) >= 24 ? 'var(--negative)' : 'var(--muted)'}">Espera ${horasDesde(s.cotizado)} h</span>` : persona(s.tecnico)}
          ${importes && s.calc.total ? `<span class="num">${money(s.calc.total)}</span>` : ''}</div>
        </a>`).join('') || '<div class="empty">Sin servicios</div>'}</section>`;
    }).join('')}</div>`;
  }

  // ===================== DETALLE =====================
  function estimar(s) {
    // en piso: se estima como si el saldo se cobrara en efectivo (sin comisión)
    if (!s.calc.saldo) return { k: s.calc, estimada: false };
    const pagos = [...s.pagos, ['', 'efectivo', s.calc.saldo, 0, 'Saldo estimado']];
    return { k: calcular({ ...s, pagos }), estimada: true };
  }
  function cascada(s) {
    const { k, estimada } = estimar(s);
    const max = k.total || 1;
    const fila = (lbl, v, cls = '', sign = '', extra = '') => `<div class="line ${cls}${sign === '−' ? ' egreso' : ''}"><span class="lbl">${lbl}${extra}</span><span class="v n">${sign}${money(v)}</span><span class="bar"><i style="width:${Math.max(0, v / max * 100)}%"></i></span></div>`;
    const pct = k.total ? k.comision / k.pagado * 100 : 0;
    return `<div class="cascade">
      ${fila('Total del servicio', k.total, 'total')}
      ${k.comision ? fila('Comisión bancaria del cobro', k.comision, '', '−', `<small>${dec(pct, 2)} %</small>`) : ''}
      ${fila('Costo de refacciones', k.costoRef, '', '−')}
      ${k.costoTot ? fila('Trabajo en otro taller (TOT)', k.costoTot, '', '−') : ''}
      ${fila('Utilidad de refacciones', k.utilidadRef, 'res', '', `<small>${CONFIG.margenRefacciones * 100} % del costo</small>`)}
      ${fila('Utilidad de mano de obra', k.utilidadMO, 'res', '', `<small>${dec(k.horasMO)} h a ${money(CONFIG.tarifaHoraMO)}</small>`)}
      ${fila('Utilidad', k.utilidad, 'res total')}
      <p class="note">${estimada ? 'Estimada: supone que el saldo se cobra en efectivo. ' : ''}Fórmulas del Excel del taller: utilidad de mano de obra = venta neta − refacciones − TOT − utilidad de refacciones. El margen y la tarifa se cambian en Configuración.</p>
    </div>`;
  }

  // Entregar un servicio: liquida el saldo (en efectivo en la demostración), lo pasa a Entregado y deja como
  // atendida su cita de entrega. Lo usan el detalle de la orden y la agenda de citas, así el estatus siempre coincide.
  const CITA_FINAL = ['Atendida', 'No atendida', 'Cancelada'];
  const citaEntrega = (s) => (window.FS.citas || []).filter((x) => x.servicio === s.codigo && x.motivo === 'Entrega' && !CITA_FINAL.includes(x.estatus)).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  const fechaCita = (x) => `${DIA_C[new Date(x.fecha).getUTCDay()]} ${+x.fecha.slice(8)}, ${x.hora}`;
  function entregar(s) {
    if (s.calc.saldo > 0) s.pagos.push([CONFIG.ahora.slice(0, 10), 'efectivo', s.calc.saldo, 0, 'Liquidación']);
    s.estatus = 'ENTREGADO'; s.entrega = CONFIG.ahora; s.calc = calcular(s);
    const cs = citaEntrega(s);
    cs.forEach((x) => { x.estatus = 'Atendida'; });
    return cs;
  }

  function renderDetalle(codigo) {
    const s = servicios.find((x) => x.codigo === codigo);
    if (!s) { view.innerHTML = `<div class="placeholder-screen"><h1>Servicio no encontrado</h1><p>No existe el servicio ${esc(codigo)}.</p><a class="btn" href="#/ordenes">Volver a órdenes</a></div>`; return; }
    setTitle(`Orden ${s.orden}`);
    const k = s.calc, importes = puede.importes(), costos = puede.costos(), e = ESTATUS[s.estatus];
    const hermanos = servicios.filter((x) => x.orden === s.orden && x.codigo !== s.codigo);
    const vinOk = s.vehiculo.vin && /^[A-HJ-NPR-Z0-9]{17}$/.test(s.vehiculo.vin);
    const cita = citaEntrega(s)[0];
    const primaria = s.estatus === 'COTIZADO' ? (tiene('autorizar') ? `<button class="btn primary" type="button" data-act="autorizar">Registrar autorización</button>` : '')
      : s.estatus === 'TERMINADO' && importes && tiene('pagos') ? `<button class="btn primary" type="button" data-act="entregar">${k.saldo > 0 ? `Registrar pago de ${money(k.saldo)} y entregar` : 'Entregar vehículo'}</button>`
      : s.estatus === 'TERMINADO' ? '' : s.estatus === 'ENTREGADO' ? '' : tiene('estatus') ? `<button class="btn primary" type="button" data-act="avanzar">Pasar a ${PASOS[Math.min(e.paso + 1, 6)].toLowerCase()}</button>` : '';
    const agendar = s.estatus === 'TERMINADO' && !cita && tiene('citas') ? `<button class="btn" type="button" data-act="agendar">${ICO.cal}Agendar entrega</button>` : '';

    view.innerHTML = `
      <div class="detail-head">
        <div>
          <div class="crumbs"><a href="#/ordenes">Órdenes</a><span aria-hidden="true" class="dash">/</span><h1>Orden ${s.orden}</h1><span class="chip mono" title="Identificador único del servicio">${s.codigo}</span>${pill(s.estatus)}</div>
          <p class="sub">${esc(s.cliente.nombre)} · ingresó ${fechaHora(s.ingreso)}${s.entrega ? ` · entregado ${fechaHora(s.entrega)} (${Math.max(1, diasCal(s.ingreso, s.entrega))} días en taller)` : ''}${cita ? ` · <a class="btn-link" href="#/citas">cita de entrega: ${fechaCita(cita)} (${cita.estatus.toLowerCase()})</a>` : ''}${hermanos.length ? ` · esta orden tiene otro servicio: <a class="btn-link" href="#/orden/${hermanos[0].codigo}">${hermanos[0].codigo}</a>` : ''}</p>
        </div>
        <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
          ${agendar}
          <button class="btn" type="button" data-act="seguimiento">Enviar seguimiento</button>
          <button class="btn" type="button" data-act="profeco">Formato PROFECO</button>
          ${primaria}
        </div>
      </div>
      <p class="steps-cap">Paso ${e.paso + 1} de ${PASOS.length}: ${PASOS[e.paso]}</p>
      <ol class="steps" aria-label="Avance del servicio">${PASOS.map((t, i) => `<li class="${i < e.paso ? 'done' : i === e.paso ? 'now' : ''}"${i === e.paso ? ' aria-current="step"' : ''}><span>${t}</span></li>`).join('')}</ol>
      <dl class="facts">
        <div><dt>Vehículo</dt><dd>${esc(vehiculoTxt(s.vehiculo))}${s.vehiculo.version ? ` · ${esc(s.vehiculo.version)}` : ''}</dd></div>
        <div><dt>Placas · VIN</dt><dd><span>${esc(s.vehiculo.placas)}</span> · <span class="mono">${s.vehiculo.vin ? esc(s.vehiculo.vin) : '—'}</span></dd>${s.vehiculo.vin && !vinOk ? `<dd class="warn">El VIN tiene ${s.vehiculo.vin.length} caracteres; deben ser 17. Verificar en la tarjeta de circulación.</dd>` : ''}</div>
        <div><dt>Kilometraje</dt><dd class="num">${s.vehiculo.km ? `${int(s.vehiculo.km)} km` : '—'}</dd></div>
        <div><dt>Cliente</dt><dd>${esc(s.cliente.nombre)}</dd><dd class="warn" style="color:var(--muted)">${telMask(s.cliente.telefono)}</dd></div>
      </dl>
      <div class="detail-grid">
        <div>
          ${s.falla ? `<div class="sec-title"><h2>Falla reportada por el cliente</h2></div><p style="margin-bottom:8px">${esc(s.falla)}</p>` : ''}
          ${s.estatus === 'ESPERANDO_REFACCION' ? `<div class="finding" style="background:var(--pill-warning-bg);color:var(--pill-warning-ink);margin:8px 0"><p>${esc(s.espera)}</p></div>` : ''}
          <div class="sec-title"><h2>${s.estatus === 'COTIZADO' ? 'Trabajos cotizados' : 'Trabajos autorizados'}</h2><span class="meta">${s.trabajos.length ? `${s.trabajos.length} ${s.trabajos.length === 1 ? 'trabajo' : 'trabajos'}` : ''}</span></div>
          ${s.trabajos.length ? `<table><thead><tr><th>Trabajo</th>${importes ? '<th class="n">Precio</th>' : ''}</tr></thead>
            <tbody>${s.trabajos.map(([d, v]) => `<tr><td>${esc(d)}</td>${importes ? `<td class="n">${money(v)}</td>` : ''}</tr>`).join('')}</tbody>
            ${importes ? `<tfoot><tr><td>Total del servicio</td><td class="n">${money(k.total)}</td></tr></tfoot>` : ''}</table>`
            : `<div class="empty">${s.estatus === 'EN_DIAGNOSTICO' ? 'El diagnóstico de Alexander está en curso; la cotización se arma al terminarlo.' : 'Sin trabajos todavía: falta el diagnóstico.'}</div>`}
          <div class="sec-title"><h2>Concepto de refacciones</h2><span class="meta">${s.refacciones.length ? `${s.refacciones.length} conceptos` : ''}</span></div>
          ${s.refacciones.length ? `<div class="table-wrap"><table><thead><tr><th>Refacción</th><th>Proveedor</th><th>Factura o remisión</th><th class="n">Compra</th>${costos ? '<th class="n">Costo</th>' : ''}</tr></thead>
            <tbody>${s.refacciones.map(([d, v, prov, fac, f]) => `<tr><td>${esc(d)}</td><td>${esc(prov)}</td><td class="num">${fac ? esc(fac) : dash}</td><td class="n">${f ? fecha(f) : '<span class="dash">por comprar</span>'}</td>${costos ? `<td class="n">${money(v)}</td>` : ''}</tr>`).join('')}</tbody>
            ${costos ? `<tfoot><tr><td colspan="4">Costo de refacciones</td><td class="n">${money(k.costoRef)}</td></tr></tfoot>` : ''}</table></div>`
            : '<div class="empty">Sin refacciones registradas.</div>'}
          ${s.tot.length ? `<div class="sec-title"><h2>Trabajo en otro taller (TOT)</h2></div>
            <table><thead><tr><th>Concepto</th><th>Proveedor</th><th class="n">Fecha</th>${costos ? '<th class="n">Costo</th>' : ''}</tr></thead>
            <tbody>${s.tot.map(([d, v, prov, fac, f]) => `<tr><td>${esc(d)}${fac ? ` <span class="dash">· ${esc(fac)}</span>` : ''}</td><td>${esc(prov)}</td><td class="n">${f ? fecha(f) : '<span class="dash">pendiente</span>'}</td>${costos ? `<td class="n">${money(v)}</td>` : ''}</tr>`).join('')}</tbody></table>` : ''}
        </div>
        <aside class="stack">
          ${costos && k.total ? `<section class="panel"><header><h2>Del cobro a la utilidad</h2></header>${cascada(s)}</section>` : ''}
          ${importes && k.total ? `<section class="panel"><header><h2>Pagos</h2><span class="meta">${k.saldo ? `saldo ${money(k.saldo)}` : 'liquidado'}</span></header>
            <div class="rows">${s.pagos.map(([f, met, v, com, concepto]) => `<div class="row" style="justify-content:space-between"><span>${esc(concepto)}<span class="sub" style="display:block;color:var(--muted);font-size:12px">${fecha(f)} · ${{ tarjeta: 'Tarjeta', msi: 'Tarjeta a meses', efectivo: 'Efectivo', transferencia: 'Transferencia' }[met]}</span></span><span class="n">${money(v)}</span></div>`).join('') || '<div class="empty">Sin pagos todavía.</div>'}
            ${k.saldo ? `<div class="row" style="justify-content:space-between;font-weight:600"><span>Por cobrar</span><span class="n">${money(k.saldo)}</span></div>` : ''}</div></section>` : ''}
          ${!importes ? `<div class="locked"><b>Importes ocultos para el rol Técnico</b><span>Precios, costos y pagos solo los ven Administración y el asesor. Asignado a ${s.tecnico ? PERSONAL[s.tecnico].nombre : 'nadie todavía'}.</span></div>` : ''}
          ${importes && !costos && k.total ? `<div class="locked"><b>Costos y utilidad: solo Administración</b><span>El asesor ve precios y pagos, no costos de refacciones ni utilidad.</span></div>` : ''}
          <section class="panel"><header><h2>Personal</h2></header><div class="rows">
            <div class="row" style="justify-content:space-between"><span style="color:var(--muted)">Asesor</span>${persona(s.asesor)}</div>
            <div class="row" style="justify-content:space-between"><span style="color:var(--muted)">Técnico</span>${persona(s.tecnico)}</div></div></section>
        </aside>
      </div>`;

    view.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.act;
      if (a === 'seguimiento') toast(`Enlace de seguimiento listo para ${esc(s.cliente.nombre.split(' ')[0])}; por WhatsApp solo se envía el enlace. <a href="${waUrl(s)}" target="_blank" rel="noopener">Enviar por WhatsApp</a> · <a href="portal.html#${s.tracking || 'k7Qw2mZ9pL4xT8vR'}" target="_blank" rel="noopener">Ver como cliente</a>`);
      if (a === 'profeco') toast('El contrato PROFECO se genera en PDF en la fase 2: requiere RFC, domicilio y horarios del taller en Configuración.');
      if (a === 'autorizar') { s.estatus = 'AUTORIZADO'; toast(`Autorización registrada para la orden ${s.orden}. Las refacciones ya se pueden comprar.`); render(); }
      if (a === 'entregar') { const cs = entregar(s); toast(`Orden ${s.orden} cobrada y entregada.${cs.length ? ` La cita de entrega del ${fechaCita(cs[0])} quedó como atendida.` : ''}`); render(); }
      if (a === 'agendar') location.hash = `#/citas?entrega=${s.codigo}`;
      if (a === 'avanzar') { const sig = { RECIBIDO: 'EN_DIAGNOSTICO', EN_DIAGNOSTICO: 'COTIZADO', AUTORIZADO: 'EN_REPARACION', EN_REPARACION: 'TERMINADO', ESPERANDO_REFACCION: 'EN_REPARACION' }[s.estatus]; if (sig) { s.estatus = sig; if (sig === 'COTIZADO') s.cotizado = CONFIG.ahora; if (sig === 'TERMINADO') s.terminado = CONFIG.ahora; toast(`Orden ${s.orden}: ${ESTATUS[sig].label.toLowerCase()}.`); render(); } }
    }));
  }

  // ===================== NUEVA RECEPCIÓN (la pieza viva: catálogo real de vehículos) =====================
  const INVENTARIO = ['Instrumentos del tablero', 'Luces', 'Calefacción y A/C', 'Radio', 'Bocinas', 'Claxon', 'Limpiadores', 'Espejo retrovisor', 'Espejos laterales', 'Cristales', 'Vestiduras', 'Tapetes',
    'Manijas interiores', 'Molduras', 'Tapones de llantas', 'Antena', 'Tapón de gasolina', 'Birlo de seguridad', 'Llanta de refacción', 'Gato y maneral', 'Llave de cruz', 'Triángulos de seguridad', 'Extintor', 'Tarjeta de circulación'];
  const NOMBRE_CARROCERIA = { SEDAN: 'Sedán', HATCHBACK: 'Hatchback', SUV: 'SUV', PICKUP: 'Pickup', VAN: 'Van', MINIVAN: 'Minivan', COUPE: 'Coupé', CONVERTIBLE: 'Convertible', WAGON: 'Wagon' };

  function renderRecepcion() {
    setTitle('Nueva recepción');
    const codigoNuevo = `FS-26-${String(Number(servicios.map((s) => s.codigo.slice(-6)).sort().at(-1)) + 1).padStart(6, '0')}`;
    const st = { marca: '', modelo: '', anio: '', version: '', combustible: '', check: {}, danos: new Map(), notas: {}, sinDanos: false, herramienta: 'golpe' };
    let dibujado = '';
    const marcas = CATALOGO.makes.map((m) => m.name);

    view.innerHTML = `
      <div class="title-row">
        <div><h1>Nueva recepción</h1><p class="sub">Orden sugerida <strong>${CONFIG.siguienteOrden}</strong> · servicio <span class="mono">${codigoNuevo}</span> · Pablo recibe</p></div>
        <div class="actions"><a class="btn ghost" href="#/dashboard">Cancelar</a></div>
      </div>
      <form class="form-grid" id="rec" novalidate>
        <div>
          <fieldset class="fieldset"><legend>Cliente</legend>
            <div class="fields">
              <div class="field span2"><label for="f-nombre">Nombre completo</label><input class="input" id="f-nombre" autocomplete="name" required></div>
              <div class="field"><label for="f-tel">Teléfono</label><input class="input" id="f-tel" inputmode="numeric" maxlength="10" autocomplete="tel-national" aria-describedby="h-tel" required><span class="hint" id="h-tel">10 dígitos</span></div>
              <div class="field span4"><label style="display:flex;gap:10px;align-items:center;font-weight:400"><input type="checkbox" id="f-consent" checked style="width:18px;height:18px;accent-color:var(--text)"> Recibirá por WhatsApp solo el enlace para seguir su vehículo (aviso de privacidad entregado)</label></div>
            </div>
          </fieldset>

          <fieldset class="fieldset"><legend>Vehículo</legend>
            <p class="desc">Catálogo de ${int(CATALOGO.makes.reduce((t, m) => t + m.models.length, 0))} modelos vendidos en México desde 1990; si falta alguno, se agrega en Catálogos.</p>
            <div class="fields">
              <div class="field"><label for="f-marca">Marca</label><select class="input" id="f-marca" required><option value="">Elegir</option>${marcas.map((m) => `<option>${esc(m)}</option>`).join('')}</select></div>
              <div class="field"><label for="f-modelo">Modelo</label><select class="input" id="f-modelo" disabled required><option value="">Elige la marca</option></select></div>
              <div class="field"><label for="f-anio">Año</label><select class="input" id="f-anio" disabled required><option value="">Elige el modelo</option></select></div>
              <div class="field"><label for="f-version">Versión y motor</label><select class="input" id="f-version" disabled><option value="">Elige el año</option></select></div>
              <div class="field"><label for="f-placas">Placas</label><input class="input" id="f-placas" style="text-transform:uppercase" maxlength="10" required></div>
              <div class="field"><label for="f-color">Color</label><input class="input" id="f-color"></div>
              <div class="field span2"><label for="f-vin">VIN (número de serie)</label><input class="input mono" id="f-vin" maxlength="17" style="text-transform:uppercase" aria-describedby="h-vin"><span class="hint" id="h-vin">17 caracteres, sin I, O ni Q</span></div>
            </div>
            <div class="ref-card" id="ref" hidden></div>
          </fieldset>

          <fieldset class="fieldset"><legend>Ingreso</legend>
            <div class="fields">
              <div class="field"><label for="f-orden">Número de orden</label><input class="input num" id="f-orden" inputmode="numeric" value="${CONFIG.siguienteOrden}" aria-describedby="h-orden"><span class="hint" id="h-orden">Puede repetirse si es otro servicio de la misma orden</span></div>
              <div class="field"><label for="f-km">Kilometraje</label><input class="input num" id="f-km" inputmode="numeric" required></div>
              <div class="field span2"><label for="f-entrega">Persona que entrega el vehículo</label><input class="input" id="f-entrega" aria-describedby="h-entrega"><span class="hint" id="h-entrega">Si no es el cliente</span></div>
              <div class="field span4"><label>Gasolina al llegar</label><div class="seg" role="group" aria-label="Gasolina al llegar">${['Reserva', '1/4', '1/2', '3/4', 'Lleno'].map((g) => `<button type="button" data-fuel="${g}" aria-pressed="false">${g}</button>`).join('')}</div></div>
              <div class="field span4"><label for="f-falla">Falla reportada por el cliente</label><textarea class="input" id="f-falla" required placeholder="Con las palabras del cliente: qué nota, desde cuándo, cuándo pasa"></textarea></div>
            </div>
          </fieldset>

          <fieldset class="fieldset"><legend>Daños de carrocería</legend>
            <p class="desc">Carrocería: <strong id="dia-tipo">Sedán</strong>. Elige el tipo de daño y toca la zona en cualquier vista; vuelve a tocarla para quitarlo.</p>
            <div class="dmg">
              <div class="dmg-tools" role="group" aria-label="Tipo de daño">${Object.entries(Diagrama.TIPOS).map(([k, t]) => `<button type="button" class="tool t-${k}" data-tool="${k}" aria-pressed="${k === 'golpe'}"><span class="dot">${t.l}</span>${t.nombre}</button>`).join('')}</div>
              <div id="dia"></div>
              <div class="dmg-none"><input type="checkbox" id="f-sindanos"><label for="f-sindanos">El vehículo llegó sin daños visibles en la carrocería</label></div>
              <div class="hits-list" id="hits" aria-live="polite"></div>
            </div>
          </fieldset>

          <fieldset class="fieldset"><legend>Inventario del vehículo</legend>
            <p class="desc">Cada punto empieza sin revisar: se marca después de verlo.</p>
            <div class="check-tools"><button class="btn small" type="button" id="all-ok">Marcar los pendientes como Bien</button><span class="progress" id="progress"></span></div>
            <div class="checklist">${INVENTARIO.map((it, i) => `<div class="check-row"><span id="ci-${i}">${it}</span><span class="tri" role="group" aria-labelledby="ci-${i}">${[['bien', 'Bien'], ['danado', 'Dañado'], ['no', 'No tiene']].map(([v, l]) => `<button type="button" data-i="${i}" data-v="${v}" aria-pressed="false">${l}</button>`).join('')}</span></div>`).join('')}</div>
          </fieldset>
        </div>

        <aside class="side-sticky">
          <section class="panel summary"><header><h2>Resumen</h2></header>
            <div class="rows" id="resumen"></div>
            <p class="hint" id="faltan" style="color:var(--muted);font-size:12px;line-height:16px;margin:12px 0"></p>
            <button class="btn primary" type="submit" id="guardar" style="width:100%;height:40px">Guardar recepción</button>
          </section>
        </aside>
      </form>`;

    const $ = (id) => view.querySelector(id);
    const selMarca = $('#f-marca'), selModelo = $('#f-modelo'), selAnio = $('#f-anio'), selVer = $('#f-version');
    const modeloObj = () => CATALOGO.makes.find((m) => m.name === st.marca)?.models.find((m) => m.name === st.modelo);
    const versiones = () => (modeloObj()?.versions || []).filter((v) => +st.anio >= v.yearFrom && (v.yearTo == null || +st.anio <= v.yearTo));
    const carroceria = () => modeloObj()?.bodyTypes[0] || 'SEDAN';

    function opciones(sel, items, vacio) { sel.innerHTML = `<option value="">${vacio}</option>${items.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}`; sel.disabled = !items.length; }
    selMarca.addEventListener('change', () => {
      st.marca = selMarca.value; st.modelo = st.anio = st.version = '';
      const ms = CATALOGO.makes.find((m) => m.name === st.marca)?.models || [];
      opciones(selModelo, ms.map((m) => [m.name, m.aliases.length ? `${m.name} (${m.aliases[0].split(',')[0]})` : m.name]), st.marca ? 'Elegir' : 'Elige la marca');
      opciones(selAnio, [], 'Elige el modelo'); opciones(selVer, [], 'Elige el año'); actualizar();
    });
    selModelo.addEventListener('change', () => {
      st.modelo = selModelo.value; st.anio = st.version = '';
      const m = modeloObj(); const anios = [];
      if (m) for (let y = m.yearTo || 2026; y >= m.yearFrom; y--) anios.push([y, y]);
      opciones(selAnio, anios, st.modelo ? 'Elegir' : 'Elige el modelo'); opciones(selVer, [], 'Elige el año'); actualizar();
    });
    selAnio.addEventListener('change', () => {
      st.anio = selAnio.value; st.version = '';
      const vs = versiones();
      const items = vs.flatMap((v, i) => v.trims.map((t) => [`${i}|${t}`, `${t} · ${v.engine} · ${v.transmissions.join(' / ')}`]));
      opciones(selVer, items, st.anio ? (items.length ? 'Elegir' : 'Sin versiones en el catálogo') : 'Elige el año');
      if (st.anio && !items.length) selVer.disabled = true;
      actualizar();
    });
    selVer.addEventListener('change', () => { st.version = selVer.value; actualizar(); });

    view.querySelectorAll('[data-fuel]').forEach((b) => b.addEventListener('click', () => {
      st.combustible = b.dataset.fuel;
      view.querySelectorAll('[data-fuel]').forEach((x) => x.setAttribute('aria-pressed', x === b)); actualizar();
    }));
    view.querySelector('.checklist').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]'); if (!b) return;
      st.check[b.dataset.i] = b.dataset.v;
      b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); actualizar();
    });
    $('#all-ok').addEventListener('click', () => {
      INVENTARIO.forEach((_, i) => { if (!st.check[i]) { st.check[i] = 'bien'; view.querySelector(`button[data-i="${i}"][data-v="bien"]`).setAttribute('aria-pressed', 'true'); } });
      actualizar();
    });
    view.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => {
      st.herramienta = b.dataset.tool;
      view.querySelectorAll('[data-tool]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    }));
    const marcar = (g) => {
      const id = g.dataset.zone;
      if (st.danos.get(id) === st.herramienta) { st.danos.delete(id); delete st.notas[id]; } else st.danos.set(id, st.herramienta);
      st.sinDanos = false; $('#f-sindanos').checked = false;
      dibujar(); actualizar(); view.querySelector(`[data-zone="${id}"]`)?.focus();
    };
    $('#dia').addEventListener('click', (e) => { const g = e.target.closest('[data-zone]'); if (g) marcar(g); });
    $('#dia').addEventListener('keydown', (e) => { const g = e.target.closest('[data-zone]'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); marcar(g); } });
    $('#f-sindanos').addEventListener('change', (e) => { st.sinDanos = e.target.checked; if (st.sinDanos) { st.danos.clear(); st.notas = {}; } dibujar(); actualizar(); });
    $('#hits').addEventListener('input', (e) => { if (e.target.dataset.nota) st.notas[e.target.dataset.nota] = e.target.value; });
    $('#hits').addEventListener('click', (e) => { const b = e.target.closest('[data-quitar]'); if (b) { st.danos.delete(b.dataset.quitar); delete st.notas[b.dataset.quitar]; dibujar(); actualizar(); } });
    view.querySelectorAll('input:not([data-nota]), textarea').forEach((i) => i.addEventListener('input', actualizar));

    function dibujar() {
      const t = carroceria(), D = Diagrama;
      dibujado = t;
      $('#dia').innerHTML = D.vistas(t, st.danos);
      $('#dia-tipo').textContent = NOMBRE_CARROCERIA[t];
      $('#hits').innerHTML = st.danos.size ? [...st.danos].map(([id, tp]) => `<div class="hit-row t-${tp}"><span class="dot">${D.TIPOS[tp].l}</span><span class="what"><b>${esc(D.etiqueta(id))}</b><span>${D.TIPOS[tp].nombre}</span></span><input data-nota="${id}" value="${esc(st.notas[id] || '')}" placeholder="Detalle (opcional)" aria-label="Detalle de ${esc(D.etiqueta(id))}"><button class="hit-rm" type="button" data-quitar="${id}" aria-label="Quitar daño de ${esc(D.etiqueta(id))}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg></button></div>`).join('') : '<p class="hits-empty">Aún no hay daños marcados.</p>';
    }

    function faltantes() {
      const f = [];
      if (!$('#f-nombre').value.trim()) f.push('nombre');
      if (!/^\d{10}$/.test($('#f-tel').value)) f.push('teléfono de 10 dígitos');
      if (!st.marca || !st.modelo || !st.anio) f.push('marca, modelo y año');
      if (!$('#f-placas').value.trim()) f.push('placas');
      const vin = $('#f-vin').value.toUpperCase();
      if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) f.push('VIN válido');
      if (!$('#f-km').value.trim()) f.push('kilometraje');
      if (!st.combustible) f.push('gasolina');
      if (!st.sinDanos && !st.danos.size) f.push('daños de carrocería (o confirmar que no hay)');
      if (!$('#f-falla').value.trim()) f.push('falla reportada');
      const pend = INVENTARIO.length - Object.keys(st.check).length;
      if (pend) f.push(`${pend} puntos del inventario`);
      return f;
    }

    function actualizar() {
      // tarjeta de referencia del catálogo
      const m = modeloObj(), ref = $('#ref');
      if (m && st.anio) {
        const vs = versiones(); const elegida = st.version ? vs[+st.version.split('|')[0]] : (vs.length === 1 ? vs[0] : null);
        const kml = elegida ? elegida.fuelEconomyKmlCombined : vs.length ? `${dec(Math.min(...vs.map((v) => v.fuelEconomyKmlCombined)))}–${dec(Math.max(...vs.map((v) => v.fuelEconomyKmlCombined)))}` : null;
        ref.hidden = false;
        ref.innerHTML = `<div><dt>Carrocería</dt><dd>${NOMBRE_CARROCERIA[m.bodyTypes[0]]}${m.bodyTypes.length > 1 ? ` <small>o ${m.bodyTypes.slice(1).map((b) => NOMBRE_CARROCERIA[b].toLowerCase()).join(', ')}</small>` : ''}</dd></div>
          <div><dt>Rendimiento de referencia</dt><dd>${kml == null ? '—' : `${typeof kml === 'number' ? dec(kml) : kml} <small>km/l</small>`}</dd></div>
          <div><dt>Motor</dt><dd style="font-size:15px">${elegida ? `${esc(elegida.engine)} <small>${elegida.fuel.join(' / ')}</small>` : vs.length ? `${vs.length} ${vs.length === 1 ? 'opción' : 'opciones'} para ${st.anio}` : '—'}</dd></div>
          <div class="note">${vs.length ? 'Rendimiento combinado aproximado, referencia CONUEE; no es consumo garantizado. Si el cliente reporta mucho menos, anótalo en la falla.' : 'Este modelo aún no tiene versiones en el catálogo; captura el motor en las notas.'}</div>`;
      } else ref.hidden = true;
      if (dibujado !== carroceria()) dibujar();

      const rev = Object.keys(st.check).length;
      $('#progress').textContent = `${rev} de ${INVENTARIO.length} revisados`;
      const vin = $('#f-vin').value.toUpperCase();
      $('#f-vin').setAttribute('aria-invalid', vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ? 'true' : 'false');
      $('#h-vin').className = `hint${vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ? ' err' : ''}`;
      $('#h-vin').textContent = vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ? `${vin.length} de 17 caracteres${/[IOQ]/.test(vin) ? '; no lleva I, O ni Q' : ''}` : '17 caracteres, sin I, O ni Q';

      const dañados = Object.values(st.check).filter((v) => v === 'danado').length;
      $('#resumen').innerHTML = [
        ['Vehículo', st.modelo ? `${st.marca} ${st.modelo} ${st.anio || ''}` : '—'],
        ['Orden · servicio', `${$('#f-orden').value || '—'} · ${codigoNuevo}`],
        ['Gasolina', st.combustible || '—'],
        ['Inventario', `${rev} de ${INVENTARIO.length}${dañados ? ` · ${dañados} con daño` : ''}`],
        ['Daños en carrocería', st.danos.size ? `${st.danos.size} ${st.danos.size === 1 ? 'zona' : 'zonas'}` : st.sinDanos ? 'Sin daños' : 'Pendiente'],
      ].map(([a, b]) => `<div class="row"><span>${a}</span><span>${esc(b)}</span></div>`).join('');
      const f = faltantes();
      $('#faltan').textContent = f.length ? `Falta: ${f.join(', ')}.` : 'Todo listo. Al guardar se envía el enlace de seguimiento al cliente.';
      $('#guardar').disabled = !!f.length;
      $('#guardar').setAttribute('aria-describedby', 'faltan');
    }

    $('#rec').addEventListener('submit', (e) => {
      e.preventDefault();
      if (faltantes().length) return;
      const vs = versiones(), elegida = st.version ? vs[+st.version.split('|')[0]] : null;
      const nuevo = {
        orden: +$('#f-orden').value || CONFIG.siguienteOrden, codigo: codigoNuevo, estatus: 'RECIBIDO', ingreso: CONFIG.ahora,
        cliente: { nombre: $('#f-nombre').value.trim(), telefono: $('#f-tel').value, },
        vehiculo: { marca: st.marca, modelo: st.modelo, anio: +st.anio, version: elegida ? `${st.version.split('|')[1]} ${elegida.engine.split(' ')[0]}` : null, placas: $('#f-placas').value.toUpperCase(), color: $('#f-color').value, km: +$('#f-km').value.replace(/\D/g, ''), carroceria: carroceria(), vin: $('#f-vin').value.toUpperCase() || null },
        tecnico: null, asesor: 'pablo', falla: $('#f-falla').value.trim(), danos: [...st.danos].map(([zona, tipo]) => ({ zona, tipo, nota: st.notas[zona] || '' })), trabajos: [], refacciones: [], tot: [], pagos: [],
      };
      nuevo.calc = calcular(nuevo);
      servicios.push(nuevo);
      CONFIG.siguienteOrden = Math.max(CONFIG.siguienteOrden, nuevo.orden + 1);
      location.hash = `#/orden/${codigoNuevo}`;
      toast(`Recepción guardada: orden ${nuevo.orden} · ${codigoNuevo}. Enlace de seguimiento preparado para ${esc(nuevo.cliente.nombre.split(' ')[0])}.`);
    });
    actualizar();
  }

  // ===================== router =====================
  function render(anima = true) { if (anima) transicion(pintar); else pintar(); }
  function pintar() {
    const [path, qs] = (location.hash.slice(1) || '/dashboard').split('?');
    const params = new URLSearchParams(qs || '');
    const parts = path.split('/').filter(Boolean);
    const route = parts[0] === 'hoy' ? 'dashboard' : parts[0] || 'dashboard';
    markNav(route === 'orden' ? 'ordenes' : route);
    view.dataset.ruta = route;
    if (route === 'dashboard') renderHoy();
    else if (route === 'ordenes') renderOrdenes(params);
    else if (route === 'orden') renderDetalle(parts[1]);
    else if (route === 'recepcion') { if (tiene('recepcion')) renderRecepcion(); else { setTitle('Recepción'); view.innerHTML = '<div class="locked"><b>Sin permiso</b><span>Tu rol no puede registrar recepciones. Administración lo cambia en Empleados y roles.</span></div>'; } }
    else if (RUTAS[route]) RUTAS[route](parts.slice(1), params);
    else renderHoy();
    if (route === 'orden') compartir(view.querySelector('.crumbs h1'));
    else if (ultimo) { compartir(view.querySelector(`[data-href$="${ultimo}"] .id, a[href$="${ultimo}"] .t, a[href$="${ultimo}"] b`)); ultimo = null; }
    else compartir(null);
  }
  let prevRoute = '';
  // el resto de los módulos (citas, compras, reportes) se registran desde js/fase3.js
  window.FSApp = { entregar, citaEntrega, tiene, ROL_NOMBRE, avatar, fotoDe, pedirFoto, quitarFoto, pintarQuien, pintarAvisos, UMBRAL_DIAS, diasEnTaller, view, puede, esc, money, int, dec, fecha, fechaHora, toast, setTitle, ICO, seg2, segHtml, calmo, waUrl, enlaceSeguimiento, vehiculoTxt, render, rutas: RUTAS, rol: () => rol, ahora: AHORA, horasDesde, diasCal, persona, DIA_C, MES_L, tickMoney, suma };
  window.addEventListener('hashchange', () => {
    const r = location.hash.split('?')[0];
    render();
    if (r !== prevRoute) { window.scrollTo(0, 0); view.focus({ preventScroll: true }); }
    prevRoute = r;
  });
  render(false);
})();
