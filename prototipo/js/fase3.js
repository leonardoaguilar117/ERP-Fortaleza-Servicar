// Fase 3 (demostración): Citas y recordatorios, Compras y gastos, Reportes de rentabilidad.
// Se apoya en window.FSApp (js/app.js) y window.FS (datos.js y datos3.js). Sin backend: todo se calcula en el navegador.
(() => {
  const A = window.FSApp, F = window.FS;
  const { view, puede, esc, money, dec, toast, setTitle, ICO, seg2, segHtml, calmo, waUrl, MES_L, DIA_C, tickMoney, suma } = A;
  const HOY = '2026-10-28';
  const svg = (d) => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${d}</svg>`;
  const I = {
    plus: svg('<path d="M8 3v10M3 8h10"/>'), check: svg('<path d="m3.5 8.5 3 3 6-7"/>'), bell: svg('<path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3zM6.5 14h3"/>'),
    down: svg('<path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10"/>'), link: svg('<path d="M6.5 9.5a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-.7.7M9.5 6.5a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7.5 12l.7-.7"/>'),
    left: svg('<path d="M10 3.5 5.5 8l4.5 4.5"/>'), right: svg('<path d="m6 3.5 4.5 4.5L6 12.5"/>'), cart: ICO.cart || svg('<path d="M2 2.5h1.8l1.6 8h7.1l1.5-5.5H4.6"/><circle cx="6" cy="13" r="1"/><circle cx="11.5" cy="13" r="1"/>'),
    cal: ICO.cal, chart: ICO.flow, lock: svg('<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>'),
  };
  // egresos: siempre en rojos y naranjas, en tonos que se distinguen entre sí (variables --eg-* en css/fase4.css)
  const EGRESOS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `var(--eg-${n})`);
  const PALETA = ['--c-red', '--c-amber', '--c-teal', '--c-blue', '--c-plum', '--c-green', '--c-orange', '--c-slate'].map((v) => `var(${v})`);
  const fmtDia = (f) => `${DIA_C[new Date(f).getUTCDay()]} ${+f.slice(8)} de ${MES_L[+f.slice(5, 7) - 1]}`;
  const fCorta = (f) => `${+f.slice(8)} ${MES_L[+f.slice(5, 7) - 1].slice(0, 3)}`;
  const cap = (t) => t[0].toUpperCase() + t.slice(1);

  const bloqueado = (t) => { setTitle(t); view.innerHTML = `<div class="title-row"><div><h1>${t}</h1></div></div><div class="locked"><b>Sin permiso para tu rol</b><span>Administración decide qué ve cada rol en Empleados y roles. Para revisarlo, cambia a "Administración" en el selector de la barra lateral.</span></div>`; };

  function descargar(nombre, cab, filas) {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const txt = [cab, ...filas].map((r) => r.map(q).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Se descargó ${esc(nombre)}; se abre en Excel.`);
  }

  // ---------- ventana de formulario (encima de la pantalla, que sigue detrás) ----------
  let dlg = null;
  function cerrar() { if (calmo()) { dlg.close(); return; } dlg.classList.add('sale'); setTimeout(() => { dlg.close(); dlg.classList.remove('sale'); }, 170); }
  function formulario({ titulo, sub, campos, guardar = 'Guardar', alEscribir, alGuardar }) {
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.className = 'dlg dlg-form'; document.body.append(dlg);
      dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-cerrar]')) cerrar(); });
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); cerrar(); });
    }
    const campo = (c) => {
      const id = `f3-${c.id}`, req = c.req ? ' <span class="req" aria-hidden="true">*</span>' : '';
      let ctl;
      if (c.tipo === 'select') ctl = `<select class="input" id="${id}">${c.opts.map(([v, l]) => `<option value="${esc(v)}"${v === c.valor ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
      else if (c.tipo === 'textarea') ctl = `<textarea class="input" id="${id}" rows="3" placeholder="${esc(c.pista || '')}">${esc(c.valor || '')}</textarea>`;
      else if (c.tipo === 'check') return `<div class="field span2"><label class="chk"><input type="checkbox" id="${id}"${c.valor ? ' checked' : ''}> ${c.label}</label></div>`;
      else ctl = `<input class="input${c.tipo === 'number' ? ' num' : ''}" id="${id}" type="${c.tipo || 'text'}"${c.tipo === 'number' ? ' inputmode="decimal" min="0" step="0.01"' : ''}${c.lista ? ` list="${id}-l"` : ''} value="${esc(c.valor ?? '')}" placeholder="${esc(c.pista || '')}" autocomplete="off">${c.lista ? `<datalist id="${id}-l">${c.lista.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>` : ''}`;
      return `<div class="field${c.span === 2 ? ' span2' : ''}"><label for="${id}">${c.label}${req}</label>${ctl}${c.hint ? `<span class="hint">${c.hint}</span>` : ''}</div>`;
    };
    dlg.innerHTML = `<form class="dlg-card" novalidate>
      <header class="dlg-head"><div><h2>${titulo}</h2><p>${sub || ''}</p></div><button class="icon-btn" type="button" data-cerrar aria-label="Cerrar"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></header>
      <div class="fields f2">${campos.map(campo).join('')}</div>
      <p class="hint falta" id="f3-falta" aria-live="polite"></p>
      <div class="dlg-actions"><button class="btn ghost" type="button" data-cerrar>Cancelar</button><button class="btn primary" type="submit" id="f3-ok">${guardar}</button></div></form>`;
    const val = () => Object.fromEntries(campos.map((c) => { const n = dlg.querySelector(`#f3-${c.id}`); return [c.id, c.tipo === 'check' ? n.checked : n.value.trim()]; }));
    const poner = (id, v) => { dlg.querySelector(`#f3-${id}`).value = v; };
    const revisar = () => {
      const v = val(), falta = campos.filter((c) => c.req && !v[c.id]).map((c) => c.label.toLowerCase());
      dlg.querySelector('#f3-falta').textContent = falta.length ? `Falta: ${falta.join(', ')}.` : '';
      dlg.querySelector('#f3-ok').disabled = !!falta.length;
    };
    dlg.querySelector('form').addEventListener('input', () => { alEscribir?.(val(), poner); revisar(); });
    dlg.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); if (dlg.querySelector('#f3-ok').disabled) return; alGuardar(val()); cerrar(); });
    dlg.showModal(); revisar();
    dlg.querySelector('.dlg-card').setAttribute('tabindex', '-1'); dlg.querySelector('.dlg-card').focus({ preventScroll: true });
  }

  // =====================================================================================================
  // CITAS Y RECORDATORIOS
  // =====================================================================================================
  const ESTC = { 'Por confirmar': 'warn', Confirmada: 'pos', Atendida: '', 'No atendida': 'neg', Cancelada: '' };
  const FINAL = ['Atendida', 'No atendida', 'Cancelada'];
  let mesC = { a: 2026, m: 9 }, diaSel = HOY, asesorF = 'todos', verRec = true;
  const pillC = (e) => `<span class="pill ${ESTC[e]}">${e}</span>`;
  const citasDe = (f) => F.citas.filter((c) => c.fecha === f && (asesorF === 'todos' || c.asesor === asesorF)).sort((a, b) => a.hora.localeCompare(b.hora));
  const recDe = (f) => F.recordatorios.filter((r) => r.fecha === f && r.estado === 'Pendiente');
  const navCitas = () => { const n = F.citas.filter((c) => c.estatus === 'Por confirmar' && c.fecha >= HOY).length; const el = document.getElementById('nav-citas'); if (el) el.textContent = n || ''; };

  // una cita de entrega cuyo servicio ya se entregó queda como atendida (el estatus de los dos siempre coincide)
  const sincronizarEntregas = () => F.citas.forEach((c) => { if (c.motivo === 'Entrega' && !FINAL.includes(c.estatus) && F.servicios.find((x) => x.codigo === c.servicio)?.estatus === 'ENTREGADO') c.estatus = 'Atendida'; });
  sincronizarEntregas();

  function nuevaCita(fecha = diaSel, pre = {}) {
    const clientes = [...new Set(F.servicios.map((s) => s.cliente.nombre))];
    const vehs = F.servicios.map((s) => `${s.vehiculo.marca} ${s.vehiculo.modelo} ${s.vehiculo.anio} · ${s.vehiculo.placas}`);
    formulario({
      titulo: 'Nueva cita', sub: 'Se agenda en el calendario del taller. Por WhatsApp solo se envía el enlace de seguimiento.',
      campos: [
        { id: 'cliente', label: 'Cliente', req: true, lista: clientes, span: 2, pista: 'Escribe para buscar o captura uno nuevo', valor: pre.cliente },
        { id: 'vehiculo', label: 'Vehículo', req: true, lista: [...new Set(vehs)], span: 2, pista: 'Marca, modelo, año y placas', valor: pre.vehiculo, hint: 'Si el motivo es Entrega, la cita queda ligada al servicio: al entregar el vehículo se marca como atendida.' },
        { id: 'motivo', label: 'Motivo', tipo: 'select', valor: pre.motivo || 'Servicio', opts: ['Servicio', 'Diagnóstico', 'Revisión', 'Cotización', 'Entrega'].map((x) => [x, x]) },
        { id: 'asesor', label: 'Asesor', tipo: 'select', valor: 'pablo', opts: [['pablo', 'Pablo']] },
        { id: 'fecha', label: 'Fecha', tipo: 'date', req: true, valor: fecha },
        { id: 'hora', label: 'Hora', tipo: 'time', req: true, valor: '10:00' },
        { id: 'dur', label: 'Duración', tipo: 'select', valor: '60', opts: [['30', '30 minutos'], ['60', '1 hora'], ['90', '1 hora 30 min'], ['120', '2 horas']] },
        { id: 'notas', label: 'Notas', tipo: 'textarea', span: 2, pista: 'Lo que reportó el cliente' },
        { id: 'rec', label: 'Crear un recordatorio interno para confirmar la cita por llamada el día anterior', tipo: 'check', valor: true },
      ],
      alEscribir: (v, poner) => { const s = F.servicios.find((x) => x.cliente.nombre === v.cliente); if (s && !v.vehiculo) poner('vehiculo', `${s.vehiculo.marca} ${s.vehiculo.modelo} ${s.vehiculo.anio} · ${s.vehiculo.placas}`); },
      alGuardar: (v) => {
        const [veh, placas = ''] = v.vehiculo.split(' · '), mismos = F.servicios.filter((x) => x.cliente.nombre === v.cliente && x.vehiculo.placas === placas.trim());
        // la entrega se liga al servicio que está listo; cualquier otra cita, al más reciente
        const s = (v.motivo === 'Entrega' && mismos.find((x) => x.estatus === 'TERMINADO')) || mismos.sort((a, b) => b.ingreso.localeCompare(a.ingreso))[0];
        const id = `c${Date.now()}`;
        F.citas.push({ id, titulo: `${v.motivo}: ${v.cliente.split(' ')[0]}`, motivo: v.motivo, cliente: v.cliente, vehiculo: veh, placas: placas.trim(), servicio: s?.codigo || null, telefono: s?.cliente.telefono || null, fecha: v.fecha, hora: v.hora, dur: +v.dur, estatus: 'Por confirmar', notas: v.notas, asesor: v.asesor });
        if (v.rec) { const d = new Date(v.fecha); d.setUTCDate(d.getUTCDate() - 1); F.recordatorios.push({ id: `r${Date.now()}`, texto: `Llamar a ${v.cliente} para confirmar la cita`, fecha: d.toISOString().slice(0, 10), hora: '12:00', asesor: v.asesor, cita: id, estado: 'Pendiente' }); }
        diaSel = v.fecha; mesC = { a: +v.fecha.slice(0, 4), m: +v.fecha.slice(5, 7) - 1 };
        toast(`Cita agendada para ${fmtDia(v.fecha)} a las ${v.hora}. Queda por confirmar.`); navCitas(); A.render(false);
      },
    });
  }

  function accionesCita(c) {
    const final = FINAL.includes(c.estatus), pasada = c.fecha <= HOY;
    const sv = c.motivo === 'Entrega' && c.servicio ? F.servicios.find((x) => x.codigo === c.servicio) : null;
    // cita de entrega: se atiende entregando el vehículo, nunca por separado
    const entrega = !sv || final ? '' : sv.estatus === 'TERMINADO'
      ? (puede.tiene('pagos') && puede.importes() ? `<button class="btn primary btn-entrega" type="button" data-a="entregar" data-id="${c.id}">${I.check}${sv.calc.saldo > 0 ? `Cobrar ${money(sv.calc.saldo)} y entregar` : 'Entregar vehículo'}</button>` : '<span class="hint">El vehículo está listo; la entrega la registra quien cobra.</span>')
      : `<span class="hint">Se entrega cuando el servicio esté listo; hoy está ${esc(A.estatusTxt(sv.estatus).toLowerCase())}.</span>`;
    return `<div class="acc">
      ${c.estatus === 'Por confirmar' ? `<button class="btn${sv ? '' : ' primary'}" type="button" data-a="confirmar" data-id="${c.id}">${I.check}Confirmar</button>` : ''}
      ${entrega}
      ${c.estatus === 'Confirmada' && !sv ? `<button class="btn primary" type="button" data-a="atendida" data-id="${c.id}">${I.check}Marcar atendida</button>` : ''}
      ${c.servicio && c.telefono && !final ? `<button class="btn" type="button" data-a="enlace" data-id="${c.id}">${I.link}Enviar enlace</button>` : ''}
      ${!final && pasada ? `<button class="btn ghost" type="button" data-a="noatendida" data-id="${c.id}">No llegó</button>` : ''}
      ${!final ? `<button class="btn ghost" type="button" data-a="cancelar" data-id="${c.id}">Cancelar</button>` : ''}
    </div>`;
  }

  function renderCitas(_, params = new URLSearchParams()) {
    setTitle('Citas');
    if (!puede.tiene('citas')) { bloqueado('Citas y recordatorios'); return; }
    sincronizarEntregas();
    // llega desde el detalle de una orden lista: abre la cita de entrega ya llenada
    const porEntregar = F.servicios.find((x) => x.codigo === params.get('entrega'));
    if (porEntregar) {
      history.replaceState(null, '', '#/citas');
      const mañana = new Date(Date.parse(`${HOY}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);
      setTimeout(() => nuevaCita(mañana, { cliente: porEntregar.cliente.nombre, vehiculo: `${porEntregar.vehiculo.marca} ${porEntregar.vehiculo.modelo} ${porEntregar.vehiculo.anio} · ${porEntregar.vehiculo.placas}`, motivo: 'Entrega' }), 0);
    }
    const hoyCitas = F.citas.filter((c) => c.fecha === HOY && !FINAL.includes(c.estatus));
    const porConf = F.citas.filter((c) => c.estatus === 'Por confirmar' && c.fecha >= HOY).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
    const pendRec = F.recordatorios.filter((r) => r.estado === 'Pendiente').sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
    const delMes = F.citas.filter((c) => +c.fecha.slice(0, 4) === mesC.a && +c.fecha.slice(5, 7) - 1 === mesC.m).length;
    const kp = (l, ico, v, c, tono) => `<div class="kpi" data-rise style="--tono:var(--c-${tono})"><div class="kpi-top"><div class="kpi-label">${l}</div><span class="kpi-ico">${ico}</span></div><div class="kpi-value num">${v}</div><div class="cap">${c}</div></div>`;

    // calendario del mes (lunes a domingo)
    const primero = new Date(Date.UTC(mesC.a, mesC.m, 1)), off = (primero.getUTCDay() + 6) % 7, dias = new Date(Date.UTC(mesC.a, mesC.m + 1, 0)).getUTCDate();
    const celdas = [];
    for (let i = 0; i < Math.ceil((off + dias) / 7) * 7; i++) {
      const d = i - off + 1;
      if (d < 1 || d > dias) { celdas.push('<span class="cal-v"></span>'); continue; }
      const f = `${mesC.a}-${String(mesC.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, cs = citasDe(f), rs = verRec ? recDe(f) : [];
      celdas.push(`<button type="button" class="cal-d${f === HOY ? ' hoy' : ''}" data-f="${f}" aria-pressed="${f === diaSel}" aria-label="${fmtDia(f)}: ${cs.length} ${cs.length === 1 ? 'cita' : 'citas'}${rs.length ? `, ${rs.length} recordatorios` : ''}"><b>${d}</b><span class="dots">${cs.slice(0, 4).map((c) => `<i class="d-${ESTC[c.estatus] || 'gris'}"></i>`).join('')}${rs.length ? '<i class="d-rec"></i>' : ''}</span></button>`);
    }
    const agenda = citasDe(diaSel), recs = recDe(diaSel);
    const lista = agenda.map((c) => `<article class="cita" data-rise>
        <div class="hora"><b class="num">${c.hora}</b><small>${c.dur} min</small></div>
        <div class="cuerpo"><b>${esc(c.titulo)}</b><span>${esc(c.vehiculo)} · ${esc(c.placas)}</span><span>${esc(c.cliente)}${c.servicio ? ` · <a class="btn-link" href="#/orden/${c.servicio}">ver orden</a>` : ''}</span>${c.notas ? `<small>${esc(c.notas)}</small>` : ''}</div>
        ${pillC(c.estatus)}${accionesCita(c)}</article>`).join('');
    const sec = (id, t, n, cuerpo, vacio) => `<details class="pend" open><summary><span>${t}</span><b class="num">${n}</b></summary>${cuerpo || `<p class="vacio">${vacio}</p>`}</details>`;
    const rowC = (c) => `<div class="pr"><span><b>${esc(c.cliente.split(' ').slice(0, 2).join(' '))}</b><small>${fCorta(c.fecha)} · ${c.hora} · ${c.motivo}</small></span><button class="btn small" type="button" data-a="confirmar" data-id="${c.id}">Confirmar</button></div>`;
    const rowR = (r) => `<label class="pr rec"><input type="checkbox" data-r="${r.id}"><span><b>${esc(r.texto)}</b><small>${r.fecha === HOY ? 'hoy' : fCorta(r.fecha)} · ${r.hora}</small></span></label>`;

    view.innerHTML = `
      <div class="title-row">
        <div><h1>Citas y recordatorios</h1><p class="sub">Agenda del taller. Por WhatsApp solo se envía el enlace de seguimiento del vehículo.</p></div>
        <div class="actions"><button class="btn primary" type="button" data-nueva>${I.plus}Nueva cita</button></div>
      </div>
      <section class="kpis" aria-label="Resumen de citas">${kp('Citas del mes', I.cal, delMes, cap(MES_L[mesC.m]) + ' ' + mesC.a, 'blue')}${kp('Por confirmar', I.bell, porConf.length, 'desde hoy en adelante', 'amber')}${kp('Para hoy', I.check, hoyCitas.length, `${recDe(HOY).length} recordatorios para hoy`, 'green')}${kp('Recordatorios', I.bell, pendRec.length, 'pendientes para el asesor', 'plum')}</section>
      <div class="cal-bar">
        <div class="seg-mes"><button class="icon-btn" type="button" data-mes="-1" aria-label="Mes anterior">${I.left}</button><h2 id="cal-t">${cap(MES_L[mesC.m])} ${mesC.a}</h2><button class="icon-btn" type="button" data-mes="1" aria-label="Mes siguiente">${I.right}</button></div>
        <div class="cal-opc"><label class="sel-l">Asesor<select class="input" id="f-asesor"><option value="todos">Todos</option><option value="pablo"${asesorF === 'pablo' ? ' selected' : ''}>Pablo</option></select></label>
          <label class="chk"><input type="checkbox" id="f-rec"${verRec ? ' checked' : ''}> Mostrar recordatorios</label></div>
      </div>
      <div class="citas-grid">
        <div class="stack">
          <section class="panel" data-rise><div class="cal" role="group" aria-label="Calendario"><div class="cal-h" aria-hidden="true">${['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map((d) => `<span>${d}</span>`).join('')}</div><div class="cal-g">${celdas.join('')}</div></div>
            <div class="leyenda" aria-hidden="true"><span><i class="d-warn"></i>Por confirmar</span><span><i class="d-pos"></i>Confirmada</span><span><i class="d-gris"></i>Atendida</span><span><i class="d-neg"></i>No atendida</span><span><i class="d-rec"></i>Recordatorio</span></div></section>
          <section class="panel" data-rise aria-live="polite"><header><h2>${I.cal}${cap(fmtDia(diaSel))}</h2><span class="meta">${agenda.length} ${agenda.length === 1 ? 'cita' : 'citas'}</span></header>
            ${recs.length && verRec ? `<div class="rec-dia">${recs.map((r) => `<span>${I.bell}${r.hora} · ${esc(r.texto)}</span>`).join('')}</div>` : ''}
            ${lista || `<div class="empty">Sin citas este día<button class="btn small" type="button" data-nueva>Agendar una cita</button></div>`}</section>
        </div>
        <aside class="stack" aria-label="Acciones pendientes"><section class="panel" data-rise><header><h2>${ICO.alert}Acciones pendientes</h2></header>
          ${sec('c', 'Por confirmar', porConf.length, porConf.map(rowC).join(''), 'Sin citas por confirmar')}
          ${sec('h', 'Para hoy', hoyCitas.length + recDe(HOY).length, hoyCitas.map((c) => `<div class="pr"><span><b>${c.hora} · ${esc(c.titulo)}</b><small>${esc(c.vehiculo)}</small></span>${pillC(c.estatus)}</div>`).join('') + recDe(HOY).map(rowR).join(''), 'Nada para hoy')}
          ${sec('r', 'Recordatorios', pendRec.length, pendRec.map(rowR).join(''), 'Sin recordatorios pendientes')}</section></aside>
      </div>`;

    const rehacer = () => { A.render(false); };
    view.querySelectorAll('[data-nueva]').forEach((b) => b.addEventListener('click', () => nuevaCita()));
    view.querySelectorAll('[data-mes]').forEach((b) => b.addEventListener('click', () => { const d = new Date(Date.UTC(mesC.a, mesC.m + +b.dataset.mes, 1)); mesC = { a: d.getUTCFullYear(), m: d.getUTCMonth() }; document.startViewTransition && !calmo() ? document.startViewTransition(rehacer) : rehacer(); }));
    view.querySelectorAll('.cal-d').forEach((b) => b.addEventListener('click', () => { diaSel = b.dataset.f; rehacer(); }));
    view.querySelector('#f-asesor').addEventListener('change', (e) => { asesorF = e.target.value; rehacer(); });
    view.querySelector('#f-rec').addEventListener('change', (e) => { verRec = e.target.checked; rehacer(); });
    view.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('change', () => { F.recordatorios.find((r) => r.id === b.dataset.r).estado = 'Hecho'; toast('Recordatorio marcado como hecho.'); rehacer(); }));
    view.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
      const c = F.citas.find((x) => x.id === b.dataset.id), a = b.dataset.a;
      if (a === 'entregar') {
        const s = F.servicios.find((x) => x.codigo === c.servicio);
        A.entregar(s); toast(`Orden ${s.orden} entregada: el servicio pasó a Entregado y la cita quedó como atendida.`); navCitas(); rehacer(); return;
      }
      if (a === 'enlace') { const s = F.servicios.find((x) => x.codigo === c.servicio); toast(`Enlace de seguimiento listo para ${esc(c.cliente.split(' ')[0])}; por WhatsApp solo se envía el enlace. <a href="${waUrl(s)}" target="_blank" rel="noopener">Enviar por WhatsApp</a>`); return; }
      c.estatus = { confirmar: 'Confirmada', atendida: 'Atendida', noatendida: 'No atendida', cancelar: 'Cancelada' }[a];
      toast(`Cita de ${esc(c.cliente.split(' ')[0])}: ${c.estatus.toLowerCase()}.`); navCitas(); rehacer();
    }));
  }

  // =====================================================================================================
  // COMPRAS Y GASTOS
  // =====================================================================================================
  const ESTCOMP = { por_comprar: ['Por comprar', 'warn'], pendiente: ['Pendiente de pago', 'info'], pagada: ['Pagada', 'pos'], propio: ['Consumo propio', ''] };
  let tabCG = 'compras', fEst = '', fProv = '', fQ = '', limite = 20;
  const provs = () => [...new Set(F.compras.map((c) => c.proveedor).filter(Boolean))].sort();
  const pillCom = (e) => `<span class="pill ${ESTCOMP[e][1]}">${ESTCOMP[e][0]}</span>`;

  function nuevaCompra() {
    const abiertas = F.servicios.filter((s) => s.estatus !== 'ENTREGADO');
    formulario({
      titulo: 'Nueva compra', sub: 'La compra se guarda dentro de la orden: así su costo entra al cálculo de utilidad.',
      campos: [
        { id: 'servicio', label: 'Orden de servicio', tipo: 'select', span: 2, opts: abiertas.map((s) => [s.codigo, `${s.orden} · ${s.vehiculo.marca} ${s.vehiculo.modelo} ${s.vehiculo.anio}`]) },
        { id: 'tipo', label: 'Tipo', tipo: 'select', valor: 'Refacción', opts: [['Refacción', 'Refacción'], ['TOT', 'Trabajo en otro taller (TOT)']] },
        { id: 'proveedor', label: 'Proveedor', req: true, lista: provs() },
        { id: 'concepto', label: 'Descripción y número de parte', req: true, span: 2 },
        { id: 'costo', label: 'Costo', tipo: 'number', req: true, pista: '0.00' },
        { id: 'factura', label: 'Factura o remisión del proveedor', pista: 'Opcional' },
        { id: 'fecha', label: 'Fecha de compra', tipo: 'date', valor: HOY, hint: 'Déjala vacía si aún está por comprar.' },
      ],
      alGuardar: (v) => {
        const s = F.servicios.find((x) => x.codigo === v.servicio), fecha = v.fecha || null, costo = +v.costo || 0;
        const linea = [v.concepto, costo, v.proveedor, v.factura || null, fecha];
        (v.tipo === 'TOT' ? s.tot : s.refacciones).push(linea);
        s.calc = F.calcular(s);
        F.compras.unshift({ id: `n${Date.now()}`, servicio: s.codigo, orden: s.orden, vehiculo: `${s.vehiculo.marca} ${s.vehiculo.modelo} ${s.vehiculo.anio}`, tipo: v.tipo, concepto: v.concepto, costo, proveedor: v.proveedor, factura: v.factura || null, fecha, estatus: fecha ? 'pendiente' : 'por_comprar', linea });
        toast(`Compra registrada en la orden ${s.orden}.`); A.render(false);
      },
    });
  }
  function nuevoGasto() {
    formulario({
      titulo: 'Nuevo gasto', sub: 'Gastos del taller que no pertenecen a una orden: renta, luz, nómina, herramienta.',
      campos: [
        { id: 'categoria', label: 'Categoría', tipo: 'select', opts: F.CATEGORIAS.map((x) => [x, x]) },
        { id: 'monto', label: 'Monto', tipo: 'number', req: true, pista: '0.00' },
        { id: 'concepto', label: 'Concepto', req: true, span: 2 },
        { id: 'fecha', label: 'Fecha', tipo: 'date', req: true, valor: HOY },
        { id: 'proveedor', label: 'Proveedor o beneficiario', pista: 'Opcional' },
      ],
      alGuardar: (v) => { F.gastos.unshift({ id: `g${Date.now()}`, fecha: v.fecha, categoria: v.categoria, concepto: v.concepto, monto: +v.monto || 0, proveedor: v.proveedor }); tabCG = 'gastos'; toast('Gasto registrado.'); A.render(false); },
    });
  }

  function renderCompras() {
    setTitle('Gastos y compras');
    if (!puede.tiene('gastos')) { bloqueado('Gastos y compras'); return; }
    const C = F.compras, tot = (l) => suma(l.map((c) => c.costo));
    const por = (e) => C.filter((c) => c.estatus === e);
    const q = fQ.toLowerCase();
    const filas = C.filter((c) => (!fEst || c.estatus === fEst) && (!fProv || c.proveedor === fProv) && (!q || [c.orden, c.factura, c.concepto, c.proveedor, c.vehiculo].join(' ').toLowerCase().includes(q)))
      .sort((a, b) => (b.fecha || '9999').localeCompare(a.fecha || '9999'));
    const cardF = (k, ico, tono) => `<button type="button" class="kpi kpi-f" data-est="${k}" aria-pressed="${fEst === k}" style="--tono:var(--c-${tono})"><div class="kpi-top"><div class="kpi-label">${ESTCOMP[k][0]}</div><span class="kpi-ico">${ico}</span></div><div class="kpi-value num">${por(k).length}</div><div class="cap">${money(tot(por(k)))}</div></button>`;
    const chips = (fEst || fProv || fQ) ? `<div class="chips-f">${fEst ? `<button type="button" data-q="est">${ESTCOMP[fEst][0]} ✕</button>` : ''}${fProv ? `<button type="button" data-q="prov">${esc(fProv)} ✕</button>` : ''}${fQ ? `<button type="button" data-q="q">“${esc(fQ)}” ✕</button>` : ''}<button type="button" class="btn-link" data-q="todo">Limpiar todo</button></div>` : '';
    let cuerpo = '';

    if (tabCG === 'compras') {
      cuerpo = `<section class="kpis" aria-label="Filtrar por estatus">${cardF('por_comprar', I.cart, 'amber')}${cardF('pendiente', I.bell, 'blue')}${cardF('pagada', I.check, 'green')}${cardF('propio', ICO.auto, 'slate')}</section>
        <p class="nota-f">Toca una tarjeta para filtrar. Las compras se capturan dentro de cada orden; aquí se concentran y se dan por pagadas.</p>
        <div class="tools"><input class="input" id="f-q" type="search" value="${esc(fQ)}" placeholder="Buscar por orden, factura o refacción" aria-label="Buscar compras">
          <select class="input" id="f-prov" aria-label="Proveedor"><option value="">Todos los proveedores</option>${provs().map((p) => `<option${p === fProv ? ' selected' : ''}>${esc(p)}</option>`).join('')}</select>
          <button class="btn" type="button" data-export>${I.down}Exportar a Excel</button></div>${chips}
        <div class="table-wrap"><table class="respond"><thead><tr><th>Fecha</th><th>Orden</th><th>Concepto</th><th>Proveedor</th><th>Factura o remisión</th><th>Estatus</th><th class="n">Costo</th><th><span class="sr">Acciones</span></th></tr></thead>
        <tbody>${filas.slice(0, limite).map((c) => `<tr><td class="m-hide num">${c.fecha ? fCorta(c.fecha) : '<span class="dash">—</span>'}</td><td class="m-hide"><a class="btn-link" href="#/orden/${c.servicio}">${c.orden}</a></td>
          <td><span class="id">${esc(c.concepto)}</span><span class="sub">${esc(c.vehiculo)} · ${c.tipo === 'TOT' ? 'TOT' : 'refacción'} · orden ${c.orden}</span></td><td class="m-line2">${c.proveedor ? esc(c.proveedor) : '<span class="dash">sin desglose</span>'}${c.factura ? ` · ${esc(c.factura)}` : ''}</td>
          <td class="m-hide">${c.factura ? esc(c.factura) : '<span class="dash">—</span>'}</td><td class="m-right">${pillCom(c.estatus)}</td><td class="n m-hide v-neg">${money(c.costo)}</td>
          <td class="m-hide"><div class="acc-f">${c.estatus === 'pendiente' ? `<button class="btn small" type="button" data-pagar="${c.id}">Marcar pagada</button>` : ''}<button class="btn small ghost" type="button" data-ec="${c.id}">Editar</button></div></td></tr>`).join('') || '<tr><td colspan="8"><div class="empty">Sin compras con este filtro<button class="btn small" type="button" data-q="todo">Limpiar filtros</button></div></td></tr>'}</tbody>
        <tfoot><tr><td colspan="6">${filas.length > limite ? `Mostrando ${limite} de ${filas.length} · <button type="button" class="btn-link" data-mas>Mostrar más</button>` : `Total de ${filas.length} ${filas.length === 1 ? 'compra' : 'compras'}`}</td><td class="n v-neg">${money(tot(filas))}</td><td></td></tr></tfoot></table></div>`;
    } else if (tabCG === 'gastos') {
      const cats = F.CATEGORIAS.map((k, i) => ({ label: k, value: suma(F.gastos.filter((g) => g.categoria === k).map((g) => g.monto)), color: EGRESOS[i % EGRESOS.length] })).filter((r) => r.value > 0);
      cuerpo = `<div class="dgrid"><section class="panel" data-rise><header><h2>${I.chart}Gastos por categoría</h2><span class="meta">octubre</span></header><div id="chart-g"></div></section>
        <section class="panel flush" data-rise><header><h2>Gastos de octubre</h2><span class="meta">datos de muestra</span></header><div class="table-wrap"><table class="respond"><thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th class="n">Monto</th><th><span class="sr">Acciones</span></th></tr></thead>
          <tbody>${F.gastos.map((g) => `<tr><td class="m-hide num">${fCorta(g.fecha)}</td><td><span class="id">${esc(g.concepto)}</span><span class="sub">${fCorta(g.fecha)} · ${esc(g.proveedor || '—')}</span></td><td class="m-line2">${esc(g.categoria)}</td><td class="n m-right v-neg">${money(g.monto)}</td><td class="m-hide"><div class="acc-f"><button class="btn small ghost" type="button" data-eg="${g.id}">Editar</button><button class="btn small ghost" type="button" data-dg="${g.id}">Eliminar</button></div></td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="3">Total</td><td class="n v-neg">${money(suma(F.gastos.map((g) => g.monto)))}</td><td></td></tr></tfoot></table></div></section></div>`;
      view.dataset.cats = JSON.stringify(cats);
    } else {
      const filasP = provs().map((p) => { const l = C.filter((c) => c.proveedor === p), pend = l.filter((c) => c.estatus === 'pendiente'); const info = F.proveedoresInfo[p] || {}; return { p, info, n: l.length, total: tot(l), pend: tot(pend), ult: l.map((c) => c.fecha).filter(Boolean).sort().pop() }; }).sort((a, b) => b.total - a.total);
      cuerpo = `<div class="table-wrap"><table class="respond"><thead><tr><th>Proveedor</th><th>Tipo</th><th>Teléfono</th><th class="n">Compras</th><th class="n">Total comprado</th><th class="n">Por pagar</th><th>Última compra</th></tr></thead>
        <tbody>${filasP.map((r) => `<tr class="link" tabindex="0" data-prov="${esc(r.p)}"><td><span class="id">${esc(r.p)}</span><span class="sub">${esc(r.info.tipo || '')} · ${r.n} compras</span></td><td class="m-hide">${esc(r.info.tipo || '')}</td><td class="m-hide num">${esc(r.info.tel || '—')}</td><td class="n m-hide">${r.n}</td><td class="n m-right v-neg">${money(r.total)}</td><td class="n m-hide v-neg">${r.pend ? money(r.pend) : '<span class="dash">—</span>'}</td><td class="m-hide">${r.ult ? fCorta(r.ult) : '—'}</td></tr>`).join('')}</tbody></table></div>
        <p class="nota-f">Toca un proveedor para ver sus compras. Los contactos son datos de muestra.</p>`;
    }
    view.innerHTML = `
      <div class="title-row"><div><h1>Gastos y compras</h1><p class="sub">Lo que se compra para las órdenes, los gastos del taller y a quién se le compra.</p></div>
        <div class="actions">${tabCG === 'gastos' ? `<button class="btn primary" type="button" data-ng>${I.plus}Nuevo gasto</button>` : `<button class="btn primary" type="button" data-nc>${I.plus}Nueva compra</button>`}</div></div>
      ${segHtml([['compras', 'Compras'], ['gastos', 'Gastos'], ['prov', 'Proveedores']], tabCG === 'proveedores' ? 'prov' : tabCG, 'Sección')}
      <div class="cg-cuerpo">${cuerpo}</div>`;

    const rehacer = () => A.render(false);
    seg2(view.querySelector('.seg2'), (k) => { tabCG = k === 'prov' ? 'proveedores' : k; rehacer(); });
    view.querySelector('[data-mas]')?.addEventListener('click', () => { limite += 25; rehacer(); });
    view.querySelector('[data-nc]')?.addEventListener('click', nuevaCompra);
    view.querySelector('[data-ng]')?.addEventListener('click', nuevoGasto);
    view.querySelectorAll('[data-est]').forEach((b) => b.addEventListener('click', () => { fEst = fEst === b.dataset.est ? '' : b.dataset.est; limite = 20; rehacer(); }));
    view.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.q; if (k === 'est' || k === 'todo') fEst = ''; if (k === 'prov' || k === 'todo') fProv = ''; if (k === 'q' || k === 'todo') fQ = ''; limite = 20; rehacer(); }));
    view.querySelector('#f-prov')?.addEventListener('change', (e) => { fProv = e.target.value; rehacer(); });
    const qi = view.querySelector('#f-q'); qi?.addEventListener('change', () => { fQ = qi.value.trim(); rehacer(); });
    view.querySelectorAll('[data-ec]').forEach((b) => b.addEventListener('click', () => A.editarCompra(b.dataset.ec)));
    view.querySelectorAll('[data-eg]').forEach((b) => b.addEventListener('click', () => A.editarGasto(b.dataset.eg)));
    view.querySelectorAll('[data-dg]').forEach((b) => b.addEventListener('click', () => A.eliminarGasto(b.dataset.dg)));
    view.querySelectorAll('[data-pagar]').forEach((b) => b.addEventListener('click', () => { F.compras.find((c) => c.id === b.dataset.pagar).estatus = 'pagada'; toast('Compra marcada como pagada.'); rehacer(); }));
    view.querySelectorAll('tr[data-prov]').forEach((tr) => { const ir = () => { fProv = tr.dataset.prov; tabCG = 'compras'; rehacer(); }; tr.addEventListener('click', ir); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') ir(); }); });
    view.querySelector('[data-export]')?.addEventListener('click', () => descargar('compras-fortaleza-servicar.csv', ['Fecha', 'Orden', 'Concepto', 'Tipo', 'Proveedor', 'Factura o remisión', 'Estatus', 'Costo'], filas.map((c) => [c.fecha || '', c.orden, c.concepto, c.tipo, c.proveedor, c.factura || '', ESTCOMP[c.estatus][0], c.costo])));
    if (tabCG === 'gastos') Graficas.pastel(document.getElementById('chart-g'), { rows: JSON.parse(view.dataset.cats), format: tickMoney, pill: (v) => `${Math.round(v / 1000)}k`, vacio: 'Sin gastos' });
  }

  // =====================================================================================================
  // REPORTES DE RENTABILIDAD
  // =====================================================================================================
  let tabR = 'rent';
  const SEM = [['28 sep', '2026-09-28', '2026-10-04'], ['5 oct', '2026-10-05', '2026-10-11'], ['12 oct', '2026-10-12', '2026-10-18'], ['19 oct', '2026-10-19', '2026-10-25'], ['26 oct', '2026-10-26', '2026-11-01']];
  const entregadosOct = () => F.servicios.filter((s) => s.estatus === 'ENTREGADO' && s.entrega.startsWith('2026-10'));

  function renderReportes() {
    setTitle('Reportes');
    if (!puede.tiene('reportes')) { bloqueado('Reportes'); return; }
    const E = entregadosOct(), k = (campo, l = E) => suma(l.map((s) => s.calc[campo]));
    const kp = (l, v, c, tono, ico, cls = '') => `<div class="kpi" data-rise style="--tono:var(--c-${tono})"><div class="kpi-top"><div class="kpi-label">${l}</div><span class="kpi-ico">${ico}</span></div><div class="kpi-value num ${cls}">${v}</div><div class="cap">${c}</div></div>`;
    const tono = (v) => (v >= 0 ? 'v-pos' : 'v-neg');
    const utilidad = k('utilidad'), gastos = suma(F.gastos.map((g) => g.monto)), venta = k('ventaNeta');
    const tecnicos = Object.keys(F.PERSONAL).filter((id) => F.PERSONAL[id].rol === 'Técnico').map((id, i) => { const l = E.filter((s) => s.tecnico === id); return { id, nombre: F.PERSONAL[id].nombre, n: l.length, mo: k('utilidadMO', l), ref: k('utilidadRef', l), util: k('utilidad', l), horas: l.reduce((t, s) => t + s.calc.horasMO, 0), color: PALETA[[3, 1, 4, 2][i % 4]] }; }).sort((a, b) => b.util - a.util);
    const provsR = provs().map((p, i) => { const l = F.compras.filter((c) => c.proveedor === p); return { p, n: l.length, total: suma(l.map((c) => c.costo)), color: EGRESOS[i % EGRESOS.length] }; }).sort((a, b) => b.total - a.total);
    const cats = F.CATEGORIAS.map((c, i) => ({ label: c, value: suma(F.gastos.filter((g) => g.categoria === c).map((g) => g.monto)), color: EGRESOS[i % EGRESOS.length] })).filter((r) => r.value > 0);
    let cuerpo = '', exportar = null;

    if (tabR === 'rent') {
      const filas = [...E].sort((a, b) => b.calc.utilidad - a.calc.utilidad);
      cuerpo = `<section class="kpis">${kp('Venta neta', money(venta), `${E.length} servicios entregados`, 'blue', I.chart)}${kp('Utilidad', money(utilidad), `${dec(utilidad / venta * 100)} % de la venta`, 'green', I.check, tono(utilidad))}${kp('Utilidad de mano de obra', money(k('utilidadMO')), `${dec(E.reduce((t, s) => t + s.calc.horasMO, 0))} horas`, 'green', ICO.espera, tono(k('utilidadMO')))}${kp('Utilidad de refacciones', money(k('utilidadRef')), '30 % del costo', 'green', I.cart, tono(k('utilidadRef')))}</section>
        <div class="dgrid"><section class="panel" data-rise><header><h2>${I.chart}Utilidad por semana de entrega</h2></header><div id="chart-r1"></div></section>
        <section class="panel" data-rise><header><h2>Las 8 órdenes más rentables</h2></header><div id="chart-r2"></div></section></div>
        <section class="panel flush" data-rise><header><h2>Rentabilidad por orden</h2><span class="meta">octubre · fórmulas del Excel del taller</span></header><div class="table-wrap"><table class="respond"><thead><tr><th>Orden</th><th>Vehículo</th><th class="n">Venta neta</th><th class="n">Refacciones</th><th class="n">TOT</th><th class="n">Utilidad MO</th><th class="n">Utilidad ref.</th><th class="n">Utilidad</th><th class="n">Horas MO</th></tr></thead>
        <tbody>${filas.map((s) => `<tr class="link" tabindex="0" data-href="#/orden/${s.codigo}"><td class="m-hide"><span class="id num">${s.orden}</span></td><td><span class="id">${esc(s.vehiculo.marca)} ${esc(s.vehiculo.modelo)} ${s.vehiculo.anio}</span><span class="sub">orden ${s.orden} · ${esc(F.PERSONAL[s.tecnico]?.nombre || '')}</span></td><td class="n m-hide">${money(s.calc.ventaNeta)}</td><td class="n m-hide v-neg">${money(s.calc.costoRef)}</td><td class="n m-hide v-neg">${money(s.calc.costoTot)}</td><td class="n m-hide ${tono(s.calc.utilidadMO)}">${money(s.calc.utilidadMO)}</td><td class="n m-hide v-pos">${money(s.calc.utilidadRef)}</td><td class="n m-right ${tono(s.calc.utilidad)}"><b>${money(s.calc.utilidad)}</b></td><td class="n m-hide">${dec(s.calc.horasMO)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="2">Total</td><td class="n">${money(venta)}</td><td class="n v-neg">${money(k('costoRef'))}</td><td class="n v-neg">${money(k('costoTot'))}</td><td class="n v-pos">${money(k('utilidadMO'))}</td><td class="n v-pos">${money(k('utilidadRef'))}</td><td class="n ${tono(utilidad)}">${money(utilidad)}</td><td class="n">${dec(E.reduce((t, s) => t + s.calc.horasMO, 0))}</td></tr></tfoot></table></div></section>`;
      exportar = ['rentabilidad-por-orden.csv', ['Orden', 'Vehículo', 'Venta neta', 'Refacciones', 'TOT', 'Utilidad MO', 'Utilidad refacciones', 'Utilidad', 'Horas MO'], filas.map((s) => [s.orden, `${s.vehiculo.marca} ${s.vehiculo.modelo}`, s.calc.ventaNeta, s.calc.costoRef, s.calc.costoTot, s.calc.utilidadMO, s.calc.utilidadRef, s.calc.utilidad, +s.calc.horasMO.toFixed(2)])];
    } else if (tabR === 'tec') {
      cuerpo = `<div class="dgrid"><section class="panel" data-rise><header><h2>${ICO.users}Utilidad por técnico</h2></header><div id="chart-r1"></div></section><section class="panel" data-rise><header><h2>Horas de mano de obra</h2></header><div id="chart-r2"></div></section></div>
        <section class="panel flush" data-rise><header><h2>Por técnico</h2><span class="meta">servicios entregados en octubre</span></header><div class="table-wrap"><table class="respond"><thead><tr><th>Técnico</th><th class="n">Servicios</th><th class="n">Utilidad MO</th><th class="n">Utilidad ref.</th><th class="n">Utilidad</th><th class="n">Horas MO</th></tr></thead>
        <tbody>${tecnicos.map((t) => `<tr><td><span class="id">${esc(t.nombre)}</span><span class="sub">${t.n} servicios · ${dec(t.horas)} h</span></td><td class="n m-hide">${t.n}</td><td class="n m-hide v-pos">${money(t.mo)}</td><td class="n m-hide v-pos">${money(t.ref)}</td><td class="n m-right ${tono(t.util)}"><b>${money(t.util)}</b></td><td class="n m-hide">${dec(t.horas)}</td></tr>`).join('')}</tbody></table></div></section>`;
      exportar = ['rentabilidad-por-tecnico.csv', ['Técnico', 'Servicios', 'Utilidad MO', 'Utilidad refacciones', 'Utilidad', 'Horas MO'], tecnicos.map((t) => [t.nombre, t.n, t.mo, t.ref, t.util, +t.horas.toFixed(2)])];
    } else if (tabR === 'prov') {
      cuerpo = `<div class="dgrid"><section class="panel" data-rise><header><h2>${I.cart}Compras por proveedor</h2></header><div id="chart-r1"></div></section><section class="panel flush" data-rise><header><h2>Detalle</h2></header><div class="table-wrap"><table><thead><tr><th>Proveedor</th><th class="n">Compras</th><th class="n">Total</th></tr></thead><tbody>${provsR.map((r) => `<tr><td>${esc(r.p)}</td><td class="n">${r.n}</td><td class="n v-neg">${money(r.total)}</td></tr>`).join('')}</tbody><tfoot><tr><td>Total</td><td class="n">${provsR.reduce((t, r) => t + r.n, 0)}</td><td class="n v-neg">${money(suma(provsR.map((r) => r.total)))}</td></tr></tfoot></table></div></section></div>`;
      exportar = ['compras-por-proveedor.csv', ['Proveedor', 'Compras', 'Total'], provsR.map((r) => [r.p, r.n, r.total])];
    } else if (tabR === 'gas') {
      cuerpo = `<section class="kpis">${kp('Gastos del mes', money(gastos), `${F.gastos.length} gastos · datos de muestra`, 'red', I.chart, 'v-neg')}${kp('Categoría mayor', cats.sort((a, b) => b.value - a.value)[0].label, money(cats[0].value), 'amber', I.cart)}</section>
        <div class="dgrid"><section class="panel" data-rise><header><h2>Gastos por categoría</h2></header><div id="chart-r1"></div></section><section class="panel flush" data-rise><header><h2>Detalle</h2></header><div class="table-wrap"><table><thead><tr><th>Categoría</th><th class="n">Monto</th><th class="n">%</th></tr></thead><tbody>${cats.map((r) => `<tr><td>${esc(r.label)}</td><td class="n v-neg">${money(r.value)}</td><td class="n">${dec(r.value / gastos * 100)} %</td></tr>`).join('')}</tbody></table></div></section></div>`;
      exportar = ['gastos-por-categoria.csv', ['Categoría', 'Monto'], cats.map((r) => [r.label, r.value])];
    } else {
      const res = Math.round((utilidad - gastos) * 100) / 100;
      cuerpo = `<section class="kpis">${kp('Utilidad de servicios', money(utilidad), 'mano de obra + refacciones', 'green', I.check, tono(utilidad))}${kp('Gastos del taller', money(gastos), 'datos de muestra', 'red', I.chart, 'v-neg')}${kp('Resultado del mes', money(res), res >= 0 ? 'utilidad menos gastos' : 'los gastos superan la utilidad', res >= 0 ? 'green' : 'red', I.cart, tono(res))}</section>
        <section class="panel" data-rise><header><h2>${I.chart}Cómo se forma el resultado</h2><span class="meta">octubre</span></header><div id="chart-r1"></div><p class="note">Resultado = utilidad de mano de obra + utilidad de refacciones − gastos del taller. Los gastos de octubre son de muestra, porque el Excel actual no los captura.</p></section>`;
      exportar = ['resultado-del-mes.csv', ['Concepto', 'Monto'], [['Utilidad de mano de obra', k('utilidadMO')], ['Utilidad de refacciones', k('utilidadRef')], ['Gastos', -gastos], ['Resultado', res]]];
    }

    view.innerHTML = `
      <div class="title-row"><div><h1>Reportes de rentabilidad</h1><p class="sub">Octubre de 2026 · solo Administración · fórmulas del Excel del taller</p></div><div class="actions"><button class="btn" type="button" data-export>${I.down}Exportar a Excel</button></div></div>
      ${segHtml([['rent', 'Rentabilidad'], ['tec', 'Técnicos'], ['prov', 'Proveedores'], ['gas', 'Gastos'], ['res', 'Resultado']], tabR, 'Reporte')}
      <div class="cg-cuerpo">${cuerpo}</div>`;
    seg2(view.querySelector('.seg2'), (v) => { tabR = v; A.render(false); });
    view.querySelector('[data-export]').addEventListener('click', () => descargar(...exportar));
    view.querySelectorAll('tr.link').forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));

    const $ = (id) => document.getElementById(id);
    if (tabR === 'rent') {
      const semanas = SEM.map(([, a, b]) => k('utilidad', E.filter((s) => s.entrega.slice(0, 10) >= a && s.entrega.slice(0, 10) <= b)));
      Graficas.columnas($('chart-r1'), { labels: SEM.map((x) => x[0]), values: semanas, format: money, tick: tickMoney, height: 240, etiqueta: 'Utilidad', color: 'var(--positive)' });
      Graficas.barras($('chart-r2'), [...E].sort((a, b) => b.calc.utilidad - a.calc.utilidad).slice(0, 8).map((s) => ({ label: `${s.orden}`, value: s.calc.utilidad, color: 'var(--positive)', href: `#/orden/${s.codigo}` })), { format: money });
    } else if (tabR === 'tec') {
      Graficas.barras($('chart-r1'), tecnicos.map((t) => ({ label: t.nombre, value: t.util, color: 'var(--positive)' })), { format: money });
      Graficas.barras($('chart-r2'), tecnicos.map((t) => ({ label: t.nombre, value: +t.horas.toFixed(1), color: t.color })), { format: (v) => `${dec(v)} h` });
    } else if (tabR === 'prov') Graficas.pastel($('chart-r1'), { rows: provsR.map((r) => ({ label: r.p, value: r.total, color: r.color })), format: tickMoney, pill: (v) => `${Math.round(v / 1000)}k` });
    else if (tabR === 'gas') Graficas.pastel($('chart-r1'), { rows: cats, format: tickMoney, pill: (v) => `${Math.round(v / 1000)}k` });
    else Graficas.barras($('chart-r1'), [{ label: 'Utilidad de mano de obra', value: k('utilidadMO'), color: 'var(--positive)' }, { label: 'Utilidad de refacciones', value: k('utilidadRef'), color: 'var(--positive)' }, { label: 'Gastos', value: gastos, color: 'var(--negative)' }, { label: 'Resultado', value: Math.max(0, utilidad - gastos), color: utilidad - gastos >= 0 ? 'var(--positive)' : 'var(--negative)' }], { format: money });
  }

  A.EGRESOS = EGRESOS; A.formulario = formulario; A.descargar = descargar; A.PALETA = PALETA; A.fCorta = fCorta; A.fmtDia = fmtDia; A.cap = cap; A.bloqueado = bloqueado; A.I = I;
  A.rutas.citas = renderCitas; A.rutas.compras = renderCompras; A.rutas.reportes = renderReportes;
  navCitas();
  if (['citas', 'compras', 'reportes'].includes(location.hash.slice(2).split(/[/?]/)[0])) A.render(false);
})();
